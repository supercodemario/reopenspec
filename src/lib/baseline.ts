import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
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
import { getGitHeadCommit } from './git.js'

import { TypeScriptParser } from './parsers/typescript.js'
import { DartParser } from './parsers/dart.js'
import { CSharpParser } from './parsers/csharp.js'
import { PythonParser } from './parsers/python.js'
import { PhpParser } from './parsers/php.js'
import type { ParserAdapter } from './parsers/types.js'

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

const ADAPTERS: ParserAdapter[] = [
  TypeScriptParser,
  DartParser,
  CSharpParser,
  PythonParser,
  PhpParser,
]

export async function buildBaseline(workspaceRoot: string): Promise<ArchBaseline> {
  const root = resolve(workspaceRoot)
  const languageProfile = detectLanguageProfile(root)

  const allNodes: BaselineNode[] = []
  const allEdges: BaselineEdge[] = []
  const parseErrors: ArchBaseline['parseErrors'] = []
  const scannedLanguages: string[] = []

  // Check if we have an adapter for the detected primary language
  const hasProfileAdapter = ADAPTERS.some((a) => a.profileName === languageProfile.primary)
  if (!hasProfileAdapter && languageProfile.primary !== 'unknown') {
    parseErrors.push({
      file: '.',
      message: `Warning: No parser adapter registered for detected primary language: ${languageProfile.primary}`,
    })
  }

  for (const adapter of ADAPTERS) {
    const globPatterns = adapter.extensions.map(ext => `**/*${ext}`)
    const ignores = [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
      '**/vendor/**',
      '**/var/**',
      '**/.venv/**',
      '**/venv/**',
      '**/.tox/**',
      '**/__pycache__/**',
      '**/.pytest_cache/**',
      '**/.cache/**',
      '**/cache/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/bin/**',
      '**/obj/**',
      '**/.dart_tool/**',
      '**/build/**'
    ]
    if (adapter.ignore && adapter.ignore.length > 0) {
      ignores.push(...adapter.ignore)
    }

    const files = await fg(globPatterns, {
      cwd: root,
      onlyFiles: true,
      dot: false,
      ignore: ignores,
    })

    if (files.length > 0) {
      scannedLanguages.push(adapter.profileName)
      for (const f of files) {
        const abs = resolve(root, f)
        try {
          const { nodes, edges } = await adapter.scanAsync(abs, root)
          allNodes.push(...nodes)
          allEdges.push(...edges)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          parseErrors.push({ file: relative(root, abs).replace(/\\/g, '/'), message })
        }
      }
    }
  }

  return assembleBaseline(root, languageProfile, allNodes, allEdges, parseErrors, scannedLanguages)
}
