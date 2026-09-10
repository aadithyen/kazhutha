# Contributing

Thanks for stopping by. Honestly, the most helpful contributions right now are **language packs** — no
TypeScript or game-engine chops required. If you speak a language that isn't in the app yet (or can improve
an existing translation), that's the sweet spot.

Code fixes and features are welcome too, but translations are what we're really hoping people will pitch in
on.

## Before you start

1. **Search [open issues](https://github.com/aadithyen/kazhutha/issues)** — someone may already be
   working on your language or bug.
2. **Open an issue** if nothing matches — use the templates (bug, feature, or language request). For a
   new locale, the language-request template is enough; no need to ask permission first.
3. **Comment on the issue** if you want to claim it, so we don't duplicate work.

## Language packs

Locale files live in `apps/web/src/i18n/locales/`. Each language is one JSON file (see `en.json` as the
source of truth for keys).

Rough steps:

1. Copy `en.json` to `apps/web/src/i18n/locales/<code>.json` (use a short locale code, e.g. `hi`, `ta`).
2. Translate string values; keep keys and structure identical.
3. Register the locale in `apps/web/src/i18n/types.ts` (`SUPPORTED_LOCALES`) and
   `apps/web/src/i18n/messages.ts`.
4. Add the display name in `apps/web/src/components/LanguageSwitcher.tsx` (`LANGUAGE_LABELS`).
5. Open a PR linked to your language-request issue.

Malayalam (`ml.json`) is a good reference for tone and game-specific terms.

## Pull requests

- One logical change per PR (one language or one bug fix).
- Link the issue in the PR description (`Fixes #123` or `Closes #456`).
- `pnpm typecheck` should pass; for JSON-only locale PRs that's usually all you need.

## Questions

Not sure about a string or a rule name? Drop a note on the issue — better to ask than guess.
