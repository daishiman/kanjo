# 診断画面の実装マップ

本書はファイルの案内だけを持つ。振る舞い・型・算式・ADR を再掲しない。

## 正本への入口

- 振る舞いと API: `specs/spec-diagnosis-screen.md`
- 依存と ADR: `architecture/arch-diagnosis-screen.md`
- 算式としきい値: `docs/diagnosis-screen.md`
- テスト入力: `docs/diagnosis-screen-test-plan.md`
- 実測結果: `docs/diagnosis-screen-evidence.md`

## 実装配置

| 場所 | 責務 |
|---|---|
| `packages/core/src/diagnosis-detectors.ts` | 検知器、impactBasis、scope / metric、claimKeys、query 付き nextAction、`detectImprovements()` |
| `packages/core/src/diagnosis-health.ts` | 健全性スコア |
| `packages/core/src/diagnosis-screen.ts` | 既存診断と改善項目を画面応答へ合成する `diagnosisScreen()` |
| `packages/api/src/routes/analytics.ts` | Dataset と認証済み user_id の組み立て、GET /diagnosis、PATCH /diagnosis/actions/:action_key |
| `packages/api/src/db/schema.ts` | migration を写した Drizzle schema |
| `migrations/0044_diagnosis_action_states.sql` | `(user_id, action_key)` を主キーにした永続化の正本 |
| `packages/web/src/pages/analysis/Diagnosis.tsx` | URL 状態、取得、保存、master-detail のページ制御 |
| `packages/web/src/pages/analysis/diagnosis/` | 条件、結果、表、詳細、図、根拠、固定アクションバー、旧統計の表示部品 |
| `packages/web/src/pages/analysis/diagnosis.css` | トークンだけを使う画面レイアウト |

## 状態の所有

| 状態 | 所有 |
|---|---|
| 期間 | `usePeriod` / localStorage。全分析画面で共有 |
| scope / metric / compare / action / done / stats | URL searchParams。共有リンクで復元 |
| status / note / decided_at | D1。API が認証済み user_id で絞る |
| 検知結果・primary・totals・waterfall・signals | core の導出値。保存せず画面で再計算しない |

rolling deploy 中に新フィールドがない旧応答を受けた場合だけ、既存の科目別プロファイルと自動診断へフォールバックする。
