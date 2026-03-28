/**
 * Machine-local hero profile (`reopenspec.local.json`).
 *
 * **Updating default role emojis or the hero suggestion list**
 *
 * 1. Edit `DEFAULT_ROLE_EMOJI` and/or `HERO_EMOJI_SUGGESTIONS` in this file (source of truth).
 * 2. Mirror the same emoji strings and meanings in `editors/vscode/src/extension.ts`:
 *    `DEFAULT_ROLE_EMOJI`, `HERO_EMOJI_SUGGESTIONS`, and the `<option>` labels in `html()`
 *    (“Developer (default emoji …)” / “Manager (default emoji …)”).
 * 3. If defaults change, update the `--emoji` flag description in `src/commands/init.ts`.
 * 4. Rebuild: `npm run build` at repo root; `npm run compile` in `editors/vscode`.
 */

export type LocalUserRole = 'developer' | 'manager'

export const DEFAULT_ROLE_EMOJI: Record<LocalUserRole, string> = {
  developer: '🥷',
  manager: '🔀',
}

export type HeroEmojiSuggestion = { emoji: string; meaning: string }

/** Ten character picks (see file header: keep VS Code extension in sync when editing). */
export const HERO_EMOJI_SUGGESTIONS: readonly HeroEmojiSuggestion[] = [
  { emoji: '🥷', meaning: 'Ninja — focused implementation and craft' },
  { emoji: '🔀', meaning: 'Merge — integration, alignment, and bringing branches together' },
  { emoji: '🧙‍♀️', meaning: 'Woman mage — collaboration and arcane architecture' },
  { emoji: '🧑‍💻', meaning: 'Technologist — builder at the keyboard' },
  { emoji: '🧑‍💼', meaning: 'Office worker — coordination and stakeholder rhythm' },
  { emoji: '🧑‍🔬', meaning: 'Scientist — tests, data, and spikes' },
  { emoji: '🧑‍🚀', meaning: 'Astronaut — shipping launches and exploration' },
  { emoji: '🧑‍✈️', meaning: 'Pilot — roadmaps and steering delivery' },
  { emoji: '🧑‍🎨', meaning: 'Artist — UX, visuals, and product craft' },
  { emoji: '🤖', meaning: 'Robot — automation, tooling, and systems' },
]

export function isLocalUserRole(s: string): s is LocalUserRole {
  return s === 'developer' || s === 'manager'
}

export function resolveHeroEmoji(role: LocalUserRole, stored?: string): string {
  const t = stored?.trim()
  if (t) return t
  return DEFAULT_ROLE_EMOJI[role]
}

export type LocalProfileOnDisk = {
  heroName: string
  role: LocalUserRole
  /** If set and non-empty, overrides the default emoji for `role`. */
  emoji?: string
}
