import { execFileSync } from 'node:child_process'

/** Current `HEAD` commit hash, or `undefined` if not a git repo or git unavailable. */
export function getGitHeadCommit(workspaceRoot: string): string | undefined {
  try {
    const out = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const h = out.trim()
    return h || undefined
  } catch {
    return undefined
  }
}
