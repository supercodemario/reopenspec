import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type LanguageProfile = {
  primary: 'typescript' | 'dart' | 'go' | 'rust' | 'python' | 'unknown'
  manifests: string[]
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

  let primary: LanguageProfile['primary'] = 'unknown'
  if (manifests.includes('package.json') || manifests.includes('tsconfig.json')) {
    primary = 'typescript'
  } else if (manifests.includes('pubspec.yaml')) {
    primary = 'dart'
  } else if (manifests.includes('go.mod')) {
    primary = 'go'
  } else if (manifests.includes('Cargo.toml')) {
    primary = 'rust'
  } else if (manifests.includes('pyproject.toml')) {
    primary = 'python'
  }

  return { primary, manifests }
}
