---
graph_node_id: "feat-settings-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "設定画面 (18-settings) の作り直しと集計ルール・現金上書き・設定 JSON・夜間バックアップの解釈の core 一本化"
project_id: "kanjo"
domain: "settings"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "norm-rules", "cash-overrides", "settings-export", "backup", "draft", "feature"]
file_path: "features/feat-settings-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fe2cb400fae7451bcb757a2d19acb671784ac694414511f169d81790dd24ad75"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-settings-screen.md", "source_version": "0.1.11", "source_digest": "2bb01f21c9b3a451f175b3ecf4d1b74cc4cf84fa73b65f9c65c18c10b93a5b9e", "imported_at": "2026-09-22T10:32:09Z"}
created_at: "2026-09-22T10:32:09Z"
updated_at: "2026-09-22T10:32:09Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-auth", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/18-settings.png", "docs/data-schema.md", "docs/settings-screen", "docs/ui-decisions.md", "migrations", "packages/api/src", "packages/api/wrangler.jsonc", "packages/core/src", "packages/core/test", "packages/web/src", "specs/spec-settings-screen.md"]
purpose: "利用者が『集計ルールと復元設定を、安全に管理しますか？』という問いに /settings の 1 画面で答え切れるようにする。勘定科目と取引先の表記ゆれを種別つきの 1 つの一覧でまとめ、右の説明パネルでそのルールが何に効き、いつ誰が変えたかを確かめて直前の保存値へ戻せ、名義・統計・現金上書きを同じ下書きで編集して 1 回で保存でき、設定だけを JSON で書き出して復元でき、毎晩の自動バックアップを状態つきで一覧して現在の設定と比べてから設定だけを戻せる状態にする。集計ルールの適用順・現金上書きの意味・設定 JSON の形式は core の純関数に固定し、設定画面・集計・書き出し・バックアップの解釈をずらさず、戻せない操作を 0 件にする。"
goal: "/settings が 18-settings.png の全構成要素 (パンくず・期間タブと期間送り・見出しと問い・節ナビ 8 項目 (集計ルール・名義・統計・現金上書き・データ・バックアップ・アカウント・その他の管理)・集計ルールの表と一括操作と並べ替え・この設定の説明パネル・名義・統計・現金上書き・データ出力 4 種と復元・バックアップの表と『自動バックアップについて』・下部の保存バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、375px 幅でも崩れず、画面に出す値が core の settingsScreen から出て web で計算し直されず、取引先ルールが 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類 の順に集計時だけ効き、現金上書きが core の現金集計 1 か所で空欄と 0 を区別して効き、全節の変更が 1 回の保存で baseSavedAt の 409 つきで確定して変更履歴が追記のみで残り、設定だけの版番号つき JSON の書き出しと復元・夜間バックアップ (JST 2:00・状態つき) の比較と設定だけの復元が動き、migration は追加のみで、画像外の既存設定機能を 1 つも消さず、外部送信 0 件で verify:full が緑の状態。"
scope_in: ["/settings の作り直し (18-settings.png の全構成要素と読込・空・失敗の各状態)。Settings.tsx (457 行) を packages/web/src/pages/settings/ 配下のページ本体・節ナビ・節ごとの部品・説明パネル・保存バー・下書き・view-model に分け、pages/Settings.tsx は互換の re-export だけ残す", "節ナビは画像の 6 節の後ろに『アカウント』『その他の管理』を足し、画像外の既存機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) を 1 つも消さずに移す (利用者決定 qa-settings-decision-004)", "集計ルール: 種別 (勘定科目 / 取引先) を持つ 1 つの一覧で、並び順・有効・更新日時・更新者を持つ。勘定科目は従来どおり取込時、取引先は集計時に適用し、保存済みの明細を書き換えない (利用者決定 qa-settings-decision-001・005)", "取引先ルールの適用順 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類、完全一致の照合と並び順での優先 (利用者決定 qa-settings-decision-005)", "現金上書き: 支払い・受け取りの 2 行に 上書き値 (空欄 = 上書きしない / 0 = 0 円で上書き)・適用範囲 (全期間 / 月指定)・メモを持たせ、core の現金集計 1 か所で実際に効かせる (利用者決定 qa-settings-decision-003)", "名義 4 名義の表示名を設定画面から編集し、検証は既存 core の validateOwnerLabels を共有する (利用者決定 qa-settings-decision-002)", "統計の最小月数の入力 (既定 6、範囲 3〜24) (利用者決定 qa-settings-decision-009)", "全節の編集を 1 つの下書きに集め、未保存件数・端末への自動保存と復元・リセットと離脱の確認・baseSavedAt による 409 を備える", "設定の変更履歴 (追記のみ) と、説明パネルの最終更新・更新者・『このルールを元に戻す』(直前の保存値を下書きへ戻す) (利用者決定 qa-settings-decision-008)", "設定だけの版番号つき JSON の書き出しと復元 (厳密な検証・サイズ上限・差分プレビュー・確認・復元直前の自動退避) (利用者決定 qa-settings-decision-006) と、データ出力 3 種 (集計マトリクス CSV・取引 CSV・レポート HTML) の選択中期間での出力と CSV の式注入の無害化", "夜間バックアップを JST 2:00 にし、状態 (成功 / 失敗)・メモ・設定部分の要約を残して失敗も一覧に出し、『比較』とバックアップからの設定だけの復元を足す (利用者決定 qa-settings-decision-007・010)", "core に設定画面の算出 settingsScreen と、集計ルールの照合と適用・現金上書きの解決・設定 JSON の検証と差分を新設し、設定系の新しい書込み API を変更系フェンスへ登録する", "追加のみの migration (番号は予定。着手時に main の最新と突き合わせる) と runtimeSchemaGuard の EXPECTED_D1_MIGRATION の更新、JSON の書き出しと復元・JSON snapshot の無効化・夜間バックアップ本文への新しい設定の表の追加", "routeMetadata の設定の task / taskDetail の文言更新、設計判断の docs (docs/settings-screen/ を新設)・docs/data-schema.md・docs/ui-decisions.md の更新と core 単体・API 統合・scheduled・migration 検査・DOM テスト"]
scope_out: ["取引データそのものの復元形式の変更 (HTML 版からの初期移行 POST /api/restore は現状のまま『その他の管理』に残す)", "既存の仕分けルール・ベンダー記憶の意味の変更 (集計ルール(取引先) はその下の優先順位に入るだけ)", "共通シェル (サイドバー・ヘッダ・フッタ) の作り直し。ヘッダの『取引ライン：正常』は既存の『防衛ライン』の表示を保つ", "外部 LLM・外部サービスへの送信 (取込データと設定を外部へ送らない。C4)", "複数テナント化・web 以外の専用アプリ (375px 幅は web のレスポンシブで扱う)", "バックアップの保持期間 (30 日) の変更", "バックアップからの全データ (取引を含む) の復元 (利用者決定 qa-settings-decision-010。設定だけを戻す)", "既存 API (GET/PUT /api/settings・GET/PUT /api/settings/owner-labels・GET /api/backups/:date・POST /api/restore・/api/export/*) の削除 (互換のため残す)", "既存表 (account_norm_map・cash_overrides) の削除・書き換え (初回の写しの元として読むだけ)"]
acceptance: ["S1 (G1): /settings に 18-settings.png の構成要素 (§7.1 の全領域) と節ナビ 8 項目が描画され、色・余白・部品はトークンと共通部品を通し、直書き色の lint が 0 件。375px 幅で崩れず、横スクロールは表の容器の中だけである。", "S2 (G2): 説明パネルの『このルールが影響するもの』・集計結果・書き出しが同じ core の関数から出て、取引先ルールの優先順位 (手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類) と現金上書きの 空欄 / 0 / 全期間 / 月指定 がテストで固定され、既存の勘定科目正規化の結果の回帰が 0 件である。", "S3 (G3): 全節の変更が 1 回の保存で確定し、古い baseSavedAt の保存は 409 で何も書かない。変更履歴は追記だけで、『このルールを元に戻す』は直前の保存値を下書きへ戻す。", "S4 (G4): 設定だけの JSON の書き出し → 復元で設定が一致し取引の件数は変わらず、不正な JSON は何も変えずに拒否される。自動バックアップが JST 2:00 に状態つきで残り、比較と設定の復元ができる。", "S5 (G5): migration は追加のみで既存行の書き換えが 0 件、外部送信が 0 件、画像外の既存設定機能が 1 つも消えず、verify:full が緑である。"]
architecture_refs: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-auth", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "画面・core の settingsScreen と集計ルール / 現金上書き / 設定 JSON の算出・設定系 API・追加のみの migration・夜間バックアップは、同じ『設定 4 種 (集計ルール・名義・統計・現金上書き) の形と意味』の契約を起点に連鎖する 1 つの価値単位で、画面だけ・API だけ・算出だけ・バックアップだけでは『設定を安全に変え、確かめ、戻せる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-settings-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:32:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# 目的

利用者が『集計ルールと復元設定を、安全に管理しますか？』という問いに /settings の 1 画面で答え切れるようにする。勘定科目と取引先の表記ゆれを種別つきの 1 つの一覧でまとめ、右の説明パネルでそのルールが何に効き、いつ誰が変えたかを確かめて直前の保存値へ戻せ、名義・統計・現金上書きを同じ下書きで編集して 1 回で保存でき、設定だけを JSON で書き出して復元でき、毎晩の自動バックアップを状態つきで一覧して現在の設定と比べてから設定だけを戻せる状態にする。集計ルールの適用順・現金上書きの意味・設定 JSON の形式は core の純関数に固定し、設定画面・集計・書き出し・バックアップの解釈をずらさず、戻せない操作を 0 件にする。

規範 (要件・ビジネスルール・確定意思決定・API 契約・データモデル) の正本は `specs/spec-settings-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/settings が 18-settings.png の全構成要素 (パンくず・期間タブと期間送り・見出しと問い・節ナビ 8 項目 (集計ルール・名義・統計・現金上書き・データ・バックアップ・アカウント・その他の管理)・集計ルールの表と一括操作と並べ替え・この設定の説明パネル・名義・統計・現金上書き・データ出力 4 種と復元・バックアップの表と『自動バックアップについて』・下部の保存バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、375px 幅でも崩れず、画面に出す値が core の settingsScreen から出て web で計算し直されず、取引先ルールが 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類 の順に集計時だけ効き、現金上書きが core の現金集計 1 か所で空欄と 0 を区別して効き、全節の変更が 1 回の保存で baseSavedAt の 409 つきで確定して変更履歴が追記のみで残り、設定だけの版番号つき JSON の書き出しと復元・夜間バックアップ (JST 2:00・状態つき) の比較と設定だけの復元が動き、migration は追加のみで、画像外の既存設定機能を 1 つも消さず、外部送信 0 件で verify:full が緑の状態。

## スコープ

- スコープ内:
  - /settings の作り直し (18-settings.png の全構成要素と読込・空・失敗の各状態)。Settings.tsx (457 行) を packages/web/src/pages/settings/ 配下のページ本体・節ナビ・節ごとの部品・説明パネル・保存バー・下書き・view-model に分け、pages/Settings.tsx は互換の re-export だけ残す
  - 節ナビは画像の 6 節の後ろに『アカウント』『その他の管理』を足し、画像外の既存機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) を 1 つも消さずに移す (利用者決定 qa-settings-decision-004)
  - 集計ルール: 種別 (勘定科目 / 取引先) を持つ 1 つの一覧で、並び順・有効・更新日時・更新者を持つ。勘定科目は従来どおり取込時、取引先は集計時に適用し、保存済みの明細を書き換えない (利用者決定 qa-settings-decision-001・005)
  - 取引先ルールの適用順 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類、完全一致の照合と並び順での優先 (利用者決定 qa-settings-decision-005)
  - 現金上書き: 支払い・受け取りの 2 行に 上書き値 (空欄 = 上書きしない / 0 = 0 円で上書き)・適用範囲 (全期間 / 月指定)・メモを持たせ、core の現金集計 1 か所で実際に効かせる (利用者決定 qa-settings-decision-003)
  - 名義 4 名義の表示名を設定画面から編集し、検証は既存 core の validateOwnerLabels を共有する (利用者決定 qa-settings-decision-002)
  - 統計の最小月数の入力 (既定 6、範囲 3〜24) (利用者決定 qa-settings-decision-009)
  - 全節の編集を 1 つの下書きに集め、未保存件数・端末への自動保存と復元・リセットと離脱の確認・baseSavedAt による 409 を備える
  - 設定の変更履歴 (追記のみ) と、説明パネルの最終更新・更新者・『このルールを元に戻す』(直前の保存値を下書きへ戻す) (利用者決定 qa-settings-decision-008)
  - 設定だけの版番号つき JSON の書き出しと復元 (厳密な検証・サイズ上限・差分プレビュー・確認・復元直前の自動退避) (利用者決定 qa-settings-decision-006) と、データ出力 3 種 (集計マトリクス CSV・取引 CSV・レポート HTML) の選択中期間での出力と CSV の式注入の無害化
  - 夜間バックアップを JST 2:00 にし、状態 (成功 / 失敗)・メモ・設定部分の要約を残して失敗も一覧に出し、『比較』とバックアップからの設定だけの復元を足す (利用者決定 qa-settings-decision-007・010)
  - core に設定画面の算出 settingsScreen と、集計ルールの照合と適用・現金上書きの解決・設定 JSON の検証と差分を新設し、設定系の新しい書込み API を変更系フェンスへ登録する
  - 追加のみの migration (番号は予定。着手時に main の最新と突き合わせる) と runtimeSchemaGuard の EXPECTED_D1_MIGRATION の更新、JSON の書き出しと復元・JSON snapshot の無効化・夜間バックアップ本文への新しい設定の表の追加
  - routeMetadata の設定の task / taskDetail の文言更新、設計判断の docs (docs/settings-screen/ を新設)・docs/data-schema.md・docs/ui-decisions.md の更新と core 単体・API 統合・scheduled・migration 検査・DOM テスト
- スコープ外:
  - 取引データそのものの復元形式の変更 (HTML 版からの初期移行 POST /api/restore は現状のまま『その他の管理』に残す)
  - 既存の仕分けルール・ベンダー記憶の意味の変更 (集計ルール(取引先) はその下の優先順位に入るだけ)
  - 共通シェル (サイドバー・ヘッダ・フッタ) の作り直し。ヘッダの『取引ライン：正常』は既存の『防衛ライン』の表示を保つ
  - 外部 LLM・外部サービスへの送信 (取込データと設定を外部へ送らない。C4)
  - 複数テナント化・web 以外の専用アプリ (375px 幅は web のレスポンシブで扱う)
  - バックアップの保持期間 (30 日) の変更
  - バックアップからの全データ (取引を含む) の復元 (利用者決定 qa-settings-decision-010。設定だけを戻す)
  - 既存 API (GET/PUT /api/settings・GET/PUT /api/settings/owner-labels・GET /api/backups/:date・POST /api/restore・/api/export/*) の削除 (互換のため残す)
  - 既存表 (account_norm_map・cash_overrides) の削除・書き換え (初回の写しの元として読むだけ)

## 受入

- [ ] S1 (G1): /settings に 18-settings.png の構成要素 (§7.1 の全領域) と節ナビ 8 項目が描画され、色・余白・部品はトークンと共通部品を通し、直書き色の lint が 0 件。375px 幅で崩れず、横スクロールは表の容器の中だけである。
- [ ] S2 (G2): 説明パネルの『このルールが影響するもの』・集計結果・書き出しが同じ core の関数から出て、取引先ルールの優先順位 (手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類) と現金上書きの 空欄 / 0 / 全期間 / 月指定 がテストで固定され、既存の勘定科目正規化の結果の回帰が 0 件である。
- [ ] S3 (G3): 全節の変更が 1 回の保存で確定し、古い baseSavedAt の保存は 409 で何も書かない。変更履歴は追記だけで、『このルールを元に戻す』は直前の保存値を下書きへ戻す。
- [ ] S4 (G4): 設定だけの JSON の書き出し → 復元で設定が一致し取引の件数は変わらず、不正な JSON は何も変えずに拒否される。自動バックアップが JST 2:00 に状態つきで残り、比較と設定の復元ができる。
- [ ] S5 (G5): migration は追加のみで既存行の書き換えが 0 件、外部送信が 0 件、画像外の既存設定機能が 1 つも消えず、verify:full が緑である。

受入の詳細 (AT-01〜AT-22) は `specs/spec-settings-screen.md` の「受入条件」を正本とし、本書へ複製しない。

## アーキテクチャ参照

- `architecture_refs`: `arch-settings-ui-ux`, `arch-settings-frontend`, `arch-settings-backend`, `arch-settings-database`, `arch-settings-auth`, `arch-settings-security`, `arch-settings-infrastructure`, `arch-settings-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/settings-*.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-settings-screen` (feature ノードへの依存は無い)。機能間依存は なし (spec-settings-screen にだけ依存)。
- 依存理由: 集計ルールの 2 種別と適用順・現金上書きの空欄 / 0 と適用範囲・設定 JSON の範囲 (設定 4 種だけ)・バックアップからは設定だけを戻すこと・変更履歴と『元に戻す』の意味が確定していないと、core の返り値型・API 応答・migration の列・テストの期待値が実装中に揺れるため。
- 既存機能との関係: 名義の表示名 (`owner_labels`・`validateOwnerLabels`・家計収支画面の名義ラベル編集) とパスワード変更・利用者管理は既に main にある既存機能で、本 feature はそれを共有・移設するだけで意味を変えない。`feat-household-cashflow`・`feat-account-login` とは既存のテスト (`owner-labels.integration.test.ts` 等) が緑のままであることを確かめるだけで機能を重複させない。予算の `budget_plans` (0050) は main に入っており、本 feature の migration はその後ろの番号を使う。
- 重複の不在: 既存 feature に設定画面の作り直し・集計ルール・現金上書きの集計への反映・設定 JSON・夜間バックアップの状態を扱うものは無い。
- 後続: 無し。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-settings-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-settings-screen --feature-context features/feat-settings-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: exact 13 executable task specs と 13-node intra-feature DAG (task の切り方と中身は plan の責務で、本書では決めない)。
- 登録先: 全 task を同一 `parent_feature=feat-settings-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- plan / requirements で扱う未決事項: 本書は確定事項として扱わず、`specs/spec-settings-screen.md` の「未決事項」と「実装時に要確認」を正本として番号だけ参照する。
  - 未決事項: Q-1, Q-2, Q-3, Q-4, Q-5, Q-6, Q-7, Q-8, Q-9, Q-10, Q-11, Q-12
  - 実装時に要確認: R-1, R-2, R-3, R-4, R-5, R-6, R-7
  - migration 番号 (0051 から) は予定番号で、着手時に `origin/main` を fetch し直して最新番号と突き合わせる。
- resource_scope の引き方: spec の resource_scope に、core の新設テストの置き場 `packages/core/test` を足した。既存の設定は `routes/settings.ts`・`store.ts`・`import-lifecycle.ts`・`import-active.ts`・`index.ts` (夜間バックアップ)・`wrangler.jsonc` (cron) から読み書きされ、既存 DOM テスト (`settings-restore.dom.test.tsx`・`backup-restore.dom.test.tsx`) が `pages/Settings.tsx` を import しているため、パッケージ単位で scope へ含めた。plan では各 task の scope について、export 名の呼び出し元・import している側・型で結ばれた宣言を同じ手順で引くこと。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
