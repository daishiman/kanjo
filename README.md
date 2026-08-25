# kanjo — 収支統合管理システム

事業（freee）と家計（マネーフォワード）を1つの画面で統合管理するための、個人向け収支分析システム。

毎月2つのCSVを投げ込むだけで、「どの科目が増えたか」「それは削るべきか使うべきか」「個人の口座から出た事業経費はいくらか」が自動で出る。

## 何を解く道具か

会計ソフトは「記帳する」ためのものであって、「判断する」ためのものではない。このシステムが埋めるのはそのギャップ。

- **増減が見えない** → 科目×月の全数マトリクスを、金額／前月比／前年同月比で切り替えて表示する
- **削減の優先順位がつかない** → 変動係数(CV)で固定費とスポット費を機械的に分類する。この2つは削減手段がまったく違う
- **公私が混ざる** → 個人口座の明細1件ずつを事業／個人に仕分け、freeeに登録すべき「事業立替」額を算出する
- **統計の知識が要る** → すべての指標を実データ入りの日本語解説とセットで提示する

正本仕様は [`docs/spec-v1.1.md`](docs/spec-v1.1.md)。

## アーキテクチャ

単一HTMLプロトタイプの分析ロジックを忠実に移植し、Cloudflare Workers 上のWebシステムとして再構成した（B案を発展させた形）。理由: 統計ロジックにユニットテストを書けること、複数端末から使えること、月次データをブラウザのlocalStorageではなくD1に永続化できること。

```
単一 Worker (kanjo-console)
├── Workers Assets ── React SPA (packages/web のビルド成果物)
├── /api/*         ── Hono REST API (packages/api)
│     └── 認証ガード必須 (Cloudflare Access JWT または パスワード+署名Cookie)
├── D1 (kanjo-db)   ── 明細・仕訳・ルール・集計キャッシュ (migrations/)
└── R2 (kanjo-files)── アップロード原本 + 夜間バックアップ (cron 03:00 JST)
```

| パッケージ | 役割 |
|---|---|
| `packages/core` | 依存ゼロの純関数群: パーサー(freee/MF/SJIS)・仕分け・統計・分析。**スナップショットテストの対象** |
| `packages/api` | Hono Worker: 認証・取込パイプライン(ZIP/CSV/Excel/JSON)・集計API・バックアップ |
| `packages/web` | React 18 + Vite + TanStack Query + Chart.js の SPA (11ページ) |

## 開発

```bash
pnpm install
pnpm test          # core・API・web の回帰テスト
pnpm typecheck     # 全パッケージ
pnpm lint          # Biome
pnpm run preview   # web をビルドして wrangler dev (Workersランタイム, localhost:8787)
```

初回のみ:

```bash
cd packages/api
cp .dev.vars.example .dev.vars   # AUTH_PASSWORD / SESSION_SECRET を設定
pnpm exec wrangler d1 migrations apply kanjo-db --local
```

確認は必ず `pnpm run preview`(8787、Workersランタイム)で行う。`pnpm dev`(3000、Vite)は画面開発の補助。

## デプロイ

main への反映後、CIが成功したコミットだけをGitHub Actionsが自動デプロイする。公開後は30秒後と、さらに90秒後の2回、本番URLを自動確認する。

D1マイグレーションは自動デプロイと分離している。GitHub Actionsの「Migrate」を手動実行し、確認欄へ `APPLY` と入力した場合だけ、Time Travelの復元地点を確認してから適用する。必ずマイグレーション完了後にコードをmainへ反映する。

GitHub Environment `production` に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`、Repository Variableに `APP_URL` を登録する。認証情報の登録はリポジトリ所有者本人が行う。手元からの `pnpm run deploy` は緊急時のみ。

GitHub・Cloudflareの初回設定、通常リリース、D1 migration、障害調査、rollbackの詳細は [`docs/ci-cd-operations.md`](docs/ci-cd-operations.md) を参照。

本番シークレット: `wrangler secret put AUTH_PASSWORD` / `wrangler secret put SESSION_SECRET`。Cloudflare Access に切り替える場合は wrangler.jsonc の `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を設定する（設定するとパスワード認証は無効化される）。

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [`docs/spec-v1.1.md`](docs/spec-v1.1.md) | **正本仕様**: 要件・画面・API・スキーマ・品質ゲート |
| [`docs/requirements.md`](docs/requirements.md) | 初期要件文書の履歴と正本への導線 |
| [`docs/data-schema.md`](docs/data-schema.md) | freee / MF のCSV仕様、統合JSONの構造と不変条件 |
| [`docs/metrics.md`](docs/metrics.md) | 統計指標の定義、費目分類の基準、異常検知のしきい値 |
| [`docs/ci-cd-operations.md`](docs/ci-cd-operations.md) | CI/CD・GitHub保護設定・Cloudflare本番運用・復旧手順 |
| [`docs/cloudflare-credentials-setup.md`](docs/cloudflare-credentials-setup.md) | Cloudflare API Token・Account ID・本番URL・Worker secretの取得と登録 |

## ディレクトリ構成

```
kanjo/
├── docs/            仕様ドキュメント (spec-v1.1.md が正本)
├── packages/
│   ├── core/        純関数 (パーサー・統計・分析) + インライン架空データによるテスト
│   ├── api/         Hono Worker (wrangler.jsonc / ルート / DB)
│   └── web/         React SPA
├── migrations/      D1 スキーマ (連番SQL)
├── .github/         CI / CD (main: CI成功→deploy→2回確認) / 手動D1 migration
├── scripts/hooks/   Claude Code / Codex 共通のフックスクリプト
├── aidd-agent-kit/  AIDD エージェントキットの編集原本
└── data/            実データ置き場 ★ .gitignore 済み・絶対にコミットしない
```

`aidd-agent-kit/` 以下が編集原本で、`.claude` `.agents` `.codex` はそこから生成される実行時配置。エージェント向けの詳細は [`AGENTS.md`](AGENTS.md) を参照。

## セキュリティ方針

扱うデータは口座入出金・給与・取引先名を含む極めて機微な情報。このリポジトリはpublicであるため、次を必須とする:

1. **実データはリポジトリに入れない。** `data/` および `*.csv` / `*.xlsx` は `.gitignore` 済み。コミット可能なデータファイルは匿名化済みの `samples/` 配下だけ
2. **未認証でデータにアクセスできる状態を作らない。** `/api/*` は全ルートで認証ガード必須
3. **ログに明細内容・金額を出力しない。** エラーログは経路と例外名のみ
4. **明細の外部送信なし。** アナリティクス・外部フォント配信等は導入しない（フォントはバンドル）
5. **R2/D1 へは Worker 経由のみ。** 公開バケットは作らない
6. **`.gitignore` を突破する git コマンドはフックで止める。** `scripts/hooks/guard-real-data.sh` が Claude Code / Codex 双方の PreToolUse フックとして git 操作を検査する

## 毎月の運用手順

1. freee：取引 → エクスポート（CSV/ZIP）を「データ取込」ページに投入
2. MF：家計簿 → 収入・支出詳細 → 月次CSVを投入
3. 「公私仕分け」で自動判定を確認し、必要な明細だけ手動で確定
4. 増減マトリクスと統計診断で「増えた科目」を確認、予算管理で予実差異を確認
5. バックアップは夜間cronがR2へ自動保存（30日保持）。手動なら「設定 → 統合データJSON」

同じ月のファイルを再投入した場合、その月のデータは加算ではなく**置換**される（二重計上の防止）。手動仕分けは明細IDが一致する限り維持される。
