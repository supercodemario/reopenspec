import { Command, Flags } from '@oclif/core'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const MARKER_BEGIN = '# BEGIN REOPENSPEC HOOK'
const MARKER_END = '# END REOPENSPEC HOOK'

function stripReopenSpecBlock(s: string): string {
  const start = s.indexOf(MARKER_BEGIN)
  if (start === -1) return s
  const end = s.indexOf(MARKER_END, start)
  if (end === -1) return s
  const after = end + MARKER_END.length
  return (s.slice(0, start) + s.slice(after)).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

export default class HooksUninstall extends Command {
  static override id = 'hooks:uninstall'
  static override description = 'Remove the ReOpenSpec block from .git/hooks/pre-commit.'
  static override examples = ['<%= config.bin %> hooks uninstall']

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      default: '.',
      description: 'Git workspace root',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(HooksUninstall)
    const cwd = resolve(flags.cwd)
    const hookPath = join(cwd, '.git', 'hooks', 'pre-commit')
    if (!existsSync(hookPath)) {
      this.warn(`No pre-commit hook at ${hookPath}`)
      return
    }
    const prev = readFileSync(hookPath, 'utf8')
    if (!prev.includes(MARKER_BEGIN)) {
      this.warn('No ReOpenSpec block found in pre-commit')
      return
    }
    writeFileSync(hookPath, stripReopenSpecBlock(prev), 'utf8')
    this.log(`Removed ReOpenSpec block from ${hookPath}`)
  }
}
