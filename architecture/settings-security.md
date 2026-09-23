---
graph_node_id: "arch-settings-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "設定 — 公開向け検証と本文上限・復元は厳密検証で全か無か・取引は消さない・外部送信なし"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "security"]
file_path: "architecture/settings-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c0d64d31afc54115c07bc73eaa3884d65f3a33205d92327fda0e583c56edb163"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "c0d64d31afc54115c07bc73eaa3884d65f3a33205d92327fda0e583c56edb163", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-auth"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/public-validation.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/core/src/exports.ts", "packages/core/src", "packages/web/src/pages/settings/", "packages/web/public/_headers", "scripts/hooks/guard-real-data.sh"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

設定 — 公開向け検証と本文上限・復元は厳密検証で全か無か・取引は消さない・外部送信なし。`system-spec/security.md` は承認時入力、本書は入力検証・本文上限・設定 JSON の復元とバックアップからの復元の検証・CSV 出力の無害化・外部送信の禁止の制約を持つ。確定内容の正本は qa-settings-security-web-003 と決定 qa-settings-decision-006・010。認証と書込みフェンスの登録の区分は `architecture/settings-auth.md`。

## Context and drivers

- Business/technical context: CSRF 専用のミドルウェアは無く、SameSite=Strict の Cookie・fetch の `Content-Type: application/json` 固定・`index.ts` の `secureHeaders` の CSP (`form-action 'self'`・`frame-ancestors 'none'`) に頼る。`bodyLimit` は `/api/auth/*`・balances・ai にだけある。`publicJsonValidator` (`packages/api/src/public-validation.ts`) は zod の詳細を外に出さない。エラー応答は `{error:{code,message}}` で、`onError` は requestId を付け明細内容をログに出さない。既存の `POST /api/restore` は本文の形を見るだけで上限が無い。画面のフッタに『取込データは外部送信しません』とある (qa-settings-security-web-evidence-001)。CSV は core の `toCsv` (`packages/core/src/exports.ts`) が `"`・`,`・改行を含むセルを引用符で囲むだけで、セル先頭の式文字は無害化していない (本書作成時の読解)。
- Quality attribute priorities: G4・G5 に資する。OWASP ASVS 5.0 (V1.2.10 CSV の式注入・V2 入力検証) を適用し、復元 JSON の厳密な検証 (未知キー拒否・件数と長さの上限・全か無か) と本文上限 413、CSV 出力の RFC 4180 のエスケープとセル先頭の式文字の無害化へ反映する (https://github.com/OWASP/ASVS/blob/master/5.0/en/0x10-V1-Encoding-and-Sanitization.md)。
- Constraints: 設定系の変更 API は `publicJsonValidator` と本文サイズ上限を掛ける (C4)。外部送信は 0 件 (G5)。CSP を緩めない。取引データの復元形式 (HTML 版からの初期移行) は変えない (U7 対象外)。

## Goals and non-goals

- Goals:
  - G5: 設定系の新 API は公開向けの入力検証で詳細を外に出さず、本文サイズ上限を掛け、超過は 413 にする (qa-settings-security-web-003、O5)。
  - G4: 設定の復元は同じ形の版番号つき JSON だけを受け、厳密に形を検証し、サイズ上限を掛け、差分プレビューと確認を経て、復元直前に現在の設定を退避する。不正な JSON は何も変えずに拒否する (qa-settings-decision-006、S4)。
  - G4: バックアップからの復元も同じ検証を通し、設定 (集計ルール・名義・統計・現金上書き) だけを戻して取引は消さない (qa-settings-decision-010)。
  - G5: 設定・取引・バックアップを外部へ送らない。
- Non-goals:
  - 外部 LLM・外部 API・外部ストレージへの送信
  - CSP・`_headers`・`secureHeaders` の緩和、CSRF トークンの新設
  - 取引を含む全データの復元の形式変更 (既存 `POST /api/restore` はそのまま)
  - 設定 JSON の暗号化・署名

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部サービスは呼ばない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。本文・クエリ・利用者が選んだ設定 JSON のファイル・R2 のバックアップ本文は、検証を通るまで信頼しない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `bodyLimit` (設定系の経路) | 画面の保存と復元の本文を上限で止め 413 を返す | Hono ミドルウェア | packages/api | Worker |
| `publicJsonValidator` + zod | 本文の形だけを見て、違反の詳細を外へ出さない | Hono validator | packages/api | Worker |
| core の設定の検証と差分 | 値の規則 (名義・統計の範囲・現金上書き・集計ルール) と設定 JSON の版・形・差分の正本 | 純関数 | packages/core | Worker |
| 設定の復元 (JSON / バックアップ) | 検証 → 差分プレビュー → 確認 → 退避 → 全か無かの置換 | Hono route | packages/api | Worker |
| `toCsv` | CSV の RFC 4180 のエスケープとセル先頭の式文字の無害化 | 純関数 | packages/core | Worker |
| `canonicalMutationFence` | 書込み 3 種を取込の洗替えと直列化する (`architecture/settings-auth.md`) | Hono ミドルウェア | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: `architecture/settings-auth.md` に従う。
- Errors/resilience: 検証違反・版違い・件数超過は 4xx で、何も変えない。本文上限の超過は 413。フェンスの競合は 409。エラー応答とログに設定値・SQL・スタックを含めない (agent 推定・利用者未確認、根拠 qa-settings-security-web-004)。
- Observability/audit: 設定の変更は変更履歴に残る (`architecture/settings-database.md`)。セキュリティの監査信号は追加しない。
- Configuration/secrets: 新しい秘密情報を持たない。バックアップ・変更履歴・設定 JSON に秘密情報を入れない (agent 推定・利用者未確認、根拠 qa-settings-security-web-004)。
- Compatibility/versioning: 設定 JSON は版番号を持ち、版違いは拒否する。古い版の受け方は `architecture/settings-maintenance-ops.md` に従う。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/settings-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/settings-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 設定 (集計ルール・名義の表示名・統計の最小月数・現金上書きとメモ)、変更履歴、取引データ (復元で消えてはならない)、夜間バックアップ (取引を含む全データ)。
- Actors/adversaries/abuse cases: 巨大な本文や大量の行で Worker と D1 を疲弊させる。形の違う・未知キー入りの・版違いの JSON を復元させて設定を壊す、途中まで書かせて半端な状態を残す。取引先名・メモに HTML や式 (`=HYPERLINK(...)` など) を入れ、画面や表計算で実行させる。バックアップからの復元で取引まで巻き戻す。
- Trust boundaries/data flows: ブラウザ → `bodyLimit` → validator → core の検証 → D1 (保存・復元)。R2 のバックアップ → 設定部分の取り出し → 同じ検証 → D1。D1 → core → CSV・JSON・HTML の出力。外部への流れは無い。

#### Identity and authorization

- Authentication/session/federation: `architecture/settings-auth.md` に従う。CSRF は SameSite=Strict と JSON 固定と CSP の既存の組合せに頼る。
- Authorization model and deny-by-default rules: 書込み 3 種はフェンスに登録し、登録の無い書込みを作らない (`architecture/settings-auth.md`)。
- Tenant/resource ownership enforcement: 全ての読み書きに利用者の条件を付ける。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: 既存の HTTPS・D1・R2 に従う。
- Secret source/rotation/redaction: エラー応答とログに設定値を出さない。設定 JSON の書き出しは取引を含めない最小の形にする (qa-settings-decision-006)。
- Retention/deletion/privacy requests: 復元直前の退避はバックアップと同じ保持 30 日で消す (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004)。保持 30 日そのものは据え置く (C5)。

#### Application and supply-chain controls

- Input/output validation and injection defenses: 本文上限は画面の保存 64KB・復元 256KB、集計ルールは 500 行まで (agent 推定・利用者未確認、根拠 qa-settings-security-web-002)。未知のキーは拒否し、値の規則は core を正本にして zod は形だけを見る (agent 推定・利用者未確認、根拠 qa-settings-security-web-004)。復元は検証を全件通ってから 1 回の D1 batch で置換し、1 つでも不正なら全体を捨てる。取引先名・メモは React の既定のエスケープで描画し `dangerouslySetInnerHTML` を使わない。CSV はセル先頭の `=` `+` `-` `@` を無害化する (対象文字は agent 推定・利用者未確認、根拠 qa-settings-security-web-004)。SQL は Drizzle のバインドで組む。
- 変更系のフェンス登録: 全節の保存・設定の復元・バックアップからの設定の復元の 3 種を登録し、読むだけの API は登録しない (qa-settings-auth-web-003)。
- Dependency/artifact provenance/signing/SBOM: 新しい依存を足さない。
- CI/CD branch/review/environment protections: 既存の CI とレビューに従う。実データはテストに持ち込まない (`scripts/hooks/guard-real-data.sh`)。

#### Detection and response

- Audit events/security telemetry/alerts: 設定の変更は変更履歴に、復元は更新者『システム』の行として残る。新しい監査信号は追加しない。
- Incident response/revocation/recovery: 誤った復元は復元直前の退避から戻す。設定の誤りは D1 全体を上書きせずに設定 JSON の復元か『元に戻す』で直す (`architecture/settings-maintenance-ops.md`)。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

悪用ケースの API 統合テストで、形の違う JSON・未知キー入り・版違い・件数超過・本文上限超過がそれぞれ 4xx (上限超過は 413) になり、設定の表・変更履歴・取引件数・R2 の退避が 1 つも変わらないことを確かめる。正しい JSON の復元で設定が一致し取引件数は不変、退避が 1 件増えることを確かめる。バックアップからの復元で取引が変わらないことを確かめる。エラー応答に zod の詳細・設定値が出ないこと、CSV のセル先頭の式文字が無害化されること、外部への `fetch` が 0 件であることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-security-web-003 | 設定系の新 API に `publicJsonValidator` と本文上限を掛け、超過は 413 | 既存の設定の経路と同じく上限なし | 巨大な本文を読む前に止め、詳細を外へ出さない | 上限を超える正当な設定は保存できない |
| qa-settings-decision-006 | 設定の復元は版番号つきの同じ形だけを受け、検証・プレビュー・確認・退避を経て全か無かで置換 | 既存 `/restore` の形の検査だけに倣う | 不正な JSON で何も変わらない | 復元の手順が 2 往復 (プレビューと本番) になる |
| qa-settings-decision-010 | バックアップからの復元は設定だけを戻し、同じ検証を通す | 取引を含む全データを戻す | G4『取引は消えない』と一致する | 取引の巻き戻しは既存の初期移行か D1 Time Travel に残る |
| qa-settings-security-web-002 | 本文上限 64KB / 256KB・集計ルール 500 行 (agent 推定・利用者未確認) | 上限を置かない / 1MB | 1 回の D1 batch と Worker の CPU 時間に収まる | 実データの件数で実装時に確かめる |
| qa-settings-security-web-004 | 値の規則は core が正本、zod は形だけ・未知キー拒否 (agent 推定・利用者未確認) | zod に値の規則も書く | 画面・API・復元で同じ規則を使える | core の検証を API の前段で必ず呼ぶ |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono)。CSP と `_headers` は変えない。
- Migration sequence: core の設定 JSON の検証と差分 → `toCsv` の式文字の無害化 → 設定系の経路に `bodyLimit` と validator → 復元の経路 → 悪用ケースの API 統合テスト。
- Rollback trigger/procedure: 悪用ケースのテストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。

## Risks and verification

- Risk/assumption: `toCsv` の式文字の無害化は既存のマトリクス CSV・取引 CSV の出力も変える。先頭が `-` の負の数値は数値のまま出す必要があるため、文字列のセルだけを対象にするかを実装時に確かめる。
- Risk/assumption: 集計ルール 500 行の上限は実データの件数を見ていない。上限を下回ることを実装時に確かめる。
- Risk/assumption: バックアップ本文は取引を含む全データなので、設定部分を取り出す前に全体を読む。256KB の上限は復元の本文に掛け、R2 から読む本文には掛けない。
- Architecture fitness test: 設定系の新 API のすべてに `bodyLimit` と validator が掛かっていること。復元の経路が 1 回の `db.batch` だけで書くこと。
- Load/failure/security validation: 不正な復元で何も変わらないこと。外部送信が 0 件であること。
