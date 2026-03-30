import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type LanguageProfile = {
  primary: 'typescript' | 'dart' | 'go' | 'rust' | 'python' | 'php' | 'unknown'
  manifests: string[]
}

export type BackendStack = 'dotnet' | 'node' | 'php' | 'php/symfony' | 'python' | null
export type FrontendStack = 'vue' | 'react' | 'flutter' | null

export type StackProfile = {
  language: LanguageProfile
  backend: BackendStack
  frontend: FrontendStack
  hasDatabase: boolean
  hasDevops: boolean
  hasFigma: boolean
}

/** Root-level manifest hints (scanner: TypeScript + Dart). */
export function detectLanguageProfile(cwd: string): LanguageProfile {
  const manifests: string[] = []
  if (existsSync(join(cwd, 'package.json'))) manifests.push('package.json')
  if (existsSync(join(cwd, 'tsconfig.json'))) manifests.push('tsconfig.json')
  if (existsSync(join(cwd, 'pubspec.yaml'))) manifests.push('pubspec.yaml')
  if (existsSync(join(cwd, 'go.mod'))) manifests.push('go.mod')
  if (existsSync(join(cwd, 'Cargo.toml'))) manifests.push('Cargo.toml')
  if (existsSync(join(cwd, 'pyproject.toml'))) manifests.push('pyproject.toml')
  if (existsSync(join(cwd, 'requirements.txt'))) manifests.push('requirements.txt')
  if (existsSync(join(cwd, 'composer.json'))) manifests.push('composer.json')

  let primary: LanguageProfile['primary'] = 'unknown'
  if (manifests.includes('package.json') || manifests.includes('tsconfig.json')) {
    primary = 'typescript'
  } else if (manifests.includes('pubspec.yaml')) {
    primary = 'dart'
  } else if (manifests.includes('go.mod')) {
    primary = 'go'
  } else if (manifests.includes('Cargo.toml')) {
    primary = 'rust'
  } else if (manifests.includes('pyproject.toml') || manifests.includes('requirements.txt')) {
    primary = 'python'
  } else if (manifests.includes('composer.json')) {
    primary = 'php'
  }

  return { primary, manifests }
}

/** Check if any file matching a pattern exists in the root directory (non-recursive shallow check). */
function hasFileWithExtension(cwd: string, extension: string): boolean {
  try {
    return readdirSync(cwd).some((f) => f.endsWith(extension))
  } catch {
    return false
  }
}

/** Read package.json dependencies (dependencies + devDependencies) as a set of package names. */
function readPackageDeps(cwd: string): Set<string> {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return new Set()
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    const deps = Object.keys((pkg.dependencies ?? {}) as Record<string, string>)
    const devDeps = Object.keys((pkg.devDependencies ?? {}) as Record<string, string>)
    return new Set([...deps, ...devDeps])
  } catch {
    return new Set()
  }
}

/** Detect backend stack from project manifests. */
export function detectBackendStack(cwd: string): BackendStack {
  // .NET: .csproj or .sln files
  if (hasFileWithExtension(cwd, '.csproj') || hasFileWithExtension(cwd, '.sln')) {
    return 'dotnet'
  }
  // Also check common .NET directories
  if (existsSync(join(cwd, 'Program.cs')) || existsSync(join(cwd, 'Startup.cs'))) {
    return 'dotnet'
  }
  // Node: package.json with server-side indicators
  if (existsSync(join(cwd, 'package.json'))) {
    const deps = readPackageDeps(cwd)
    const serverDeps = ['express', '@nestjs/core', 'fastify', 'koa', 'hapi', '@hapi/hapi', 'next', 'nuxt']
    if (serverDeps.some((d) => deps.has(d))) {
      return 'node'
    }
  }
  // Python: pyproject.toml, requirements.txt, or manage.py
  if (
    existsSync(join(cwd, 'pyproject.toml')) ||
    existsSync(join(cwd, 'requirements.txt')) ||
    existsSync(join(cwd, 'manage.py')) ||
    existsSync(join(cwd, 'main.py'))
  ) {
    return 'python'
  }
  // PHP: composer.json, artisan, or index.php
  const composerPath = join(cwd, 'composer.json')
  if (existsSync(composerPath)) {
    try {
      const content = readFileSync(composerPath, 'utf8')
      if (content.includes('"symfony/')) {
        return 'php/symfony'
      }
    } catch { /* ignore */ }
    return 'php'
  }
  if (
    existsSync(join(cwd, 'artisan')) ||
    hasFileWithExtension(cwd, '.php')
  ) {
    return 'php'
  }
  return null
}

/** Detect frontend framework from project manifests and dependencies. */
export function detectFrontendStack(cwd: string): FrontendStack {
  const deps = readPackageDeps(cwd)
  // Vue detection: vue dependency or .vue files
  if (deps.has('vue') || deps.has('nuxt')) {
    return 'vue'
  }
  // React detection
  if (deps.has('react') || deps.has('next') || deps.has('react-dom')) {
    return 'react'
  }
  // Flutter detection: pubspec.yaml file
  if (existsSync(join(cwd, 'pubspec.yaml'))) {
    return 'flutter'
  }
  return null
}

/** Detect if the project uses a database (ORM / SQL / migration files). */
export function detectDatabase(cwd: string): boolean {
  const deps = readPackageDeps(cwd)
  const dbDeps = ['prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'sequelize', 'knex', 'pg', 'mysql2', 'better-sqlite3']
  if (dbDeps.some((d) => deps.has(d))) return true
  // .NET EF Core: check for Migrations directory
  if (existsSync(join(cwd, 'Migrations')) || existsSync(join(cwd, 'Data'))) return true
  // SQL files in root
  if (hasFileWithExtension(cwd, '.sql')) return true
  return false
}

/** Detect CI/CD configuration presence. */
export function detectDevops(cwd: string): boolean {
  return (
    existsSync(join(cwd, '.github', 'workflows')) ||
    existsSync(join(cwd, 'azure-pipelines.yml')) ||
    existsSync(join(cwd, '.gitlab-ci.yml')) ||
    existsSync(join(cwd, 'Dockerfile'))
  )
}

/** Detect Figma integration (MCP config or project YAML hints). */
export function detectFigma(cwd: string): boolean {
  // Check if figma MCP skill exists in project
  const figmaSkill = join(cwd, 'templates', 'skills', 'mcp-figma.md')
  if (existsSync(figmaSkill)) return true
  // Check .cursor/config.json for figma references
  const cursorConfig = join(cwd, '.cursor', 'config.json')
  if (existsSync(cursorConfig)) {
    try {
      const content = readFileSync(cursorConfig, 'utf8')
      if (content.toLowerCase().includes('figma')) return true
    } catch { /* ignore */ }
  }
  return false
}

/** Full stack detection — combines all detectors. */
export function detectStackProfile(cwd: string): StackProfile {
  return {
    language: detectLanguageProfile(cwd),
    backend: detectBackendStack(cwd),
    frontend: detectFrontendStack(cwd),
    hasDatabase: detectDatabase(cwd),
    hasDevops: detectDevops(cwd),
    hasFigma: detectFigma(cwd),
  }
}

/** True when the workspace looks like Dart and/or Flutter (pubspec / Flutter frontend). */
export function isDartOrFlutterStack(profile: StackProfile): boolean {
  return profile.language.primary === 'dart' || profile.frontend === 'flutter'
}
