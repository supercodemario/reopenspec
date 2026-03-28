import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const REOPENSPEC_CONFIG_FILENAME = 'reopenspec.json'

/** Supported version in on-disk JSON (bump when shape changes). */
export const REOPENSPEC_CONFIG_VERSION = '0.1.0' as const

/** Raw file shape (optional fields). */
export type ReopenSpecConfigFile = {
  version: typeof REOPENSPEC_CONFIG_VERSION
  baselinePath?: string
  driftReportPath?: string
  specsDir?: string
  strictUncovered?: boolean
}

/** Effective paths after merge with defaults. */
export type ResolvedReopenSpecConfig = {
  baselinePath: string
  driftReportPath: string
  specsDir: string
  strictUncovered: boolean
}

const defaults: ResolvedReopenSpecConfig = {
  baselinePath: 'specs/.meta/arch-baseline.json',
  driftReportPath: 'specs/.meta/drift-report.json',
  specsDir: 'specs',
  strictUncovered: false,
}

/** Primary config at repo root (preferred when present). */
export function configFilePathWorkspaceRoot(workspaceRoot: string): string {
  return resolve(workspaceRoot, REOPENSPEC_CONFIG_FILENAME)
}

/** Alternate location per requirements (`/specs/.meta/reopenspec.json`). */
export function configFilePathSpecsMeta(workspaceRoot: string): string {
  return resolve(workspaceRoot, 'specs', '.meta', REOPENSPEC_CONFIG_FILENAME)
}

/** Resolve which config file to use: root first, then `specs/.meta/`. */
export function resolveExistingConfigPath(workspaceRoot: string): string | null {
  const rootPath = configFilePathWorkspaceRoot(workspaceRoot)
  const metaPath = configFilePathSpecsMeta(workspaceRoot)
  if (existsSync(rootPath)) return rootPath
  if (existsSync(metaPath)) return metaPath
  return null
}

/** Default path for new config files (`reopenspec.json` at workspace root). */
export function configFilePath(workspaceRoot: string): string {
  return configFilePathWorkspaceRoot(workspaceRoot)
}

function parseFile(raw: unknown, path: string): ReopenSpecConfigFile {
  if (!raw || typeof raw !== 'object') throw new Error(`${path}: expected JSON object`)
  const o = raw as Record<string, unknown>
  if (o.version !== REOPENSPEC_CONFIG_VERSION) {
    throw new Error(`${path}: unsupported "version" (expected "${REOPENSPEC_CONFIG_VERSION}")`)
  }
  const out: ReopenSpecConfigFile = { version: REOPENSPEC_CONFIG_VERSION }
  if (o.baselinePath !== undefined) {
    if (typeof o.baselinePath !== 'string') throw new Error(`${path}: baselinePath must be a string`)
    out.baselinePath = o.baselinePath
  }
  if (o.driftReportPath !== undefined) {
    if (typeof o.driftReportPath !== 'string') throw new Error(`${path}: driftReportPath must be a string`)
    out.driftReportPath = o.driftReportPath
  }
  if (o.specsDir !== undefined) {
    if (typeof o.specsDir !== 'string') throw new Error(`${path}: specsDir must be a string`)
    out.specsDir = o.specsDir.replace(/\\/g, '/').replace(/\/$/, '')
  }
  if (o.strictUncovered !== undefined) {
    if (typeof o.strictUncovered !== 'boolean') throw new Error(`${path}: strictUncovered must be boolean`)
    out.strictUncovered = o.strictUncovered
  }
  return out
}

/** Load and merge `reopenspec.json` (root or `specs/.meta/`); returns defaults if missing. */
export function loadResolvedConfig(workspaceRoot: string): {
  filePath: string
  fileExists: boolean
  merged: ResolvedReopenSpecConfig
  raw: ReopenSpecConfigFile | null
} {
  const existing = resolveExistingConfigPath(workspaceRoot)
  const filePath = existing ?? configFilePath(workspaceRoot)
  if (!existing) {
    return {
      filePath,
      fileExists: false,
      merged: { ...defaults },
      raw: null,
    }
  }
  const rawText = readFileSync(existing, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText) as unknown
  } catch (e) {
    throw new Error(
      `${existing}: invalid JSON (${e instanceof Error ? e.message : String(e)})`,
    )
  }
  const raw = parseFile(parsed, existing)
  const merged: ResolvedReopenSpecConfig = {
    baselinePath: raw.baselinePath ?? defaults.baselinePath,
    driftReportPath: raw.driftReportPath ?? defaults.driftReportPath,
    specsDir: raw.specsDir ?? defaults.specsDir,
    strictUncovered: raw.strictUncovered ?? defaults.strictUncovered,
  }
  return { filePath: existing, fileExists: true, merged, raw }
}

/** Write a new default config file (fails if file already exists unless `force`). */
export function writeDefaultConfigFile(workspaceRoot: string, force = false): string {
  const filePath = configFilePath(workspaceRoot)
  if (existsSync(filePath) && !force) {
    throw new Error(`${REOPENSPEC_CONFIG_FILENAME} already exists (use --force to overwrite)`)
  }
  const body: ReopenSpecConfigFile = {
    version: REOPENSPEC_CONFIG_VERSION,
    baselinePath: defaults.baselinePath,
    driftReportPath: defaults.driftReportPath,
    specsDir: defaults.specsDir,
    strictUncovered: defaults.strictUncovered,
  }
  writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
  return filePath
}

export function writeConfigFile(workspaceRoot: string, data: ReopenSpecConfigFile): string {
  const filePath = configFilePath(workspaceRoot)
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return filePath
}
