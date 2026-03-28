import { Args, Command, Flags } from '@oclif/core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getGitHeadCommit } from '../../lib/git.js'
import { loadResolvedConfig } from '../../lib/reopenspec-config.js'

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default class SpecNew extends Command {
  static override id = 'spec:new'
  static override description =
    'Scaffold specs/{feature-slug}/ with overview, architecture, api-contracts, tasks, decisions, and .spec-meta.json.'
  static override examples = ['<%= config.bin %> spec new my-feature']

  static override args = {
    slug: Args.string({
      description: 'Feature folder name (e.g. order-management)',
      required: true,
    }),
  }

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Workspace root',
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpecNew)
    const cwd = resolve(flags.cwd)
    const { merged: cfg } = loadResolvedConfig(cwd)
    const slug = slugify(args.slug)
    if (!slug) {
      this.error('Invalid feature slug')
    }
    const base = join(cwd, cfg.specsDir, slug)
    mkdirSync(base, { recursive: true })

    const commit = getGitHeadCommit(cwd) ?? ''

    writeFileSync(
      join(base, 'overview.md'),
      `# ${slug}

**Status**: draft  
**Last updated**: ${new Date().toISOString().slice(0, 10)}

## Summary

(Feature summary — fill in.)

## Scope

## Acceptance Criteria

## Open Questions

`,
      'utf8',
    )

    writeFileSync(
      join(base, 'architecture.md'),
      `# Architecture: ${slug}

## Affected Modules

(List module IDs from arch-baseline.json.)

## Component Interactions

## Design Decisions

`,
      'utf8',
    )

    writeFileSync(
      join(base, 'api-contracts.json'),
      `{
  "version": "0.2.0",
  "contracts": []
}
`,
      'utf8',
    )

    writeFileSync(
      join(base, 'tasks.md'),
      `# Tasks: ${slug}

- [ ] Implementation tasks go here

`,
      'utf8',
    )

    writeFileSync(
      join(base, 'decisions.md'),
      `# Decisions: ${slug}

## ADR template

Use one section per decision.

`,
      'utf8',
    )

    writeFileSync(
      join(base, '.spec-meta.json'),
      `${JSON.stringify(
        {
          version: '1',
          last_synced_commit: commit,
          baseline_refs: [],
          status: 'in-sync',
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    this.log(`Scaffolded ${cfg.specsDir}/${slug}/`)
  }
}
