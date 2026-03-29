import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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

/** Google Antigravity workspace skills live under \`.agent/skills/<name>/\`. */
const ANTIGRAVITY_SKILL_MD = OPENCODE_SKILL_MD

const REOPENSPEC_ALL_IN_ONE = `${REOPENSPEC_RULES}\n\n${WORKFLOW_START}\n\n${WORKFLOW_SYNC}\n`

const QWEN_SKILL_MD = OPENCODE_SKILL_MD

const AUGGIE_COMMAND_MD = `---
description: ReOpenSpec — baseline-only architecture; use arch-baseline.json, do not infer from source.
---

${REOPENSPEC_ALL_IN_ONE}`

const FACTORY_DROID_MD = `---
name: reopenspec
description: ReOpenSpec workflow — read baseline JSON only for architecture.
---

${REOPENSPEC_ALL_IN_ONE}`

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

function writeFileEnsuringDir(workspaceRoot: string, relFromRoot: string, body: string): string {
  const root = resolve(workspaceRoot)
  const abs = join(root, relFromRoot)
  ensureDir(dirname(abs))
  writeFileSync(abs, body, 'utf8')
  return relFromRoot.replace(/\\/g, '/')
}

function injectSkillDir(workspaceRoot: string, skillRel: string, body: string): string[] {
  const root = resolve(workspaceRoot)
  const skillDir = join(root, skillRel)
  ensureDir(skillDir)
  const fileRel = join(skillRel, 'SKILL.md').replace(/\\/g, '/')
  writeFileSync(join(skillDir, 'SKILL.md'), body, 'utf8')
  return [fileRel]
}

/** Cline: \`.clinerules\` may be a file or a directory. */
function injectCline(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const p = join(root, '.clinerules')
  if (existsSync(p)) {
    try {
      if (statSync(p).isFile()) {
        return [writeFileEnsuringDir(workspaceRoot, 'reopenspec-cline.md', REOPENSPEC_ALL_IN_ONE)]
      }
    } catch {
      /* use directory branch */
    }
  }
  return injectRulesMarkdown(workspaceRoot, '.clinerules')
}

function injectAmazonQ(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.amazonq', 'reopenspec.md'),
      REOPENSPEC_ALL_IN_ONE,
    ),
  ]
}

function injectAugmentCommand(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.augment', 'commands', 'reopenspec.md'),
      AUGGIE_COMMAND_MD,
    ),
  ]
}

function injectGeminiContext(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.gemini', 'reopenspec-instructions.md'),
      REOPENSPEC_ALL_IN_ONE,
    ),
  ]
}

function injectFactoryDroid(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.factory', 'droids', 'reopenspec.md'),
      FACTORY_DROID_MD,
    ),
  ]
}

/** Crush reads project markdown such as \`AGENTS.md\` / \`CRUSH.md\`; use a dedicated file to avoid clobbering. */
function injectCrush(workspaceRoot: string): string[] {
  return [writeFileEnsuringDir(workspaceRoot, 'reopenspec-crush.md', REOPENSPEC_ALL_IN_ONE)]
}

/** iFlow: prefer \`IFLOW.md\`; create or append ReOpenSpec section. */
function injectIflow(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const target = join(root, 'IFLOW.md')
  const header = '# ReOpenSpec\n\n'
  if (!existsSync(target)) {
    writeFileSync(target, `${header}${REOPENSPEC_ALL_IN_ONE}`, 'utf8')
    return ['IFLOW.md']
  }
  appendFileSync(
    target,
    `\n\n---\n\n## ReOpenSpec (injected by reo init / reo inject)\n\n${REOPENSPEC_ALL_IN_ONE}`,
    'utf8',
  )
  return ['IFLOW.md (appended ReOpenSpec section)']
}

function injectJetBrainsContext(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.idea', 'reopenspec-ai-context.md'),
      REOPENSPEC_ALL_IN_ONE,
    ),
  ]
}

function injectGitHubCopilot(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.github', 'copilot-instructions.md'),
      `${REOPENSPEC_ALL_IN_ONE}\n`,
    ),
  ]
}

/** Codex project config is usually TOML; add a sidecar markdown file for human/agent context. */
function injectCodexContext(workspaceRoot: string): string[] {
  return [
    writeFileEnsuringDir(
      workspaceRoot,
      join('.codex', 'reopenspec-context.md'),
      REOPENSPEC_ALL_IN_ONE,
    ),
  ]
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

const CATALOG_IDS = new Set<string>(IDE_CATALOG.map((c) => c.id))

function resolveInjectionIdes(
  workspaceRoot: string,
  ideTargets?: readonly string[] | undefined,
): DetectedIde[] {
  if (ideTargets !== undefined && ideTargets.length > 0) {
    const out: DetectedIde[] = []
    for (const id of ideTargets) {
      if (CATALOG_IDS.has(id) && !out.includes(id as DetectedIde)) {
        out.push(id as DetectedIde)
      }
    }
    if (out.length > 0) return out
  }
  return detectIdesWithFallback(workspaceRoot)
}

export type InjectForIdesOptions = {
  /** When set (non-empty), inject only for these IDs (from \`reopenspec.local.json\`). Otherwise use workspace folder detection. */
  ideTargets?: readonly string[] | undefined
}

/** Write IDE workflow files (rules markdown). Does not register MCP servers. */
export function injectForIdes(workspaceRoot: string, options?: InjectForIdesOptions): InjectionResult[] {
  const ides = resolveInjectionIdes(workspaceRoot, options?.ideTargets)
  const results: InjectionResult[] = []

  for (const ide of ides) {
    if (ide === 'cursor') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.cursor', 'rules')) })
    } else if (ide === 'claude-code') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.claude', 'rules')) })
    } else if (ide === 'windsurf') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.windsurf', 'rules')) })
    } else if (ide === 'roo' || ide === 'costrict') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.roo', 'rules')) })
    } else if (ide === 'cline') {
      results.push({ ide, paths: injectCline(workspaceRoot) })
    } else if (ide === 'kilo-code') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.kilocode', 'rules')) })
    } else if (ide === 'qoder') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.qoder', 'rules')) })
    } else if (ide === 'codebuddy') {
      results.push({ ide, paths: injectRulesMarkdown(workspaceRoot, join('.codebuddy', 'rules')) })
    } else if (ide === 'amazon-q') {
      results.push({ ide, paths: injectAmazonQ(workspaceRoot) })
    } else if (ide === 'auggie-cli') {
      results.push({ ide, paths: injectAugmentCommand(workspaceRoot) })
    } else if (ide === 'qwen-code') {
      results.push({
        ide,
        paths: injectSkillDir(workspaceRoot, join('.qwen', 'skills', 'reopenspec'), QWEN_SKILL_MD),
      })
    } else if (ide === 'gemini-cli') {
      results.push({ ide, paths: injectGeminiContext(workspaceRoot) })
    } else if (ide === 'opencode') {
      results.push({ ide, paths: injectOpenCodeSkill(workspaceRoot) })
    } else if (ide === 'antigravity') {
      results.push({ ide, paths: injectAntigravitySkill(workspaceRoot) })
    } else if (ide === 'factory-droid') {
      results.push({ ide, paths: injectFactoryDroid(workspaceRoot) })
    } else if (ide === 'crush') {
      results.push({ ide, paths: injectCrush(workspaceRoot) })
    } else if (ide === 'iflow') {
      results.push({ ide, paths: injectIflow(workspaceRoot) })
    } else if (ide === 'jetbrains-ai') {
      results.push({ ide, paths: injectJetBrainsContext(workspaceRoot) })
    } else if (ide === 'github-copilot') {
      results.push({ ide, paths: injectGitHubCopilot(workspaceRoot) })
    } else if (ide === 'codex') {
      results.push({ ide, paths: injectCodexContext(workspaceRoot) })
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

function injectAntigravitySkill(workspaceRoot: string): string[] {
  const root = resolve(workspaceRoot)
  const skillRel = join('.agent', 'skills', 'reopenspec')
  const skillDir = join(root, skillRel)
  ensureDir(skillDir)
  const fileRel = join(skillRel, 'SKILL.md').replace(/\\/g, '/')
  writeFileSync(join(skillDir, 'SKILL.md'), ANTIGRAVITY_SKILL_MD, 'utf8')
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
  w(join('.ai-context', 'AGENTS.md'), REOPENSPEC_ALL_IN_ONE)
  return paths
}
