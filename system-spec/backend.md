---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-backend-web-003。裏付け質疑 (`qa_refs`): `qa-classify-backend-web-evidence-001`, `qa-classify-backend-web-002`, `qa-classify-decision-005`, `qa-classify-decision-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、バックエンドではオフラインで仕分けた変更を一括保存へどう同期し衝突をどう解くかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、バックエンドではオフライン編集の下書きをサーバの履歴とどう突き合わせるかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、バックエンドではデスクトップ版からの一括保存の件数上限と再送をどう設計するかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、バックエンドではデスクトップ版が古い API 版で動くときの互換をどう保つかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、バックエンドではネイティブ版向けに提案と信頼度の API をどう版管理するかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 明細仕分けでは依存方向を core (分類ステータス・recommendationFor・ルールの該当と分割展開) ← api (classify route・一括保存・ルールのプレビューと適用・保存フィルタ・履歴) ← web の一方向へ反映した。ナビのバッジと月次クローズの『仕分け』は classificationProgress を置き換える新しい判定を参照し、同じ数え方を 2 か所に持たない。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 明細仕分けの api では、一括保存・ルール適用の書込を route に閉じ、core は D1 を知らない明細の行集合だけを受け取る形へ反映した。履歴の記録は各変更経路の書込と同じ D1 batch に入れ、書込は成功して履歴だけ欠ける状態を作らない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5

#### 主たる接地根拠: `qa-classify-backend-web-003`

**問**

明細仕分けのために core と api をどう変えるか。分類ステータス・提案と信頼度・一括保存・ルールのプレビューと適用・保存フィルタ・履歴の契約は何か。

**答**

core に分類ステータスの判定を 1 か所に新設し、各明細を 未整理 (利用者・ルール・MF 中項目のどれもまだ決めていない明細。提案の有無と信頼度は問わない) / 手動変更 (利用者が提案と異なる値で確定した明細。提案が無いまま利用者が決めた明細と、この変更より前の手入力の明細を含む) / 完了 (利用者が提案どおりに確定した明細と、ルール・MF 中項目が決めた明細) の 3 区分に排他で振り分け、和が全件に一致する。要確認は区分ではなく未整理の内訳で、提案の信頼度が 80% 未満・提案どうしの衝突・区分と名義の矛盾のいずれかがある未整理の明細を数える (qa-classify-decision-002・005)。利用者が確定したとき、区分・カテゴリ・所有者がすべてその時点の提案と一致すれば完了、1 つでも異なるか提案が無ければ手動変更とし、確定時の判断を明細の手当てに残して後から提案が変わっても区分が揺れないようにする (qa-classify-decision-006)。ルール・MF 中項目が決めた明細は完了で、その由来の信頼度は表示にだけ使い要確認には数えない。ナビのバッジは未整理の件数、月次クローズの『仕分け』は同じ判定の未整理から照合側で数える明細を除いた件数とし、現行の clsSrc=既定 と意味を変えない。提案カテゴリ・信頼度・根拠の文は recommendationFor を拡張し、過去の同取引先・ルール・MF 中項目のどの由来にも決定論の信頼度を付け、/transactions の各行に提案・信頼度・根拠・分類ステータスを載せる。外部の LLM は呼ばない (qa-classify-decision-003)。/transactions は期間・分類ステータス・カテゴリ・所有者・支払方法・手動変更のみ・キーワードで絞り込み、サーバ側で 50 件ずつ返す。選択した複数の明細を 1 回の要求で保存する一括保存を設け、明細ごとに検証と保存を行って成否を返し、成功分は取り消さない。ルールに取引先・キーワード・適用範囲 (一致する明細すべて / 未確定の明細だけ)・分割の型 (固定額の行と残額の行) を持たせ、作成前に該当する明細と適用後の仕訳の一覧と件数を返すプレビューと、同じ判定で適用する API を設ける。手動変更した明細はルールで上書きしない。保存したフィルタの保存・一覧・削除と、明細の取引の履歴の取得を設ける。全ての変更経路 (手動・一括・ルール・分割・削除と取消) で履歴を 1 件ずつ残す。入力は zod で検証し、変更系は canonicalMutationFence に登録する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり (完成度評価 high 指摘への差し戻し)。qa-classify-backend-web-001 を改訂 / 回答時刻: 2026-09-19T13:40:10Z)

#### 裏付け質疑: `qa-classify-backend-web-evidence-001`

**問**

バックエンド 章の裏付けとして、13-classify.png と現行実装の差分として何を観測したか。

**答**

現行 packages/api/src/routes/classify.ts は GET /transactions (94 行目)・PUT /transactions/:txId/class (265)・PUT /transactions/:txId/edit (310)・GET と PUT /transactions/:txId/splits (395・436)・GET /rules (559, 該当件数 hits 付き)・POST /rules (624)・PUT と DELETE /rules/:id (658・688) を持つ。支払方法は core/src/cash.ts の paymentMethodOf が機関名から導く値 (cash / card / account / unknown) で、/transactions の絞り込み (193 行目) に使われるが上書きの列は無い。core/src/overview.ts:246 の recommendationFor は vendor_memory 由来のときだけ信頼度が数値で、ルールと MF 中項目由来は null、利用は /review-queue に限られる。分類の進捗は core/src/classify.ts:335 の classificationProgress で、未確認は clsSrc === '既定' (346 行目)。月次クローズ (overview.ts:413-460) の『仕分け』は counts.classification を使う。一括保存・ルールのプレビュー・保存フィルタ・履歴の API は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 0003cb4) の読取りによる観測。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-backend-web-002`

**問**

web の明細仕分け画面で、バックエンド について利用者が決めていない具体値を何にするか。

**答**

エンドポイントは POST /api/transactions/bulk (1 回 100 件まで)・POST /api/rules/preview・POST /api/rules/:id/apply・GET / POST /api/saved-filters・DELETE /api/saved-filters/:id・GET /api/transactions/:txId/history とする。信頼度は 取引先の決め事 (vendor_memory) 由来は既存の値、取引先とキーワードの両方が一致するルールは 95、キーワードだけのルールは 85、MF 中項目の対応表は 70 とし、2 つ以上の由来が異なるカテゴリを提案する衝突では最小値から 20 を引く (下限 0)。区分と名義の矛盾は 区分=個人 かつ 所有者=事業、または 区分=事業 かつ 所有者が事業以外 とする。一括保存の応答は { results: [{ txId, ok, error? }] } とし、HTTP は部分失敗でも 200 を返す。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-decision-005`

**問**

明細の区分はどう数えるか (完成度評価で『どこにも入らない明細がある』『画像と食い違う』と指摘された点)。

**答**

要確認は未整理の内訳 (推奨)。未整理 = 利用者もルールも中項目もまだ決めていない明細すべて (提案の有無・信頼度は問わない)。要確認 = 未整理のうち信頼度 80% 未満・衝突・矛盾があるもの。手動変更と完了は確定済みの排他区分。未整理 + 手動変更 + 完了 = 全件。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり (完成度評価 high 指摘への差し戻し) / 回答時刻: 2026-09-19T13:40:10Z)

#### 裏付け質疑: `qa-classify-decision-006`

**問**

一覧や編集パネルで明細を『確定』したとき、どの区分に移すか。

**答**

提案どおりなら完了 (推奨)。提案をそのまま受け入れたものは完了、区分・カテゴリ・所有者のどれかを提案と違う値にしたものは手動変更。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり (完成度評価 high 指摘への差し戻し) / 回答時刻: 2026-09-19T13:40:10Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 分類ステータスと提案を core の純関数 1 か所に集める。各明細を 未整理 (利用者・ルール・MF 中項目のどれもまだ決めていない明細。提案の有無と信頼度は問わない) / 手動変更 (利用者が提案と異なる値で確定した明細。提案が無いまま利用者が決めた明細と、この変更より前の手入力の明細を含む) / 完了 (利用者が提案どおりに確定した明細と、ルール・MF 中項目が決めた明細) の 3 区分に排他で振り分け、和が全件に一致する。要確認は区分ではなく未整理の内訳で、提案の信頼度が 80% 未満・提案どうしの衝突・区分と名義の矛盾のいずれかがある未整理の明細を数える。ナビのバッジは未整理の件数、月次クローズの『仕分け』は同じ判定の未整理から照合側で数える明細を除いた件数とし (現行の clsSrc=既定 と同じ意味)、同じ関数から導かれることをテストで固定する。提案カテゴリ・信頼度・根拠の文は recommendationFor を拡張し、過去の同取引先・ルール・MF 中項目のどの由来にも決定論の信頼度を付け、/transactions の応答にも載せる。外部の LLM は呼ばず、表示は『自動提案』とする。
- **G3**: 選択した複数の明細を 1 回の要求で保存する一括保存を設ける。明細ごとの成否を返し、画面は『N 件のうち M 件を保存、K 件はエラー』と失敗した明細だけの再試行を示す。成功分は取り消されない。削除は既存の取消 (undo) で元に戻せる。一括保存・ルール作成・ルール適用・保存フィルタの変更は既存の canonicalMutationFence の内側に置く。
- **G4**: 『この条件をルールにする』で取引先・キーワード・適用範囲 (一致する明細すべて / 未確定の明細だけ) を選んでルールを作り、作成前に該当する明細と適用後の仕訳 (カテゴリ・分割の内訳) の一覧と件数をプレビューで確かめてから適用できるようにする。分割の内容もルールにでき、固定額の行と残額の行で同じ条件の明細を同じ形に分ける。該当する既存のルールと、そのルールの対象件数を編集パネルに示す。手動変更した明細はルールで上書きしない。
- **G5**: 仕分けの作業状態を失わない。保存したフィルタは D1 に新しい表を追加のみの migration で設け、名前付きで保存・呼出・削除できる。取引の履歴は D1 に明細の変更履歴表を追加のみで設け、いつ・何が (区分・カテゴリ・所有者・支払方法・メモ・分割)・どの由来 (自動提案 / 手動 / ルール / 一括保存) で変わったかを残し、編集パネルに新しい順で出す。編集パネルの下書きは端末の localStorage に明細単位で自動保存し、最終保存時刻を表示し、保存に成功したら消し、次回に『下書きを復元』できる。未保存のまま離れるときは確認する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 未整理・手動変更・完了の件数が排他で閉じ、要確認が未整理の内訳に収まり、他画面と一致する。 | core の単体テストで、同じ Dataset と期間に対し 未整理 + 手動変更 + 完了 = 全件、各明細がちょうど 1 区分に入り、要確認 ⊆ 未整理、未整理の明細で信頼度 80% の境界 (79 は要確認・80 は要確認でない) と衝突・矛盾の各規則、提案どおりの確定は完了・提案と異なる確定は手動変更になることが固定され、ナビのバッジと月次クローズの『仕分け』の件数が同じ関数から出る。 |
| O3 | 一括保存の部分失敗が報告され、失敗分だけ再試行できる。 | API 統合テストで、3 件中 1 件が検証エラーの一括保存が 2 件を保存して明細ごとの結果を返し、再試行が失敗分だけを送ることを DOM テストで確かめる。未認証 401・変更系フェンス違反の拒否・上限件数超過の 400 を確かめる。 |
| O4 | ルールのプレビューと適用結果が一致する。 | core の単体テストで、プレビューが列挙した明細と件数が、適用後に実際に変わった明細と一致し、手動変更の明細が変わらず、分割ルールの各行の和が元の金額に一致する。 |
| O5 | 作業状態が失われない。 | API 統合テストで保存フィルタの作成・一覧・削除と、各変更経路で履歴が 1 件ずつ残ることを確かめ、migration が既存行を 1 行も書き換えないことを検査する。DOM テストで下書きの自動保存・復元・保存成功での消去・離脱確認を確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に分類ステータス判定 (仮称 classifyStatus) を新設し、3 区分の排他判定と要確認の内訳・件数集計を 1 か所で行い、サイドバーのバッジと月次クローズの『仕分け』もここを参照させる。
- **I3**: recommendationFor を拡張し、ルール・MF 中項目由来にも決定論の信頼度を付け、根拠の文を由来ごとに整え、/transactions の各行に提案・信頼度・根拠・ステータスを載せる。
- **I4**: 一括保存 API を新設し、明細ごとに検証と保存を行って成否の配列を返す。画面は部分失敗の通知と失敗分だけの再試行を出す。
- **I5**: ルールに取引先・適用範囲・分割の型 (固定額の行と残額の行) を持たせる追加のみの migration と、作成前プレビュー・適用 API を設ける。
- **I6**: 保存フィルタ表と明細の変更履歴表を追加のみで設け、全変更経路 (手動・一括・ルール・分割・削除と取消) で履歴を 1 件ずつ残す。
- **I7**: 編集パネルの下書きを localStorage に明細単位で自動保存し、保存時刻の表示・復元・保存成功での消去・未保存の離脱確認を行う。

### 本章に効く確定意思決定

- **dec-classify-confidence-source**: 一覧の信頼度と自動提案をどう算出するか。
  - 採択: 既存規則の拡張・外部送信なし (`opt-deterministic`)
  - 目的適合: G2 の決定論と『取込データは外部送信しません』の約束に一致する。
- **dec-classify-state-storage**: 保存したフィルタ・下書き・取引の履歴の保存先をどうするか。
  - 採択: フィルタと履歴は D1、下書きは端末 (`opt-d1-and-local`)
  - 目的適合: 共有と監査が要るものは D1、頻繁に変わる下書きは端末に置き G5 を満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture の Dependency Rule を明細仕分けに適用した。4 区分の判定・信頼度・ルールの該当と分割の型の展開は入出力を持たない計算なので core に置き、api の route は zod で受けて D1 から組んだ入力を純関数へ渡し、結果を書くだけにする。プレビューと適用が同じ core 関数を通るため、S4 の『プレビューの件数と適用後に変わった明細が一致する』を単体テストで確かめられる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T13:24:40Z)

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| hono-zod-validator | 0.9.1 | Hono (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-19T13:26:35Z | 2026-09-19T13:26:35Z |
