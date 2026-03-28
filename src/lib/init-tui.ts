import readline from 'node:readline'
import { createInterface } from 'node:readline/promises'
import { detectCurrentTerminalIde, detectIdes, IDE_CATALOG, type DetectedIde } from './injector.js'
import type { LocalIdeSetup } from './reopenspec-config.js'
import type { LocalUserRole } from './reopenspec-local-profile.js'

const a = {
  reset: '\x1b[0m',
  yellow: '\x1b[33;1m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
}

const ROLE_ROWS: { id: LocalUserRole; label: string }[] = [
  { id: 'developer', label: 'Developer 🥷' },
  { id: 'manager', label: 'Manager 🔀' },
]

function isInteractive(): boolean {
  return (
    Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
    process.env.CI !== 'true' &&
    process.env.CI !== '1'
  )
}

/** One terminal row per menu line (avoids broken redraw when long labels wrap). */
function ttyColumns(): number {
  const c = process.stdout.columns
  return typeof c === 'number' && c >= 24 ? c : 80
}

function truncateToWidth(text: string, maxVisualWidth: number): string {
  if (text.length <= maxVisualWidth) return text
  if (maxVisualWidth <= 1) return '…'
  return `${text.slice(0, maxVisualWidth - 1)}…`
}

function ideCatalogLabelForRow(index: number): string {
  const raw = IDE_CATALOG[index]?.label ?? ''
  const reserve = 14
  return truncateToWidth(raw, Math.max(20, ttyColumns() - reserve))
}

/**
 * Full-screen TUI: one visible menu that refreshes in place (no stacked reprints).
 * Uses the alternate screen buffer + clear/home on each frame.
 */
function createAltScreenMenu(
  stdout: NodeJS.WriteStream,
  getLines: () => string[],
): { redraw: () => void; leave: () => void } {
  let altActive = false
  return {
    redraw() {
      stdout.write('\x1b[?25l')
      if (!altActive) {
        stdout.write('\x1b[?1049h')
        altActive = true
      }
      stdout.write('\x1b[2J\x1b[H')
      for (const line of getLines()) {
        stdout.write(`${line}\n`)
      }
    },
    leave() {
      if (altActive) {
        stdout.write('\x1b[?1049l')
        altActive = false
      }
      stdout.write('\x1b[?25h')
    },
  }
}

function buildRoleMenuLines(focus: number, chosen: number): string[] {
  const out: string[] = []
  out.push(`${a.cyan}Hi, you can select project role:${a.reset}`)
  out.push('')
  out.push(`${a.dim}↑/↓ or j/k move · Space = select (highlight in yellow) · Enter = confirm${a.reset}`)
  for (let i = 0; i < ROLE_ROWS.length; i++) {
    const isFocus = i === focus
    const isChosen = i === chosen
    const prefix = isFocus ? `${a.green}›${a.reset} ` : '  '
    const color = isChosen ? a.yellow : a.dim
    out.push(`${prefix}${color}${ROLE_ROWS[i].label}${a.reset}`)
  }
  out.push('')
  out.push(`${a.dim}Press Enter to confirm${a.reset}`)
  return out
}

/**
 * List UI: arrows move focus, Space marks row as selected (yellow), Enter confirms.
 * Uses readline keypress so ↑/↓ work in Cursor, macOS Terminal, iTerm (CSI and SS3 arrows).
 */
export function promptRoleWithSpaceSelect(initialDefault: LocalUserRole): Promise<LocalUserRole> {
  return new Promise((resolve) => {
    const stdin = process.stdin
    const stdout = process.stdout

    let focus = ROLE_ROWS.findIndex((r) => r.id === initialDefault)
    if (focus < 0) focus = 0
    let chosen = focus

    readline.emitKeypressEvents(stdin)
    stdin.resume()

    const menu = createAltScreenMenu(stdout, () => buildRoleMenuLines(focus, chosen))

    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.removeListener('keypress', onKeypress)
      menu.leave()
    }

    const onKeypress = (_str: string | undefined, key: readline.Key | undefined) => {
      if (!key) return
      if (key.ctrl && key.name === 'c') {
        cleanup()
        stdout.write('\n')
        process.exit(130)
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        stdout.write('\n')
        resolve(ROLE_ROWS[chosen].id)
        return
      }
      if (key.name === 'space') {
        chosen = focus
        menu.redraw()
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        focus = (focus - 1 + ROLE_ROWS.length) % ROLE_ROWS.length
        menu.redraw()
        return
      }
      if (key.name === 'down' || key.name === 'j') {
        focus = (focus + 1) % ROLE_ROWS.length
        menu.redraw()
        return
      }
    }

    stdin.setRawMode(true)
    stdin.on('keypress', onKeypress)
    menu.redraw()
  })
}

export async function promptRoleInteractive(currentDefault: LocalUserRole): Promise<LocalUserRole> {
  if (!isInteractive()) return currentDefault
  return promptRoleWithSpaceSelect(currentDefault)
}

export async function promptPressEnterToScanIde(): Promise<void> {
  if (!isInteractive()) return
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    await rl.question(
      `${a.cyan}\nPress Enter to scan this workspace for AI IDE markers…${a.reset}\n`,
    )
  } finally {
    rl.close()
  }
}

export function printUserIdeContext(
  heroName: string,
  role: LocalUserRole,
  heroEmoji: string,
  detectedInWorkspace: string[],
  currentTerminalIde: DetectedIde | null,
): void {
  const det =
    detectedInWorkspace.length > 0
      ? detectedInWorkspace
          .map((id) => IDE_CATALOG.find((c) => c.id === id)?.label ?? id)
          .join(`${a.dim}, ${a.reset}`)
      : `${a.dim}(none — no recognized AI tool folders in this repo; see IDE list below)${a.reset}`

  const termLine =
    currentTerminalIde !== null
      ? `${IDE_CATALOG.find((c) => c.id === currentTerminalIde)?.label ?? currentTerminalIde} ${a.dim}(from this terminal’s env)${a.reset}`
      : `${a.dim}(not inferred — open the integrated terminal in Cursor, VS Code, Windsurf, etc. for auto-select)${a.reset}`

  const lines = [
    '',
    `${a.bold}── Your profile ──${a.reset}`,
    `  ${heroEmoji}  ${a.bold}${heroName}${a.reset}  ${a.dim}·${a.reset}  ${a.cyan}${role}${a.reset}`,
    '',
    `${a.bold}── This terminal (best guess) ──${a.reset}`,
    `  ${termLine}`,
    '',
    `${a.bold}── Detected in this repo ──${a.reset}`,
    `  ${det}`,
    '',
  ]
  process.stdout.write(lines.join('\n') + '\n')
}

function initialIdeChecks(preselectedIds: string[]): boolean[] {
  return IDE_CATALOG.map(({ id }) => {
    if (preselectedIds.includes(id)) return true
    if (preselectedIds.length === 0 && id === 'universal') return true
    return false
  })
}

function buildIdeMultiLines(focus: number, checked: boolean[]): string[] {
  const out: string[] = []
  out.push(`${a.cyan}Select IDEs to align skills & ReOpenSpec workflows with:${a.reset}`)
  out.push('')
  out.push(`${a.dim}↑/↓ or j/k move · Space = toggle [x] · Enter = confirm${a.reset}`)
  for (let i = 0; i < IDE_CATALOG.length; i++) {
    const box = checked[i] ? `${a.yellow}[x]${a.reset}` : `${a.dim}[ ]${a.reset}`
    const isFocus = i === focus
    const prefix = isFocus ? `${a.green}›${a.reset} ` : '  '
    const labelColor = checked[i] ? a.yellow : a.dim
    out.push(`${prefix}${box} ${labelColor}${ideCatalogLabelForRow(i)}${a.reset}`)
  }
  out.push('')
  out.push(`${a.dim}Press Enter to save IDE targets (stored in reopenspec.local.json)${a.reset}`)
  return out
}

export function promptIdeTargetsMultiSelect(preselectedIds: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const stdin = process.stdin
    const stdout = process.stdout
    let focus = 0
    const checked = initialIdeChecks(preselectedIds)

    readline.emitKeypressEvents(stdin)
    stdin.resume()

    const menu = createAltScreenMenu(stdout, () => buildIdeMultiLines(focus, checked))

    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.removeListener('keypress', onKeypress)
      menu.leave()
    }

    const onKeypress = (_str: string | undefined, key: readline.Key | undefined) => {
      if (!key) return
      if (key.ctrl && key.name === 'c') {
        cleanup()
        stdout.write('\n')
        process.exit(130)
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        stdout.write('\n')
        let finalChecked = [...checked]
        if (!finalChecked.some(Boolean)) {
          const u = IDE_CATALOG.findIndex((c) => c.id === 'universal')
          if (u >= 0) finalChecked[u] = true
        }
        const targets = IDE_CATALOG.filter((_, i) => finalChecked[i]).map((c) => c.id)
        resolve(targets)
        return
      }
      if (key.name === 'space') {
        checked[focus] = !checked[focus]
        menu.redraw()
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        focus = (focus - 1 + IDE_CATALOG.length) % IDE_CATALOG.length
        menu.redraw()
        return
      }
      if (key.name === 'down' || key.name === 'j') {
        focus = (focus + 1) % IDE_CATALOG.length
        menu.redraw()
        return
      }
    }

    stdin.setRawMode(true)
    stdin.on('keypress', onKeypress)
    menu.redraw()
  })
}

export async function runInteractiveIdeSetup(args: {
  workspaceRoot: string
  heroName: string
  role: LocalUserRole
  heroEmoji: string
}): Promise<LocalIdeSetup> {
  await promptPressEnterToScanIde()
  const detectedInWorkspace = detectIdes(args.workspaceRoot)
  const currentTerminalIde = detectCurrentTerminalIde()
  const preselectedIds = [
    ...new Set<string>([
      ...detectedInWorkspace,
      ...(currentTerminalIde !== null ? [currentTerminalIde] : []),
    ]),
  ]
  printUserIdeContext(
    args.heroName,
    args.role,
    args.heroEmoji,
    detectedInWorkspace,
    currentTerminalIde,
  )
  process.stdout.write('\n')
  const targets = await promptIdeTargetsMultiSelect(preselectedIds)
  return {
    detectedInWorkspace,
    targets,
    updatedAt: new Date().toISOString(),
  }
}

/** Shown after interactive hero + role setup. */
export function printWelcomeBanner(
  heroName: string,
  role: LocalUserRole,
  heroEmoji: string,
  ideTargets?: string[],
): void {
  const roleTint = role === 'developer' ? a.cyan : a.magenta
  const subtitle =
    role === 'developer'
      ? `${a.dim}Build bold — ship specs that match the code.${a.reset}`
      : `${a.dim}Steer the merge — align people, priorities, and the baseline.${a.reset}`

  const g = a.green
  const y = a.yellow
  const c = a.cyan
  const m = a.magenta
  const b = a.bold
  const bl = a.blue
  const d = a.dim
  const R = a.reset

  // ASCII art welcome: waves + boxed title (7-bit safe)
  const block = [
    '',
    `  ${bl}      ${d}~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~${R}`,
    `  ${g}    ╔══════════════════════════════════════════╗${R}`,
    `  ${g}    ║${R}                                          ${g}║${R}`,
    `  ${g}    ║${R}    ${b}${y}>${R}${b}${y}>${R}${b}${y}>${R}  ${b}${y}R E O P E N   S P E C${R}  ${b}${y}<${R}${b}${y}<${R}${b}${y}<${R}     ${g}║${R}`,
    `  ${g}    ║${R}                                          ${g}║${R}`,
    `  ${g}    ║${R}       ${d}--- welcome aboard, spec pilot ---${R}      ${g}║${R}`,
    `  ${g}    ║${R}                                          ${g}║${R}`,
    `  ${g}    ╠══════════════════════════════════════════╣${R}`,
    `  ${g}    ║${R}  ${c}specs${R} ${d}·${R} ${m}baseline${R} ${d}·${R} ${y}drift${R} ${d}·${R} ${bl}you${R}  ${d}::::::::::::${R}  ${g}║${R}`,
    `  ${g}    ╚══════════════════════════════════════════╝${R}`,
    `  ${bl}      ${d}~v~v~v~v~v~v~v~v~v~v~v~v~v~v~v~${R}`,
    '',
    `       ${heroEmoji}  ${b}${heroName}${R}  ${d}—${R}  ${roleTint}${role}${R}`,
    '',
    `       ${subtitle}`,
    '',
  ]
  if (ideTargets !== undefined && ideTargets.length > 0) {
    const labels = ideTargets
      .map((id) => IDE_CATALOG.find((c) => c.id === id)?.label ?? id)
      .join(`${d}, ${R}`)
    block.push(`       ${d}IDE skill targets:${R} ${c}${labels}${R}`)
    block.push('')
  }
  process.stdout.write(block.join('\n') + '\n')
}
