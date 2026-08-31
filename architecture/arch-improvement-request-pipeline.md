---
graph_node_id: "arch-improvement-request-pipeline"
artifact_kind: "architecture"
artifact_subtypes: ["frontend", "backend", "data", "security", "infrastructure"]
title: "改善要望の収集・受け渡し・失効の境界"
project_id: "kanjo"
domain: "improvement-feedback"
status: "draft"
owners: []
tags: ["improvement-request", "screenshot", "diagnostics", "agent-handoff", "retention"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T00:00:00Z"
updated_at: "2026-08-30T00:00:00Z"
depends_on: []
related_nodes: []
resource_scope: ["packages/web/src", "packages/api/src", "packages/core/src", "migrations"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-improvement-request-pipeline.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness/assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/spec-state.json", "evaluated_digest": "ddf9d13227fd61d9c67241acdb03fc62595ddb7dd848ab229ae949cb5bbff1ee"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/index.md", "source_version": "0.1.11", "source_digest": "ddf9d13227fd61d9c67241acdb03fc62595ddb7dd848ab229ae949cb5bbff1ee", "imported_at": "2026-08-30T00:00:00Z"}
classification_confidence: 0.97
classification_reason: "画面・API・D1・R2・定期実行をまたぐ境界と契約の宣言であり、単一機能の実装手順ではないため architecture 層。frontend/backend/data/security/infrastructure の5 subtype を横断する。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": ["system-spec/index.md"]}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-08-30T00:00:00Z"}
purpose: null
goal: null
acceptance: []
architecture_refs: []
scope_in: []
scope_out: []
---

# 位置づけ

`system-spec/index.md` と `system-spec/00-requirements-definition.md` で確定した改善要望まわりの
決定 (D5 / D6 / D7 / D8 / D9) を、実装が従うべき**境界と契約**として1枚に写したもの。
仕様本文はここに複製せず、`source_lineage` の参照で解決する。

# 4つの層と、それぞれの不変条件

## 1. 撮影層 (frontend)

改善要望ボタンの押下から、モーダルが開くまでの順序を**制御構造で**固定する。

- `capture()` の Promise を await し終えてから `open = true` にする。
  「モーダル要素を除外リストに入れる」方式は採らない。除外規則の網羅性に依存すると、
  将来モーダル外に描画される要素 (トースト・ポータル) が写り込む余地が残るため。
- 撮影中はボタンを押下不可にし、待機していることを画面に出す。
- **撮影の失敗は投稿の失敗ではない。** 撮影に失敗してもモーダルは開き、
  スクリーンショットなしの本文だけで投稿が成立する。
- 送信前に縮小プレビューを見せ、添付を外せる。
- 起動導線は画面右下の固定位置に置き、`data-capture-hide` で撮影対象から外す。
  除外リストを使うのは**この要素だけ**で、モーダルの除外は引き続き順序で保証する。
  自分自身は写せないが、それ以外を網羅性に頼らないという境界を保つ。
- SVG `<foreignObject>` は `<img>` 経由で t=0 にラスタライズされ、アニメーションが進まない。
  よって**全アニメーション/トランジションを止める規則を、複製したページ CSS より後ろへ置く**。
  順序が逆だと `.main { animation: page-in ... both }` の開始状態 (opacity: 0) が残り、
  本文が透明のまま焼き付く。この順序は詳細度では代替できないため、テストで固定する。

### 1.1 書き込み層 (frontend)

撮影した画像へ利用者が枠を書き込める。座標は**画像サイズに依らない 0..1 の比率**で持ち、
プレビュー描画と送信直前の焼き込みで**同一の描画関数**を使う。
別々に実装すると「見えていた枠」と「送られた枠」が食い違い、証跡としての意味を失う。
焼き込みに失敗した場合は撮影した画像をそのまま送る (投稿を止めない、撮影層と同じ原則)。

## 2. 診断層 (frontend → backend)

エラーは改善要望ボタンを押す**前**に起きている。したがって収集はモーダル open 時ではなく、
アプリ起動時から始まっていなければならない。

- 上限つきリングバッファへ常時記録する。記録対象は
  未捕捉例外 / unhandledrejection / console error・warn / 失敗した通信。
- 上限は**件数と総バイトの二重**で課す。片方だけでは、1件が巨大なケースと
  小さい大量のケースのどちらかが漏れる。
- 秘匿値のマスクは**収集時とサーバー受信時の二重**で行う。
  クライアント側マスクを信用しない (改竄可能な経路であるため)。
- 切り詰めが起きたときは省略件数を残し、画面にも出す。黙って捨てない。
- 送信前に、環境 (画面・表示サイズ・取得時刻・ブラウザ) と記録の中身そのものを画面で読める。
  出すのは二重マスクを通った値だけであり、露出面は増えない。
- **「先に見るべき記録」の順位付けは `packages/core` が正本**とする (`highlightDiagnostics`)。
  モーダルと指示文が同じ関数の結果を並べるため、送る人と直す人が同じ数件を見る。
  順位は種類の重さ (例外 > 通信失敗 > エラー > 警告)、同点なら新しい方。
  同一内容は1件へ畳んで発生回数を添える。

## 3. 受け渡し層 (api / security)

既存 AI 分析 (`packages/api/src/ai/*`, `packages/web/src/pages/Ai.tsx`) と**同型**にする。
新方式を作らない。

| 用途 | 認証 | 備考 |
|---|---|---|
| 画面からの投稿・一覧・詳細・状態更新 | Cookie (`kanjo_session`) | 既存 `authGuard` |
| エージェントからの成果物取得 | 使い捨て Bearer | 既存 `agentGuard` と同型 |

- トークンは prefix つき・**SHA-256 ハッシュのみ保存**・TTL 24h・取得回数上限。
- R2 に対する公開 URL・署名付き URL は**一切発行しない**。配信は Worker 経由に限定する。
  署名 URL は漏えい時に期限内無制限で再利用でき、個別失効もできないため、
  指示文という「コピーされて出回る文字列」に載せる前提と適合しない。
- トークン値そのものをログへ出力しない。
- 期限切れと取得回数超過は**区別した拒否理由**を返す。汎用 500 へ丸めない。

## 4. 失効層 (data / infrastructure)

- 対応完了 (`status = done`) から**30日**で、スクリーンショットと診断情報**のみ**を削除する。
  本文・状態・対応記録は残す。
- 削除は**新規 Cron を増やさず**、既存 `scheduledMaintenance` (JST 03:00) へ相乗りする。
- 改善要望のテーブルを `packages/api/src/store.ts` の `BACKUP_SNAPSHOT_SQL` の
  列挙対象へ**追加しない**。これは禁止事項であり、テストで固定する。
  追加すると、30日削除が複製側で最大30日ぶん骨抜きになる。
- 詳細取得時にも期限判定を行い、削除ジョブが失敗していた場合の縮退経路とする。
- R2 オブジェクトだけが残る孤児化に備え、既存 `runAttachmentMaintenance` と同様の突合を行う。

# 既知の前提 (実装が踏んではいけない地雷)

本番 D1 の `d1_migrations` は事故観測時点で `0005_sub_vendors.sql` までしか記録しておらず、
`BACKUP_SNAPSHOT_SQL` が参照する `restored_monthly_agg` (0007) / `tax_account_settings` (0027) /
`receipt_source_profiles` (0028) が存在しない。このため**夜間バックアップは本番で毎晩失敗している**
(`system-spec/spec-state.json` の qa-019)。

したがって本機能の migration は、スキーマ整合が回復するまで本番へ配信できない。
`feat-prod-d1-schema-recovery` 系の作業が先行する。ローカル・テストでの完成は妨げない。

# 出典

- `system-spec/index.md` (digest `ddf9d132…`)
- `system-spec/00-requirements-definition.md` (digest `a71a6293…`)
- `system-spec/spec-state.json` の qa-003 / qa-007 / qa-010 / qa-014 / qa-016 / qa-017 / qa-018 / qa-019
- 決定 D5 / D6 / D7 / D8 / D9 (いずれも `status: confirmed`)
