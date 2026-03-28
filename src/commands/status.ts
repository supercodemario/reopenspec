import { Command, Flags } from '@oclif/core'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadResolvedConfig } from '../lib/reopenspec-config.js'

export default class Status extends Command {
  static override id = 'status'
  static override description = 'Print baseline metadata, config paths, and drift summary.'
  static override examples = ['<%= config.bin %> status']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Status)
    const cwd = resolve(flags.cwd)
    const { filePath, fileExists, merged: cfg } = loadResolvedConfig(cwd)

    this.log(`Config: ${filePath} (exists: ${fileExists})`)
    this.log(`baselinePath: ${cfg.baselinePath}`)
    this.log(`driftReportPath: ${cfg.driftReportPath}`)
    this.log(`specsDir: ${cfg.specsDir}`)

    const baselineAbs = resolve(cwd, cfg.baselinePath)
    if (existsSync(baselineAbs)) {
      try {
        const raw = JSON.parse(readFileSync(baselineAbs, 'utf8')) as {
          meta?: { generated_at?: string; commit_hash?: string; languages?: string[] }
          generatedAt?: string
          modules?: unknown[]
          nodes?: unknown[]
        }
        const gen = raw.meta?.generated_at ?? raw.generatedAt ?? '?'
        const commit = raw.meta?.commit_hash ?? ''
        const langs = raw.meta?.languages?.join(', ') ?? ''
        this.log(`Baseline: generated ${gen}${commit ? `, commit ${commit}` : ''}${langs ? `, languages ${langs}` : ''}`)
        this.log(`  modules: ${raw.modules?.length ?? '?'}, nodes: ${raw.nodes?.length ?? '?'}`)
      } catch (e) {
        this.warn(`Could not read baseline: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      this.warn(`Baseline file missing: ${baselineAbs}`)
    }

    const driftAbs = resolve(cwd, cfg.driftReportPath)
    if (existsSync(driftAbs)) {
      try {
        const raw = JSON.parse(readFileSync(driftAbs, 'utf8')) as {
          summary?: { errors?: number; warnings?: number }
          generatedAt?: string
        }
        const s = raw.summary
        if (s) {
          this.log(
            `Drift: ${s.errors ?? 0} error(s), ${s.warnings ?? 0} warning(s) (at ${raw.generatedAt ?? '?'})`,
          )
        }
      } catch (e) {
        this.warn(`Could not read drift report: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      this.warn(`Drift report missing: ${driftAbs}`)
    }
  }
}
