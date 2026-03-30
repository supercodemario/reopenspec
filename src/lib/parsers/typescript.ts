import { readFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { Lang, parseAsync, pattern } from '@ast-grep/napi'
import type { SgNode } from '@ast-grep/napi'
import type { BaselineNode, BaselineEdge } from '../baseline.js'
import type { ParserAdapter } from './types.js'

function langForFile(file: string): Lang {
  // Use Tsx strictly since it flawlessly parses vanilla JS, TS, and JSX interchangeably!
  return Lang.Tsx
}

function lineCol(node: SgNode): { line: number; column: number } {
  const r = node.range().start
  return { line: r.line + 1, column: r.column + 1 }
}

function nodeId(file: string, line: number, kind: string, name: string): string {
  return `${file}:${line}:${kind}:${name}`
}

function safeGetMatchText(node: SgNode, key: string): string | null {
  const m = node.getMatch(key)
  return m ? m.text() : null
}

function parseNamedImportNames(bindingText: string): string[] {
  const inner = bindingText.trim().replace(/^\{|\}$/g, '').trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.split(/\s+as\s+/i)[0]?.trim() ?? '')
    .filter(Boolean)
}

function importStatementText(n: SgNode): string {
  let cur: SgNode | null = n
  for (let i = 0; i < 8 && cur; i++) {
    if (cur.kind() === 'import_statement') return cur.text()
    cur = cur.parent()
  }
  return n.text()
}

function namesFromNamedImportNode(n: SgNode): string[] {
  const full = importStatementText(n)
  const m = full.match(/import\s*\{([^}]*)\}\s*from/s)
  if (!m) return []
  return parseNamedImportNames(`{${m[1]}}`)
}

export const TypeScriptParser: ParserAdapter = {
  language: 'TypeScript / JavaScript',
  profileName: 'typescript',
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  ignore: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
  scanAsync: async (absPath: string, workspaceRoot: string) => {
    const lang = langForFile(absPath)
    const rel = relative(workspaceRoot, absPath).replace(/\\/g, '/')
    const src = readFileSync(absPath, 'utf8')
    const nodes: BaselineNode[] = []
    const edges: BaselineEdge[] = []

    const root = await parseAsync(lang, src)
    const ast = root.root()

    const pExportClass = pattern(lang, 'export class $NAME $$$ { $$$ }')
    const pExportInterface = pattern(lang, 'export interface $NAME { $$$ }')
    const pExportFunction = pattern(lang, 'export function $NAME ( $$$ )')
    const pExportType = pattern(lang, 'export type $NAME = $$$')
    const importBundles = [
      {
        def: pattern(lang, 'import $NAME from "$PATH"'),
        named: pattern(lang, 'import { $$$ } from "$PATH"'),
        ns: pattern(lang, 'import * as $NAME from "$PATH"'),
      },
      {
        def: pattern(lang, "import $NAME from '$PATH'"),
        named: pattern(lang, "import { $$$ } from '$PATH'"),
        ns: pattern(lang, "import * as $NAME from '$PATH'"),
      },
    ]

    for (const n of ast.findAll(pExportClass)) {
      const name = safeGetMatchText(n, 'NAME') ?? ''
      const { line, column } = lineCol(n)
      nodes.push({ id: nodeId(rel, line, 'export.class', name), kind: 'export.class', name: name || null, file: rel, line, column })
    }
    for (const n of ast.findAll(pExportInterface)) {
      const name = safeGetMatchText(n, 'NAME') ?? ''
      const { line, column } = lineCol(n)
      nodes.push({ id: nodeId(rel, line, 'export.interface', name), kind: 'export.interface', name: name || null, file: rel, line, column })
    }
    for (const n of ast.findAll(pExportFunction)) {
      const name = safeGetMatchText(n, 'NAME') ?? ''
      const { line, column } = lineCol(n)
      nodes.push({ id: nodeId(rel, line, 'export.function', name), kind: 'export.function', name: name || null, file: rel, line, column })
    }
    for (const n of ast.findAll(pExportType)) {
      const name = safeGetMatchText(n, 'NAME') ?? ''
      const { line, column } = lineCol(n)
      nodes.push({ id: nodeId(rel, line, 'export.type', name), kind: 'export.type', name: name || null, file: rel, line, column })
    }

    const pExportDefaultClass = pattern(lang, 'export default class $NAME $$$ { $$$ }')
    const pExportDefaultFn = pattern(lang, 'export default function $NAME ( $$$ )')
    for (const n of ast.findAll(pExportDefaultClass)) {
      const name = safeGetMatchText(n, 'NAME') ?? ''
      const { line, column } = lineCol(n)
      nodes.push({ id: nodeId(rel, line, 'export.class', name), kind: 'export.class', name: name || null, file: rel, line, column })
    }
    for (const n of ast.findAll(pExportDefaultFn)) {
      const name = safeGetMatchText(n, 'NAME') ?? ''
      const { line, column } = lineCol(n)
      nodes.push({ id: nodeId(rel, line, 'export.function', name), kind: 'export.function', name: name || null, file: rel, line, column })
    }

    for (const im of importBundles) {
      for (const n of ast.findAll(im.named)) {
        const mod = safeGetMatchText(n, 'PATH') ?? ''
        const { line } = lineCol(n)
        const names = namesFromNamedImportNode(n)
        const id = `${rel}:${line}:import:${mod}`
        if (!edges.some((e) => e.id === id)) {
          edges.push({ id, kind: 'imports', fromFile: rel, line, moduleSpecifier: mod, names: [...new Set(names)] })
        }
      }
      for (const n of ast.findAll(im.ns)) {
        const mod = safeGetMatchText(n, 'PATH') ?? ''
        const bind = safeGetMatchText(n, 'NAME') ?? '*'
        const { line } = lineCol(n)
        const id = `${rel}:${line}:import:${mod}`
        if (!edges.some((e) => e.id === id)) {
          edges.push({ id, kind: 'imports', fromFile: rel, line, moduleSpecifier: mod, names: [bind] })
        }
      }
      for (const n of ast.findAll(im.def)) {
        const mod = safeGetMatchText(n, 'PATH') ?? ''
        const bind = safeGetMatchText(n, 'NAME') ?? ''
        const { line } = lineCol(n)
        const id = `${rel}:${line}:import:${mod}`
        if (!edges.some((e) => e.id === id)) {
          edges.push({ id, kind: 'imports', fromFile: rel, line, moduleSpecifier: mod, names: bind ? [bind] : [] })
        }
      }
    }

    return { nodes, edges }
  }
}
