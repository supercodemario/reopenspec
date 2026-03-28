import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  type LocalUserRole,
  DEFAULT_ROLE_EMOJI,
  isLocalUserRole,
  resolveHeroEmoji,
} from './reopenspec-local-profile.js'

export type { LocalUserRole, LocalProfileOnDisk } from './reopenspec-local-profile.js'
/** Hero emoji defaults & UI list — edit in `reopenspec-local-profile.ts` (see file header for sync steps). */
export {
  DEFAULT_ROLE_EMOJI,
  HERO_EMOJI_SUGGESTIONS,
  isLocalUserRole,
} from './reopenspec-local-profile.js'

export const REOPENSPEC_CONFIG_FILENAME = 'reopenspec.json'

/** Machine-local hero profile (gitignored). */
export const REOPENSPEC_LOCAL_CONFIG_FILENAME = 'reopenspec.local.json'

/** Saved in `reopenspec.local.json` — IDE scan + multi-select targets for skills/workflows. */
export type LocalIdeSetup = {
  detectedInWorkspace: string[]
  targets: string[]
  updatedAt?: string
}

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
  heroName: string
  role: LocalUserRole
  /** Effective emoji (custom or default for `role`). */
  heroEmoji: string
  baselinePath: string
  driftReportPath: string
  specsDir: string
  strictUncovered: boolean
}

const defaults: ResolvedReopenSpecConfig = {
  heroName: '',
  role: 'developer',
  heroEmoji: DEFAULT_ROLE_EMOJI.developer,
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

/** Local-only config at workspace root (not committed). */
export function localConfigFilePath(workspaceRoot: string): string {
  return resolve(workspaceRoot, REOPENSPEC_LOCAL_CONFIG_FILENAME)
}

function parseLocalProfileFile(raw: unknown, path: string): {
  heroName: string
  role: LocalUserRole
  emoji?: string
} {
  if (!raw || typeof raw !== 'object') throw new Error(`${path}: expected JSON object`)
  const o = raw as Record<string, unknown>

  let heroName = ''
  if (typeof o.heroName === 'string') heroName = o.heroName.trim()
  else if (typeof o.userName === 'string') heroName = o.userName.trim()

  let role: LocalUserRole = 'developer'
  if (o.role !== undefined) {
    if (typeof o.role !== 'string' || !isLocalUserRole(o.role)) {
      throw new Error(`${path}: role must be "developer" or "manager"`)
    }
    role = o.role
  }

  let emoji: string | undefined
  if (o.emoji !== undefined) {
    if (typeof o.emoji !== 'string') throw new Error(`${path}: emoji must be a string`)
    const t = o.emoji.trim()
    emoji = t === '' ? undefined : t
  }

  return { heroName, role, emoji }
}

function parseLocalIdeSetup(raw: unknown): LocalIdeSetup | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const dw = o.detectedInWorkspace
  const tg = o.targets
  if (!Array.isArray(dw) || !Array.isArray(tg)) return undefined
  if (!dw.every((x) => typeof x === 'string') || !tg.every((x) => typeof x === 'string')) {
    return undefined
  }
  const updatedAt =
    o.updatedAt !== undefined && typeof o.updatedAt === 'string' ? o.updatedAt : undefined
  const out: LocalIdeSetup = {
    detectedInWorkspace: dw as string[],
    targets: tg as string[],
  }
  if (updatedAt !== undefined) out.updatedAt = updatedAt
  return out
}

/** Read machine-local hero profile from `reopenspec.local.json`. */
export function loadLocalProfile(workspaceRoot: string): {
  heroName: string
  role: LocalUserRole
  heroEmoji: string
  ideSetup?: LocalIdeSetup
} {
  const p = localConfigFilePath(workspaceRoot)
  if (!existsSync(p)) {
    return {
      heroName: '',
      role: 'developer',
      heroEmoji: DEFAULT_ROLE_EMOJI.developer,
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8')) as unknown
  } catch (e) {
    throw new Error(`${p}: invalid JSON (${e instanceof Error ? e.message : String(e)})`)
  }
  const { heroName, role, emoji } = parseLocalProfileFile(parsed, p)
  const ideSetup = parseLocalIdeSetup((parsed as Record<string, unknown>).ideSetup)
  return {
    heroName,
    role,
    heroEmoji: resolveHeroEmoji(role, emoji),
    ...(ideSetup !== undefined ? { ideSetup } : {}),
  }
}

/** If `.gitignore` exists at the workspace root, ensure `reopenspec.local.json` is listed (idempotent). */
export function ensureLocalConfigInGitignore(workspaceRoot: string): void {
  const gi = resolve(workspaceRoot, '.gitignore')
  if (!existsSync(gi)) return
  const text = readFileSync(gi, 'utf8')
  if (/^\s*reopenspec\.local\.json\s*$/m.test(text)) return
  const block = `\n# ReOpenSpec: machine-local (do not commit)\nreopenspec.local.json\n`
  writeFileSync(gi, `${text.replace(/\s*$/, '')}${block}`, 'utf8')
}

/** Write or remove `reopenspec.local.json` (empty hero name removes the file). */
export function writeLocalProfile(
  workspaceRoot: string,
  profile: {
    heroName: string
    role: LocalUserRole
    emoji?: string
    ideSetup?: LocalIdeSetup
  },
): string | null {
  const p = localConfigFilePath(workspaceRoot)
  const name = profile.heroName.trim()
  if (name === '') {
    if (existsSync(p)) unlinkSync(p)
    return null
  }
  const defaultEm = DEFAULT_ROLE_EMOJI[profile.role]
  const custom = profile.emoji?.trim()
  const body: Record<string, unknown> = { heroName: name, role: profile.role }
  if (custom && custom !== defaultEm) body.emoji = custom

  let ideSetup: LocalIdeSetup | undefined = profile.ideSetup
  if (ideSetup === undefined && existsSync(p)) {
    try {
      const prev = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
      const prevIde = prev.ideSetup
      if (prevIde && typeof prevIde === 'object' && !Array.isArray(prevIde)) {
        ideSetup = prevIde as LocalIdeSetup
      }
    } catch {
      /* ignore */
    }
  }
  if (ideSetup !== undefined) body.ideSetup = ideSetup

  writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
  return p
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
    const local = loadLocalProfile(workspaceRoot)
    return {
      filePath,
      fileExists: false,
      merged: {
        ...defaults,
        heroName: local.heroName,
        role: local.role,
        heroEmoji: local.heroEmoji,
      },
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
  const local = loadLocalProfile(workspaceRoot)
  const merged: ResolvedReopenSpecConfig = {
    heroName: local.heroName,
    role: local.role,
    heroEmoji: local.heroEmoji,
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
