import { Command } from '@oclif/core'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import fg from 'fast-glob'
import { loadResolvedConfig } from '../lib/reopenspec-config.js'
import { detectLanguageProfile, detectStackProfile, isDartOrFlutterStack } from '../lib/detect-profile.js'
import { offerFlutterSkillsGuidance } from '../lib/flutter-skill-prompt.js'
import { loadFeatureSpecs } from '../lib/load-specs.js'

export default class Doctor extends Command {
  static override id = 'doctor'
  static override description = 'Check workspace health, config validity, and spec contracts'
  static override examples = ['<%= config.bin %> doctor']

  async run(): Promise<void> {
    const cwd = resolve('.')
    this.log(`Diagnosing ReOpenSpec setup in ${cwd}...\n`)

    let hasErrors = false

    // 1. Config Check
    this.log('🔍 Checking Configuration...')
    let cfg
    try {
      const resolved = loadResolvedConfig(cwd)
      cfg = resolved.merged
      if (!resolved.fileExists) {
        this.warn(`No reopenspec.json found. Using defaults. Checked: ${resolved.filePath}`)
      } else {
        this.log(`  ✅ Loaded config from: ${resolved.filePath}`)
      }
    } catch (e) {
      this.error(`  ❌ Failed to load config: ${(e as Error).message}`, { exit: false })
      hasErrors = true
      return // Cannot proceed without config load success for specsDir
    }

    // 2. Folder Structure
    this.log('\n📁 Checking Directory Structure...')
    const docsDir = join(cwd, 'reopenspec', 'docs')
    const changesDir = join(cwd, 'reopenspec', 'changes')
    const specsDir = join(cwd, cfg.specsDir)

    if (existsSync(docsDir)) this.log('  ✅ docs directory exists')
    else this.warn(`  ⚠️ Missing docs directory at ${docsDir}`)

    if (existsSync(changesDir)) this.log('  ✅ changes directory exists')
    else this.warn(`  ⚠️ Missing changes directory at ${changesDir}`)

    if (existsSync(specsDir)) this.log('  ✅ specs directory exists')
    else {
      this.error(`  ❌ Missing specs directory at ${specsDir}`, { exit: false })
      hasErrors = true
    }

    // 3. Language Profile
    this.log('\n⚙️ Checking Language Setup...')
    const profile = detectLanguageProfile(cwd)
    this.log(`  ℹ️ Detected primary language: ${profile.primary}`)

    const stack = detectStackProfile(cwd)
    if (isDartOrFlutterStack(stack)) {
      await offerFlutterSkillsGuidance((m) => this.log(m), { linePrefix: '  ' })
    }

    // We import dynamically to avoid huge memory hit or cyclic deps if any
    const { buildBaseline } = await import('../lib/baseline.js')
    if (profile.primary === 'unknown') {
      this.warn('  ⚠️ Could not detect a known primary language (no package.json, pubspec.yaml, requirements.txt, etc.)')
    }

    // 4. Specs and Contracts Check
    this.log('\n📜 Checking Spec Definitions...')
    try {
      const specMetaFiles = await fg([`${cfg.specsDir}/**/.spec-meta.json`, `${cfg.specsDir}/**/api-contracts.json`], { cwd })
      if (specMetaFiles.length === 0) {
        this.warn(`  ⚠️ No specs found in ${cfg.specsDir}. Run "reo spec new <name>" to create one.`)
      } else {
        this.log(`  ✅ Found ${specMetaFiles.length} spec-related files`)
      }

      // Check api-contracts.json for dead references
      const specs = await loadFeatureSpecs(cwd, cfg.specsDir)
      let invalidContracts = 0
      for (const spec of specs) {
        if (!spec.api?.contracts) continue
        for (const contract of spec.api.contracts) {
           if (contract.mapsTo) {
               const targetPath = resolve(cwd, contract.mapsTo.file)
               if (!existsSync(targetPath)) {
                   this.error(`  ❌ Contract "${contract.id}" in spec "${spec.featureSlug}" maps to missing file: ${contract.mapsTo.file}`, { exit: false })
                   hasErrors = true
                   invalidContracts++
               }
           }
        }
      }
      if (specs.length > 0 && invalidContracts === 0) {
        this.log('  ✅ All contract mapsTo file references are valid')
      }

    } catch (e) {
      this.error(`  ❌ Error reading specs: ${(e as Error).message}`, { exit: false })
      hasErrors = true
    }

    if (hasErrors) {
      this.log('\n❌ Doctor found issues in your project setup. Please fix the errors above.')
      this.exit(1)
    } else {
      this.log('\n🚀 Doctor found no issues. Workspace is healthy and ready for /reo-plan!')
    }
  }
}
