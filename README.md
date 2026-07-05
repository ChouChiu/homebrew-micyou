# Homebrew MicYou

[MicYou](https://github.com/LanRhyme/MicYou) 的 Homebrew Cask 仓库，通过 GitHub Releases API 自动生成版本化 `.rb` cask 文件。

同时追踪 **stable** 和 **pre-release** 两条发布线。

## 安装

要安装 MicYou，先添加本 tap，再用 Homebrew 安装 cask。

1. 添加 tap：

   ```bash
   brew tap ChouChiu/homebrew-micyou
   ```

2. 安装最新稳定版：

   ```bash
   brew install --cask micyou
   ```

3. 安装最新预发布版（alpha）：

   ```bash
   brew install --cask micyou@alpha
   ```

4. 或安装指定版本：

   ```bash
   brew install --cask micyou@1.3.5
   brew install --cask micyou@2.0.0-alpha.1
   ```

## Cask 列表

本仓库自动维护 [MicYou](https://github.com/LanRhyme/MicYou) 已发布的 macOS DMG cask。生成脚本只收录同时满足以下条件的 release 资源：

- 文件名包含 `macos` 且以 `.dmg` 结尾（如 `MicYou-macOS-1.3.5-arm64.dmg`）
- GitHub Releases API 返回 `digest` 字段，可用于生成 `sha256`
- 支持 `arm64` 和 `x64` 两种架构

### Cask 命名规则

| Cask 名 | 说明 |
|---------|------|
| `micyou.rb` | 最新 stable release（`version :latest`） |
| `micyou@alpha.rb` | 最新 pre-release（`version :latest`） |
| `micyou@x.y.z.rb` | 锁定版本（含 `sha256`） |
| `micyou@x.y.z-alpha.N.rb` | 锁定预发布版本（含 `sha256`） |

当前覆盖的版本见 [`Casks/`](Casks/)。

## 生成脚本

使用 `bun` 运行以下命令来生成或更新 cask 文件：

```bash
bun install
bun run generate                     # 增量：跳过已有版本化 cask，始终重写 micyou.rb 和 micyou@alpha.rb
bun run generate --full              # 全量：重写所有 cask 文件
bun run generate --inspect-dmg       # 重新检查最新 DMG，提取 app 名称和 bundle ID
bun run generate --full --inspect-dmg # 全量重写，并重新检查最新 DMG 元数据
```

### 工作原理

生成流程从 GitHub API 获取 release 信息，按 `prerelease` 字段分流为 stable 和 alpha 两条线，提取符合条件的 DMG 资源（arm64 + x64），然后生成对应的 Ruby cask 文件。

默认模式会优先从现有 cask 读取 app 名称和 bundle ID。只有在找不到现有元数据，或传入 `--inspect-dmg` 时，脚本才会下载并挂载最新 DMG 来读取 `Info.plist`。

```
GitHub Releases API
  → 按 prerelease 分流 stable / alpha
  → 过滤有 digest 的 macOS .dmg 资源
  → 配对 arm64 + x64 资产
  → 复用现有 cask 元数据，或检查最新 DMG
  → 生成 Casks/*.rb（含 on_arm / on_intel 架构块）
```

增量模式适合日常更新。它会跳过已存在的版本化 cask，但每次都会重写 `micyou.rb` 和 `micyou@alpha.rb` 指向各自线的最新版本。

### 维护者流程

日常检查新版本：

```bash
bun install
bun run generate
bun run lint
```

模板或元数据变更后重写所有 cask：

```bash
bun run generate --full
bun run lint
```

需要重新确认 app 名称或 bundle ID 时：

```bash
bun run generate --full --inspect-dmg
bun run lint
```

### 项目结构

源码按功能分层，`src/features/cask-generation/` 包含完整的 cask 生成链路：

```
src/
├── features/
│   └── cask-generation/  # 生成 cask 的完整功能链
│       ├── cli/          # 参数解析 + 流程编排入口
│       ├── releases/     # GitHub API 分页 + 资产过滤
│       ├── dmg/          # DMG 挂载 → Info.plist 提取
│       └── cask/         # Ruby cask 模板 + 写入
├── shared/               # 跨功能复用工具
└── index.ts              # 运行入口
```

## 自动更新

本仓库通过 GitHub Actions 每 2 小时检查一次 [MicYou](https://github.com/LanRhyme/MicYou) 的新发布版本。自动更新使用增量模式：新增缺失的版本化 cask，并重写 `micyou.rb` 和 `micyou@alpha.rb` 指向各自线的最新版本。

也可以手动触发更新：[`.github/workflows/update-casks.yml`](.github/workflows/update-casks.yml)。

## 前提条件

- **macOS** 环境：生成脚本使用 `hdiutil` 和 `/usr/libexec/PlistBuddy`（仅 `--inspect-dmg` 时需要）。
- **Bun**：入口脚本依赖 `Bun.write` API，不支持 Node.js。
- 建议设置 `GITHUB_TOKEN` 环境变量以避免 API 频率限制。

## 相关链接

- [MicYou 项目](https://github.com/LanRhyme/MicYou) — 上游应用
- [Homebrew Cask 文档](https://docs.brew.sh/Cask-Cookbook) — cask DSL 参考
- [homebrew-kazumi](https://github.com/ChouChiu/homebrew-kazumi) — 参考架构

## 许可

[MIT](LICENSE)
