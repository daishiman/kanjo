---
graph_node_id: "arch-guide-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "使い方 — Guide.tsx を pages/guide/ に分け、トピックと検索語を URL に置き、数字と文言は view-model 経由で core の guide-screen から受け取る"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "frontend"]
file_path: "architecture/guide-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "91756674aaa74956621cba80f0cbd496d790626d431d0e24ed476ea7c725b49f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "91756674aaa74956621cba80f0cbd496d790626d431d0e24ed476ea7c725b49f", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Guide.tsx", "packages/web/src/pages/guide", "packages/web/src/guide-sections.ts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/pages/statements/view-model.ts", "packages/web/src/guide.dom.test.tsx", "packages/core/src/guide-screen.ts"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G1", "G2", "G3"]
---

# Architecture overview

使い方 — `packages/web/src/pages/Guide.tsx` (185 行) を `packages/web/src/pages/guide/` の 画面本体・`view-model.ts`・4 ステップ・目次・本文の各節・右カラム・よくある疑問・下部固定バーに分け、旧 `pages/Guide.tsx` は再輸出 1 行にする。選択中のトピックと検索語は URL (`?topic=&q=`) に置き、節・ステップ・よくある疑問・期間の表・このページの数値・検索・信頼度の段階は `view-model.ts` だけが core を呼んで受け取る (qa-guide-frontend-web-002)。`system-spec/frontend.md` は承認時入力、本書はモジュール分割・状態の置き場所・API との結線の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 現行 `Guide.tsx` は `useQuery` で `['summary']` の `/summary` と `['diagnosis']` の `/diagnosis` を期間なしで読み、ベンチマーク表・略語・`buildGuideSections` の節表・データ充足度を縦に並べる。現在値の合成は web 側 `guide-sections.ts` の `GUIDE_CURRENT` (:46) と `buildGuideSections` (:117) にある。画面は遅延読込 (`AuthenticatedApp.tsx:39`)、ルートは `routeMetadata.ts:152-163` (id `guide`、label『使い方』、contentWidth `reading`)。分割の前例は `pages/cash/` で、`view-model.ts` だけが core を import し、`pages/Cash.tsx` は再輸出 1 行になっている (qa-guide-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G2・G3 に資する。Clean Architecture (依存は web → core の一方向、導出は core) と Information Design (右カラムは 4 項目だけ残す) を適用する (frontend 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: React 18 + react-router-dom 7 + TanStack Query 5 (5.103.2)。既存のトークン・共通部品・PageHeader 規約。web のみ (qa-guide-target-platforms-001)。

## Goals and non-goals

- Goals:
  - G1: 画面を部品単位に分け、`19-guide.png` の段ごとに 1 部品を対応させる (`architecture/guide-ui-ux.md`)。
  - G2: 信頼度を出す既存画面 (明細仕分けなど) は core の段階関数の結果を描くだけにし、境界の比較を web に書かない (qa-guide-decision-008)。
  - G3: ガイドの節・現在値・検索を core の `guide-screen` から受け取り、web で合成しない。`guide-sections.ts` の現在値合成は core へ移す。
- Non-goals:
  - 防衛ラインを出す画面 (概況・予算・トレードオフ・ヘッダ) の表示と算出の変更 (qa-guide-decision-009 / 010)
  - 画面の即時読込化 (遅延読込のまま)
  - 検索のサーバ送信 (`architecture/guide-security.md`)

## System context and boundaries

- Users/external systems: 利用者のブラウザ。
- Trust/deployment/data boundaries: web は `/api/guide` の `{ screen }` を受けて描くだけ。節・よくある疑問の本文は core の定数を web の chunk に含めて読むが、数値は必ず API の値を使う (qa-guide-backend-web-004、agent 推定・利用者未確認)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/guide/GuidePage.tsx` (画面本体) | 段の配置、URL の `topic` / `q` の読み書き | React + `useSearchParams` | packages/web | Workers Assets |
| `pages/guide/view-model.ts` | core の `guide-screen`・段階関数・`shiftedPeriod` を呼び、画面用に写す | 純関数 | packages/web (導出は packages/core) | 同上 |
| 4 ステップ / 目次 / 本文の各節 | 描画と元画面へのリンク | React | packages/web | 同上 |
| 右カラム | このページの数値・関連ページ・ガイド内を検索 | React | packages/web | 同上 |
| よくある疑問 / 下部固定バー | 5 行の表、現在のトピックと元画面ボタン | React | packages/web | 同上 |
| `pages/Guide.tsx` | 再輸出 1 行 | `export { GuidePage } from './guide/GuidePage.js';` | packages/web | 同上 |

部品のファイル名は agent 推定・利用者未確認。再輸出の書式は `display-contract.test.tsx:31` の REEXPORT 正規表現に合わせる。

## Cross-cutting contracts

- Identity/access: 既存セッションの Cookie で API を呼ぶ。新しい保存 (localStorage 等) は持たない。
- Errors/resilience: `/api/guide` の失敗時も本文・目次・検索・下部固定バーは描き、数値の枠だけに「取得できませんでした」と再読込を出す。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 経路 `/guide` とルート数を保つ (`common-shell-routes.dom.test.tsx:116` のルート数固定)。`topic` / `q` が無ければ月次の流れ・検索なしで開く。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/guide-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外 (`architecture/guide-security.md`)

### Frontend architecture

#### Rendering and application pattern

`view-model.ts` だけが core を呼ぶ。部品は view-model が返す値を描き、節の並び・現在値・検索の絞り込み・信頼度の段階を自分で計算しない。これで G3 (導出は core の 1 か所) を web 側の依存の向きで守る。

#### Routes, screens and navigation

経路は `/guide` のまま遅延読込を保つ。トピックと検索語は `useSearchParams` で URL に持つ (react-router 8.4.0 の useSearchParams)。未知の `topic` は `flow` (月次の流れ) に倒し、`q` は 100 字で切る (qa-guide-security-web-003、agent 推定・利用者未確認)。期間の前後移動は core へ移した `shiftedPeriod` を使う。現物は `pages/statements/view-model.ts:121` にあり、`StatementsPage.tsx:20,32-33` と `statements-view-model.test.ts:93-100` が使う。

#### Component and design-system boundaries

色はトークン、ボタンは共通 `Button`、ページは PageShell と `PageHeader route="guide"`。分割後の各部品は 1 段に 1 つ対応させる。『用語と目安』は現行の用語集 (`glossary.ts` の `GUIDE_SECTIONS` :448・`GUIDE_ORDER` :531)・略語・ベンチマーク・データ充足度を部品ごと移す。

#### State and data flow

サーバー状態は TanStack Query 5 で持つ。`/api/guide` の問い合わせ鍵に期間を含め (TanStack Query の query keys、qa-guide-frontend-web-002)、期間の変更で読み直す。『用語と目安』の現在値は既存経路 (`/summary`・`/diagnosis`) を期間つきで読み、合成は core に任せる。トピックと検索語は URL だけに持ち、コンポーネント内 state に二重に持たない。

#### Backend integration

`GET /api/guide` (期間クエリ) を使う (`architecture/guide-backend.md`)。応答の `period`・`totals`・`dataUpdatedAt`・`sources`・`closeStatus` を描き、防衛ラインの値は読まない。

#### Performance and observability

初期 JS 予算 110KiB を守るため画面は遅延読込のまま。core の `guide-screen` と本文の定数は画面の chunk に入る。core の index は既存の *-screen と同じく初期バンドルに引き込まない注記 (`packages/core/src/index.ts:30-31`) に従って export する。

#### Frontend verification

view-model の単体テストで core の結果の写しを、DOM テストで 画像の全構成要素・URL の往復・未知 `topic` の倒れ方・読込 / 失敗 / 検索 0 件・信頼度の『段階＋%』を確かめる。既存の `guide.dom.test.tsx` (32 行) と `guide-sections.test.ts` (21 行) を新しい構成へ移し、期待値を緩めない。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-frontend-web-002 | `pages/guide/` に分け、view-model だけが core を呼ぶ | `Guide.tsx` 1 ファイルのまま改修 | cash の前例と揃い、導出の置き場所が 1 つになる | import 経路が変わり、既存テストの移設が要る |
| qa-guide-frontend-web-002 | トピックと検索語を URL (`?topic=&q=`) に持つ | コンポーネント内 state | 再読込・共有で同じ節が開く | キー名の互換を保つ必要がある |
| qa-guide-frontend-web-002 | 現在値の合成を `guide-sections.ts` から core へ移す | web に残す | web と api に導出が割れない | `guide-sections.ts` の利用箇所の書き換えが要る |
| qa-guide-backend-web-002 | `shiftedPeriod` を core へ移し決算書と共有する | 使い方画面で複製 | 期間の送りが 1 つの関数になる | 決算書の import とテストの移設が要る |
| qa-guide-decision-008 | 信頼度を出す画面は core の段階関数の結果を描く | 画面ごとに境界を比較 | 境界 80/50 が 1 か所になる | 対象画面の列挙が未決 (`specs/spec-guide-screen.md` 未決事項) |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: core `guide-screen`・段階関数・`shiftedPeriod` → `view-model.ts` → 部品分割と再輸出 → URL の `topic` / `q` → `/api/guide` の結線 → 信頼度を出す画面の段階表示。
- Rollback trigger/procedure: DOM テスト・初期 JS 予算・`check:guide-screen` のどれかが赤なら差し戻す。保存データを持たないので差し戻しで失うものは無い。

## Risks and verification

- Risk/assumption: 部品が view-model を経由せず core や自前計算を使うと、数字と説明が割れる。部品から core を import しないことを lint か grep の検査で確かめる。
- Risk/assumption: 本文の定数を web の chunk に含めるので、chunk の大きさが増える。初期 JS には入らないことを `check:js-budget` で確かめる。
- Architecture fitness test: `pages/guide/` 配下で core を import するのが `view-model.ts` だけであること。
- Load/failure/security validation: 初期 JS 予算を CI 実測で確かめ、使い方画面が遅延読込のままであること。


## 実装で確定したこと(2026-09-23)

- フッタが読む `AI_DATA_NOTICE` は `packages/core/src/data-notice.ts` に分けた。使い方画面の本文表(よくある疑問・月次の流れ)と同じモジュールにあると、フッタ経由で本文表が初期 JS に載り 110KiB を超えたため(111.96KiB → 107.71KiB)。
- 期間の前後移動は `packages/web/src/components/PeriodRange.tsx` にまとめ、使い方画面と決算書画面が core の `shiftedPeriod` を通して共有する。
- 本文の描画は `pages/guide/` 配下の部品が view-model の結果だけを描く。core を import するのは `pages/guide/view-model.ts` だけ(フッタの補足は `data-notice.ts` から)。
- 詳細は `docs/guide-screen/design-decisions.md` と `docs/guide-screen/evidence.md`。
