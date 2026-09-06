---
graph_node_id: "spec-total-cashflow-requirements"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "トータル収支一覧 — 要件仕様"
project_id: "kanjo"
domain: "requirements"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "requirements"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: []
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/total-cashflow-requirements.md"
template_id: "specification"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "5c09c96c9e8beec154d8ec3b7b595130486284cc31e670fff3074e7119422527"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.11", "source_digest": "5c09c96c9e8beec154d8ec3b7b595130486284cc31e670fff3074e7119422527", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/00-requirements-definition.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G1,G2,G3,G4,G5,G6,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/total-cashflow-requirements.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]
---

# トータル収支一覧 — 要件仕様

freee (事業) と Money Forward (家計) に分かれた収入・支出を、二重計上を明細単位で消し込んだうえで 1 つの月次一覧表へ束ねる機能の要件仕様。上位概念 U1-U9 の確定内容は正本を参照する。

> 本文の正本は `system-spec/00-requirements-definition.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G1, G2, G3, G4, G5, G6, G7

## 目的と成功状態

個人事業主として事業と家計が一体になっている実態に対し、freee (事業帳簿) と Money Forward (家計)
へ分かれて記録された収入・支出を、二重計上を明細単位で消し込んだうえで1つの一覧表へ束ね、
月ごとの「トータルの収入・支出・収支」と費用の推移を、消し込んだ根拠ごと確認できる状態にする。

成功状態は正本 `system-spec/00-requirements-definition.md` の U5 に 6 件確定している。中核は
「利用者が一覧表の1行を見るだけで、その月に全体でいくらプラスかマイナスかを言える」ことと、
「その額がなぜそうなるかを、事業費/家計費の内訳列と要確認件数から利用者自身が説明できる」ことである。

## スコープ

対象 (U7 in): 既存取込データからのトータル収支の導出 / freee↔MF 間の重複支出・重複収入の明細単位の
照合と消し込み / 自動照合できない明細の要確認一覧と利用者判断の永続化・再適用 / トータル支出の
トレンド判定と事業・家計の内訳保持 / 月次一覧表の web 画面表示と期間切替への追随。

対象外 (U7 out): 新しい取込元の追加 / freee 帳簿そのものの書き換え (税務の正本は freee のまま。
本機能は読み取り専用の投影) / Money Forward 内部の重複 (既存 isTransfer 判定で除外済み) /
予算・目標設定機能の変更 / モバイル・タブレット・デスクトップ専用アプリの提供。

プラットフォームは web のみ。他 5 platform の 40 セルは承認 `appr-target-platforms-007` により
対象外で、各カテゴリで放棄した検討事項と代替の引受先はマトリクスの reason に個別記録してある。

## 用語と主体

- **canonical**: 取り込んだ MF 明細・freee 取引・利用者の手当て。唯一の真実であり本機能は書き換えない。
- **導出値**: 月次のトータル収入・支出・収支、事業費/家計費の内訳、寄せた額と件数、トレンド判定。
  保存せず要求時に canonical から毎回導出する (dec-aggregation-strategy-001)。
- **DuplicateVerdict**: 要確認明細に対する利用者の「同じ/違う」判断。導出できない利用者の意思であり、
  本機能で唯一永続化するもの。主キーは `MfTx.idStable`。
- **要確認**: 金額一致かつ発生日が ±3 日以内で抽出された、自動確定できない重複候補。
- 主体は利用者本人 (単一。ロール分割を持たない) と、税務申告の受け手 (freee 帳簿が正本であり続ける前提)。

## ユースケースとユーザーフロー

1. 利用者が CSV を取り込む → 取込完了時に要確認が残っていれば、その場で画面に警告が出る
   (`qa-anomaly-notice-001`、利用者の明示選択)。
2. 利用者が分析タブ群の新しいタブを開く → 月次一覧表 (9 列) が表示される。
3. 行から事業側・家計側の内訳へドリルダウンする (I8)。個別明細と勘定科目別内訳は表に常置しない。
4. 要確認を解消したくなったら、既存の取込明細編集画面へ移り「同じ/違う」を判断する。
   判断専用の画面やタブは新設しない (U8 制約)。
5. 判断は mutation として送られ、成功時に一覧表のクエリが無効化され再取得される。合計はサーバ側の
   導出値のみを真実とし、クライアントで再計算しない。
6. 期間を切り替えると、合算・消し込み・トレンド判定が同じ規則で再計算される (G7)。

## 機能要件

U9 の I1-I9 が機能要件の確定集合である (正本の当該表を参照)。要点:

- I1 月ごとに「総収入・総支出・総収支」が並ぶ一覧表を出す。
- I3 MF 明細の日付と freee 取引の発生日 (`FreeeDeal.date`) が一致し金額も一致する支出は事業で使う
  費用とみなし、freee を正として事業費に一度だけ計上し MF 側を家計費から外す。同じ (金額, 発生日) に
  MF が n 件・freee が m 件あるときは MF から `min(n, m)` 件を外す。
- I4 MF 側で事業・副業に分類される入金を事業収入とし、それ以外を家計収入とする。freee 売上と
  同額・同発生日で重なる分は支出と同じ規則で freee を正とする。
- I5 自動確定できなかった候補を、理由付きの要確認一覧として出す。抽出は合計を変えない。
- I6 「同じ/違う」判断を既存の取込明細編集画面から行い、保存して次の取込でも再適用する。「同じ」は
  合計へ反映し、支出は当該 MF 明細を家計費から外して事業費へ、収入は当該 MF 入金を家計収入から外して
  事業収入へ寄せる (支出と収入で同一の規則)。いずれの向きでも総額は変わらず内訳だけが移る。
- I7 トータル支出の増減を既存のトレンド判定基準で表示する。

## 非機能要件

- **正しさ**: 恒等式 `総支出 = 事業費 + 家計費` と `総収入 = 事業収入 + 家計収入` が、利用者判断の
  前後いずれでも全月で成立する (O1-O4 の測り方)。
- **検算可能性**: 合計は利用者が内訳列から手で検算できること (G3)。導出値を canonical と二重に
  持たない設計がこれを構造的に保証する。
- **性能**: 月次数十行規模。D1 の公式上限 (1 呼出し 1,000 クエリ / SQL 文 100KB / 実行時間 30 秒 /
  バインドパラメータ 100) の内側に収まることを確認済み。期間指定は範囲条件で表現し個別 ID を列挙しない。
- **一貫性**: カテゴリ別トレンドと同一の統計基準・閾値・判定語を用い、同一画面で基準が食い違わない。
- **既存互換**: 既存 `trend.ts` / `analysis.ts` の公開関数の意味を変えない。

## UI・状態遷移

一覧表は 月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド の
**9 列すべてを常時表示**する。小画面でも列を落とさない (`qa-table-columns-001` / `appr-foundation-total-cashflow-005`、
利用者の明示選択)。表自体を横スクロール可能な領域に収め、ページ本体は横スクロールしない。

状態遷移: 取込完了 → (要確認あり) 画面警告 → 一覧表表示 → 行ドリルダウン、または既存の明細編集画面で
判断 → mutation 成功 → クエリ無効化 → 再取得 → 数字更新。TREND_MIN_MONTHS 未満の期間では
トレンド列が「判定不可」となるため、その挙動を UI 側で明示する。

## ビジネスルールと検証

帰属を動かす権限を持つのは次の 2 つだけである。

1. **自動判定器**: 「MF 明細の日付 = freee 取引の発生日 かつ 金額一致」の 1 本のみ。判定を 1 箇所に置き
   複製しない。freee 側の `dueDate` / `settledDate` は用いない。支払先を用いない (同額・同日の無関係な
   支出も事業費として扱われうることを既知の限界として明記する — 単純さと予測可能性を優先した利用者判断)。
2. **利用者の明示判断**: 「同じ」は自動規則を上書きし、当該明細を家計側から外して事業側へ寄せる。
   上書きも 1 対 1 を保ち、freee 側 1 取引に対し MF は 1 件まで。「違う」は帰属を変えず、次回以降
   その組を要確認として再提示しない。

候補抽出器 (金額一致かつ発生日 ±3 日以内) は自身では帰属を変えず、要確認一覧の生成にのみ用いる。
除外は freee 側の件数を上限とし、freee に存在しない分の MF 明細を消さない (過小計上の防止)。

## API契約

追加する API は既存 `/api` 認証ゲートの内側に置く (dec-auth-boundary-001、利用者の明示選択)。
`wrangler.jsonc` の `run_worker_first: ['/api/*']` により、追加 API も必ずゲートを通る。

- 読み取り: 期間を範囲条件で受け取り、月次トータル収支行 (9 列に対応する値) と要確認一覧を返す。
- 書き込み: `DuplicateVerdict` の upsert 1 点のみ。書込面をここに限定し、既存の
  canonical-mutation-fence と同じ方針で正本更新経路と分離する。

入出力は zod スキーマで検証し、明細識別子は `MfTx.idStable` に限定する。不安定な識別子での判断保存は拒否する。
API 変更を伴うため `artifact_subtypes` に `api` を含める。

## データモデル

既存 Cloudflare D1 (`kanjo-db`) を drizzle-orm 経由で使う。

- **保存しない**: 月次トータル収入・支出・収支、事業費/家計費の内訳、寄せた額と件数、トレンド判定。
  いずれも導出値であり専用テーブルを持たない。
- **保存する**: `DuplicateVerdict` のみ。`migrations/` に新規連番 SQL を 1 本追加して専用テーブルへ
  永続化する。主キーは `MfTx.idStable`。

追加テーブルのみで既存テーブルのスキーマを変更しないため後方互換を保つ。既存の取込ライフサイクル
(`0008_import_lifecycle.sql`) と同様、再取込で明細が入れ替わっても `idStable` が同じなら判断が再適用される。

## 認証・認可

認証境界は既存の `/api` 認証ゲート 1 つに保つ (dec-auth-boundary-001)。既存は二段構え —
`ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` 設定時は Cloudflare Access JWT 検証、未設定時はアプリ内
セッション認証 (HMAC 署名 HttpOnly Cookie、タイミング非依存比較) — であり、これを壊さない。

認可はロール分割を持たない単一主体モデルのままとする。複数人で使い始める場合はこの前提が崩れるため、
その時点で dec-auth-boundary-001 を意思決定として扱い直す。読み取り専用トークン発行案 (B) と
Cloudflare Access 一本化案 (C) は明示的に棄却されている。

## エラー・例外・回復

- 判断保存の失敗は合計へ反映せず、UI 側で再試行可能な形で提示する。クライアントは合計を再計算しない
  ため、失敗時に画面上の数字が先走ることがない。
- 不安定な識別子の明細に対する判断保存要求は拒否する (静かに保存して次回消えるより、拒否して見せる)。
- ログ・エラー応答に金額や取引先を出さない (S5)。observability は有効のまま、追加処理でリクエスト
  ボディや明細内容をログへ出さない。
- 復旧手段は既存のまま。夜間 cron による D1→R2 バックアップ (30 日保持) と D1 time-travel を用い、
  本機能のために新しい復旧経路を作らない。

## イベント・非同期処理

非同期処理は追加しない。集計は要求時に毎回導出する (dec-aggregation-strategy-001) ため、事前計算
バッチも再計算トリガも持たない。既存の日次 cron (`0 18 * * *` UTC) はバックアップ用途のままで、
本機能の集計には関与しない。

判断の反映は mutation → クエリ無効化 → 再取得という同期的な往復のみで完結する。

## 可観測性

既存の observability をそのまま用い、本機能のための新しい監視基盤・アラート経路を追加しない。
異常への気付きは「CSV 取込完了時点で要確認が残っていれば画面に警告を出す」という利用者選択の
方式に一本化する (`qa-anomaly-notice-001`)。メール・push・外部監視は追加しない。

監査証跡は既存 `audit-log.ts` の方針に従い、`DuplicateVerdict` の変更を追跡可能にする。

## 互換性・移行・リリース

- 既存 `trend.ts` / `analysis.ts` の公開関数の戻り値定義を書き換えない (追加のみ)。
- スキーマ変更は追加テーブル 1 本のみで、ロールバックは当該マイグレーションの逆適用で足りる。
- 配信は既存の Cloudflare Workers への deploy 一経路。署名鍵やストア審査といった新しい工程を持たない。
- 表示は既存の分析タブ群へ新しいタブとして追加する。既存タブの意味を変えない。

## テストと受入条件

O1-O6 の測り方がそのまま受入条件である。件数の正本は
`features/feat-total-cashflow.md` の acceptance 10 件 (F1..F10) で、下表はその全件を写す。

| 受入 | 条件 | 種別 |
|---|---|---|
| F1 | 恒等式 `総支出 = 事業費 + 家計費` / `総収入 = 事業収入 + 家計収入` が全月で成立 | 契約 |
| F2 | (金額, 発生日) ごとに MF から `min(n, m)` 件が事業費側へ寄る。freee 件数を超える付替が 0 件、支払先を用いた判定が 0 件、±3 日照合による自動付替が 0 件 | 契約 |
| F3 | 月ごとの「寄せた件数」と「寄せた金額」が消し込み対象明細の実数と一致し、画面の同一セルに併記される | 契約 + 画面 |
| F4 | 重複候補が理由付きで列挙され、0 件のときは 0 件と画面に明示される (空欄にしない) | 画面 |
| F5 | 判断が保存され再取込後も同じ明細へ再適用される | 結合 |
| F6 | 収入側の「同じ」判定でも支出側と同じ消し込みが働き、MF 側が家計収入から外れて総収入が減り、恒等式が保たれる | 契約 |
| F7 | `TREND_MIN_MONTHS` 未満は「判定不可」、有意判定は `TREND_ALPHA` を既存と共有する | 契約 |
| F8 | 期間を切り替えても、両方に含まれる月の値が一致する | 契約 |
| F9 | 9 列すべてが常時表示される | 画面 |
| F10 | 取込完了時に要確認が残っていれば画面へ警告が出る | 画面 |

利用者の「同じ」判断による付替が freee 側 1 取引につき MF 1 件までであることは、
F2 / F6 が壊れる経路を塞ぐ補助検査として別に固定する (受入 10 件そのものではない)。

以前この節は 6 行の箇条書きで、F3 / F4 / F6 / F8 を落としていた。落ちた 4 件は
どの工程の視野にも入らず、テストの無い受入として最後まで残った。件数を減らす形の
要約をここに置かない (少ない方に合わせると、検証したつもりの穴がそのまま残る)。

各テストは旧実装に対して RED になることを確認してから採用する (0 件の違反と 0 件しか調べていないの区別)。

## 未決事項

現時点で未決の仕様事項は無い (収集マトリクス 48 セルの未収集 0、`ungrounded_blocking_items` 空)。
残る限界は未決ではなく既知の限界として確定済みである:

- 支払先を見ないため、同額・同発生日の無関係な支出が事業費として扱われうる (利用者判断で受容)。
- 収入側は freee が発生主義の発生日、MF が入金日であるため日付一致が少なく、消し込める件数は
  少ない見込み。一致しない組は要確認として可視化する。
- `TREND_MIN_MONTHS` 未満の期間では常に「判定不可」となる。
- 単調トレンドのみ検出するため、増加後に減少へ転じた推移は「横ばい」寄りに判定されうる。
