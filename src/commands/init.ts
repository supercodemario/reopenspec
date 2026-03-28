import { Command, Flags } from '@oclif/core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildBaseline } from '../lib/baseline.js'
import { injectForIdes } from '../lib/injector.js'
import {
  loadResolvedConfig,
  writeDefaultConfigFile,
} from '../lib/reopenspec-config.js'

export default class Init extends Command {
  static override id = 'init'
  static override description =
    'Create specs/.meta, scan TypeScript, write arch-baseline.json, reopenspec.json, and inject IDE workflows.'
  static override examples = ['<%= config.bin %> init', '<%= config.bin %> init -c . --force']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: process.cwd(),
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
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init)
    const cwd = resolve(flags.cwd)

    mkdirSync(join(cwd, 'specs', '.meta'), { recursive: true })
    mkdirSync(join(cwd, 'specs'), { recursive: true })

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
      const injections = injectForIdes(cwd)
      for (const inj of injections) {
        if (inj.paths.length > 0) {
          this.log(`Injected (${inj.ide}): ${inj.paths.join(', ')}`)
        } else {
          this.log(`IDE marker: ${inj.ide} (no files written for this target yet)`)
        }
      }
    }

    this.log(
      `Summary: ${baseline.modules.length} module(s), ${baseline.nodes.length} export node(s), languages: ${baseline.meta.languages.join(', ') || '(none)'}`,
    )
  }
}
