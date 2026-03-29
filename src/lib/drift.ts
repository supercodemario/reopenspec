import { resolve } from 'node:path'
import type { ArchBaseline, BaselineNode } from './baseline.js'
import type { LoadedFeatureSpec } from './spec-types.js'
import { DEFAULT_SPECS_DIR } from './reopenspec-config.js'
import { loadFeatureSpecs } from './load-specs.js'

export type DriftCategory =
  | 'missing_implementation'
  | 'interface_mismatch'
  | 'deprecated_usage'
  | 'uncovered_path'

export type DriftSeverity = 'error' | 'warning'

export type DriftFinding = {
  category: DriftCategory
  severity: DriftSeverity
  contractId?: string
  featureSlug?: string
  specPath?: string
  baselineNodeId?: string
  message: string
}

export type DriftReport = {
  schemaVersion: '0.2.0'
  generatedAt: string
  workspaceRoot: string
  baselineGeneratedAt?: string
  summary: { errors: number; warnings: number }
  findings: DriftFinding[]
}

export function normalizeSpecPath(f: string): string {
  return f.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function fileMatchesNode(nodeFile: string, specFile: string): boolean {
  const a = nodeFile.replace(/\\/g, '/')
  const b = normalizeSpecPath(specFile)
  if (a === b) return true
  if (a.endsWith('/' + b)) return true
  return false
}

function nodesForSymbol(
  baseline: ArchBaseline,
  file: string,
  symbol: string,
): BaselineNode[] {
  return baseline.nodes.filter(
    (n) => n.name === symbol && n.name !== null && fileMatchesNode(n.file, file),
  )
}

/** Run drift detection: contracts vs baseline nodes and optional import rules. */
export async function runDriftDetection(args: {
  workspaceRoot: string
  baseline: ArchBaseline
  /** When true, warn on exports not listed in any contract (can be noisy). */
  strictUncovered?: boolean
  /** Root folder for feature specs (default `reopenspec/specs`). */
  specsDir?: string
}): Promise<DriftReport> {
  const { workspaceRoot, baseline, strictUncovered = false, specsDir = DEFAULT_SPECS_DIR } = args
  const root = resolve(workspaceRoot)
  const findings: DriftFinding[] = []
  const coveredNodeIds = new Set<string>()

  let features: LoadedFeatureSpec[] = []
  try {
    features = await loadFeatureSpecs(root, specsDir)
  } catch (e) {
    findings.push({
      category: 'missing_implementation',
      severity: 'error',
      message: `Failed to load specs: ${e instanceof Error ? e.message : String(e)}`,
    })
    return finalizeReport(root, baseline, findings)
  }

  const seenContractIds = new Map<string, string>()

  for (const feat of features) {
    for (const c of feat.api.contracts) {
      if (seenContractIds.has(c.id)) {
        findings.push({
          category: 'missing_implementation',
          severity: 'warning',
          contractId: c.id,
          featureSlug: feat.featureSlug,
          specPath: feat.apiContractsPath,
          message: `Duplicate contract id "${c.id}" (also in ${seenContractIds.get(c.id)})`,
        })
      } else {
        seenContractIds.set(c.id, feat.apiContractsPath)
      }

      const { file, symbol, kind } = c.mapsTo
      const candidates = nodesForSymbol(baseline, file, symbol)
      const exact = candidates.filter((n) => n.kind === kind)

      if (candidates.length === 0) {
        findings.push({
          category: 'missing_implementation',
          severity: 'error',
          contractId: c.id,
          featureSlug: feat.featureSlug,
          specPath: feat.apiContractsPath,
          message: `No export "${symbol}" in "${file}" (per baseline scan).`,
        })
        continue
      }

      if (exact.length === 0) {
        const kinds = [...new Set(candidates.map((n) => n.kind))].join(', ')
        findings.push({
          category: 'interface_mismatch',
          severity: 'error',
          contractId: c.id,
          featureSlug: feat.featureSlug,
          specPath: feat.apiContractsPath,
          baselineNodeId: candidates[0]?.id,
          message: `Symbol "${symbol}" exists but kind is ${kinds}; spec expects "${kind}".`,
        })
        continue
      }

      const primary = exact[0]!
      coveredNodeIds.add(primary.id)
      if (exact.length > 1) {
        findings.push({
          category: 'interface_mismatch',
          severity: 'warning',
          contractId: c.id,
          featureSlug: feat.featureSlug,
          specPath: feat.apiContractsPath,
          message: `Multiple baseline nodes match ${file}#${symbol} (${kind}); using ${primary.id}.`,
        })
      }

      if (c.forbidsImports?.length) {
        for (const prefix of c.forbidsImports) {
          const bad = baseline.edges.filter(
            (e) =>
              e.kind === 'imports' &&
              fileMatchesNode(e.fromFile, file) &&
              e.moduleSpecifier.startsWith(prefix),
          )
          for (const e of bad) {
            findings.push({
              category: 'deprecated_usage',
              severity: 'error',
              contractId: c.id,
              featureSlug: feat.featureSlug,
              specPath: feat.apiContractsPath,
              baselineNodeId: primary.id,
              message: `Forbidden import "${e.moduleSpecifier}" (matches "${prefix}") at ${e.fromFile}:${e.line}.`,
            })
          }
        }
      }
    }
  }

  const exportKinds = new Set([
    'export.class',
    'export.interface',
    'export.function',
    'export.type',
  ])
  if (strictUncovered) {
    for (const n of baseline.nodes) {
      if (!exportKinds.has(n.kind)) continue
      if (coveredNodeIds.has(n.id)) continue
      findings.push({
        category: 'uncovered_path',
        severity: 'warning',
        baselineNodeId: n.id,
        message: `Export ${n.kind} "${n.name ?? '?'}" in ${n.file}:${n.line} is not referenced by any api-contracts.json.`,
      })
    }
  }

  return finalizeReport(root, baseline, findings)
}

function finalizeReport(workspaceRoot: string, baseline: ArchBaseline, findings: DriftFinding[]): DriftReport {
  const errors = findings.filter((f) => f.severity === 'error').length
  const warnings = findings.filter((f) => f.severity === 'warning').length
  return {
    schemaVersion: '0.2.0',
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    baselineGeneratedAt: baseline.generatedAt,
    summary: { errors, warnings },
    findings,
  }
}
