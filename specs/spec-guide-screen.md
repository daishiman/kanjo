---
graph_node_id: "spec-guide-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api"]
title: "使い方画面 再現仕様 (19-guide.png)"
project_id: "kanjo"
domain: "guide"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "help"]
file_path: "specs/spec-guide-screen.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/19-guide.png"
route: "/guide"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f98f279826872e15be041b98f2eeae88e1b0254b3f33432e3a9ccf411047b129"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "f98f279826872e15be041b98f2eeae88e1b0254b3f33432e3a9ccf411047b129", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: []
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "packages/web/scripts", "package.json", "design/FINAL-UI/images/19-guide.png"]
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
classification_reason: "design/FINAL-UI/images/19-guide.png と利用者決定 qa-guide-decision-001〜011 (上位概念の承認は最新が appr-foundation-guide-003。先行する appr-foundation-guide-001・002) から確定した使い方画面の再現仕様。利用者が決めていない値は agent の推定として本文で個別に注記した。"
classification_candidates: [{"artifact_kind":"specification","confidence":1.0,"candidate_path":"specs/spec-guide-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"not_applicable","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 使い方画面 再現仕様

正本の画像は `design/FINAL-UI/images/19-guide.png`、経路は `/guide`。上位の要件は `system-spec/00-requirements-definition.md` (U1-U9。利用者決定 qa-guide-decision-001〜011。上位概念の承認は最新が appr-foundation-guide-003 (2026-09-23T13:13:46Z、qa-guide-decision-008〜011 を反映した差分の承認) で、先行する appr-foundation-guide-001・002 を引き継ぐ) とカテゴリ別の章 (ui-ux / frontend / backend / database / auth / security / infrastructure / maintenance-ops) にある。本書はそれらを 1 画面の実装単位へ落とした仕様で、画像のどの文言をそのまま再現し、どの値を期待値にしないかを明示する。

注記の約束: 利用者が決めた値は決定 ID (qa-guide-decision-00N、または user-decision の質疑 ID) を添える。system-spec の agent 推定 (qa-guide-*-web-003・qa-guide-backend-web-004、basis=agent-inference) から引いた値と、画像にも決定にも値が無く実装の決定論のために本書で置いた値は **「agent 推定・利用者未確認」** と明記する。

行番号は 2026-09-23 時点の現物で確かめた値である。

## 目的と成功状態

目的: 利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、月次クローズの途中で画面の数字に迷ったとき、『この数字を、どう読み・どこへ戻ればよいですか？』に 1 画面で答えを得られるようにする。今見ている数字が何を含み何を除くか・どの期間の・どこから来た値かを選択中の期間の実データで示し、つまずいたら該当の元画面へ 1 クリックで戻れるようにする。振替の二重計上・家計と事業の混同・信頼度や防衛ラインの誤解による判断ミスと、迷って作業が止まることを無くす (U1)。

成功状態:

- `/guide` が 問いの見出し・期間と前後移動・4 ステップと『元画面を開く』・使い方ガイド (目次 6 項目＋『用語と目安』、月次の流れ、総収支の読み方、含まれるもの 3 枚、期間の表 4 行)・右カラム (このページの数値・関連ページ・ガイド内を検索)・よくある疑問と対処法 5 行・下部固定バー で描画され、総収支の 3 枚が選択期間の実データ (振替除外) と一致する (G1、S1)。
- 信頼度が 49/50/79/80 の境界で 低/中/中/高 になり、信頼度を出す画面で『段階＋%』が出る。要確認の閾値 80 による自動判定の結果は変わらない。防衛ラインの値は変わらず、使い方画面と用語集の説明がその算出 (直近 3 か月平均) と一致する (G2、S2、qa-guide-decision-008 / 009)。
- ガイドの節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・検索が `packages/core/src/guide-screen.ts` だけで導かれ、API と web はその結果を写すだけである (G3、S3)。
- ヘッダは『防衛ライン』のまま、フッタ 1 文目が『取込データは外部送信しません』になり、AI 実行時に集計データを渡す補足がフッタの title・プライバシー欄・使い方画面の 3 か所で読める。他の利用者のセッションで `/api/guide` がこの利用者の数値を返さない (G4、S4、qa-guide-decision-010 / 011)。

## スコープ

対象 (in):

- 使い方画面の作り直し。`packages/web/src/pages/Guide.tsx` (現行 185 行の 1 ファイル) を `packages/web/src/pages/guide/` 配下 (画面本体・view-model・4 ステップ・目次・本文の各節・右カラム・よくある疑問・下部固定バー) へ分割し、旧 `pages/Guide.tsx` は再輸出 1 行にする (I1、qa-guide-frontend-web-002)。
- 目次 6 項目 (月次の流れ / 総収支 / 照合 / 仕分け / 予算 / データ出典) の末尾に『用語と目安』を置き、現行の用語集・略語・ベンチマーク・データ充足度をそこへ移す (qa-guide-decision-001)。
- `packages/core/src/guide-screen.ts` の新設。節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・ガイド内検索を純関数で導き、`guide-sections.ts` の現在値合成を core へ移す (I2、qa-guide-backend-web-002)。
- API: `GET /api/guide` の新設 (I3)。
- 期間の前後移動 `shiftedPeriod` を `pages/statements/view-model.ts:121` から core へ移し、決算書と使い方画面で共有する (I7)。
- core の信頼度の段階関数 (高 80 以上 / 中 50〜79 / 低 49 以下) と、信頼度を出す画面の『段階＋%』表示 (I4、qa-guide-decision-005 / 008)。対象画面の列挙は「未決事項」を参照。
- 防衛ラインの算出期間 (直近 3 か月) を core の名前付き定数として公開し、使い方画面と用語集の説明文をその定数から組む (I5、qa-guide-decision-009)。
- 共通シェルのフッタ 1 文目の変更と AI 送信の補足 3 か所 (I6、qa-guide-decision-011)。
- core・API・DOM テストと、web の `check:guide-screen` の verify:full への組み込み (qa-guide-maintenance-ops-web-001)。

対象外 (out):

- 利用規約・プライバシーの専用ページ。現行の details のまま文言の補足だけ行う。
- ガイド本文の管理画面や DB 保存。本文は core の定数として版管理する (qa-guide-database-web-002)。
- 自動判定 (要確認の閾値 `REVIEW_CONFIDENCE_THRESHOLD = 80`、`packages/core/src/classify-status.ts:43`・由来ごとの信頼度) の規則変更。
- 防衛ラインの算出変更 (画像の「過去年同月平均」など)。現行の直近 3 か月平均を維持する (qa-guide-decision-009)。
- 共通ヘッダの呼称変更 (画像の『取引ライン』)。『防衛ライン』を維持する (qa-guide-decision-010)。
- サイドバーの並び・バッジ・月次クローズ進捗の変更。
- DB の表・列・migration の追加 (C2)。
- モバイル・タブレット・デスクトップ専用アプリ (qa-guide-target-platforms-001)。
- 税務判断。税務上の正本は freee である (C4)。

## 用語と主体

| 用語 | 意味 |
| --- | --- |
| トピック | 目次の 1 項目。id は `flow` (月次の流れ) / `totals` (総収支) / `reconcile` (照合) / `classify` (仕分け) / `budget` (予算) / `sources` (データ出典) / `terms` (用語と目安) の 7 つ (id の綴りは **agent 推定・利用者未確認**)。URL の `topic` に持つ。 |
| 総収支 | 選択期間の 総収入 − 総支出 = 純収支。振替 (口座間の資金移動) を除く既存の集計結果をそのまま使い、新しい集計をしない (C2)。 |
| このページの数値 | 右カラムの 4 項目: 選択中の期間・期間の定義・データの出所・最終更新。 |
| 信頼度の段階 | 仕分けの確からしさ (0〜100 の %) を 高 (80 以上) / 中 (50〜79) / 低 (49 以下) に分けたもの。段階を主、% を副に『高 92%』と出す (qa-guide-decision-008)。 |
| 防衛ライン | 個人生活費の直近 3 か月平均＋事業固定費の平均。`packages/core/src/analysis.ts:1093` の `defenseLine`。算出は変えない (qa-guide-decision-009)。 |
| 元画面 | ガイドの各項目が指す、実際に数字を直す画面 (取込・明細仕分け・照合・予算・総収支・設定・収支分析)。 |
| 期間 | 共通の期間 (`usePeriod`、1年 / 2年 / 3年 / 任意)。サイト全体で共通。 |

主体:

- 利用者: セッション cookie で認証された本人。画面の全操作を行う (SH1)。
- 家族: 家計と事業の範囲の説明が正しいことを、利用者を通じて確かめる (SH2)。画面は操作しない。
- 保守者: 同一人物とコーディングエージェント。規則を core とテストで読む。

## ユースケースとユーザーフロー

1. 流れを掴む: `/guide` を開く → 問いの見出しと 4 ステップ (取込む・整える・確認・計画) を読む → 迷っている段の『元画面を開く →』で該当画面へ移る。
2. 総収支を読み解く: 目次の『総収支』→ 選択期間の 総収入 − 総支出 = 純収支 が実データで出る → 含まれるもの 3 枚 (何が含まれる？ / 振替は除外 / freee の権限) で範囲を確かめる → 下部固定バーの『総収支を開く →』で元画面へ。
3. 期間を変えて比べる: 期間タブ (1年 / 2年 / 3年 / 任意) か前後の矢印で期間を変える → 総収支の 3 枚と「このページの数値」が同じ期間で更新される。期間の表で各期間の表示の違いを読む。
4. 疑問から辿る: 「よくある疑問と対処法」で自分の疑問の行を読む → データの出所・確認の条件を確かめる → 行末の『〇〇を開く』で元画面へ。
5. 探す: 右カラムの「ガイド内を検索」に『振替』などを入れる → 目次・本文・よくある疑問が部分一致で絞られる。検索語は URL に残り、再読込や共有で同じ結果に戻る。
6. 用語を引く: 目次末尾の『用語と目安』→ 用語集・略語の読み方・ベンチマーク・データ充足度を読む。
7. 月次の進み具合を見る: 月次の流れのステッパーで完了した段と残りの段を見る。

## 機能要件

- FR-1 期間: 共通の期間タブ (1年 / 2年 / 3年 / 任意) と範囲表示、前後の矢印。前後移動は core へ移した `shiftedPeriod` を使い、全期間とデータ範囲の外へ出る向きでは矢印を無効にする (I7)。`/api/guide` に渡す期間は `usePeriod` の値と同じである。
- FR-2 見出し: タイトル「使い方」、問いの見出し「この数字を、どう読み・どこへ戻ればよいですか？」、説明「Focus Ledger の見方と、つまずきやすいポイントを、実際の画面に戻りながら確認できます。」を画像どおりに出す。
- FR-3 4 ステップ: 「取込む / データを集める / 銀行・カード・レシートなどの取引データを取り込みます。」「整える / 仕訳・分類で整理 / 取引を正しいカテゴリに仕訳し、不要なものを除きます。」「確認 / 状況を見る&診断する / 収入・支出の状態を確認し、疑問点を解消します。」「計画 / 次の一手を考える / 予算を設定し、今後の見通しをシミュレーションします。」と、各段の『元画面を開く →』。行き先は 取込む→データ取込、整える→明細仕分け、確認→総収支、計画→予算 (**agent 推定・利用者未確認**)。
- FR-4 目次: 「月次の流れ / 総収支 / 照合 / 仕分け / 予算 / データ出典」と末尾の『用語と目安』の 7 項目 (qa-guide-decision-001)。選択中の項目を示し、URL の `topic` に持つ。幅 1024px 以上で左に固定、それ未満で本文の上の横スクロールのタブ (qa-guide-ui-ux-web-003、**agent 推定・利用者未確認**)。
- FR-5 月次の流れ: 「毎月のクローズ作業で、数字を確認し、次のアクションにつなげる流れです。」と、取込 / 整える / 確認 / 月次レビュー のステッパー。4 段目は `monthlyCloseStatus.steps` の `review` の完了を表し、上段の行動案内「計画」と区別する。完了した段は実進捗で塗り、完了を文字の印でも示す (塗り方は qa-guide-ui-ux-web-003 の **agent 推定・利用者未確認**)。
- FR-6 総収支の読み方: 「選択した期間の、収入・支出・純収支のバランスを示す最も基本的な指標です。」と、総収入 − 総支出 = 純収支 の 3 枚。金額は `/api/guide` の `totals` を出し、純収支は符号つき。
- FR-7 含まれるもの 3 枚: 「何が含まれる？ / 家計・事業の収入と支出（振替を除く）」「振替は除外 / 口座間の資金移動（振替）は収入・支出に含みません」「freee の権限 / ご自身のfreeeアカウントの参照権限の範囲で取得したデータのみを集計します」。
- FR-8 期間の表: 見出し「期間の切り替えによる表示の違い」、列「期間 / 表示内容」、4 行 (1年 / 2年 / 3年 / 任意)。表示内容は画像の文言どおり。選択中の期間の値は右カラムへ集約し、表の「1年」行には別の長さの期間を注記しない。
- FR-9 このページの数値: 「選択中の期間」(ラベルと年数)・「期間の定義」(「{開始日} 〜 {終了日}の取引データを集計しています。」)・「データの出所」(「freeeから取得した取引データ（振替は除く）」)・「最終更新」(取込の確定時刻の最大、`analytics.ts:225-228` と同じ導出)。
- FR-10 関連ページ: 総収支 / 明細仕分け / 照合 / 設定 / 収支分析 の 5 件を画像の順でリンクにする。
- FR-11 ガイド内を検索: placeholder「使い方のキーワードを検索」、例「振替、重複、信頼度、予算」。目次の見出し・本文・よくある疑問の文言を部分一致で絞る。一致した目次のうち選択中の項目を本文と下部バーにも反映し、選択中の項目が外れたら最初の一致へ移る。疑問だけが一致した場合は本文にその旨を示し、0 件なら「該当するガイドがありません」と例を出す (qa-guide-ui-ux-web-003、**agent 推定・利用者未確認**)。検索はブラウザ内の core の関数で行い、サーバへ送らない (qa-guide-security-web-001)。検索語は URL の `q` に持つ。
- FR-12 よくある疑問と対処法: 説明「つまずきやすいポイントと、確認方法をまとめました。」、列「疑問 / データの出所 / 確認の条件 / 関連ページ」、5 行 (「UI・状態遷移」の表)。防衛ラインの行の「確認の条件」は core の算出定数から組んだ説明に置き換える (qa-guide-decision-009)。信頼度の行の「確認の条件」は core の段階定数から「高 (80 以上)・中 (50〜79)・低 (49 以下) の3段階で表示」と組む (qa-guide-decision-008、文の組み方は **agent 推定・利用者未確認**)。
- FR-13 下部固定バー: 表示中のトピックがあるとき画面下に固定し、左に「現在のトピック {名前}」、右に対応する元画面へのボタン「{画面名}を開く →」。検索で本文に一致するトピックが無いときは表示しない。対応は 月次の流れ・総収支→総収支、照合→照合、仕分け→明細仕分け、予算→予算、データ出典→データ取込、用語と目安→収支分析 (qa-guide-ui-ux-web-003、**agent 推定・利用者未確認**)。
- FR-14 用語と目安: 現行の用語集 (`GUIDE_SECTIONS`、`glossary.ts:448`)・略語の読み方 (`ABBREVIATIONS`)・ベンチマーク表・データ充足度チェックを移し、全用語を 1 度ずつ出し続ける (check-glossary、qa-guide-maintenance-ops-web-001)。
- FR-15 AI 送信の補足: 使い方画面のデータ出典の節に「AI 実行時は、確認した集計データを選択した AI へ渡します」を出す (3 か所の 1 つ、qa-guide-decision-011。文言は **agent 推定・利用者未確認**)。
- FR-16 信頼度の段階表示: core の段階関数の結果を『高 92%』の形 (段階を主、% を副) で出す。段階は色だけで伝えず文字で示す (qa-guide-decision-008)。
- FR-17 URL: `topic` と `q` を URL の検索パラメータに持ち、再読込と共有で同じ表示に戻す (qa-guide-frontend-web-002)。未知の `topic` は『月次の流れ』に倒し、検索結果から外れた `topic` は先頭の一致へ正規化する。`q` は 100 字で切る (qa-guide-security-web-003、**agent 推定・利用者未確認**)。

## 非機能要件

- 性能: 画面は既存どおり遅延読み込み (`AuthenticatedApp.tsx:39`) し、初期 JS 予算 110KiB (`check:js-budget`) を超えない (O4)。`/api/guide` は `loadScoped` の `loadDataset` 1 回だけで作る。
- 可用性: `/api/guide` が失敗しても本文 (core の定数) は描き、数値の枠だけを読み込み失敗として示す (infrastructure 章の上流指針)。期間切替中は前期間の数値を新期間の値として表示せず、読込状態にする。
- アクセシビリティ: 状態を色だけで伝えない。信頼度は段階の文字と %、ヘッダの防衛ラインは『正常 / 注意 / 要対応』の文字、ステッパーは完了の段に文字の印、純収支は符号で示す (ui-ux 章の上流指針)。
- レスポンシブ: 幅 1024px 未満で目次を本文の上の横スクロールのタブへ変え、右カラムを本文の下へ積み、下部固定バーに安全領域の余白を足す (frontend 章の上流指針)。表は横スクロールの容器に入れる。
- 保守性: 規則 (節・ステップ・よくある疑問・期間の表・このページの数値・検索・信頼度の段階・防衛ラインの説明文) を core の 1 か所に置き、web と api に同じ導出を重複させない (O3)。
- 見た目: 直書き色 0。色はデザイントークン、ボタンは共通 Button、ページは PageShell と `PageHeader route="guide"`。

## UI・状態遷移

### 画面骨格

`/guide` の 1 経路。上から次の順に並べる (qa-guide-ui-ux-web-002)。

1. 共通の期間タブ: 「1年 / 2年 / 3年 / 任意」と、前後の矢印つきの範囲表示。
2. タイトル「使い方」、問いの見出し、説明 1 行。
3. 4 ステップ (取込む・整える・確認・計画) と各『元画面を開く →』。
4. 使い方ガイド: 左に目次 7 項目、中央に選択中のトピックの本文 (月次の流れ・総収支の読み方・含まれるもの 3 枚・期間の表)、右カラムに このページの数値・関連ページ・ガイド内を検索。
5. よくある疑問と対処法 (5 行の表)。
6. 下部固定バー (現在のトピックと元画面へのボタン)。

### よくある疑問と対処法の 5 行

| 疑問 | データの出所 | 確認の条件 | 関連ページ |
| --- | --- | --- | --- |
| なぜ重複候補があるのか？ | 銀行・カード明細とfreeeの取引 | 同額・同方向のfreee取引が±3日以内に1件あり、発生日か取込月にずれがある | 照合を開く |
| 信頼度は何を意味するか？ | 取引内容・過去の仕分け履歴・AIによる判定 | 高 (80 以上)・中 (50〜79)・低 (49 以下) の3段階＋%で表示 (core の段階定数から組む) | 明細仕分けを開く |
| 家計・事業の範囲はどう分けている？ | freeeの口座・取引先分類 | 事業用に分類された口座・取引先は事業として集計 | 設定を開く |
| 防衛ラインとは何か？ | 過去の収支データ | 個人生活費の直近3か月平均＋事業固定費の平均 (core の算出定数から組む。画像の「同期間の過去データとの比較」は採らない、qa-guide-decision-009) | 収支分析を開く |
| 取込・仕分けの誤りを修正するには？ | 取込データ・手動入力 | 該当の取引を修正後、再集計が反映される | データ取込を開く |

### 共通シェルの変更

| 箇所 | 現行 (2026-09-23 時点の現物) | 変更後 |
| --- | --- | --- |
| ヘッダ | 『防衛ライン：正常 / 注意 / 要対応』(`Layout.tsx:430-449`、Term 付きの語は :434) | 変えない (qa-guide-decision-010) |
| フッタ 1 文目 | 「アプリからは自動送信しません。AI実行時は確認した集計データを選択したAIへ渡します」(`Layout.tsx:498`) | 「取込データは外部送信しません」。title 属性に AI 送信の補足を持つ (qa-guide-decision-011) |
| プライバシー欄 | 「取り込んだ明細は収支管理と復元のためにだけ使用します。」 | 同文に AI 送信の補足を続ける (qa-guide-decision-011) |
| フッタ 2・3 文目 | 「税務上の正本はfreeeです」「毎晩バックアップ(30日保持)」 | 変えない (画像の「税務上の正確性はfreee」「毎晩バックアップ」は期待値にしない。決定 011 は 1 文目だけを対象とする) |

補足の文言は「AI 実行時は、確認した集計データを選択した AI へ渡します」とする (現行 1 文目の後半を引き継ぐ。**agent 推定・利用者未確認**)。

### URL のキー

| キー | 値 | 既定 |
| --- | --- | --- |
| `topic` | トピック id 7 つのいずれか | `flow` (月次の流れ) |
| `q` | 検索語 (100 字で切る) | 空 |

期間は既存の `usePeriod` の保持方法のままとし、本画面で新しいキーを足さない。キー名 `topic` / `q` は qa-guide-frontend-web-002 の確定、既定と切り詰めは qa-guide-security-web-003 の **agent 推定・利用者未確認**。

### 読込・空・失敗の状態

| 状態 | 表示 |
| --- | --- |
| 読込中・期間切替中 | 本文 (core の定数) は描き、総収支の 3 枚・このページの数値・ステッパーの進捗だけを骨組み表示にする。前期間の数値は表示しない。 |
| データ 0 件 | 総収支は ¥0、このページの数値の最終更新は「未取込」、4 ステップの『取込む』を強調する (**agent 推定・利用者未確認**)。 |
| 失敗 | 数値の枠に「取得できませんでした」と再読込を出し、本文・目次・検索は使える (現行 `guide.dom.test.tsx` の「取得できませんでした」を引き継ぐ)。 |
| 疑問だけ一致 | 目次と本文には一致するトピックがない旨を示し、よくある疑問だけを表示する。下部固定バーは出さない。 |
| 検索 0 件 | 「該当するガイドがありません」と例 (振替・重複・信頼度・予算)。無関係な本文と下部固定バーは出さない。 |

### 画像の値のうち期待値にしないもの

- ヘッダの「取引ライン：正常」: 『防衛ライン』のまま (qa-guide-decision-010)。
- よくある疑問の防衛ラインの「同期間の過去データとの比較で自動計算」: 採らず、直近 3 か月平均の説明に置き換える (qa-guide-decision-009)。
- 総収支の金額 (¥1,248,000 / ¥892,400 / +¥355,600)、期間 (2025年9月 - 2026年8月)、最終更新 (2026年9月10日 10:24): 画像の例示であり、実データで置き換える。
- サイドバーのバッジ 3 / 12 / 2 / 5 と月次クローズの 3/4、ステッパーの完了 3 段: 実データの値を出す。
- フッタの「税務上の正確性はfreee」「毎晩バックアップ」: 現行文言のまま。
- 範囲表示の区切り「-」: 共通の期間部品の既存表示に従う (core の `periodLabel` は「〜」)。

## ビジネスルールと検証

### 信頼度の段階 (qa-guide-decision-008)

- `confidence >= 80` が高、`50 <= confidence <= 79` が中、`confidence <= 49` が低。境界は core の名前付き定数に置き、段階関数は 1 つだけにする。関数名・定数名は **agent 推定・利用者未確認**。
- % は 0〜100 の整数で出す。範囲外・非数は段階を出さず「—」とする (**agent 推定・利用者未確認**)。
- 要確認の閾値 `REVIEW_CONFIDENCE_THRESHOLD = 80` (`classify-status.ts:43`) は変えない。高の下限 80 と同じ値だが、別の定数として持つか共有するかは実装で決め、単体テストで両者が 80 であることを固定する。

### 防衛ラインの説明 (qa-guide-decision-009)

- 算出は `analysis.ts:1093` の `defenseLine` のまま。現物は `pMonths.slice(-3)` (`analysis.ts:1095`) の直書きで、この 3 を core の名前付き定数へ置き換えて公開する (値は変えない)。
- 使い方画面 (よくある疑問・用語と目安) と用語集 (`glossary.ts:45-49` の defenseLine の説明、現物は「個人生活費の直近3ヶ月平均+事業固定費」の直書き) の説明文を、その定数から組む。
- `/defense-line` の応答、`/summary` の `defense`、予算・トレードオフ・ヘッダの表示は変えない。`/api/guide` は防衛ラインの値を計算しない (qa-guide-backend-web-004)。

### 総収支

- 総収入・総支出・純収支は選択期間の既存の集計結果 (振替除外) を使う。core の既存の導出 (総収支画面と同じ関数) を呼び、新しい集計規則を足さない (C2。どの関数を呼ぶかは **agent 推定・利用者未確認**)。
- 純収支 = 総収入 − 総支出。総収支画面の同じ期間の値と一致することをテストで固定する。

### 期間の表とこのページの数値

- 期間の表の 4 行は core の定数。選択中の期間は「このページの数値」に表示し、表には重ねない。
- 「期間の定義」の開始日は選択期間の最初の月の 1 日、終了日は最後の月の末日。全期間のときは「すべての取引データを集計しています。」(**agent 推定・利用者未確認**)。
- 「最終更新」は取込の確定時刻 (`committedAt`) の最大。取込が無ければ「未取込」。

### 検索 (qa-guide-security-web-003)

- 対象は目次の見出し・本文・よくある疑問の文言。部分一致で、全角半角と大小を同一視する (正規化の範囲は **agent 推定・利用者未確認**)。
- 検索語は 100 字で切り、React のテキストとして描き HTML として解釈しない。

## API契約

共通: 経路は `/api/*` のセッション認証 (authGuard、`packages/api/src/index.ts:107`) と `mustChangePasswordFence` (`index.ts:109`) の内側に載り、`loadScoped` が `c.get('userId')` (`analytics.ts:105`) で絞った Dataset だけを読む (qa-guide-auth-web-001)。エラーの形は既存どおり `{ "error": { "code": string, "message": string } }`。書き込みは無い。

### GET /api/guide

#### 識別と目的

使い方画面の数値 (選択期間・総収支・最終更新・データの出所・月次の流れの進捗) を core の `guide-screen` で組み、`{ screen }` の 1 形で返す (I3、qa-guide-backend-web-002)。

#### 認証・認可

セッション cookie。利用者自身の Dataset だけ。新しい権限や役割は作らない。一時パスワードの利用者は `mustChangePasswordFence` で届かない。

#### Request

既存の期間クエリ (`from` / `to`、`year`、`span`) を `resolvePeriodQuery` (`packages/core/src/period.ts:198`) に通す。body なし。

#### Response

200 `{ "screen": GuideScreen }`。`GuideScreen` は `period` (applied・label・定義文)・`totals` (income・expense・net、振替除外)・`dataUpdatedAt`・`sources` (データの出所の文言)・`closeStatus` (月次の流れの進捗) を持つ (qa-guide-backend-web-004、**agent 推定・利用者未確認**)。節・よくある疑問の本文は core の定数で web も同じ定数を読むが、数値は必ずこの応答の値を使う。

#### Validation・ビジネスルール

- 壊れた期間指定は 400 にせず全期間に倒す (既存方針、qa-guide-security-web-001)。
- 防衛ラインの値を計算しない。
- 取込が 0 件でも 200 で、totals は 0、`dataUpdatedAt` は null。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 401 | unauthorized | セッションが無い・切れた | no | 既存の locked 表示へ |
| 403 | password_change_required | 一時パスワードの利用者 | no | 既存のパスワード変更へ |
| 503 | schema_unavailable | runtimeSchemaGuard が止める | yes | 時間をおいて再試行 |

401 / 403 / 503 の code は既存のミドルウェアの値 (`auth.ts:242` の unauthorized、`auth.ts:297` の password_change_required、`schema-guard.ts:7` の schema_unavailable) に従う。本書は新しい code を足さない。

#### 実行セマンティクス

`loadScoped` (`analytics.ts:102-123`) の 1 回の `loadDataset` で期間を切った data と全期間の all を得て、最終更新と進捗は `/overview` と同じ `loadCloseStatus` (`analytics.ts:203`) で読み、core の `guide-screen` に渡して JSON に写す。読み取りだけで D1 への書き込みは 0。`loadCloseStatus` に渡す項目 (`items`) の取り方は **agent 推定・利用者未確認** で、/overview と同じ導出を使う。

#### キャッシュ・ページング

N/A: ページングしない。画面は TanStack Query の問い合わせ鍵に期間を含め (qa-guide-frontend-web-002)、取込・仕分けの後の既存の無効化で読み直される。HTTP キャッシュ見出しは既存の集計経路と同じ扱い。

#### 可観測性と監査

失敗は既存の API エラーログの流儀で code を残す。金額と利用者 id はログに出さない。検索語はサーバに届かないので記録されない。

#### セキュリティ確認

userId で絞った Dataset だけを読む。期間クエリは既存の検証を通す。CSP (default-src 'self'・connect-src 'self'、`index.ts:58-75`) は変えない。

#### Contract tests

期間つき・期間なし・壊れた期間で 200 と期待の `period`、`totals` が総収支画面の同じ期間の値と一致、振替が totals に入らない、取込 0 件で 0 と null、他の利用者のセッションでこの利用者の数値を 1 つも返さない (O5)、未認証 401、一時パスワード 403、応答に防衛ラインの値が無い。

### 既存経路の変更

- `/summary`・`/diagnosis`・`/defense-line`・`/statements` の応答は変えない。使い方画面は `/summary` と `/diagnosis` を期間なしで読む現行 (`Guide.tsx`) をやめ、数値は `/api/guide` から、『用語と目安』の現在値は既存経路の期間つきの読み取りから得る (現在値の合成は core へ移す)。
- 信頼度を出す画面 (明細仕分けの表と編集欄、概況の確認待ち) は API を変えず、web が core の段階関数の結果を描く。

## データモデル

N/A: DB の表・列・migration を足さない (qa-guide-database-web-002)。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` は据え置く。ガイド本文は core の定数として版管理する。読むのは既存の明細と取込の記録だけで、`loadDataset` の既存の経路を通る。

## 認証・認可

- `/api/guide` は `/api/*` の authGuard 配下 (HttpOnly・Secure・SameSite=Strict のセッション Cookie、`auth.ts:129-131`) と `mustChangePasswordFence` の配下に置き、route の中で個別の認可判定を書かない (qa-guide-auth-web-001)。
- 新しい資格情報・トークン・権限・役割は作らない。
- 未ログイン時の共通シェルは既存の locked 表示のまま。フッタのデータ出典は locked 時 `#privacy-help` を指す現行を保つ。

## エラー・例外・回復

- `/api/guide` の失敗: 数値の枠に「取得できませんでした」と再読込を出す。本文・目次・検索・下部固定バーは使える。
- 期間の指定が壊れている: 全期間の数値を返し、範囲表示は「全期間」。
- 未知の `topic`: 月次の流れを開く。長すぎる `q`: 100 字で切る。
- 信頼度が範囲外: 段階を出さず「—」。

## イベント・非同期処理

N/A: 新しい scheduled 処理・cron・キューを足さない (qa-guide-infrastructure-web-001)。夜間の `0 18 * * *` (`wrangler.jsonc:31`) の計画上限にも触れない。画面は期間の変更で `/api/guide` を読み直すだけである。

## 可観測性

- 新しいログ・計測・ダッシュボードは足さない。
- API のエラーは既存の流儀で code を残す。検索語・金額・利用者 id はログに出さない。

## 互換性・移行・リリース

- 経路 `/guide` とルート数を変えない (`routeMetadata.ts:152-163`)。旧 `pages/Guide.tsx` を再輸出 1 行にし、`display-contract.test.tsx:31` の REEXPORT が `pages/guide/` の実体を解決する。
- `shiftedPeriod` を core へ移したあとも決算書の挙動を変えない。`statements-view-model.test.ts:93-100` を core のテストへ移すか、再エクスポートで通す。
- 共通シェルのフッタ文言の変更に合わせ、`common-shell.dom.test.tsx:182-185` (「外部送信しませんでは嘘になるので」のコメントと 'アプリからは自動送信しません' の期待) を新しい 1 文目と 3 か所の補足の期待に書き換える。ヘッダの期待 (:154『防衛ライン：正常』) は変えない。
- `guide.dom.test.tsx` (32 行) と `guide-sections.test.ts` (21 行) は新しい構成に合わせて書き直す。
- migration を作らないので、巻き戻しは web と api のコードを戻すだけで済む。
- 新しい secret・binding・外部サービスの登録は発生しない。

## テストと受入条件

core 単体テスト (vitest、`packages/core/src/guide-screen.test.ts` ほか):

- 信頼度の段階: 49 が低、50 が中、79 が中、80 が高。0 と 100、範囲外 (-1・101・NaN) (O2)。
- 防衛ラインの説明: ガイドと用語集の説明文が算出定数 (3) から組まれ、定数を変えると説明文が変わる。`defenseLine` の既存テストは値を変えずに通る (O2)。
- guide-screen: 節 7 つの順、ステップ 4 つと行き先、よくある疑問 5 行、期間の表 4 行、このページの数値 4 項目、関連ページ 5 件を `toEqual` で固定 (O3)。
- 検索: 『振替』『重複』『信頼度』『予算』で当たる節、0 件、全角半角・大小の同一視、100 字の切り詰め。
- `shiftedPeriod`: 前後の移動、全期間で null、範囲の端で null (決算書の既存テストを移す)。
- 期間の定義文: 1 か月・1 年・全期間。

API テスト:

- `GET /api/guide` の Contract tests (上の節に列挙したもの)。

DOM テスト (`packages/web/src/pages/guide/guide-screen.dom.test.tsx`、ファイル名は **agent 推定・利用者未確認**):

- 問いの見出し・期間の前後移動・4 ステップと 4 つの元画面リンク・目次 7 項目・ステッパー・総収支の 3 枚 (実データの金額)・含まれるもの 3 枚・期間の表 4 行・このページの数値 4 項目・関連ページ 5 件・ガイド内検索・よくある疑問 5 行・下部固定バーの存在 (O1)。
- URL の `topic` / `q` から同じ表示が復元され、未知の `topic` が月次の流れに倒れる。
- 読込・失敗・検索 0 件の各状態。
- 信頼度を出す画面 (明細仕分けの表と編集欄、概況の確認待ち) で『段階＋%』が出る (O2)。
- 共通シェル: ヘッダが『防衛ライン：正常』のまま、フッタ 1 文目が『取込データは外部送信しません』、AI 送信の補足がフッタの title・プライバシー欄・使い方画面の 3 か所にある (O5)。
- 直書き色 0、共通 Button の使用、`PageHeader route="guide"`。

画面の描画検査:

- `packages/web/package.json` に `check:guide-screen` (`KANJO_VISUAL_SCOPE=guide node scripts/check-financial-visuals.mjs`) を足し、ルートの `verify:full` に組み込む (qa-guide-maintenance-ops-web-001)。前例は同 package.json:24 の `check:cash-screen`。

grep による検査 (O3):

- web と api に、ガイドの節・よくある疑問・期間の表・現在値の合成・信頼度の段階の境界 (80 / 50 の比較) が guide-screen と段階関数以外に 0 件。

全体:

- `pnpm lint` (check-glossary を含む)・`typecheck`・`test`・`skills:test`・初期 JS 予算・`verify:full` が全て exit 0 (O4)。
- 受入は実行済みの最新のテスト証跡だけで判定する。未実施、一部適合、または既知の逸脱が 1 件でも残る項目は PASS にしない。

## 未決事項

決着済み (本文の該当箇所へ統合した):

- 信頼度は 3 段階＋% (高 80 以上 / 中 50〜79 / 低 49 以下、段階が主) (qa-guide-decision-008)。
- 防衛ラインは算出を変えず説明を実装に合わせる (qa-guide-decision-009)。ヘッダは『防衛ライン』のまま (qa-guide-decision-010)。フッタ 1 文目は『取込データは外部送信しません』で AI 送信の補足を 3 か所 (qa-guide-decision-011)。

未決 (requirements 段階で確定する):

- **信頼度を出す画面の列挙。** G2 は「全画面」に段階＋% を見せるとするが、対象画面の一覧は確定していない (completeness-findings の medium)。2026-09-23 時点の現物で次の食い違いがある。
  - 概況 `packages/web/src/pages/Overview.tsx:209-210` の `confidenceClass` は 80 以上 good・60 以上 warning・それ未満 danger の色分けで、:328 と :370 で使う。新しい 50 の境界と衝突し、たとえば 55% は段階では「中」なのに色は danger になる。色の境界を段階に合わせるかは未確定。
  - 診断画面 (`pages/analysis/diagnosis/ResultCards.tsx:33`「見積りの確からしさ」) と AI 画面 (`pages/ai/AiContextAnalysis.tsx:22` の `CONFIDENCE_LABEL`) の「確度」は高/中/低の列挙で % を持たない。これらを本サイクルの対象に含めるかは未確定。
  - 明細仕分けの表 (`classify/TransactionTable.tsx:103,142`)・編集欄 (`classify/EditPanel.tsx:258`「信頼度の根拠」)・概況の確認待ち (`components/OverviewReviewQueue.tsx:141-158`) は % の数値を持ち、対象に入る見込みである (**agent 推定・利用者未確認**)。

未決 (agent 推定・利用者未確認のまま):

- `/api/guide` の応答の細部 (qa-guide-backend-web-004)、トピック id の綴り、4 ステップと下部固定バーの行き先、目次の切替幅 1024px、ステッパーの塗り方、検索の対象と正規化、0 件の文言、URL の既定と切り詰め、データ 0 件の表示、期間の定義文、AI 送信の補足の文言、段階関数と定数の名前、信頼度の範囲外の扱い、DOM テストのファイル名は、利用者の確認で変わり得る。変わった場合は core のテストの期待値と本書を同時に直す。
