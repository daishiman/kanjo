---
graph_node_id: "arch-ai-analysis-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "AI分析 — 固定 4 MiB の request budget で過大転送を止め、集計値だけを外へ出す"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "security"]
file_path: "architecture/ai-analysis-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6e7dc06215bf9291e2653fd3930fe48a61204bfcecf98294b49ae9bc12ddc8f9"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "8f446762dac8ac8a6d4309890f85c19832143ab42e22e3bc11914f39c88a8831", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/ai.ts", "packages/api/src/ai/contract.ts", "packages/api/src/ai/catalog.ts", "packages/api/src/ai/dataset.ts", "scripts/hooks/guard-real-data.sh"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

AI分析 — 固定 4 MiB の request budget で過大転送を止め、集計値だけを外へ出す。`system-spec/security.md` は承認時入力、本書は入力の大きさ・契約検証・出力の無害化・外部送信の制約を持つ。規則の正本は spec-ai-analysis-screen の入力の上限の節と持ち出し範囲の節。

## Context and drivers

- Business/technical context: `bodyLimit` は `/api/auth/*` にだけ 16KB で掛かっており (`packages/api/src/index.ts` の `bodyLimit` 登録)、エージェント経路の `POST /ai/tasks/:id/report` と利用者経路の `POST /ai/tasks/:id/paste` には body の上限が無い。レポート本文は `reportInputSchema` (`packages/api/src/ai/contract.ts`) の zod で検証し、`sanitizeText` で文字列を整える。lint の `security:content` (`scripts/hooks/guard-real-data.sh --scan-public-docs`) が公開文書への実データ混入を検査している (qa-ai-security-web-evidence-001)。
- Quality attribute priorities: G4・G5 に資する。Secure by Design の『入力を許可リストで検証し、大きさを境界で制限する』を、本サイクルで外から入る 2 つの大きな入力に適用する。上流指針は OWASP ASVS 5.0.0。
- Constraints: Workers のリクエスト body 上限 (Free / Pro で 100MB) はレポート JSON より十分大きく、アプリ側で先に止める必要がある。レポート JSON 契約 v3 は変えない。

## Goals and non-goals

- Goals:
  - G5: レポート送信と貼り付けを、JSON を読み込む前に body 上限で止め、超過は 413。
  - G5: キャンセル・再実行・使用するデータの経路の id と期間を zod で書式検証する。
  - G4: 取り込みの JSON は構文検査と契約検査を通ったものだけを保存し、失敗しても入力を画面に残す。
- Non-goals:
  - 明細行・摘要の AI への受け渡し (qa-ai-decision-004)
  - アプリからの自動送信
  - サーバーへの下書きの保存 (qa-ai-decision-006)

## System context and boundaries

- Users/external systems: 利用者 (web)、外部のエージェント (依頼ごとのトークン)。アプリから外部サービスへの送信は無く、データは利用者が依頼をコピーしたときだけ外へ出る。
- Trust/deployment/data boundaries: 信頼境界は 2 つ。エージェントの送信は `agentGuard` の後、利用者の貼り付けは `/api/*` のフェンスの後。どちらも body 上限 → zod 契約 → `normalizeReport` の順に通す。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| レポート body 上限 | 固定 4 MiB の request budget で report / paste の過大転送を止める | Hono middleware (`hono/body-limit`) | packages/api | Worker |
| 小さな経路の body 上限 | キャンセル・再実行は空の JSON だけを受ける | Hono middleware | packages/api | Worker |
| `reportInputSchema` / `normalizeReport` | 契約の検証と節・要点・図の規則の検査 | zod / 純関数 | packages/api | Worker |
| `sanitizeText` | HTML タグ・制御文字を落とす | 純関数 | packages/api | Worker |
| `dataset.ts` | AI へ渡す集計値だけを組む | 関数 | packages/api | Worker |
| web のレポート描画 | React の既定のエスケープで文字列を描く | React | packages/web | Workers Assets |

## Cross-cutting contracts

- Identity/access: `architecture/ai-analysis-auth.md` に従う。
- Errors/resilience: 超過は 413 `payload_too_large` を日本語の文で返す。契約違反は既存の 400 `invalid_report` と issues。エラー応答に内部の SQL・スタックを含めない。
- Observability/audit: N/A: 新しい信号を追加しない。差し戻しの時刻と回数が `ai_tasks` に残る。
- Configuration/secrets: 追加の秘密情報を持たない。トークンは SHA-256 のハッシュだけを保存する (既存)。
- Compatibility/versioning: 固定 4 MiB は転送量を抑える request budget であり、契約 field の理論最大を受け付ける保証ではない。予算内の入力は従来どおり zod 契約と `normalizeReport` で検証し、予算自体を変える場合は定数・境界テスト・system-spec を同時に更新する。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/ai-analysis-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/ai-analysis-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- 守る資産: D1 にある利用者の会計データ (明細・摘要・金額)、依頼ごとのトークン (平文は発行時の指示文にだけ出る)、保存済みのレポート本文と版履歴。外へ出してよいのは `dataset.ts` の集計値だけで、明細行と摘要は持ち出さない。
- 主体と悪用の筋書き: 利用者 (web)、外部のエージェント、トークンを手に入れた第三者、巨大な body や契約外の JSON を送る送信者。想定する悪用は、(1) 期限内のトークンでの巨大 body による Worker の資源の浪費、(2) レポート本文への HTML やスクリプトの混入、(3) キャンセル後や受信後のトークンの使い回し、(4) 他の利用者の依頼 id を推測しての操作。
- 信頼境界とデータの流れ: 外から入る経路は、エージェントのレポート送信 (`agentGuard` の後) と利用者の貼り付け (`/api/*` のフェンスの後) の 2 つ。どちらも body 上限 → zod 契約 → `normalizeReport` → D1 の順に流れる。外へ出る経路は、利用者が依頼の指示文をコピーする 1 つだけで、アプリから外部への送信は無い。(3) は `architecture/ai-analysis-auth.md`、(4) は利用者単位の 404 で扱う。

#### Input validation

レポート送信と貼り付けには、固定 4 MiB (4,194,304 bytes) の request budget を置く。これは JSON 読み込み前に過大な転送を止める境界であり、レポート契約の理論最大から算出する関数でも、最悪の JSON escape を保証する値でもない。境界値までは `bodyLimit` を通し、1 byte 超過は 413 `payload_too_large`。読み込み後の個別 field・配列は `reportInputSchema` と `normalizeReport` が検証する。これは agent の判断で、利用者は未確認である。キャンセル・再実行は body を持たないか空の JSON だけを受け 4KB を上限にし (agent 推定・利用者未確認、根拠 qa-ai-security-web-003)、id と期間は zod で書式を検証する。

#### Identity and authorization

`architecture/ai-analysis-auth.md` に従う。レポート送信の上限は `agentGuard` より前に登録し、認証前の巨大な body を読み込まない。

#### Data and secret protection

AI へ渡すのは `dataset.ts` の集計値だけで、冒頭の注記どおり明細行・摘要・ルール・編集を含めない。使用するデータのカードは件数だけを返し、この境界を利用者に見える形にする。補足指示の下書きはブラウザ内 (localStorage) だけに置き、キーに利用者 ID を含め、1000 文字を超える値は保存しない (agent 推定・利用者未確認、根拠 qa-ai-security-web-003)。

#### Application and supply-chain controls

レポートの文字列と補足指示は React の既定のエスケープで描き、`dangerouslySetInnerHTML` を使わない。保存前は従来どおり `sanitizeText` を通す。新しい依存は足さず、`hono/body-limit` と `@hono/zod-validator` の既存の仕組みを使う。

#### Detection and response

N/A: 新しい検知の仕組みは足さない。形式エラーの差し戻し回数 (`reject_count`) が依頼ごとに残るので、繰り返す差し戻しは一覧から見える。公開文書への実データ混入は既存の `security:content` が検査する。

#### Security verification

契約適合 JSON を空白で request budget ちょうどにした body が 201 で通り、同じ body を 1 バイト超過させると JSON 読み込み前に 413 になる境界テストを置く。これは個別 field を最大まで埋めるテストではない。貼り付けも同じ request budget で同じ境界を確かめる。キャンセル・再実行の 4KB 超過で 413、id の書式違反で 400 を確かめる。DOM テストでレポート中の HTML らしき文字列が要素にならず文字として出ることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-security-web-001 | report / paste に body 上限を設け、超過は 413 | 上限なし (Workers の 100MB 任せ) | JSON の読み込み前に止まり、CPU とメモリを守る | 上限の値を契約と同期させる必要がある |
| qa-ai-security-web-003 | 固定 4 MiB の request budget を JSON 読み込み前に適用する (agent 判断・利用者未確認) | field validator だけに任せる | 過大な転送を境界で止め、field の妥当性とは責務を分ける | budget 変更時は定数・境界テスト・system-spec を同時に更新する |
| qa-ai-decision-004 | AI へは集計値だけを渡す | 明細の抜粋を含める | 外へ出る範囲が一定で、利用者が件数で確かめられる | AI は明細単位の指摘ができない |
| qa-ai-security-web-001 | 描画は React の既定のエスケープに限る | HTML を許可して無害化 | 無害化の漏れが画面に届かない | レポートは平文 (改行と箇条書き) のまま |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker のビルド。
- Migration sequence: 上限の計算関数と境界テスト → report / paste への登録 → キャンセル・再実行の小さな上限。
- Rollback trigger/procedure: 正しいレポートが 413 になる報告があれば、上限の登録を外して差し戻す。保存データは変わらない。

## Risks and verification

- Risk/assumption: 上限を固定値で手書きすると、契約を広げたときに正しいレポートを落とす。上限を契約の定数から計算し、上限ちょうどの境界テストで固定する。
- Architecture fitness test: report / paste の route に上限の middleware が登録されていること。web に `dangerouslySetInnerHTML` が無いこと。`dataset.ts` が明細行・摘要を返さないこと。
- Load/failure/security validation: 上限ちょうどの body の読み込みと検証が Worker の CPU 時間内に収まること。
