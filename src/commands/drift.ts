import { Command, Flags } from '@oclif/core'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildBaseline, readBaselineFromFile } from '../lib/baseline.js'
import { runDriftDetection } from '../lib/drift.js'
import { loadResolvedConfig } from '../lib/reopenspec-config.js'

export default class Drift extends Command {
  static override id = 'drift'
  static override description =
    'Compare arch-baseline.json against reopenspec/specs/*/api-contracts.json and emit drift-report.json.'
  static override examples = [
    '<%= config.bin %> drift',
    '<%= config.bin %> drift --strictUncovered',
    '<%= config.bin %> drift --baseline ./arch-baseline.json --skip-scan',
  ]

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
    baseline: Flags.string({
      description: 'Path to arch-baseline.json (overrides reopenspec.json)',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Drift report output path (overrides reopenspec.json)',
    }),
    skipScan: Flags.boolean({
      default: false,
      description: 'Do not rescan; require existing baseline file',
    }),
    strictUncovered: Flags.boolean({
      description: 'Warn on exports not referenced by any contract',
      allowNo: true,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Drift)
    const cwd = resolve(flags.cwd)
    const { merged: cfg } = loadResolvedConfig(cwd)
    const baselinePath = resolve(cwd, flags.baseline ?? cfg.baselinePath)
    const outPath = resolve(cwd, flags.output ?? cfg.driftReportPath)
    mkdirSync(dirname(outPath), { recursive: true })
    const strictUncovered =
      flags.strictUncovered !== undefined ? flags.strictUncovered : cfg.strictUncovered

    let baseline
    if (flags.skipScan) {
      if (!existsSync(baselinePath)) {
        this.error(`Baseline not found: ${baselinePath} (run ${this.config.bin} sync without --skip-scan)`)
      }
      baseline = readBaselineFromFile(baselinePath)
    } else {
      mkdirSync(dirname(baselinePath), { recursive: true })
      baseline = await buildBaseline(cwd)
      writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
      this.log(`Wrote ${baselinePath}`)
    }

    const report = await runDriftDetection({
      workspaceRoot: cwd,
      baseline,
      strictUncovered,
      specsDir: cfg.specsDir,
    })
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    this.log(`Wrote ${outPath}`)
    this.log(
      `Drift summary: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s).`,
    )

    if (report.summary.errors > 0) {
      this.exit(1)
    }
  }
}
