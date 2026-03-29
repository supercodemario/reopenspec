import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { BaselineNode, BaselineEdge } from '../baseline.js'
import type { ParserAdapter } from './types.js'

export const PhpParser: ParserAdapter = {
  language: 'PHP',
  profileName: 'php',
  extensions: ['.php'],
  ignore: ['**/vendor/**'],
  scanAsync: async (absPath: string, workspaceRoot: string) => {
    const relFile = relative(workspaceRoot, absPath).replace(/\\/g, '/')
    const src = readFileSync(absPath, 'utf8')
    const nodes: BaselineNode[] = []
    const edges: BaselineEdge[] = []

    const lines = src.split(/\r?\n/)
    let currentNamespace = ''
    let depth = 0

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]!
        const lineNum = i + 1
        // naive comment strip (only line comments)
        const line = raw.split('//')[0] ?? raw

        const nsPat = /^\s*namespace\s+([\w\\]+)\s*;/
        let mm = nsPat.exec(line)
        if (mm) {
            currentNamespace = mm[1]!
            continue
        }

        const usePat = /^\s*use\s+([\w\\]+)(?:\s+as\s+(\w+))?\s*;/
        mm = usePat.exec(line)
        if (mm) {
            const mod = mm[1]!
            const id = `${relFile}:${lineNum}:import:${mod}`
            if (!edges.some((e) => e.id === id)) {
                edges.push({ id, kind: 'imports', fromFile: relFile, line: lineNum, moduleSpecifier: mod, names: [] })
            }
            continue
        }

        const classPat = /^\s*(?:abstract\s+|final\s+)?class\s+(\w+)/
        mm = classPat.exec(line)
        if (mm && depth === 0) {
            const name = currentNamespace ? `${currentNamespace}\\${mm[1]}` : mm[1]!
            nodes.push({ id: `${relFile}:${lineNum}:export.class:${name}`, kind: 'export.class', name, file: relFile, line: lineNum, column: 1 })
            depth += braceDelta(line)
            continue
        }

        const interfacePat = /^\s*interface\s+(\w+)/
        mm = interfacePat.exec(line)
        if (mm && depth === 0) {
            const name = currentNamespace ? `${currentNamespace}\\${mm[1]}` : mm[1]!
            nodes.push({ id: `${relFile}:${lineNum}:export.interface:${name}`, kind: 'export.interface', name, file: relFile, line: lineNum, column: 1 })
            depth += braceDelta(line)
            continue
        }
        
        const traitPat = /^\s*trait\s+(\w+)/
        mm = traitPat.exec(line)
        if (mm && depth === 0) {
            const name = currentNamespace ? `${currentNamespace}\\${mm[1]}` : mm[1]!
            nodes.push({ id: `${relFile}:${lineNum}:export.type:${name}`, kind: 'export.type', name, file: relFile, line: lineNum, column: 1 })
            depth += braceDelta(line)
            continue
        }

        const fnPat = /^\s*(?:public\s+|protected\s+)(?:static\s+)?function\s+(\w+)\s*\(/
        mm = fnPat.exec(line)
        if (mm && depth > 0) {
            nodes.push({ id: `${relFile}:${lineNum}:export.function:${mm[1]}`, kind: 'export.function', name: mm[1]!, file: relFile, line: lineNum, column: 1 })
        }

        depth += braceDelta(line)
        if (depth < 0) depth = 0
    }

    return { nodes, edges }
  }
}

function braceDelta(line: string): number {
    let d = 0
    for (const ch of line) {
      if (ch === '{') d++
      else if (ch === '}') d--
    }
    return d
}
