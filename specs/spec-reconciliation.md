---
graph_node_id: "spec-reconciliation"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "照合画面 仕様"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation"]
file_path: "specs/spec-reconciliation.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "25823f116de8be6463b9e511362b16bee70f1882ce96cb1be996d098052d2d62"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "25823f116de8be6463b9e511362b16bee70f1882ce96cb1be996d098052d2d62", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: []
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations", "docs/data-schema.md", "docs/ui-decisions.md", "design/FINAL-UI/images/04-reconciliation.png"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の要件定義書 (U1-U9) を実装計画の入口として参照する単一の specification。API 変更 (GET /api/reconciliation・POST /api/reconciliation/actions・POST /api/reconciliation/actions/:id/undo 新設) があるため api-contract overlay を合成する。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-reconciliation.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 照合画面 仕様

本書は照合機能の現行仕様の正本である。`system-spec/00-requirements-definition.md` は承認時の入力として、architecture ノードは領域別の制約として参照する。状態・対応必要件数・期間の扱い・下段プレビューの意味は本書の「状態・件数・投影の正本」だけで定義し、他の文書はここを参照する。

## 状態・件数・投影の正本

1. 状態は **未処理 / 要確認 / 照合済み / MFのみ / 除外** の 5 つ。`MFのみ` は MoneyForward にあり freee に相手がない事業支出で、総収支に MF の金額で計上済みのため **対応不要**。
2. `kpi.actionRequiredCount` は `statusCounts.review + statusCounts.unprocessed` とする。core の照合レポートが一度だけ導出し、KPI・対応キュー見出し・サイドバーバッジ・月次クローズはこの値を使う。`reviewCount` は要確認だけの互換内訳であり、別系統の「対応必要件数」として扱わない。
3. 判定は常に全期間で照合した後に、選択期間へ表示を投影する。月境界の ±3 日候補を切らない。照合ページと分析ハブのカードは選択期間投影、サイドバーと月次クローズの `actionRequiredCount` は期間クエリ非依存の全期間投影とする。
4. 下段は新たな状態や作業キューを作らない **読み取り専用の短いプレビュー**。左は期間投影された `mfOnly`、右は同じ行集合の `review` 行 (`reviewRows`: 自動一致できなかった候補) の要約で、マスタ詳細へ遷移する導線とする。API の `unmatchedFreee` は現行 web で未使用であり、下段右の正本にはしない。

## 目的と成功状態

照合画面を、帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を『どこから解消するか』判断し、確認・照合・別取引・除外・元に戻すまでを 1 画面で完結できる作業場にする。利用者が事業支出・対応不要・対応必要総数・解消率を掴み、判定根拠を見て迷わず決め、誤操作をすぐ戻せる状態にする。

成功状態:
- S1 (G1): /analysis/reconciliation で 04-reconciliation.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で直書き色の lint が 0 件である。
- S2 (G2): 5状態と `actionRequiredCount` が境界値テストで固定され、照合ページとハブは同じ期間投影、サイドバーと月次クローズは同じ全期間値になる。
- S3 (G3): 照合 / 別取引 / 除外 / 一括照合の結果が再読込後も保持され、元に戻すで操作前の状態に戻る。
- S4 (G4): サイドバー文言と件数バッジ、月次クローズ 3/4、ヘッダーとフッターが画像どおりで、既存ルートと旧 URL のテストが緑である。
- S5 (G5): 画像のアイコンが全て表示され、絵柄の重複検査が緑である。
- S6 (G1-G5): pnpm test / typecheck / lint と packages/web の check 系スクリプトが全て緑で、狭幅 (アイコンレール・下部タブ) では 3 カラムが縦積みになる。ページ全体は横スクロールさせず、比較表だけを名前付き・フォーカス可能な枠内で横へ操作できる。

## スコープ

- In:
  - 照合画面 (04-reconciliation.png の全構成要素と各状態) の作り直し
  - core の一致度・一致の理由・ステータス・対応キュー・KPI の純関数と、buildExpenseProjection・ハブのバッジの判断反映
  - 照合画面用 API (一覧・KPI・キュー、照合 / 別取引 / 除外 / 一括、取消、直前の操作)
  - D1 migration: verdict 取消に必要な変更・MF 側除外表・照合操作の履歴表・月次レビュー完了表
  - 共通シェル: サイドバー文言・グループ・件数バッジとラベル追随、月次クローズ進捗 3/4、ヘッダー、フッター、改善を送るボタン
  - 画像で使われるアイコンの追加登録
  - 判定規則の docs 記載 (docs/data-schema.md の古い候補条件の修正を含む) とテスト
- Out:
  - 総収支・マトリクス・推移・診断の各タブ画面の中身の作り直し (それぞれの画面サイクルで扱う。ラベルと共通シェルの変更は追随させる)
  - データ取込・明細仕分け・サブスクなど他画面の中身の作り直し (件数バッジの算出と導線リンクだけを扱う)
  - freee / MoneyForward への書き戻し (仕訳の作成・取引の修正)。kanjo は取込データを外部送信しない方針を維持し、仕分けを開く・データ取込を確認する導線で扱う
  - 利用規約・プライバシー・データ出典の本文の新規作成 (既存の内容へのリンク配置だけを扱う)
  - スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 照合候補 | MoneyForward の事業支出の取引と、それに対応し得る freee の仕訳 (候補) の組。一覧の行 key は MF tx id |
| 一致度 | 金額一致 50 + 日付差 (同日 30 / 1 日 20 / 2 日 10 / 3 日 5) + 内容類似×20 の 100 点満点 (qa-reconciliation-decision-003) |
| 内容類似 | NFKC・空白除去・小文字化で正規化した文字 bigram の Dice 係数 (0〜1)。0.5 以上で『内容が似ている』(qa-backend-web-rc-decision-011 / 012 / 013) |
| 一致の理由 | 金額 / 日付 / 内容 の 3 行のチェック。内容行は内容類似 0.5 以上で付く |
| ステータス | 未処理 / 要確認 / 照合済み / MFのみ / 除外 の 5 値。定義は「状態・件数・投影の正本」参照 |
| 対応必要件数 | `actionRequiredCount`。要確認と未処理だけを数える。定義は「状態・件数・投影の正本」参照 |
| 下段プレビュー | 左=`mfOnly`、右=`reviewRows` の読み取り専用要約。マスタ一覧の代替や独立キューではない |
| 対応キュー | 対応が要る 3 分類 (要確認の候補 review / 金額の差異 amountMismatch / 日付の近い取引 nearDate) と、確認のみの MFのみの支出 (mfOnly) |
| 解消率 | 照合済み ÷ (照合済み + 要確認 + 未処理)。除外は分母に入れない (qa-backend-web-rc-decision-010) |
| 直前の操作 | 利用者の最新の照合操作 1 件 (一括なら一括単位)。元に戻すの対象 (qa-database-web-rc-decision-008) |
| 月次クローズ進捗 | データ取込 / 仕分け / 照合 / 月次レビュー の 4 ステップ。照合は全期間の `actionRequiredCount`、月次レビューは利用者の完了操作 |
| 利用者 | 単独の個人事業主 1 名 (SH1) |
| 保守者 | 同一人物とコーディングエージェント (SH2) |

## ユースケースとユーザーフロー

1. 月次クローズで /analysis/reconciliation を開くと、KPI 4 枚 (事業支出 / MFのみの支出 (対応不要) / 対応が必要 / 解消済み) で差異の総量を掴む。
2. 左の対応キュー (要確認の候補 / 金額の差異 / 日付の近い取引、件数付き。MFのみの支出は「確認のみ」に分けて出す) か絞り込み (freee候補の有無・ステータス・対象年月・リセット) と検索で、手を付ける候補を絞る。候補有無にはKPI・ステータスと重複する件数を併記しない。
3. 中央の照合候補一覧で行を選ぶと、右の取引の詳細パネルに MF の取引・freee の候補・一致の理由・一致度バーが出る。
4. 根拠を見て『同じ取引として照合』『別の取引として処理』または除外を選ぶ。複数行をチェックすると下部の選択中バーから『選択した取引を照合』(確認ダイアログで件数を示す) できる。
5. 操作の直後、詳細パネルの直前の操作に内容と『元に戻す』が出て、押すと操作前の判断状態へ戻る。
6. 下段の読み取り専用プレビューで `mfOnly` と `reviewRows` の代表行を確認し、左は明細仕分け、右は中央の候補一覧へ進む。操作はマスタ一覧・詳細パネルで行う。
7. 全期間の `actionRequiredCount` が 0 になると、サイドバーの月次クローズ進捗で照合ステップが完了になる。月次レビューは利用者が『レビュー完了』を押して保存し、取消もできる。

## 機能要件

- `FR-001` (O1, I1): Reconciliation.tsx を 3 カラム、KPI 4 枚、下段プレビュー、選択中バーの構成にする。下段左は `mfOnly`、右は `reviewRows`。判定: DOM テストで構成と 6 状態 (理想/空/読込/部分/失敗/低速) が緑。
- `FR-002` (O1, I2): 候補一覧の検索 (取引内容・金額・メモ)・絞り込み・キュー選択・ページ送りと件数切替 (10 / 20 / 50 件) と条件リセット。 判定: DOM テストで絞り込み・検索・ページ送りの結果が変わり、リセットで初期状態に戻る。
- `FR-003` (O2, I3): core に照合判定関数を置き、5状態・KPI・`actionRequiredCount` を一度だけ導出する。判定: core が `review + unprocessed` と期間投影を検証し、照合ページ=ハブ (同期間)、サイドバー=月次クローズ (全期間) の契約テストが緑。
- `FR-004` (O3, I4): 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。 判定: API 統合テストが認証付きで照合 / 別取引 / 除外 / 一括 (201 件で 400、部分成功の内訳) / 取消 / 直前の操作の取得を検証し、migration が既存 D1 に冪等に適用され、元に戻すと KPI とキューが操作前の値に戻る。
- `FR-005` (O4, I5): routeMetadata のラベルとグループを画像に揃え、件数バッジ・月次クローズ 3/4 (月次レビュー完了の保存と取消)・ヘッダーのアイコンボタン・フッター・改善を送るボタンを共通シェルに入れる。 判定: shell 系 DOM テストを新文言・件数バッジ・月次クローズ 3/4・ヘッダーのアイコンボタン・フッターリンクで更新して緑、月次レビュー API の統合テストが緑。
- `FR-006` (O5, I6): 画像のアイコン一覧を docs に書き、RouteIcon に不足分を lucide-static 由来の SVG で登録して各箇所で表示する。 判定: docs のアイコン一覧と RouteIcon の登録名が一致し、route-icon-distinct テストと各表示箇所の DOM テスト (svg の存在と aria-hidden) が緑。
- `FR-007` (I7): 一致度・キュー・ステータス・月次クローズ判定の規則を docs に書き、docs/data-schema.md の古い候補条件 (L120-124) を直し、境界値テストで固定する。 判定: 規則を変えると core テストが落ちる。

## 非機能要件

- Performance: GET /api/reconciliation は loadDataset と freee 系テーブル・MF 除外・直前の操作を 1 リクエストで読み、既存 /total-cashflow と同程度の D1 読取りに保つ (d1-limits.ts の制限内)。一括操作は 200 件で打ち切る。
- Availability/Reliability: Worker・binding・cron・デプロイ経路を変えない。migration は追加だけにし deploy.yml の自動適用経路に乗せる。取消は 1 回の D1 batch で書き戻す。
- Accessibility/Usability: WCAG 2.2 AA を維持する。ステータスは文字のバッジ、一致の理由はチェックアイコンと文言、一致度は数値とバーの両方で示し、色だけに頼らない。操作の結果はその場で知らせる。ページ全体の横はみ出しは禁止し、比較表の内部横スクロールはラベル・キーボードフォーカス・タッチ操作を備える。
- Security/Privacy: 認証ゲート配下・userId で絞り込み・外部送信なし。検索語と絞り込みは URL にもサーバーにも送らない。取引内容は React のテキストとして描画し innerHTML を使わない。
- Maintainability/Operability: 判定は core に置き api/web へ重複実装しない (C1)。照合判断は duplicate_verdicts を総収支と共用する (C4)。規則は docs と境界値テストで固定する (G2)。

## UI・状態遷移

- 画面/CLI/API状態: 共通シェルの PageShell 上に、問いの見出し → 5 タブ → KPI 4 枚 → 左 (絞り込み・対応キュー) / 中央 (照合候補一覧) / 右 (取引の詳細と操作) → 下段の読み取り専用プレビュー (`mfOnly` / `reviewRows`) → 下部の選択中バーを置く。項目の意味は「状態・件数・投影の正本」、詳細な見た目は `design/FINAL-UI/images/04-reconciliation.png` を参照する。
- 情報の優先順位 (qa-ui-ux-web-rc-decision-006): ①照合候補一覧+取引の詳細パネル ②対応キュー ③KPI 4 枚 ④下段プレビュー ⑤絞り込み。PC は 3 列を保つ。狭幅では主要判断に必要な KPI→対応キュー→候補一覧→選択行の詳細を先にし、絞り込みは折りたたみ、下段は件数・代表行・導線だけに減らす。補助列は段階的に隠し、それでも収まらない比較表だけを枠内横スクロールにする。
- 遷移条件: タブ状態は URL (/analysis/:tab)、期間は既存どおり localStorage で全画面共有 (C3)。絞り込み・検索語・キュー選択・ページはコンポーネント状態。選択中の行は MF tx id で持ち、絞り込みで見えなくなった選択も選択中バーの件数に含め『選択をクリア』で外せる。
- Loading/Empty/Error: 読込・空・失敗・部分成功・確認の各状態を持つ (G1)。一括照合は確認ダイアログで件数を示す。取込と重なった書込 (409) は『取込中のため保存できませんでした』と出し再試行できる。解消率の分母 0 は『対象なし』と表示する。
- 共通シェル (G4): サイドバーの「照合」バッジと月次クローズの照合ステップは、全期間の同じ `actionRequiredCount` を表示する。シェルの文言・構成は `design/FINAL-UI/images/04-reconciliation.png` と `routeMetadata` の正本へ従う。

## ビジネスルールと検証

- `BR-001`: 一致度 = 金額一致 50 + 日付差 (同日 30 / 1 日 20 / 2 日 10 / 3 日 5) + 内容類似×20 の 100 点満点。内容点は二値化せず連続値 (qa-reconciliation-decision-003、qa-backend-web-rc-decision-013)。
- `BR-002`: 内容類似は NFKC・空白除去・小文字化で正規化した文字 bigram の Dice 係数。0.5 以上で『内容が似ている』。カナと英字の表記違い (アマゾン / Amazon.co.jp) は 0 になる限界を docs/data-schema.md に明記する。金額も表記も違う組は金額の差異キューに入らず、MFのみ (照合の対応は不要) と freee 側の一覧に別々に出る (qa-backend-web-rc-decision-011 / 012 / 013)。
- `BR-003`: 対応キュー『金額の差異』= MF の取引と freee の候補の日付差が ±3 日以内、かつ内容類似 0.5 以上、かつ金額不一致。『日付の近い取引』= 金額一致で日付差 1〜3 日 (G2、qa-backend-web-rc-decision-013)。
- `BR-004`: 5 状態と各意味は「状態・件数・投影の正本」の定義に従う。`MFのみ` を未処理や対応キューへ読み替えない。
- `BR-005`: 解消率 = 照合済み ÷ (照合済み + 要確認 + 未処理)。MFのみと除外は分母に入れない。分母 0 は『対象なし』と表示し、月次クローズの照合ステップは完了とする (qa-backend-web-rc-decision-010)。
- `BR-006`: 月次クローズの照合ステップとサイドバーの照合バッジは、全期間の `actionRequiredCount` が 0 かで自動判定する。`MFのみ` は数えない。月次レビューは利用者の完了操作を月単位で D1 に保存する (取消可)。
- `BR-007`: 照合判断は duplicate_verdicts を総収支と共用し、共通 bind で結び直す。すべての利用箇所は core の `actionRequiredCount` を使い、投影範囲だけを BR-006 と正本節 3 に従って変える。
- `BR-008`: 元に戻すは直前の操作 1 件 (一括なら一括単位) だけを操作前の判断状態へ戻す。取消済みの操作は再取消できない。中間の操作を戻すには各行の判断を解除する (qa-database-web-rc-decision-008)。
- `BR-009`: 一括操作は最大 200 件で、件ごとの成否を返す部分成功とする (C4、G3)。一括は「照合」「別の取引として処理」「照合から除外」を持つ。照合と別の取引は判断の要らない行 (照合済み・MFのみ・除外) を送らず、除外は除外済み以外をすべて送る (確認の済んだ MFのみの行を片付けられるようにするため、2026-09-16 利用者の指摘で追加)。一括照合は同じ freee の候補を指す 2 件目以降を送らず、API は判定器で組めない「同じ」を保存せず理由を返す (2026-09-16 利用者の指摘「複数選択したものの取引や照合ができない」で追加)。

## API契約

照合専用 API を新設する (qa-backend-web-rc-decision-007)。既存 GET /api/business-spend と GET /api/total-cashflow は残す。既存 POST /api/total-cashflow/verdicts は canonicalMutationFence の対象に加わる (qa-security-web-rc-decision-009)。月次レビュー完了の保存と取消の API は O4 で求められ、authGuard 配下へマウントする (auth.md) が、Method/Path は章に無いため下の overlay には含めず未決事項に置く。以下に api-contract overlay を合成する。

### API: GET /api/reconciliation

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。ルートの path で識別する。
- Method/Path: `GET /api/reconciliation`
- Purpose: 照合画面の KPI・キュー・候補一覧・下段プレビュー・直前の操作を 1 回で返す。
- Version/Lifecycle: 本サイクルで新設。バージョン分岐は持たない (専用アプリ向けの別版は対象外)。

#### 認証・認可

- Authentication: 既存セッション。/api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後にマウントする。
- Required scopes/roles: N/A: 役割による区別を持たない。認証済み利用者本人だけが呼べる。
- Resource ownership check: 全ての読取りを c.get('userId') で絞る。

#### Request

- Headers: N/A: 照合固有のヘッダーは無い。認証は既存セッションに従う。
- Path parameters: N/A: path パラメータは無い。
- Query parameters: 期間は既存の分析 API と同じ期間クエリで渡す。freee候補の有無・ステータス・対象年月・キュー・検索語・ページは送らない (web の状態で絞る、qa-frontend-web-rc-inference-002)。
- Body schema: N/A: GET のため body を持たない。
- Example: N/A: 逐語の例は章に無く、実装 task の契約テストで固定する。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 期間の照合レポート | KPI (事業支出・MFのみの件数と金額・`actionRequiredCount`・解消率)、対応キュー 4 分類の件数、期間内の候補全件 (ステータス・日付・MF の取引内容・金額・freee の候補・差額・一致度・一致の理由)、下段プレビュー (`mfOnly` / `reviewRows`)、直前の操作 |

応答の KPI は `actionRequiredCount` を含み、下段右は `rows` の `review` から作る。`unmatchedFreee` は全期間照合後の freee 残余を表示月へ投影した API 契約だが、現行 web では未使用。削除可否は別カードで整理する。

- Headers: 既存の secureHeaders と requestId を全体に掛ける構成を維持する。
- Example: N/A: 逐語のフィールド名は章に無く、実装 task で型と契約テストとして確定する。

#### Validation・ビジネスルール

- BR-001〜BR-005 と BR-007 を core の純関数 (推定 qa-backend-web-rc-inference-002 では reconciliationReport) で適用し、route は loadDataset・freee 系テーブル・MF 除外・操作履歴を読んで core へ渡す adapter に留める。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | 既存 authGuard の応答 | 未認証 | no | 既存どおりログインへ送る |
| 403 | password_change_required | 一時パスワード未変更 (mustChangePasswordFence) | no | パスワード変更へ進む |

- 照合固有のエラーコードは章で定めない。上表は既存ゲートの応答を踏襲する。画面は PageState の失敗状態を出す。

#### 実行セマンティクス

- Idempotency key/replay: N/A: 読取り専用の GET で副作用が無い。
- Concurrency/optimistic lock: N/A: 書込を伴わない。
- Transaction boundary: N/A: 書込が無い。
- Timeout/retry/rate limit: 1 リクエストの D1 読取りを既存 /total-cashflow と同程度に保ち d1-limits.ts の制限内に収める。レート制限の変更は無い。

#### キャッシュ・ページング

- Cache/ETag: web は queryKey ['reconciliation', period] で持ち、書込成功後に ['reconciliation', period]・analysisHubQueryKey・['total-cashflow', period]・['summary', period] を invalidate する (qa-frontend-web-rc-inference-002)。HTTP キャッシュヘッダーは章で定めない。
- Cursor/limit/filter/sort: サーバー側のページングは持たず期間内の候補全件を返す。ページ送り (10 / 20 / 50 件)・絞り込み・検索は web 側。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId ミドルウェアを使う。
- Metrics/logs/audit/redaction: N/A: 読取りで新しい監視対象・監査ログを追加しない。

#### セキュリティ確認

- Input/output validation: 期間クエリは既存の解釈に従う。出力は利用者本人のデータだけ。
- Sensitive data exposure: 外部サービスへ送信しない。検索語をサーバーへ送らないため取引内容がアクセスログに残らない。
- Abuse/authorization tests: 未認証で 200 を返さないこと、他利用者の判断・除外・履歴が混ざらないこと。

#### Contract tests

- Positive: 認証付きで 200 と KPI・キュー・候補を返す。
- Boundary: 一致度の境界 (日付差 0/1/2/3/4 日・金額不一致・内容類似 0/1)、内容類似ちょうど 0.5、解消率の分母 0、判断・除外の反映 (O2)。
- Negative/auth/error/idempotency: 未認証で 401。照合ページとハブの同期間一致、サイドバーと月次クローズの全期間一致を統合テストで固定する。

### API: POST /api/reconciliation/actions

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。ルートの path で識別する。
- Method/Path: `POST /api/reconciliation/actions`
- Purpose: 同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合を保存し、操作を履歴に残す (qa-backend-web-rc-decision-007、qa-reconciliation-decision-002)。
- Version/Lifecycle: 本サイクルで新設。

#### 認証・認可

- Authentication: 既存セッション。authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後にマウントする。
- Required scopes/roles: N/A: 役割による区別を持たない。
- Resource ownership check: 書き込む判断・除外・履歴はすべて c.get('userId') の行に限る。

#### Request

- Headers: N/A: 照合固有のヘッダーは無い。
- Path parameters: N/A: path パラメータは無い。
- Query parameters: N/A: 章は定めない。
- Body schema: zValidator で検証する。action は same / different / exclude-mf / exclude-freee の列挙、対象は 1〜200 件、tx id と freee key の形を検証する (security.md)。逐語のフィールド名は章に無い。
- Example: N/A: 逐語の例は章に無く、実装 task の契約テストで固定する。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 2xx (具体値は章で定めない) | 操作を受け付けた (部分成功を含む) | 件ごとの成否の内訳と、記録した操作 (直前の操作) |

- Headers: 既存の secureHeaders と requestId を維持する。
- Example: N/A: 逐語のフィールド名と成功時の status code は章で定めず、実装 task の契約テストで確定する。

#### Validation・ビジネスルール

- same / different は duplicate_verdicts へ、exclude-freee は freee_deal_exclusions へ、exclude-mf は新設 mf_tx_exclusions へ保存する。操作前の判断 (before) と操作後 (after) を reconciliation_actions に記録する (database.md)。
- 一括は最大 200 件で部分成功 (BR-009)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | N/A: コードは章で定めない | 入力検証違反 (201 件以上・列挙外の action・id 形式不正) | no | 送信内容を直す |
| 401 | 既存 authGuard の応答 | 未認証 | no | ログインへ送る |
| 403 | password_change_required | 一時パスワード未変更 | no | パスワード変更へ進む |
| 409 | canonical_write_busy | 取込 (POST /api/imports・/api/restore) と書込が重なった | yes | 『取込中のため保存できませんでした』を出し再試行させる |

#### 実行セマンティクス

- Idempotency key/replay: N/A: 章は idempotency key を定めない。
- Concurrency/optimistic lock: CANONICAL_MUTATION_ROUTES に加え、取込と排他する (qa-security-web-rc-decision-009)。
- Transaction boundary: 判断・除外と履歴の書込の境界は章で逐語に定めない。取消側は 1 回の D1 batch (下記 undo)。
- Timeout/retry/rate limit: 一括は 200 件で打ち切る。409 は再試行可。

#### キャッシュ・ページング

- Cache/ETag: 成功後に ['reconciliation', period]・analysisHubQueryKey・['total-cashflow', period]・['summary', period] を invalidate する。
- Cursor/limit/filter/sort: N/A: 書込 API でページングを持たない。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId を使う。
- Metrics/logs/audit/redaction: 操作の事実は reconciliation_actions に 90 日保存する。新しい監視・ログ出力は追加しない。

#### セキュリティ確認

- Input/output validation: action の許可リスト・件数 1〜200・id 形式を zValidator で検証する。
- Sensitive data exposure: 外部サービスへ送信しない。
- Abuse/authorization tests: 他利用者の明細への判断が書き込まれないこと、取込中の書込が 409 になること。

#### Contract tests

- Positive: 照合 / 別取引 / 除外 (MF・freee) がそれぞれ保存され、再読込後も保持される (S3)。
- Boundary: 200 件で受理、201 件で 400。部分成功の内訳 (O3)。
- Negative/auth/error/idempotency: 未認証で 401、列挙外 action で 400、取込と重なって 409。

### API: POST /api/reconciliation/actions/:id/undo

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。ルートの path で識別する。
- Method/Path: `POST /api/reconciliation/actions/:id/undo`
- Purpose: 直前の操作 (一括なら一括単位) を操作前の判断状態へ戻す (qa-database-web-rc-decision-008)。
- Version/Lifecycle: 本サイクルで新設。

#### 認証・認可

- Authentication: 既存セッション。authGuard 配下にマウントする。
- Required scopes/roles: N/A: 役割による区別を持たない。
- Resource ownership check: reconciliation_actions の user_id 一致を WHERE 条件に含め、他人の操作 id は存在の有無を漏らさず 404 にする (auth.md)。

#### Request

- Headers: N/A: 照合固有のヘッダーは無い。
- Path parameters: `id` = reconciliation_actions の操作 id。形式を検証する。
- Query parameters: N/A: 章は定めない。
- Body schema: N/A: 章は body を定めない。
- Example: N/A: 逐語の例は章に無い。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 2xx (具体値は章で定めない) | 取消を適用した | N/A: 応答の形は章で定めず、実装 task の契約テストで確定する |

- Headers: 既存の secureHeaders と requestId を維持する。
- Example: N/A: 章に無い。

#### Validation・ビジネスルール

- reconciliation_actions に保存した before を D1 batch で書き戻し、判断・除外・履歴の取消済みフラグを 1 単位で更新する。取消済みの操作は再取消できない (BR-008)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | 既存 authGuard の応答 | 未認証 | no | ログインへ送る |
| 403 | password_change_required | 一時パスワード未変更 | no | パスワード変更へ進む |
| 404 | N/A: コードは章で定めない | 操作 id が存在しない、または他利用者の操作 | no | 直前の操作を再取得する |
| 409 | canonical_write_busy | 取込と重なった | yes | 『取込中のため保存できませんでした』を出し再試行させる |

- 取消済みの操作を再度取り消そうとした場合の status/code は章で定めない (未決事項)。

#### 実行セマンティクス

- Idempotency key/replay: 取消済みは再取消不可のため同じ操作が 2 回適用されない。キーは持たない。
- Concurrency/optimistic lock: canonicalMutationFence の対象に加え取込と排他する。
- Transaction boundary: 1 回の D1 batch (cloudflare-d1-batch)。
- Timeout/retry/rate limit: 409 は再試行可。その他は章で定めない。

#### キャッシュ・ページング

- Cache/ETag: 成功後に actions と同じ queryKey 群を invalidate し、KPI とキューを操作前の値へ戻す。
- Cursor/limit/filter/sort: N/A: 単一操作の取消でページングを持たない。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId を使う。
- Metrics/logs/audit/redaction: 取消は reconciliation_actions の取消済みフラグとして残る。新しい監視は追加しない。

#### セキュリティ確認

- Input/output validation: path の id 形式を検証する。
- Sensitive data exposure: 他人の操作 id は 404 にして存在を漏らさない。
- Abuse/authorization tests: 他利用者の操作 id で 404、未認証で 401。

#### Contract tests

- Positive: 照合 → 取消で KPI とキューが操作前の値に戻る (O3)。一括の取消が一括単位で戻る。
- Boundary: 取消済みの操作を再取消できない。
- Negative/auth/error/idempotency: 他人の id で 404、未認証で 401、取込中で 409。

## データモデル

- Entity/Value: 既存 duplicate_verdicts・freee_deal_exclusions・monthly_close_reviews を共用し、0041 で mf_tx_exclusions と reconciliation_actions を追加する。
- Fields/Types/Nullability: 新表の逐語の列定義は章に無く、実装 task の migration と Drizzle 定義で確定する。
- Relations/Constraints/Indexes: 判断は bindDuplicateVerdicts が tx_id→stable_key の順で明細へ結び直す。新表の制約・インデックスは章で定めない。
- Ownership/Retention/Migration: 利用者の意思だけを保存し、派生値は保存しない。reconciliation_actions は 90 日保存。migration 0041 は新表 2 つの CREATE だけで、既存表の変更はない。

## 認証・認可

- Authentication: 既存セッションと authGuard を変えない。新しい認証経路・トークンは足さない。
- Authorization: 照合 API と月次レビュー API を /api/* の authGuard → mustChangePasswordFence の後にマウントし、route 内の認可は c.get('userId') で読み書きを絞ることだけに限る。
- Tenant/data boundary: undo は reconciliation_actions の user_id 一致を条件にし、他人の操作 id は 404。

## エラー・例外・回復

- Error taxonomy: 認証系は既存ゲートの 401/403、入力検証違反は 400 (201 件以上を含む)、取込との競合は 409 canonical_write_busy、他人または存在しない操作の取消は 404。解消率の分母 0 はエラーではなく『対象なし』。
- Retry/Timeout/Fallback: 409 は『取込中のため保存できませんでした』を出し再試行できる。一括は部分成功の内訳を画面に示す。
- Idempotency/Concurrency: 照合の書込系 (判断・除外・取消・月次レビュー) と総収支 verdicts を CANONICAL_MUTATION_ROUTES に加え取込と排他する。取消は D1 batch の 1 単位で、判断と除外と履歴の取消済みフラグが途中で分かれない。

## イベント・非同期処理

- Producer/Consumer: 90 日より古い reconciliation_actions は次の POST actions の D1 batch 内で削除する。夜間 cron は変更しない。
- Delivery/Ordering/Deduplication/DLQ: N/A: キュー・イベント配信を追加しない。キャッシュ無効化は書込成功時に web 内で同期的に行う。

## 可観測性

- Logs/Metrics/Traces/Audit: 既存 requestId を使う。操作の事実は reconciliation_actions に 90 日残る。新しいメトリクス・トレースは追加しない。
- Alert/SLO dashboard: N/A: 単独利用のため SLO は定義しない (infrastructure.md)。

## 互換性・移行・リリース

- Compatibility/versioning: 既存 GET /api/business-spend と GET /api/total-cashflow は残す。POST /api/total-cashflow/verdicts と freee-exclusions は取込中に 409 を返すようになる (qa-security-web-rc-decision-009)。/analysis/:tab と旧 URL のテストを維持する。サイドバー文言の変更に伴い shell 系・analysis-tabs / analysis-hub / analysis-navigation の DOM テストを更新する。
- Migration/backfill: 0041 で mf_tx_exclusions と reconciliation_actions を CREATE する追加だけの migration。既存 D1 に冪等に適用し、バックフィルは行わない。
- Rollout/rollback: 追加だけの migration は deploy.yml が自動適用し、migrate.yml の手動承認は不要。問題があれば直前のビルドへ戻す。binding・Worker は変えない。

## テストと受入条件

- [ ] `AC-001`: S1 (G1): /analysis/reconciliation で 04-reconciliation.png の構成要素がすべて描画され、トークン・共通 Button/PageShell 経由で直書き色 lint 0 件。
- [ ] `AC-002`: S2 (G2): 5状態・`actionRequiredCount`・全期間照合後の期間投影が固定され、照合ページ=ハブ (同期間)、サイドバー=月次クローズ (全期間) が一致する。
- [ ] `AC-003`: S3 (G3): 照合 / 別取引 / 除外 / 一括照合の結果が再読込後も保持され、元に戻すで操作前の状態に戻る。
- [ ] `AC-004`: S4 (G4): サイドバー文言と件数バッジ、月次クローズ 3/4、ヘッダーとフッターが画像どおりで、既存ルートと旧 URL のテストが緑。
- [ ] `AC-005`: S5 (G5): 画像のアイコンが全て表示され、絵柄の重複検査が緑。
- [ ] `AC-006`: S6 (G1-G5): pnpm test / typecheck / lint と packages/web の check 系が全て緑で、狭幅では 3 カラムが縦積みになる。ページ全体は横スクロールせず、比較表は枠内で実際に横移動でき、別行の実クリックで詳細が切り替わる。
- Contract/integration/e2e/security/performance: core の reconciliation テストで内容類似の値 (同一 1.0、共通 bigram 無し 0、Amazon.co.jp / アマゾン 0、ヤマト運輸 / ヤマト運輸株式会社 0.67、東京電力 / 東京ガス 0.33)、しきい値ちょうど 0.5 と 0.5 未満 (金額の差異キューの所属と内容行のチェックの両方)、日付差 3 日と 4 日・金額一致と不一致の組合せでキュー条件の各辺を 1 つずつ外すと所属が外れること、内容点の連続値を固定する (推定 qa-maintenance-ops-web-rc-inference-003)。API 統合テスト (O3)、月次レビュー API の統合テスト (O4)、DOM テスト (O1/O4/O5)、check:financial-routes / check:mobile-layout の対象に /analysis/reconciliation を含める。e2e テストは無い。

## 未決事項

- 一致度の丸め規則 (実装時決定): 内容点は 内容類似×20 の連続値だが、0.67 → 13.4 点のような端数の丸め規則が章に無い (completeness-findings decision_guidance low (a))。実装時に決めて docs/data-schema.md に書き、境界値テストで固定する。表示にしか使われず件数や分類は変わらない。
- Dice の重複 bigram の数え方 (実装時決定): 同じ bigram が繰り返し出る摘要で、多重集合として数えるか集合として数えるかが定まっていない (同 low (a))。評価者の再計算では提示 8 組の値はどちらでも同じ。実装時に決めて docs とテストへ書く。
- 0.5 ちょうどの比較方法 (実装時決定): 『0.5 以上』は決定済みだが、浮動小数で計算した類似度をちょうど 0.5 と比べる方法 (誤差の扱い) が定まっていない (同 low (a))。実装時に決めて境界値テスト (ちょうど 0.5 の組は『似ている』) で固定する。
- しきい値の本文反映: backend.md の設計本文 (inference-002) と O2 の測定文に 0.5 がまだ書かれていない (同 low (b))。本書は決定 qa-backend-web-rc-decision-013 を正本として記述した。
- 月次レビュー API の Method/Path・応答形、取消済み操作の再取消時の status/code、POST actions の成功時 status と逐語フィールド名は章に無い。実装 task で契約テストとして確定する。
- decisions[] が 0 件のまま (同 low (c))、hearing_progress が第4周を数えていない (matrix_coverage low)。判定には影響しない。

## 確定意思決定

- `qa-reconciliation-decision-001`: 共通シェルの差分 (月次クローズ 3/4・ヘッダー・フッター) を全て今回直す (他案: 照合ページ本体だけ / アイコンと文言だけ)。
- `qa-reconciliation-decision-002`: 既存表を再利用し拡張する。判断は duplicate_verdicts を共用し、verdict 取消 API・MF 側の除外・照合操作の履歴表を migration で足す (他案: 照合専用の新テーブル / DB 変更なしで直前 1 操作の逆操作だけ)。
- `qa-reconciliation-decision-003`: 一致度を単純な加点規則 (金額 50 + 日付 30/20/10/5 + 内容類似×20) で core に置く (他案: 一致度を出さずチェック表示だけ)。
- `qa-reconciliation-decision-004`: サイドバーの文言もバッジも画像に揃え、ページ見出し・パンくず・コマンドパレットも追随させる (他案: バッジだけ / 照合子行のバッジと月次クローズカードだけ)。
- `qa-reconciliation-decision-005`: 月次クローズは 3 つ自動+レビュー手動 (他案: 4 つとも自動 / 判定を持たず見た目だけ)。
- `qa-backend-web-rc-decision-007`: 照合専用 API (GET /api/reconciliation、POST /api/reconciliation/actions、POST /api/reconciliation/actions/:id/undo) を新設し既存 API は残す (他案: 既存 total-cashflow API を拡張)。
- `qa-database-web-rc-decision-008`: 直前の操作 1 件+履歴は 90 日保存、取消済みは再取消不可 (他案: 履歴から任意の操作を戻す / 画面内の直前 1 件のみで履歴を保存しない)。
- `qa-security-web-rc-decision-009`: 照合の書込系を canonicalMutationFence の対象に追加し、総収支 verdicts も揃える (他案: 現行どおり排他しない)。
- `qa-backend-web-rc-decision-010`: 解消率は除外を分母から外し、分母 0 は『対象なし』で照合ステップ完了 (他案: 除外も解消に数える / 分母 0 を 0% 表示)。
- `qa-backend-web-rc-decision-011`: 内容類似は文字 bigram の Dice 係数 (他案: 完全一致 1・包含 0.5・他 0 / 編集距離)。
- `qa-backend-web-rc-decision-012`: カナと英字の表記違いが 0 になる限界を踏まえても Dice のまま、限界を docs に明記 (他案: Dice+読み替え辞書 / 完全・部分一致に変更)。
- `qa-backend-web-rc-decision-013`: 『内容が似ている』のしきい値は 0.5 以上。金額の差異キューと一致の理由の内容行の 2 か所に使い、内容点は連続値のまま (他案: 0.3 以上 / 0 より大きい)。
- `qa-ui-ux-web-rc-decision-006`: 候補一覧と詳細が主役。①一覧+詳細 ②キュー ③KPI ④下段 ⑤絞り込み、狭幅は縦積みで絞り込みを折りたたむ (他案: KPI が主役 / 画像どおり差を付けない)。
