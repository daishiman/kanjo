---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G2, G3, G4, G5]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-security-web-001。裏付け質疑 (`qa_refs`): `qa-classify-security-web-evidence-001`, `qa-classify-security-web-002` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、セキュリティでは端末紛失時に下書きやメモをどう消すかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、セキュリティでは共有端末に残る下書きとメモをどう保護するかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、セキュリティではデスクトップ版の自動更新の署名検証をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、セキュリティではデスクトップ版の配布経路の改ざん検知をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、セキュリティではネイティブ版のサンドボックス権限をどう絞るかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 明細仕分けでは、一括保存・ルール適用・保存フィルタの変更をフェンスへ登録して取込の洗替えと重ならない形へ反映した (ASVS V11 業務ロジック)。外部送信の経路を作らず、端末に残る下書きは保存成功で消し、証憑のアップロード面を持たない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5

#### 主たる接地根拠: `qa-classify-security-web-001`

**問**

明細仕分けのセキュリティ要件 (入力検証・変更の直列化・外部送信・ファイル・端末保存) は何か。

**答**

入力はすべて zod で検証し、メモ (200 字)・フィルタ名・キーワード・ルールの条件は長さを制限し、React の既定のエスケープで描画する。一括保存・ルール作成と適用・分割・保存フィルタの変更は canonicalMutationFence に登録し、取込の洗替えと直列化する。取込データを外部へ送信しない。提案と信頼度は外部の LLM を呼ばずに決定論で出す (qa-classify-decision-003)。証憑ファイルを受け付けない (qa-classify-decision-001)。下書きにはメモが入るため、保存成功で消し、サーバへ送らない。CSP (packages/web/public/_headers) は緩めない。一括保存は 1 回の件数に上限を置く。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/13-classify.png と、利用者承認 (appr-foundation-classify-001) の U1-U9、決定 qa-classify-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-security-web-evidence-001`

**問**

セキュリティ 章の裏付けとして、13-classify.png と現行実装の差分として何を観測したか。

**答**

canonical-mutation-fence.ts の CANONICAL_MUTATION_ROUTES (30〜80 行目) に PUT /transactions/:id/(class|edit)・PUT /transactions/:id/splits・POST /data/deletions・POST /data/undo/:opId などが登録され、登録の無い変更系は直列化されない。packages/api/src/ai は外部の LLM を呼んでいない。証憑は #42 で全廃され specs/attachments-and-transit.md は superseded。CSP は packages/web/public/_headers にある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 0003cb4) の読取りによる観測。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-security-web-002`

**問**

web の明細仕分け画面で、セキュリティ について利用者が決めていない具体値を何にするか。

**答**

上限は 一括保存 1 回 100 件、フィルタ名 40 字、キーワード 100 字、保存フィルタの条件 JSON 2000 字、ルールのプレビューの走査は表示期間の明細に限る。フェンスの登録は POST /api/transactions/bulk (tx_edits・tx_splits・tx_history)、POST /api/rules/:id/apply (rules・tx_edits・tx_splits・tx_history)、POST /api/saved-filters と DELETE /api/saved-filters/:id (saved_filters) とする。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-19T13:24:40Z)

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

OWASP ASVS の入力検証と業務ロジックの card を明細仕分けに適用した。一括保存は明細ごとに検証して失敗を個別に返すが、件数の上限で 1 要求の負荷を抑える。ルール適用は手動変更を上書きしないという業務規則をサーバ側の core で守り、画面の表示に頼らない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T13:24:40Z)

### Secure by Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/secure-by-design.md`

#### 目的

利用者の注意や運用後のpatchへ安全性を押し付けず、systemのdefault、architecture、development lifecycleに安全な結果を組み込み、被害可能性と復旧費を下げる。

#### 解決する問題

- 認証・認可・data protectionが後付けで、business flowと矛盾する。
- defaultが過大権限/公開状態で、利用者の完全な設定に安全性が依存する。
- 単一防御の突破で全面侵害になり、検知・封じ込め・復旧の証拠が無い。
- dependency、secret、build、releaseの供給chain riskが製品境界外として放置される。

#### 適用条件

- identity、個人/機密data、金銭、外部入力、admin操作、multi-tenant boundaryを扱う全system。
- compromise時の影響がgoal、法規、信頼、運用継続を損なう。
- vendor/serviceを使う場合も、共有責任とfailure/exit planを明示できる。

#### 非適用条件

- security自体が不要なsystemは原則ない。asset/threatが極小ならcontrolを軽量化できるが、根拠付きrisk acceptanceが必要。
- controlがthreatを減らさず、accessibility/availability/safetyを重大に損なう場合はそのcontrolを採用しない。代替・補償統制を設計する。
- checklist準拠だけでproject固有のtrust boundaryとabuse caseを置き換えない。

#### トレードオフ・失敗モード

- friction、latency、delivery費、運用負荷が増えるため、risk reductionと明示的に釣り合わせる。
- security theaterとしてcontrol数だけ増やし、owner、evidence、responseを持たない。
- fail closedを無差別適用してavailability/safety incidentを起こす。degraded modeとbreak-glass監査が必要。
- secretを隠しても過大権限や長期credentialを残す、暗号化してもkey lifecycleを設計しない等の局所最適。
- free tier製品を価格だけで選び、audit、export、retention、MFA、incident support不足を見落とす。

#### goalへの寄与

- stakeholderの安全・信頼・継続性をsuccess criteriaへ変換し、threat/control/evidenceをgoalへトレースする。
- security controlは「導入済み」ではなく、阻止/検知/復旧時間、権限範囲、data exposureで効果を測る。
- 予算0制約でも、secure default、最小data、短命credential、標準機能、open-source検査を優先し、残余riskを隠さない。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-19T13:26:35Z | 2026-09-19T13:26:35Z |
