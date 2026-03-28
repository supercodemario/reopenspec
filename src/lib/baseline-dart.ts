import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { BaselineEdge, BaselineNode } from './baseline.js'

/** Heuristic Dart/Flutter scan (no tree-sitter): imports + top-level declarations. */
export function scanDartFileSync(absPath: string, workspaceRoot: string): { nodes: BaselineNode[]; edges: BaselineEdge[] } {
  const rel = relative(workspaceRoot, absPath).replace(/\\/g, '/')
  const src = readFileSync(absPath, 'utf8')
  return scanDartSource(rel, src)
}

export function scanDartSource(relFile: string, src: string): { nodes: BaselineNode[]; edges: BaselineEdge[] } {
  const nodes: BaselineNode[] = []
  const edges: BaselineEdge[] = []

  const importRe = /^\s*(?:import|export)\s+['"]([^'"]+)['"]/gm
  let m: RegExpExecArray | null
  while ((m = importRe.exec(src)) !== null) {
    const mod = m[1] ?? ''
    const line = lineNumberAtIndex(src, m.index)
    const id = `${relFile}:${line}:import:${mod}`
    if (!edges.some((e) => e.id === id)) {
      edges.push({
        id,
        kind: 'imports',
        fromFile: relFile,
        line,
        moduleSpecifier: mod,
        names: [],
      })
    }
  }

  let depth = 0
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    const lineNum = i + 1
    const line = raw.split('//')[0] ?? raw

    if (depth === 0) {
      const col = firstNonWsCol(raw)
      const tryDecl = (kind: BaselineNode['kind'], name: string, colPos: number) => {
        if (!name) return
        nodes.push({
          id: `${relFile}:${lineNum}:${kind}:${name}`,
          kind,
          name,
          file: relFile,
          line: lineNum,
          column: colPos,
        })
      }

      let mm: RegExpExecArray | null
      const classPat = /^\s*(?:abstract\s+)?class\s+(\w+)/
      if ((mm = classPat.exec(line))) {
        tryDecl('export.class', mm[1]!, col)
        depth += braceDelta(line)
        continue
      }
      const mixinPat = /^\s*mixin\s+(\w+)/
      if ((mm = mixinPat.exec(line))) {
        tryDecl('export.class', mm[1]!, col)
        depth += braceDelta(line)
        continue
      }
      const extPat = /^\s*extension\s+(\w+)\s+on\s+/
      if ((mm = extPat.exec(line))) {
        tryDecl('export.class', mm[1]!, col)
        depth += braceDelta(line)
        continue
      }
      const enumPat = /^\s*enum\s+(\w+)/
      if ((mm = enumPat.exec(line))) {
        tryDecl('export.type', mm[1]!, col)
        depth += braceDelta(line)
        continue
      }
      const typedefPat = /^\s*typedef\s+(\w+)\s*=/
      if ((mm = typedefPat.exec(line))) {
        tryDecl('export.type', mm[1]!, col)
        depth += braceDelta(line)
        continue
      }
      const fnPat =
        /^\s*(?:@\w+(?:\.\w+)?(?:\([^)]*\))?\s*)*(?:async\s+)?(?:Future(?:<[^>]+>)?|void|int|double|bool|String|dynamic|Never|Iterable|List|Map|Set|Stream|Uint8List|Widget|Element|\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/
      if ((mm = fnPat.exec(line))) {
        tryDecl('export.function', mm[1]!, col)
        depth += braceDelta(line)
        continue
      }
    }

    depth += braceDelta(line)
    if (depth < 0) depth = 0
  }

  return { nodes, edges }
}

function firstNonWsCol(s: string): number {
  const m = /^\s*/.exec(s)
  return (m?.[0].length ?? 0) + 1
}

function braceDelta(line: string): number {
  let d = 0
  for (const ch of line) {
    if (ch === '{') d++
    else if (ch === '}') d--
  }
  return d
}

function lineNumberAtIndex(src: string, index: number): number {
  let n = 1
  for (let i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) n++
  }
  return n
}
