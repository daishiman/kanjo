---
graph_node_id: "arch-account-login-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "アカウントログイン — フロントエンド構成"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "frontend"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-ui-ux", "arch-account-login-backend", "arch-account-login-security"]
resource_scope: ["packages/web/src/pages", "packages/web/src/components", "packages/web/src/lib"]
purpose: "既存の React + Vite SPA の枠内で、ログイン・パスワード変更・利用者管理の画面を追加改修する。"
goal: "ルータや状態管理ライブラリを新規導入せず、既存 20 画面のレイアウトを変えずに認証系画面が揃った状態にする。"
scope_in: ["Login.tsx の全面改修", "パスワード変更画面の追加と強制遷移", "設定画面配下の利用者管理 (admin 向け)", "401 応答時のログイン画面復帰の維持"]
scope_out: ["ルータ / 状態管理ライブラリの新規導入", "既存 20 画面のレイアウト・ナビゲーション変更", "外部 CDN からのアイコン読み込み", "Cloudflare Access の UI 導線"]
acceptance: ["新規の依存ライブラリが0件である", "must_change_password が真のとき他画面へ遷移できない", "admin 以外に利用者管理メニューが表示されない", "アイコンがインライン SVG で実行時に外部を参照しない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-frontend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "b746712472e027af3ce6d4f3ceb3d9555dd8c2ff007ff79a8d1322f2a220d20b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "61aea1297840c38f276b9eb26b4320fe2f512bd28e1208666d53c1afeb15b026", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "クライアント側の構成と境界を定めるため architecture / frontend subtype として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G4, G5, G3]
---

# アカウントログイン — フロントエンド構成

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/frontend.md`。画面の見え方と情報優先度は `architecture/account-login-ui-ux.md` が担う。

## Architecture overview

既存の React + Vite SPA (`packages/web`) 内で完結させ、ルータや状態管理ライブラリを新規導入しない。追加・改修は (1) `Login.tsx` の全面改修、(2) パスワード変更画面、(3) 設定画面配下の利用者管理、の3点。

## Context and drivers

既存 20 画面は月次業務の順序で束ねられ、共通のレイアウトとナビゲーションを共有している。認証系の追加がこの構造を動かすと影響が全画面に及ぶため、既存レイアウトへの非干渉を制約として受ける。

## Goals and non-goals

- Goal: 認証系3画面を既存構成の中に収める。
- Non-goal: ライブラリ追加、既存画面のレイアウト変更、外部 CDN 依存。

## System context and boundaries

API 呼出しは既存の `api()` ラッパを使い、401 応答時にログイン画面へ復帰する共通処理を維持する。ログイン画面は他画面と異なり、ヘッダー・フッター・サイドバーを持たない専用レイアウトとする。

## Container and component view

- `pages/Login.tsx`: 中央に置くログインカード1枚のみ (安心3項目もカード内)
- パスワード変更画面: `must_change_password` が真のとき他画面への遷移を許さない
- 設定画面配下の「利用者管理」: 一覧・招待・role 変更・停止・一時パスワード再発行

## Cross-cutting contracts

admin 以外にはメニュー自体を出さない。ただし権限判定の正本はサーバ側の 403 であり、UI の非表示はこれを代替しない。アイコンは既存資産の流儀に合わせたインライン SVG とし、実行時に外部 CDN を参照しない。

## Subtype architecture

**frontend**: 強制パスワード変更を「画面遷移の抑止」として実装する。ルータを持たない構成のため、遷移可否は `GET /api/auth/me` が返す `must_change_password` を根拠にレンダリング分岐で表現する。

## Architecture decisions

1. ライブラリを増やさない — ログイン導線のために SPA の依存構成を変える理由がなく、ビルド面の影響を避ける。
2. Cloudflare Access の文言と分岐を UI から除去する (利用者指示) — サーバ側実装は残すため、UI 側の削除だけで完結する。

## Delivery, migration and rollback

`Login.tsx` の改修は認証 API の切替と同時に投入する。旧ログイン画面のまま新 API に当たる中間状態を作らない。

## Risks and verification

- リスク: 強制変更の回避 (直接 URL 操作) → サーバ側でも `must_change_password` の状態で本人操作以外を拒否する。
- 検証: 新規依存が0件であること、DOM に header/footer/nav/aside が存在しないことを検査する (タグ名の一部だけを塞ぐと、脇に置いた `aside` が列として残り枠に見える)。
