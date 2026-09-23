---
graph_node_id: "arch-import-screen-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "データ取込 — 合計・ファイル単位・展開前の 3 段で大きさを止め、レート制限と同一オリジンの検査を入口に置く"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "security"]
file_path: "architecture/import-screen-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7d2806984e761ff45eddfa2cae491f0c9c4338f30709d2cc955ec21f33d0cd8f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "7d2806984e761ff45eddfa2cae491f0c9c4338f30709d2cc955ec21f33d0cd8f", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-frontend", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-auth", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/imports.ts", "packages/api/src/import-pipeline.ts", "packages/api/src/login-rate-limit.ts", "packages/core/src/csv.ts", "scripts/hooks/guard-real-data.sh"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:53:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6"]
---

# Architecture overview

データ取込 — 合計・ファイル単位・展開前の 3 段で大きさを止め、レート制限と同一オリジンの検査を入口に置く。`system-spec/security.md` は承認時入力、本書は入力の上限・判定の順序・入口の制御の制約を持つ。規則の正本は `specs/spec-import-screen.md` (spec-import-screen) のビジネスルールと検証の節とエラー・例外・回復の節。

## Context and drivers

- Business/technical context: 作り直し前は `POST /imports` に本文先読みの上限、取込用レート制限、Origin 検査が無かった (qa-imp-security-web-evidence-001)。現行は `/api/imports*` の変更要求を Origin で検査し、新しい検査・確定・置換経路に本文上限と利用者単位のレート制限を掛ける。互換 `POST /imports` にも本文・ファイル数・合計サイズの上限、Origin 検査、新経路と同じ利用者単位の確定 5 回/分制限を掛ける。
- Quality attribute priorities: G1〜G6 に資する。OWASP ASVS 5.0 V5 の 5.2.1 (処理できる大きさだけを受ける) と 5.2.3 (圧縮ファイルは展開前に展開後の最大サイズと最大ファイル数を検査する) を、上限と判定の順序へ適用する。
- Constraints: Worker 1 isolate のメモリは 128MB。上限値は core の `IMPORT_LIMITS` (新設) の 1 か所に置き、api の判定 (hono/body-limit の maxSize を含む) はそれを import する。

## Goals and non-goals

- Goals:
  - G6: 合計 30MB を本文を読む前に 413 で止める。ファイル数 (検査 ID の累計で 10) と 1 ファイル 25MB を本文を読んだ直後・パースの前に 413 で止める (qa-imp-decision-011)。
  - G6: xlsx と ZIP は展開する前に中央ディレクトリのエントリ数と展開後サイズの合計を確かめ、エントリ数 1,000 件か展開後 1 ファイル 15MB を超えるものは展開せずに取込不可にする (qa-imp-decision-009・ASVS 5.2.3)。
  - G6: レート制限を利用者ごとに検査 30 回/分 (ファイル追加の要求も検査に数える)・確定 5 回/分とし、超過は 429 `rate_limited` と Retry-After (qa-imp-decision-006・-008)。
  - G6: `/api/imports*` の変更要求 (POST / DELETE) は Origin ヘッダーが自サイトと一致しなければ 403 `forbidden_origin`。
- Non-goals:
  - 取り込んだデータの外部送信 (一切しない)
  - ウイルス走査などの外部サービス
  - 宣言した Content-Length と実際の長さのずれの独自検査 (下記の設計判断を参照)

## System context and boundaries

- Users/external systems: ログイン済みの利用者のブラウザ。外部送信の先は無い。
- Trust/deployment/data boundaries: 外部入力は明細ファイル (CSV・Excel・txt・ZIP・JSON)。本文の読み込み → ファイル単位の判定 → 展開前の判定 → パースの順に、各段の手前で止める。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| hono/body-limit (検査・追加の経路) | 合計 30MB を本文を読む前に止める | Hono middleware (maxSize は core から) | packages/api | Worker |
| 確定・一括削除の本文上限 | 小さい本文だけを受ける | Hono middleware | packages/api | Worker |
| ファイル単位の判定 | 検査 ID の累計 10 ファイル・1 ファイル 25MB・累計 30MB | core の判定関数 | packages/core | Worker |
| 展開前の判定 | エントリ数 1,000 件・展開後 1 ファイル 15MB | route 内 (上限値は core から) | packages/api | Worker |
| 取込のレート制限 (新設) | 検査 30 回/分・確定 5 回/分 | D1 の計数 | packages/api | Worker |
| Origin の検査 (新設) | 変更要求の同一オリジン | Hono middleware | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: セッションと所有者の判定は `architecture/import-screen-auth.md`。
- Errors/resilience: 413 `payload_too_large`・429 `rate_limited` と Retry-After・403 `forbidden_origin`。応答に内部の値やスタックを含めない。
- Observability/audit: N/A: 新しい信号を足さない。
- Configuration/secrets: 追加の秘密情報を持たない。上限値は環境変数ではなく core の定数。
- Compatibility/versioning: 既存の `/api/auth/*` の 16KB の上限は変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/import-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/import-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/import-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/import-screen-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は Worker の可用性 (メモリ 128MB・CPU 時間)、仮置きの原本、取込済みの明細。脅威は、巨大な本文や展開爆弾によるメモリ枯渇、短時間の連続要求、別オリジンからの変更要求、ファイル名や明細の文字列に仕込んだ HTML。

#### Input validation

拡張子は CSV・Excel・txt と既存の ZIP・JSON の許可リスト。大きさは 3 段で止める。合計 30MB は hono/body-limit で本文を読む前 (Content-Length があればその値、無ければ本文をストリームで数えて上限で止める)、ファイル数と 1 ファイル 25MB は本文を読んだ直後・パースの前 (ファイル追加では検査 ID の累計で)、エントリ数 1,000 件と展開後 1 ファイル 15MB は展開の前。サーバは同時に展開するファイルを 1 つに限る。

#### Identity and authorization

レート制限は利用者 ID ごとに数える。所有者の判定と 404 の統一は `architecture/import-screen-auth.md` に従う。

#### Data and secret protection

取り込んだデータは外部へ送らない。仮置きの原本は本人だけが確定・取得でき、24 時間で消える。一括削除は記録だけで明細は消さない。

#### Application and supply-chain controls

ファイル名は制御文字を除き 255 文字で切り、ファイル名・取込元・エラー文などファイル由来の文字列は React のエスケープで描いて HTML として解釈しない (`dangerouslySetInnerHTML` を使わない)。新しい依存を足す場合は既存の依存審査に従う。

#### Detection and response

N/A: 新しい検知の仕組みを足さない。429 と 413 は応答で利用者に理由を返し、運用の監視は既存の Workers のログに従う。

#### Security verification

API テストで、上限を超える合計が本文を読む前に 413、ファイル数と 1 ファイルの大きさの超過がパースより前に 413、展開前の 1,000 / 1,001 件と 15MB / 15MB+1 byte、検査 30 / 31 回目・確定 5 / 6 回目が 429 と Retry-After、別オリジンの変更要求が 403、ファイル名に含めた HTML がテキストとして描かれることを確かめる (O6)。境界の一覧は `architecture/import-screen-maintenance-ops.md`。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-011 | 合計は本文を読む前、ファイル数と 1 ファイルは読んだ直後・パースの前に 413 | すべて読んだ後に判定 (現行) | 巨大な本文をメモリに載せない | 判定の段が 2 つに分かれる |
| qa-imp-decision-007 / OI-03 | 合計 30MB・展開後 15MB・同時展開 1 ファイル | 合計と展開後をより大きくする | Worker 128MB の中に収める (展開後 15MB が実測の限界。当初の 60MB から OI-03 の A案で引き下げ) | 展開後 15MB 超の xlsx は分けて送る |
| qa-imp-decision-009 | エントリ数 1,000 件を展開前に数える | 10,000 件・100 件 | 展開爆弾を防ぎ、通常の xlsx と MF の ZIP は通る | 1,000 件超の正当な ZIP は取込不可 |
| qa-imp-decision-006 | 検査 30 回/分・確定 5 回/分、ログイン用と別に数える | レート制限なし (現行) | 連続要求で Worker と D1 を占有させない | 計数の表が要る |
| qa-imp-security-web-004 | 変更要求に Origin の検査を足す (agent 推定) | SameSite=Strict だけ (現行) | Cookie の属性に加えて境界で拒否できる | 同一オリジンの判定を 1 か所に置く |
| qa-imp-security-web-004 | 宣言した Content-Length と実長のずれは Workers ランタイムに任せ、独自に検査しない (agent 推定) | 独自に数え直す | 判定の段を増やさない | hono.dev と Cloudflare の公式に裏付けの記述が無く、出典の無い設計判断である |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。Hono の組み込み middleware を使う。
- Migration sequence: core の `IMPORT_LIMITS` → 検査・追加の経路の body-limit → ファイル単位と展開前の判定 → レート制限 (`import_rate_limits`) → Origin の検査 → 確定・一括削除の本文上限。
- Rollback trigger/procedure: 境界テストが落ちたら Worker を戻す。

## Risks and verification

- Risk/assumption: 宣言した Content-Length と実長のずれの扱いは出典の無い設計判断で、評価で low として申し送られている。ずれた要求で上限を越えて読まないことを実測するテストを maintenance-ops に足すかを実装計画で決める。
- Architecture fitness test: api の取込の経路に上限の数値リテラルが無く、maxSize が core の `IMPORT_LIMITS` から来ていること。
- Load/failure/security validation: 展開後 15MB 近くの xlsx をパースしたときのメモリの膨張を実測した (`docs/import-screen/design-decisions.md` §8)。heap の増分は展開後サイズにほぼ比例し、128MB に収まるのは展開後およそ 15MB まで。OI-03 の A案で展開後の上限を 15MB に下げて決着した。
