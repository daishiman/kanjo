---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 金融明細を扱う権限を「共有された1つの秘密」から「個人に帰属するアカウント」へ移し、失効・追跡・権限限定を利用者単位で効かせられる状態にする。5 Whys の帰結: (1)なぜログイン画面を変えるか→現状はパスワード1本で誰がログインしたか分からない (2)なぜ主体を識別したいか→事業と家計の金融明細を扱うのに認証主体が共有パスワード1本で、漏れれば全データが即座に露出し、誰の操作かも追えない (3)なぜ今か→20画面まで育ち audit_log や改善リクエストなど「誰が」を前提にした機能が既に入っている中で、認証だけが主体を持たないまま取り残されている (4)なぜ主体が要るか→責任の所在を切り分け、1人の退出で全員のパスワードを変える運用から抜けるため (5)本質→金融データを預かる責任を共有の秘密ではなく個人へ帰属させ、停止・追跡・限定を個別に効かせられるようにする。ログイン画面の刷新は、その主体変更を利用者が最初に触れる場所として「安心して預けられる」と伝わる形に整えることであり、見た目の改善そのものが目的ではない。
- **ゴール (U3)**: G1=利用者がメールアドレスとパスワードで本人として認証でき、セッションが誰のものかシステム側で特定できる, G2=認証情報が漏洩しても即座に全データが露出しない。パスワードは復元不能な形で保存し、セッションは利用者単位で失効できる, G3=管理者が設定画面から利用者の追加・停止・パスワード再発行を完結でき、共有パスワードの配り直しが不要になる, G4=ログイン画面が、扱うデータの性質と保護方針を利用者へ明示し、初見でも何をする場所か・何が守られるかが分かる, G5=既存20画面と /api/* 認証ガードの契約を壊さずに認証主体を差し替える

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G3 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G1 G2 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G4 G1 G2 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G1 G3 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G5 G2 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G3 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G4 G5 G3 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G3 G2 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
