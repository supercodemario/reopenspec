import { Args, Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import {
  configFilePath,
  loadResolvedConfig,
  writeDefaultConfigFile,
} from '../lib/reopenspec-config.js'

export default class Config extends Command {
  static override id = 'config'
  static override description =
    'Inspect or create reopenspec.json (baseline paths, specs dir, drift options).'
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
      default: process.cwd(),
      description: 'Workspace root',
    }),
    force: Flags.boolean({
      default: false,
      description: 'Overwrite existing reopenspec.json (init only)',
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
        const p = writeDefaultConfigFile(cwd, flags.force)
        this.log(`Wrote ${p}`)
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
