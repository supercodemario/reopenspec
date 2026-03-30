import { existsSync } from 'node:fs'
import { createInterface, type Interface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  type CursorMcpServerEntry,
  getIdeMcpTarget,
  mergeMcpServers,
  type IdeMcpTargetId,
} from './ide-mcp-config.js'

export type McpSetupLog = {
  log: (msg: string) => void
  warn: (msg: string) => void
}

function trim(s: string): string {
  return s.trim()
}

async function ask(rl: Interface, q: string): Promise<string> {
  return trim(await rl.question(q))
}

async function askYes(rl: Interface, q: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N'
  const a = trim(await rl.question(`${q} (${hint}) `))
  if (a === '') return defaultYes
  return /^y(es)?$/i.test(a)
}

function parseArgsLine(line: string): string[] {
  const t = trim(line)
  if (t === '') return []
  try {
    const j = JSON.parse(t) as unknown
    if (Array.isArray(j) && j.every((x) => typeof x === 'string')) return j as string[]
  } catch {
    /* fall through */
  }
  return t.split(/\s+/).filter(Boolean)
}

async function collectEnvVars(rl: Interface): Promise<Record<string, string>> {
  const env: Record<string, string> = {}
  for (;;) {
    const line = await ask(rl, 'Environment KEY=value (empty line to finish): ')
    if (line === '') break
    const eq = line.indexOf('=')
    if (eq <= 0) {
      continue
    }
    const k = trim(line.slice(0, eq))
    const v = line.slice(eq + 1)
    if (k) env[k] = v
  }
  return env
}

async function presetAzureDevOps(rl: Interface): Promise<{ name: string; entry: CursorMcpServerEntry }> {
  const name =
    (await ask(rl, 'MCP server name in config [azdo-onprem]: ')) || 'azdo-onprem'
  const orgUrl = await ask(rl, 'AZURE_BASE_URL (e.g. https://devops.example.com/Collection/MyProject): ')
  const pat = await ask(rl, 'AZURE_PAT: ')
  
  const env: Record<string, string> = {
    AZURE_BASE_URL: orgUrl,
    AZURE_PAT: pat,
  }
  return {
    name,
    entry: {
      command: 'npx',
      args: ['-y', 'azdo-onprem-mcp'],
      env,
    },
  }
}

async function customStdio(rl: Interface): Promise<{ name: string; entry: CursorMcpServerEntry }> {
  const name = await ask(rl, 'MCP server name (unique key, e.g. my-tool): ')
  if (!name) throw new Error('Server name is required.')
  const command = await ask(rl, 'Command (e.g. npx): ')
  if (!command) throw new Error('Command is required.')
  const argsLine = await ask(
    rl,
    'Arguments (space-separated, or JSON array e.g. ["-y","pkg"]): ',
  )
  const args = parseArgsLine(argsLine)
  const env = await collectEnvVars(rl)
  const entry: CursorMcpServerEntry = { command, args: args.length > 0 ? args : undefined }
  if (Object.keys(env).length > 0) entry.env = env
  return { name, entry }
}

async function customUrl(rl: Interface): Promise<{ name: string; entry: CursorMcpServerEntry }> {
  const name = await ask(rl, 'MCP server name (unique key): ')
  if (!name) throw new Error('Server name is required.')
  const url = await ask(rl, 'Server URL (HTTPS/SSE): ')
  if (!url) throw new Error('URL is required.')
  const token = await ask(rl, 'Authorization bearer token (optional, empty to skip): ')
  const entry: CursorMcpServerEntry = { url }
  if (token) entry.headers = { Authorization: `Bearer ${token}` }
  return { name, entry }
}

export type McpInteractiveOptions = {
  workspaceRoot: string
  /** When true, do nothing. */
  skip: boolean
  /** Defaults to cursor; more IDEs can be added alongside ide-mcp-config IDE_MCP_TARGETS. */
  ide: IdeMcpTargetId
} & McpSetupLog

/**
 * Prompts for MCP server entries and merges them into the IDE MCP JSON (Cursor: `~/.cursor/mcp.json`).
 * No-op when `skip`, non-interactive stdin, or user declines.
 */
export async function runMcpInteractiveSetup(options: McpInteractiveOptions): Promise<void> {
  const { workspaceRoot, skip, ide, log, warn } = options
  if (skip) return
  if (!process.stdin.isTTY) {
    log('Skipping MCP setup (non-interactive terminal). Use a TTY or configure ~/.cursor/mcp.json manually.')
    return
  }

  const target = getIdeMcpTarget(ide)
  if (!target) {
    warn(`No MCP config target registered for IDE "${ide}". Skipping.`)
    return
  }

  const rl = createInterface({ input, output })
  try {
    const ok = await askYes(
      rl,
      `Configure Model Context Protocol (MCP) servers for ${target.label}? Writes ${target.relativeConfigPath}`,
      false,
    )
    if (!ok) {
      log('Skipped MCP configuration.')
      return
    }

    const configAbs = target.configFilePath(workspaceRoot)
    const existing = target.read(workspaceRoot)
    if (existsSync(configAbs) && existing === null) {
      warn(
        `Existing file at ${target.relativeConfigPath} is missing or invalid JSON; merge will start from an empty mcpServers object.`,
      )
    }
    if (existing && Object.keys(existing.mcpServers).length > 0) {
      log(`Existing servers in ${target.relativeConfigPath}: ${Object.keys(existing.mcpServers).join(', ')}`)
    }

    const additions: Record<string, CursorMcpServerEntry> = {}
    const overwrite = new Set<string>()

    for (;;) {
      log('')
      log('Add an MCP server:')
      log('  1) Azure DevOps On-Prem / Cloud (npx azdo-onprem-mcp)')
      log('  2) Custom command (stdio)')
      log('  3) Custom remote URL (HTTPS/SSE) + optional Bearer token')
      log('  4) Done / write file')
      const choice = await ask(rl, 'Choice [1-4]: ')

      if (choice === '4') {
        if (Object.keys(additions).length === 0) {
          log('No new servers added.')
          return
        }
        break
      }
      if (choice === '') {
        warn('Enter a number from 1 to 4.')
        continue
      }

      let built: { name: string; entry: CursorMcpServerEntry }
      try {
        if (choice === '1') built = await presetAzureDevOps(rl)
        else if (choice === '2') built = await customStdio(rl)
        else if (choice === '3') built = await customUrl(rl)
        else {
          warn('Invalid choice.')
          continue
        }
      } catch (e) {
        warn(e instanceof Error ? e.message : String(e))
        continue
      }

      const prev = existing?.mcpServers[built.name] ?? additions[built.name]
      if (prev !== undefined) {
        const replace = await askYes(rl, `Replace existing "${built.name}" entry?`, false)
        if (!replace) continue
        overwrite.add(built.name)
      } else {
        overwrite.add(built.name)
      }

      additions[built.name] = built.entry
      log(`Queued "${built.name}" (${Object.keys(additions).length} new/updated in this session).`)
    }

    const merged = mergeMcpServers(existing, additions, overwrite)
    const written = target.write(workspaceRoot, merged)
    log(`Wrote ${written}`)
    log('Restart the IDE (or reload MCP) if it does not pick up changes immediately.')
  } finally {
    await rl.close()
  }
}
