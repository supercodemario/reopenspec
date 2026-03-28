import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

const CONFIG_NAME = 'reopenspec.json'
const LOCAL_CONFIG_NAME = 'reopenspec.local.json'

/**
 * Duplicated from `src/lib/reopenspec-local-profile.ts` (extension cannot import the CLI package).
 * Do not edit here only — follow the checklist in that file’s header, then mirror values here
 * (`DEFAULT_ROLE_EMOJI`, `HERO_EMOJI_SUGGESTIONS`, and role `<option>` text in `html()`).
 */
const DEFAULT_ROLE_EMOJI: Record<'developer' | 'manager', string> = {
  developer: '🥷',
  manager: '🔀',
}

/** @see `HERO_EMOJI_SUGGESTIONS` in `src/lib/reopenspec-local-profile.ts` */
const HERO_EMOJI_SUGGESTIONS: readonly { emoji: string; meaning: string }[] = [
  { emoji: '🥷', meaning: 'Ninja — focused implementation and craft' },
  { emoji: '🔀', meaning: 'Merge — integration, alignment, and bringing branches together' },
  { emoji: '🧙‍♀️', meaning: 'Woman mage — collaboration and arcane architecture' },
  { emoji: '🧑‍💻', meaning: 'Technologist — builder at the keyboard' },
  { emoji: '🧑‍💼', meaning: 'Office worker — coordination and stakeholder rhythm' },
  { emoji: '🧑‍🔬', meaning: 'Scientist — tests, data, and spikes' },
  { emoji: '🧑‍🚀', meaning: 'Astronaut — shipping launches and exploration' },
  { emoji: '🧑‍✈️', meaning: 'Pilot — roadmaps and steering delivery' },
  { emoji: '🧑‍🎨', meaning: 'Artist — UX, visuals, and product craft' },
  { emoji: '🤖', meaning: 'Robot — automation, tooling, and systems' },
]

type LocalRole = 'developer' | 'manager'

function parseLocalFile(raw: unknown): {
  heroName: string
  role: LocalRole
  emoji?: string
} {
  if (!raw || typeof raw !== 'object') {
    return { heroName: '', role: 'developer' }
  }
  const o = raw as Record<string, unknown>
  let heroName = ''
  if (typeof o.heroName === 'string') heroName = o.heroName.trim()
  else if (typeof o.userName === 'string') heroName = o.userName.trim()
  let role: LocalRole = 'developer'
  if (o.role === 'manager' || o.role === 'developer') role = o.role
  let emoji: string | undefined
  if (typeof o.emoji === 'string') {
    const t = o.emoji.trim()
    if (t !== '') emoji = t
  }
  return { heroName, role, emoji }
}

function resolveEmoji(role: LocalRole, stored?: string): string {
  const t = stored?.trim()
  if (t) return t
  return DEFAULT_ROLE_EMOJI[role]
}

function writeLocalProfileFile(
  root: string,
  profile: { heroName: string; role: LocalRole; emoji?: string },
): void {
  const p = path.join(root, LOCAL_CONFIG_NAME)
  const name = profile.heroName.trim()
  if (name === '') {
    if (fs.existsSync(p)) fs.unlinkSync(p)
    return
  }
  const defaultEm = DEFAULT_ROLE_EMOJI[profile.role]
  const custom = profile.emoji?.trim()
  const body: Record<string, string> = { heroName: name, role: profile.role }
  if (custom && custom !== defaultEm) body.emoji = custom
  fs.writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
}

function workspaceRoot(): string | undefined {
  const f = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  return f
}

function reoCommandLine(root: string): { cmd: string; args: string[] } {
  const fromDep = path.join(root, 'node_modules', 'reopenspec', 'bin', 'run.js')
  const fromRepoRoot = path.join(root, 'bin', 'run.js')
  if (fs.existsSync(fromDep)) {
    return { cmd: process.execPath, args: [fromDep] }
  }
  if (fs.existsSync(fromRepoRoot)) {
    return { cmd: process.execPath, args: [fromRepoRoot] }
  }
  return { cmd: 'reo', args: [] }
}

export function deactivate(): void {}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ConfigWebviewProvider()
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('reopenspec.configPanel', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('reopenspec.openConfig', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.reopenspec.focus')
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('reopenspec.runSync', () => runReo(['sync'], 'ReOpenSpec: sync')),
  )
}

function runReo(extraArgs: string[], title: string): void {
  const root = workspaceRoot()
  if (!root) {
    void vscode.window.showWarningMessage('ReOpenSpec: open a folder first.')
    return
  }
  const { cmd, args } = reoCommandLine(root)
  const fullArgs = [...args, ...extraArgs]
  const channel = vscode.window.createOutputChannel(title)
  channel.show(true)
  channel.appendLine(`$ ${cmd} ${fullArgs.join(' ')}`)
  const child = cp.spawn(cmd, fullArgs, { cwd: root, env: process.env })
  child.stdout?.on('data', (d: Buffer) => channel.append(d.toString()))
  child.stderr?.on('data', (d: Buffer) => channel.append(d.toString()))
  child.on('close', (code) => {
    channel.appendLine(`exit ${code ?? 0}`)
    if (code !== 0) {
      void vscode.window.showErrorMessage(`reo exited with code ${code}`)
    } else {
      void vscode.window.showInformationMessage('reo sync finished')
    }
  })
}

type SaveMsg = {
  type: string
  json?: string
  heroName?: string
  role?: string
  emoji?: string
}

class ConfigWebviewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = { enableScripts: true }
    webviewView.webview.html = this.html(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(async (msg: SaveMsg) => {
      const root = workspaceRoot()
      if (!root) {
        void vscode.window.showErrorMessage('No workspace folder')
        return
      }
      const p = path.join(root, CONFIG_NAME)
      const localP = path.join(root, LOCAL_CONFIG_NAME)
      if (msg.type === 'load') {
        let text = ''
        try {
          text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
        } catch {
          text = ''
        }
        let heroName = ''
        let role: LocalRole = 'developer'
        let emojiEffective = DEFAULT_ROLE_EMOJI.developer
        try {
          if (fs.existsSync(localP)) {
            const loc = parseLocalFile(JSON.parse(fs.readFileSync(localP, 'utf8')) as unknown)
            heroName = loc.heroName
            role = loc.role
            emojiEffective = resolveEmoji(loc.role, loc.emoji)
          }
        } catch {
          /* keep defaults */
        }
        void webviewView.webview.postMessage({
          type: 'config',
          path: p,
          text,
          heroName,
          role,
          emoji: emojiEffective,
        })
        return
      }
      if (msg.type === 'save' && typeof msg.json === 'string') {
        let obj: unknown
        try {
          obj = JSON.parse(msg.json) as unknown
        } catch (e) {
          void vscode.window.showErrorMessage(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
          return
        }
        if (!obj || typeof obj !== 'object') {
          void vscode.window.showErrorMessage('JSON must be an object')
          return
        }
        const o = { ...(obj as Record<string, unknown>) }
        for (const k of ['userName', 'heroName', 'role', 'emoji']) delete o[k]
        const out = `${JSON.stringify(o, null, 2)}\n`
        fs.writeFileSync(p, out, 'utf8')

        const heroName = typeof msg.heroName === 'string' ? msg.heroName : ''
        const role: LocalRole = msg.role === 'manager' ? 'manager' : 'developer'
        const emoji = typeof msg.emoji === 'string' ? msg.emoji : ''
        writeLocalProfileFile(root, {
          heroName,
          role,
          emoji: emoji.trim() === '' ? undefined : emoji.trim(),
        })

        const hadLocal = heroName.trim() !== ''
        void vscode.window.showInformationMessage(
          `Saved ${CONFIG_NAME}` + (hadLocal ? ` and ${LOCAL_CONFIG_NAME}` : ''),
        )
        void webviewView.webview.postMessage({ type: 'saved' })
        return
      }
      if (msg.type === 'runSync') {
        runReo(['sync'], 'ReOpenSpec: sync')
      }
    })
  }

  private html(_webview: vscode.Webview): string {
    const nonce = String(Math.random()).slice(2)
    const suggestionsJson = JSON.stringify(HERO_EMOJI_SUGGESTIONS)
    // Role <option> labels below: default emojis must match DEFAULT_ROLE_EMOJI (sync with reopenspec-local-profile.ts).
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); font-size: 13px; padding: 8px; color: var(--vscode-foreground); }
    label { display: block; margin-top: 8px; font-weight: 600; }
    input[type="text"] { width: 100%; box-sizing: border-box; padding: 4px 6px; margin-top: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
    select { width: 100%; box-sizing: border-box; padding: 4px 6px; margin-top: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
    textarea { width: 100%; box-sizing: border-box; min-height: 200px; font-family: var(--vscode-editor-font-family); font-size: 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
    button { margin-top: 10px; margin-right: 8px; padding: 6px 12px; cursor: pointer; }
    p.hint { opacity: 0.85; font-size: 12px; }
    ul.emoji-picks { list-style: none; padding: 0; margin: 6px 0 0; max-height: 120px; overflow-y: auto; border: 1px solid var(--vscode-input-border); border-radius: 2px; }
    ul.emoji-picks li { margin: 0; border-bottom: 1px solid var(--vscode-input-border); }
    ul.emoji-picks li:last-child { border-bottom: none; }
    ul.emoji-picks button { width: 100%; text-align: left; margin: 0; border: none; background: var(--vscode-input-background); color: var(--vscode-input-foreground); padding: 6px 8px; font-size: 12px; }
    ul.emoji-picks button:hover { background: var(--vscode-list-hoverBackground); }
  </style>
</head>
<body>
  <p class="hint">Project JSON: <code>${CONFIG_NAME}</code> (commit). Hero profile: <code>${LOCAL_CONFIG_NAME}</code> (local only — add to <code>.gitignore</code>).</p>
  <label for="hero">Hero name (local only)</label>
  <input type="text" id="hero" placeholder="Your hero name" autocomplete="off" />
  <label for="role">User role</label>
  <select id="role">
    <option value="developer">Developer (default emoji 🥷)</option>
    <option value="manager">Manager (default emoji 🔀)</option>
  </select>
  <label for="em">Hero emoji (change anytime)</label>
  <input type="text" id="em" placeholder="One emoji" maxlength="8" />
  <label>Suggested emojis</label>
  <ul class="emoji-picks" id="picks"></ul>
  <label for="ta">JSON</label>
  <textarea id="ta" spellcheck="false"></textarea>
  <button id="save">Save</button>
  <button id="sync">Run reo sync</button>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const ta = document.getElementById('ta');
    const hero = document.getElementById('hero');
    const role = document.getElementById('role');
    const em = document.getElementById('em');
    const DEFAULT_ROLE_EMOJI = ${JSON.stringify(DEFAULT_ROLE_EMOJI)};
    const SUGGESTIONS = ${suggestionsJson};
    const picks = document.getElementById('picks');
    for (const s of SUGGESTIONS) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.emoji + ' — ' + s.meaning;
      b.onclick = () => { em.value = s.emoji; };
      li.appendChild(b);
      picks.appendChild(li);
    }
    role.addEventListener('change', () => {
      const r = role.value;
      em.value = DEFAULT_ROLE_EMOJI[r] || DEFAULT_ROLE_EMOJI.developer;
    });
    document.getElementById('save').onclick = () => vscode.postMessage({
      type: 'save',
      json: ta.value,
      heroName: hero.value,
      role: role.value,
      emoji: em.value
    });
    document.getElementById('sync').onclick = () => vscode.postMessage({ type: 'runSync' });
    window.addEventListener('message', (ev) => {
      const m = ev.data;
      if (m.type === 'config') {
        ta.value = m.text || defaultJson();
        hero.value = typeof m.heroName === 'string' ? m.heroName : '';
        role.value = m.role === 'manager' ? 'manager' : 'developer';
        em.value = typeof m.emoji === 'string' ? m.emoji : DEFAULT_ROLE_EMOJI[role.value];
      }
    });
    function defaultJson() {
      return JSON.stringify({
        version: '0.1.0',
        baselinePath: 'specs/.meta/arch-baseline.json',
        driftReportPath: 'specs/.meta/drift-report.json',
        specsDir: 'specs',
        strictUncovered: false
      }, null, 2);
    }
    vscode.postMessage({ type: 'load' });
  </script>
</body>
</html>`
  }
}
