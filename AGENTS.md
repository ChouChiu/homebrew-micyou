# AGENTS.md

Homebrew Cask tap for [MicYou](https://github.com/LanRhyme/MicYou). TypeScript generator fetches GitHub Releases, produces `.rb` cask files under `Casks/`.

## Commands

```bash
bun install               # install deps
bun run generate           # incremental: skip existing versioned casks, rewrite micyou.rb + micyou@alpha.rb
bun run generate --full    # full: rewrite ALL casks
bun run generate --full --inspect-dmg  # full + re-extract DMG metadata (app name, bundle ID)
bun run lint               # biome check src
bun run format             # biome check src --write
```

## Environment

- **macOS only**: `--inspect-dmg` requires `hdiutil` + `/usr/libexec/PlistBuddy`
- **Bun only**: entrypoint uses `Bun.write`, won't run on Node.js
- Set `GITHUB_TOKEN` to avoid API rate limiting

## Architecture

```
src/
  index.ts                     # entry: calls cask-generation main()
  shared/version.ts            # semver parsing via semver lib
  features/cask-generation/
    cli/                       # arg parsing + orchestration
    releases/                  # GitHub releases API (paginated), asset filtering
    dmg/                       # DMG mount → Info.plist extraction
    cask/                      # Ruby cask template rendering + file writing
```

## Critical rules

- **Never edit `Casks/*.rb` by hand.** They are machine-generated. Always regenerate with `bun run generate`.
- `Casks/micyou.rb` and `Casks/micyou@alpha.rb` are `version :latest` / `sha256 :no_check`. Version-pinned casks (e.g. `micyou@1.3.5.rb`) include concrete `sha256`.
- Two release tracks: stable (`prerelease: false`) and alpha (`prerelease: true`). Generation filters to `.dmg` assets with macOS in filename.
- The `generate` command returns exit code 0 even when there are no changes. The CI workflow checks `git diff` to decide whether to commit.

## CI

- **Auto-updates every 2 hours** via `.github/workflows/update-casks.yml`
- Runs on `macos-latest`, uses `oven-sh/setup-bun@v2`
- Incremental generate → commits `Casks/` if changes exist → pushes to default branch
- Can also be triggered manually via `workflow_dispatch`

## Style

- Biome with `preset: "recommended"`, tabs, double quotes
- TypeScript strict mode, ESNext target, bundler module resolution
- Use `@/` path alias? No — imports use relative paths from src root
