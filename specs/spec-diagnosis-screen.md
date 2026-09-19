---
graph_node_id: "spec-diagnosis-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api"]
title: "診断画面 (08-diagnosis) の仕様"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["diagnosis", "analysis", "system-spec-import"]
file_path: "specs/spec-diagnosis-screen.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence:
  evaluator: "system-spec-harness/assign-system-spec-completeness-evaluator@0.1.14"
  evidence_ref: "system-spec/completeness-findings.json"
  evaluated_digest: "bdf85a500e716a7cc8a76dd25d91d5c9ff1cae62ab1b9002cbbd197fe0a75047"
source_lineage:
  origin_kind: "system-spec-harness"
  source_plugin: "system-spec-harness"
  source_path: "system-spec/index.md"
  source_version: "0.1.14"
  source_digest: "bdf85a500e716a7cc8a76dd25d91d5c9ff1cae62ab1b9002cbbd197fe0a75047"
  imported_at: "2026-09-18T01:29:14Z"
created_at: "2026-09-18T01:29:14Z"
updated_at: "2026-09-18T01:29:14Z"
depends_on: []
related_nodes: ["arch-diagnosis-screen"]
resource_scope:
  - "packages/core/src"
  - "packages/api/src/routes"
  - "migrations"
  - "packages/web/src/pages/analysis"
  - "docs"
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
classification_reason: "system-spec-harness の確定章 (要件定義書 U1-U9 と ui-ux / frontend / backend 章) を出典とする画面と API の振る舞い仕様であり、artifact_kind=specification に一意に定まる。API を新設・拡張するため artifact_subtypes に api を含める。"
classification_candidates: []
tracker_binding: "none"
beads_linkage: null
github_publication:
  mode: "local_only"
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: "manual"
  status: "not_applicable"
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: "complete"
  missing_sections: []
  checked_at: "2026-09-18T01:29:14Z"
---

<!-- 本書は診断画面の観測可能な振る舞いの正本。依存と設計判断は architecture、算式は docs/diagnosis-screen.md を参照する。 -->

# 目的と成功状態

『次に何を改善すると最も効くのか』を診断画面の 1 画面で決められるようにする。利用者が /analysis/diagnosis を開いた時点で、選んだ期間の収支データから見つかった改善余地が年間の改善インパクト順に並び、なぜその順位なのか (根拠の数値・出典・信頼度)、対応にどれだけ手間がかかるか、いま自分がどこまで対応したかが読め、次の操作 (明細仕分け・予算・サブスク・照合) へそのまま進める状態になっている。

成功時に観測できる状態は system-spec の成功基準 S1-S6 (`system-spec/00-requirements-definition.md`) と同一である。要約すると、画像 08-diagnosis.png の全ブロックが描画され、検知器を 1 件足すだけで画面と API を編集せずに新しい課題が現れ、健全性スコアが内訳まで再現でき、対応状況が期間切替と再取込をまたいで復元され、実行先へ対象を絞った状態で遷移でき、数値が総収支・推移画面と一致する。

## スコープ

- In: 診断タブの画面構成の作り直し (期間タブ、問いの見出し、条件の帯、診断結果カード、健全性カード、主なシグナル、改善アクションの優先順位の表、改善インパクトのウォーターフォール、診断根拠の表、完了すると変わる指標、詳細パネル 3 タブ、選択バー、既存の科目別プロファイルと自動診断の開閉化)、packages/core の検知器レジストリ (8 種) と健全性スコア、GET /api/diagnosis の条件と返却の拡張、対応状況の保存と取得の API、D1 の新表と migration、実行先への絞込クエリ、docs/diagnosis-screen.md とテスト。
- Out: AI による改善提案の生成 (外部送信および LLM 呼出しを行わない)、改善の実行そのもの (解約手続きや契約変更の代行)、今回登録する 8 種以外の検知器の実装、外部ベンチマーク (業種平均・世帯平均) との比較、取引先の名寄せ規則、共通シェルの作り直し、web 以外の platform 向けの専用アプリ。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 検知器 (detector) | `{ id, label, detect(data) }` の形で packages/core に登録する改善余地の見つけ方。登録済みは 固定費の見直し / 急増した費目 / 重複支払いの候補 / サブスクの重複候補 / 未分類明細 / 通信費の見直し / 収入の落ち込み / 継続する赤字 の 8 種。 |
| 改善余地 (Improvement) | 検知器が返す 1 件の課題。金額・根拠・手間・信頼度・次のアクション先に加え、`impactBasis`・`scope`・`metric`・`claimKeys` を持ち、画面は種類を知らずに描ける。 |
| action_key | 検知器 id と対象キーから決まる安定キー。`user_id` と組み合わせて利用者の判断を識別し、明細が更新されても同じ課題には同じキーが付く。 |
| 健全性スコア | 固定費比率・貯蓄率・収支の安定性・データカバー率の 4 要素を重み 30/30/25/15 で合成した 0-100 の指標。区分は 健全 / 注意 / 要改善。 |
| 分析の範囲 | 事業 / 家計 / 総合 の 3 値。取引集合の切り方であり、総合 = 事業 + 家計 が成り立つ。 |
| SH1 利用者 | 単独の個人事業主。月次の振り返りで次に手を付ける 1 件を決め、その場で実行先へ進む。 |
| SH2 保守者 | 同一人物およびコーディングエージェント。観点を足すときに画面と API を編集せずに済み、境界値テストで壊れたことが分かる状態を求める。 |
| SH3 データ提供元 | MoneyForward の明細 CSV と freee の取引。取込済みの範囲でしか診断できないため、データカバー率を画面に示す。 |

## ユースケースとユーザーフロー

1. 利用者が /analysis/diagnosis を開く。期間タブ (1年 / 2年 / 3年 / 任意) と条件の帯 (範囲・指標・比較対象) の既定値で診断が読み込まれ、改善余地が年間インパクトの降順で並ぶ。
2. 利用者が診断結果カードと健全性カードで結論を読み、健全性の内訳を開いてどの要素が点を落としているかを確かめる。
3. 利用者が改善アクションの表から 1 行を選ぶ。詳細パネルが開き、概要 / 関連データ / 明細サンプル の 3 タブでなぜ優先度が高いのかと根拠の明細を読む。
4. 利用者が下部の選択バーでステータスを 対応中 へ変更する。サーバへ PATCH が飛び、成功後に診断を取り直して合計金額と畳みが更新される。
5. 利用者が『明細仕分けで確認』を押す。/classify が期間・範囲・カテゴリ・取引先で絞られた状態で開く。
6. 後日、利用者が同じ画面を別の期間で開く。対応中の判断が復元され、対応済みと見送りは畳まれて合計から外れ、畳んだ件数と金額が注記に出る。

## 機能要件

- `FR-001`: 画面は期間タブ・問いの見出し・条件の帯・診断結果カード・健全性カード・主なシグナル (最大 3 件)・改善アクションの表・ウォーターフォール・診断根拠の表・完了すると変わる指標・詳細パネル・選択バーを描画する。
- `FR-002`: 改善アクションの表の列は 番号・優先度・課題・年間改善インパクト・対応の手間・ステータス・次のアクション とし、既定の並びは年間改善インパクトの降順、番号はその順位とする。
- `FR-003`: 対応済みと見送りの行は既定で畳み、改善余地の合計から除外する。畳んだ件数と金額を注記に出し、『対応済みも表示』で再表示できる。
- `FR-004`: 検知器は packages/core のレジストリへ登録し、各候補が impactBasis・scope・metric・claimKeys を自己記述する。`detectImprovements()` は登録済み検知器を実行して selection と claim 排他を適用し、`diagnosisScreen()` は既存診断、健全性、改善項目、図表を組み立てる。packages/web と packages/api に検知器 id の分岐を置かない。
- `FR-005`: 健全性スコアは 4 要素を 0-100 の要素スコアへ正規化してから重み 30/30/25/15 を掛けて合成し、実測値・要素スコア・重み・寄与点を内訳として返す。要素が算出不能な場合はその要素を除いて重みを正規化し、その旨を画面に示す。
- `FR-006`: ウォーターフォールは左端に選択中の指標の現状年額、中間に項目ごとの改善、右端に改善後の年額を置き、表と同じ並び順で積む。支出は改善額を引き、収入・純収支は改善額を足す。
- `FR-007`: 診断根拠の表は データソース・対象期間・カバー率・主な内容 を行として持ち、各行はデータ取込 (/import) の該当ソースへ辿れる。
- `FR-008`: 改善アクションの対応状況 (未着手 / 対応中 / 対応済み / 見送り) と任意のメモ・決定時刻を D1 に保存し、期間切替・再取込・再ログインをまたいで復元する。
- `FR-009`: 詳細パネルの実行ボタンと固定アクションバーから /classify・/budget・/subscriptions・/analysis/reconciliation・/analysis/total-cashflow へ対象を絞った状態で遷移する。`nextAction.to` は対象 query を含む URL とし、画面は Link へ渡すだけとする。
- `FR-010`: 期間は既存 `usePeriod` が localStorage で画面間共有する。範囲・指標・比較対象・選択した課題・畳みの切替・統計の開閉は URL の searchParams に保持し、再読み込みと共有で同じ表示に戻す。値が形式違反なら既定値へ倒して画面を出す。
- `FR-011`: 既存の科目別プロファイル表と自動診断は削除せず『統計の詳細を表示』の開閉の中に残し、既定は閉じた状態とする。

## 非機能要件

- Performance: 診断 1 回の読み取りは Dataset を 1 回読んで純粋関数で集計する形に収め、同じ期間の総収支 API と同程度の CPU 時間に収める。Cloudflare Workers の実行枠内で、8 種の検知器を 1 リクエストで回しても超過しないことを既存の性能ゲートで確認する。
- Availability/Reliability: 既存の Workers と D1 の可用性に依存し、新しいサービス・キュー・キャッシュ層を増やさない。読み込み中・エラー・空 (未取込) は既存 PageState で表し、空のときは /import への導線を出す。
- Accessibility/Usability: WCAG 2.2 の 1.4.1 Use of Color に従い、優先度・ステータス・信頼度はいずれも文字ラベルを持ち、色 (pill の alert / warn / calm / neutral) は補助にとどめる。CI の headless Chrome は pointer:none として振る舞うため、hover 前提の操作を唯一の経路にしない。表は横スクロール可能にする。
- Security/Privacy: 新規に外から受ける入力は action_key・status・note の 3 つだけとし、いずれも許可リスト方式で検証する。診断の根拠に含まれる取引先名と金額をサーバログ・クライアントログへ出さない。外部 API へ明細を送信しない。
- Maintainability/Operability: 計算規則の正本を docs/diagnosis-screen.md に置き、境界値テストで固定する。検知器を足す手順は『レジストリへ 1 件追加し docs と境界値テストを足すだけ』であることを docs に書き、それが崩れていたら G2 が壊れている合図とする。

## UI・状態遷移

- 画面状態: 読み込み中 / エラー / 空 (未取込) / 通常 / 改善余地 0 件。空のときは /import への導線を出し、改善余地 0 件のときは表を空にせず『今は大きな改善余地が見つかっていません』と健全性スコアだけを出す。
- 遷移条件: 期間タブは `usePeriod` を更新し、条件の帯は searchParams を書き換える。どちらも queryKey を変えて再取得する。先頭の有効な改善項目を primary improvement として示し、行の選択は右側の詳細パネルと画面下部の固定アクションバーを同期する。選択解除で両方を閉じる。ステータス変更は PATCH の成功後に診断 queryKey を invalidate し、サーバ返却を正として再描画する (楽観更新はしない)。
- Loading/Empty/Error: 既存 PageState を使う。ステータス変更の失敗時は行の状態を戻し、原因を短文で示す。操作は 1 クリックで確定し、取り消せる。
- 情報の優先度: 残すのは 順位・金額・根拠・次の一手。統計量そのものは開閉へ移し既定は閉じる。表と図は年内効果 `annualImpact` を主に出し、`recurring_monthly` だけ月額を補助表示する。`one_off` を月額のように見せない。

## ビジネスルールと検証

- `BR-001`: 改善インパクトの合計は、対応済みと見送りの行を除外した金額の和とする。同一 action_key は 1 度しか数えない。
- `BR-002`: 丸めは表示時のみ行い、内部は円単位の整数で保持する。
- `BR-003`: 要確認の明細は事業にも家計にも数えず、件数と金額を注記で示す。
- `BR-004`: 総合 = 事業 + 家計 が成り立ち、期間合計は同じ期間の総収支画面の値と一致する。
- `BR-005`: status は 未着手 / 対応中 / 対応済み / 見送り の 4 語との完全一致だけを受ける。一致しない値は 400 で拒む。
- `BR-006`: action_key は検知器レジストリが生成しうる形 (登録済み検知器 id と許可文字種・長さ上限) に一致するものだけ受ける。一致しない値は 400 で拒む。
- `BR-007`: note は長さ上限を設け、超過は 400 で拒む。保存時に加工せず、表示は React の既定のエスケープに委ねる。
- `BR-008`: 検知されなくなった action_key の行は削除せず残し、画面には出さない。再び検知されたら以前の判断が復帰する。
- `BR-009`: 主なシグナルは 3 件までとし、4 件目以降は出さない。
- `BR-010`: `impactBasis` は `recurring_monthly` (継続して毎月効く) と `one_off` (一度だけ効く) を区別する。`annualImpact` は前者だけ `monthlyImpact × 12`、後者は `monthlyImpact` と同額にする。
- `BR-011`: 候補を annualImpact 降順 → claimKeys 数降順 → confidence 降順 → action_key 昇順で安定化し、採用済み項目と `claimKeys` が 1 つでも交差する候補を除外する。これにより同じ支出を合計へ二重計上しない。
- `BR-012`: 各項目の `scope` は `business` または `household`、`metric` は `expense` / `income` / `net` のいずれかとする。selection.scope と selection.metric の両方が一致する候補だけを残す。
- `BR-013`: primary improvement、表、ウォーターフォール、合計は、status・claim・overlap・scope・metric を適用した同じ改善項目集合から導出する。
- `BR-014`: income は直近3ヶ月平均がその前3ヶ月平均より10%超低いとき、その差を月次の回復余地とする。比較には6ヶ月以上必要とする。
- `BR-015`: net は直近3ヶ月平均純収支が0円未満のとき、0円へ戻す差を月次の改善余地とする。事業は経費未記帳月を除外する。
- `BR-016`: 支出のウォーターフォールは改善後金額を 0 未満にしない。収入・純収支は現状値へ改善額を足し、赤字の純収支は負数の現状値を保持する。

## API契約

本サイクルは API を拡張するため、`api-contract.md` の骨格を endpoint ごとに合成する。正本の記述は `system-spec/backend.md` と `system-spec/security.md` にある。

### API: diagnosis-get

- Operation ID: `diagnosis-get`
- Method/Path: `GET /api/diagnosis`
- Purpose: 選んだ期間と条件に対する診断一式 (改善余地・健全性・ウォーターフォール・シグナル・根拠・既存の kpi / bep / entries / autoDiagnosis) を返す。
- Version/Lifecycle: 既存 endpoint の拡張。返却フィールドの追加のみで、既存フィールドは削らない。
- Authentication: 既存の Cookie セッション。既存の認証ミドルウェア配下に置き、未認証は 401。
- Required scopes/roles: 役割分離は持たない。認証済み user_id の自己データだけを対象とする。
- Resource ownership check: API はセッションの user_id で取込データを読み、他利用者の Dataset を混ぜない。クライアント指定の user_id は受け取らない。
- Headers: 既存の共通ヘッダのみ。追加なし。
- Path parameters: なし。
- Query parameters: 期間 (既存 usePeriod の withPeriod が付与する範囲指定)、分析の範囲 (事業 / 家計 / 総合)、表示する指標 (支出 / 収入 / 純収支)、比較対象 (前期間 / 前年)。いずれも許可集合との完全一致で、不一致は既定値へ倒す。
- Body schema: なし。
- Example: 期間 1年・範囲 総合・指標 支出・比較対象 前期間 での取得。
- Response 200: improvements 配列 (各要素は id / action_key / label / detail / severity / monthlyImpact / annualImpact / impactBasis / scope / metric / claimKeys / effort / confidence / evidence 配列 / query 付き nextAction / status)、health (score / band / breakdown 配列)、waterfall 配列、signals 配列 (最大 3)、evidence 配列、および既存の kpi / bep / entries / autoDiagnosis。
- Response 401: 未認証。web はログイン画面へ送る。
- Headers: 既存の request-id を維持する。キャッシュヘッダは追加しない。
- Validation・ビジネスルール: 期間は Dataset へ先に適用し、scope / metric / compare は selection として `diagnosisScreen()` へ渡す。`detectImprovements()` が BR-010〜BR-012 を適用し、合計・図表・primary は同じ返却集合から作る。
- Error contract: 401 unauthorized (retryable: no、クライアントはログインへ)。500 internal (retryable: yes、内部の SQL やスタックを応答に含めない)。
- Idempotency key/replay: 読み取りのため不要。
- Concurrency/optimistic lock: 不要。
- Transaction boundary: 読み取り 1 回で Dataset を組み立てる。
- Timeout/retry/rate limit: 既存の分析 API と同じ扱い。
- Cache/ETag: 追加しない。TanStack Query のクライアント側キャッシュに委ね、queryKey に期間と条件の帯を含める。
- Cursor/limit/filter/sort: 並びはサーバが年間インパクト降順で返す。ページングは持たない。
- Request/correlation ID: 既存の仕組みを維持する。
- Metrics/logs/audit/redaction: 明細の内容 (取引先名・金額) をログへ出さない。
- Input/output validation: 条件の帯は許可集合との一致のみ。
- Sensitive data exposure: 未認証で読める経路を作らない。
- Abuse/authorization tests: 未認証アクセスが 401 になることをテストで固定する。
- Contract tests — Positive: 既定条件で improvements / health / waterfall / signals / evidence が揃う。Boundary: 改善余地 0 件で improvements が空配列、health だけが返る。Negative: 未認証で 401、条件の帯に不正値を渡すと既定値の結果が返る。

### API: diagnosis-action-patch

- Operation ID: `diagnosis-action-patch`
- Method/Path: `PATCH /api/diagnosis/actions/:action_key`
- Purpose: 改善アクション 1 件の対応状況とメモを保存する。
- Version/Lifecycle: 新設。
- Authentication: 既存の Cookie セッション。未認証は 401。
- Required scopes/roles: 役割分離は持たない。
- Resource ownership check: セッションの `user_id` と path の `action_key` の組を所有境界とする。他利用者の同じ action_key とは別行であり、読み書きは常に認証済み `user_id` で絞る。
- Headers: 既存の共通ヘッダのみ。
- Path parameters: action_key (許可文字種と長さ上限、登録済み検知器 id で始まること)。
- Query parameters: なし。
- Body schema: status (必須、4 語の許可集合)、note (任意、長さ上限あり)。
- Example: status を 対応中 に変更し note を空で送る。
- Response 200: 保存後の action_key / status / note / decided_at。
- Response 400: action_key・status・note のいずれかが許可リストに一致しない。
- Response 401: 未認証。
- Headers: 追加なし。
- Validation・ビジネスルール: BR-005 / BR-006 / BR-007 を許可リスト方式で適用する。拒否リストで通さない。D1 へはプレースホルダ束縛で書き、文字列連結で SQL を組み立てない。
- Error contract: 400 invalid_request (retryable: no、クライアントは入力を直す)。401 unauthorized (retryable: no、ログインへ)。500 internal (retryable: yes、内部の SQL やスタックを含めない)。
- Idempotency key/replay: 同じ action_key への同じ status の再送は同じ結果に収束する (冪等な upsert)。
- Concurrency/optimistic lock: 最後の書き込みを正とし、decided_at を更新する。
- Transaction boundary: `(user_id, action_key)` の 1 行 upsert で完結する。
- Timeout/retry/rate limit: 既存の状態変更操作と同じ扱い。
- Cache/ETag: 持たない。成功後にクライアントが診断の queryKey を invalidate する。
- Cursor/limit/filter/sort: 該当なし。
- Request/correlation ID: 既存の仕組みを維持する。
- Metrics/logs/audit/redaction: note の内容をログへ出さない。
- Input/output validation: 許可リスト方式。note は保存時に加工せず、表示側で dangerouslySetInnerHTML を使わない。
- Sensitive data exposure: エラー応答に内部情報を含めない。
- Abuse/authorization tests: 未知の action_key、未知の status、長さ超過の note がいずれも 400 になることをテストで固定する。
- Contract tests — Positive: 4 語それぞれへの変更が保存され再取得で復元する。Boundary: note の長さ上限ちょうどは通り、1 文字超過は 400。Negative/auth: 未登録の検知器 id を含む action_key で 400、未認証で 401。

## データモデル

- Entity/Value: `diagnosis_action_states` — 利用者ごと・改善アクションごとの判断を保持する。
- Fields/Types/Nullability: user_id TEXT NOT NULL / action_key TEXT NOT NULL / status TEXT NOT NULL / note TEXT / decided_at TEXT / created_at TEXT NOT NULL / updated_at TEXT NOT NULL。時刻は RFC3339 の文字列とする。
- Relations/Constraints/Indexes: PRIMARY KEY は `(user_id, action_key)`。status は CHECK 制約で 未着手 / 対応中 / 対応済み / 見送り の 4 語に限定する。
- Ownership/Retention/Migration: 検知結果 (金額・根拠) は保存せず、利用者の判断だけを保存する。検知されなくなった行も消さない。migration の正本は repository 直下の `migrations/` であり、新表作成だけを連番 1 本で追加する。

## 認証・認可

- Authentication: 既存のログイン (Cookie セッション)。新しい認証方式を導入しない。
- Authorization: 役割ごとの権限分離は持たないが、すべての読み書きを認証済み `user_id` で絞る。クライアントから user_id は受け取らない。
- Tenant/data boundary: `(user_id, action_key)` の複合キーをテナント境界とし、同じ action_key を持つ別利用者の判断を読み書きできない。
- 新しい秘密情報・外部サービスの資格情報を増やさない。本番の管理者資格情報の投入は既存スクリプト経由の一本化を維持する。

## エラー・例外・回復

- Error taxonomy: 400 invalid_request / 401 unauthorized / 500 internal。応答に内部の SQL やスタックを含めない。
- Retry/Timeout/Fallback: 読み取りの失敗は既存 PageState のエラー表示にし、再試行の導線を出す。状態変更の失敗は行の状態を戻して原因を短文で示す。
- Idempotency/Concurrency: 同一 action_key への同じ status の再送は冪等。最後の書き込みを正とし decided_at を更新する。

## イベント・非同期処理

N/A: 本サイクルでキュー・イベント・スケジューラを導入しない。診断は同期の読み取り 1 回と状態変更 1 回だけで完結し、非同期処理の producer / consumer を持たない。

## 可観測性

- Logs/Metrics/Traces/Audit: 既存の request-id を維持する。明細の内容 (取引先名・金額) と note をサーバログ・クライアントログへ出さない。状態変更は decided_at が監査の痕跡を兼ねる。
- Alert/SLO dashboard: 新しいアラートと dashboard を増やさない。既存の CI ゲート (typecheck / lint / test / verify:full / js-budget) の緑維持を品質の信号とする。

## 互換性・移行・リリース

- Compatibility/versioning: GET /api/diagnosis は返却フィールドの追加のみで既存フィールドを削らない。web 側の型は packages/web/src/api.ts の DiagnosisData を拡張し、packages/core の型と齟齬を出さない。
- Migration/backfill: 新表の作成のみで backfill を伴わない。既存データの書き換えを行わない。
- Rollout/rollback: 本番反映は manifest から Migrate APPLY を経て Deploy の順とする。Deploy を先に流すと新表を前提とするコードが表のない本番に当たる。問題時は画面と API の変更を戻せば足り、表が残っていても既存機能に影響しない。migration の適用結果は CI ログから追えるようにする。

## テストと受入条件

- [ ] `AC-001` (S1): /analysis/diagnosis を既定条件で開いたとき、DOM テストで期間タブ・見出し・条件の帯・primary improvement・健全性カード・主なシグナル・改善アクションの master 表・ウォーターフォール・診断根拠・結果指標・detail パネル・固定アクションバーが描画され、科目別プロファイルが開閉で表示され、直書き色の lint が 0 件である。
- [ ] `AC-002` (S2): 検知器定義を 1 件足したテストで、画面の表・ウォーターフォール・詳細パネルと API の返却に新しい課題が現れ、packages/web と packages/api のコードに検知器 id の分岐が 0 件である。
- [ ] `AC-003` (S3): 要素の実測値を与える境界値テストで、要素スコア・重み・寄与点・総合スコア・区分が算式どおりに一致し、寄与点の合計が総合スコアと一致する。0・100・要素が算出不能 (分母 0・データ不足) の各点を固定する。
- [ ] `AC-004` (S4): 対応中に変更してから期間切替・再取込・再取得を行う統合テストで、同じ action_key の状態・メモ・決定時刻が保持され、対応済みと見送りが既定の一覧から畳まれ合計から除かれ、畳んだ件数と金額が注記に現れる。
- [ ] `AC-005` (S5): detail パネルと固定アクションバーからの遷移が対象 query を持ち、query 値が percent encode される。期間は usePeriod / localStorage、診断条件と選択は URL から復元される。
- [ ] `AC-006` (S6): 3 指標 × 3 範囲 × 2 比較対象のどの組合せでも画面の数値が core の返却値と一致し、総合 = 事業 + 家計 が成り立ち、期間合計が同じ期間の総収支画面の値と一致する。
- Contract/integration/e2e/security/performance: 各検知器について『検知される最小の入力』と『ぎりぎり検知されない入力』を対で書く。テストは旧実装でも緑になってはならず、件数と金額を固定値で検算して『0 件の違反』と『0 件しか調べていない』を区別できる形にする。API は上記 2 endpoint の contract tests を持つ。security は未認証 401 と許可リスト違反 400 を固定する。performance は既存 CI ゲートの緑維持で代替する。

## 文書品質ゲート

次の 4 条件を本機能の仕様・設計・実装・テストに共通する完了条件とする。

- 矛盾なし: 期間の所有、インパクト換算、所有境界、migration 位置について相反する記述がない。
- 漏れなし: scope / metric、claim / overlap、status、対象 query 付き nextAction、primary / master-detail / 固定アクションバーを受入で確認する。
- 整合性あり: `spec` は振る舞い、`architecture` は依存と ADR、`docs/diagnosis-screen.md` は算式、test plan は入力、evidence は実測結果だけを持つ。
- 依存関係整合: `web → api → core` と `api → D1` の向きを守り、検知規則は `detectImprovements()`、画面合成は `diagnosisScreen()`、永続化は API だけが所有する。

## 未決事項

- 8 種以外の検知器は本機能の対象外。追加時はレジストリ・本書の算式・境界値テストだけを増やす。
- claimKeys は NFKC・空白除去・小文字化した対象名を境界にしている。取引先 alias を含む canonical identity との統合は別 feature とする。
- nextAction は対象 query を返すが、遷移先のうち query をまだ消費しない画面の絞り込み対応は別 feature とする。
