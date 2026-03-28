import { readFileSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { Lang, parseAsync, pattern } from '@ast-grep/napi'
import type { SgNode } from '@ast-grep/napi'
import fg from 'fast-glob'
import { deriveModulesGraphAndInterfaces } from './baseline-modules.js'
import type {
  ApiEntryPoint,
  BaselineInterface,
  BaselineModule,
  DependencyGraph,
} from './baseline-modules.js'
import type { LanguageProfile } from './detect-profile.js'
import { detectLanguageProfile } from './detect-profile.js'
import { scanDartFileSync } from './baseline-dart.js'
import { getGitHeadCommit } from './git.js'

export type BaselineNodeKind =
  | 'export.class'
  | 'export.interface'
  | 'export.function'
  | 'export.type'

export type BaselineNode = {
  id: string
  kind: BaselineNodeKind
  name: string | null
  file: string
  line: number
  column: number
}

export type BaselineEdge = {
  id: string
  kind: 'imports'
  fromFile: string
  line: number
  moduleSpecifier: string
  /** Raw matched import names when available (named imports are summarized). */
  names: string[]
}

export type ArchBaseline = {
  schemaVersion: '0.2.0'
  meta: {
    version: string
    generated_at: string
    commit_hash: string
    languages: string[]
  }
  generatedAt: string
  workspaceRoot: string
  languageProfile: ReturnType<typeof detectLanguageProfile>
  modules: BaselineModule[]
  interfaces: BaselineInterface[]
  api_entry_points: ApiEntryPoint[]
  dependency_graph: DependencyGraph
  nodes: BaselineNode[]
  edges: BaselineEdge[]
  parseErrors: Array<{ file: string; message: string }>
}

type ArchBaselineV01 = {
  schemaVersion: '0.1.0'
  generatedAt: string
  workspaceRoot: string
  languageProfile: LanguageProfile
  nodes: BaselineNode[]
  edges: BaselineEdge[]
  parseErrors: Array<{ file: string; message: string }>
}

function languagesFromProfile(lp: LanguageProfile): string[] {
  if (lp.primary === 'unknown') return []
  return [lp.primary]
}

function assembleBaseline(
  root: string,
  languageProfile: LanguageProfile,
  allNodes: BaselineNode[],
  allEdges: BaselineEdge[],
  parseErrors: ArchBaseline['parseErrors'],
  scannedLanguages?: string[],
): ArchBaseline {
  const generatedAt = new Date().toISOString()
  const commitHash = getGitHeadCommit(root) ?? ''
  const { modules, interfaces, dependency_graph } = deriveModulesGraphAndInterfaces(root, allNodes, allEdges)
  const metaLangs =
    scannedLanguages && scannedLanguages.length > 0
      ? [...new Set(scannedLanguages)].sort()
      : languagesFromProfile(languageProfile)
  return {
    schemaVersion: '0.2.0',
    meta: {
      version: '1',
      generated_at: generatedAt,
      commit_hash: commitHash,
      languages: metaLangs,
    },
    generatedAt,
    workspaceRoot: root,
    languageProfile,
    modules,
    interfaces,
    api_entry_points: [],
    dependency_graph,
    nodes: allNodes,
    edges: allEdges,
    parseErrors,
  }
}

function langForFile(file: string): Lang {
  return basename(file).endsWith('.tsx') ? Lang.Tsx : Lang.TypeScript
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

/** Parse `import { A, B }` binding text into identifier names. */
function parseNamedImportNames(bindingText: string): string[] {
  const inner = bindingText.trim().replace(/^\{|\}$/g, '').trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.split(/\s+as\s+/i)[0]?.trim() ?? '')
    .filter(Boolean)
}

/** Prefer the full `import_statement` node; pattern matches can be a narrower subtree. */
function importStatementText(n: SgNode): string {
  let cur: SgNode | null = n
  for (let i = 0; i < 8 && cur; i++) {
    if (cur.kind() === 'import_statement') return cur.text()
    cur = cur.parent()
  }
  return n.text()
}

/** Resolve named imports from the full import statement text (avoids bad $$$ splits). */
function namesFromNamedImportNode(n: SgNode): string[] {
  const full = importStatementText(n)
  const m = full.match(/import\s*\{([^}]*)\}\s*from/s)
  if (!m) return []
  return parseNamedImportNames(`{${m[1]}}`)
}

async function scanTsFileAsync(
  absPath: string,
  workspaceRoot: string,
): Promise<{ nodes: BaselineNode[]; edges: BaselineEdge[] }> {
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
    nodes.push({
      id: nodeId(rel, line, 'export.class', name),
      kind: 'export.class',
      name: name || null,
      file: rel,
      line,
      column,
    })
  }
  for (const n of ast.findAll(pExportInterface)) {
    const name = safeGetMatchText(n, 'NAME') ?? ''
    const { line, column } = lineCol(n)
    nodes.push({
      id: nodeId(rel, line, 'export.interface', name),
      kind: 'export.interface',
      name: name || null,
      file: rel,
      line,
      column,
    })
  }
  for (const n of ast.findAll(pExportFunction)) {
    const name = safeGetMatchText(n, 'NAME') ?? ''
    const { line, column } = lineCol(n)
    nodes.push({
      id: nodeId(rel, line, 'export.function', name),
      kind: 'export.function',
      name: name || null,
      file: rel,
      line,
      column,
    })
  }
  for (const n of ast.findAll(pExportType)) {
    const name = safeGetMatchText(n, 'NAME') ?? ''
    const { line, column } = lineCol(n)
    nodes.push({
      id: nodeId(rel, line, 'export.type', name),
      kind: 'export.type',
      name: name || null,
      file: rel,
      line,
      column,
    })
  }

  const pExportDefaultClass = pattern(lang, 'export default class $NAME $$$ { $$$ }')
  const pExportDefaultFn = pattern(lang, 'export default function $NAME ( $$$ )')
  for (const n of ast.findAll(pExportDefaultClass)) {
    const name = safeGetMatchText(n, 'NAME') ?? ''
    const { line, column } = lineCol(n)
    nodes.push({
      id: nodeId(rel, line, 'export.class', name),
      kind: 'export.class',
      name: name || null,
      file: rel,
      line,
      column,
    })
  }
  for (const n of ast.findAll(pExportDefaultFn)) {
    const name = safeGetMatchText(n, 'NAME') ?? ''
    const { line, column } = lineCol(n)
    nodes.push({
      id: nodeId(rel, line, 'export.function', name),
      kind: 'export.function',
      name: name || null,
      file: rel,
      line,
      column,
    })
  }

  for (let bi = 0; bi < importBundles.length; bi++) {
    const im = importBundles[bi]!
    // Named and namespace imports before default — otherwise `import $NAME from 'm'`
    // can match `import { ... } from 'm'` with $NAME spanning the brace clause.
    for (const n of ast.findAll(im.named)) {
      const mod = safeGetMatchText(n, 'PATH') ?? ''
      const { line } = lineCol(n)
      const names = namesFromNamedImportNode(n)
      const id = `${rel}:${line}:import:${mod}`
      if (edges.some((e) => e.id === id)) continue
      edges.push({
        id,
        kind: 'imports',
        fromFile: rel,
        line,
        moduleSpecifier: mod,
        names: [...new Set(names)],
      })
    }
    for (const n of ast.findAll(im.ns)) {
      const mod = safeGetMatchText(n, 'PATH') ?? ''
      const bind = safeGetMatchText(n, 'NAME') ?? '*'
      const { line } = lineCol(n)
      const id = `${rel}:${line}:import:${mod}`
      if (edges.some((e) => e.id === id)) continue
      edges.push({
        id,
        kind: 'imports',
        fromFile: rel,
        line,
        moduleSpecifier: mod,
        names: [bind],
      })
    }
    for (const n of ast.findAll(im.def)) {
      const mod = safeGetMatchText(n, 'PATH') ?? ''
      const bind = safeGetMatchText(n, 'NAME') ?? ''
      const { line } = lineCol(n)
      const id = `${rel}:${line}:import:${mod}`
      if (edges.some((e) => e.id === id)) continue
      edges.push({
        id,
        kind: 'imports',
        fromFile: rel,
        line,
        moduleSpecifier: mod,
        names: bind ? [bind] : [],
      })
    }
  }

  return { nodes, edges }
}

export function normalizeArchBaseline(raw: unknown): ArchBaseline {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid arch-baseline.json: expected object')
  const o = raw as Record<string, unknown>
  const sv = o.schemaVersion
  if (sv === '0.2.0') {
    return o as ArchBaseline
  }
  if (sv === '0.1.0') {
    const legacy = o as ArchBaselineV01
    const wr = legacy.workspaceRoot
    const nodes = legacy.nodes ?? []
    const edges = legacy.edges ?? []
    const { modules, interfaces, dependency_graph } = deriveModulesGraphAndInterfaces(wr, nodes, edges)
    return {
      schemaVersion: '0.2.0',
      meta: {
        version: '1',
        generated_at: legacy.generatedAt,
        commit_hash: '',
        languages: languagesFromProfile(legacy.languageProfile),
      },
      generatedAt: legacy.generatedAt,
      workspaceRoot: wr,
      languageProfile: legacy.languageProfile,
      modules,
      interfaces,
      api_entry_points: [],
      dependency_graph,
      nodes,
      edges,
      parseErrors: legacy.parseErrors ?? [],
    }
  }
  throw new Error(`Unsupported arch-baseline.json schemaVersion: ${String(sv)}`)
}

export function readBaselineFromFile(absPath: string): ArchBaseline {
  const raw = readFileSync(absPath, 'utf8')
  return normalizeArchBaseline(JSON.parse(raw) as unknown)
}

export async function buildBaseline(workspaceRoot: string): Promise<ArchBaseline> {
  const root = resolve(workspaceRoot)
  const languageProfile = detectLanguageProfile(root)

  const allNodes: BaselineNode[] = []
  const allEdges: BaselineEdge[] = []
  const parseErrors: ArchBaseline['parseErrors'] = []

  const tsFiles = await fg(['**/*.{ts,tsx}'], {
    cwd: root,
    onlyFiles: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
  })
  const dartFiles = await fg(['**/*.dart'], {
    cwd: root,
    onlyFiles: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/.dart_tool/**', '**/build/**'],
  })

  const scannedLanguages: string[] = []
  if (tsFiles.length > 0) scannedLanguages.push('typescript')
  if (dartFiles.length > 0) scannedLanguages.push('dart')

  if (languageProfile.manifests.length === 0 && tsFiles.length === 0 && dartFiles.length === 0) {
    return assembleBaseline(root, languageProfile, [], [], [], scannedLanguages)
  }

  if (
    languageProfile.primary === 'go' ||
    languageProfile.primary === 'rust' ||
    languageProfile.primary === 'python'
  ) {
    return assembleBaseline(root, languageProfile, [], [], [
      {
        file: '.',
        message: `Stage 1 scanner supports TypeScript and Dart; detected primary language: ${languageProfile.primary}`,
      },
    ], scannedLanguages)
  }

  for (const f of tsFiles) {
    const abs = resolve(root, f)
    try {
      const { nodes, edges } = await scanTsFileAsync(abs, root)
      allNodes.push(...nodes)
      allEdges.push(...edges)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      parseErrors.push({ file: relative(root, abs).replace(/\\/g, '/'), message })
    }
  }

  for (const f of dartFiles) {
    const abs = resolve(root, f)
    try {
      const { nodes, edges } = scanDartFileSync(abs, root)
      allNodes.push(...nodes)
      allEdges.push(...edges)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      parseErrors.push({ file: relative(root, abs).replace(/\\/g, '/'), message })
    }
  }

  return assembleBaseline(root, languageProfile, allNodes, allEdges, parseErrors, scannedLanguages)
}
