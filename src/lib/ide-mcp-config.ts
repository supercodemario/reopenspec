import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Cursor user MCP config (typically `~/.cursor/mcp.json`).
 * @see https://cursor.com/docs/context/mcp
 */
export type CursorMcpServerEntry = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export type CursorMcpFile = {
  mcpServers: Record<string, CursorMcpServerEntry>
}

/** Display path for logs (actual path uses {@link cursorMcpPath}). */
export const CURSOR_MCP_CONFIG_DISPLAY = '~/.cursor/mcp.json'

export function cursorMcpPath(): string {
  return join(homedir(), '.cursor', 'mcp.json')
}

/** `workspaceRoot` is ignored; kept for {@link IdeMcpTarget} compatibility. */
export function readCursorMcpFile(_workspaceRoot: string): CursorMcpFile | null {
  const p = cursorMcpPath()
  if (!existsSync(p)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8')) as unknown
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const raw = o.mcpServers
  if (!raw || typeof raw !== 'object') return { mcpServers: {} }
  const mcpServers: Record<string, CursorMcpServerEntry> = {}
  for (const [name, v] of Object.entries(raw)) {
    if (v && typeof v === 'object') mcpServers[name] = v as CursorMcpServerEntry
  }
  return { mcpServers }
}

/** Drop undefined / empty-string values from env objects. */
function cleanEnv(env: Record<string, string | undefined> | undefined): Record<string, string> | undefined {
  if (!env) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== '') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function cleanEntry(entry: CursorMcpServerEntry): CursorMcpServerEntry {
  const e: CursorMcpServerEntry = { ...entry }
  if (e.env) {
    const c = cleanEnv(e.env)
    if (c) e.env = c
    else delete e.env
  }
  if (e.headers) {
    const c = cleanEnv(e.headers as Record<string, string | undefined>)
    if (c) e.headers = c
    else delete e.headers
  }
  return e
}

export function mergeMcpServers(
  existing: CursorMcpFile | null,
  additions: Record<string, CursorMcpServerEntry>,
  overwriteNames: Set<string>,
): CursorMcpFile {
  const base: CursorMcpFile = existing ?? { mcpServers: {} }
  const next: CursorMcpFile = {
    mcpServers: { ...base.mcpServers },
  }
  for (const [name, entry] of Object.entries(additions)) {
    if (next.mcpServers[name] !== undefined && !overwriteNames.has(name)) continue
    next.mcpServers[name] = cleanEntry(entry)
  }
  return next
}

/** `workspaceRoot` is ignored; kept for {@link IdeMcpTarget} compatibility. */
export function writeCursorMcpFile(_workspaceRoot: string, data: CursorMcpFile): string {
  const dir = join(homedir(), '.cursor')
  mkdirSync(dir, { recursive: true })
  const p = cursorMcpPath()
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return p
}

/** Extensible list of IDE targets that support MCP JSON merging (Cursor first). */
export type IdeMcpTargetId = 'cursor'

export type IdeMcpTarget = {
  id: IdeMcpTargetId
  label: string
  /** Human-readable config path for logging */
  relativeConfigPath: string
  /** Absolute path to the on-disk MCP JSON for this IDE. */
  configFilePath: (workspaceRoot: string) => string
  read: (workspaceRoot: string) => CursorMcpFile | null
  write: (workspaceRoot: string, data: CursorMcpFile) => string
}

export const IDE_MCP_TARGETS: IdeMcpTarget[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    relativeConfigPath: CURSOR_MCP_CONFIG_DISPLAY,
    configFilePath: () => cursorMcpPath(),
    read: readCursorMcpFile,
    write: writeCursorMcpFile,
  },
]

export function getIdeMcpTarget(id: IdeMcpTargetId): IdeMcpTarget | undefined {
  return IDE_MCP_TARGETS.find((t) => t.id === id)
}
