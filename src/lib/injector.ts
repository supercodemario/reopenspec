import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type DetectedIde = 'cursor' | 'windsurf' | 'roo' | 'cline' | 'antigravity' | 'universal'

const REOPENSPEC_RULES = `# ReOpenSpec

**What the baseline is:** \`arch-baseline.json\` (path in \`reopenspec.json\`, usually \`reopenspec/specs/.meta/arch-baseline.json\`) is the **AST-grounded export snapshot** from \`reo sync\`. Use it especially for **first-time /reo-blueprint** work and whenever you need **accurate module and public-API structure** without guessing.

**How to use it:** Prefer baseline + \`reopenspec/specs/\` (and \`api-contracts.json\`) for **structural truth** — which files export what, how contracts map to symbols. If something is missing from the baseline, say so and suggest \`reo sync\` or treat it as an open question — do not invent modules or exports.

**Codebase access:** You **may and should** read and edit application source when **implementing** features, fixes, or reviews. The baseline does **not** replace reading code for those tasks; it **grounds** specs and drift checks so structure and contracts stay honest.

`

const WORKFLOW_START = `# ReOpenSpec: Start Feature

Use **baseline JSON** + \`reopenspec/specs/\` for initial architecture and planning context (especially **blueprint**). Then follow the traceable workflow: \`reo init\` → \`/reo-blueprint\` → \`/reo-plan\` → \`reopenspec/changes/active/<id>/\` → \`/reo-proceed-plan\`. See \`commands/README.md\` in the ReOpenSpec package/repo.

`

const WORKFLOW_SYNC = `# ReOpenSpec: Sync Spec

Read the baseline and drift report, compare to the chosen feature spec, and reconcile spec vs code with the developer. Open real source files when you need detail beyond the JSON snapshot.

`

export function detectIdes(workspaceRoot: string): DetectedIde[] {
  const root = resolve(workspaceRoot)
  const found: DetectedIde[] = []
  if (existsSync(join(root, '.cursor'))) found.push('cursor')
  if (existsSync(join(root, '.windsurf'))) found.push('windsurf')
  if (existsSync(join(root, '.roo'))) found.push('roo')
  if (existsSync(join(root, '.clinerules'))) found.push('cline')
  if (existsSync(join(root, '.agents'))) found.push('antigravity')
  return found
}

/** Same as \`detectIdes\` but yields \`universal\` when no IDE markers exist. */
export function detectIdesWithFallback(workspaceRoot: string): DetectedIde[] {
  const found = detectIdes(workspaceRoot)
  return found.length > 0 ? found : ['universal']
}

export type InjectionResult = { ide: DetectedIde; paths: string[] }

/** Write IDE workflow files (rules markdown). Does not register MCP servers. */
export function injectForIdes(workspaceRoot: string, explicitIdes?: DetectedIde[]): InjectionResult[] {
  const ides = explicitIdes && explicitIdes.length > 0 ? explicitIdes : detectIdesWithFallback(workspaceRoot)
  const results: InjectionResult[] = []

  for (const ide of ides) {
    if (ide === 'cursor' || ide === 'windsurf' || ide === 'roo' || ide === 'cline') {
      const paths = injectCursor(workspaceRoot, ide)
      results.push({ ide, paths })
    } else if (ide === 'universal') {
      const paths = injectUniversal(workspaceRoot)
      results.push({ ide, paths })
    } else if (ide === 'antigravity') {
      const paths = injectAntigravity(workspaceRoot)
      results.push({ ide, paths })
    } else {
      results.push({ ide, paths: [] })
    }
  }
  return results
}


function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true })
}

function injectCursor(workspaceRoot: string, ide: string): string[] {
  const root = resolve(workspaceRoot)
  
  let rulesRel = '.cursor/rules'
  if (ide === 'windsurf') rulesRel = '.windsurfrules'
  if (ide === 'roo') rulesRel = '.roo'
  if (ide === 'cline') rulesRel = '.cline'
  
  const rulesDir = join(root, rulesRel)
  ensureDir(rulesDir)
  const out: string[] = []
  const w = (rel: string, body: string) => {
    const abs = join(root, rel)
    writeFileSync(abs, body, 'utf8')
    out.push(rel)
  }
  w(join(rulesRel, 'reopenspec.md'), REOPENSPEC_RULES)
  w(join(rulesRel, 'reo-start-feature.md'), WORKFLOW_START)
  w(join(rulesRel, 'reo-sync-spec.md'), WORKFLOW_SYNC)
  return out
}

function injectUniversal(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const dir = join(root, '.ai-context')
  ensureDir(dir)
  const paths: string[] = []
  const w = (rel: string, body: string) => {
    writeFileSync(join(root, rel), body, 'utf8')
    paths.push(rel)
  }
  w(join('.ai-context', 'AGENTS.md'), REOPENSPEC_RULES)
  return paths
}

function injectAntigravity(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const rulesDir = join(root, '.agents', 'rules')
  ensureDir(rulesDir)
  const out: string[] = []
  const w = (rel: string, body: string) => {
    const abs = join(root, rel)
    writeFileSync(abs, body, 'utf8')
    out.push(rel)
  }
  w(join('.agents', 'rules', 'reopenspec.md'), REOPENSPEC_RULES)
  w(join('.agents', 'rules', 'reo-start-feature.md'), WORKFLOW_START)
  w(join('.agents', 'rules', 'reo-sync-spec.md'), WORKFLOW_SYNC)
  return out
}
