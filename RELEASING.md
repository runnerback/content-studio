# Releasing

> 版本 v1.1 ｜ 更新时间 2026-09-28（产物名与校验按当前脚本重写；加入「合规修复不单独发版」原则）

This project ships the standard Obsidian three-file runtime: `main.js`, `manifest.json`, `styles.css`.

## Release principles

- **One user-visible change per release.** Compliance-only fixes (directory scan, lint, workflow tweaks) ride along with the next functional release instead of getting their own tag: every tag is an update prompt for every user.
- Every release gets a `RELEASE_NOTES/v<version>.md` (English, front-matter `title`) and a `CHANGELOG.md` entry (中文 + English).
- Bump the version on every shipped change: `manifest.json`, `package.json`, `versions.json` (`"<pluginVersion>": "<minAppVersion>"`), README headers.

## Release checklist

1. Update the version in `manifest.json` and `package.json` (keep them identical) and append the mapping to `versions.json`.
2. Write `RELEASE_NOTES/v<version>.md` and add the `CHANGELOG.md` entry.
3. Run the full guard (lint + risk-pattern scan + directory scan at 0 problems + unit tests + pack + validate):
   - `npm run review:guard`
4. Install locally and check the preview panel, settings and publish modals: `bash dev-install.sh`.
5. Create the git tag (must exactly match `manifest.json.version`, no `v` prefix) and push it:
   - `git tag 3.12.0`
   - `git push origin main 3.12.0`
6. The tag triggers `.github/workflows/release.yml`, which builds, validates and publishes the GitHub Release with `main.js`, `manifest.json`, `styles.css`.

## Artifacts

- `npm run release:pack` produces `note-content-studio.zip` containing only `main.js`, `manifest.json`, `styles.css`; `npm run release:validate` rejects anything else. The zip is only for manual installs; the GitHub Release uploads the three files directly.
- If the runtime file set ever changes, update `package-release.sh`, `scripts/release-validate.mjs` and the README installation section together.

## Obsidian community directory

- The directory mirrors `community-plugins.json` roughly every two hours and only lists plugins that passed the automated review; "Publish" on the release is not the same as being searchable in the app.
- `GET /releases/tags/<tag>` can report empty assets for 40–80 minutes after a release; wait before pressing "Request review" if the directory complains about missing files.
- Keep `npm run scan:directory` at 0 problems; the directory scanner has no `@types/node` and no inline eslint config.

## BRAT notes

- Verify BRAT updates against a fresh install in a clean vault and an upgrade from the previous version.
- **Actions → Release Package → Run workflow** on a branch performs a dry run (test / build / package / validate) without creating a GitHub Release.
