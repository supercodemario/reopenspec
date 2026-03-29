import { Command, Flags } from '@oclif/core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildBaseline } from '../lib/baseline.js'
import { runDriftDetection } from '../lib/drift.js'
import { loadResolvedConfig } from '../lib/reopenspec-config.js'

/** Full workspace sync: baseline scan + drift vs `reopenspec/specs/{feature}/api-contracts.json`. */
export default class Sync extends Command {
  static override id = 'sync'
  static override description =
    'Write arch-baseline.json and drift-report.json (Stage 2: contracts vs baseline).'
  static override examples = ['<%= config.bin %> sync', '<%= config.bin %> sync -c . --strictUncovered']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
    baseline: Flags.string({
      char: 'b',
      description: 'Baseline output path (overrides reopenspec.json)',
    }),
    drift: Flags.string({
      char: 'd',
      description: 'Drift report output path (overrides reopenspec.json)',
    }),
    strictUncovered: Flags.boolean({
      description:
        'Warn on exports not referenced by any api-contracts.json (OR reopenspec.strictUncovered)',
      allowNo: true,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Sync)
    const cwd = resolve(flags.cwd)
    const { merged: cfg } = loadResolvedConfig(cwd)
    const baselinePath = resolve(cwd, flags.baseline ?? cfg.baselinePath)
    const driftPath = resolve(cwd, flags.drift ?? cfg.driftReportPath)
    mkdirSync(dirname(baselinePath), { recursive: true })
    mkdirSync(dirname(driftPath), { recursive: true })
    const strictUncovered =
      flags.strictUncovered !== undefined ? flags.strictUncovered : cfg.strictUncovered

    const baseline = await buildBaseline(cwd)
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    this.log(`Wrote ${baselinePath}`)

    if (baseline.parseErrors.length > 0) {
      this.warn(`${baseline.parseErrors.length} baseline parse error(s); see "parseErrors" in baseline file.`)
    }

    const report = await runDriftDetection({
      workspaceRoot: cwd,
      baseline,
      strictUncovered,
      specsDir: cfg.specsDir,
    })
    writeFileSync(driftPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    this.log(`Wrote ${driftPath}`)
    this.log(`Drift: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s).`)

    if (report.summary.errors > 0) {
      this.exit(1)
    }
  }
}
