import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { BaselineEdge, BaselineNode } from './baseline.js'

export type BaselineModule = {
  id: string
  path: string
  language: string
  exports: string[]
  depends_on: string[]
}

export type BaselineInterface = {
  id: string
  module: string
  methods: Array<{
    name: string
    params: Array<{ name: string; type: string }>
    returns?: string
    mutates?: string[]
  }>
}

export type ApiEntryPoint = {
  id: string
  handler: string
  module: string
  calls: string[]
}

export type DependencyGraph = {
  nodes: string[]
  edges: Array<{ from: string; to: string }>
}

export function moduleIdFromRelFile(relFile: string): string {
  return relFile.replace(/\\/g, '/').replace(/\.(tsx?|jsx?|mjs|cjs|dart)$/, '')
}

function resolveRelativeImport(
  workspaceRoot: string,
  fromFile: string,
  spec: string,
): string | null {
  if (!spec.startsWith('.')) return null
  const fromDir = dirname(join(workspaceRoot, fromFile))
  const base = resolve(fromDir, spec)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.dart`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.dart'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) {
      const rel = relative(workspaceRoot, c).replace(/\\/g, '/')
      if (!rel.startsWith('..')) return rel
    }
  }
  return null
}

function interfacesFromNodes(nodes: BaselineNode[], modules: BaselineModule[]): BaselineInterface[] {
  const pathToModuleId = new Map(modules.map((m) => [m.path, m.id] as const))
  const out: BaselineInterface[] = []
  for (const n of nodes) {
    if (n.kind !== 'export.class' && n.kind !== 'export.interface') continue
    if (!n.name) continue
    const modId = pathToModuleId.get(n.file) ?? moduleIdFromRelFile(n.file)
    out.push({
      id: n.name,
      module: modId,
      methods: [],
    })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export function deriveModulesGraphAndInterfaces(
  workspaceRoot: string,
  nodes: BaselineNode[],
  edges: BaselineEdge[],
): {
  modules: BaselineModule[]
  interfaces: BaselineInterface[]
  dependency_graph: DependencyGraph
} {
  const byFile = new Map<string, BaselineNode[]>()
  for (const n of nodes) {
    const f = n.file.replace(/\\/g, '/')
    const arr = byFile.get(f) ?? []
    arr.push(n)
    byFile.set(f, arr)
  }

  const modules: BaselineModule[] = []
  const moduleIds = new Set<string>()

  for (const [file, fileNodes] of byFile) {
    const id = moduleIdFromRelFile(file)
    moduleIds.add(id)
    const exports = fileNodes
      .map((n) => n.name)
      .filter((x): x is string => x !== null && x !== '')
    const language = file.endsWith('.dart') ? 'dart' : 'typescript'
    modules.push({
      id,
      path: file,
      language,
      exports,
      depends_on: [],
    })
  }

  const depMap = new Map<string, Set<string>>()
  for (const m of modules) depMap.set(m.id, new Set())

  for (const e of edges) {
    if (e.kind !== 'imports') continue
    const fromFile = e.fromFile.replace(/\\/g, '/')
    const fromId = moduleIdFromRelFile(fromFile)
    const resolved = resolveRelativeImport(workspaceRoot, fromFile, e.moduleSpecifier)
    if (!resolved) continue
    const toId = moduleIdFromRelFile(resolved)
    if (!moduleIds.has(toId)) continue
    depMap.get(fromId)?.add(toId)
  }

  for (const m of modules) {
    m.depends_on = [...(depMap.get(m.id) ?? [])].sort()
  }

  const graphNodes = [...moduleIds].sort()
  const graphEdges: Array<{ from: string; to: string }> = []
  for (const [from, tos] of depMap) {
    for (const to of tos) {
      graphEdges.push({ from, to })
    }
  }
  graphEdges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

  const interfaces = interfacesFromNodes(nodes, modules)

  return {
    modules,
    interfaces,
    dependency_graph: { nodes: graphNodes, edges: graphEdges },
  }
}
