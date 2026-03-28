import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type DetectedIde = 'cursor' | 'windsurf' | 'roo' | 'cline' | 'universal'

const REOPENSPEC_RULES = `# ReOpenSpec

Do not infer architecture from the codebase. Read \`/specs/.meta/arch-baseline.json\` (or the path in \`reopenspec.json\`) and use only what is declared there. If a module or interface you need is not in the baseline, flag it as an open question — do not assume it.
`

const WORKFLOW_START = `# ReOpenSpec: Start Feature

Load architectural context from the baseline JSON only (see \`reopenspec.json\` paths). Traceable workflow: \`reo init\` → \`/reo-blueprint\` → \`/reo-plan\` → \`change/<id>/\` → \`/reo-proceed-plan\`. See \`commands/README.md\` in the ReOpenSpec package/repo.
`

const WORKFLOW_SYNC = `# ReOpenSpec: Sync Spec

Read the baseline and drift report, compare to the chosen feature spec, and reconcile spec vs code with the developer.
`

export function detectIdes(workspaceRoot: string): DetectedIde[] {
  const root = resolve(workspaceRoot)
  const found: DetectedIde[] = []
  if (existsSync(join(root, '.cursor'))) found.push('cursor')
  if (existsSync(join(root, '.windsurf'))) found.push('windsurf')
  if (existsSync(join(root, '.roo'))) found.push('roo')
  if (existsSync(join(root, '.clinerules'))) found.push('cline')
  return found
}

/** Same as \`detectIdes\` but yields \`universal\` when no IDE markers exist. */
export function detectIdesWithFallback(workspaceRoot: string): DetectedIde[] {
  const found = detectIdes(workspaceRoot)
  return found.length > 0 ? found : ['universal']
}

export type InjectionResult = { ide: DetectedIde; paths: string[] }

/** Write IDE workflow files (rules markdown). Does not register MCP servers. */
export function injectForIdes(workspaceRoot: string): InjectionResult[] {
  const ides = detectIdesWithFallback(workspaceRoot)
  const results: InjectionResult[] = []

  for (const ide of ides) {
    if (ide === 'cursor') {
      const paths = injectCursor(workspaceRoot)
      results.push({ ide, paths })
    } else if (ide === 'universal') {
      const paths = injectUniversal(workspaceRoot)
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

function injectCursor(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const rulesDir = join(root, '.cursor', 'rules')
  ensureDir(rulesDir)
  const out: string[] = []
  const w = (rel: string, body: string) => {
    const abs = join(root, rel)
    writeFileSync(abs, body, 'utf8')
    out.push(rel)
  }
  w(join('.cursor', 'rules', 'reopenspec.md'), REOPENSPEC_RULES)
  w(join('.cursor', 'rules', 'reo-start-feature.md'), WORKFLOW_START)
  w(join('.cursor', 'rules', 'reo-sync-spec.md'), WORKFLOW_SYNC)
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
