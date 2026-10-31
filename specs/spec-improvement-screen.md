---
graph_node_id: "spec-improvement-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api", "data"]
title: "改善リクエスト画面 再現仕様 (20-improvement.png)"
project_id: "kanjo"
domain: "improvement"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement", "feedback", "privacy"]
file_path: "specs/spec-improvement-screen.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/20-improvement.png"
route: "/improvement"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "84a84e8817011684efe54e6d13b3d6494125b0007584567abed4ac4d1a42fe69"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "84a84e8817011684efe54e6d13b3d6494125b0007584567abed4ac4d1a42fe69", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: []
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "packages/web/scripts", "packages/web/package.json", "migrations", "package.json", "docs/improvement-request.md", "design/FINAL-UI/images/20-improvement.png"]
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
classification_reason: "design/FINAL-UI/images/20-improvement.png と利用者決定 qa-imp-decision-001〜008 および 8 カテゴリの web 方針 (qa-imp-ui-ux-web-001・qa-imp-frontend-web-001・qa-imp-backend-web-001・qa-imp-database-web-001・qa-imp-auth-web-001・qa-imp-security-web-001・qa-imp-infrastructure-web-001・qa-imp-maintenance-ops-web-001、確定決定 D-imp-008) から確定した改善リクエスト画面の再現仕様。上位概念の承認は最新が appr-foundation-imp-002 (U4・U7・U8・U9 を逐語で示して承認し、先行する appr-foundation-imp-001 と合わせて U1〜U9 の全項目を逐語で提示済み)。利用者が決めていない値は agent の推定として本文で個別に注記した。"
classification_candidates: [{"artifact_kind":"specification","confidence":1.0,"candidate_path":"specs/spec-improvement-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"not_applicable","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 改善リクエスト画面 再現仕様

正本の画像は `design/FINAL-UI/images/20-improvement.png`、経路は `/improvement` (`packages/web/src/AuthenticatedApp.tsx:63`)。上位の要件は `system-spec/00-requirements-definition.md` (U1-U9) とカテゴリ別の章 (ui-ux / frontend / backend / database / auth / security / infrastructure / maintenance-ops) にある。利用者決定は qa-imp-decision-001〜008 と、8 カテゴリの web 方針 (qa-imp-*-web-001) である。確定決定は D-imp-008。上位概念の承認は最新が appr-foundation-imp-002 (2026-09-23T13:16:38Z、U4・U7・U8・U9 の逐語承認) で、先行する appr-foundation-imp-001 (2026-09-23T13:10:18Z) を引き継ぐ。本書はそれらを 1 画面の実装単位へ落とした仕様で、画像のどの文言をそのまま再現し、どの値を期待値にしないかを明示する。

注記の約束: 利用者が決めた値には決定 ID (qa-imp-decision-00N、qa-imp-*-web-001、D-imp-008) を添える。現物の観測事実 (qa-imp-*-web-evidence-001、basis=observed-fact) には evidence の ID を添える。次の 2 種類は **「agent 推定・利用者未確認」** と明記する。1 つは system-spec の各章で「アシスタントの推定」とされた設計知識の適用 (basis=agent-inference) から引いた値で、もう 1 つは画像にも決定にも値が無く、実装の決定論のために本書で置いた値である。

行番号は 2026-09-23 時点の現物で確かめた値である。

## 目的と成功状態

目的: 利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、使っていて困ったことを、そのとき見えていた画面 (個人情報を伏せた画像) と診断情報ごと 1 画面で送れるようにする。送った依頼の状態・履歴・関連する依頼を同じ画面で追い、Claude Code / Codex がそのまま着手できる指示文として取り出せるようにする。送る前に何が伏せられるかを確かめられ、送った後も誤って消した依頼を戻せるようにして、改善の経路から個人情報と記録の欠けを無くす (U1)。

成功状態:

- `/improvement` に次がすべて描かれる (G1、S1、O1)。問いの見出しと説明・使い方リンク、共通の期間、作成フォーム、一覧 (検索・5 つの件数タブ・表・10 件ずつのページング)、詳細パネル、空状態、読み込み失敗と再読み込み、画面キャプチャの浮動パネル、選択中バー、コピー完了トースト。作成フォームは、スクリーンショットと撮り直し/削除、本文 0/1000、プライバシー確認 2 つ、自動マスキングの説明、送信を持つ。色・余白・部品はトークンと共通部品を経由し、直書き色の lint は 0 件である。
- 本文・関連ページ・診断情報は、クライアントの処理を飛ばした直接投稿も含め、保存前にサーバで辞書を含む core の規則を再適用する。画像は撮影用 DOM 複製で伏字にするが、API は画像の形式とサイズを検証してバイト列を保存するだけで、画像内の情報を再マスクしない。利用者がプレビューを見て送信前に確認する。画像を含め「機密情報が 1 件も残らない」とは保証しない (G2、S2、O2、qa-imp-decision-004)。
- 状態・概要・IMP 番号・検索・件数・ページング・関連する依頼・アクティビティ・診断要約・マスクが `packages/core/src/improvement-screen.ts` (と拡張した `improvement.ts` のマスク) だけで計算され、API と web はその結果を写すだけである (G3、S3、O3)。
- 他の利用者の依頼に対する取得・変更・削除・復元は 404 になる。不正な入力 (空の本文、1000 字超、プライバシー確認の欠け、候補外の状態、形式外または 2MB 超の画像) は 400 になる。削除した依頼は『元に戻す』で同じ番号のまま戻る。削除から 30 日後に夜間処理で行・履歴・R2 の画像が消える (G4、S4、O4)。

## スコープ

対象 (in):

- 改善リクエスト画面の作り直し。`packages/web/src/pages/Improvement.tsx` (現行 255 行の 1 ファイル) を `packages/web/src/pages/improvement/` 配下へ分割する。分割先は ImprovementPage・view-model・作成フォーム・一覧・詳細パネル・撮影パネル・選択中バー・トーストである (I1、qa-imp-frontend-web-001)。見出しは『改善要望』(`Improvement.tsx:87`、`routeMetadata.ts:385` の `'改善要望 | Focus Ledger'`) から『改善リクエスト』へ揃える。
- 作成フォームを画面内へ置く。件名欄は廃止し、本文は 1000 字にする。概要は本文の 1 行目から core で最大 40 字を切り出す (qa-imp-decision-002)。現行の投稿モーダル (`components/ImprovementRequestButton.tsx`、件名 120 字＋本文 4000 字、:234-246) は撮影パネルを開く入口に変える。
- プライバシー確認 2 つの必須化と、自動マスキングの対象の説明 (qa-imp-ui-ux-web-001)。
- 画面キャプチャの浮動パネル (キャプチャする・範囲を選択する)。各画面の『改善を送る』からパネルを出し、撮影後は画像と関連ページを持って `/improvement` の作成フォームへ移る。タブレット幅でも撮影の入口を残す。撮り直しでは関連ページへ戻ってパネルを出す (I5、qa-imp-decision-007)。
- 撮影用 DOM 複製の伏字 (`data-capture-mask`) と、本文・診断情報のマスク規則の拡張。拡張する規則は金額・電話・住所と、辞書による取引先名 (`transactions.partner`)・個人名 (`owner_labels`) である (I3、qa-imp-security-web-001)。
- 状態を 受付 / 対応中 / 完了 / 再確認 に改める。既存の対応しない (wontfix) は完了へ移し、理由をアクティビティに残す (qa-imp-decision-001)。
- migration 0054。状態の CHECK の張り替え、利用者ごとの連番、論理削除の列、件名の NULL 許容、アクティビティの表を足す (I4、qa-imp-database-web-001)。
- API: 削除・復元の新設と、一覧 (検索・件数・ページング)・詳細 (履歴・関連する依頼)・作成・状態の変更・再発行の拡張 (qa-imp-backend-web-001)。
- 詳細パネル。マスク済み診断の表示用要約、関連する依頼 (同じ関連ページの他の依頼を新しい順に最大 3 件、qa-imp-decision-006)、状態の変更、再発行、Claude Code 用 / Codex 用のコピー、削除を持つ。選択中バーとコピー完了トーストも描く。
- core の純関数 `improvement-screen` の新設 (I2)。
- 夜間の完全消去を既存の `improvement_retention` に相乗りさせる (D-imp-008、qa-imp-infrastructure-web-001)。
- core・API・DOM のテストと、`docs/improvement-request.md`・runbook の更新 (qa-imp-maintenance-ops-web-001)。

対象外 (out):

- 共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)。
- 改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)。
- 関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)。
- 複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する。
- モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)。
- 新しい Cron。新しい資格情報の種類 (qa-imp-auth-web-001)。R2 のキーの形の変更 (qa-imp-infrastructure-web-001)。

## 用語と主体

| 用語 | 意味 |
| --- | --- |
| 改善リクエスト (依頼) | `improvement_requests` の 1 行。本文・関連ページ・状態・添付画像・マスク済み診断・使い捨てトークンのハッシュを持つ。 |
| 状態 | 受付 (`open`) / 対応中 (`in_progress`) / 完了 (`done`) / 再確認 (`reconfirm`) の 4 つ。再確認は、開発側が直したので利用者が確かめる段階 (利用者の確認待ち) を指す (qa-imp-decision-001、保存値は qa-imp-database-web-001)。 |
| IMP 番号 | 利用者ごとの連番 `seq` を `IMP-024` の形で表示したもの。削除しても再利用しない (qa-imp-decision-007)。表示形は core が作り、保存しない。 |
| 概要 | 本文の 1 行目から core が切り出す最大 40 字 (qa-imp-decision-002)。保存しない導出値である。 |
| 関連ページ | 依頼を出した画面の経路 (`route` 列。クエリはマスク済み) と、その画面名。 |
| アクティビティ | 作成・状態の変更・再発行・削除・復元を 1 件ずつ追記する履歴。書き換えない (qa-imp-database-web-001)。 |
| 関連する依頼 | 同じ関連ページを持つ他の依頼を、新しい順に最大 3 件並べたもの。削除中の依頼は含めない (qa-imp-decision-006)。 |
| 論理削除 | `deleted_at` を付けること。『元に戻す』で外し、30 日後に夜間処理で完全消去する (qa-imp-decision-003)。 |
| 完全消去 | 論理削除から 30 日後に、行・履歴・R2 の画像を消すこと。 |
| 添付の期限切れ | 完了 (`done_at`) から 30 日後に画像・診断・トークンだけを消し、本文と状態は残す既存の扱い (`runImprovementRetention`)。 |
| 指示文 (プロンプト) | Claude Code / Codex に貼る文。取得先の URL と使い捨てトークンだけを載せる (`improvement/contract.ts` の `buildImprovementPrompt`)。 |
| 再発行 | トークンを作り直すこと。旧トークンのハッシュを上書きし、即座に失効させる (qa-imp-auth-web-001)。 |
| 撮影用の複製 | 撮影時に作る DOM の複製。`data-capture-hide` の要素を落とし、`data-capture-mask` の要素を伏字にしてから画像にする。 |
| 診断のセッション ID | ページを読み込むたびに作る乱数。認証のセッションとは別物で、画面には末尾 4 桁だけを出す (qa-imp-security-web-001)。 |

主体:

- 利用者 (SH1): セッション cookie で認証された本人。依頼の作成・一覧・詳細・状態の変更・コピー・削除・復元を行う。
- 開発兼運用者 (SH2): Claude Code / Codex で改善する同一人物。指示文を貼り、状態を受付から完了まで動かす。
- エージェント (Claude Code / Codex): 使い捨てトークン (Bearer、接頭辞 `imp_`) で agent の 2 経路だけを読む (qa-imp-auth-web-evidence-001)。

## ユースケースとユーザーフロー

1. 困ったその場で送る: その画面の『改善を送る』を押す。スマートフォン・タブレットでも撮影の入口を使える。浮動パネル「画面をキャプチャ」で、画面全体か範囲を撮る。撮影用の複製で一般文字を規則に従って伏字にし、canvas はプレースホルダー化する。画像と関連ページを `/improvement` の作成フォームへ渡し、プレビューで残る情報を確認してから本文を書き、プライバシー確認 2 つにチェックして送る。
2. 画像を直す: 作成フォームの『キャプチャを撮り直す』で関連ページへ戻り、パネルを出して撮り直す。要らなければ『画像を削除』で外す。スクリーンショットは任意なので、画像なしでも送れる。
3. 状態を追う: 一覧の件数タブ (すべて / 受付 / 対応中 / 完了 / 再確認) と検索 (ID・内容・関連ページ) で絞り、行を選ぶ。詳細パネルで IMP 番号・状態・本文・添付画像・マスク済み診断・アクティビティ・関連する依頼を読む。
4. 指示文を取り出す: 詳細の『Claude Code用のプロンプトをコピー』または『Codex用のプロンプトをコピー』、あるいは選択中バーの『Codex用をコピー』を押す。コピー完了トーストが出て、コピー記録が残る。旧い指示文を止めたいときは『このリクエストを再発行』を押す。
5. 状態を変える: 詳細の状態バッジ、または『ステータスを変更』から、core が許す遷移だけを選ぶ。変更はアクティビティに 1 行追記される。
6. 誤って消して戻す: 『このリクエストを削除』を押すと、一覧・件数・詳細から消え、完了トーストが出る。トーストの『元に戻す』で同じ IMP 番号のまま戻る。戻さなければ 30 日後に夜間処理で完全に消える。
7. 最初の 1 件: 依頼が 0 件なら空状態の『最初の改善リクエストを作成』から作成フォームへ移る。
8. 読み込みの失敗: 一覧の取得に失敗したら「データの読み込みに失敗しました」と『再読み込みする』が出る。作成フォームの入力は失われない。

## 機能要件

- FR-1 見出し: タイトル「改善リクエスト」、問いの見出し「画面の文脈を保ったまま、改善を共有しますか？」、説明「使っていて困ったこと、こうなったらいいのに、という改善案をお送りください。開発チームが内容を確認し、今後の改善に活用します。」を画像どおりに出す。右に『改善リクエストの使い方』を置く。行き先は `/guide` とする (**agent 推定・利用者未確認**)。
- FR-2 共通の期間: 画面上端に共通の期間タブ (1年 / 2年 / 3年 / 任意) と範囲表示を描く (G1)。一覧は期間で絞らない (**agent 推定・利用者未確認**。「未決事項」を参照)。
- FR-3 作成フォームの見出しとスクリーンショット: 見出し「新しい改善リクエストを作成」、欄「スクリーンショット（任意）」を置く。撮影済みなら縮小画像を出し、『キャプチャを撮り直す』『画像を削除』を並べる。撮り直しは関連ページへ戻る 1 経路にまとめる。未撮影なら撮影パネルを開く導線を出す。
- FR-4 本文: ラベル「どのような改善を希望しますか？」(必須の印つき)。placeholder は「例：月次レポートのグラフが正しく表示されないので、条件を変更しても正しく表示されるようにしてほしいです。可能であれば、エラー時のメッセージもわかりやすくしてほしいです。」。文字数を `0/1000` の形で出す。1000 字を超えたら送信を止め、理由を送信ボタンの近くに文で示す (qa-imp-decision-002、ui-ux 章の上流指針)。文字数の数え方は「ビジネスルールと検証」を参照。
- FR-5 プライバシー確認: 見出し「プライバシーに関する確認」(必須の印つき) の下に、チェックを 2 つ置く。1 つ目は「添付画像・入力内容から、個人情報や機密情報が含まれていないことを確認しました」、2 つ目は「この内容の取り扱いに同意します（プライバシーに記載して対応します）」。どちらかが未チェックなら送信できず、その理由を送信ボタンの近くに文で示す (qa-imp-ui-ux-web-001)。
- FR-6 自動マスキングの説明: 見出し「自動マスキングの対象」、「以下の情報は自動的にマスクされます」、「口座情報・取引先名・金額・個人名・メールアドレス」「電話番号・住所・その他の個人情報」、リンク『詳細を確認する』を送信ボタンの直前に置く (qa-imp-ui-ux-web-001)。リンクの行き先は `docs/improvement-request.md` の該当節と同じ内容を画面内で開く details とする (**agent 推定・利用者未確認**)。
- FR-7 送信: 『改善リクエストを送信』。成功したら作成フォームを空にし、新しい依頼を選択状態にして詳細パネルに出す (**agent 推定・利用者未確認**)。
- FR-8 一覧の検索: 見出し「改善リクエスト一覧」、placeholder「ID・内容・関連ページで検索（例：グラフ、エラー、仕分け）」。IMP 番号・本文・関連ページ名で部分一致させる。導出は core が行う (I2)。
- FR-9 件数タブ: 「すべて / 受付 / 対応中 / 完了 / 再確認」の 5 つに件数を添える。削除中の依頼は数えない (qa-imp-decision-003)。件数を検索後の集合で数えるかどうかは **agent 推定・利用者未確認** で、本書では検索後の集合で数える。
- FR-10 一覧の表: 列は「ID / 関連ページ / 改善の概要 / ステータス / 作成日 / 更新日」の 6 つ。既定の並びは作成日の新しい順で、作成日の見出しに降順の印を出す。行を選ぶと詳細パネルと選択中バーの対象になる。選択は 1 件である。見出し行の全選択は、一括操作が範囲に無いので置かない (**agent 推定・利用者未確認**)。状態は色だけでなく文字ラベルで示す (ui-ux 章の上流指針)。
- FR-11 ページング: 10 件ずつ (G1)。前後の矢印とページ番号、右に「10件 / 全12件」の形の表示を置く。形は「{ページの件数}件 / 全{総数}件」とする (**agent 推定・利用者未確認**)。
- FR-12 詳細パネルの頭: 見出し「改善リクエストの詳細」と閉じるボタン。IMP 番号と状態バッジ (バッジから状態を変えられる)、概要、「作成日」「更新日」(日時)、「関連ページ」を出す。
- FR-13 詳細の本文と画像: 「改善の内容」に本文の全文を出す (1000 字を超える既存の本文もそのまま読める。qa-imp-decision-002)。「添付画像」に縮小画像と『画像を拡大して見る』を出す。画像は `GET /api/improvements/:id/screenshot` を通して読む。
- FR-14 診断情報 (マスク済み): 見出し「診断情報（マスク済み）」の表に OS・ブラウザ・画面サイズ・利用環境・セッションID の 5 行を置く。値は core の表示用要約から出す。セッションID は末尾 4 桁以外を伏せる (`****-****-****-a3f2` の形)。下に『含まれる情報 / 含まれない情報を確認する』を置く (G3、qa-imp-security-web-001)。
- FR-15 アクティビティ: 見出し「アクティビティ」。履歴を時刻・見出し・説明の縦のタイムラインで出す。並びは新しい順とする (画像の並びに合わせる。**agent 推定・利用者未確認**)。見出しと説明の文言は core が種類から組む。
- FR-16 関連する依頼: 見出し「関連する改善リクエスト」。IMP 番号と概要を最大 3 件出す。押すとその依頼を選ぶ (qa-imp-decision-006)。
- FR-17 操作: 見出し「操作」の下に次の 5 つを並べる。『ステータスを変更』(core が許す遷移だけを選べる)、『このリクエストを再発行』、『Claude Code用のプロンプトをコピー』、『Codex用のプロンプトをコピー』、『このリクエストを削除』。削除は危険操作の見た目にする。
- FR-18 コピー: クリップボードへ指示文を書く。成功したら `POST /api/improvements/:id/copied` で記録し、トースト「{Claude Code / Codex}用のプロンプトをコピーしました」を出す。原文のトークンは作成時と再発行時にしか返らない。メモリ上に指示文が無いときのコピーは再発行を伴い、前の指示文を失効させる。この動きをコピーボタンを押す前に説明する。
- FR-19 削除と元に戻す: 『このリクエストを削除』で `DELETE /api/improvements/:id` を呼ぶ。完了トーストに「削除しました」と『元に戻す』を出す。『元に戻す』は `POST /api/improvements/:id/restore` を呼び、同じ IMP 番号のまま一覧へ戻す (qa-imp-decision-003)。削除の前に確認ダイアログは出さない (**agent 推定・利用者未確認**)。
- FR-20 選択中バー: 画面下に固定する。「選択中」、IMP 番号、概要、状態バッジ、『Codex用をコピー』(対象の切替つき)、閉じるボタンを置く。閉じると選択を外す。
- FR-21 空状態: 依頼が 0 件なら、一覧の位置に次を出す。「データがありません」、「まだ改善リクエストがありません。気づいたことや改善してほしいことを、ぜひお送りください。」、『最初の改善リクエストを作成』(作成フォームの本文へフォーカスを移す)。
- FR-22 読み込み失敗: 一覧の取得に失敗したら次を出す。「データの読み込みに失敗しました」、失敗理由を伏せず安全に示す案内、『再読み込みする』。詳細の取得失敗も詳細パネルに理由と再試行の入口を示す。作成フォームの入力 (メモリ上の本文・画像・チェック) は保つ。
- FR-23 画面キャプチャの浮動パネル: 見出し「画面をキャプチャ」、閉じるボタン、縮小表示、『キャプチャする』(画面全体)、『範囲を選択する』を持つ。範囲選択はポインタのドラッグとキーボードの両方で操作できる。キーボードでは矢印キーで矩形を動かし、Enter で確定する。選んだ範囲は文字でも示す (frontend 章の上流指針)。撮影コードは遅延読み込みにする (qa-imp-frontend-web-001)。
- FR-24 撮影の伏字: 撮影用の複製で、`data-capture-hide` の要素を落とす。`data-capture-mask` を付けた要素に加え、一般 DOM の文字にも辞書を使わない core の規則を掛ける。canvas の内容はプレースホルダー化する。これらは撮影時のベストエフォートであり、画像内の情報を完全には判定できないため、送信前のプレビューと確認を必須とする。
- FR-25 画面間の受け渡し: 撮った画像と関連ページは、メモリ上の受け渡しで作成フォームへ渡す。端末 (localStorage・sessionStorage・IndexedDB) には保存しない (qa-imp-frontend-web-001)。
- FR-26 URL: 選択中の依頼・タブ・検索語・ページを URL の検索パラメータに持つ。同じ URL を開けば同じ一覧と詳細が出る (I1、qa-imp-frontend-web-001)。キー名は「UI・状態遷移」を参照。
- FR-27 書き込み (注釈): 撮った画像の下に、最初から書き込みの道具を出す (`ScreenshotAnnotator.tsx`・`annotate-image.ts`)。道具は **枠・ペン・文字・マスク・移動** の 5 つ。枠・ペン・文字は 5 色 (赤・青・緑・橙・黒) から選べ、マスクは常に墨色で塗る。**移動** は書いたものを掴んでドラッグで動かし、大きさ・形・色・文字は変えず、画像の外へは出さない。掴む優先は「後から書いたもの」→「枠の中身より枠線・ペン・文字・マスク」。『1つ戻す』は最後の**操作** (描く・動かす・全消去) を取り消す (最大 100 操作)。『拡大して書き込む』で画面いっぱいのダイアログを開き、インラインと同じ書き込みを共有する。書き込みは比率 (0..1) で持ち、送信時に画像へ焼き込む。マスクの焼き込みに失敗したら送らない (fail-closed)。以前の「番号の印」案は利用者の依頼 (2026-09-24「四角で囲ったり、ペンの色を変えたり、文字を入力できたり」「書き込んだ文字や色や枠を移動できると便利」) で置き換えた (**利用者確認済み**)。

## 非機能要件

- 性能: 画面は既存どおり遅延読み込みにする (`AuthenticatedApp.tsx:9-10`)。撮影と範囲選択のコードは最初の描画に要らないので、別の遅延読み込みにする。初期 JS 予算 (`check:js-budget`、build:bundle の直後) を超えない (O4、qa-imp-maintenance-ops-web-evidence-001)。一覧 API は利用者の依頼を 1 回のクエリで読み、core で絞り込む。
- 可用性: 一覧の取得に失敗しても作成フォームは使える。夜間の完全消去は他の job と `Promise.allSettled` で独立させ、失敗しても他の job とバックアップを止めない (infrastructure 章の上流指針)。
- アクセシビリティ: 状態を色だけで伝えない。4 状態・件数タブ・表の状態列・詳細の状態表示には必ず文字ラベルを添える。送信を止める理由、削除と『元に戻す』、コピー完了は文で結果を伝える (ui-ux 章の上流指針。WCAG 2.2 Use of Color)。範囲選択はキーボードでも操作できる。
- レスポンシブ: 800px 以下では作成フォーム・一覧・詳細を縦に積み、表を横スクロールの容器に入れる (frontend 章の上流指針)。900px の参照画像でも左右の関係を保つため、境界は 800px とする (**agent 推定・利用者未確認**)。下部固定の選択中バーには安全領域の余白を足す。
- セキュリティとプライバシー: 撮影はブラウザ内で完結させる (C4)。本文・関連ページ・診断はブラウザとサーバの 2 層で core の規則を掛け、サーバでは辞書も使用する。画像は撮影用の複製で伏字にして利用者が送信前に確認する。サーバは画像内の情報を再マスクしない (G2)。
- 保守性: 状態の体系と遷移・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクを core の 1 か所に置く。web と api に同じ計算を重複させない (O3)。
- 見た目: 直書き色 0。色はデザイントークン、ボタンは共通 Button を使う。`/improvement` は routeMetadata の業務ルートではない (`display-contract.test.tsx:20` の `NON_ROUTED_PAGES`)。そのため `PageHeader` の `route` は使わず、見出しは画面側で描く (現行の扱いを維持)。
- テストと成果物: public repository のため、実データをテストと成果物へ含めない (C4)。

## UI・状態遷移

### 画面骨格

`/improvement` の 1 経路。上から次の順に並べる (qa-imp-ui-ux-web-001)。

1. 共通の期間タブ: 「1年 / 2年 / 3年 / 任意」と、前後の矢印つきの範囲表示。
2. タイトル「改善リクエスト」、問いの見出し、説明 2 行、右に『改善リクエストの使い方』。
3. 作成フォーム (上段): 左にスクリーンショットと 3 つのボタン、その下にプライバシー確認 2 つ。右に本文と文字数、その下に自動マスキングの対象。最下に全幅の『改善リクエストを送信』。
4. 下段の 2 ペイン: 左に一覧 (検索・件数タブ・表・ページング)、右に詳細パネル。依頼が 0 件なら一覧の位置に空状態を出し、取得に失敗したら読み込み失敗を出す。
5. 左下の浮動パネル「画面をキャプチャ」(撮影の途中だけ)。
6. 下部固定の選択中バー (依頼を選んでいるときだけ)。
7. コピー完了トースト・削除完了トースト (右下、操作の直後だけ)。

### 状態と遷移

| 状態 | 保存値 | 文字ラベル | 意味 |
| --- | --- | --- | --- |
| 受付 | `open` | 受付 | 作成直後。 |
| 対応中 | `in_progress` | 対応中 | 開発側が着手した。 |
| 再確認 | `reconfirm` | 再確認 | 開発側が直したので、利用者が確かめる段階 (qa-imp-decision-001)。 |
| 完了 | `done` | 完了 | 対応を終えた。ここに入った時刻 `done_at` が、添付を 30 日で消す起点になる。 |

許される遷移は core の 1 つの表で持つ。本書の表は次のとおりで、表そのものは **agent 推定・利用者未確認** である。

| 現在 | 移れる先 |
| --- | --- |
| 受付 | 対応中・完了 |
| 対応中 | 受付・再確認・完了 |
| 再確認 | 対応中・完了 |
| 完了 | 対応中・再確認 |

- 完了へ入ったら `done_at` を付ける。完了から出たら `done_at` を外す。この起点の扱いは現行 (`routes/improvement.ts:374` 以降) と同じで、30 日削除の起点は完了のまま (qa-imp-decision-001)。
- 添付が期限切れ (`purged_at` あり) の依頼も状態は変えられる。ただし完了から出しても消えた添付は戻らない (現行の扱い)。

### 作成フォームの状態

| 状態 | 送信ボタン | 表示 |
| --- | --- | --- |
| 本文が空 | 押せない | 「改善の内容を入力してください」(文言は **agent 推定・利用者未確認**) |
| 本文が 1000 字超 | 押せない | 文字数を警告色と文で示す (「1000 字以内で入力してください」、文言は **agent 推定・利用者未確認**) |
| プライバシー確認が 1 つ以上未チェック | 押せない | 「プライバシーに関する確認を 2 つともチェックしてください」(文言は **agent 推定・利用者未確認**) |
| 送信中 | 押せない | ボタンに送信中の表示 |
| 送信失敗 | 押せる | 送信ボタンの近くに API の message を出す。入力は保つ |

### 一覧・詳細・トースト

| 状態 | 表示 |
| --- | --- |
| 読込中 | 作成フォームは描き、一覧と詳細を骨組み表示にする。 |
| 0 件 | 空状態 (FR-21)。詳細パネルは出さない。 |
| 検索・タブで 0 件 | 表の位置に「条件に合う改善リクエストがありません」(文言は **agent 推定・利用者未確認**)。件数タブは 0 を出す。 |
| 失敗 | 読み込み失敗 (FR-22)。 |
| 未選択 | 詳細パネルに「一覧から改善リクエストを選んでください」(文言は **agent 推定・利用者未確認**)。選択中バーは出さない。 |
| 選択中 | 詳細パネルと選択中バー。 |
| URL の `id` が見つからない (削除中・他の利用者・存在しない) | 選択を外し、一覧だけを出す。 |
| コピー成功 | トースト「{Claude Code / Codex}用のプロンプトをコピーしました」と閉じるボタン。 |
| コピー失敗 (クリップボード不可) | 指示文を読み取り専用の欄に出して手でコピーできるようにする (現行 `Improvement.tsx` の textarea を引き継ぐ。**agent 推定・利用者未確認**)。 |
| 削除成功 | トースト「削除しました」と『元に戻す』。 |
| 復元成功 | 同じ IMP 番号で一覧に戻り、選択状態にする。 |

### URL のキー

| キー | 値 | 既定 |
| --- | --- | --- |
| `id` | 選択中の依頼の内部 id | 無し (未選択) |
| `tab` | `all` / `open` / `in_progress` / `done` / `reconfirm` | `all` |
| `q` | 検索語 (100 字で切る) | 空 |
| `page` | 1 始まりのページ番号 | 1 |

URL に持つ項目 (選択中の依頼・タブ・検索・ページ) は qa-imp-frontend-web-001 の確定である。キー名・値の綴り・既定・切り詰めは **agent 推定・利用者未確認**。未知の `tab` は `all` に、範囲外の `page` は最後のページに倒す。

### 画像の値のうち期待値にしないもの

- 共通シェルの文言: ヘッダの「取引ライン：正常」「最終更新 2026年9月10日 10:24」、サイドバーのバッジ 3 / 12 / 2 / 5、月次クローズの進捗 3/4、フッタ「取込データは外部送信しません / 税務上の正確性はfreee / 毎晩バックアップ」。いずれも現行のまま (U7 の対象外)。
- 期間 (2025年9月 - 2026年8月)、件数 (すべて 12・受付 3・対応中 4・完了 4・再確認 1)、表の 10 行 (IMP-024〜IMP-015 と各日付)、IMP-024 の本文・日時・アクティビティ・関連する依頼 (IMP-018・IMP-021)、診断の値 (Windows 11 / Edge / 1920 × 1080 / 本番環境 / a3f2)。いずれも画像の例示であり、実データで置き換える。
- ブラウザの「Edge（マスク済み）」: 版番号などを伏せた表示の例示として扱う。何を伏せるかは core の診断要約の規則に従う。
- 範囲表示の区切り「-」: 共通の期間部品の既存表示に従う。

## ビジネスルールと検証

### 本文と概要 (qa-imp-decision-002)

- 新規と編集の本文は、trim 後に 1 字以上 1000 字以下とする。数え方は現行の zod (`z.string().trim().max`、UTF-16 の長さ) に合わせる (**agent 推定・利用者未確認**)。1000 字を超える既存の本文は読めるまま保ち、再保存を求めない。
- 概要は、本文の最初の空でない行を trim し、先頭から 40 字で切ったもの。切ったときは末尾に「…」を付ける (**agent 推定・利用者未確認**)。既存行の件名 (`title`) は概要に使わない (**agent 推定・利用者未確認**)。
- 指示文 (`buildImprovementPrompt`) は、件名の代わりに概要を載せる (**agent 推定・利用者未確認**)。

### IMP 番号 (qa-imp-decision-007)

- `seq` は利用者ごとに 1 から振る。作成時に採番表と同じ D1 batch でだけ付ける。削除しても戻さず、再利用しない (database 章の上流指針)。
- 既存行は利用者ごとに作成順 (`created_at`、同時刻は `id`) で採番する。
- 表示は `IMP-` に 3 桁のゼロ詰めを続ける (例 `IMP-024`)。1000 以上はそのままの桁数で出す (**agent 推定・利用者未確認**)。
- 検索では `IMP-024`・`imp-24`・`24` のいずれでも当たる (**agent 推定・利用者未確認**)。

### 検索・件数・ページング (I2)

- 対象は、削除中でない自分の依頼だけ (qa-imp-decision-003)。
- 検索は IMP 番号・本文・関連ページ名に対する部分一致で、全角半角と大小を同一視する。正規化の範囲は **agent 推定・利用者未確認**。検索語は 100 字で切る。
- 件数タブは検索後の集合を状態ごとに数え、「すべて」はその合計とする (**agent 推定・利用者未確認**)。
- 並びは作成日の新しい順、同時刻は `seq` の大きい順。
- 1 ページ 10 件 (G1)。範囲外のページは最後のページに倒す。

### 関連する依頼 (qa-imp-decision-006)

- 同じ `route` を持つ自分の他の依頼を、作成日の新しい順に最大 3 件出す。選択中の依頼自身と削除中の依頼は含めない。
- `route` が空の依頼には関連する依頼を出さない (**agent 推定・利用者未確認**)。
- 関連ページの画面名は、経路から core が引く。現行の経路と画面名の対応は web の `routeMetadata.ts` にあるため、core へ移すか core から参照できる形にする (「未決事項」を参照)。

### アクティビティ

- 次の 6 種類を記録する。作成・状態の変更 (前後の状態つき)・再発行・削除・復元の 5 つ (database 章の上流指針) と、0054 で wontfix を完了へ移したことの記録 (qa-imp-decision-001) である。種類名は `created` / `status_changed` / `reissued` / `deleted` / `restored` / `migrated_wontfix` とする (**agent 推定・利用者未確認**)。
- 依頼の行と履歴の 1 行は同じ D1 batch で書く。履歴は追記だけで、書き換えない (backend 章の上流指針)。
- コピー記録 (`copied_at`・`copied_target`) は現行どおり依頼の行の上書きとし、履歴には書かない (**agent 推定・利用者未確認**)。
- 表示の見出しは core が組む。画像の例は「改善リクエストを作成」「対応中に変更」「受付」。wontfix を移した行の説明は「対応しない (wontfix) から完了へ移しました」とする (文言は **agent 推定・利用者未確認**)。

### マスク (G2、qa-imp-decision-004、qa-imp-security-web-001)

- 対象は、口座・メール・秘匿値 (現行 `redactSecrets`、`packages/core/src/improvement.ts:128`) に次を加えたもの。金額・電話・住所の規則と、辞書による取引先名・個人名である。取引先名の辞書は利用者自身の `transactions.partner`、個人名の辞書は `owner_labels` から作る。
- 伏字の置換文字は現行の `***` を使う (**agent 推定・利用者未確認**)。
- 金額・電話・住所の正規表現の細部は **agent 推定・利用者未確認**。core の単体テストに例を並べて固定する。例: 金額は「¥1,248,000」「12,000円」、電話は「03-1234-5678」「090-1234-5678」、住所は都道府県名に続く市区町村・番地。
- 辞書はリクエストのたびに作り、保存しない。取引先名の辞書は、作成時に `transactions.partner` を 1 本のクエリで読んで作る (backend 章の上流指針)。
- 同じ core の関数をブラウザとサーバで呼ぶ。サーバは、クライアントがマスクを飛ばした投稿にも保存前に掛ける (O2)。
- マスクは本文・関連ページ・診断の全項目に掛ける。関連ページは現行どおり `redactText(route, 500)` に通す。

### 入力検証 (I6、security 章の上流指針)

| 項目 | 規則 | 違反時 |
| --- | --- | --- |
| 本文 | trim 後 1 字以上 1000 字以下 | 400 |
| プライバシー確認 | 2 つとも true | 400 |
| 状態 | 4 候補のうち、core が今の状態から許す遷移だけ | 候補外は 400。許されない遷移は「API契約」の該当経路を参照 |
| 画像 | マジックバイトで JPEG/PNG、2MB (`IMPROVEMENT_SCREENSHOT_MAX_BYTES`、`improvement.ts:79`) 以下 | 400 |
| 診断 | 60 件 (`DIAGNOSTIC_MAX_ENTRIES`)・32KB (`DIAGNOSTIC_MAX_BYTES`) まで。超えた分は切り詰めて件数を記録する (現行) | 切り詰め |
| 関連ページ | 500 字まで、マスク済み | 切り詰め |

core の定数と API の zod で同じ上限を使う。

### 診断情報の表示用要約 (G3)

- OS・ブラウザ・画面サイズは、保存済みの `userAgent`・`viewport` から core が導く。ブラウザは名前だけを出し、版番号は伏せる (**agent 推定・利用者未確認**)。
- 利用環境は、診断を記録した画面の origin が本番かどうかから導く。値は「本番環境」または「ローカル環境」とする (**agent 推定・利用者未確認**)。
- セッション ID は、ページを読み込むたびに作る乱数 (認証のセッションとは別物) である。診断の環境に足して保存し、表示は末尾 4 桁だけにする (qa-imp-security-web-001)。現行の `DiagnosticEnvironment` は「識別子を足さない決まり」(qa-imp-security-web-evidence-001) であり、この乱数はその唯一の例外である。

### 論理削除と完全消去 (qa-imp-decision-003、D-imp-008)

- 削除は `deleted_at` を付けるだけで、画像・トークン・履歴は残す。『元に戻す』は `deleted_at` を外すだけにする。同じ id と `seq` のまま戻る。
- 削除中の行は、次のどの経路からも読まない (backend 章の上流指針)。一覧・件数・詳細・画像・指示文・コピー記録・状態・agent の 2 経路・関連する依頼。
- 削除から 30 日を過ぎた行は、夜間の `improvement_retention` が R2 の画像を消し、成功した行だけを D1 で DELETE する。履歴は ON DELETE CASCADE で一緒に消える。
- 完了から 30 日で添付を消す既存の扱いは変えない。

## API契約

共通: 画面の経路は、`/api/*` の authGuard (`packages/api/src/index.ts:107`)・`mustChangePasswordFence` (:109)・`runtimeSchemaGuard` (:110) の内側に載る (`improvementRoute`、:132)。各クエリは `c.get('userId')` で絞る。他の利用者の id・存在しない id・削除中の id は、どれも同じ 404 `not_found` を返し、存在を推測させない (qa-imp-auth-web-001、auth 章の上流指針)。エラーの形は既存どおり `{ "error": { "code": string, "message": string } }`。400 の入力検証の失敗は既存の code `invalid_request` を使う (`routes/improvement.ts` の作成経路と同じ)。欄ごとの理由を `error.fields` (欄名から理由文への対応) で返すのは **agent 推定・利用者未確認** である。全経路の応答に `Cache-Control: private, no-store` を付ける (現行、`routes/improvement.ts` の `improvementRoute.use('*')`)。書き込みの経路は、依頼の行と履歴の行を 1 つの D1 batch で書く (backend 章の上流指針)。

### GET /api/improvements

#### 識別と目的

- Operation ID: `listImprovements`
- 一覧・件数タブ・ページングを 1 回で返す。検索・件数・ページングは core の `improvement-screen` が行い、API は結果を JSON に写す (I2、qa-imp-backend-web-001)。現行 (`routes/improvement.ts:242`) は作成日の新しい順に最大 200 件を返すだけで、検索・件数・ページングを持たない (qa-imp-backend-web-evidence-001)。

#### 認証・認可

セッション cookie。`user_id` の一致する、削除中でない行だけを返す。

#### Request

query: `q` (検索語、100 字で切る)、`tab` (`all` / `open` / `in_progress` / `done` / `reconfirm`、既定 `all`)、`page` (1 始まりの整数、既定 1)。body なし。query のキー名は画面の URL と同じで、**agent 推定・利用者未確認**。

#### Response

200 `{ "items": ImprovementListItem[], "counts": { "all": number, "open": number, "in_progress": number, "done": number, "reconfirm": number }, "page": number, "pageSize": 10, "total": number }`。`ImprovementListItem` は次の項目を持つ。`id`、`number` (IMP 番号の表示形)、`route`、`routeLabel`、`summary` (概要)、`status`、`statusLabel`、`createdAt`、`updatedAt`。形の細部は **agent 推定・利用者未確認**。

#### Validation・ビジネスルール

- 壊れた `tab` は `all` に、範囲外や非数の `page` は範囲内に倒し、400 にしない (**agent 推定・利用者未確認**)。
- 削除中の行は `items` にも `counts` にも入らない。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 401 | unauthorized | セッションが無い・切れた | no | 既存の locked 表示へ |
| 403 | password_change_required | 一時パスワードの利用者 | no | 既存のパスワード変更へ |
| 503 | schema_unavailable | migration 0054 が未適用 | yes | 読み込み失敗を出し、再読み込み |

401 / 403 / 503 の code は既存のミドルウェアの値に従う (`auth.ts:242` の unauthorized、`auth.ts:297` の password_change_required、`schema-guard.ts:7` の schema_unavailable)。

#### 実行セマンティクス

読み取りだけ。自分の削除中でない行を 1 本のクエリで読み (`WHERE user_id = ? AND deleted_at IS NULL`)、core に渡す。上限 200 件の打ち切りはやめ、全件を core に渡す (単一利用者の運用。**agent 推定・利用者未確認**)。べき等。

#### キャッシュ・ページング

`Cache-Control: private, no-store`。ページングは offset 型 (1 ページ 10 件) で、並びは作成日の新しい順に固定する。画面は TanStack Query の問い合わせ鍵に `q`・`tab`・`page` を含め、変更系の成功後に無効化する (qa-imp-frontend-web-001)。

#### 可観測性と監査

失敗は既存の API エラーログの流儀で code を残す。検索語・本文・利用者 id はログに出さない。

#### セキュリティ確認

`user_id` と `deleted_at IS NULL` の両方をクエリの条件に含める。検索語は SQL に渡さず core で照合する。応答に token のハッシュ・R2 のキーを含めない。

#### Contract tests

- Positive: 12 件で `counts.all` が 12、`page=2` で 2 件、`tab=open` で受付だけ。
- Boundary: `q` で本文・IMP 番号・関連ページ名のそれぞれに当たる。100 字超の `q` が切られる。空の結果で `total` が 0。
- Negative/auth: 削除中の行が `items` と `counts` に 0 件 (O4)。他の利用者の行が 0 件。未認証は 401、一時パスワードは 403。

### GET /api/improvements/:id

#### 識別と目的

- Operation ID: `getImprovement`
- 詳細パネルの全区画を返す。本文、画像の有無、診断の表示用要約、アクティビティ、関連する依頼 (最大 3 件)、許される遷移先である (qa-imp-backend-web-001)。現行は `routes/improvement.ts:254`。

#### 認証・認可

セッション cookie。`user_id` が一致し、削除中でない行だけ。

#### Request

path `id` (内部 id、TEXT)。body なし。

#### Response

200 `{ "request": ImprovementRequestView, "number": string, "summary": string, "routeLabel": string, "diagnosticsSummary": { "os": string, "browser": string, "viewport": string, "environment": string, "sessionIdMasked": string } | null, "activities": ImprovementActivityView[], "related": ImprovementListItem[], "allowedTransitions": ImprovementStatus[] }`。`ImprovementRequestView` は現行 (`improvement/contract.ts`) の形を保ち、`seq` を足す。`title` は null を許す。追加項目の名前と形は **agent 推定・利用者未確認**。診断の全エントリは従来どおり `diagnostics` で返す。

#### Validation・ビジネスルール

- 期限切れの添付は、詳細を取るときにもその場で消す (現行の `purgeIfExpired` を維持)。
- `related` は削除中の依頼と自分自身を含めない。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 404 | not_found | 存在しない・他の利用者・削除中 | no | 選択を外して一覧を取り直す |
| 401 / 403 / 503 | 既存の値 | 一覧と同じ | 一覧と同じ | 一覧と同じ |

#### 実行セマンティクス

読み取り。ただし期限切れの添付を消す縮退経路 (R2 の削除と行の更新) を含む (現行)。依頼 1 行・履歴・同じ `route` の他の行を読み、core に渡す。

#### キャッシュ・ページング

`Cache-Control: private, no-store`。N/A: ページングしない (履歴は全件、関連は最大 3 件)。

#### 可観測性と監査

失敗は code だけを残す。本文・診断・利用者 id はログに出さない。

#### セキュリティ確認

診断は保存時にマスク済みで、表示用要約はさらにセッション ID を末尾 4 桁に絞る。応答に token のハッシュ・R2 のキーを含めない。

#### Contract tests

- Positive: 履歴が新しい順で種類ごとの見出しを持つ。関連する依頼が同じ `route` の他の行を最大 3 件返す。`allowedTransitions` が core の表と一致する。
- Boundary: 1000 字を超える既存の本文がそのまま返る。`title` が null の新規行。
- Negative/auth: 削除中は 404、他の利用者は 404 (O4)、完全消去後は 404。

### POST /api/improvements

#### 識別と目的

- Operation ID: `createImprovement`
- 依頼を作る。件名を廃止し、本文 1000 字・プライバシー確認 2 つを検証する。サーバでマスクを掛け、`seq` を採番し、作成の履歴を同じ batch で書く (I4・I6)。現行は `routes/improvement.ts:130`。

#### 認証・認可

セッション cookie。作る行の `user_id` はセッションの利用者。

#### Request

`multipart/form-data`。欄は次のとおり。`body` (必須、文字列)、`route` (任意、500 字まで)、`privacyConfirmed` と `privacyConsented` (必須、どちらも `"true"`)、`diagnostics` (任意、JSON 文字列)、`screenshot` (任意、JPEG/PNG、2MB 以下)。プライバシー確認の欄名は **agent 推定・利用者未確認**。旧 `title` 欄が来ても無視する (**agent 推定・利用者未確認**)。

#### Response

201 `{ "request": ImprovementRequestView, "number": string, "prompt": string }`。`prompt` の原文トークンは作成時にしか返らない (現行)。

#### Validation・ビジネスルール

- 本文が空または 1000 字超、プライバシー確認の欠け、形式外 (マジックバイトで JPEG/PNG でない) の画像、2MB 超の画像は 400。現行は画像の不適合を投稿の失敗にせず、`screenshotRejected` で返していた。これを S4 に従って 400 に変える。
- 本文・関連ページ・診断に、保存前に core のマスクを掛ける (辞書つき)。
- 状態は `open` で作る。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | invalid_request | 本文の欠け・超過、プライバシー確認の欠け、画像の形式外・2MB 超 | no | 送信ボタンの近くに理由を出し、入力を保つ |
| 401 / 403 / 503 | 既存の値 | 一覧と同じ | 一覧と同じ | 入力を保つ |

#### 実行セマンティクス

1. 検証する。
2. 取引先名の辞書を 1 本のクエリで読み、マスクを掛ける。
3. 画像を R2 (`improvements/{userId}/{requestId}.jpg`、キーの形は変えない) に置く。
4. D1 batch 1 つで、採番表の更新・依頼の行の INSERT・作成の履歴の INSERT を書く。
5. D1 が失敗したら R2 の画像を消す (現行)。

べき等ではない (同じ内容の 2 回の送信は 2 件になる)。画面は送信中にボタンを止めて二重送信を防ぐ。

#### キャッシュ・ページング

N/A: 作成は 1 件でページングしない。成功後、画面は一覧と詳細の query を無効化する。

#### 可観測性と監査

失敗は code だけを残す。本文・診断・画像・トークンはログに出さない。作成の事実は履歴に残る。

#### セキュリティ確認

サーバのマスクはクライアントのマスクに依存しない (O2)。画像はマジックバイトで確かめる。トークンは SHA-256 のハッシュだけを保存する (現行)。

#### Contract tests

- Positive: 201 で `seq` が前回 + 1、作成の履歴が 1 行。
- Boundary: 1000 字ちょうどは 201、1001 字は 400。2MB ちょうどは 201、それを 1 バイト超えると 400。
- Negative: 空の本文、プライバシー確認の片方の欠け、PNG の拡張子で中身が別形式の画像は、どれも 400。
- マスク: 7 種 (口座・取引先名・金額・個人名・メール・電話・住所) と秘匿値を含む本文を、クライアントのマスクなしで送る。保存された本文と診断に 1 つも残らない (O2)。
- 採番: 削除した依頼の番号が次の作成で再利用されない。

### POST /api/improvements/:id/status

#### 識別と目的

- Operation ID: `changeImprovementStatus`
- 状態を変える。遷移の可否は core が判定し、変更の履歴を同じ batch で書く (qa-imp-backend-web-001)。現行は `routes/improvement.ts:374`。

#### 認証・認可

セッション cookie。`user_id` が一致し、削除中でない行だけ。

#### Request

JSON `{ "status": "open" | "in_progress" | "done" | "reconfirm" }`。

#### Response

200 `{ "request": ImprovementRequestView, "activity": ImprovementActivityView }`。

#### Validation・ビジネスルール

- 候補外の状態は 400。
- 今の状態から core が許さない遷移は 409 `invalid_transition` とする (code と HTTP は **agent 推定・利用者未確認**)。
- 今と同じ状態を送ったら、何も書かずに 200 で今の行を返す (べき等。**agent 推定・利用者未確認**)。
- `done` に入ったら `done_at` を付け、`done` から出たら外す (現行)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | invalid_request | 候補外の状態 | no | 画面を読み直す |
| 404 | not_found | 存在しない・他の利用者・削除中 | no | 選択を外す |
| 409 | invalid_transition | core が許さない遷移 | no | 詳細を取り直し、許される遷移だけを出す |
| 401 / 403 / 503 | 既存の値 | 一覧と同じ | 一覧と同じ | 一覧と同じ |

#### 実行セマンティクス

依頼の行の UPDATE (`WHERE user_id = ? AND id = ? AND deleted_at IS NULL AND status = 読んだ時点の状態`) と、履歴の INSERT を 1 つの D1 batch で書く。読んだ後に別の変更が入っていたら、UPDATE は 0 行になる。そのときは 409 を返す (楽観的な照合。**agent 推定・利用者未確認**)。

#### キャッシュ・ページング

N/A: 1 件の更新。成功後、画面は一覧と詳細の query を無効化する。

#### 可観測性と監査

変更は履歴 (前後の状態・時刻) に残る。ログには code だけを残す。

#### セキュリティ確認

他の利用者の id は 404。状態の値は zod の列挙で検証する。

#### Contract tests

- Positive: 受付から対応中へ変えると 200 で、履歴が 1 行増える。完了へ入ると `done_at` が付き、出ると外れる。
- Boundary: 同じ状態を送ると 200 で、履歴は増えない。
- Negative: 候補外の値 (旧 `wontfix` を含む) は 400。許されない遷移は 409。他の利用者と削除中は 404。

### POST /api/improvements/:id/prompt

#### 識別と目的

- Operation ID: `reissueImprovementPrompt`
- 再発行。トークンを作り直して旧ハッシュを上書きし、前の指示文を即座に失効させる。再発行の履歴を書く (qa-imp-auth-web-001)。現行は `routes/improvement.ts:311`。

#### 認証・認可

セッション cookie。`user_id` が一致し、削除中でない行だけ。

#### Request

path `id`。body なし。

#### Response

200 `{ "prompt": string, "expiresAt": string }` (現行の形)。指示文の件名の位置には概要を載せる。

#### Validation・ビジネスルール

- 添付が期限切れ (`purged_at` あり) の依頼は 410 `attachment_purged` (現行)。
- トークンの有効期限は 24 時間、取得は 20 回まで (現行の `IMPROVEMENT_TOKEN_TTL_MS`・`IMPROVEMENT_TOKEN_MAX_FETCH`)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 404 | not_found | 存在しない・他の利用者・削除中 | no | 選択を外す |
| 410 | attachment_purged | 添付が期限切れで消えている | no | 「保持期限を過ぎて添付が削除されているため、指示文は作れません」を出す |
| 401 / 403 / 503 | 既存の値 | 一覧と同じ | 一覧と同じ | 一覧と同じ |

#### 実行セマンティクス

トークンのハッシュ・期限・取得回数の UPDATE と、再発行の履歴の INSERT を 1 つの D1 batch で書く。べき等ではない (呼ぶたびに新しいトークンになり、前のものは失効する)。

#### キャッシュ・ページング

`Cache-Control: private, no-store`。N/A: ページングしない。

#### 可観測性と監査

トークンの原文はログにも履歴にも出さない。再発行の事実だけを履歴に残す。

#### セキュリティ確認

再発行後に旧トークンで agent の 2 経路を叩くと 401 になる。

#### Contract tests

- Positive: 200 で新しい指示文が返り、履歴が 1 行増える。
- Negative: 旧トークンでの agent 取得が 401。期限切れの添付は 410。削除中は 404。他の利用者は 404。

### DELETE /api/improvements/:id

#### 識別と目的

- Operation ID: `deleteImprovement`
- 依頼を論理削除する (qa-imp-decision-003)。詳細パネルの『このリクエストを削除』が呼ぶ。新設の経路 (backend 章の設計知識の適用。経路名は **agent 推定・利用者未確認**)。

#### 認証・認可

セッション cookie。`user_id` の一致する行だけ。

#### Request

path `id`。body なし。

#### Response

200 `{ "id": string, "deletedAt": string }`。

#### Validation・ビジネスルール

- 削除中でない行に `deleted_at` を付け、削除の履歴を 1 行書く。
- すでに削除中の自分の行には何も書かず、200 で同じ `deletedAt` を返す (べき等、backend 章の設計知識の適用)。
- 画像・トークン・履歴は消さない。削除中は agent の 2 経路が 404 を返すので、トークンは失効させずに残す (**agent 推定・利用者未確認**)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 404 | not_found | 存在しない・他の利用者・完全消去済み | no | 一覧を取り直す |
| 401 / 403 / 503 | 既存の値 | 一覧と同じ | 一覧と同じ | 一覧と同じ |

#### 実行セマンティクス

`UPDATE improvement_requests SET deleted_at = 現在, updated_at = 現在 WHERE user_id = ? AND id = ? AND deleted_at IS NULL` と、削除の履歴の INSERT を 1 つの D1 batch で書く。UPDATE が 0 行なら行を読み直し、削除中の自分の行なら 200、無ければ 404 を返す。

#### キャッシュ・ページング

N/A: 1 件の更新。成功後、画面は一覧と詳細の query を無効化し、選択を外す。

#### 可観測性と監査

削除の事実は履歴に残る。ログには code だけを残す。

#### セキュリティ確認

他の利用者の id は 404。削除中の依頼は、agent の 2 経路を含むすべての読み取り経路から見えない。

#### Contract tests

- Positive: 200 の後、一覧と件数に 0 件。詳細・画像・指示文・コピー記録・状態・agent の 2 経路・関連する依頼がすべて 404 またはその依頼を含まない。
- Boundary: 2 回目の DELETE も 200 で、`deletedAt` は変わらない。
- Negative: 他の利用者の id は 404 (O4)。

### POST /api/improvements/:id/restore

#### 識別と目的

- Operation ID: `restoreImprovement`
- 論理削除した依頼を、同じ id と IMP 番号のまま戻す (qa-imp-decision-003)。削除完了トーストの『元に戻す』が呼ぶ。新設の経路 (backend 章の設計知識の適用。経路名は **agent 推定・利用者未確認**)。

#### 認証・認可

セッション cookie。`user_id` の一致する行だけ。

#### Request

path `id`。body なし、または空の JSON `{}`。

#### Response

200 `{ "request": ImprovementRequestView, "number": string }`。

#### Validation・ビジネスルール

- 削除中の行から `deleted_at` を外し、復元の履歴を 1 行書く。
- 削除中でない自分の行には何も書かず、200 で今の行を返す (べき等)。
- 完全消去済みの id は 404。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 404 | not_found | 存在しない・他の利用者・完全消去済み | no | トーストに「この改善リクエストはもう戻せません」(文言は **agent 推定・利用者未確認**) |
| 401 / 403 / 503 | 既存の値 | 一覧と同じ | 一覧と同じ | 一覧と同じ |

#### 実行セマンティクス

`UPDATE improvement_requests SET deleted_at = NULL, updated_at = 現在 WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL` と、復元の履歴の INSERT を 1 つの D1 batch で書く。`seq` は変えない。

#### キャッシュ・ページング

N/A: 1 件の更新。成功後、画面は一覧と詳細の query を無効化し、戻した依頼を選ぶ。

#### 可観測性と監査

復元の事実は履歴に残る。ログには code だけを残す。

#### セキュリティ確認

他の利用者の id は 404。戻した後は、削除の前と同じ経路で同じ結果が読める。

#### Contract tests

- Positive: 削除から復元までで、同じ id と `seq` が一覧に戻る (O4)。履歴に削除と復元の 2 行が残る。
- Boundary: 削除中でない行の restore は 200 で、`updated_at` は変わらない。
- Negative: 他の利用者の id は 404。完全消去後の id は 404。

### 既存経路の変更

- `GET /api/improvements/:id/screenshot` (`routes/improvement.ts:267`)・`POST /api/improvements/:id/copied` (:359): 条件に `deleted_at IS NULL` を足し、削除中は 404 にする。応答の形は変えない。
- agent の 2 経路 `GET /api/improvements/:id/agent/data` (:443)・`GET /api/improvements/:id/agent/screenshot` (:472): 使い捨てトークンの認証 (`agentGuard`) はそのまま使う。照合の条件に `deleted_at IS NULL` を足し、削除中・完全消去済みの依頼では 404 を返す (auth 章の上流指針)。`agent/data` の `request.title` は、件名の代わりに概要を返す (**agent 推定・利用者未確認**)。`status` は新しい 4 値で返る。
- 孤立画像の照合 (`improvement-orphan-sweep.ts`) は、削除中の行の画像を「対応する行がある」と数える。完全消去より先に画像を消さないためである (**agent 推定・利用者未確認**)。

## データモデル

migration `0054` (`migrations/0054_improvement_request_screen.sql`) で、`improvement_requests` を作り直し、表を 2 つ足す (qa-imp-database-web-001)。現行の表は `migrations/0029_improvement_requests.sql` にあり、仕様策定時の最新 migration は `0052_cash_entry_owner_soft_delete.sql` だった (qa-imp-database-web-evidence-001)。その後 `0053_import_inspections.sql` が先に入ったため、本機能は 0054 を使用する。

### improvement_requests (作り直し)

新しい表を作り、行を写し、古い表を消し、名前を変える。既存の行・画像のキー・トークンのハッシュは 1 件も落とさない (database 章の上流指針)。

| 列 | 変更 |
| --- | --- |
| `title` | NULL を許す。値があるときだけ 1〜120 字の CHECK を掛ける。既存行の値は残し、新規行は NULL にする。 |
| `body` | 現行の 1〜4000 字の CHECK を保つ。1000 字は core と zod で新規と編集だけに掛ける (C2。DB の上限を据え置くのは **agent 推定・利用者未確認**)。 |
| `status` | CHECK を `('open','in_progress','done','reconfirm')` に替える。`wontfix` の行は `done` へ移す。 |
| `seq` | 追加。INTEGER NOT NULL。`UNIQUE(user_id, seq)`。既存行は利用者ごとに作成順で採番する。 |
| `deleted_at` | 追加。TEXT、NULL は削除中でない。 |
| `done_at` | `wontfix` から移した行で NULL だったものは、0054 の適用時刻を入れる。適用直後に添付が消えないようにするためである (**agent 推定・利用者未確認**)。 |
| その他 | `id`・`user_id`・`route`・`screenshot_key`・`screenshot_size`・`diagnostics_json`・`diagnostics_omitted`・`token_hash` (UNIQUE)・`token_expires_at`・`token_fetch_count`・`copied_at`・`copied_target`・`purged_at`・`created_at`・`updated_at` はそのまま写す。 |

索引: 既存の `idx_improvement_requests_user (user_id, created_at)` と `idx_improvement_requests_purge (status, done_at) WHERE purged_at IS NULL` を作り直す。完全消去の検索のために `(deleted_at) WHERE deleted_at IS NOT NULL` を足す (**agent 推定・利用者未確認**)。

### 採番表 (追加)

利用者ごとの最後の `seq` を持つ。削除しても戻さない。作成時に依頼の行と同じ batch でだけ更新する。表名 `improvement_request_counters`・列 `user_id` (PK)・`last_seq` は **agent 推定・利用者未確認**。既存の利用者には、0054 で既存行の最大 `seq` を入れる。

### アクティビティの表 (追加)

1 行 1 事実の追記専用の表。依頼の行が消えると ON DELETE CASCADE で一緒に消える (qa-imp-database-web-001)。表名 `improvement_request_activities`、列 `id` (PK)・`request_id` (FK)・`user_id`・`kind`・`from_status`・`to_status`・`created_at` は **agent 推定・利用者未確認**。本文・トークン・診断は入れない。0054 は `wontfix` から移した行ごとに `migrated_wontfix` の 1 行を入れる。既存行の作成の履歴は、`created_at` を時刻にして 1 行ずつ入れる (**agent 推定・利用者未確認**)。

### 保存しない導出値

概要・IMP 番号の表示形・件数・関連する依頼・診断の表示用要約は保存しない (database 章の設計知識の適用)。

### 所有・保持・移行

- すべての行は `user_id` で所有する。
- 保持: 完了から 30 日で添付を消す (現行)。論理削除から 30 日で行・履歴・画像を消す。
- `schema-guard.ts:4` の `EXPECTED_D1_MIGRATION` を 0054 のファイル名へ進める。`deletion-schema.test.ts:63` の最新番号の固定も進める。migration 前の D1 では、Worker は新しい経路を 503 で止める。
- 改善リクエストの表 (追加の 2 表を含む) を `BACKUP_SNAPSHOT_SQL` (`store.ts:802`、:796 の禁止コメント) へ入れない (C3)。追加の 2 表をこの禁止に含めるのは **agent 推定・利用者未確認**。
- Drizzle のスキーマ (`improvement/contract.ts:31` の `improvementRequests`) と `IMPROVEMENT_STATUS_VALUES`・`IMPROVEMENT_STATUS_LABEL` (`core/src/improvement.ts:333`・:340、現行は 未対応 / 対応中 / 対応済み / 対応しない) を新しい 4 状態へ揃える。

## 認証・認可

- 画面の経路はすべて、既存のセッション Cookie (HttpOnly・Secure・SameSite=Strict) と authGuard の配下に置く。route の中で個別の認可判定を書かない (qa-imp-auth-web-001)。
- 全クエリを `user_id` で絞る。他の利用者の依頼は、取得・画像・指示文・コピー記録・状態の変更・再発行・削除・復元のどれでも 404 にそろえる (auth 章の上流指針)。
- agent の 2 経路は使い捨てトークン (接頭辞 `imp_`、SHA-256 のハッシュで保存、24 時間・20 回まで) だけで認証する。再発行すると旧トークンは即失効し、削除中の依頼には agent 経路からも届かない (qa-imp-auth-web-001)。
- 役割 (`auth.ts:41` の admin|member) と adminGuard は使わない。単一利用者の運用で、新しい資格情報の種類・権限・役割は作らない。
- 未ログイン時は共通シェルの locked 表示のままで、右下の『改善を送る』を出さない (現行 `Layout.tsx:523`)。

## エラー・例外・回復

- 一覧の取得失敗: 読み込み失敗と『再読み込みする』を出す。作成フォームの入力 (メモリ上) は保つ。
- 送信失敗: 送信ボタンの近くに理由を出し、入力と画像を保つ。400 の欄ごとの理由があれば、該当の欄の近くにも出す。
- 撮影の失敗: 画像なしで作成フォームへ移り、「画面を撮影できませんでした。画像なしでも送れます」を出す (文言は **agent 推定・利用者未確認**)。撮影の失敗は投稿の失敗にしない (現行の方針)。
- コピーの失敗: 指示文を読み取り専用の欄に出す。
- 状態の変更の 409: 詳細を取り直し、許される遷移だけを出す。
- 削除・復元の 404: 一覧を取り直し、トーストで伝える。
- 再発行の 410: 添付が消えたことを文で出し、コピーの操作を無効にする。
- 再試行: 503 と通信失敗だけが再試行の対象で、自動の再試行はしない。利用者の『再読み込みする』で取り直す。
- べき等: 削除・復元と、同じ状態への変更はべき等。作成と再発行はべき等ではなく、画面が送信中の二重押しを止める。
- 同時更新: 状態の変更は読んだ時点の状態で照合する (**agent 推定・利用者未確認**)。

## イベント・非同期処理

- Producer/Consumer: 新しいキュー・イベントは作らない。夜間の scheduled 処理 `0 18 * * *` の `improvement_retention` に完全消去を相乗りさせ、新しい Cron は足さない (qa-imp-infrastructure-web-001、C3)。
- D1 クエリの予算 (D-imp-008、qa-imp-decision-008): `SCHEDULED_MAINTENANCE_D1_PLAN` (`scheduled-maintenance-budget.ts:78`) を次のとおり変える。合計 49 は変えない。
  - `improvement_retention` を 3→4 本 (:87)。4 本は、期限の検索・添付を消す UPDATE・削除中の行の DELETE・孤立画像の照合である。
  - `audit_header_retention` を 3→2 本 (:91)。削除前の件数と容量の読み取りを外し、削除と削除後の件数と容量だけにする。削除前の件数は、削除後の件数と消した件数の和で出す。
- 完全消去の手順: 期限の検索 1 本で、次の 2 種類を古い順に読む。完了から 30 日を過ぎた添付と、削除から 30 日を過ぎた行である。1 晩に 500 件まで読み、超えた分は翌晩に続ける (infrastructure 章の上流指針)。R2 の画像は 1 件ずつ消し、成功した行だけを D1 の DELETE (履歴は CASCADE) に渡す。失敗した行は翌晩もう一度対象になる。2 種類を 1 本の検索にまとめる SQL の形は **agent 推定・利用者未確認**。
- 順序と重複: R2 の削除はべき等で、D1 の DELETE は `deleted_at` の条件つきである。同じ行を 2 晩続けて処理しても結果は変わらない。
- DLQ: N/A: 失敗した行は翌晩に自動で再び対象になり、別の退避先を持たない。

## 可観測性

- 夜間の完全消去の結果 (対象件数・消した件数・失敗件数) は、既存の job ごとの JSON ログ (`index.ts:290-296` の `improvement_retention`) に足す。本文・利用者 ID・R2 のキーは載せない (maintenance-ops 章の上流指針)。
- `audit_header_retention` のログは削除前の容量 (bytes) を失う。削除前の件数は計算で出し続ける (D-imp-008)。
- API のエラーは既存の流儀で code を残す。本文・検索語・診断・トークン・利用者 id はログに出さない。
- 利用者の操作 (作成・状態の変更・再発行・削除・復元) の監査は、アクティビティの表に残る。
- 新しいダッシュボード・アラートは足さない。

## 互換性・移行・リリース

- 経路 `/improvement` は変えない。`routeMetadata.ts:385` の題名を『改善リクエスト | Focus Ledger』へ変え、:370 の分類 `'reading'` は保つ。
- 旧 `pages/Improvement.tsx` は `pages/improvement/` の実体の再輸出 1 行にする。`AuthenticatedApp.tsx:9-10` の遅延読み込み、`common-shell-routes.dom.test.tsx:32,56` のモック、`display-contract.test.tsx:20` の `NON_ROUTED_PAGES` が引き続き解決するようにする (**agent 推定・利用者未確認**)。
- `ImprovementRequestButton.tsx` の投稿モーダル (件名・本文) は撮影パネルを開く入口に置き換える。`improvement-capture.dom.test.tsx` を新しい流れに合わせて書き直す。
- web の API 呼び出し (`api.ts:1332-1410`) は新しい応答の形へ揃える。`ImprovementStatus` の 4 値が変わるので、型の変更が web と api に同時に入る。
- 0054 の適用手順は runbook に置く (qa-imp-maintenance-ops-web-001、maintenance-ops 章の上流指針)。
  1. D1 のバックアップ (Time Travel の復元点の記録) を取る。
  2. migration 0054 を適用する。
  3. Worker をデプロイする。
- 戻し方: 0054 の失敗時は、記録した復元点へ D1 を戻す。Worker だけを旧版へ戻す場合、schema guard は新しい番号を許容するため、旧コードが 0054 の表を読む。作成時の `seq` 不足や `reconfirm` の表示など互換性を確認し、必要に応じて runbook の Time Travel 復元と旧 Worker の配信を組にする。
- 旧 `wontfix` を送る古いクライアントは 400 になる。web と api は同じデプロイで出すので、実害は無い想定である。
- `docs/improvement-request.md` を更新する (qa-imp-maintenance-ops-web-001)。対象は、新しい状態、論理削除と完全消去、マスクの対象、撮影の流れ。`architecture/arch-improvement-request-pipeline.md` との整合も取る。
- 新しい secret・binding・外部サービスの登録は発生しない。

## テストと受入条件

core 単体テスト (vitest、`packages/core/src/improvement-screen.test.ts` ほか。ファイル名は **agent 推定・利用者未確認**):

- [ ] AC-001: 状態の遷移表の全組み合わせで、許される遷移と許されない遷移が表のとおりに判定される (O3)。
- [ ] AC-002: 概要が本文の最初の空でない行から最大 40 字で切られる。空行が先頭にある本文と 40 字ちょうどの本文で確かめる (O3)。
- [ ] AC-003: IMP 番号が 1→`IMP-001`、24→`IMP-024`、1000→`IMP-1000` になる。
- [ ] AC-004: 検索・件数タブ・ページング (10 件ずつ、範囲外のページ、全角半角・大小の同一視、100 字の切り詰め) と、関連する依頼 (同じ route・新しい順・最大 3 件・自分と削除中を除く) を `toEqual` で固定する。
- [ ] AC-005: アクティビティの 6 種類の見出しと説明、診断の表示用要約 (OS・ブラウザ・画面サイズ・利用環境・末尾 4 桁のセッション ID) を固定する。
- [ ] AC-006: マスクで、7 種 (口座・取引先名・金額・個人名・メール・電話・住所) と秘匿値の各例が伏せられる (O2)。取引先名と個人名は辞書で当たる。

API テスト:

- [ ] AC-007: 上の各経路の Contract tests が通る。
- [ ] AC-008: 削除してから元に戻すと、同じ id と番号が戻る。削除中の行は一覧と件数に 0 件。他の利用者の依頼は、取得・画像・指示文・コピー記録・状態・再発行・削除・復元のすべてで 404 (O4)。
- [ ] AC-009: クライアントのマスクを飛ばした投稿にも、サーバで同じ規則が掛かる (O2)。
- [ ] AC-010: 30 日を過ぎた論理削除の行について、夜間の完全消去で R2 の画像・行・履歴が消える。R2 の削除に失敗した行は残り、翌晩の対象になる (O4)。
- [ ] AC-011: `BACKUP_SNAPSHOT_SQL` に改善リクエストの表が無い (`improvement-backup-exclusion.test.ts`・`improvement-retention.test.ts` の既存の固定を保つ) (O4)。
- [ ] AC-012: `scheduled-maintenance-budget.test.ts` で、`improvement_retention` が 4 本、`audit_header_retention` が 2 本、合計 49 になる。
- [ ] AC-013: 0054 の前後で、既存行の id・画像のキー・トークンのハッシュが一致する。`wontfix` の行は `done` と `migrated_wontfix` の履歴 1 行になり、`seq` は作成順になる。

DOM テスト (`packages/web/src/pages/improvement/improvement-screen.dom.test.tsx`、ファイル名は **agent 推定・利用者未確認**):

- [ ] AC-014: 次の要素の存在を確かめる (O1)。問いの見出し、作成フォームの全項目と本文の文字数、マスキングの説明、一覧の検索・5 つの件数タブ・表・ページング、詳細パネルの全区画 (IMP 番号と状態・本文・添付画像と拡大・診断・アクティビティ・関連する依頼・操作 5 つ)、空状態、読み込み失敗と再読み込み、キャプチャ浮動パネル、選択中バー、コピー完了トースト。
- [ ] AC-015: プライバシー確認 2 つのどちらかが未チェックのとき、送信できない。1000 字を超えたときも送信できない (O1)。
- [ ] AC-016: 撮影用の複製で、`data-capture-mask` の要素の金額・取引先名・名義の文字が伏字になる (O2)。
- [ ] AC-017: URL の `id` / `tab` / `q` / `page` から同じ一覧と詳細が復元される。
- [ ] AC-018: 削除すると完了トーストの『元に戻す』が出て、押すと同じ番号で戻る。
- [ ] AC-019: 状態が文字ラベルでも示される。直書き色が 0。共通 Button を使っている。
- [ ] AC-020: 範囲選択が矢印キーと Enter で操作でき、選んだ範囲が文字で示される。

grep による検査 (O3):

- [ ] AC-021: web と api に、状態の遷移・概要の切り出し・IMP 番号の整形・件数・関連する依頼・マスクの正規表現が、core 以外に 0 件である。

画面の描画検査:

- [ ] AC-022: `packages/web/package.json` に `check:improvement-screen` (`KANJO_VISUAL_SCOPE=improvement node scripts/check-financial-visuals.mjs`) を足し、ルートの `verify:full` に組み込む。前例は同 package.json:24 の `check:cash-screen` (**agent 推定・利用者未確認**)。

全体:

- [ ] AC-023: `pnpm lint`・`typecheck`・`test`・`skills:test`・初期 JS 予算 (build:bundle の直後)・`verify:full` (4175 の vite が前提) が全て exit 0 (O4、qa-imp-maintenance-ops-web-001)。CI の headless Chrome は pointer:none なので、範囲選択の検査はポインタの有無に依らない形で書く。
- 受入は、実行済みの最新のテスト証跡だけで判定する。未実施・一部適合・既知の逸脱が 1 件でも残る項目は PASS にしない。

## 計画時の論点と結論

以下は仕様策定時の論点を残した記録である。現在の実装判断は [`docs/improvement-screen/design-decisions.md`](../docs/improvement-screen/design-decisions.md) §2、実行手順は [`docs/improvement-request.md`](../docs/improvement-request.md) §2.4 を正本とする。

決着済み (本文の該当箇所へ統合した):

- 状態は 受付 / 対応中 / 完了 / 再確認 で、再確認は利用者の確認待ち。wontfix は完了へ移す (qa-imp-decision-001)。
- 件名欄を廃止し、概要は本文の先頭行から最大 40 字、本文は 1000 字 (qa-imp-decision-002)。
- 論理削除と『元に戻す』、30 日後の完全消去 (qa-imp-decision-003)。画像は撮影時の伏字と送信前確認、本文・診断はサーバ再マスク (qa-imp-decision-004 の実装境界)。対象は web のみ (qa-imp-decision-005)。関連する依頼は同じ関連ページから自動 (qa-imp-decision-006)。番号は利用者ごとの連番で、範囲選択の撮影も作る (qa-imp-decision-007)。
- 夜間予算は audit_header_retention の枠を 1 本回す (D-imp-008、qa-imp-decision-008)。

計画時に持ち越した論点 (現在の結論は上記 design-decisions に記録):

- **一覧と共通の期間の関係。** G1 は共通の期間を描くとするが、一覧を期間で絞るかは決まっていない。本書は絞らないとした (FR-2)。
- **ブラウザ側での辞書マスク。** 取引先名・個人名の辞書は、サーバでリクエストのたびに作る (security 章)。ブラウザで送信前に同じ辞書を掛けるには、辞書をブラウザへ渡す経路が要る。その経路が無い場合、ブラウザの層は `data-capture-mask` の伏字と、辞書を使わない規則 (金額・電話・住所・口座・メール・秘匿値) だけになる。
- **撮り直しの導線。** 端末の画像ファイルを受け付けると、撮影用の複製の伏字を通らない画像が送れてしまう。撮り直しは関連ページへ戻って撮影パネルを開く 1 経路とし、端末のファイルは受け付けない。
- **コピーと再発行の関係。** 原文のトークンは作成時と再発行時にしか返らない。後日のコピーは再発行を伴い、前に配った指示文を失効させる。この動きをコピー前の画面で説明する。
- **関連ページの画面名の置き場所。** 経路と画面名の対応は web の `routeMetadata.ts` にある。core で導くには、この対応を core へ移すか、core に同じ表を持つ必要がある。
- **削除中のトークン。** 削除でトークンを失効させるか、残して agent 経路を 404 にするだけにするか。本書は後者とした。

未決 (agent 推定・利用者未確認のまま):

- 次の各項目は、利用者の確認で変わり得る。変わった場合は、core のテストの期待値と本書を同時に直す。
  - 遷移表、API の応答の細部と追加の経路名 (DELETE・restore)、プライバシー確認の欄名。
  - URL のキー名と既定、件数を検索後に数えること、概要の「…」、IMP 番号の桁と検索の当て方。
  - アクティビティの種類名・並び・文言、診断の利用環境とブラウザの伏せ方、マスクの正規表現の例。
  - 表名・列名・索引、wontfix の行の `done_at`、DB の本文の上限の据え置き、完全消去の検索の SQL の形。
  - 409 `invalid_transition`、`error.fields`、各種の文言、使い方リンクの行き先、確認ダイアログを出さないこと、見出し行の全選択を置かないこと。
  - `check:improvement-screen` の追加、テストのファイル名。
