---
graph_node_id: "spec-mf-business-classification"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "MF 中項目による事業振り分け仕様"
project_id: "kanjo"
domain: "mf-business-classification"
status: "active"
owners: []
tags: ["mf-business-classification", "canonical-contract"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-total-cashflow-system"]
related_nodes: ["feat-mf-business-classification", "arch-mf-business-backend", "arch-mf-business-database", "arch-mf-business-frontend", "arch-mf-business-ui-ux", "arch-mf-business-auth", "arch-mf-business-security", "arch-mf-business-infrastructure", "arch-mf-business-maintenance-ops"]
resource_scope: ["specs/spec-total-cashflow-system.md", "packages/core/src/types.ts", "packages/core/src/classify.ts", "packages/core/src/total-cashflow.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/total-cashflow.ts", "packages/web/src/api.ts", "packages/web/src/pages/Classify.tsx", "packages/web/src/pages/analysis/TotalCashflow.tsx"]
purpose: "MF 中項目による公私判定を単一契約にし、公私仕分けとトータル収支の境界を一致させる。"
goal: "同じ入力と利用者判断から、全画面・全集計が同じ事業/家計分類と根拠を導出する。"
scope_in: ["MF 中項目の事業判定", "判定優先順位", "既存トータル収支への適用", "既存 API 応答の根拠表示", "要確認集合の表示"]
scope_out: ["永続スキーマ変更", "新規 API エンドポイント", "認証方式変更", "除外リスト設定", "既存手動編集の再評価"]
acceptance: ["比較・優先順位・集計・wire 契約が本書どおりである", "公私仕分けとトータル収支が同じ resolveTx の結果を使う", "互換性変更と復旧方法が明記される"]
architecture_refs: ["arch-mf-business-backend", "arch-mf-business-database", "arch-mf-business-frontend", "arch-mf-business-ui-ux", "arch-mf-business-auth", "arch-mf-business-security", "arch-mf-business-infrastructure", "arch-mf-business-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/spec-mf-business-classification.md"
template_id: "specification"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f88998635cdf9dd3a7e6be3e6f2a59cd92cda235ef285ca317e0808582525885"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "f88998635cdf9dd3a7e6be3e6f2a59cd92cda235ef285ca317e0808582525885", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "MF 事業判定の規範を保持する単一の specification。system-spec は決定来歴、feature は実装範囲、architecture は領域別制約として本書を参照する。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-mf-business-classification.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-10T06:03:20Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# MF 中項目による事業振り分け仕様

本書が MF 事業判定の唯一の規範である。`system-spec/` は決定来歴、`features/` は実装差分、`architecture/` の MF 文書は領域別制約、`docs/mf-business-classification/` は検証・運用記録を持つ。重複した規則は各文書へ再掲しない。

## 基本契約

`isMfBizByMid` は中項目を永続化時に書き換えず、**比較時だけ**前後空白を除去してから `事業` で始まるかを判定する。収入・支出の符号は判定条件に含めない。個別の中項目名は列挙しない。

```ts
isMfBizByMid({ mid }) === (mid ?? '').trim().startsWith('事業')
```

`cls` の決定順は次の 5 段だけである。

1. `manual`: 通常の手動編集
2. `rule`: 明示ルール
3. `vendor_memory`: 取引先メモリ由来の編集
4. `mf_mid`: `isMfBizByMid` の一致
5. `default`: `per`

口座名義は `owner` の決定根拠であり、`cls` の優先順位へ混ぜない。`vendor_memory` は保存上 `TxEdit` を使っても、通常の手動編集とは異なる自動根拠として上記の位置に置く。

`vendor_memory` は優先順位を説明する**由来**であり、独立した `ClassificationSource` / wire source は追加しない。materialize 後の `ResolvedTx.clsSrc` と API の `src` は `手動` を返し、由来は `origin=vendor_memory` で保持する。

## 共通解決と集計

- `resolveIncomingTx` が `rule > vendor_memory > mf_mid > default` を解決し、`resolveTx` が通常の手動編集を最優先で重ねる。
- 公私仕分けとトータル収支は、ともに `resolveTx` の結果を使う。
- `total-cashflow.ts` は `isMfBizByMid` を直接呼ばない。`resolveTx` を介した**間接依存**にすることで、優先順位を迂回する二本目の判定を作らない。
- `resolveTx` は月別ループの外で明細ごとに一度だけ評価し、集計はその導出結果を再利用する。
- freee との消し込みを先に行い、消し込み済み MF 明細を二重計上しない。未消し込み明細だけを `resolveTx` の `cls` に従って事業または家計へ入れる。
- 要確認明細は判断が付くまで事業/家計・収入/支出のどの合計にも入れない。`reviewCount` と `reviewAmount` は同じ集合からサーバー側で導出する。
- `verdict=same` は freee 正本だけを維持し、候補 MF を加算しないため総額不変。`verdict=different` は候補 MF を独立残余として `resolveTx` の区分へ加算する。
- 要確認 MF の投影にも `cls` と内部根拠 `clsSrc` を含め、公私仕分けと同じ `resolveTx` の結果を示す。

## 既存トータル収支仕様との関係

本書は active な `spec-total-cashflow-system` と `spec-total-cashflow-requirements` を、**MF 公私判定と要確認の集計意味について改訂し、その旧条項に優先する**。旧分類名による判定を `resolveTx` へ置き換え、未判断の要確認集合を4区分合計から除外して `reviewCount` / `reviewAmount` で別管理する。消し込み、残余加算、期間集計、トレンドなど改訂対象外の契約は既存仕様を維持する。

## API wire 契約

新規エンドポイントは作らない。

- 明細: `GET /api/transactions`
- 明細行の判定根拠キー: `src`
- 月次進捗: `summary.progress.bySource`
- `src` と `bySource` の wire 値: `手動 | ルール | 中項目 | 既定`
- トータル収支: `GET /api/total-cashflow`
- 要確認: `reviewCount` と `reviewAmount`

`clsSrc` は core 内部の `ResolvedTx` プロパティ名であり、API wire key ではない。ルート群の実装ファイル名が `classify.ts` でも、公開ルートを `/api/classify` と記述しない。

値集合と進捗形状の型正本は core の `ClassificationSource` と `ClassificationProgress`。web はこの型を共有し、同じ enum / shape を再宣言しない。

## 互換性

次は意図的な意味・enum 互換性変更であり、「既存の意味を変えない additive 変更」とは扱わない。

- `src` / `bySource` の閉じた値集合に `中項目` を追加する。網羅分岐するクライアントは更新が必要である。
- 以前は `既定` だった対象が `中項目` になり、`reviewPending` から外れる。件数の意味が変わる。
- 同じ入力でも、MF 中項目または前後空白の扱いにより `cls` と集計先が変わり得る。これは不具合修正として意図した動作変更である。
- `reviewAmount` は新規フィールドであり、既存フィールドの削除はない。

DB マイグレーションは行わない。MF の取込値は保存時に trim せず、比較結果と集計は要求時に導出する。既存の通常手動編集は再評価しない。

## エラー・セキュリティ

既存の認証境界、入力検証、エラー形状を維持する。判定根拠は利用者自身の分類理由だけを示し、取込原本や秘密情報をログ・文書へ複製しない。

## リリース復旧

- **版の巻き戻し**: 対象コミットを `git revert` し、通常の CI/CD 経路で再公開する。コード、wire enum、意味変更を一体で前版へ戻す正式な rollback である。
- **MF 中項目判定の部分無効化**: `mf_mid` 分岐だけを無効にする別の変更であり、rollback とは呼ばない。現時点で実行時 feature flag は設けないため、必要なら新しい変更・テスト・リリースとして行う。

## 受入条件

- 空、空白だけ、または `事業` で始まらない中項目は `mf_mid` に一致しない。
- 前後空白を除くと `事業` で始まる中項目は、既知名称の列挙なしで一致する。
- 通常手動、ルール、取引先メモリが `mf_mid` を上書きする。
- 公私仕分けとトータル収支で同じ明細の `cls` が一致する。
- `/api/transactions` の各行は `src` を返し、`summary.progress.bySource` の合計は対象件数と一致する。
- `src` / `bySource` の型と画面表示が `中項目` を網羅する。
- 要確認集合は4区分の合計から除外され、件数と金額が同じ集合に基づく。
- `same` は総額を変えず、`different` は残余 MF を解決済み区分へ加算する。
- raw production data を保存・出力せず、匿名化した fixture で契約を固定する。

## 未決事項

なし。除外リストや実行時 feature flag は別 feature とする。
