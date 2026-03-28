import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

const CONFIG_NAME = 'reopenspec.json'

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

class ConfigWebviewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = { enableScripts: true }
    webviewView.webview.html = this.html(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(async (msg: { type: string; json?: string }) => {
      const root = workspaceRoot()
      if (!root) {
        void vscode.window.showErrorMessage('No workspace folder')
        return
      }
      const p = path.join(root, CONFIG_NAME)
      if (msg.type === 'load') {
        let text = ''
        try {
          text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
        } catch {
          text = ''
        }
        void webviewView.webview.postMessage({ type: 'config', path: p, text })
        return
      }
      if (msg.type === 'save' && typeof msg.json === 'string') {
        try {
          JSON.parse(msg.json)
        } catch (e) {
          void vscode.window.showErrorMessage(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
          return
        }
        fs.writeFileSync(p, msg.json, 'utf8')
        void vscode.window.showInformationMessage(`Saved ${CONFIG_NAME}`)
        void webviewView.webview.postMessage({ type: 'saved' })
        return
      }
      if (msg.type === 'runSync') {
        runReo(['sync'], 'ReOpenSpec: sync')
      }
    })
  }

  private html(webview: vscode.Webview): string {
    const nonce = String(Math.random()).slice(2)
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); font-size: 13px; padding: 8px; color: var(--vscode-foreground); }
    label { display: block; margin-top: 8px; font-weight: 600; }
    textarea { width: 100%; box-sizing: border-box; min-height: 220px; font-family: var(--vscode-editor-font-family); font-size: 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
    button { margin-top: 10px; margin-right: 8px; padding: 6px 12px; cursor: pointer; }
    p.hint { opacity: 0.85; font-size: 12px; }
  </style>
</head>
<body>
  <p class="hint">Edit <code>${CONFIG_NAME}</code> at the workspace root. Paths are relative to the workspace unless absolute.</p>
  <label for="ta">JSON</label>
  <textarea id="ta" spellcheck="false"></textarea>
  <button id="save">Save</button>
  <button id="sync">Run reo sync</button>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const ta = document.getElementById('ta');
    document.getElementById('save').onclick = () => vscode.postMessage({ type: 'save', json: ta.value });
    document.getElementById('sync').onclick = () => vscode.postMessage({ type: 'runSync' });
    window.addEventListener('message', (ev) => {
      const m = ev.data;
      if (m.type === 'config') { ta.value = m.text || defaultJson(); }
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
