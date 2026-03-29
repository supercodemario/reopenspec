import { Command, Flags } from '@oclif/core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { join, relative, resolve } from 'node:path'
import type { ArchBaseline } from '../lib/baseline.js'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildBaseline } from '../lib/baseline.js'
import { IDE_CATALOG, injectForIdes } from '../lib/injector.js'
import { printWelcomeBanner, promptRoleInteractive, runInteractiveIdeSetup } from '../lib/init-tui.js'
import {
  ensureLocalConfigInGitignore,
  isLocalUserRole,
  loadLocalProfile,
  loadResolvedConfig,
  type LocalIdeSetup,
  type LocalUserRole,
  type ResolvedReopenSpecConfig,
  writeDefaultConfigFile,
  writeLocalProfile,
} from '../lib/reopenspec-config.js'
import { runMcpInteractiveSetup } from '../lib/mcp-interactive-setup.js'
import {
  copyProjectYamlTemplate,
  copyReopenSpecModelDocIfMissing,
  copyWorkflowCommandsToProject,
} from '../lib/workflow-copy.js'
import { resolveHeroEmoji } from '../lib/reopenspec-local-profile.js'

function isInteractive(): boolean {
  return (
    Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
    process.env.CI !== 'true' &&
    process.env.CI !== '1'
  )
}

function logPathShort(cwd: string, absPath: string): string {
  const r = relative(cwd, absPath)
  return r && !r.startsWith('..') ? r : absPath
}

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33;1m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
}

/**
 * Empty input with no saved name → no hero (skip local profile).
 * Empty input with saved name → keep that name; skip role/IDE TUI if IDE targets were already saved.
 * Non-empty → new hero name (re-run role/IDE flow when flags allow).
 */
async function promptOptionalHeroName(
  existingHeroName: string,
  hasSavedIdeTargets: boolean,
): Promise<{ heroName: string | undefined; skipInteractiveProfile: boolean }> {
  if (!isInteractive()) return { heroName: undefined, skipInteractiveProfile: false }

  const { dim: d, bold: b, cyan: c, yellow: y, reset: r } = ansi
  const line1 = `${c}${b}Hero name${r} ${d}(gitignored ${b}reopenspec.local.json${r}${d}, not committed)${r}`
  let line2: string
  if (existingHeroName !== '') {
    const keepLine = hasSavedIdeTargets
      ? `${d}Press ${b}Enter${r}${d} to keep ${y}"${existingHeroName}"${r}${d} and skip role / IDE setup (already saved).${r}`
      : `${d}Press ${b}Enter${r}${d} to keep ${y}"${existingHeroName}"${r}${d}; then choose role & IDEs.${r}`
    line2 = `${keepLine}\n${d}Or type a new name to replace it.${r}`
  } else {
    line2 = `${d}Press Enter to skip (no local hero). Type a name to create a profile.${r}`
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const raw = await rl.question(`${line1}\n${line2}\n`)
    const t = raw.trim()
    if (t === '') {
      if (existingHeroName !== '') {
        return {
          heroName: existingHeroName,
          skipInteractiveProfile: hasSavedIdeTargets,
        }
      }
      return { heroName: undefined, skipInteractiveProfile: false }
    }
    return { heroName: t, skipInteractiveProfile: false }
  } finally {
    rl.close()
  }
}

function printInteractiveInitSummary(
  cwd: string,
  filePath: string,
  fileExists: boolean,
  merged: ResolvedReopenSpecConfig,
  baseline: ArchBaseline,
  ideTargetIds: string[] | undefined,
): void {
  const { dim: d, bold: b, cyan: c, yellow: y, green: g, reset: r } = ansi
  const ideLabels =
    ideTargetIds !== undefined && ideTargetIds.length > 0
      ? ideTargetIds.map((id) => IDE_CATALOG.find((x) => x.id === id)?.label ?? id).join(`${d}, ${r}`)
      : `${d}(none)${r}`
  const langs =
    baseline.meta.languages.length > 0
      ? baseline.meta.languages.join(', ')
      : baseline.languageProfile.primary === 'unknown'
        ? '(none inferred)'
        : baseline.languageProfile.primary
  const manifests = baseline.languageProfile.manifests.join(', ') || '(none)'
  const modPreview = baseline.modules
    .slice(0, 10)
    .map((m) => m.id)
    .join(', ')
  const modMore =
    baseline.modules.length > 10 ? ` ${d}(+${baseline.modules.length - 10} more)${r}` : ''

  const lines = [
    '',
    `${c}${b}── Saved workspace snapshot ──${r}`,
    `  ${b}Role${r}           ${g}${merged.role}${r}  ${d}·${r}  ${b}Hero${r}  ${y}${merged.heroName || '(none)'}${r} ${merged.heroEmoji}`,
    `  ${b}Config${r}         ${d}${logPathShort(cwd, filePath)}${r}${fileExists ? '' : ` ${d}(defaults)${r}`}`,
    `  ${b}Baseline${r}       ${d}${logPathShort(cwd, resolve(cwd, merged.baselinePath))}${r}`,
    `  ${b}Specs dir${r}       ${d}${merged.specsDir}${r}`,
    `  ${b}Strict uncovered${r} ${merged.strictUncovered ? `${g}yes${r}` : `${d}no${r}`}`,
    `  ${b}Languages${r}      ${langs}`,
    `  ${b}Manifests${r}      ${d}${manifests}${r}`,
    `  ${b}IDE targets${r}     ${ideLabels}`,
    `  ${b}Architecture${r}   ${baseline.modules.length} module(s), ${baseline.nodes.length} export node(s), ${baseline.dependency_graph.nodes.length} graph node(s)`,
    `  ${d}Modules:${r} ${modPreview || '(none)'}${modMore}`,
    '',
  ]
  process.stdout.write(lines.join('\n'))
}

export default class Init extends Command {
  static override id = 'init'
  static override description =
    'Create reopenspec/docs/, reopenspec/specs/.meta, reopenspec/changes/active/ and reopenspec/changes/completed/, scan TypeScript, write arch-baseline.json, reopenspec.json, inject IDE workflows, copy Cursor slash-command templates to .cursor/commands/, optionally configure MCP in ~/.cursor/mcp.json, and add reopenspec.project.yaml if missing (use --skip-workflow / --skip-mcp-setup to opt out).'
  static override examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init -c . --force',
    '<%= config.bin %> init --skip-workflow',
    '<%= config.bin %> init --skip-mcp-setup',
  ]
    'Create specs/.meta, scan TypeScript, write arch-baseline.json, reopenspec.json, and inject IDE workflows. Interactive TTY: hero name (Enter keeps saved name; with saved IDE targets, skips role/IDE setup), role picker, IDE scan + multi-select (reopenspec.local.json), then a workspace snapshot (config, languages, architecture).'
  static override examples = ['<%= config.bin %> init', '<%= config.bin %> init -c . --force']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
    force: Flags.boolean({
      description: 'Overwrite existing reopenspec.json',
      default: false,
    }),
    skipInject: Flags.boolean({
      description: 'Do not write Cursor / .ai-context workflow files',
      default: false,
    }),
    skipWorkflow: Flags.boolean({
      description:
        'Do not copy slash-command templates to .cursor/commands/ or add reopenspec.project.yaml',
      default: false,
    }),
    skipMcpSetup: Flags.boolean({
      description:
        'Do not prompt to merge MCP server entries into ~/.cursor/mcp.json (Cursor user config)',
      default: false,
    }),
    heroName: Flags.string({
      description: 'Hero name (gitignored); skips interactive name/role prompts when set',
    }),
    role: Flags.string({
      description: 'Local role: developer or manager; skips interactive role prompt when set',
      options: ['developer', 'manager'],
    }),
    // Defaults must match `DEFAULT_ROLE_EMOJI` in `src/lib/reopenspec-local-profile.ts`.
    emoji: Flags.string({
      description: 'Hero emoji override (defaults: developer 🥷, manager 🔀)',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init)
    const cwd = resolve(flags.cwd)

    mkdirSync(join(cwd, 'specs', '.meta'), { recursive: true })
    mkdirSync(join(cwd, 'specs'), { recursive: true })
    ensureLocalConfigInGitignore(cwd)
    const rs = join(cwd, 'reopenspec')
    mkdirSync(join(rs, 'docs'), { recursive: true })
    mkdirSync(join(rs, 'changes', 'active'), { recursive: true })
    mkdirSync(join(rs, 'changes', 'completed'), { recursive: true })
    mkdirSync(join(rs, 'specs', '.meta'), { recursive: true })
    mkdirSync(join(rs, 'specs'), { recursive: true })

    const gitignorePath = join(cwd, '.gitignore')
    if (existsSync(gitignorePath)) {
      const gitignoreContent = readFileSync(gitignorePath, 'utf8')
      if (!gitignoreContent.includes('.reopenspec.user.yaml')) {
        appendFileSync(gitignorePath, '\n# ReOpenSpec local user profile\n.reopenspec.user.yaml\n')
        this.log('Added .reopenspec.user.yaml to .gitignore')
      }
    } else {
      writeFileSync(gitignorePath, '# ReOpenSpec local user profile\n.reopenspec.user.yaml\n')
      this.log('Created .gitignore and added .reopenspec.user.yaml')
    }

    const before = loadResolvedConfig(cwd)
    if (!before.fileExists || flags.force) {
      const p = writeDefaultConfigFile(cwd, flags.force)
      this.log(`Wrote ${logPathShort(cwd, p)}`)
    } else {
      this.log(`Using existing config: ${logPathShort(cwd, before.filePath)}`)
    }

    let skipInteractiveProfile = false
    let heroName: string | undefined = flags.heroName
    if (heroName === undefined) {
      const snap = loadLocalProfile(cwd)
      const hasSavedIdeTargets =
        Array.isArray(snap.ideSetup?.targets) && snap.ideSetup.targets.length > 0
      const prompted = await promptOptionalHeroName(snap.heroName.trim(), hasSavedIdeTargets)
      heroName = prompted.heroName
      skipInteractiveProfile = prompted.skipInteractiveProfile
    }

    let role: LocalUserRole =
      flags.role !== undefined && isLocalUserRole(flags.role)
        ? flags.role
        : loadLocalProfile(cwd).role

    const interactiveHeroAndRole =
      flags.heroName === undefined &&
      flags.role === undefined &&
      heroName !== undefined &&
      heroName.trim() !== '' &&
      isInteractive() &&
      !skipInteractiveProfile

    let ideSetup: LocalIdeSetup | undefined
    if (interactiveHeroAndRole && heroName !== undefined) {
      process.stdout.write('\n')
      role = await promptRoleInteractive(role)
      ideSetup = await runInteractiveIdeSetup({
        workspaceRoot: cwd,
        heroName: heroName.trim(),
        role,
        heroEmoji: resolveHeroEmoji(role, flags.emoji),
      })
    }

    if (heroName !== undefined) {
      writeLocalProfile(cwd, {
        heroName,
        role,
        emoji: flags.emoji,
        ideSetup,
      })
      if (!heroName.trim()) {
        this.log('Cleared local hero profile (empty name)')
      } else if (interactiveHeroAndRole) {
        const { merged } = loadResolvedConfig(cwd)
        printWelcomeBanner(heroName.trim(), merged.role, merged.heroEmoji, ideSetup?.targets)
      } else if (skipInteractiveProfile) {
        const { merged } = loadResolvedConfig(cwd)
        const lp = loadLocalProfile(cwd)
        printWelcomeBanner(heroName.trim(), merged.role, merged.heroEmoji, lp.ideSetup?.targets)
      }
    }

    const { merged: cfg } = loadResolvedConfig(cwd)
    const baselinePath = resolve(cwd, cfg.baselinePath)

    const baseline = await buildBaseline(cwd)
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    this.log(`Wrote ${logPathShort(cwd, baselinePath)}`)

    if (baseline.parseErrors.length > 0) {
      this.warn(`${baseline.parseErrors.length} baseline parse error(s); see "parseErrors" in baseline file.`)
    }

    if (!flags.skipInject) {
      const injections = injectForIdes(cwd)
      for (const inj of injections) {
        if (inj.paths.length > 0) {
          this.log(`Injected (${inj.ide}): ${inj.paths.join(', ')}`)
        } else {
          this.log(`IDE marker: ${inj.ide} (no files written for this target yet)`)
        }
      }
    }

    if (!isInteractive()) {
      this.log(
        `Summary: ${baseline.modules.length} module(s), ${baseline.nodes.length} export node(s), languages: ${baseline.meta.languages.join(', ') || '(none)'}`,
      )
    }

    if (isInteractive()) {
      const resolved = loadResolvedConfig(cwd)
      const lp = loadLocalProfile(cwd)
      printInteractiveInitSummary(
        cwd,
        resolved.filePath,
        resolved.fileExists,
        resolved.merged,
        baseline,
        lp.ideSetup?.targets,
      )
    }

    if (
      isInteractive() &&
      heroName !== undefined &&
      heroName.trim() !== '' &&
      flags.heroName === undefined &&
      (interactiveHeroAndRole || skipInteractiveProfile)
    ) {
      process.stdout.write(`${ansi.dim}All set — ready for your next command.${ansi.reset}\n`)
    }
    try {
      const modelDoc = copyReopenSpecModelDocIfMissing(cwd)
      if (modelDoc) {
        this.log(`Wrote ${modelDoc} (template)`)
      }
    } catch (e) {
      this.warn(e instanceof Error ? e.message : String(e))
    }

    if (!flags.skipWorkflow) {
      try {
        const copied = copyWorkflowCommandsToProject(cwd)
        for (const p of copied) {
          this.log(`Workflow command: ${p}`)
        }
        const yaml = copyProjectYamlTemplate(cwd)
        if (yaml) {
          this.log(`Wrote ${yaml} (template)`)
        } else {
          this.log('reopenspec.project.yaml already exists; left unchanged')
        }
      } catch (e) {
        this.warn(
          e instanceof Error ? e.message : String(e),
        )
      }
    }

    await runMcpInteractiveSetup({
      workspaceRoot: cwd,
      skip: flags.skipMcpSetup,
      ide: 'cursor',
      log: (m) => this.log(m),
      warn: (m) => this.warn(m),
    })

    this.log(
      `Summary: ${baseline.modules.length} module(s), ${baseline.nodes.length} export node(s), languages: ${baseline.meta.languages.join(', ') || '(none)'}`,
    )
  }
}
