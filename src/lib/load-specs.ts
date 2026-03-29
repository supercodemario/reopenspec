import { readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import fg from 'fast-glob'
import { DEFAULT_SPECS_DIR } from './reopenspec-config.js'
import type { ApiContract, ApiContractsFile, LoadedFeatureSpec } from './spec-types.js'

const ALLOWED_KINDS = new Set([
  'export.class',
  'export.interface',
  'export.function',
  'export.type',
])

function parseApiContracts(json: unknown, path: string): ApiContractsFile {
  if (!json || typeof json !== 'object') throw new Error(`${path}: expected object`)
  const o = json as Record<string, unknown>
  if (o.version !== '0.2.0') throw new Error(`${path}: unsupported "version" (expected "0.2.0")`)
  if (!Array.isArray(o.contracts)) throw new Error(`${path}: expected "contracts" array`)
  const contracts: ApiContract[] = []
  for (let i = 0; i < o.contracts.length; i++) {
    const c = o.contracts[i]
    if (!c || typeof c !== 'object') throw new Error(`${path}: contracts[${i}] invalid`)
    const r = c as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id.trim()) throw new Error(`${path}: contracts[${i}].id required`)
    const m = r.mapsTo
    if (!m || typeof m !== 'object') throw new Error(`${path}: contracts[${i}].mapsTo required`)
    const mt = m as Record<string, unknown>
    if (typeof mt.file !== 'string') throw new Error(`${path}: contracts[${i}].mapsTo.file required`)
    if (typeof mt.symbol !== 'string') throw new Error(`${path}: contracts[${i}].mapsTo.symbol required`)
    if (typeof mt.kind !== 'string' || !ALLOWED_KINDS.has(mt.kind)) {
      throw new Error(`${path}: contracts[${i}].mapsTo.kind must be a known BaselineNodeKind`)
    }
    const entry: ApiContract = {
      id: r.id,
      mapsTo: {
        file: mt.file.replace(/\\/g, '/').replace(/^\.\//, ''),
        symbol: mt.symbol,
        kind: mt.kind as ApiContract['mapsTo']['kind'],
      },
    }
    if (r.forbidsImports !== undefined) {
      if (!Array.isArray(r.forbidsImports) || !r.forbidsImports.every((x) => typeof x === 'string')) {
        throw new Error(`${path}: contracts[${i}].forbidsImports must be string[]`)
      }
      entry.forbidsImports = r.forbidsImports as string[]
    }
    contracts.push(entry)
  }
  return { version: '0.2.0', contracts }
}

/** Load every `{specsDir}/{feature}/api-contracts.json` under the workspace. */
export async function loadFeatureSpecs(
  workspaceRoot: string,
  specsDir = DEFAULT_SPECS_DIR,
): Promise<LoadedFeatureSpec[]> {
  const root = resolve(workspaceRoot)
  const dir = specsDir.replace(/\\/g, '/').replace(/\/$/, '') || DEFAULT_SPECS_DIR
  const paths = await fg([`${dir}/*/api-contracts.json`], {
    cwd: root,
    onlyFiles: true,
    dot: false,
    ignore: ['**/node_modules/**'],
  })
  const out: LoadedFeatureSpec[] = []
  for (const rel of paths) {
    const abs = join(root, rel)
    const raw = readFileSync(abs, 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch (e) {
      throw new Error(`${rel}: invalid JSON (${e instanceof Error ? e.message : String(e)})`)
    }
    const api = parseApiContracts(parsed, rel)
    const specDir = dirname(rel)
    const featureSlug = basename(specDir)
    out.push({
      featureSlug,
      specDir,
      apiContractsPath: rel.replace(/\\/g, '/'),
      api,
    })
  }
  return out.sort((a, b) => a.featureSlug.localeCompare(b.featureSlug))
}
