import { Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import { injectForIdes } from '../lib/injector.js'
import { detectStackProfile, isDartOrFlutterStack } from '../lib/detect-profile.js'
import { offerFlutterSkillsGuidance } from '../lib/flutter-skill-prompt.js'
import { copyRulesToProject, ideRulesDir, readIdePreferences } from '../lib/rules-copy.js'
import type { BackendStack, FrontendStack } from '../lib/detect-profile.js'

export default class Inject extends Command {
  static override id = 'inject'
  static override description =
    'Write IDE workflow files (Cursor rules, .ai-context) and categorized .mdc rules for detected editors.'
  static override examples = [
    '<%= config.bin %> inject',
    '<%= config.bin %> inject --frontend react --backend node'
  ]

  static override flags = {
    cwd: Flags.string({ char: 'c', default: '.', description: 'Workspace root' }),
    backend: Flags.string({ description: 'Backend stack override', options: ['dotnet', 'node', 'php', 'python'] }),
    frontend: Flags.string({ description: 'Frontend stack override', options: ['vue', 'react', 'flutter'] }),
    database: Flags.boolean({ description: 'Include database/SQL rules', default: false }),
    devops: Flags.boolean({ description: 'Include CI/CD and deployment rules', default: false }),
    figma: Flags.boolean({ description: 'Include Figma design rules', default: false }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Inject)
    const cwd = resolve(flags.cwd)
    
    // Base rule injection
    const ides = readIdePreferences(cwd)
    const injections = injectForIdes(cwd, ides as any)
    for (const inj of injections) {
      if (inj.paths.length > 0) {
        this.log(`Base IDE context injected (${inj.ide}): ${inj.paths.join(', ')}`)
      }
    }

    // Categorized rules injection (.mdc files)
    const detected = detectStackProfile(cwd)
    if (isDartOrFlutterStack(detected)) {
      await offerFlutterSkillsGuidance((m) => this.log(m))
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
        this.log(`\nCategorized rules injected to \`${rulesDir}\` (${ide}):`)
        this.log(`  Backend stack selected: ${result.effectiveBackend || 'none'}`)
        this.log(`  Frontend stack selected: ${result.effectiveFrontend || 'none'}`)
        this.log(`  Copied ${result.copied.length} files successfully.`)
      } else {
         this.log(`\nNo matching categorized rules found to inject for ${ide}.`)
      }
    }
  }
}
