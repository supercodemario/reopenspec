import { Command, Flags } from '@oclif/core'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const MARKER_BEGIN = '# BEGIN REOPENSPEC HOOK'
const MARKER_END = '# END REOPENSPEC HOOK'

const HOOK_CORE = `${MARKER_BEGIN}
set -e
if command -v reo >/dev/null 2>&1; then
  reo sync || exit 1
else
  echo "reo not found in PATH; install the reopenspec CLI or run: npx reopenspec sync" >&2
  exit 1
fi
${MARKER_END}
`

function newHookFile(): string {
  return `#!/bin/sh
${HOOK_CORE}
`
}

function stripReopenSpecBlock(s: string): string {
  const start = s.indexOf(MARKER_BEGIN)
  if (start === -1) return s
  const end = s.indexOf(MARKER_END, start)
  if (end === -1) return s
  const after = end + MARKER_END.length
  return (s.slice(0, start) + s.slice(after)).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

export default class HooksInstall extends Command {
  static override id = 'hooks:install'
  static override description = 'Install a git pre-commit hook that runs reo sync.'
  static override examples = ['<%= config.bin %> hooks install']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: process.cwd(),
      description: 'Git workspace root',
    }),
    force: Flags.boolean({
      description: 'Replace an existing ReOpenSpec hook block',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(HooksInstall)
    const cwd = resolve(flags.cwd)
    const gitDir = join(cwd, '.git')
    if (!existsSync(gitDir)) {
      this.error('No .git directory found. Run from a git repository root.')
    }
    const hookPath = join(gitDir, 'hooks', 'pre-commit')

    if (existsSync(hookPath)) {
      const prev = readFileSync(hookPath, 'utf8')
      if (prev.includes(MARKER_BEGIN) && !flags.force) {
        this.error('pre-commit already contains a ReOpenSpec block (use --force to replace)')
      }
      const base = prev.includes(MARKER_BEGIN) && flags.force ? stripReopenSpecBlock(prev) : prev
      const sep = base.endsWith('\n') ? '\n' : '\n\n'
      writeFileSync(hookPath, `${base.trimEnd()}${sep}${HOOK_CORE}`, 'utf8')
    } else {
      writeFileSync(hookPath, newHookFile(), 'utf8')
    }
    try {
      chmodSync(hookPath, 0o755)
    } catch {
      /* ignore */
    }
    this.log(`Installed ${hookPath}`)
  }
}
