---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G4]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-cash-security-web-005。裏付け質疑 (`qa_refs`): `qa-cash-security-web-evidence-001`, `qa-cash-security-web-003`, `qa-cash-decision-006`, `qa-cash-decision-009` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、security では端末紛失時に下書きと明細キャッシュを遠隔で消す手段を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、security では共有端末で下書きに残る金額と内容の見え方を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、security では配布バイナリの署名と自動更新経路の改ざん対策を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、security ではパッケージ配布経路 (deb / rpm / AppImage) の署名を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、security では公証 (notarization) とサンドボックスの権限を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 現金明細の入力面を、許可リスト (名義・業務の目的・収支・事業 / 個人)、字数、金額の範囲、一括削除と一括復元の件数 (100 件) の 4 つの境界で閉じる形へ反映した。削除中の行は PUT でも 404 にし、編集で復活させない。領収書ファイルを受け取らないので、ファイルの検査と保管の責任を持たない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-cash-security-web-005`

**問**

現金明細の入力・削除・復元・一括操作で何を拒否し、何を守るか。

**答**

API の zod で名義・業務の目的・収支・事業 / 個人を候補に限り、実在しない日付、金額の範囲外、長すぎる文字列 (内容 60 字・メモ 200 字・駅名 40 字・その他の目的 40 字) を 400 で拒否する。一括削除と一括復元の id 配列は 100 件までで、他の利用者の id を 1 件でも含めば全体を 404 にして何も変えない。削除中の行は PUT でも 404 にし、編集で復活させない。新しい restore / bulk-delete / bulk-restore は canonical-mutation-fence に登録する。削除中の行が一覧・合計・取引・集計・バックアップ (BACKUP_SNAPSHOT_SQL)・取込時の設定スナップショット (loadImportRestoreSettingsSnapshot)・科目使用状況のどこにも出ない不変条件を API テストで固定する。下書きはブラウザ内だけに置きサーバーへ送らない。領収書ファイルは受け取らない。例外は 1 つだけで、JSON 復元の『移行先の現金明細が 0 件か』の判定だけは削除中の行も数える (loadImportRestoreSettingsSnapshot の destination_counts に、削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残っている間は現金明細を復元せず、理由を表示する。バックアップの id をそのまま INSERT して主キーが衝突し、復元全体が失敗することを防ぐためである。件数のほかに、削除中の行の中身はどの出力にも出さない (qa-cash-decision-009)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-004、qa-cash-decision-010) と、決定 qa-cash-decision-006 (一括復元) / 009 (JSON 復元の件数の例外) の範囲に収まる確定内容。前回の確定 (qa-cash-security-web-004) に例外の記述を足した。JSON 復元の判定は routes/imports.ts と store.ts の現物で確認した。 / 回答時刻: 2026-09-21T22:45:23Z)

#### 裏付け質疑: `qa-cash-security-web-evidence-001`

**問**

security 章の裏付けとして、現行実装について何を観測したか。

**答**

packages/api/src/index.ts:58 で secureHeaders、:108 で canonicalMutationFence を全 /api/* に掛ける。cash の入力は zod (packages/api/src/routes/cash.ts:57-73) で side/io の列挙、金額の上限 1,000,000,000、内容 60 字、科目 60 字、メモ 200 字、駅名 40 字を検証し、科目は checkCategory (:146) で利用者の科目表と照合する。cash 経路に専用のレート制限は無い。削除は物理削除 (:268) で、取り消しの記録は残らない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-security-web-003`

**問**

web の現金入力画面で、利用者が決めていない 下書きをブラウザ内にどう保持するか。

**答**

下書きのキーに利用者 id を含めて他の利用者と混ざらないようにし、ログアウト時に消す。保存するのは入力途中の項目値だけで、一覧の内容やサーバーの応答は保存しない。 これは agent の推定で、利用者は未確認である。画像と決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-decision-006`

**問**

一覧の選択から一括削除した行を、削除完了トーストの『元に戻す』でどう戻すか。現行の仕様には 1 件ずつの復元しか無い。

**答**

一括復元の API を足す。POST /api/cash-entries/bulk-restore が一括削除と同じ id の配列 (100 件まで) を受け、他の利用者の id や完全消去済みの id を 1 件でも含めば全体を 404 にして何も戻さず、全件を 1 つの D1 batch で deleted_at を外して取引と集計を作り直す。トーストの『元に戻す』は一括削除した id をそのまま渡す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 (一括復元の API を足す・1 件ずつ復元を繰り返す・一括削除では元に戻すを出さない) と推奨案を提示し、利用者が「一括復元の API を足す (推奨)」を選択。answered_at は選択時刻の上界。 / 回答時刻: 2026-09-21T15:34:28Z)

#### 裏付け質疑: `qa-cash-decision-009`

**問**

JSON 復元は移行先の現金明細が 0 件のときだけバックアップの明細を id のまま入れる。削除中の行だけが残る利用者は 0 件と判定され、主キーが衝突して復元全体が失敗する。どう扱うか。

**答**

削除中も件数に数える。『空か』の判定だけは削除中の行を数え、削除中の行が残る間は現金明細を復元せず理由を表示する。削除中の行を他のどの出力にも出さない不変条件の例外は、この件数 1 つだけとする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件 (削除中も件数に数える・復元前に削除中の行を消す・衝突した行だけ飛ばす) と推奨案を提示し、利用者が「削除中も件数に数える (推奨)」を選択。answered_at は選択時刻の上界。 / 回答時刻: 2026-09-21T22:44:32Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 現金明細の入力と変更を安全に保つ。利用者ごとの分離、入力検証、削除・復元の権限確認、削除済み行を集計へ混ぜない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。
- **I6**: 入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証し、大きさを境界で制限する』を、現金明細の入力と一括削除に適用した。名義・業務の目的・収支・事業 / 個人は列挙に限り、文字列は字数、金額は範囲、一括削除の id 配列は件数で境界を切る。下書きはサーバーへ送らないので、サーバー側で守る入力面を増やさない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:23:17Z)

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
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
