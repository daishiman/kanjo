# AGENTS.md

このリポジトリで作業するエージェント (Codex / Claude Code) への常設指示。

## このリポジトリの性質

収支管理ダッシュボードの仕様と実装。**public リポジトリ**であり、
freee / マネーフォワードのエクスポート、統合 JSON、口座明細といった
**実データを絶対にコミットしてはならない**。

- 実データは `data/` に置き、`.gitignore` で除外している
- コミットしてよいのは匿名化済みの `samples/` 配下のみ
- `git add -f` で除外を突破しない

この制約は `scripts/hooks/guard-real-data.sh` が PreToolUse フックとして
機械的にも検査する。フックが止めた操作を回避する形で進めない。

## 使えるエージェント資産 (AIDD エージェントキット v1.10.2)

編集原本は `aidd-agent-kit/` にあり、そこから各ホストの実行時配置へ反映する。
**実行時配置を直接編集しない。** 編集原本を直してから同期する。

| 種類 | Codex が読む場所 | Claude Code が読む場所 | 編集原本 |
|---|---|---|---|
| Skill | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | `aidd-agent-kit/skills/<name>/` |
| ワークフロー Skill | `.agents/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` | `aidd-agent-kit/codex/workflow-skills/<name>/` |
| サブエージェント | `.codex/agents/app-orchestrator.toml` | `.claude/agents/app-orchestrator.md` | `aidd-agent-kit/codex/agents/`, `aidd-agent-kit/agents/` |
| フック | `.codex/hooks.json` | `.claude/settings.json` | 各ファイル自体 (キット管理外) |

### 主なワークフロー

| やりたいこと | Codex | Claude Code |
|---|---|---|
| アプリを作る | `$build-app <説明>` | `/build-app <説明>` |
| アプリを改善する | `$improve-app <説明>` | `/improve-app <説明>` |
| CI/CD を用意する | `$setup-cicd` | `/setup-cicd` |
| 直前の変更を戻す | `$undo-app` | `/undo-app` |

Codex のカスタムエージェントは TOML の `name` で識別されるため、
委譲先として指定するときは `app_orchestrator` (アンダースコア) を使う。
Skill として明示するときは `$app-orchestrator` (ハイフン)。

## 反映と検証

```bash
bash aidd-agent-kit/sync-project-mac.command   # 編集原本 → 実行時配置
bash aidd-agent-kit/verify-codex-layout.sh     # manifest の path/hash 一致を検証
./aidd-agent-kit/doctor-codex-layout.sh        # user scope との衝突を診断 (読み取り専用)
```

`~/.agents/skills` などの user scope にも同じキットが入っている場合、
doctor は同名警告を出す。Codex は同名 Skill を統合しないため、
このリポジトリでは **project scope を正本**として扱う。
