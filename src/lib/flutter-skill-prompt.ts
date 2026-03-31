import { createInterface } from 'node:readline/promises'

/** CLI the user runs to browse and install Flutter-related skills interactively. */
export const FLUTTER_SKILLS_NPX_COMMAND = 'npx skills add flutter/skills'

export type OfferFlutterSkillsOptions = {
  /** Prepended to every logged line (e.g. doctor uses two spaces). */
  linePrefix?: string
}

/**
 * When the workspace is Dart/Flutter, offer guidance to add skills.
 * In a TTY, asks y/N; on yes, prints the npx command and that the picker is interactive.
 * Without a TTY, prints a one-line hint including the command (no prompt).
 */
export async function offerFlutterSkillsGuidance(
  log: (message: string) => void,
  options?: OfferFlutterSkillsOptions,
): Promise<void> {
  const p = options?.linePrefix ?? ''
  const L = (msg: string) => log(p + msg)

  if (!process.stdin.isTTY) {
    L('')
    L(
      `💡 Dart/Flutter workspace — run \`${FLUTTER_SKILLS_NPX_COMMAND}\` to open the skill picker and choose a Flutter skill to add.`,
    )
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    L('')
    L('💡 This workspace looks like Dart or Flutter.')
    const answer = await rl.question(
      p + 'Add Flutter agent skills now? (you will pick one from the skills CLI) [y/N]: ',
    )
    const yes = /^y(es)?$/i.test(answer.trim())
    if (yes) {
      L('')
      L('Run this command — it starts an interactive flow so you can select which skill to add:')
      L(`  ${FLUTTER_SKILLS_NPX_COMMAND}`)
      L('')
    }
  } catch {
    L('')
    L(`Dart/Flutter workspace — when ready, run: ${FLUTTER_SKILLS_NPX_COMMAND}`)
  } finally {
    rl.close()
  }
}
