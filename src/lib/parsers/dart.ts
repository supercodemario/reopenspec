import { scanDartFileSync } from '../baseline-dart.js'
import type { ParserAdapter } from './types.js'

export const DartParser: ParserAdapter = {
  language: 'Dart',
  profileName: 'dart',
  extensions: ['.dart'],
  ignore: ['**/.dart_tool/**', '**/build/**'],
  scanAsync: async (absPath: string, workspaceRoot: string) => {
    // We retain the existing synchronous implementation behind the async adapter
    return scanDartFileSync(absPath, workspaceRoot)
  }
}
