---
graph_node_id: "arch-improvement-screen-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "改善リクエスト — 文章はサーバで再マスクし、画像は撮影時の伏字と本人確認を通し、論理削除から 30 日後に完全消去する"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement", "security"]
file_path: "architecture/improvement-screen-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "b6fd591818ace882023591ec1672e6315480022991aa1f57ac64285b40c8c3a2"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "b6fd591818ace882023591ec1672e6315480022991aa1f57ac64285b40c8c3a2", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/core/src/improvement.ts", "packages/api/src/improvement/redact.ts", "packages/api/src/improvement/contract.ts", "packages/api/src/routes/improvement.ts", "packages/web/src/capture-screen.ts", "packages/web/src/diagnostics-buffer.ts", "packages/api/src/store.ts", "packages/api/src/improvement-redaction.test.ts", "packages/api/src/improvement-backup-exclusion.test.ts", "packages/web/src/capture-screen.dom.test.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G2", "G4"]
---

# Architecture overview

改善リクエスト — マスク規則を core の 1 か所に置き、本文・関連ページ・診断には、ブラウザとサーバの 2 層で同じ関数を呼ぶ。画像は撮影用 DOM 複製で伏字にする。対象は金額・電話・住所・口座・メール・秘匿値と、利用者自身の `transactions.partner` (取引先名) と `owner_labels` (名義) から毎回作る辞書である。撮影用の複製では `data-capture-mask` を付けた要素を伏字にしてから画像にする。入力は本文・プライバシー確認 2 つ・状態・画像・診断の 5 つの境界で閉じる。画像はマジックバイトで JPEG/PNG か確かめ、2MB 以下に限る。診断のセッション ID はページを読み込むたびに作る乱数で、画面には末尾 4 桁だけを出す (qa-imp-security-web-001、qa-imp-decision-004)。`system-spec/security.md` は承認時入力、本書は入力の境界・個人情報の伏せ方・保持期限の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: `packages/core/src/improvement.ts:128` の `redactSecrets` は URL のクエリ値・セッション Cookie・秘匿キーの値・メールアドレス・10 桁以上の連続数字を伏せる。金額・10 桁未満の電話・住所・個人名・取引先名は伏せない。撮影は `packages/web/src/capture-screen.ts:91` が `[data-capture-hide]` の要素を落とすだけで、画面の文字を伏せない。画像の上限は 2MB (`core/src/improvement.ts:79`)。`DiagnosticEnvironment` は userAgent・language・viewport・route・capturedAt だけを持ち、識別子を足さない決まりである。取引先名は `transactions.partner`、名義の表示名は `owner_labels` (`migrations/0045_owner_labels.sql`) に利用者ごとにある (qa-imp-security-web-evidence-001)。
- 現状との差分: サーバの再マスクは `packages/api/src/improvement/redact.ts:54` の `redactText` が core の同じ関数を再適用する 2 層の形になっている。一方、画像は形式外や 2MB 超でも投稿自体は通し、画像だけを落とす (`routes/improvement.ts:166-176` の `screenshotRejected`)。本文は 1..4000 字、件名は 1..120 字 (`improvement/contract.ts:94-97`)。プライバシーの確認は無い (U2)。
- Quality attribute priorities: G2・G4 に資する。Secure by Design の『Defense in depth』をマスクの 2 層に、『Data lifecycle』を保存から消去までに適用する (security 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: OWASP ASVS 5.0.0、OWASP File Upload Cheat Sheet (2026-09-18 版、2026-09-23 確認)。撮影はブラウザ内で完結させ、外部へ画面を送らない (C4)。public repository のため実データをテストと成果物へ含めない (C4)。

## Goals and non-goals

- Goals:
  - G2: 本文・関連ページ・診断はサーバで辞書を含めて再マスクする。画像は撮影時に伏字にし、利用者が送信前に確認する。画像内の機密情報 0 件は保証しない (S2)。
  - G2: クライアントのマスクを飛ばした投稿にも、サーバで同じ規則を掛ける (O2)。
  - G4: 空の本文・1000 字超・プライバシー確認の欠け・候補外の状態・形式外や 2MB 超の画像を 400 にする (S4)。
  - G4: 夜間バックアップ (`BACKUP_SNAPSHOT_SQL`) に改善リクエストの表を入れない不変条件を保つ (O4)。
- Non-goals:
  - 画像を外部の OCR やサービスへ送って伏せること
  - 取引先名・名義の辞書を保存すること (リクエストのたびに作る)
  - CSP・secureHeaders (`packages/api/src/index.ts:59-84`) の変更
  - 1000 字を超える既存の本文を切り詰めること (読めるまま保つ、qa-imp-decision-002)

## System context and boundaries

- Users/external systems: 利用者のブラウザ。撮影と伏字はブラウザ内で完結する。Claude Code / Codex は agent 経路で保存済みの本文・診断・画像を読む。画像には撮影時の伏字だけが適用される。
- Trust/deployment/data boundaries: 本文・関連ページ・診断の信頼境界はサーバ側 (`redact.ts`) である。画像についてサーバは形式と大きさだけを検証し、画像内の情報は再マスクしない。保存先は D1 (本文・診断) と R2 `FILES` (画像)。夜間バックアップはこの表を含まない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core のマスク規則 (`redactSecrets` の拡張、`core/src/improvement.ts`) | 金額・電話・住所・口座・メール・秘匿値の規則と、辞書 (取引先名・名義) による伏字 | 純関数 | packages/core | web と api の両方 |
| 撮影用の DOM 複製 (`web/src/capture-screen.ts`) | `data-capture-mask` の要素を伏字にしてから画像にする。`data-capture-hide` は従来どおり落とす | 関数 | packages/web | Workers Assets |
| 診断バッファ (`web/src/diagnostics-buffer.ts`) | 送信前のマスクと、ページ読み込みごとの乱数のセッション ID | 関数 | packages/web | 同上 |
| サーバの再マスク (`api/src/improvement/redact.ts`) | 本文・関連ページ・診断へ同じ core の規則を再適用。画像の形式をマジックバイトで判定 (`sniffScreenshotType`、:64) | 関数 | packages/api | api Worker |
| 入力の zod (`api/src/improvement/contract.ts`) | 本文 1..1000・プライバシー確認 2 つ・状態の候補・診断 60 件/32KB | zod schema | packages/api | 同上 |
| `BACKUP_SNAPSHOT_SQL` (`api/src/store.ts:802`、禁止の注記は :796) | 夜間バックアップの対象表。改善リクエストの表を含めない | SQL 定数 | packages/api | 同上 |

## Cross-cutting contracts

- Identity/access: `architecture/improvement-screen-auth.md` のとおり。取引先名の辞書は、作成時に利用者自身の `transactions.partner` だけを 1 本のクエリで読む (`system-spec/backend.md` の data-access 行)。
- Errors/resilience: 入力の 5 境界に落ちたものは 400 にし、欄ごとの理由を返す。診断が壊れていても投稿は止めない現行の扱い (`redact.ts:35-51`) は保つ。
- Observability/audit: ログに本文・診断・利用者 ID・R2 のキー・トークン値を出さない。改善リクエストの応答は `Cache-Control` を private no-store にする現行 (`routes/improvement.ts:63-66`) を保つ。
- Configuration/secrets: N/A: 新しい秘密情報を持たない。
- Compatibility/versioning: core のマスクは冪等 (`redact.ts` の注記) なので、2 層で二度掛けても値は変わらない。この性質を拡張後も保つ。R2 のキーの形 `improvements/<userId>/<requestId>.jpg` (`core/src/improvement.ts:348-349`) は変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/improvement-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/improvement-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/improvement-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/improvement-screen-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は、依頼に写り込む利用者の金融情報 (金額・取引先名・名義・口座) と連絡先 (メール・電話・住所)、秘匿値、そして依頼そのもの。主体は利用者本人、agent 経路で読む Claude Code / Codex、ブラウザ側のマスクを飛ばして直接 API を叩く者。濫用の筋は 3 つ。撮影した画面の文字から金融情報が漏れること、細工した本文・診断・画像ファイルで伏字や形式の検査をすり抜けること、削除した依頼や添付が保持期限を過ぎて残ること。

#### Input validation

5 つの境界で閉じる。(1) 本文は新規と編集で 1 字以上 1000 字以下 (既存の超過分は読むだけ)。(2) プライバシー確認は 2 つとも true。(3) 状態は 4 候補 (受付 / 対応中 / 完了 / 再確認) のうち core が許す遷移だけ。(4) 画像はマジックバイトで JPEG/PNG、2MB 以下。現行の「画像だけ落として投稿は通す」を 400 に改める。(5) 診断は 60 件 (`core/src/improvement.ts:55`)・32KB (:63)。上限を超えた件数を切り詰めて `omittedCount` に足す現行の扱いは保つ。core と API の zod で同じ上限を持つ (I6)。

#### Identity and authorization

`architecture/improvement-screen-auth.md` のとおり。マスクの辞書は、そのリクエストの利用者の `transactions.partner` と `owner_labels` だけから作り、他の利用者の語を混ぜない。

#### Data and secret protection

本文・関連ページ・診断のマスクは保存の前に掛ける。ブラウザでも辞書を使わない規則を掛け、サーバでは保存の直前に辞書を含む規則を掛け直す。画像は撮影用の複製で一般 DOM の文字を伏字にし、canvas はプレースホルダー化するが、送信前に利用者がプレビューを確認する。辞書は保存せず、リクエストのたびに作る。診断のセッション ID は認証のセッションとは別の、ページを読み込むたびに作る乱数で、画面には末尾 4 桁だけを出す。これは「`DiagnosticEnvironment` に識別子を足さない」現行の決まりを改める変更であり、認証のセッションと結び付かないことをテストで確かめる。保持期限は 2 本。完了から 30 日で添付・診断・トークンを消す (現行)。論理削除から 30 日で行・履歴・R2 の画像を完全に消す (新設、夜間処理は `architecture/improvement-screen-infrastructure.md`)。

#### Application and supply-chain controls

画像は拡張子や `Content-Type` ではなく先頭のバイト列で判定する (OWASP File Upload Cheat Sheet)。本文と診断は React のテキストとして描き、HTML として解釈しない。CSP (`default-src 'self'`・`connect-src 'self'`・`img-src 'self' blob: data:`) は変えない。新しい依存を足さない。

#### Detection and response

N/A: 新しい検知を足さない。夜間の完全消去の件数は job ごとの JSON ログに本文・利用者 ID・R2 のキーを載せずに出す (`architecture/improvement-screen-maintenance-ops.md`)。

#### Security verification

core の単体テストで 7 種 (口座・取引先名・金額・個人名・メール・電話・住所) と秘匿値の例がそれぞれ伏字になり、二度掛けで値が変わらないこと。DOM テスト (`capture-screen.dom.test.ts` の系列) で撮影用の複製から金額・取引先名・名義の文字が伏字になること。API テスト (`improvement-redaction.test.ts` の系列) でクライアントのマスクを飛ばした投稿にもサーバで同じ規則が掛かること、S4 の不正入力 5 種がそれぞれ 400 になること、JPEG/PNG の拡張子を名乗る別形式が 400 になること。`improvement-backup-exclusion.test.ts` で `BACKUP_SNAPSHOT_SQL` に改善リクエストの表が無いこと (O2・O4)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-004 | 本文・診断はサーバでも再マスクし、画像はブラウザで伏字にして利用者が確認する | 本文だけ / サーバだけ | 文章の直接投稿をサーバでも伏せ、画像の残余リスクを本人が確認できる | 画像のバイト列をサーバでは再マスクしない |
| qa-imp-security-web-001 | 取引先名と名義は利用者自身の `transactions.partner` と `owner_labels` の辞書で伏せ、辞書は保存しない | 正規表現だけ / 辞書を保存 | 固有名は正規表現で拾えない。保存すると新しい個人情報の置き場になる | 作成のたびに辞書を読むクエリが 1 本増える |
| qa-imp-security-web-001 | 撮影用の複製で印付き要素と一般文字を伏字にし、canvas はプレースホルダー化する | 撮影後の画像処理 | DOM で読める文字を画像化前に処理できる | 複製後の画像に残る情報は送信前の利用者確認で扱う |
| qa-imp-security-web-001 | 画像はマジックバイトで JPEG/PNG・2MB 以下、外れたら 400 | 画像だけ落として投稿を通す (現行) | 不正な入力を境界で止める (S4) | 形式外の画像を付けた利用者は送り直す |
| qa-imp-security-web-001 | 診断のセッション ID をページ読み込みごとの乱数にし、表示は末尾 4 桁 | 認証のセッション ID を使う | 認証の資格情報と結び付かない | 同じ利用者の別ページ読み込みは別 ID になる |
| qa-imp-decision-002 | 本文は新規と編集で 1000 字、既存の超過分は読むだけ | 既存も切り詰める | 既存の行を失わない (C2) | 読み取りと書き込みで上限の扱いが分かれる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web (Workers Assets) と api Worker。
- Migration sequence: core のマスク規則の拡張と単体テスト → サーバの再マスクと zod の上限 → 撮影用の複製の伏字と DOM テスト → 画像の 400 化 → 診断のセッション ID。0054 の列 (`deleted_at` 等) を使う保持期限は `architecture/improvement-screen-infrastructure.md` の順に従う。
- Rollback trigger/procedure: O2 の core・DOM・API テストのどれかが赤なら差し戻す。マスクの拡張は保存済みの行を書き換えないので、コードを戻すだけで済む。

## Risks and verification

- Risk/assumption: 辞書による伏字は、辞書に無い固有名 (取引先名として登録されていない個人名など) を拾えない。残余リスクとして `docs/improvement-request.md` の利用者向けの節に書く。
- Risk/assumption: 金額や電話の規則を広げすぎると、画面パスや日付などの無害な数字まで伏せ、指示文が読めなくなる。core の単体テストで、伏せない例も固定する。
- Risk/assumption: 撮影用 DOM の伏字はベストエフォートである。一般文字にも辞書を使わない規則を掛け、canvas はプレースホルダー化するが、画像内の情報を完全には判定できない。送信前に利用者がプレビューを確認する。
- Architecture fitness test: web と api にマスクの規則が core 以外に無いこと (grep で 0 件、O3)。`BACKUP_SNAPSHOT_SQL` に `improvement` を含まないこと。
- Load/failure/security validation: クライアントのマスクを飛ばした投稿で、保存された本文と診断に 7 種と秘匿値が残らないこと (O2)。
