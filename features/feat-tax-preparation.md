---
graph_node_id: "feat-tax-preparation"
artifact_kind: "feature"
artifact_subtypes: []
title: "確定申告の準備と証憑の取得先"
project_id: "kanjo"
domain: "accounting-records"
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
related_nodes: ["arch-tax-preparation-boundary", "spec-tax-preparation", "tasks-tax-preparation", "spec-attachments-transit"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-tax-preparation.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "manual-review", "evidence_ref": "docs/product/elegant-review-tax-preparation/T4-release-readiness.md", "evaluated_digest": null}
source_lineage: {"origin_kind": "manual", "source_plugin": null, "source_path": "docs/spec-v1.1.md", "source_version": "1.1", "source_digest": null, "imported_at": "2026-08-29T00:00:00Z"}
classification_confidence: 1.0
classification_reason: "2画面・7API・2migrationを束ねる利用者向け機能単位であるため feature 層。"
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
purpose: "年に一度の確定申告の準備が毎年ゼロからのやり直しになっていた。対象年・科目方針・按分根拠・証憑の在り処を帳簿側に残し、翌年も同じ条件を再現できる状態にする。"
goal: "暦年1年を選ぶと準備チェック・転記シート・科目設定・証憑要約が同じ年で揃い、要対応を消したときだけ転記補助CSVと控えZIPが完成物として出る。"
scope_in: ["暦年1年の対象年境界", "年別の科目割り当てと家事按分", "準備チェックと次の行動", "R2原本を正とする証憑棚卸し", "未添付の緊急度と絞り込み", "転記シートCSV・科目別経費内訳CSV", "分割対応の証憑ZIPと索引", "取引先単位の証憑取得先と継承", "backup/restoreへの接続"]
scope_out: ["申告書・e-Tax送信データの生成", "税務上の適法性・控除可否の保証", "減価償却・棚卸・青色申告特別控除・所得控除の計算", "freee内証憑原本の複製", "パスワード・認証トークンの保存"]
acceptance: ["分析用の全期間・任意期間・年跨ぎが申告APIで400になり、画面の年表示とデータ範囲が一致する", "科目方針が行の不在だけで未確認となり、全額事業でも100%が明示保存される", "按分100%未満で根拠が空なら保存できない", "割り当てのない科目が雑費へ寄らず準備チェックの先頭に金額つきで出る", "収入科目・事業主貸が経費計に入らず、専従者給与が経費計と分かれる", "D1 metadataがあってもR2原本が無い明細は添付済みにならない", "要対応が残る年ではCSV・ZIPが完成物として返らない", "400件超の年でも全partが出て、各partの索引と実ファイルが同一集合になる", "非HTTP(S)・認証情報付きURLが拒否され、他利用者のprofileを参照・更新できない", "backup/restoreで年別方針・取得先profile・明細overrideが復元され、秘密値の列が増えていない"]
architecture_refs: ["arch-tax-preparation-boundary"]
---

# 目的

このシステムは1年を通して帳簿を作っているのに、確定申告の時期になると、その帳簿は
「金額の合計が分かる表」でしかなかった。決算書のどの欄へ入れるか、家事按分を何割にしたか、
その根拠は何か、領収書はどこにあるか — 判断はすべて利用者の頭の中にあり、翌年には残らない。

結果として、毎年同じ作業をゼロからやり直す。しかも、去年と同じ判断をした保証が無い。

# 到達状態

「確定申告の準備」で暦年1年を選ぶと、その年だけの準備チェック・転記シート・科目設定・
証憑要約が1回の取得で揃う。要対応（未割当の科目・根拠のない按分・取り出せない証憑）が
残っている間は書き出せず、押せない理由が文字で出る。

要対応を消すと、青色申告決算書へ書き写せる転記シートCSVと、
索引つきの控えZIPが完成物として出る。翌年は同じ科目方針が既に入っている。

証憑の取得先（URL・サービス名・ログインに使うアカウント名・メモ）は取引先単位に1つ持ち、
翌月以降へ既定で引き継がれる。パスワードと認証トークンは、どこにも保存しない。

# スコープ

- スコープ内: `scope_in` のとおり。既存の証憑添付（`spec-attachments-transit`）の上に、
  年次の棚卸し・優先順位・まとめ書き出しを載せる。
- スコープ外: `scope_out` のとおり。**申告書そのものは作らない。**
  この機能は転記の補助であり、税務上の適法性を保証しない。

# 受入

`acceptance` の10件。証拠の対応は `tasks/tax-preparation-tasks.md` の受入証拠台帳を正とする。

# アーキテクチャ参照

- `architecture_refs`: `arch-tax-preparation-boundary`
- 詳細仕様: `specs/tax-preparation.md`
- 製品正本: `docs/spec-v1.1.md` FR-11 / P16 / P17
- 永続形状: `docs/data-schema.md`（migration 0027 / 0028）

# 機能間依存

- `depends_on`: (なし)
- 既存の `spec-attachments-transit`（証憑原本のlifecycle・quota・cleanup）の上に構築するが、
  そちらの完了を待つ関係ではなく、既に稼働している基盤を使う関係にある。

# 残条件（本番反映）

`docs/product/elegant-review-tax-preparation/T4-release-readiness.md` を正とする。
ローカルは Go、本番は次の3件が未充足のため No-Go。

1. D1 migration 0027 / 0028 を、コード配信より**先に**手動Migrateワークフロー（`APPLY` 入力）で適用する
2. 依頼者が preview で主要ジャーニーを確認する
3. 本番相当で LCP / INP / CLS、3G、200%拡大を実測する
