import { Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import { IDE_CATALOG, injectForIdes } from '../lib/injector.js'
import { loadLocalProfile } from '../lib/reopenspec-config.js'

export default class Inject extends Command {
  static override id = 'inject'
  static override description =
    'Write IDE workflow files for targets in reopenspec.local.json (ideSetup.targets), or else for editors detected from workspace folders.'
  static override examples = [
    '<%= config.bin %> inject',
    '<%= config.bin %> inject --all',
  ]

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
    all: Flags.boolean({
      description:
        'Write ReOpenSpec files for every supported agent/IDE in the catalog (ignores local profile detection)',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Inject)
    const cwd = resolve(flags.cwd)
    const lp = loadLocalProfile(cwd)
    const injectOpts = flags.all
      ? { ideTargets: IDE_CATALOG.map((c) => c.id) }
      : lp.ideSetup?.targets !== undefined && lp.ideSetup.targets.length > 0
        ? { ideTargets: lp.ideSetup.targets }
        : undefined
    const injections = injectForIdes(cwd, injectOpts)
    for (const inj of injections) {
      if (inj.paths.length > 0) {
        this.log(`${inj.ide}: ${inj.paths.join(', ')}`)
      } else {
        this.log(`${inj.ide}: (no files written)`)
      }
    }
  }
}
