import { Args, Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import {
  configFilePath,
  ensureLocalConfigInGitignore,
  isLocalUserRole,
  loadResolvedConfig,
  type LocalUserRole,
  writeDefaultConfigFile,
  writeLocalProfile,
} from '../lib/reopenspec-config.js'

export default class Config extends Command {
  static override id = 'config'
  static override description =
    'Inspect or create reopenspec.json. Hero name, role, and emoji live in gitignored reopenspec.local.json.'
  static override examples = [
    '<%= config.bin %> config',
    '<%= config.bin %> config path',
    '<%= config.bin %> config init',
  ]

  static override args = {
    action: Args.string({
      description: 'print (default) | path | init',
      required: false,
    }),
  }

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
    force: Flags.boolean({
      default: false,
      description: 'Overwrite existing reopenspec.json (init only)',
    }),
    heroName: Flags.string({
      description: 'Hero name → reopenspec.local.json (init only)',
    }),
    role: Flags.string({
      description: 'developer | manager (init only, with --hero-name)',
      options: ['developer', 'manager'],
    }),
    emoji: Flags.string({
      description: 'Emoji override (init only, with --hero-name)',
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Config)
    const cwd = resolve(flags.cwd)
    const action = (args.action ?? 'print').toLowerCase()
    if (!['print', 'path', 'init'].includes(action)) {
      this.error(`Unknown action "${args.action}". Use: print, path, or init.`)
    }

    if (action === 'path') {
      this.log(configFilePath(cwd))
      return
    }

    if (action === 'init') {
      try {
        ensureLocalConfigInGitignore(cwd)
        const p = writeDefaultConfigFile(cwd, flags.force)
        this.log(`Wrote ${p}`)
        if (flags.heroName !== undefined) {
          const role: LocalUserRole =
            flags.role !== undefined && isLocalUserRole(flags.role) ? flags.role : 'developer'
          const lp = writeLocalProfile(cwd, {
            heroName: flags.heroName,
            role,
            emoji: flags.emoji,
          })
          if (lp) this.log(`Wrote ${lp} (local only)`)
        }
      } catch (e) {
        this.error(e instanceof Error ? e.message : String(e))
      }
      return
    }

    const { filePath, fileExists, merged, raw } = loadResolvedConfig(cwd)
    this.log(`Config file: ${filePath}`)
    this.log(`Exists: ${fileExists}`)
    if (raw) {
      this.log('On-disk values (before defaults fill):')
      this.log(JSON.stringify(raw, null, 2))
    }
    this.log('Effective (merged) configuration:')
    this.log(JSON.stringify(merged, null, 2))
  }
}
