import { Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import { injectForIdes } from '../lib/injector.js'

export default class Inject extends Command {
  static override id = 'inject'
  static override description =
    'Write IDE workflow files (Cursor rules, .ai-context) for detected editors.'
  static override examples = ['<%= config.bin %> inject']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: process.cwd(),
      description: 'Workspace root',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Inject)
    const cwd = resolve(flags.cwd)
    const injections = injectForIdes(cwd)
    for (const inj of injections) {
      if (inj.paths.length > 0) {
        this.log(`${inj.ide}: ${inj.paths.join(', ')}`)
      } else {
        this.log(`${inj.ide}: (no files written)`)
      }
    }
  }
}
