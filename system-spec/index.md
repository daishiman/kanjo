---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 利用者が日々の記帳を止めずに完了できる状態を保つこと。そのために(1)本番データベースのスキーマをデプロイ済みコードが前提とする版へ一致させ続け、(2)利用者が使っていて気づいた不便や不具合を、その場の画面と状況ごと開発側へ届けて改善へつなげる経路を保つ。
- **ゴール (U3)**: G1=本番D1のスキーマをコードが前提とする最新版へ復旧し、データ取込と取込履歴が正常に動作する状態へ戻す, G2=Migrate の人間承認による適用と Deploy の fail-closed 検査を分離し、コード配信とスキーマ適用が乖離したまま本番へ到達しない状態を構造的に保証する, G3=万一乖離した場合でも、利用者と開発者が原因を即座に特定できる検知と説明可能なエラー応答を備える, G4=復旧作業を通じて本番の既存データを一件も失わない, G5=利用者が気づいた改善点を、画面から離れず、そのとき見えていた画面と起きていた不具合ごと開発側へ届けられる状態にする, G6=受け取った改善要望を、Claude Code / Codex がそのまま着手できる指示文と証跡 (スクリーンショット・診断情報) として取り出せる状態にする, G7=送信・保存される診断情報を、原因特定に足りる最小範囲へ絞り、秘匿すべき値を含めない状態を構造的に保つ

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G2 G4 G5 G6 G7 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G1 G3 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G3 G5 G6 G7 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G1 G3 G6 G7 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G2 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G5 G6 G7 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G3 G5 G6 G7 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G4 G5 G7 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
