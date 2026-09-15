---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infrastructure-web-ds-observed-001。資するゴール: G1, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではストア配布とアプリ更新の経路、およびトークン変更をアプリの版として配る手順を設計する必要があった。本サイクルの配信は Cloudflare Workers の静的アセット 1 系統のままである。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリではストア配布とアプリ更新の経路、およびトークン変更をアプリの版として配る手順を設計する必要があった。本サイクルの配信は Cloudflare Workers の静的アセット 1 系統のままである。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリではストア配布とアプリ更新の経路、およびトークン変更をアプリの版として配る手順を設計する必要があった。本サイクルの配信は Cloudflare Workers の静的アセット 1 系統のままである。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリではストア配布とアプリ更新の経路、およびトークン変更をアプリの版として配る手順を設計する必要があった。本サイクルの配信は Cloudflare Workers の静的アセット 1 系統のままである。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリではストア配布とアプリ更新の経路、およびトークン変更をアプリの版として配る手順を設計する必要があった。本サイクルの配信は Cloudflare Workers の静的アセット 1 系統のままである。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の変更リスク最小化を、配信構成を変えずビルド成果物だけを差し替えるサイクルにする判断に反映した。初期 JS 予算の検査をリリース前の防壁として維持する。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の自動化の原則を、headless Chrome の check 系 (thead / mobile-layout / financial-figure / financial-routes) を見た目の共通化後も CI で回し続けることに反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G4

#### 主たる接地根拠: `qa-infrastructure-web-ds-observed-001`

**問**

配信と build の構成は何で、トークン導入が制約に触れるか。

**答**

配信は Cloudflare Workers (kanjo-console) の静的アセット (../web/dist、not_found_handling: single-page-application) と /api/* の Worker 1 系統である。web の build は typecheck → vite build → check:js-budget (check-initial-js-budget.mjs による初期 JS 予算) → strip:manifest の順で、トークンの追加でこの予算を超えてはならない。トークンは依存ゼロの定数なので外部ライブラリを増やさない。CI では headless Chrome を使う check 系 (thead / mobile-layout / financial-figure / financial-routes) が画面の崩れを検査する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/wrangler.jsonc と packages/web/package.json の scripts をアシスタントが読んだ観測事実。 / 回答時刻: 2026-09-13T05:03:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。和文は OS の system-ui、金額・数値は自己配信する IBM Plex Mono Latin 400/600 だけを使い、全非 test source・dependencies・外部フォントURLの検査でこの配信契約を固定する。
- **G4**: 今後の作成物が自動的に規約へ従うよう、トークン定義以外での色の直書きと、正本と写し (CSS 変数・チャート色) のずれを lint で機械検出し、使い方を規約文書として置く。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法のトークンを定義し、値の唯一の実装正本とする。 | 単体テストは schema・役割集合・alias・コントラストに必要な関係不変条件を値の転記なしで検査する。表示に影響する全トークン値は、版・承認参照・由来ファイルを持つ `docs/design-system/token-approval.json` の SHA-256 fingerprint と lint で照合し、未承認の値変更を拒否する。 |
| O2 | styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれを検出する lint を lint スクリプトへ組み込む。 | pnpm lint が写しの不一致で exit 非 0 になり、一致時に exit 0 になる。charts.ts から 6 桁 hex の直書きが 0 件になる。 |
| O5 | トークンと共通部品の使い方を規約文書 (docs 配下) にまとめ、新しい画面・図をつくるときの参照先を 1 つにする。 | 規約文書が色の役割 (塗り/文字の分離)・タイポグラフィ・余白・シェル・ボタン・チャートの各節を持ち、README または AGENTS.md から参照されている。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。
- **I4**: 誰かが画面のコードに #xxxxxx の色を直書きしたら、pnpm lint が落ちて共通トークンを使うよう促す。

### 本章に効く確定意思決定

- **dec-design-token-source**: デザイントークンの正本をどこに置くか
  - 採択: packages/core の design-tokens.ts を正本にし、CSS 変数とチャートの予備値を生成する (`core-ts`)
  - 目的適合: G1 の『依存ゼロの TypeScript 1 か所』に直接合う。テスト (O1・O4) が CSS を解析せず値を import でき、次サイクルでレポート側からも同じ値を import できる
- **dec-border-color-roles**: 境界色 #D7E0E2 (白に 1.34:1) を、WCAG 2.2 の 1.4.11 とどう両立させるか
  - 採択: 装飾罫線は #D7E0E2、部品を見分ける枠は 3:1 の派生色 (`split-roles`)
  - 目的適合: G5 の役割分離を境界へ広げ、画像の淡い罫線と部品の枠の 1.4.11 を両立する

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。未着手ではなく、配信構成 (Workers の静的アセット + /api/* の Worker) を変えないサイクルで、infrastructure 固有に適用すべき設計知識が無いことを確認した上での確定である。本章に効く制約は初期 JS 予算 (check:js-budget) で、トークンを依存ゼロの定数にする判断はこの予算を守るための選択として記録する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T05:07:52Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
