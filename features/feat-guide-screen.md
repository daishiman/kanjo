---
graph_node_id: "feat-guide-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "使い方画面 (19-guide) の作り直しと、ガイドの節・現在値・信頼度の段階・防衛ラインの説明の core 一本化"
project_id: "kanjo"
domain: "guide"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "help", "confidence-tier", "defense-line-copy", "common-shell", "feature"]
file_path: "features/feat-guide-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f98f279826872e15be041b98f2eeae88e1b0254b3f33432e3a9ccf411047b129"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-guide-screen.md", "source_version": "0.1.11", "source_digest": "e17311f28373ec7b2ef2458d05a7ecf805aef872b2fab8ffa82e56fbaaafc49c", "imported_at": "2026-09-23T13:44:19Z"}
created_at: "2026-09-23T13:44:19Z"
updated_at: "2026-09-23T14:33:54Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/19-guide.png", "docs/guide-screen", "package.json", "packages/api/src", "packages/core/src", "packages/web/package.json", "packages/web/scripts", "packages/web/src", "specs/spec-guide-screen.md"]
purpose: "利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、月次クローズの途中で画面の数字に迷ったとき『この数字を、どう読み・どこへ戻ればよいですか？』に /guide の 1 画面で答えを得られるようにする。今見ている数字が何を含み何を除くか・どの期間の・どこから来た値かを選択中の期間の実データで示し、つまずいたら該当の元画面へ 1 クリックで戻れるようにする。ガイドの節・現在値・信頼度の段階・防衛ラインの説明文は core の 1 か所から導き、説明と計算を画面ごとにずらさず、振替の二重計上・家計と事業の混同・信頼度や防衛ラインの誤解による判断ミスを無くす。"
goal: "/guide が 19-guide.png の全構成要素 (問いの見出しと説明・期間と前後移動・4 ステップ (取込む・整える・確認・計画) と各『元画面を開く』・使い方ガイド (目次 6 項目＋『用語と目安』、月次の流れステッパー、総収支の読み方の 3 枚を選択期間の実データ (振替除外) で、含まれるもの 3 枚、期間の表 4 行)・右カラム (このページの数値 4 項目・関連ページ 5 件・ガイド内を検索)・よくある疑問と対処法 5 行・下部固定バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、選択トピックと検索語が URL に残り、画面の数値と文言が core の guide-screen から出て API は { screen } に写すだけ・web は描くだけで、信頼度が 高 80 以上 / 中 50〜79 / 低 49 以下 の段階＋% で出て要確認の閾値 80 の自動判定は変わらず、防衛ラインの算出 (直近 3 か月平均) と値は変わらずにガイドと用語集の説明がその算出定数から組まれ、ヘッダは『防衛ライン』のまま・フッタ 1 文目が『取込データは外部送信しません』で AI 送信の補足が 3 か所にあり、/api/guide が利用者ごとに分離され、DB の表・列を 1 つも足さずに verify:full が緑の状態。"
scope_in: ["/guide の作り直し (19-guide.png の全構成要素と読込・空・失敗の各状態)。Guide.tsx (185 行) を packages/web/src/pages/guide/ 配下 (画面本体・view-model・4 ステップ・目次・本文の各節・右カラム・よくある疑問・下部固定バー) へ分割し、旧 pages/Guide.tsx は再輸出 1 行にする。core を import するのは view-model.ts だけ (I1、qa-guide-frontend-web-002)", "目次 6 項目 (月次の流れ / 総収支 / 照合 / 仕分け / 予算 / データ出典) の末尾に『用語と目安』を置き、現行の用語集・略語・ベンチマーク・データ充足度を移す (qa-guide-decision-001)", "選択トピックと検索語を URL (?topic=&q=) に保ち、/api/guide の問い合わせ鍵に期間を含める", "packages/core/src/guide-screen.ts の新設。節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・ガイド内検索を純関数で導き、guide-sections.ts の現在値合成を core へ移す (I2)", "GET /api/guide の新設。loadScoped の結果を core の guide-screen に渡して { screen } に写すだけにし、利用者ごとに分離し期間クエリを検証する (I3)", "期間の前後移動 shiftedPeriod を pages/statements/view-model.ts から core へ移し、決算書と使い方画面で共有する (I7)", "core の信頼度の段階関数 (高 80 以上 / 中 50〜79 / 低 49 以下) と、信頼度を出す画面の『段階＋%』表示。対象画面の列挙は requirements で確定する (I4、qa-guide-decision-008)", "防衛ラインの算出期間 (直近 3 か月) を core の名前付き定数として公開し、使い方画面と用語集の説明文をその定数から組む。算出と値は変えない (I5、qa-guide-decision-009)", "共通シェルのフッタ 1 文目を『取込データは外部送信しません』にし、AI 実行時に集計データを渡す補足をフッタの title・プライバシー欄・使い方画面の 3 か所に置く。ヘッダは『防衛ライン』のまま (I6、qa-guide-decision-010・011)", "core 単体・API・DOM テストと、web の check:guide-screen の verify:full への組み込み、設計判断の記録 (docs/guide-screen/ を新設)"]
scope_out: ["利用規約・プライバシーの専用ページ (現行の details のまま文言の補足だけ行う)", "ガイド本文の管理画面や DB 保存 (本文は core の定数として版管理する)", "自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更", "防衛ラインの算出変更 (画像の過去年同月平均など。qa-guide-decision-009 で現行維持)", "共通ヘッダの呼称変更 (画像の『取引ライン』。qa-guide-decision-010 で『防衛ライン』維持)", "サイドバーの並び・バッジ・月次クローズ進捗の変更", "DB の表・列・migration の追加 (C2)", "モバイル・タブレット・デスクトップ専用アプリ", "税務判断 (税務上の正本は freee。C4)"]
acceptance: ["S1 (G1): /guide で 19-guide.png の構成要素がすべて描画され、総収支の 3 枚が選択期間の実データ (振替除外) と一致し、色・余白・部品はトークンと共通部品経由で直書き色の lint が 0 件である。", "S2 (G2): 信頼度 49/50/79/80 の境界が 低/中/中/高 になり、信頼度を出す画面で段階＋% が出る。防衛ラインの値は変わらず (直近 3 か月平均)、使い方画面と用語集の説明がその算出と一致する。自動判定 (要確認の閾値 80) の結果は変わらない。", "S3 (G3): ガイドの節・よくある疑問・期間の表・このページの数値が core の guide-screen だけで導かれ、API と web はその結果を写すだけである。", "S4 (G4): ヘッダは『防衛ライン』のまま、フッタが『取込データは外部送信しません』になり、AI 実行時に集計データを渡す補足がフッタ・プライバシー欄・使い方画面の 3 か所で読める。他の利用者のデータで /api/guide が数値を返さない。"]
architecture_refs: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "画面・core の guide-screen・信頼度の段階関数・防衛ラインの算出期間の定数・GET /api/guide・共通シェルのフッタは、同じ『画面の数字の読み方と説明を core の 1 か所から導く』契約を起点に連鎖する 1 つの価値単位で、画面だけ・API だけ・段階関数だけでは『迷ったとき 1 画面で読み方と戻り道が分かる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-guide-screen.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-ogz", "linked_at": "2026-09-23T14:33:54Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:44:19Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 目的

利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、月次クローズの途中で画面の数字に迷ったとき『この数字を、どう読み・どこへ戻ればよいですか？』に /guide の 1 画面で答えを得られるようにする。今見ている数字が何を含み何を除くか・どの期間の・どこから来た値かを選択中の期間の実データで示し、つまずいたら該当の元画面へ 1 クリックで戻れるようにする。ガイドの節・現在値・信頼度の段階・防衛ラインの説明文は core の 1 か所から導き、説明と計算を画面ごとにずらさず、振替の二重計上・家計と事業の混同・信頼度や防衛ラインの誤解による判断ミスを無くす。

規範 (要件・ビジネスルール・確定意思決定・API 契約・データモデル) の正本は `specs/spec-guide-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/guide が 19-guide.png の全構成要素 (問いの見出しと説明・期間と前後移動・4 ステップ (取込む・整える・確認・計画) と各『元画面を開く』・使い方ガイド (目次 6 項目＋『用語と目安』、月次の流れステッパー、総収支の読み方の 3 枚を選択期間の実データ (振替除外) で、含まれるもの 3 枚、期間の表 4 行)・右カラム (このページの数値 4 項目・関連ページ 5 件・ガイド内を検索)・よくある疑問と対処法 5 行・下部固定バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、選択トピックと検索語が URL に残り、画面の数値と文言が core の guide-screen から出て API は { screen } に写すだけ・web は描くだけで、信頼度が 高 80 以上 / 中 50〜79 / 低 49 以下 の段階＋% で出て要確認の閾値 80 の自動判定は変わらず、防衛ラインの算出 (直近 3 か月平均) と値は変わらずにガイドと用語集の説明がその算出定数から組まれ、ヘッダは『防衛ライン』のまま・フッタ 1 文目が『取込データは外部送信しません』で AI 送信の補足が 3 か所にあり、/api/guide が利用者ごとに分離され、DB の表・列を 1 つも足さずに verify:full が緑の状態。

## スコープ

- スコープ内:
  - /guide の作り直し (19-guide.png の全構成要素と読込・空・失敗の各状態)。Guide.tsx (185 行) を packages/web/src/pages/guide/ 配下 (画面本体・view-model・4 ステップ・目次・本文の各節・右カラム・よくある疑問・下部固定バー) へ分割し、旧 pages/Guide.tsx は再輸出 1 行にする。core を import するのは view-model.ts だけ (I1、qa-guide-frontend-web-002)
  - 目次 6 項目 (月次の流れ / 総収支 / 照合 / 仕分け / 予算 / データ出典) の末尾に『用語と目安』を置き、現行の用語集・略語・ベンチマーク・データ充足度を移す (qa-guide-decision-001)
  - 選択トピックと検索語を URL (?topic=&q=) に保ち、/api/guide の問い合わせ鍵に期間を含める
  - packages/core/src/guide-screen.ts の新設。節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・ガイド内検索を純関数で導き、guide-sections.ts の現在値合成を core へ移す (I2)
  - GET /api/guide の新設。loadScoped の結果を core の guide-screen に渡して { screen } に写すだけにし、利用者ごとに分離し期間クエリを検証する (I3)
  - 期間の前後移動 shiftedPeriod を pages/statements/view-model.ts から core へ移し、決算書と使い方画面で共有する (I7)
  - core の信頼度の段階関数 (高 80 以上 / 中 50〜79 / 低 49 以下) と、信頼度を出す画面の『段階＋%』表示。対象画面の列挙は requirements で確定する (I4、qa-guide-decision-008)
  - 防衛ラインの算出期間 (直近 3 か月) を core の名前付き定数として公開し、使い方画面と用語集の説明文をその定数から組む。算出と値は変えない (I5、qa-guide-decision-009)
  - 共通シェルのフッタ 1 文目を『取込データは外部送信しません』にし、AI 実行時に集計データを渡す補足をフッタの title・プライバシー欄・使い方画面の 3 か所に置く。ヘッダは『防衛ライン』のまま (I6、qa-guide-decision-010・011)
  - core 単体・API・DOM テストと、web の check:guide-screen の verify:full への組み込み、設計判断の記録 (docs/guide-screen/ を新設)
- スコープ外:
  - 利用規約・プライバシーの専用ページ (現行の details のまま文言の補足だけ行う)
  - ガイド本文の管理画面や DB 保存 (本文は core の定数として版管理する)
  - 自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更
  - 防衛ラインの算出変更 (画像の過去年同月平均など。qa-guide-decision-009 で現行維持)
  - 共通ヘッダの呼称変更 (画像の『取引ライン』。qa-guide-decision-010 で『防衛ライン』維持)
  - サイドバーの並び・バッジ・月次クローズ進捗の変更
  - DB の表・列・migration の追加 (C2)
  - モバイル・タブレット・デスクトップ専用アプリ
  - 税務判断 (税務上の正本は freee。C4)

## 受入

- [ ] S1 (G1): /guide で 19-guide.png の構成要素がすべて描画され、総収支の 3 枚が選択期間の実データ (振替除外) と一致し、色・余白・部品はトークンと共通部品経由で直書き色の lint が 0 件である。
- [ ] S2 (G2): 信頼度 49/50/79/80 の境界が 低/中/中/高 になり、信頼度を出す画面で段階＋% が出る。防衛ラインの値は変わらず (直近 3 か月平均)、使い方画面と用語集の説明がその算出と一致する。自動判定 (要確認の閾値 80) の結果は変わらない。
- [ ] S3 (G3): ガイドの節・よくある疑問・期間の表・このページの数値が core の guide-screen だけで導かれ、API と web はその結果を写すだけである。
- [ ] S4 (G4): ヘッダは『防衛ライン』のまま、フッタが『取込データは外部送信しません』になり、AI 実行時に集計データを渡す補足がフッタ・プライバシー欄・使い方画面の 3 か所で読める。他の利用者のデータで /api/guide が数値を返さない。

受入の詳細 (core 単体・API Contract tests・DOM・描画検査・grep 検査) は `specs/spec-guide-screen.md` の「テストと受入条件」を正本とし、本書へ複製しない。

## アーキテクチャ参照

- `architecture_refs`: `arch-guide-ui-ux`, `arch-guide-frontend`, `arch-guide-backend`, `arch-guide-database`, `arch-guide-auth`, `arch-guide-security`, `arch-guide-infrastructure`, `arch-guide-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/guide-*.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-guide-screen` (feature ノードへの依存は無い)。機能間依存は なし (spec-guide-screen にだけ依存)。
- 依存理由: 信頼度の 3 段階の境界・防衛ラインを変えずに説明を合わせること・ヘッダとフッタの文言・/api/guide の { screen } の形が確定していないと、core の返り値型・API 応答・DOM テストの期待値が実装中に揺れるため。
- 既存機能との関係: `feat-statements-screen` の `shiftedPeriod` を core へ移すが決算書の挙動は変えず、既存テスト (`statements-view-model.test.ts`) を緑のまま保つだけで機能を重複させない。`feat-classify-screen` の信頼度の表示は core の段階関数の結果を描く形へ替えるだけで、要確認の閾値 80 と由来ごとの信頼度の規則は変えない。防衛ライン (`defenseLine`) を使う概況・予算・トレードオフ・ヘッダの値は変えない。
- 重複の不在: 既存 feature に使い方画面の作り直し・信頼度の段階表示・防衛ラインの説明文の一本化・フッタ文言の変更を扱うものは無い (features/ を `/guide`・`使い方`・`Guide.tsx` で検索して該当 0 件)。
- 後続: 無し。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-guide-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-guide-screen --feature-context features/feat-guide-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: exact 13 executable task specs と 13-node intra-feature DAG (task の切り方と中身は plan の責務で、本書では決めない)。
- 登録先: 全 task を同一 `parent_feature=feat-guide-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S4 の evidence が揃う場合だけ done にする。
- plan / requirements で扱う未決事項: 本書は確定事項として扱わず、`specs/spec-guide-screen.md` の「未決事項」を正本として参照する。
  - 信頼度を出す画面の列挙 (概況 `Overview.tsx` の 80/60 色境界と新しい 50 境界の衝突、診断・AI 画面の「確度」を対象に含めるか) は requirements で確定する (completeness-findings の medium)。
  - `/api/guide` の応答の細部・トピック id・検索の正規化など agent 推定・利用者未確認の値。
- resource_scope の引き方: spec の resource_scope に、設計判断の記録先 `docs/guide-screen` と web の `package.json` (check:guide-screen) を足した。信頼度を出す既存画面 (classify・Overview・OverviewReviewQueue)・決算書の view-model・共通シェル (`components/Layout.tsx`)・用語集 (`glossary.ts`) が同じ web package にあり、core の `analysis.ts` (defenseLine)・`classify-status.ts`・`period.ts` を跨ぐため、パッケージ単位で scope へ含めた。plan では各 task の scope について、export 名の呼び出し元・import している側・型で結ばれた宣言を同じ手順で引くこと。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。


## 実装結果(2026-09-23)

- 13 task(SYS-GUIDE-P01〜P13 / Beads `kanjo-ogz.1`〜`.13`)を実装した。受入 S1〜S4 の証跡は `docs/guide-screen/evidence.md`。
- 計画時の未決事項のうち、信頼度を出す画面は分類画面・要確認キュー(概況)を『段階＋%』へ替えた(RQ-F1 で利用者が承認)。要確認の閾値 80 は変えていない。
- 実装で加えたモジュール: `packages/core/src/data-notice.ts`(初期 JS 予算のための分割)、`packages/web/src/components/PeriodRange.tsx`(決算書画面と共有)。
- 残課題(画像とのピクセル照合、共通シェルの幅と FAQ の表形式の差)は `docs/product/backlog.md` に載せた。
