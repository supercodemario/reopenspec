import { Command, Flags } from '@oclif/core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildBaseline } from '../lib/baseline.js'
import { loadResolvedConfig } from '../lib/reopenspec-config.js'

export default class Scan extends Command {
  static override id = 'scan'
  static override description =
    'Scan the workspace with ast-grep and write arch-baseline.json (Stage 1: TypeScript).'
  static override examples = ['<%= config.bin %> scan', '<%= config.bin %> scan --cwd ./app -o baseline.json']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root to scan',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output path (overrides reopenspec.json baselinePath)',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Scan)
    const cwd = resolve(flags.cwd)
    const { merged: cfg } = loadResolvedConfig(cwd)
    const out = resolve(cwd, flags.output ?? cfg.baselinePath)
    mkdirSync(dirname(out), { recursive: true })
    const baseline = await buildBaseline(cwd)
    writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    this.log(`Wrote ${out}`)
    if (baseline.parseErrors.length > 0) {
      this.warn(`${baseline.parseErrors.length} parse error(s); see "parseErrors" in output.`)
    }
  }
}
