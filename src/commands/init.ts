import { Command, Flags } from '@oclif/core'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildBaseline } from '../lib/baseline.js'
import { injectForIdes } from '../lib/injector.js'
import {
  loadResolvedConfig,
  writeDefaultConfigFile,
} from '../lib/reopenspec-config.js'
import { runMcpInteractiveSetup } from '../lib/mcp-interactive-setup.js'
import {
  copyProjectYamlTemplate,
  copyReopenSpecModelDocIfMissing,
  copyWorkflowCommandsToProject,
} from '../lib/workflow-copy.js'
import { detectStackProfile, isDartOrFlutterStack } from '../lib/detect-profile.js'
import { offerFlutterSkillsGuidance } from '../lib/flutter-skill-prompt.js'
import { copyRulesToProject, ideRulesDir, readIdePreferences } from '../lib/rules-copy.js'
import type { BackendStack, FrontendStack } from '../lib/detect-profile.js'
import { createInterface } from 'node:readline/promises'
import { DetectedIde } from '../lib/injector.js'

const IDE_CHOICES: { id: DetectedIde; label: string }[] = [
  { id: 'cursor', label: 'Cursor (.cursor/rules)' },
  { id: 'windsurf', label: 'Windsurf (.windsurfrules)' },
  { id: 'roo', label: 'Roo (.roo)' },
  { id: 'cline', label: 'Cline (.cline)' },
  { id: 'antigravity', label: 'Antigravity (.agents/rules)' },
]

async function promptForIdes(cwd: string): Promise<DetectedIde[]> {
  const current = readIdePreferences(cwd) as DetectedIde[]
  if (!process.stdin.isTTY) return current

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log('\nWhich IDEs do you want to route ReOpenSpec rules into?')
    for (let i = 0; i < IDE_CHOICES.length; i++) {
       console.log(`  ${i + 1}) ${IDE_CHOICES[i]!.label}`)
    }
    const currentList = current.join(', ')
    const answer = await rl.question(`Enter comma-separated numbers (e.g. 1,5) [Auto-detected: ${currentList}]: `)
    
    if (!answer.trim()) return current
    
    const selected = answer.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= IDE_CHOICES.length)
      
    if (selected.length === 0) return current
    return selected.map(n => IDE_CHOICES[n - 1]!.id)
  } catch {
    return current
  } finally {
    rl.close()
  }
}

export default class Init extends Command {
  static override id = 'init'
  static override description =
    'Create reopenspec/docs/, reopenspec/specs/.meta, reopenspec/changes/active/ and reopenspec/changes/completed/, scan TypeScript, write arch-baseline.json, reopenspec.json, inject IDE workflows, copy Cursor slash-command templates to .cursor/commands/, copy categorized rules (generic always + specific per stack), optionally configure MCP in ~/.cursor/mcp.json, and add reopenspec.project.yaml if missing (use --skip-workflow / --skip-mcp-setup / --skip-rules to opt out).'
  static override examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init -c . --force',
    '<%= config.bin %> init --skip-workflow',
    '<%= config.bin %> init --skip-mcp-setup',
    '<%= config.bin %> init --backend dotnet --frontend vue',
    '<%= config.bin %> init --backend node --no-auto-detect',
    '<%= config.bin %> init --skip-rules',
  ]

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
    skipRules: Flags.boolean({
      description: 'Do not copy any rule files to the IDE rules directory',
      default: false,
    }),
    backend: Flags.string({
      description: 'Backend stack for specific rules (e.g. dotnet, node, php, php/symfony, python). Overrides auto-detection.',
      options: ['dotnet', 'node', 'php', 'php/symfony', 'python'],
    }),
    frontend: Flags.string({
      description: 'Frontend stack for specific rules (e.g. vue, react, flutter). Overrides auto-detection.',
      options: ['vue', 'react', 'flutter'],
    }),
    database: Flags.boolean({
      description: 'Include database/SQL rules',
      default: false,
    }),
    devops: Flags.boolean({
      description: 'Include CI/CD and deployment rules',
      default: false,
    }),
    figma: Flags.boolean({
      description: 'Include Figma design-to-code rules (requires --frontend)',
      default: false,
    }),
    autoDetect: Flags.boolean({
      description: 'Auto-detect stacks from manifests and copy matching rules (default: true)',
      default: true,
      allowNo: true,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init)
    const cwd = resolve(flags.cwd)

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

    const ides = await promptForIdes(cwd)
    const userYamlPath = join(cwd, '.reopenspec.user.yaml')
    let yamlContent = ''
    if (existsSync(userYamlPath)) {
      yamlContent = readFileSync(userYamlPath, 'utf8')
      yamlContent = yamlContent.replace(/^ide:.*(?:(?:\r\n|\n).*)*$/gm, '') // Naive strip of old ide: section
    }
    yamlContent = yamlContent.trim() + `\nide: [${ides.join(', ')}]\n`
    writeFileSync(userYamlPath, yamlContent.trim() + '\n')
    this.log(`Set active IDE config: ${ides.join(', ')}`)

    const before = loadResolvedConfig(cwd)
    if (!before.fileExists || flags.force) {
      const p = writeDefaultConfigFile(cwd, flags.force)
      this.log(`Wrote ${p}`)
    } else {
      this.log(`Using existing config: ${before.filePath}`)
    }

    const { merged: cfg } = loadResolvedConfig(cwd)
    const baselinePath = resolve(cwd, cfg.baselinePath)

    const baseline = await buildBaseline(cwd)
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    this.log(`Wrote ${baselinePath}`)

    if (baseline.parseErrors.length > 0) {
      this.warn(`${baseline.parseErrors.length} baseline parse error(s); see "parseErrors" in baseline file.`)
    }

    if (!flags.skipInject) {
      const injections = injectForIdes(cwd, ides)
      for (const inj of injections) {
        if (inj.paths.length > 0) {
          this.log(`Injected (${inj.ide}): ${inj.paths.join(', ')}`)
        } else {
          this.log(`IDE marker: ${inj.ide} (no files written for this target yet)`)
        }
      }
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

    // --- Categorized rules copy ---
    if (!flags.skipRules) {
      try {
        const detected = flags.autoDetect
          ? detectStackProfile(cwd)
          : {
              language: { primary: 'unknown' as const, manifests: [] },
              backend: null,
              frontend: null,
              hasDatabase: false,
              hasDevops: false,
              hasFigma: false,
            }

        for (const ide of ides) {
          const rulesDir = ideRulesDir(ide)

          const result = copyRulesToProject({
            workspaceRoot: cwd,
            backend: (flags.backend as BackendStack) ?? null,
            frontend: (flags.frontend as FrontendStack) ?? null,
            database: flags.database,
            devops: flags.devops,
            figma: flags.figma,
            detected,
            ideRulesDir: rulesDir,
          })

          if (result.copied.length > 0) {
            this.log(`Rules copied to ${ide} (${rulesDir}):`)
            for (const r of result.copied) {
              this.log(`  ${r}`)
            }
            if (result.effectiveBackend) {
              this.log(`  Backend stack: ${result.effectiveBackend}`)
            }
            if (result.effectiveFrontend) {
              this.log(`  Frontend stack: ${result.effectiveFrontend}`)
            }
          }
          if (result.skipped.length > 0) {
            this.log(`Rules skipped for ${ide}:`)
            for (const s of result.skipped) {
              this.log(`  ${s.category}: ${s.reason}`)
            }
          }
        }
      } catch (e) {
        this.warn(`Rules copy: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (isDartOrFlutterStack(detectStackProfile(cwd))) {
      await offerFlutterSkillsGuidance((m) => this.log(m))
    }

    for (const ide of ides) {
      if (ide === 'cursor' || ide === 'antigravity') {
        await runMcpInteractiveSetup({
          workspaceRoot: cwd,
          skip: flags.skipMcpSetup,
          ide: ide as 'cursor' | 'antigravity',
          log: (m) => this.log(m),
          warn: (m) => this.warn(m),
        })
      }
    }

    this.log(
      `Summary: ${baseline.modules.length} module(s), ${baseline.nodes.length} export node(s), languages: ${baseline.meta.languages.join(', ') || '(none)'}`,
    )
  }
}
