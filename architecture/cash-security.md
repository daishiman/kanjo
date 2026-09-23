---
graph_node_id: "arch-cash-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "現金入力 — zod で候補と長さを限り、領収書ファイルと下書きをサーバーへ受け取らず、削除中の行を混ぜない不変条件を API テストで固定する"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "security"]
file_path: "architecture/cash-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7a260e661c2e48f4d802219de5c52e287612c9173f56eab3a28231ee69788688"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "7a260e661c2e48f4d802219de5c52e287612c9173f56eab3a28231ee69788688", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/cash.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/cash-lifecycle.test.ts", "packages/core/src/types.ts", "packages/web/src/pages/cash"]
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
classification_reason: "system-spec の security 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G4"]
---

# Architecture overview

現金入力 — 入力は zod で候補と長さを限る (内容 60・メモ 200・駅名 40・『その他』の業務の目的 40 字、名義と業務の目的は候補内)。領収書ファイルは受け取らず、下書きはサーバーへ送らない。削除中の行を一覧・集計・バックアップへ混ぜない不変条件と、書込経路の fence 登録を API テストで固定する。`system-spec/security.md` は承認時入力、本書は入力検証・データ保護・不変条件の制約を持つ。

## Context and drivers

- Business/technical context: 全応答に `secureHeaders` (`packages/api/src/index.ts:58`) が付き、書込は `canonicalMutationFence` (`:108`) を通る。現金明細の入力は `routes/cash.ts:90-126` の `entrySchema` (実在する日付、金額は 1〜1,000,000,000 の整数、内容 60 字、メモ 200 字、駅名 40 字、交通費の区間の refine) で検証し、不正は 400 `invalid_input`。科目は `checkCategory` (`cash.ts:146`) が候補と照合する。専用のレート制限は無く、現行の DELETE は物理削除 (qa-cash-security-web-evidence-001)。
- Quality attribute priorities: G4 に資する。Secure by Design (受け取らない・送らない・既定で絞る) を適用する (agent 推定・利用者未確認、design_applications)。上流指針は OWASP ASVS 5.0.0 (入力検証・アクセス制御)。
- Constraints: 単一利用者の運用。税務上の正本は freee で、本画面は税務判断をしない (C4)。

## Goals and non-goals

- Goals:
  - G4: 不正な入力 (実在しない日付、範囲外の金額、候補外の名義・カテゴリ・業務の目的、長すぎる文字列) が 400 になる (S4)。
  - G4: 削除中の行が一覧・合計・集計・バックアップ・スナップショット・科目使用状況のどこにも現れない (S2)。
- Non-goals:
  - 領収書ファイルの受け取り・保管 (qa-cash-decision-001、freee へ案内する)
  - 下書きのサーバー保存 (qa-cash-security-web-002)
  - 専用のレート制限

## System context and boundaries

- Users/external systems: ログイン済みの利用者のブラウザ。
- Trust/deployment/data boundaries: 信頼境界は API の入口。web の検証は補助で、正は API の zod。下書きは端末の `localStorage` に留まる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `entrySchema` (zod) | 型・範囲・長さ・候補・交通費の組合せの検証 | `zValidator` | packages/api | Worker |
| 一括の id 配列の schema | 1〜100 件の正の整数 | `zValidator` | packages/api | Worker |
| `checkCategory` | 科目が候補にあるか | 関数 | packages/api | Worker |
| `canonicalMutationFence` | 書込経路の登録 | 正規表現表 | packages/api | Worker |
| `pages/cash/draft.ts` | 入力途中の値だけを端末に保存 | `localStorage` | packages/web | Workers Assets |

## Cross-cutting contracts

- Identity/access: `architecture/cash-auth.md` に従う (他人の行は 404)。
- Errors/resilience: 検証エラーは 400 で欄ごとの文を返し、入力値を応答に反射しない。
- Observability/audit: N/A: 新しい監査信号を足さない。
- Configuration/secrets: N/A: 新しい secret は無い。
- Compatibility/versioning: `owner` と `transit_purpose` は任意で、既存の本文は通る。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/cash-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は現金明細と、その派生の取引・集計・バックアップ。脅威は 範囲外や候補外の値による集計の汚染、削除中の行が集計やバックアップに残ること、書込経路が fence から漏れること、共有端末の下書きの閲覧。

#### Input validation

`entrySchema` に `owner` (`OWNER_VALUES` = business / spouse / family、`packages/core/src/types.ts:114`、null 可) と `transit_purpose` (『客先訪問』『打ち合わせ』『仕入れ・買い出し』『研修・セミナー』と『その他』40 字、候補は qa-cash-ui-ux-web-003 の agent 推定・利用者未確認) を足す。長さは 内容 60・メモ 200・駅名 40・その他の目的 40 字 (qa-cash-security-web-002)。一括は id 配列を 1〜100 件の正の整数に限る (qa-cash-backend-web-003、agent 推定・利用者未確認)。

#### Identity and authorization

`architecture/cash-auth.md` に従う。新しい 3 経路を `CANONICAL_MUTATION_ROUTES` (`canonical-mutation-fence.ts:42-48`) に登録する。現行の正規表現は `/:id/restore` と `bulk-*` の POST に一致しない。

#### Data and secret protection

領収書ファイルを受け取る経路・列を作らない。下書きはサーバーへ送らず、キーに利用者 id を含めてログアウト時に消し、保存するのは入力途中の項目値だけ (qa-cash-security-web-003、agent 推定・利用者未確認)。削除中の行は `deleted_at IS NULL` で cash_entries を読む全経路 5 本 から外す (`architecture/cash-database.md`)。不変条件の例外は、JSON 復元の「移行先の現金明細が 0 件か」の判定に削除中を含む件数を 1 つ使うことだけで、削除中の行が残る間は現金明細を復元せず理由を表示し、削除中の行の中身はどの出力にも出さない (利用者決定 qa-cash-decision-009)。

#### Application and supply-chain controls

新しい依存を足さない。既存の `secureHeaders` の CSP のまま。

#### Detection and response

N/A: 専用の検知は足さない。完全消去の件数は夜間ログに出る (`architecture/cash-maintenance-ops.md`)。

#### Security verification

API テストで 境界値 (内容 60 字は通り 61 字は 400、メモ 200 / 201、駅名 40 / 41、その他の目的 40 / 41、金額 1,000,000,000 / 1,000,000,001、2 月 30 日は 400、候補外の名義・業務の目的は 400、一括 100 件は通り 101 件は 400) と、削除中の行が GET・集計・エクスポート・スナップショット・科目使用状況に 0 件であることを固定する。fence の表に 3 経路があることをテストで確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-security-web-002 | zod で候補と長さを限り、不変条件を API テストで固定する | web 側の検証だけ | API が信頼境界で、画面を経ない呼び出しも止まる | 候補を変えると schema とテストを同時に直す |
| qa-cash-decision-001 | 領収書ファイルを受け取らない | 添付を受けて R2 に保存 | 攻撃面 (ファイル検査・容量) を作らず、保管は freee に一本化 | 画面は案内文だけ |
| qa-cash-security-web-002 | 下書きはサーバーへ送らない | サーバー保存 | 入力途中の値を外へ出さない | 端末をまたいで引き継がない |
| qa-cash-security-web-003 | 下書きのキーに利用者 id、ログアウトで消す (agent 推定・利用者未確認) | 共通キーのまま | 共有端末での閲覧を防ぐ | ログアウト処理を足す |
| qa-cash-decision-006 | 新しい 3 経路を fence に登録する | 登録しない | 既存の書込と同じ整合の守りに載る | fence の表が 3 行増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker デプロイ。
- Migration sequence: schema に owner / transit_purpose → 一括の schema → fence 登録 → 境界値と不変条件の API テスト。
- Rollback trigger/procedure: 境界値か不変条件の API テストが赤なら差し戻す。

## Risks and verification

- Risk/assumption: 業務の目的の候補は agent 推定・利用者未確認で、利用者の確認で変わる。候補は core の定数 1 か所に置き、schema と画面が同じ定数を読む。
- Risk/assumption: 専用のレート制限は無い。単一利用者の運用 (C3) を前提に許容する。
- Architecture fitness test: fence の表に `cash-entries` の書込 6 経路 (POST / PUT / DELETE / restore / bulk-delete / bulk-restore) が全てあること。
- Load/failure/security validation: 範囲外・候補外の入力が DB に届かず 400 になることを API テストで確かめる。
