---
graph_node_id: "spec-analysis-hub"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "支出分析ハブ 仕様"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub"]
file_path: "specs/spec-analysis-hub.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-15-analysis-hub/completeness-findings.json", "evaluated_digest": "6e1542b3438e1de3e5c76782e98faadf8de20c524449a4f97173973ed4578b56"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-15-analysis-hub/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "6e1542b3438e1de3e5c76782e98faadf8de20c524449a4f97173973ed4578b56", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: []
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "docs/ui-decisions.md"]
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
classification_reason: "system-spec の要件定義書 (U1-U9) を実装計画の入口として参照する単一の specification。API 変更 (GET /api/analysis/hub 新設) があるため api-contract overlay を合成する。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-analysis-hub.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 支出分析ハブ 仕様

本書は `system-spec/00-requirements-definition.md` (承認 `appr-foundation-analysis-hub-001`) を dev-graph の specification として参照する入口である。規範本文は system-spec 側が正本で、ここでは実装計画が必要とする節だけを要約し、領域別の制約は architecture ノード (arch-analysis-hub-ui-ux, arch-analysis-hub-frontend, arch-analysis-hub-backend, arch-analysis-hub-database, arch-analysis-hub-auth, arch-analysis-hub-security, arch-analysis-hub-infrastructure, arch-analysis-hub-maintenance-ops) に分ける。完成度評価は `system-spec/completeness-findings.json` (verdict PASS)。

## 目的と成功状態

支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。利用者が支出分析を開いた時点で、期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、差異を消す→全体を掴む→偏りを見る→変化を追う→行動を決める の読み順で改善行動まで迷わず進める状態にする (U1)。

成功状態:
- S1 (G1): /analysis で 03-analysis-hub.png の構成要素 (問いの見出し・URL コピー・5 タブ・収支サマリー・分析ルート一覧・選択中の分析パネル・読み順・下部バー) がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。
- S2 (G2): ?focus= の値でハブの選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑である。
- S3 (G3): ハブ表示中のネットワーク呼出しは GET /analysis/hub の 1 本で、既存 5 API の呼出しが 0 件である。
- S4 (G3, G4): core テストが前 12 か月比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている。
- S5 (G5): 5 タブ名が短縮形で表示され、サイドバー子行の件数バッジが要確認件数と一致する。
- S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) が緑のままで、狭幅 (68px アイコンレール・下部タブ) でもハブが横スクロールしない。

## スコープ

- In:
  - /analysis のハブ画面 (03-analysis-hub.png の全構成要素) の新設と、/analysis から照合タブへの転送の廃止
  - 選択中の分析の URL 保持 (?focus=) と URL コピー
  - packages/core のハブ集計純関数 (期間合計・前期間比・5 視点の状態・優先度・改善余地) と、前期間計算 (previousPeriod) の api/ai/dataset.ts から core への移設
  - packages/api の集約エンドポイント GET /api/analysis/hub
  - 判定規則の docs 記載と境界値テスト
  - 5 タブ名の短縮形化とサイドバー支出分析子行の件数バッジ、それに伴う既存 DOM テストの文言更新
- Out:
  - 5 タブ各詳細画面 (照合・総収支・マトリクス・推移・診断) の中身の作り直し (各画面のサイクル)
  - 支出分析以外のサイドバー文言 (明細仕分け・累計収支など) と月次クローズ進捗 3/4 チェックリストの形
  - 期間選択の保存先の変更 (期間は既存どおり localStorage で全画面共有し URL に載せない)
  - D1 スキーマ・migration の変更
  - スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| ハブ | /analysis に描画する支出分析の入口画面 (AnalysisHub) |
| 5 視点 | 照合 / 総収支 / マトリクス / 推移 / 診断。ANALYSIS_TABS の 5 タブと 1 対 1 |
| focus | 選択中の分析。URL の ?focus= に ANALYSIS_TABS の id で持つ |
| 前期間 | previousPeriod(p): 選択期間の直前にある同じ月数の期間。ラベルは『前 N か月』 |
| 優先度 | 視点ごとの要確認の強さ (高/中)。規則は G4 |
| 改善余地 | tradeoffCandidates の月額合計 × 12 の年額 |
| 利用者 | 単独の個人事業主 1 名 (SH1) |
| 保守者 | 同一人物とコーディングエージェント (SH2) |

## ユースケースとユーザーフロー

1. 月次クローズで /analysis を開くと、照合タブへ転送されずハブが出て、期間の収支サマリーと 5 視点の状態・優先度を 1 画面で見比べられる。
2. 分析ルート一覧の行を選ぶと ?focus= が履歴を積まずに置き換わり、右の選択中の分析パネルと下部バーが切り替わる。
3. 『このページの URL をコピー』で /analysis?focus=(タブ id) をクリップボードへ書き、成否が表示される。再読込・戻る・共有先でも同じ分析が選ばれる。
4. 『○○を開く』またはタブで既存の /analysis/:tab 詳細へ進む。
5. どの画面でも、サイドバーの支出分析子行に要確認 1 件以上の視点だけ件数バッジが出る。

## 機能要件

- `FR-001` (O1, I1): /analysis がハブ (見出し・サマリー・ルート一覧 5 行・読み順 5 ステップ・選択中の分析パネル) を描画し、/analysis/:tab と旧 URL の転送は既存どおり動く。 判定: DOM テストでハブ要素の描画と、既存 5 タブ・旧 URL テストの緑。
- `FR-002` (O2, I2): ?focus= の読み書きと URL コピー。 判定: ?focus=total-cashflow で総収支行・右パネル・下部バーが選択状態になり、行選択で URL が置き換わり、不正な focus は既定値に落ち、URL コピーが現在の URL をクリップボードへ書く。
- `FR-003` (O3, I3, I4): core に analysisHub(dataset) 相当の純関数を置き、GET /api/analysis/hub が期間メタ・収支サマリー (前期間比)・5 視点の状態・優先度を返す。前期間計算は core へ移し AI 側もそれを使う。 判定: core 単体テスト、認証付き API 統合テストの 200 と期間メタ、ハブ表示中の既存 5 API 呼出し 0 件。
- `FR-004` (O4, I5): 優先度・マトリクス正常判定・改善余地の規則を docs に書き境界値テストで固定する。 判定: 要確認 0/1 件、未記録月 0/1、tradeoff 候補 0 件の境界で規則どおりの値を返し、規則を変えるとテストが落ちる。
- `FR-005` (O5, I6): ANALYSIS_TABS の label を 照合/総収支/マトリクス/推移/診断 にし、サイドバー子行に件数バッジを付ける。 判定: analysis-tabs / navigation-ux / common-shell-routes の DOM テストを新文言で更新して緑、バッジは要確認 1 件以上の視点だけ。
- `FR-006` (I7): 各視点の『わかること・主なデータソース・対象外のデータ』を routeMetadata の静的定義とし、右パネルが表示する。 判定: FR-001 の DOM テストで右パネルの 3 項目が描画される。

## 非機能要件

- Performance: ハブ表示中の API は GET /api/analysis/hub の 1 本。サイドバーとハブは queryKey ['analysis-hub', 期間 key] を共有し、staleTime で画面遷移ごとの再取得を抑える。1 リクエストの D1 読取りは既存 /total-cashflow と同程度 (d1-limits.ts の制限内)。
- Availability/Reliability: Worker・binding・cron・デプロイ経路を変えず、既存 Worker に GET ルートを 1 本足すだけにする。
- Accessibility/Usability: WCAG 2.2 AA (文字 4.5:1、部品 3:1)。増減は符号と色、優先度は文字のバッジで示し色だけに頼らない。狭幅で横スクロールしない。
- Security/Privacy: 認証ゲート配下・userId で絞り込み・外部送信なし。コピーする URL に金額・取引・期間を載せない。
- Maintainability/Operability: 集計は core に置き api/web へ重複実装しない (C1)。判定規則は docs とテストで固定する (G4)。

## UI・状態遷移

- 画面/CLI/API状態: 共通シェルの PageShell 上に、問いの見出し → URL コピー → 5 タブ → 期間の収支サマリー (右に純収支の説明パネル) → 分析ルート一覧 → 選択中の分析パネル (--aside-panel-w 320px) → 分析の読み順 → 下部の選択中分析バー。情報の優先順位は ①ルート一覧の状態と優先度 ②収支サマリー ③選択中の分析パネル ④読み順 (qa-ui-ux-web-ah-decision-005)。画像の縦の並びは保ち、主役は視覚的な強さで示す。
- 遷移条件: 行選択で ?focus= を replace。focus は ANALYSIS_TABS の id の許可リストで検証し、不正値は既定値。『開く』とタブで /analysis/:tab へ遷移。
- Loading/Empty/Error: 前期間の月が 1 か月でも欠けたら比較を『比較データなし』と表示し 0% と誤読させない。狭幅では ③ を一覧の下へ落とし、④ を縦積みにする。

## ビジネスルールと検証

- `BR-001`: 優先度は照合と総収支が要確認 1 件以上なら高・0 件なら中。マトリクス・推移・診断は中 (qa-analysis-hub-decision-003)。
- `BR-002`: マトリクスは未記録月 0 なら正常。
- `BR-003`: 改善余地は tradeoffCandidates の月額合計 × 12 の年額。
- `BR-004`: 前期間比の比較先は previousPeriod(p)。ラベルは『前 N か月』(1 年選択時は『前12か月』)。前期間の月が 1 か月でも欠ければ null (qa-backend-web-ah-decision-003)。
- `BR-005`: 総収支は freee を正本とした消し込み済みの値を使い、未判断の重複候補は 4 区分の合計に入れない (C4)。件数は totalCashflowReport を再利用し数え直さない。

## API契約

GET /api/analysis/hub を新設する (要件定義書の表記は `GET /analysis/hub`、`/api` 配下へマウントする)。既存 5 API (/business-spend・/total-cashflow・/matrix・/trends・/diagnosis) の契約は変えない。以下に api-contract overlay を合成する。

### API: GET /api/analysis/hub

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。ルートの path で識別する。
- Method/Path: `GET /api/analysis/hub`
- Purpose: ハブ画面とサイドバーの件数バッジに必要な期間メタ・収支サマリー・5 視点の状態と優先度を 1 回で返し、既存 5 API を呼ばずに済ませる (qa-analysis-hub-decision-002)。
- Version/Lifecycle: 本サイクルで新設。バージョン分岐は持たない (専用アプリ向けの別版は対象外)。

#### 認証・認可

- Authentication: 利用者アカウント (メールアドレス + パスワード、PR #47) のセッション。/api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard の後にマウントする。
- Required scopes/roles: N/A: 役割による区別を持たない。認証済み利用者本人だけが呼べる。
- Resource ownership check: loadDataset と freee_deals・duplicate_verdicts・freee_deal_exclusions の読取りをすべて c.get('userId') で絞る。

#### Request

- Headers: N/A: ハブ固有のヘッダーは無い。認証は既存セッションに従う。
- Path parameters: N/A: path パラメータは無い。
- Query parameters: 期間は既存 loadScoped と同じく core の resolvePeriodQuery が解釈する from / to / year / span。web は usePeriod().withPeriod で付与する。focus は API へ渡さない (queryKey は期間 key だけ)。
- Body schema: N/A: GET のため body を持たない。
- Example: N/A: 逐語の例は章に無く、実装 task の契約テストで固定する。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 期間のハブ集計 | 期間メタ (PeriodMeta: applied / label / full / years / monthCount)、収支サマリー (総収入・総支出・純収支、前期間の金額と増減率。前期間が 1 か月でも欠けたら比較値は null)、5 視点の現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前期間比・診断の改善余地) と優先度 |

- Headers: 既存の secureHeaders と requestId を全体に掛ける構成を維持する。
- Example: N/A: 逐語のフィールド名は章に無く、実装 task で型と契約テストとして確定する。

#### Validation・ビジネスルール

- BR-001〜BR-005 を core の純関数で適用し、route は読取りと受け渡しだけを持つ。期間の解釈は resolvePeriodQuery / applyPeriod に従い、前期間は all から切り出す (loadScoped は期間で切ったデータしか渡さないため)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | 既存 authGuard の unauthorized | 未認証 | no | 既存どおりログインへ送る |
| 403 | password_change_required | 一時パスワード未変更 (mustChangePasswordFence) | no | パスワード変更へ進む |

- ハブ固有のエラーコードは章で定めない。上表は既存ゲート (packages/api/src/auth.ts) の応答を踏襲する。

#### 実行セマンティクス

- Idempotency key/replay: N/A: 読取り専用の GET で副作用が無い。
- Concurrency/optimistic lock: N/A: 書込を伴わない (canonicalMutationFence の対象外)。
- Transaction boundary: N/A: 書込が無い。
- Timeout/retry/rate limit: 1 リクエストの D1 読取り本数を既存 /total-cashflow と同程度に保ち、D1 の上限 (Free 50 / Paid 1000 クエリ/invocation) 内に収める。レート制限の変更は無い。

#### キャッシュ・ページング

- Cache/ETag: web 側 TanStack Query の queryKey ['analysis-hub', 期間 key] をサイドバーとハブで共有し staleTime で再取得を抑える。総収支の判定・freee 除外・取込の成功後は invalidateQueries({ queryKey: ['analysis-hub'] }) で前方一致の無効化をする。HTTP キャッシュヘッダーは章で定めない。
- Cursor/limit/filter/sort: N/A: 一覧のページングを持たない固定形の集計応答。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId ミドルウェアを使う。
- Metrics/logs/audit/redaction: N/A: 新しい監視対象・監査ログを追加しない。

#### セキュリティ確認

- Input/output validation: 期間クエリは既存 resolvePeriodQuery で解釈する。出力は利用者本人の集計値だけ。
- Sensitive data exposure: 外部サービスへ送信しない。コピーする URL に財務情報を含めない。
- Abuse/authorization tests: 認証なしで 200 を返さないこと、他利用者のデータが集計に混ざらないこと。

#### Contract tests

- Positive: 認証付きで 200 と期間メタを返す (O3)。
- Boundary: 要確認 0/1 件、未記録月 0/1、tradeoff 候補 0 件、前期間の月の欠け 0/1 で規則どおりの値 (O4)。
- Negative/auth/error/idempotency: 未認証で 401。ハブ表示中の DOM テストで既存 5 API の呼出しが 0 件 (S3)。

## データモデル

- Entity/Value: ハブ集計 (期間メタ・収支サマリー・5 視点の状態と優先度)。永続化しない派生値。
- Fields/Types/Nullability: 前期間の比較値は前期間の月が 1 か月でも欠ければ null。その他の逐語フィールドは実装 task で型として確定する。
- Relations/Constraints/Indexes: 既存の monthly_agg・restored_monthly_agg ほか取引系テーブルと freee_deals・duplicate_verdicts・freee_deal_exclusions を読むだけ。新しいテーブル・列・インデックスは無い。
- Ownership/Retention/Migration: 規則は packages/core が所有する。migration は 0039_account_login.sql のまま増やさない。

## 認証・認可

- Authentication: 既存セッション (PR #47) と authGuard を変えない。
- Authorization: route 内の認可判断は userId での絞り込みだけ。未認証の画面ではバッジ用クエリを張らない。
- Tenant/data boundary: 全ての読取りを userId で絞り、共有された ?focus= 付き URL を他人が開いても本人のデータしか集計されない。

## エラー・例外・回復

- Error taxonomy: 認証系は既存ゲートの 401/403。前期間の欠けはエラーではなく null と『比較データなし』。
- Retry/Timeout/Fallback: クリップボード書込が拒否 (NotAllowedError) されたときは成否を画面で知らせ、例外を握りつぶさない。不正な focus 値は既定の分析へ落とす。
- Idempotency/Concurrency: N/A: 読取り専用で並行更新を扱わない。

## イベント・非同期処理

- Producer/Consumer: N/A: 非同期処理・イベントを追加しない。
- Delivery/Ordering/Deduplication/DLQ: N/A: 同上。キャッシュ無効化は更新系の成功時に web 内で同期的に行う。

## 可観測性

- Logs/Metrics/Traces/Audit: N/A: 実行時の信号を追加しない。既存 requestId を使い、検証は CI のテストで行う。
- Alert/SLO dashboard: N/A: 新しい監視対象を作らない。

## 互換性・移行・リリース

- Compatibility/versioning: /analysis/:tab と LEGACY_ROUTE_REDIRECTS (/reconciliation・/matrix・/trends・/diagnosis) を維持する。C3『表示していないタブの API は呼ばない』の対象は 5 タブ個別 API に限り、ハブ API はその例外として docs/ui-decisions.md に明記する。
- Migration/backfill: スキーマ変更・バックフィルは無い。previousPeriod を core へ移し AI 側 (api/ai/dataset.ts) もそれを使う。
- Rollout/rollback: 既存 CI・deploy 経路で配信し、問題があれば直前のビルドへ戻す。migration が無いのでスキーマの巻き戻しは発生しない。

## テストと受入条件

- [ ] `AC-001`: S1 (G1): /analysis で画像の構成要素がすべて描画され、トークン・共通 Button/PageShell 経由で直書き色 lint 0 件。
- [ ] `AC-002`: S2 (G2): ?focus= で選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑。
- [ ] `AC-003`: S3 (G3): ハブ表示中の呼出しは GET /api/analysis/hub の 1 本で、既存 5 API は 0 件。
- [ ] `AC-004`: S4 (G3, G4): core テストが前期間比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている。
- [ ] `AC-005`: S5 (G5): 5 タブ名が短縮形で、サイドバー子行の件数バッジが要確認件数と一致する。
- [ ] `AC-006`: S6 (G1-G5): 既存 test / typecheck / lint と check 系が緑で、狭幅でハブが横スクロールしない。
- Contract/integration/e2e/security/performance: core 境界値テスト (O3/O4)、API 統合テスト (認証付き 200・期間メタ)、ハブ・focus・URL コピーの DOM テスト (O1/O2)、タブ文言とバッジの DOM テスト (O5)、check:mobile-layout / check:financial-routes の対象に /analysis を含める。

## 未決事項

- `staleTime`: 『設ける』ことだけが決まり、値も算定基準も章に無い (completeness-findings low)。実装時に方針を決め、TanStack Query の Important Defaults を出典に加える。
- `qa-frontend-web-ah-decision-003` の束ねた論点: invalidate の対象範囲と staleTime の方針を、次に reopen する際に分割して確認する (gaps・medium 据え置き)。
- 置換済み inference qa の残存: backend.web / ui-ux.web の qa_refs に qa-backend-web-ah-inference-002 / qa-ui-ux-web-ah-inference-002 が supersede 宣言なしで残る。ui-ux.md の inference 本文にある細部 (純収支説明パネルの狭幅折りたたみ、金額の等幅数字など) は利用者確定ではないため、実装で採る場合は既存 docs/design-system の観測事実へ接地させるか利用者確認に回す (gaps・medium 据え置き)。
- 上位概念の文言: U8 C3 にハブ API の例外が、O3/I3 に『1 か月でも欠けたら null』が追記されていない。決定 qa が正本であり本書は決定側で記述した (findings low)。
- 出典 summary: react-router-use-search-params の dist-tags の対象パッケージ名 (react-router / react-router-dom) を明記する (gaps・low、判定に影響しない)。

## 確定意思決定

- `qa-analysis-hub-decision-001`: /analysis をハブにし、各行やタブの『開く』で既存 /analysis/:tab へ進み、選択中の分析を ?focus= で URL に持つ (他案: 転送を残し 5 タブすべての上部にハブ要素を常時表示)。
- `qa-analysis-hub-decision-002`: core 純関数 + GET /analysis/hub の集約 API を新設し、前期間計算を core へ移す (他案: 既存 5 API を同時に呼び、前 12 か月比と改善余地は省く)。
- `qa-analysis-hub-decision-003`: 優先度・正常判定・改善余地を単純な規則で定義し docs とテストで固定する (他案: 件数と前 12 か月比だけにする)。
- `qa-analysis-hub-decision-004`: 支出分析の 5 タブ名とサイドバー子行 (件数バッジ含む) だけ短縮形に揃える (他案: サイドバー全体と月次クローズも合わせる / 文言は現行のまま)。
- `qa-backend-web-ah-decision-003`: 前期間は直前の同じ長さ (previousPeriod)、ラベル『前 N か月』、1 か月でも欠けたら比較データなし (他案: yearAgoPeriod / 1 年選択時だけ比較)。
- `qa-frontend-web-ah-decision-003`: Layout とハブで queryKey ['analysis-hub', 期間 key] を共有し、ハブ API を C3 の例外として docs に明記、更新成功で invalidate、staleTime を設ける (他案: バッジは支出分析内だけ)。
- `qa-ui-ux-web-ah-decision-005`: 情報の優先順位 ①ルート一覧の状態と優先度 ②収支サマリー ③選択中の分析パネル ④読み順。画像の縦の並びは保つ (他案: サマリーを主役 / 差を付けない)。
