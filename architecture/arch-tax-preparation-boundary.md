---
graph_node_id: "arch-tax-preparation-boundary"
artifact_kind: "architecture"
artifact_subtypes: ["backend", "frontend", "data", "security"]
title: "確定申告準備の対象年境界と証憑完全性の契約"
project_id: "kanjo"
domain: "backend"
status: "draft"
owners: []
tags: ["tax", "receipts", "r2"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-29T00:00:00Z"
updated_at: "2026-08-29T00:00:00Z"
depends_on: []
related_nodes: ["feat-tax-preparation", "spec-tax-preparation"]
resource_scope: ["architecture/arch-tax-preparation-boundary.md"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-tax-preparation-boundary.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "manual-review", "evidence_ref": "docs/product/elegant-review-tax-preparation/T4-release-readiness.md", "evaluated_digest": null}
source_lineage: {"origin_kind": "manual", "source_plugin": null, "source_path": "docs/spec-v1.1.md", "source_version": "1.1", "source_digest": null, "imported_at": "2026-08-29T00:00:00Z"}
classification_confidence: 1.0
classification_reason: "対象年の解釈境界と証憑完全性という、2画面・7APIをまたぐ横断契約であるためアーキテクチャ層。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": ["tasks/tax-preparation-tasks.md"]}
implementation_readiness: {"status": "ready", "missing_sections": [], "checked_at": "2026-08-29T00:00:00Z"}
purpose: "分析用の柔軟な期間と、申告用の厳密な暦年を同じ経路に流さない。証憑は「あることになっている」ではなく「取り出せる」を判定基準にする。"
goal: "対象年の解釈が1箇所に閉じ、書き出しの完成物はサーバー側の再判定を通過したものだけになる。"
scope_in: ["対象年の型と拒否境界", "Datasetの単一入口", "R2原本を正とする完全性判定", "分割ZIPの集合同一性", "秘密値を持たない取得先境界"]
scope_out: ["申告書の生成", "税務判断", "freee側証憑の複製", "分析用期間セレクタの変更"]
---

# 解く問題

確定申告の準備は、既存の分析機能と**同じデータの上に、違う厳密さ**を要求する。

分析では「直近12か月」「任意期間」「全期間」を自由に切り替えられることが価値になる。
申告では、対象が暦年1年からずれた瞬間に成果物が無価値になる。同じ `Dataset` の上で
2つの要求を満たすには、境界をどこに置くかを先に決める必要がある。

同様に、証憑は「D1にmetadataがある」ことと「R2から実際に取り出せる」ことが乖離しうる。
乖離を放置したまま「添付済み」と表示すると、ZIPを開いた税理士が初めて欠損に気づく。

# 決定

## D1. 対象年は型で分ける

申告経路の入口で `TaxYear`（`2000..2099` の暦年1年）へ**変換できないものは400で拒否する**。
分析用の `PeriodMeta` を申告計算へ渡す経路を作らない。

- 却下案: 分析用の期間をそのまま受け、年跨ぎなら警告を出す
  → 警告は読まれない。読まれない警告は、無い方が正直。

## D2. `Dataset` の入口は `loadScoped` だけ

`packages/api/src/routes/tax.ts` は `loadDataset` を直接呼ばない。期間の切り出しは
`routes/analytics.ts` の `loadScoped` に一本化し、この不変条件を**ソース検査のテストで機械的に固定する**
（`packages/api/src/analytics-period.test.ts`）。

- 理由: 「期間を渡し忘れた1箇所」は、レビューでは見つからず、画面でも正しく見える。
  人間の注意力ではなく、テストで止める。

## D3. 完全性の判定はR2を正とする

未添付かどうかは、D1の添付件数ではなく **exact-key の R2 HEAD** で決める。
ZIPは対象年の事業支出に紐づくR2原本だけを、**索引CSVと実ファイルが同一集合になる形**で生成する。

- 却下案: D1件数で判定し、ZIP生成時に取れなかったものは飛ばす
  → 「出たZIP＝揃っている」が成り立たなくなり、成果物の意味が消える。

## D4. 上限は切り捨てではなく分割

`RECEIPT_ZIP_MAX_FILES = 400` を1分割とし、超過時は安定した順序で複数partへ分ける。
欠損・取得失敗・不正partは無言で飛ばさず失敗させる。

- 却下案: 1つの巨大ZIP / 上限で切り捨て
  → 前者はWorkerのメモリと実行時間に載らない。後者は失敗と欠損を区別できない。

ZIPはstore方式（無圧縮）+ CRC32 + UTF-8ファイル名フラグ（bit 11）を `packages/core/src/zip.ts` で
自前生成し、`TransformStream` で逐次流す。依存を増やさず、メモリに全原本を載せない。

## D5. 書き出しの最終ゲートはサーバー側の再判定

UIのボタン無効化は利便であって保証ではない。CSV・ZIPの各ハンドラが、
**自分でもう一度**準備チェックを評価し、通過した年だけ完成物を返す。

## D6. 取得先は「秘密を持てない型」にする

`ReceiptSourceProfile` はURL（HTTP/HTTPSのみ、認証情報埋め込み不可）・サービス名・
ログインに使うアカウント名（識別子）・メモだけを持つ。
**パスワード・トークン・セッションを受け取るフィールドを型・API・DBのどこにも作らない。**

- 理由: 「入れないでください」という運用規約は破られる。入れられない形にする方が安い。

## D7. 取得先の正本は取引先単位、例外は疎に

`profile_key = merchant_key::service_key` を利用者内の参照キーとし、月ごとのコピーを作らない。
明細単位のoverrideは**明示行があるものだけ**を持つ。曖昧な候補は自動確定しない。

- 却下案: merchant部分一致で自動継承 → 誤紐付けは気づきにくく、回復もしにくい。

# 影響

- `migrations/0027_tax_account_settings.sql` / `0028_receipt_source_profiles.sql`（expand）
- `packages/api/src/schema-guard.ts` の `EXPECTED_D1_MIGRATION` 更新
- 統合JSON backup/restore に3つのキーを追加（秘密値の列は増やさない）
- 画面2枚追加により、ナビ契約が15画面→17画面・モバイル4→5タブへ

migrationは **expand として、コード配信より先に**適用する。依存順を逆転させない。

# 検証

`tasks/tax-preparation-tasks.md` の受入証拠台帳を正とする。
リリース判定は `docs/product/elegant-review-tax-preparation/T4-release-readiness.md`。
