import Drift from './drift.js'

/** Spec name: \`reo diff\` — same behavior as \`reo drift\`. */
export default class Diff extends Drift {
  static override id = 'diff'
  static override description =
    'Run drift check only (alias for drift): compare baseline to reopenspec/specs/*/api-contracts.json.'
  static override examples = ['<%= config.bin %> diff', '<%= config.bin %> diff --skipScan']
}
