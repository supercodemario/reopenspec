import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Package root when running from compiled `dist/lib/*.js`. */
export function resolvePackageRootFromLib(): string {
  return join(__dirname, '..', '..')
}

const COMMAND_GLOB = /^reo-.*\.md$|^README\.md$/

import { readIdePreferences } from './rules-copy.js'

/** Copy bundled Cursor command templates to all configured IDE workflow paths. */
export function copyWorkflowCommandsToProject(workspaceRoot: string): string[] {
  const srcDir = join(resolvePackageRootFromLib(), 'commands')
  if (!existsSync(srcDir)) {
    throw new Error(`Workflow commands not found at ${srcDir} (install reopenspec or run from package clone)`)
  }
  const ides = readIdePreferences(workspaceRoot)
  const written: string[] = []
  
  for (const ide of ides) {
    const destRel = ide === 'antigravity' ? join('.agents', 'workflows') : join('.cursor', 'commands')
    const destDir = join(workspaceRoot, destRel)
    mkdirSync(destDir, { recursive: true })
    
    for (const name of readdirSync(srcDir)) {
      if (!COMMAND_GLOB.test(name)) continue
      const from = join(srcDir, name)
      const to = join(destDir, name)
      copyFileSync(from, to)
      written.push(join(destRel, name))
    }
  }
  return written
}

/** Copy default `reopenspec.project.yaml` if missing. */
export function copyProjectYamlTemplate(workspaceRoot: string): string | null {
  const dest = join(workspaceRoot, 'reopenspec.project.yaml')
  if (existsSync(dest)) return null
  const src = join(resolvePackageRootFromLib(), 'templates', 'reopenspec.project.yaml')
  if (!existsSync(src)) return null
  copyFileSync(src, dest)
  return 'reopenspec.project.yaml'
}

/** Copy bundled architecture model into `reopenspec/docs/` if missing. */
export function copyReopenSpecModelDocIfMissing(workspaceRoot: string): string | null {
  const dest = join(workspaceRoot, 'reopenspec', 'docs', 'reopenspec-model.md')
  if (existsSync(dest)) return null
  mkdirSync(join(workspaceRoot, 'reopenspec', 'docs'), { recursive: true })
  const src = join(resolvePackageRootFromLib(), 'docs', 'reopenspec-model.md')
  if (!existsSync(src)) return null
  copyFileSync(src, dest)
  return 'reopenspec/docs/reopenspec-model.md'
}
