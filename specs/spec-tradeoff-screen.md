---
graph_node_id: "spec-tradeoff-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api"]
title: "トレードオフ画面 再現仕様 (15-tradeoff.png)"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "analysis"]
file_path: "specs/spec-tradeoff-screen.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/15-tradeoff.png"
route: "/tradeoff"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"system-spec-harness:assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"0cd6383f1bef69d2823c0c3ef4311b2f5965f4511f53c2d243d88a2368d7a080"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/00-requirements-definition.md","source_version":"0.1.14","source_digest":"0cd6383f1bef69d2823c0c3ef4311b2f5965f4511f53c2d243d88a2368d7a080","imported_at":"2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: []
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations", "docs/spec-v1.1.md", "design/FINAL-UI/images/15-tradeoff.png"]
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
classification_reason: "design/FINAL-UI/images/15-tradeoff.png と利用者決定 qa-tradeoff-decision-001〜012 (上位概念の承認 appr-foundation-tradeoff-001 を含む) から確定したトレードオフ画面の再現仕様。利用者が決めていない値は agent の推定として本文で個別に注記した。"
classification_candidates: [{"artifact_kind":"specification","confidence":1.0,"candidate_path":"specs/spec-tradeoff-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"not_applicable","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-09-21T22:35:02Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# トレードオフ画面 再現仕様

正本の画像は `design/FINAL-UI/images/15-tradeoff.png`、経路は `/tradeoff`。上位の要件は `system-spec/00-requirements-definition.md` (U1-U9、利用者承認 appr-foundation-tradeoff-001、O1〜O5 と S1〜S6 の本文承認 qa-tradeoff-decision-012) とカテゴリ別の章 (ui-ux / frontend / backend / database / auth / security / infrastructure / maintenance-ops) にある。本書はそれらを 1 画面の実装単位へ落とした仕様で、画像のどの文言をそのまま再現し、どの値を期待値にしないかを明示する。

## 文書の正本と投影

- 本書をトレードオフ画面の規則・契約・受入条件の正本とする。正本画像は見た目と情報構造の参照であり、動的な値は本書の規則に従う。
- [`docs/tradeoff-screen/design-decisions.md`](../docs/tradeoff-screen/design-decisions.md) は判断理由と正本との差分だけ、[`docs/tradeoff-screen/evidence.md`](../docs/tradeoff-screen/evidence.md) は実行日時を伴う検証結果だけを持つ。どちらも本書の規則を重ねて定義しない。
- `features/feat-tradeoff-screen.md`、`architecture/tradeoff-*.md`、`tasks/feat-tradeoff-screen/`、`.dev-graph/` は本書から作る計画上の投影であり、規則の正本ではない。食い違う場合は本書を優先し、本書を直してから投影を再生成・同期する。
- 生成投影の `active` / `ready` / `implementation_readiness: complete` は計画・分解の状態であり、公開や本番適用の完了を表さない。現時点の実行結果と配信状態は evidence を確認する。

注記の約束: 利用者が決めた値は決定 ID (qa-tradeoff-decision-00N / 01N) を添える。画像にも決定にも値が無く、実装の決定論のために置いた値は **「agent 推定・利用者未確認」** と明記する。

規則の優先順位: 後から出た利用者決定が先の推定を上書きする。必要度は qa-tradeoff-decision-010 / 011 が正本で、qa-tradeoff-backend-web-003 の科目名の固定表と、003 / 004 の「検知器の改善案に当たる候補は 1 段下げる」は **取り消し済み** (qa-tradeoff-decision-011)。サーバでの再計算・covered の意味・verdict・正規化は qa-tradeoff-backend-web-004 / 005 と qa-tradeoff-security-web-004 / 005 に従い、003 の covered ±1e10 / value 0〜1e8 の入力検査は保存前の不変条件へ置き換わっている。UI の既定値は qa-tradeoff-ui-ux-web-003 / 004 に従う。

## 目的と成功状態

目的: 利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、『新しい支出を増やすなら、何を見直しますか？』に 1 画面で答え切れるようにする。新しい支出 (支出名・金額・単発 / 毎月・開始月・メモ) を置くと、事業経費を科目×取引先ごとに並べた見直し候補から削減先を選べ、core が決まったルールで出す推奨の組み合わせを参考に、年間の差額と防衛ラインへの影響を確かめてから条件を記録し、サブスク・予算・明細の画面で手を打てる。アプリは LLM を呼ばず、試算の数字はすべて core の 1 か所から導く (U1、qa-tradeoff-decision-003)。

成功状態:

- `/tradeoff` が 見出しと問い・分析期間カード・1.新しい支出を設定・2.見直し候補の選択・3.推奨の組み合わせ・計算例・右側の試算結果・下部の選択中バー で描画され、読込・空・失敗の各状態を持つ (G1 / O1 / S1)。
- 年額・差額・防衛ラインへの影響を core の 1 関数だけが決め、右パネル・選択中バー・計算例が同じ値を示す。単発は発生月だけに計上される (G2 / O2 / S2、qa-tradeoff-decision-005 / 009)。
- 候補が科目×取引先の経費全体から出て、必要度・推移・理由が全行に付き、利用者の上書きとメモが再読込後も残る (G3 / O3 / S3、qa-tradeoff-decision-001 / 002 / 007 / 010 / 011)。
- 推奨の組み合わせが同じ入力で同じ上位 4 件を返し、選ぶと理由の文と関連ページへのリンクが出る (G4 / O4 / S4、qa-tradeoff-decision-003)。
- 『この条件で試算』を押すたびに条件が履歴として追加され、再訪時に最新の条件が復元される。migration は追加のみで既存の試算の行は変わらない (G5 / O5 / S5、qa-tradeoff-decision-006 / 008)。
- typecheck・lint・core / api / web のテスト・初期 JS 予算の CI 実測が緑である (S6)。

## スコープ

対象 (in):

- トレードオフ画面の作り直し。`packages/web/src/pages/Tradeoff.tsx` は入口だけを持ち、実体を `packages/web/src/pages/tradeoff/` 配下の部品 (ページ本体・新しい支出のフォーム・候補表・推奨の表・試算結果パネル・計算例・選択中バー) へ分割する (qa-tradeoff-frontend-web-001)。
- `packages/core` の純関数: 科目×取引先の候補集計と直近 3 か月平均、推移の 3 区分、必要度の推定、自動の理由の文と関連ページ、試算 (年額・差額・単発の計上)、防衛ラインへの影響、推奨の組み合わせの列挙と評価と順位と理由、候補キーの組み立て、`claimPart` 正規化の export。
- API: `GET /api/tradeoff` の応答の作り直し、`POST /api/tradeoff` の入力の作り直しとサーバでの再計算、`PUT /api/tradeoff/candidates/:key` の新設。
- 追加のみの migration (番号 `0051`。予定番号 0050 は #67 の `0050_budget_plans.sql` が先に使ったため、main 取り込み時に繰り上げた): `tradeoff_plans` への `start_month`・`memo` 列の追加と、新表 `tradeoff_candidate_notes`。
- 選択中バー、候補表の検索・カテゴリ絞込・全クリア・『すべて表示』、推奨の理由と関連ページへのリンク、計算例。
- `docs/spec-v1.1.md` の FR-09 への規則の明記と、core・API・DOM のテスト。

対象外 (out):

- 共通シェル (ヘッダーの取引ライン・検索・ダウンロード・ヘルプ、サイドバー、フッター、月次クローズの進捗、改善を送る) の作り直し。既存の PageShell のまま使う。
- 保存済みの試算の一覧と翌月の突合の画面表示 (qa-tradeoff-decision-004)。既存の `tradeoff_plans` の行と `tradeoffReview` 関数・そのテストは残す。
- アプリから LLM を呼ぶこと、AI分析レポートからの推奨の取り込み (qa-tradeoff-decision-003)。
- 既存の `tradeoff_plans` の行やテーブルの削除・書換。
- 税・手数料の考慮 (画像の計算の前提どおり)。
- スマートフォン・タブレット・デスクトップ向け専用アプリ (qa-tradeoff-target-platforms-001、web のみ)。
- 画像の数値 (金額・件数・取引先名) の再現。モックであり実データを正とする (C7)。
- 既存の `defenseLine`・`/api/defense-line`・ヘッダーのバッジ・概要画面・診断の検知器・`tradeoffCandidates` (分析ハブの改善余地) の数字の変更 (C5)。

## 用語と主体

| 用語 | 意味 |
| --- | --- |
| 新しい支出 | 利用者が画面で置く 支出名・金額・単発 / 毎月・開始月・メモ の 1 組。保存するまでは画面の状態。 |
| 候補 | 分析期間の終了月から遡る 3 か月の freee 事業経費を 科目 (`account_norm`) × 取引先 (`partner`) で集計した 1 行。保存しない (qa-tradeoff-decision-001)。 |
| 候補キー | `tradeoffCandidateKey(account_norm, partner)` が返す `v1:${JSON.stringify([account_norm, partner])}`。`parseTradeoffCandidateKey(key)` で `{ account, partner }` に可逆解析でき、候補と上書きを結ぶ。0051 は未公開・未適用のため旧 `account|partner` 形式との互換は持たない。 |
| 月額 | 候補の直近 3 か月の平均月額 (円、整数へ丸め)。 |
| 必要度 | 低 / 中 / 高 (`low` / `mid` / `high`)。core が推定し、利用者の上書きがあればそちらを使う (qa-tradeoff-decision-002 / 010 / 011)。 |
| 推移 | 直近 3 か月の 減少 / 横ばい / 増加。 |
| 自動の理由 | 『損益・メモ』列に出す文。利用者メモがあればメモを優先する (qa-tradeoff-decision-007)。 |
| 上書き | 候補ごとの 必要度 と メモ。`tradeoff_candidate_notes` の 1 行。 |
| 年間の差額 | 新しい支出の年額 − 削減の年額。正は支出増、0 以下は捻出できる (qa-tradeoff-decision-009)。 |
| 防衛ライン余裕 | 既存 `defenseLine` の月の余裕 (`diff`) × 12 (qa-tradeoff-decision-005)。 |
| 試算後の余裕 | 防衛ライン余裕 − 年間の差額。0 以上で維持、負で割れる (qa-tradeoff-decision-005)。 |
| 推奨の組み合わせ | 候補 2〜4 件の組み合わせのうち、年間削減額が新しい支出の年額以上のもの。上位 4 件を示す。 |
| 試算の記録 | 『この条件で試算』1 回ごとの `tradeoff_plans` の 1 行 (qa-tradeoff-decision-008)。 |

主体:

- 利用者 (SH1): セッション cookie で認証された本人。画面の全操作を行う。
- 家族 (SH2): 同じ家計を見る閲覧者。試算の結論と理由を読む。権限は利用者と同じ認証の内側で、新しい権限区分は作らない。
- 保守者 (SH3): 同一人物とコーディングエージェント。規則を core・`docs/spec-v1.1.md`・テストで読む。

## ユースケースとユーザーフロー

1. 開く: `/tradeoff` を開く → 共通の分析期間 (`usePeriod`) で `GET /api/tradeoff` を読む → 候補表・防衛ラインの月の余裕・最新の試算条件が返る。最新の条件があれば 1.新しい支出の各欄と候補の選択を復元する (qa-tradeoff-decision-006)。
2. 新しい支出を置く: 支出名・金額・単発 / 毎月・開始月・メモを入れる → 右の試算結果・選択中バー・推奨の組み合わせが同じ core 関数の結果で即時に変わる。
3. 候補を選ぶ: 候補表を検索・カテゴリで絞り、行のチェックで選ぶ → 削減の年額・年間の差額・防衛ラインへの影響が変わる。『選択をすべてクリア』で選択を外す。
4. 推奨を使う: 3.推奨の組み合わせの行を選ぶ → その組み合わせの理由の文と関連ページへのリンクが出る。行の選択は候補表の選択をその組み合わせに置き換える (**agent 推定・利用者未確認**)。
5. 必要度とメモを直す: 候補の行で必要度 (低 / 中 / 高 / 自動に戻す) とメモを変える → `PUT /api/tradeoff/candidates/:key` で保存 → tradeoff の query だけを無効化し取り直す。再読込後も残る。
6. 記録する: 選択中バーの『この条件で試算』→ `POST /api/tradeoff` がサーバで再計算した値を 1 行追加する → 次に開いたときこの条件が復元される (qa-tradeoff-decision-008)。
7. 手を打つ: 推奨の理由の下、または候補の関連ページのリンクから サブスク・予算・明細 の画面へ移る。

## 機能要件

- FR-1 期間: 分析期間のカードと API へ渡す期間は `usePeriod` の値をそのまま使う。候補は期間の終了月から遡る 3 か月で作る。
- FR-2 新しい支出の入力: 支出名 (100 字以内)、金額 (1〜100,000,000 円の整数)、単発 / 毎月 (既定は毎月)、開始月 (YYYY-MM、既定は今日の翌月)、メモ (500 字以内) を置く (上限は qa-tradeoff-security-web-003、既定は qa-tradeoff-ui-ux-web-003、どちらも **agent 推定・利用者未確認**)。
- FR-3 開始月は計算に効かない: 開始月は記録と表示のための値で、年額・差額・防衛ラインへの影響・推奨のどれにも入らない。毎月の支出は開始月に関係なく月額×12、単発の支出は開始月に関係なく金額そのものを年額とする (qa-tradeoff-decision-005 / 009 の式に開始月の項が無いため)。年の途中開始による按分はしない。
- FR-4 試算: core の試算関数 1 つが 新しい支出の年額・削減の年額・年間の差額・判定・防衛ライン余裕・試算後の余裕・維持 / 割れる を返す。右パネル・選択中バー・計算例はこの関数の結果だけを読む (qa-tradeoff-decision-005 / 009)。
- FR-5 候補表: 列は # / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ。月額の降順に最初の 10 件を出し『N 件中 M 件を表示』と『すべて表示』を置く (qa-tradeoff-ui-ux-web-003、**agent 推定・利用者未確認**)。検索は カテゴリ名・取引先名 の部分一致、カテゴリ絞込は `account_norm` の完全一致、『選択をすべてクリア』は選択だけを外す。
- FR-6 必要度と推移と理由: 全行に core の推定値が付き、上書き済みの必要度には『手動』の印を付ける。メモがあれば『損益・メモ』にメモを出す (qa-tradeoff-decision-002 / 007 / 010 / 011)。
- FR-7 上書き: 行から必要度 (低 / 中 / 高 / 自動に戻す) とメモを変えられる。1 回の保存は 1 候補 (qa-tradeoff-security-web-003)。
- FR-8 推奨の組み合わせ: 列は 内容・年間削減額・充足度・実行のしやすさ・リスク。上位 4 件。届く組み合わせが無ければ空の文を出す。選んだ組み合わせの理由の文と、含まれる候補の関連ページへのリンクを出す (qa-tradeoff-decision-003、qa-tradeoff-ui-ux-web-004)。
- FR-9 計算例: 毎月と単発の 2 例を、固定の入力 (毎月 80,000 円と削減 85,000 円/月、単発 300,000 円と削減 50,000 円/月) で core の試算関数に通した結果として出す (O2 の数値)。
- FR-10 防衛ラインへの影響: 余裕 → 試算後 と『維持』/『割れる』を文字で出す。月の余裕が出せないときは判定と色を出さず文を出す (qa-tradeoff-ui-ux-web-004)。
- FR-11 選択中バー: 1 件以上選んだときだけ、件数・年間削減額・年間差額・『選択をクリア』・『この条件で試算』を出す (qa-tradeoff-ui-ux-web-003)。
- FR-12 記録: 『この条件で試算』は押すたびに 1 行を追加する。サーバは送られた候補キーと支出の条件から core で再計算した値だけを保存する (qa-tradeoff-decision-008、qa-tradeoff-backend-web-004 (6))。
- FR-13 復元: 画面を開くと最新の記録 1 件を 1.新しい支出と選択へ復元する (qa-tradeoff-decision-006)。
- FR-14 保存一覧と突合を出さない: 旧画面にあった保存済み試算の一覧と翌月の突合 (ReviewCell) は画面へ戻さない (qa-tradeoff-decision-004)。

## 非機能要件

- 性能: 画面は遅延読み込み (`AuthenticatedApp.tsx:35` の lazy import) のままにし、初期 JS 予算 (`check:js-budget` の CI 実測) を超えない。組み合わせの列挙は上位 12 件からの 2〜4 件 (最大 66 + 220 + 495 = 781 通り) に限り計算量を抑える (C6、qa-tradeoff-backend-web-003)。
- 可用性: migration 0051 の適用前に新しい Worker が動いても壊れないよう、`packages/api/src/schema-guard.ts` の `EXPECTED_D1_MIGRATION` を同じ変更で進める。
- アクセシビリティ: 状態を色だけで伝えない。必要度は文字 (低 / 中 / 高) に色を添え、推移は矢印と文字、差額の警告と防衛ラインの判定は文で示す (WCAG 2.2 SC 1.4.1)。
- 保守性: 候補の作り方・推移・必要度・理由・推奨の順位・防衛ラインへの影響を `docs/spec-v1.1.md` の FR-09 に表で残し、同じ表を core の単体テストの期待値にする (qa-tradeoff-maintenance-ops-web-003)。
- 見た目: 直書き色 0。色は `design-tokens.ts` 由来のトークン、ボタンは共通 Button、ページは PageShell / PageHeader / PageState / PageActions。選択中バーはサブスク・診断の SelectionBar の流儀に揃える (C2)。
- 狭い画面: 段を縦に積み、表は横スクロールにする (qa-tradeoff-ui-ux-web-001)。

## UI・状態遷移

### 画面骨格

| 位置 | 要素 | 文言・内容 |
| --- | --- | --- |
| 上 | 見出し | 『トレードオフ』 |
| 上 | 問い | 『新しい支出を増やすなら、何を見直しますか？』と説明文 |
| 上 | 分析期間カード | `usePeriod` の期間表示 (グローバル) |
| 左 1 | 1.新しい支出を設定 | 支出名・金額・単発 / 毎月・開始月・メモ |
| 左 2 | 2.見直し候補の選択 | 検索・カテゴリ絞込・『選択をすべてクリア』、表 (# / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ)、『N 件中 M 件を表示』『すべて表示』 |
| 左 3 | 3.推奨の組み合わせ | 表 (内容・年間削減額・充足度・実行のしやすさ・リスク)、選んだ組み合わせの理由の文と関連ページ (サブスク / 予算 / 明細) へのリンク |
| 左 4 | 計算例 | 毎月の例と単発の例 |
| 右 | 試算結果 | 新しい支出の年額・見直しによる削減の年額・年間の差額と警告・防衛ラインへの影響 (余裕 → 試算後、維持 / 割れる)・計算の前提 |
| 下 | 選択中バー | 件数・年間削減額・年間差額・『選択をクリア』・『この条件で試算』 |

### 表示の文言

- 年間の差額が正: 赤の警告『年間 X 円の支出増になります』。0 以下: 『年間 X 円を捻出できます』(X は差額の絶対値) (qa-tradeoff-ui-ux-web-003、**agent 推定・利用者未確認**。符号の規則は qa-tradeoff-decision-009)。
- 防衛ライン: 『維持』/『割れる』。月の余裕が出せないときは『記帳済みの月が無いため、防衛ラインへの影響は計算できません』とし、判定と色は出さない。試算と推奨は出す (qa-tradeoff-ui-ux-web-004、**agent 推定・利用者未確認**)。
- 必要度: 『低』『中』『高』に色を添える。上書き済みは『手動』の印。
- 推移: 『↓ 減少』『→ 横ばい』『↑ 増加』。
- 関連ページ: 検知器の改善案に当たった候補にだけリンクを出し、当たりの無い候補はリンクの欄を空にする (qa-tradeoff-ui-ux-web-004)。
- 計算の前提: 『毎月の支出は月額×12、単発の支出は発生月だけに計上』『見直しの削減は選んだ候補の月額合計×12』『税・手数料は考慮しない』『開始月は年額に影響しない』。

### 状態遷移

| 状態 | 条件 | 表示 |
| --- | --- | --- |
| 読込 | `GET /api/tradeoff` の取得中 | PageState の読込 |
| 失敗 | 取得の失敗 | PageState の失敗と再読込 |
| 候補が空 | 候補 0 件 | 候補表の代わりに『直近 3 か月に月 1,000 円以上の事業経費がありません』(**agent 推定・利用者未確認**)。試算結果は削減 0 で出す |
| 推奨が空 | 届く組み合わせ 0 件、または新しい支出が未入力 | 『選べる候補で新しい支出の年額に届く組み合わせはありません』(**agent 推定・利用者未確認**) |
| 未選択 | 選択 0 件 | 選択中バーを出さない |
| 選択中 | 選択 1 件以上 | 選択中バーを出す |
| 記録中 | POST の送信中 | 『この条件で試算』を無効にする |
| 記録の失敗 | POST の 4xx / 5xx | 選択中バーの近くに文を出し、入力と選択を保持する |
| 上書き中 / 上書きの失敗 | PUT の送信中 / 失敗 | 行の操作を無効にする / 行に文を出し元の値へ戻す |

### 既定の値

- 単発 / 毎月: 毎月。開始月: 今日の翌月。候補表: 月額降順の 10 件。選択: 0 件 (最新の記録があればその復元が優先) (qa-tradeoff-ui-ux-web-003、**agent 推定・利用者未確認**)。

### 画像の値のうち期待値にしないもの

- 金額・件数・取引先名・科目名・推奨の行の内容はモックで、実データを正とする (C7)。
- 画像の年間の差額の符号は誤りとして扱い、qa-tradeoff-decision-009 の符号 (新しい支出 − 削減、正は支出増) を正とする。
- 画像の保存一覧・突合に当たる表示があっても再現しない (qa-tradeoff-decision-004)。

## ビジネスルールと検証

### 候補の作り方 (qa-tradeoff-decision-001、qa-tradeoff-backend-web-003)

- 分析期間の終了月から遡る 3 か月の freee 事業経費 (`io = expense`) を `account_norm` × `partner` で集計する。取引先が空なら『取引先なし』と表示する。
- 月額 = 3 か月の合計 ÷ 3 (データの無い月は 0 として数える) を円単位の整数へ四捨五入し、その整数を 1,000 円の閾値と比較する。たとえば `[1,000, 1,000, 999]` は平均 999.67 円を 1,000 円へ丸めて候補に残す。月額 1,000 円以上のものを金額降順に最大 50 件。同額はキーの辞書順 (**agent 推定・利用者未確認**)。
- 推移: 3 か月の最初の月に対し最後の月が +10% 超で増加、−10% 未満で減少、それ以外は横ばい。最初の月が 0 の場合は最後の月が正なら増加、0 なら横ばい (**agent 推定・利用者未確認**)。
- 候補は保存しない。毎回 D1 の `freee_deals` から作る (qa-tradeoff-database-web-001)。

### 必要度 (qa-tradeoff-decision-010 / 011、利用者決定)

| catProfile の type | 推移 | 必要度 |
| --- | --- | --- |
| 固定費 (cv < 0.6) | 横ばい・増加 | 高 |
| スポット (cv ≥ 1.5) | どれでも | 低 |
| どれでも | 減少 | 低 |
| それ以外 (準変動、または上に当たらない組み合わせ) | — | 中 |

- 判定は上から順に当てる。固定費で減少は『減少』の行で低になる。
- type は既存 core の `catProfile(data, account_norm)` (`packages/core/src/analysis.ts:57`) をそのまま使い、閾値を複製しない。
- 検知器の改善案に当たっても必要度は下げない (qa-tradeoff-decision-011)。
- 利用者の上書き (`need` が NULL でない) があれば推定より優先し、『手動』の印を付ける (qa-tradeoff-decision-002)。
- 退けた選択肢: 010 (b) 固定費で横ばいのときだけ高 (固定費で増加・準変動は中)、010 (c) 推移を見ず 固定費 = 高・準変動 = 中・スポット = 低。011 (b) 固定費見直しと通信費見直し以外の検知器で 1 段下げる、011 (c) すべての検知器で 1 段下げる。どれも利用者が退けた。
- 取り消した規則: qa-tradeoff-backend-web-003 の科目名の固定表、003 / 004 の『1 段下げる』。

### 検知器との対応付けと理由の文 (qa-tradeoff-backend-web-004 / 005、agent 推定・利用者未確認)

- 候補の `account_norm` に `claimPart` と同じ正規化 (trim → NFKC → `toLocaleLowerCase('ja')`) を掛け、診断の改善案の `claimKeys` に含まれる `business:category:<科目>` と比べる。一致すれば当たり (取引先は見ない)。`claimPart` は `packages/core/src/diagnosis-detectors.ts:112` の非公開関数を export して 1 か所にする。
- 関連ページ: 当たった改善案の `nextAction.to`。複数当たれば改善案の並び順で最初のもの (**agent 推定・利用者未確認**)。
- 理由の文: 『<type>・直近 3 か月は<推移>』、当たりがあれば『・<改善案の label>』を続ける。利用者メモがあればメモを優先して表示する (qa-tradeoff-decision-007)。

### 試算 (qa-tradeoff-decision-005 / 009、利用者決定)

- 新しい支出の年額: 毎月 = 金額 × 12、単発 = 金額 (発生月だけ計上)。開始月は使わない (FR-3)。
- 削減の年額 = 選んだ候補の月額合計 × 12。
- 年間の差額 = 新しい支出の年額 − 削減の年額。正は支出増 (警告)、0 以下は捻出できる。
- 防衛ライン余裕 = `defenseLine(data).diff` × 12。`status = 'nodata'` のときは null。
- 試算後の余裕 = 防衛ライン余裕 − 年間の差額。0 以上で『維持』、負で『割れる』。
- 例 (O2): 毎月 80,000 / 削減 85,000/月 → 960,000 / 1,020,000 / −60,000 (捻出できる)。単発 300,000 / 削減 50,000/月 → 300,000 / 600,000 / −300,000。毎月 100,000 / 削減 50,000/月 → 1,200,000 / 600,000 / +600,000 (支出増)。

### 推奨の組み合わせ (qa-tradeoff-decision-003、規則の具体は qa-tradeoff-backend-web-003、agent 推定・利用者未確認)

- 月額上位 12 件から 2〜4 件の組み合わせを列挙し、削減の年額 ≥ 新しい支出の年額 のものだけを残す。
- 並べ順: リスク (必要度 高 の件数) 昇順 → 実行のしやすさ (必要度 低 の件数) 降順 → 超過額 (削減の年額 − 新しい支出の年額) 昇順 → 件数昇順 → 候補キーを連結した文字列の辞書順。上位 4 件。
- 必要度は上書きを重ねた後の値で数える。
- 充足度 = 削減の年額 ÷ 新しい支出の年額 × 100 (%、整数へ切り捨て)。
- 実行のしやすさ・リスクの表示: 低の件数・高の件数から『易しい / 普通 / 難しい』『低 / 中 / 高』へ写す (写し方は `docs/spec-v1.1.md` FR-09 の表に置く、**agent 推定・利用者未確認**)。
- 理由の文: 含む候補の必要度と推移から『<N> 件で年間 X 円を削減、必要度 高 を <k> 件含む』の形で core が作る (**agent 推定・利用者未確認**)。

### 記録の判定 (qa-tradeoff-backend-web-004 / 005、agent 推定・利用者未確認)

- `covered` = 選んだ候補の月額合計 (円/月)。既存 `tradeoffReview` が翌月の経費の減少額 (月額) と比べる意味と揃える。
- `verdict` = 年間の差額 ≤ 0 なら `covered`、正なら `insufficient` (既存の enum)。
- 差額・`verdict`・`covered`・候補の月額は導出値で、POST の本文では受け取らない。

## API契約

共通: すべて `/api/*` の authGuard・mustChangePasswordFence・runtimeSchemaGuard・canonicalMutationFence の内側に載る (qa-tradeoff-auth-web-001)。各クエリは `c.get('userId')` で絞る。期間は既存の `loadScoped` が読む query (`from` / `to` / `year` / `span`) で渡す。body は既存の `bodyLimit` (`packages/api/src/index.ts:89`) の内側。

### GET /api/tradeoff

#### 識別と目的

候補 (上書きを重ねたもの)・防衛ラインの月の余裕・最新の試算条件を返す (qa-tradeoff-backend-web-001)。

#### 認証・認可

セッション cookie。候補は利用者自身の `freee_deals`、上書きと最新の記録は `user_id` の一致する行だけ。

#### Request

query: 期間 (`loadScoped` と同じ)。body なし。

#### Response

200 `{ "candidates": 候補[], "defense": { "monthlyMargin": number | null, "status": "ok" | "tight" | "danger" | "nodata" }, "latest": 記録 | null }`。候補は `{ key, account, partner, monthly, annual, need, needSource: "auto" | "manual", trend: "down" | "flat" | "up", reason, memo, relatedTo }`。記録は `{ id, title, amount, recurring, startMonth, memo, keys, covered, verdict, createdAt }`。旧応答の `budgets`・`plans`・`review` は画面が使わなくなるため返さない (**agent 推定・利用者未確認**。`tradeoffReview` 関数とテストは残す)。

#### Validation・ビジネスルール

候補・必要度・推移・理由は上の「ビジネスルールと検証」の core 関数だけで作る。`defense` は `/api/defense-line` と同じ `defenseLine(data)` を使い、ヘッダーのバッジと同じ値になる。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | invalid_period | 期間の query が不正 (既存 `resolvePeriodQuery` の流儀) | no | 期間を選び直す |
| 401 | unauthorized | セッションが無い (authGuard) | no | ログインへ |
| 500 | internal | 予期しない失敗 | yes | 再読込 |

#### 実行セマンティクス

読み取りだけ。副作用なし。

#### キャッシュ・ページング

HTTP キャッシュは使わない。候補は最大 50 件でページングしない。web は TanStack Query のキー `['tradeoff', 期間]` で持つ。

#### 可観測性と監査

既存の API エラーログの流儀で code を残す。支出名・メモ・取引先名はログに出さない。

#### セキュリティ確認

他の利用者の上書き・記録が混ざらないことを api テストで確かめる。文字列は React の既定エスケープで描画する。

#### Contract tests

固定の `freee_deals` で候補の件数・月額・推移・必要度・理由が期待表と一致する。上書きがあると `need` と `needSource: "manual"` が変わる。記録が無ければ `latest: null`、複数あれば `id` 最大の 1 件。`nodata` で `monthlyMargin: null`。

### POST /api/tradeoff

#### 識別と目的

試算の条件を 1 行追加する。サーバが core で再計算した値だけを保存する (qa-tradeoff-decision-008、qa-tradeoff-backend-web-004 (6))。

#### 認証・認可

セッション cookie。行の `user_id` は `c.get('userId')`。

#### Request

query: 期間 (候補を GET と同じ条件で作り直すため)。body (zod): `{ title?: string ≤100 | null, amount: int 1..100000000, recurring: boolean, startMonth: "YYYY-MM" | null, memo: string ≤500 | null, keys: string(≤300)[] 1..50 }` (上限は qa-tradeoff-security-web-003 / 005、**agent 推定・利用者未確認**。keys の下限 1 は選択中バーが 1 件以上でだけ出ることに合わせた **agent 推定・利用者未確認**)。`covered`・`verdict`・`selected.value` は受け取らない。

#### Response

201 `{ "ok": true, "id": number, "plan": 記録 }`。記録の形は GET の `latest` と同じ。

#### Validation・ビジネスルール

keys を現在の候補と照合し、1 つでも無ければ 422。一致した候補の月額から core の試算関数で `covered`・差額・`verdict` を計算し、`selected` に `[{ key, label, value }]` (value はサーバの月額) を JSON で保存する。保存前に不変条件 (`covered` は 0 以上 10,000,000,000 以下の整数) を確かめる (qa-tradeoff-security-web-005)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | (zValidator の既定) | body が zod に不適合 | no | 入力を直す |
| 401 | unauthorized | セッションが無い | no | ログインへ |
| 413 | payload_too_large | body が既存の bodyLimit を超える | no | 入力を短くする |
| 422 | unknown_candidate | keys に現在の候補に無いものがある | no | GET を取り直して選び直す |
| 500 | internal | 不変条件の違反・予期しない失敗 (保存しない) | yes | 再試行 |

#### 実行セマンティクス

1 回の INSERT。押すたびに 1 行増える (冪等ではない、qa-tradeoff-decision-008)。既存行は更新しない。

#### キャッシュ・ページング

N/A: 単一行の追加。成功後 web は tradeoff の query を無効化する。

#### 可観測性と監査

`created_at` と行そのものが履歴を兼ね、支出名・メモは `tradeoff_plans` の条件として保存する。これらの値や取引先名はログへ出さない。

#### セキュリティ確認

クライアントの計算値を信用しない。他の利用者の候補キーは現在の候補に無いので 422 になる。

#### Contract tests

O2 の 3 例で保存した `covered`・`verdict` が期待どおり。本文に `covered: 999999999` を足しても保存値は変わらない (未知キーは zod が落とすか無視する流儀のどちらでも保存値が再計算値であること)。未知のキーで 422 と行数 0 増。上限 +1 の各欄で 400。2 回押すと 2 行。

### PUT /api/tradeoff/candidates/:key

#### 識別と目的

候補ごとの必要度とメモを upsert する (qa-tradeoff-decision-002 / 007、経路は qa-tradeoff-backend-web-004 (7)、**agent 推定・利用者未確認**)。

#### 認証・認可

セッション cookie。行は `(user_id, candidate_key)` で分け、他の利用者の行には書けない (qa-tradeoff-security-web-004)。

#### Request

path `key` (URL エンコードした候補キー、復号後 300 字以下)。query: 期間。body (zod): `{ need: "low" | "mid" | "high" | null, memo: string ≤500 | null }`。1 回に 1 候補。

#### Response

200 `{ "ok": true, "candidate": 候補 }` (上書きを重ねた後の 1 行)。

#### Validation・ビジネスルール

key が現在の候補に無ければ 422。`need` と `memo` が両方 null なら行を消して自動へ戻す。それ以外は `(user_id, candidate_key)` の一意制約で `INSERT ... ON CONFLICT DO UPDATE`。メモの空文字は null として扱う (**agent 推定・利用者未確認**)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | (zValidator の既定) | body が不適合、または key が 300 字超 | no | 入力を直す |
| 401 | unauthorized | セッションが無い | no | ログインへ |
| 413 | payload_too_large | body が上限超過 | no | メモを短くする |
| 422 | unknown_candidate | key が現在の候補に無い | no | GET を取り直す |
| 500 | internal | 予期しない失敗 | yes | 再試行 |

#### 実行セマンティクス

同じ body の繰り返しは同じ結果 (冪等)。1 文の upsert または 1 文の削除。

#### キャッシュ・ページング

N/A。成功後 web は tradeoff の query だけを無効化する (TanStack Query の `invalidateQueries`)。

#### 可観測性と監査

`updated_at` を記録する。メモの本文はログに出さない。

#### セキュリティ確認

利用者 A の上書きが利用者 B の GET に出ない。メモは React の既定エスケープで描画し `dangerouslySetInnerHTML` を使わない。

#### Contract tests

保存 → GET で `needSource: "manual"` とメモ。両方 null で行が消え自動へ戻る。別の利用者から見えない。未知の key で 422。501 字のメモで 400。

## データモデル

migration `migrations/0051_tradeoff_notes.sql` (予定番号 0050 を main 取り込み時点の最新 +1 へ付け替えた、qa-tradeoff-maintenance-ops-web-003)。追加のみ (C3)。

| 対象 | 変更 |
| --- | --- |
| `tradeoff_plans.start_month` | `ALTER TABLE ADD COLUMN start_month TEXT` (YYYY-MM、NULL 可) |
| `tradeoff_plans.memo` | `ALTER TABLE ADD COLUMN memo TEXT` (NULL 可) |
| 新表 `tradeoff_candidate_notes` | `user_id TEXT NOT NULL`, `candidate_key TEXT NOT NULL`, `need TEXT` (`low` / `mid` / `high` / NULL), `memo TEXT` (NULL 可), `updated_at TEXT NOT NULL`。一意索引 `(user_id, candidate_key)` |

- 既存行は書き換えない (更新 0 件)。既存行の `start_month`・`memo` は NULL として読み、`selected` に `key` を持たない旧行は復元時に選択なしとして扱う。
- 候補そのもの・必要度の推定値・差額は保存しない。
- `packages/api/src/db/schema.ts` の `tradeoffPlans` (610 行) に列を、新表の定義を足す。
- 形の具体は qa-tradeoff-database-web-003 (**agent 推定・利用者未確認**)。

## 認証・認可

- 新しい認証方式・権限区分は作らない。3 経路とも既存 `/api/*` のフェンスの内側で、route の中で個別の認可判定を書かない (qa-tradeoff-auth-web-001)。
- 全クエリを `c.get('userId')` で絞る。候補キーはその利用者の現在の候補にあるものだけを受け付ける。

## エラー・例外・回復

- 取得の失敗: PageState の失敗と再読込。
- 記録の 422: 『選んだ候補が現在の期間にありません。取り直しました』を出し、tradeoff の query を取り直す。入力は保持する (**agent 推定・利用者未確認**)。
- 記録・上書きの 400 / 413: 文を出し入力を保持する。
- 上書きの失敗: 行を元の値へ戻し文を出す。
- 復元時に現在の候補に無いキー: 選択から外し『N 件の候補は現在の期間に無いため外しました』を出す (**agent 推定・利用者未確認**)。
- 防衛ラインの nodata: FR-10 の文 (エラーではない)。

## イベント・非同期処理

- キュー・定期処理・Webhook は無い。
- 変更の成功後は TanStack Query の `useMutation` の成功時に tradeoff の query だけを無効化する (qa-tradeoff-frontend-web-001)。
- 試算・推奨は入力の変化で同期的に再計算する (core の純関数)。

## 可観測性

- 新しい計測基盤やダッシュボードは足さない。記録の行と `updated_at` が履歴を兼ねる。
- API のエラーは既存の流儀で code を残す。支出名・メモ・取引先名はログに出さない。

## 互換性・移行・リリース

- 反映の順序は既存の Migrate → Deploy (qa-tradeoff-infrastructure-web-001)。0051 は列と表の追加だけなので、適用後に旧 Worker が動いても新しい列を読まないだけで壊れない。
- `EXPECTED_D1_MIGRATION` (現在 `'0051_budget_plans.sql'`) とそのテストを同じ変更で 0051 へ進める。
- `POST /api/tradeoff` の入力の形が変わる。呼び出し元は web のトレードオフ画面だけなので同時に置き換える。
- 既存の `tradeoffCandidates`・`defenseLine`・`/api/defense-line`・`tradeoffReview` の数字と既存テストは変えない (C5)。core の `packages/core/test/tradeoff-review-contract.test.ts` と `diagnosis-detectors-contract.test.ts` は緑のまま残す。
- 例外: `packages/web/src/tradeoff-review.dom.test.tsx` (3 件) は画面に翌月の突合が出ることを確かめるテストで、qa-tradeoff-decision-004 (突合を画面から外す) と両立しない。突合の数字の契約は上の core テストが持ち続けるので、この DOM テストは『突合の表示が無いこと』を確かめる形へ書き換える。消すのではなく意図を置き換えることを変更の説明に明記する (**agent 推定・利用者未確認**)。
- 新しい secret・binding・外部サービスは無い。

## テストと受入条件

core 単体テスト (vitest):

- 試算: O2 の 3 例を `toBe` で固定。防衛ラインの境界 (試算後 0 = 維持、−1 = 割れる) と nodata で null。開始月を変えても結果が変わらない。
- 候補: 固定入力で 科目×取引先の集計・月額・1,000 円の境界・50 件の上限・『取引先なし』・同額の並び。
- 推移: +10% ちょうど = 横ばい、+10% 超 = 増加、−10% ちょうど = 横ばい、−10% 未満 = 減少、初月 0。
- 必要度: 決定 010 の 4 行それぞれ。検知器に当たっても下がらない (011)。上書きが優先される。
- 理由: 当たりなし・当たりあり・メモ優先の 3 通りを `toBe` で固定。
- 推奨: 同じ入力で同じ上位 4 件を `toEqual`。届かない組み合わせが入らない。順位の 5 段の各段で差が付く入力。
- `covered` の不変条件 (0〜1e10 の整数)。`claimPart` を export しても既存の診断検知器のテストが緑。

API テスト:

- 3 経路の Contract tests (各節)。zod の上限 +1 で 400、認証なしで 401、利用者 A / B の分離、最新 1 件の復元。
- migration 0051 の適用で既存の `tradeoff_plans` 行の更新が 0 件。

DOM テスト:

- `/tradeoff` に 見出しと問い・分析期間カード・1.新しい支出の 5 入力・2.候補表の 7 列と # 列・検索・カテゴリ絞込・全クリア・3.推奨の表と理由とリンク・計算例 2 種・右側の試算結果と防衛ラインへの影響と計算の前提・選択中バー が描画される (O1)。
- 読込・空・失敗の各状態。選択 0 件で選択中バーが無い。防衛ラインの nodata の文。
- 右パネル・選択中バーの年間差額が同じ値。
- 直書き色 0、共通 Button の使用。保存一覧と突合が無い。

全体:

- 既存の tradeoff-review (core 契約) と diagnosis-detectors のテストが緑。`tradeoff-review.dom.test.tsx` は上記「互換性・移行・リリース」の例外どおり書き換える。typecheck・lint・`verify:full`・初期 JS 予算が緑 (S6)。
- web と api に試算の式 (×12・差額) の重複が無いことを grep で確かめる (O2)。
- 受入は実行済みの最新のテスト証跡だけで判定する。未実施、一部適合、または既知の逸脱が 1 件でも残る項目は PASS にしない。

## 未決事項

- 本文で「agent 推定・利用者未確認」と注記した値 (候補表の 10 件と『すべて表示』、文言、開始月と単発 / 毎月の既定、防衛ラインが無いときの文、推移の初月 0 の扱い、同額の並び、組み合わせの列挙範囲と順位、充足度の丸め、しやすさ・リスクの写し方、推奨の理由の文、関連ページの選び方、新表の形、文字数と金額の上限、keys の下限、PUT の経路と空メモの扱い、GET から `budgets`・`plans`・`review` を外すこと、422 の文、`tradeoff-review.dom.test.tsx` の書き換え) は、利用者の確認で変わり得る。変わった場合は `docs/spec-v1.1.md` FR-09 の表と core のテストの期待値を同時に直す。
- migration の番号は予定番号 0050 を main 取り込み時点 (0ed2d8c、最新 0050_budget_plans.sql) の最新 +1 の 0051 へ付け替えた。merge 直前にもう一度 fetch して空きを確かめる。
