import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { BaselineNode, BaselineEdge } from '../baseline.js'
import type { ParserAdapter } from './types.js'

export const PythonParser: ParserAdapter = {
  language: 'Python',
  profileName: 'python',
  extensions: ['.py'],
  ignore: ['**/__pycache__/**', '**/.pytest_cache/**', '**/.venv/**'],
  scanAsync: async (absPath: string, workspaceRoot: string) => {
    const relFile = relative(workspaceRoot, absPath).replace(/\\/g, '/')
    const src = readFileSync(absPath, 'utf8')
    const nodes: BaselineNode[] = []
    const edges: BaselineEdge[] = []
    
    const lines = src.split(/\r?\n/)
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const lineNum = i + 1

        const importPat = /^\s*import\s+([a-zA-Z0-9_., ]+)/
        let mm = importPat.exec(line)
        if (mm && !line.includes('"""') && !line.includes("'''")) {
            const mods = mm[1]!.split(',').map(s => s.trim().split(' as ')[0]!.trim())
            for (const mod of mods) {
                if (!mod) continue
                const id = `${relFile}:${lineNum}:import:${mod}`
                if (!edges.some((e) => e.id === id)) {
                    edges.push({ id, kind: 'imports', fromFile: relFile, line: lineNum, moduleSpecifier: mod, names: [] })
                }
            }
        }

        const fromPat = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_.,* ]+)/
        mm = fromPat.exec(line)
        if (mm) {
            const mod = mm[1]!
            const id = `${relFile}:${lineNum}:import:${mod}`
            if (!edges.some((e) => e.id === id)) {
                edges.push({ id, kind: 'imports', fromFile: relFile, line: lineNum, moduleSpecifier: mod, names: [] })
            }
        }

        const classPat = /^\s*class\s+([a-zA-Z0-9_]+)/
        mm = classPat.exec(line)
        if (mm) {
            const col = firstNonWsCol(line)
            nodes.push({ id: `${relFile}:${lineNum}:export.class:${mm[1]}`, kind: 'export.class', name: mm[1]!, file: relFile, line: lineNum, column: col })
            continue
        }

        const defPat = /^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/
        mm = defPat.exec(line)
        if (mm) {
            const col = firstNonWsCol(line)
            // Skip dunder methods except init if desired, but let's include all to be safe and let contracts filter.
            if (!mm[1]!.startsWith('__') || mm[1] === '__init__') {
                nodes.push({ id: `${relFile}:${lineNum}:export.function:${mm[1]}`, kind: 'export.function', name: mm[1]!, file: relFile, line: lineNum, column: col })
            }
            continue
        }
    }

    return { nodes, edges }
  }
}

function firstNonWsCol(s: string): number {
    const m = /^\s*/.exec(s)
    return (m?.[0].length ?? 0) + 1
}
