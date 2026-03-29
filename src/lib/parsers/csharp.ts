import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { BaselineNode, BaselineEdge } from '../baseline.js'
import type { ParserAdapter } from './types.js'

export const CSharpParser: ParserAdapter = {
  language: 'C# / .NET',
  profileName: 'dotnet',
  extensions: ['.cs'],
  ignore: ['**/bin/**', '**/obj/**'],
  scanAsync: async (absPath: string, workspaceRoot: string) => {
    const relFile = relative(workspaceRoot, absPath).replace(/\\/g, '/')
    const src = readFileSync(absPath, 'utf8')
    const nodes: BaselineNode[] = []
    const edges: BaselineEdge[] = []

    const usingRe = /^\s*using\s+([\w.]+)\s*;/gm
    let m: RegExpExecArray | null
    while ((m = usingRe.exec(src)) !== null) {
      const mod = m[1] ?? ''
      const line = src.substring(0, m.index).split('\n').length
      const id = `${relFile}:${line}:import:${mod}`
      if (!edges.some((e) => e.id === id)) {
        edges.push({ id, kind: 'imports', fromFile: relFile, line, moduleSpecifier: mod, names: [] })
      }
    }

    const lines = src.split(/\r?\n/)
    let currentNamespace = ''
    let depth = 0

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]!
        const lineNum = i + 1
        // naive comment strip
        const line = raw.split('//')[0] ?? raw

        const nsPat = /^\s*namespace\s+([\w.]+)/
        let mm = nsPat.exec(line)
        if (mm) {
            currentNamespace = mm[1]!
        }

        const classPat = /^\s*(?:public\s+|internal\s+)?(?:abstract\s+|sealed\s+|static\s+)?(?:class|record|struct)\s+(\w+)/
        mm = classPat.exec(line)
        if (mm && depth <= 1) { // 1 if inside namespace {}
            const name = currentNamespace ? `${currentNamespace}.${mm[1]}` : mm[1]!
            nodes.push({ id: `${relFile}:${lineNum}:export.class:${name}`, kind: 'export.class', name, file: relFile, line: lineNum, column: 1 })
            depth += braceDelta(line)
            continue
        }

        const interfacePat = /^\s*(?:public\s+|internal\s+)?interface\s+(\w+)/
        mm = interfacePat.exec(line)
        if (mm && depth <= 1) {
            const name = currentNamespace ? `${currentNamespace}.${mm[1]}` : mm[1]!
            nodes.push({ id: `${relFile}:${lineNum}:export.interface:${name}`, kind: 'export.interface', name, file: relFile, line: lineNum, column: 1 })
            depth += braceDelta(line)
            continue
        }

        const fnPat = /^\s*(?:public\s+|internal\s+|protected\s+)(?:static\s+|virtual\s+|override\s+|async\s+)?[\w<>[\]]+\s+(\w+)\s*\(/
        mm = fnPat.exec(line)
        if (mm && depth > 0) { // inside class/interface
            // In C# methods are tied to classes, but we track as export.function for simplicity/drift validation
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
