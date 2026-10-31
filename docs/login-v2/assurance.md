# Login v2 の品質保証確認

確認日: 2026-10-31。対象はLogin v2差分（Vite/React、Hono、Cloudflare Workers/D1/R2、Better Auth、Resend）。
外部資格情報の登録、本番DB変更、公開は行っていない。

## セキュリティと例外処理

[`独立レビュー`](final-review.md)の確定HIGH 2件は修正・回帰確認済み。
認証endpointはmethod/pathの許可リストを通し、未認証JSONは読み込み前に16KiBへ制限する。
セッション/停止状態/管理権限はサーバーで確認し、招待・MFA・連携grantはハッシュ保存と一回消費を行う。
SQLはbind値を使い、CSP/HSTS/フレーム拒否等は共通middlewareにある。
Resend送信は10秒のtimeoutを持ち、ログへ宛先・token・URLを出さない。

旧自前署名/強制初回変更/一時パスワード発行の実行経路は検索で見つからなかった。
旧users表の列とindexは履歴schemaとして残り、0059は既存行を書き換えない。

## 依存監査の実測と適用範囲

`pnpm audit --prod --json` は終了コード1、critical 2 / high 9 / moderate 10 / low 3だった。
これはパッケージ範囲の一致であり、全件がWorkerから実行可能という意味ではない。監査結果自体を0件へ丸めない。

| 指摘 | 依存経路と今回の判定 | 対応 |
|---|---|---|
| Better Auth GHSA-965c-763c-88jm（critical） | Magic Link pluginとOAuthの併用が適用条件。現行pluginsはtwoFactorと独自endpointのみで、Magic Linkを導入せず公開allowlistも通さない | 現構成は適用条件に非該当。固定版の後続更新時に再確認 |
| Better Auth GHSA-r4xp-prcw-77qf（high） | OAuth Proxy plugin等が適用条件。Proxyを導入せず、暗黙連携も無効 | 現構成は適用条件に非該当。構成追加時に再評価 |
| shell-quote（critical） | `drizzle-orm > gel` のoptional peer経由。D1 adapterでgelをimportせず、Worker bundleにもshell-quote/gelはない | 開発依存面の更新候補として残す |
| Zod（high） | 直接依存とBetter Auth adapter経由。巨大な無制限配列の不正要素に対するissue蓄積が条件。公開auth bodyは16KiBで上限があり、独自認証schemaは文字列/enumを検査する | リスクを有界にしつつ、互換性を確認した更新を残課題にする |
| vite・source-map-js・undici（high等） | Better Authのoptional Vitest peerを経由する開発ツール。今回のWorker bundleにVitest/undici/launch-editorを含まない | 開発サーバーを外部へ公開せず、開発依存更新で対応 |

適用条件は[Better AuthのMagic Link advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm)、
[OAuth Proxy advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf)、
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)を確認した。
修正版の導入可能性と固定版API/スキーマの互換性を確認せず、一括更新や監査除外で件数だけを消すことはしていない。

夜間保守は最新mainとの統合後も49 queries以内。rate-limit掃除は毎日、監査の400日超削除は2日周期、
期限artifact4種類は8日周期とする。要求時の期限判定は掃除の周期に依存しない。

## コストと性能

ログインはユーザー操作で開始し、無限リトライは行わない。認証要求にだけ必要なD1照合・監査・制限計数を行う。
業務画面の既存集計や外部LLM実行は今回変更していない。
統合直後の初期JS113.06KiB超過を検出し、認証済み業務shellの遅延読込で最終86.40KiB/110KiBへ削減した。
ログインの即表示は維持し、表示/認証の回帰115件と共通checkboxの回帰105件を確認した。
実Google/メールを使う往復時間と本番Core Web Vitalsは未計測である。
テスト専用の一時Chromeでは機能受入8項目が成功した。詳細は `evidence/browser-acceptance.json` を参照する。

## 判定

差分レビュー上、到達可能な確定CRITICALは見つかっていない。
ただし全体検証・外部設定・実アカウント/実メール・本番2回の受入確認が残り、公開完了の判定は未実施。
現時点のrelease readinessは **CONDITIONAL（配信準備中）** とし、タスクP13を閉じない。
