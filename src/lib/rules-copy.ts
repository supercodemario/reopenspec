import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BackendStack, FrontendStack, StackProfile } from './detect-profile.js'
import { resolvePackageRootFromLib } from './workflow-copy.js'

export type RuleCopyOptions = {
  /** Workspace root of the target project. */
  workspaceRoot: string
  /** Explicit backend stack override (null = use auto-detect). */
  backend: BackendStack
  /** Explicit frontend stack override (null = use auto-detect). */
  frontend: FrontendStack
  /** Copy database rules. */
  database: boolean
  /** Copy devops / CI-CD rules. */
  devops: boolean
  /** Copy Figma design-to-code rules (requires a frontend). */
  figma: boolean
  /** Auto-detected stack profile from detect-profile. */
  detected: StackProfile
  /** IDE rules directory (e.g. `.cursor/rules`). */
  ideRulesDir: string
}

export type RuleCopyResult = {
  /** Rule files written (relative to workspace root). */
  copied: string[]
  /** Skipped categories with reason. */
  skipped: Array<{ category: string; reason: string }>
  /** Effective stacks used for the copy. */
  effectiveBackend: BackendStack
  effectiveFrontend: FrontendStack
}

const PKG_RULES_DIR = () => join(resolvePackageRootFromLib(), 'rules')

/** Strip `.example` from rule filenames when copying to projects. */
function sanitizeRuleFilename(filename: string): string {
  return filename.replace(/\.example\./, '.')
}

/**
 * Copy generic + specific rules to the project's IDE rules directory.
 *
 * Generic rules are always copied (stack-agnostic).
 * Specific rules are copied only when a matching stack is selected
 * (either explicitly via flags or via auto-detection).
 */
export function copyRulesToProject(opts: RuleCopyOptions): RuleCopyResult {
  const rulesRoot = PKG_RULES_DIR()
  const dest = join(opts.workspaceRoot, opts.ideRulesDir)
  mkdirSync(dest, { recursive: true })

  const copied: string[] = []
  const skipped: RuleCopyResult['skipped'] = []

  // Resolve effective stacks: explicit flags override auto-detect
  const effectiveBackend = opts.backend ?? opts.detected.backend
  const effectiveFrontend = opts.frontend ?? opts.detected.frontend
  const effectiveDatabase = opts.database || opts.detected.hasDatabase
  const effectiveDevops = opts.devops || opts.detected.hasDevops
  const effectiveFigma = opts.figma || opts.detected.hasFigma

  // 1. Generic rules — always copy
  const genericDir = join(rulesRoot, 'generic')
  if (existsSync(genericDir)) {
    for (const file of readdirSync(genericDir)) {
      if (!file.endsWith('.mdc') && !file.endsWith('.md')) continue
      const destName = sanitizeRuleFilename(file)
      copyFileSync(join(genericDir, file), join(dest, destName))
      copied.push(join(opts.ideRulesDir, destName))
    }
  }

  // 2. Backend-specific rules
  if (effectiveBackend) {
    const backendDir = join(rulesRoot, 'specific', 'backend', effectiveBackend)
    if (existsSync(backendDir)) {
      for (const file of readdirSync(backendDir)) {
        if (!file.endsWith('.mdc') && !file.endsWith('.md')) continue
        const destName = sanitizeRuleFilename(file)
        copyFileSync(join(backendDir, file), join(dest, destName))
        copied.push(join(opts.ideRulesDir, destName))
      }
    } else {
      skipped.push({ category: `backend/${effectiveBackend}`, reason: 'no rule templates found for this stack yet' })
    }
  } else {
    skipped.push({ category: 'backend', reason: 'no backend stack detected or specified' })
  }

  // 3. Frontend-specific rules
  if (effectiveFrontend) {
    // Common frontend rules (apply to any FE stack)
    const commonFeDir = join(rulesRoot, 'specific', 'frontend', 'common')
    if (existsSync(commonFeDir)) {
      for (const file of readdirSync(commonFeDir)) {
        if (!file.endsWith('.mdc') && !file.endsWith('.md')) continue
        const destName = sanitizeRuleFilename(file)
        copyFileSync(join(commonFeDir, file), join(dest, destName))
        copied.push(join(opts.ideRulesDir, destName))
      }
    }
    // Stack-specific frontend rules
    const feDir = join(rulesRoot, 'specific', 'frontend', effectiveFrontend)
    if (existsSync(feDir)) {
      for (const file of readdirSync(feDir)) {
        if (!file.endsWith('.mdc') && !file.endsWith('.md')) continue
        // Skip figma rules unless figma is enabled
        if (file.includes('figma') && !effectiveFigma) {
          skipped.push({ category: 'frontend/figma', reason: '--figma not set and no Figma integration detected' })
          continue
        }
        const destName = sanitizeRuleFilename(file)
        copyFileSync(join(feDir, file), join(dest, destName))
        copied.push(join(opts.ideRulesDir, destName))
      }
    } else {
      skipped.push({ category: `frontend/${effectiveFrontend}`, reason: 'no rule templates found for this stack yet' })
    }
  } else {
    skipped.push({ category: 'frontend', reason: 'no frontend stack detected or specified' })
  }

  // 4. Database rules
  if (effectiveDatabase) {
    const dbDir = join(rulesRoot, 'specific', 'database')
    if (existsSync(dbDir)) {
      for (const file of readdirSync(dbDir)) {
        if (!file.endsWith('.mdc') && !file.endsWith('.md')) continue
        const destName = sanitizeRuleFilename(file)
        copyFileSync(join(dbDir, file), join(dest, destName))
        copied.push(join(opts.ideRulesDir, destName))
      }
    }
  } else {
    skipped.push({ category: 'database', reason: '--database not set and no database detected' })
  }

  // 5. DevOps rules
  if (effectiveDevops) {
    const devopsDir = join(rulesRoot, 'specific', 'devops')
    if (existsSync(devopsDir)) {
      for (const file of readdirSync(devopsDir)) {
        if (!file.endsWith('.mdc') && !file.endsWith('.md')) continue
        const destName = sanitizeRuleFilename(file)
        copyFileSync(join(devopsDir, file), join(dest, destName))
        copied.push(join(opts.ideRulesDir, destName))
      }
    }
  } else {
    skipped.push({ category: 'devops', reason: '--devops not set and no CI/CD detected' })
  }

  return { copied, skipped, effectiveBackend, effectiveFrontend }
}

/** Read the IDE preferences from .reopenspec.user.yaml or auto-detect. */
export function readIdePreferences(workspaceRoot: string): string[] {
  const userYaml = join(workspaceRoot, '.reopenspec.user.yaml')
  if (!existsSync(userYaml)) {
    const prefs: string[] = []
    if (existsSync(join(workspaceRoot, '.agents'))) prefs.push('antigravity')
    if (existsSync(join(workspaceRoot, '.cursor'))) prefs.push('cursor')
    if (existsSync(join(workspaceRoot, '.windsurf'))) prefs.push('windsurf')
    if (existsSync(join(workspaceRoot, '.roo'))) prefs.push('roo')
    if (existsSync(join(workspaceRoot, '.clinerules'))) prefs.push('cline')
    if (prefs.length === 0) prefs.push('cursor')
    return prefs
  }
  try {
    const content = readFileSync(userYaml, 'utf8')
    // Match array IDE config (ide: [cursor, roo])
    const arrayMatch = content.match(/^ide:\s*\[(.*?)\]/m)
    if (arrayMatch) {
      return arrayMatch[1]!.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
    }
    // Match single IDE config (ide: cursor)
    const singleMatch = content.match(/^ide:\s*["']?(\w+)["']?/m)
    if (singleMatch && singleMatch[1]) return [singleMatch[1]]
    return ['cursor']
  } catch {
    return ['cursor']
  }
}

/** Map IDE name to rules directory path. */
export function ideRulesDir(ide: string): string {
  switch (ide) {
    case 'cursor': return join('.cursor', 'rules')
    case 'windsurf': return '.windsurfrules'
    case 'roo': return '.roo'
    case 'cline': return '.cline'
    case 'antigravity': return join('.agents', 'rules')
    default: return '.ai-context'
  }
}
