import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** AI coding tools / IDEs selectable in `reo init` (skills & workflow targets). */
export type DetectedIde =
  | 'amazon-q'
  | 'antigravity'
  | 'auggie-cli'
  | 'claude-code'
  | 'cline'
  | 'codebuddy'
  | 'codex'
  | 'costrict'
  | 'crush'
  | 'cursor'
  | 'factory-droid'
  | 'gemini-cli'
  | 'github-copilot'
  | 'iflow'
  | 'jetbrains-ai'
  | 'kilo-code'
  | 'opencode'
  | 'qoder'
  | 'qwen-code'
  | 'roo'
  | 'universal'
  | 'windsurf'

/** All IDEs offered during interactive init (skills / workflow targets). */
export const IDE_CATALOG: readonly { id: DetectedIde; label: string }[] = [
  { id: 'claude-code', label: 'Claude Code (.claude/)' },
  { id: 'cursor', label: 'Cursor (.cursor/)' },
  { id: 'codex', label: 'OpenAI Codex (.codex/)' },
  { id: 'github-copilot', label: 'GitHub Copilot (VS Code, JetBrains, CLI — pick manually if unsure)' },
  { id: 'opencode', label: 'OpenCode (.opencode/ or opencode.json)' },
  { id: 'windsurf', label: 'Windsurf (.windsurf/)' },
  { id: 'gemini-cli', label: 'Gemini CLI (.gemini/)' },
  { id: 'antigravity', label: 'Google Antigravity (.agent/skills/)' },
  { id: 'cline', label: 'Cline (.clinerules/)' },
  { id: 'roo', label: 'Roo Code (.roo/)' },
  { id: 'kilo-code', label: 'Kilo Code (.kilocode/rules/)' },
  { id: 'amazon-q', label: 'Amazon Q Developer (.amazonq/)' },
  { id: 'qoder', label: 'Qoder (.qoder/rules/)' },
  { id: 'auggie-cli', label: 'Auggie / Augment CLI (.augment/)' },
  { id: 'qwen-code', label: 'Qwen Code (.qwen/)' },
  { id: 'codebuddy', label: 'CodeBuddy (.codebuddy/)' },
  { id: 'costrict', label: 'CoStrict (uses .roo/rules — pick if you use CoStrict; overlaps Roo)' },
  { id: 'crush', label: 'Crush (crush.json in repo root)' },
  { id: 'factory-droid', label: 'Factory Droid (.factory/)' },
  { id: 'iflow', label: 'iFlow (IFLOW.md in repo root)' },
  { id: 'jetbrains-ai', label: 'JetBrains AI (.idea/ — IntelliJ, WebStorm, etc.)' },
  { id: 'universal', label: 'Universal / other (.ai-context fallback)' },
]

const REOPENSPEC_RULES = `# ReOpenSpec

Do not infer architecture from the codebase. Read \`/reopenspec/specs/.meta/arch-baseline.json\` (or the path in \`reopenspec.json\`) and use only what is declared there. If a module or interface you need is not in the baseline, flag it as an open question — do not assume it.
`

const WORKFLOW_START = `# ReOpenSpec: Start Feature

Load architectural context from the baseline JSON only (see \`reopenspec.json\` paths). Traceable workflow: \`reo init\` → \`/reo-blueprint\` → \`/reo-plan\` → \`reopenspec/changes/active/<id>/\` → \`/reo-proceed-plan\`. See \`commands/README.md\` in the ReOpenSpec package/repo.
`

const WORKFLOW_SYNC = `# ReOpenSpec: Sync Spec

Read the baseline and drift report, compare to the chosen feature spec, and reconcile spec vs code with the developer.
`

const OPENCODE_SKILL_MD = `---
name: reopenspec
description: ReOpenSpec — use arch-baseline.json only; do not infer architecture from source.
---

${REOPENSPEC_RULES}

${WORKFLOW_START}

${WORKFLOW_SYNC}
`

function injectRulesMarkdown(workspaceRoot: string, rulesDirFromRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const rulesDir = join(root, rulesDirFromRoot)
  ensureDir(rulesDir)
  const out: string[] = []
  const w = (name: string, body: string) => {
    const rel = join(rulesDirFromRoot, name).replace(/\\/g, '/')
    writeFileSync(join(root, rulesDirFromRoot, name), body, 'utf8')
    out.push(rel)
  }
  w('reopenspec.md', REOPENSPEC_RULES)
  w('reo-start-feature.md', WORKFLOW_START)
  w('reo-sync-spec.md', WORKFLOW_SYNC)
  return out
}

export function detectIdes(workspaceRoot: string): DetectedIde[] {
  const root = resolve(workspaceRoot)
  const found: DetectedIde[] = []
  const push = (id: DetectedIde) => {
    if (!found.includes(id)) found.push(id)
  }

  if (existsSync(join(root, '.claude'))) push('claude-code')
  if (existsSync(join(root, '.cursor'))) push('cursor')
  if (existsSync(join(root, '.codex'))) push('codex')
  if (existsSync(join(root, '.windsurf'))) push('windsurf')
  if (existsSync(join(root, '.opencode')) || existsSync(join(root, 'opencode.json'))) push('opencode')
  if (existsSync(join(root, '.gemini'))) push('gemini-cli')
  if (existsSync(join(root, '.agent', 'skills'))) push('antigravity')
  if (existsSync(join(root, '.clinerules'))) push('cline')
  if (existsSync(join(root, '.roo'))) push('roo')
  if (existsSync(join(root, '.kilocode'))) push('kilo-code')
  if (existsSync(join(root, '.amazonq'))) push('amazon-q')
  if (existsSync(join(root, '.qoder'))) push('qoder')
  if (existsSync(join(root, '.augment'))) push('auggie-cli')
  if (existsSync(join(root, '.qwen'))) push('qwen-code')
  if (existsSync(join(root, '.codebuddy'))) push('codebuddy')
  if (existsSync(join(root, 'crush.json'))) push('crush')
  if (existsSync(join(root, '.factory'))) push('factory-droid')
  if (existsSync(join(root, 'IFLOW.md'))) push('iflow')
  if (existsSync(join(root, '.idea'))) push('jetbrains-ai')

  return found
}

/**
 * Best-effort guess for which AI IDE launched this terminal (env markers).
 * Used to pre-check that row in `reo init` alongside workspace folder scan.
 */
export function detectCurrentTerminalIde(): DetectedIde | null {
  const e = process.env
  const term = (e.TERM_PROGRAM ?? '').toLowerCase()

  if (e.CURSOR_TRACE_ID || e.CURSOR_AGENT || e.CURSOR_CLI) {
    return 'cursor'
  }
  const bundle = (e.__CFBundleIdentifier ?? '').toLowerCase()
  if (bundle.includes('cursor') && !bundle.includes('vscode')) {
    return 'cursor'
  }

  if (e.WINDSURF_IDE || term.includes('windsurf')) {
    return 'windsurf'
  }

  if (term.includes('roo') || e.ROO_CODE) {
    return 'roo'
  }

  if (term.includes('cline')) {
    return 'cline'
  }

  // JetBrains IDEs (embedded terminal: JetBrains-JediTerm, etc.)
  const termEmu = (e.TERMINAL_EMULATOR ?? '').toLowerCase()
  if (termEmu.includes('jetbrains') || termEmu.includes('jediterm')) {
    return 'jetbrains-ai'
  }
  if (
    /jetbrains|intellij|webstorm|phpstorm|rubymine|pycharm|goland|clion|rider|gateway/i.test(bundle)
  ) {
    return 'jetbrains-ai'
  }

  if (e.GITHUB_COPILOT_CLI) {
    return 'github-copilot'
  }

  // Vanilla VS Code integrated terminal (not Cursor)
  if (e.TERM_PROGRAM === 'vscode') {
    return 'universal'
  }

  return null
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
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.cursor', 'rules')) })
    } else if (ide === 'claude-code') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.claude', 'rules')) })
    } else if (ide === 'kilo-code') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.kilocode', 'rules')) })
    } else if (ide === 'qoder') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.qoder', 'rules')) })
    } else if (ide === 'codebuddy') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.codebuddy', 'rules')) })
    } else if (ide === 'opencode') {
      results.push({ ide, paths: injectOpenCodeSkill(workspaceRoot) })
    } else if (ide === 'universal') {
      results.push({ ide, paths: injectUniversal(workspaceRoot) })
    } else {
      results.push({ ide, paths: [] })
    }
  }
  return results
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true })
}

function injectOpenCodeSkill(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const skillRel = join('.opencode', 'skills', 'reopenspec')
  const skillDir = join(root, skillRel)
  ensureDir(skillDir)
  const fileRel = join(skillRel, 'SKILL.md').replace(/\\/g, '/')
  writeFileSync(join(skillDir, 'SKILL.md'), OPENCODE_SKILL_MD, 'utf8')
  return [fileRel]
}

function injectUniversal(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const dir = join(root, '.ai-context')
  ensureDir(dir)
  const paths: string[] = []
  const w = (rel: string, body: string) => {
    writeFileSync(join(root, rel), body, 'utf8')
    paths.push(rel.replace(/\\/g, '/'))
  }
  w(join('.ai-context', 'AGENTS.md'), REOPENSPEC_RULES)
  return paths
}
