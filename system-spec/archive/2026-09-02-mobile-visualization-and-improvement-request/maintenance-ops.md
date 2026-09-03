---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G4, G9, G11]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-019 |
| モバイル (mobile) | 対象外 | 理由: 運用対象は Worker/D1/R2 の単一環境で、モバイル配布の運用系統を持たない |
| タブレット (tablet) | 対象外 | 理由: 運用対象は Worker/D1/R2 の単一環境で、タブレット配布の運用系統を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 適用された設計知識

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

---

### 既存 Cron へ相乗りする定期削除と、失敗の独立記録

- project candidate: `maintenance-ops-piggyback-on-existing-scheduled-job` (`deepened`)
- 解決対象: 確定セル maintenance-ops×web (qa-019) は、相乗り先の scheduledMaintenance が本番で毎晩失敗しているという実体の上に成り立つ。汎用カードの『定期処理は既存スケジューラへ集約する』という原則だけでは、この前提が章に残らない。

#### 目的

相乗り (piggyback) の利点と、相乗り先が壊れている場合の切り分け可能性を、本仕様の確定要件へ接地させる。

#### 解決する問題

- 新規 Cron を足すと、実行時刻の重複と課金対象の増加を招く
- 相乗り先がすでに失敗している場合、新ジョブの失敗が既存の失敗に紛れて検知できない
- 『設定が存在すること』を『機能していること』と取り違えると、毎晩の失敗が観測されないまま残る

#### 適用条件

- acceptance『削除ジョブが既存 scheduledMaintenance の Promise.allSettled 配下で他ジョブと独立に成否を記録し、新規 Cron トリガが wrangler.jsonc に増えていない』: 既存の allSettled 粒度を維持したまま4本目として追加する
- 詳細取得時にも期限判定を行い、削除ジョブ失敗時の縮退経路とする (arch 4章)
- R2 孤児オブジェクトの突合は既存 runAttachmentMaintenance と同様に行う

#### 非適用条件

- 既存 nightlyBackup の実装と Cron 設定の変更 (scope_out)。本機能のスコープは4本目のジョブ追加に限る
- 新規 Cron トリガの追加 (scope_out)

#### トレードオフ

- 相乗りにより実行タイミングを個別調整できない。日次 1 回で十分な削除処理のため許容する
- scheduledMaintenance 全体は 1 本でも reject すれば失敗扱いになる。ジョブ単位のログがその粒度を補う

#### 失敗モード

- 相乗り先が毎晩失敗している事実に気づかないまま、削除ジョブも動いていると誤認する
- 削除ジョブの例外が他ジョブへ波及し、記帳データのバックアップまで止める
- R2 オブジェクトの削除だけ成功し D1 側が残る (またはその逆) で不整合が残る

#### goalへの寄与

G11 (最小保持) の実行主体。同時に、ジョブ単位の成否記録が G3 (原因を即座に特定できる検知) を運用面から支える。

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 今回の feature scope

本章の仕様は確定済みであり、今回の feature `feat-mobile-financial-visualization` では**変更しない**。

- feature scope: 変更対象は ui-ux / frontend のみ (承認: `appr-mobile-scope-narrowing-001`)
- 本章の spec cell state は「確定」のまま維持する。「今回触らない」ことと「仕様が存在しない (対象外)」ことは別軸であり、feature scope を cell state へ書くと D1・認証・Workers の実在する契約が仕様上消え、以後の completeness 評価や dev-graph の要件導出がその前提で走ってしまう。
- 境界維持の検証は ui-ux / frontend 側の制約と受入条件で行う (`qa-mobile-boundaries-001`)。

- 正本へ入れた理由: feature 単位の「今回触らない」を恒久的な spec cell state (確定/対象外) と取り違えた降格が起きたため、意図を state とは別の軸で保持する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-r2-object-lifecycles | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/buckets/object-lifecycles/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-workers-cron-triggers | 2026-06-20 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/configuration/cron-triggers/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
