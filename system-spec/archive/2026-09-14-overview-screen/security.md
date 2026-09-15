---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G2, G5]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web-ov-observed-001。裏付け質疑 (`qa_refs`): `qa-design-rules-ov-decision-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末内に取引明細・推奨仕訳を保持する場合の保存時暗号化と、端末紛失時の無効化を決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリでは端末内に取引明細・推奨仕訳を保持する場合の保存時暗号化と、端末紛失時の無効化を決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に取引明細・推奨仕訳を保持する場合の保存時暗号化と、端末紛失時の無効化を決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に取引明細・推奨仕訳を保持する場合の保存時暗号化と、端末紛失時の無効化を決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に取引明細・推奨仕訳を保持する場合の保存時暗号化と、端末紛失時の無効化を決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の入力検証と多層防御を、書込 API が kind (3値)・itemKey (長さ上限)・month (YYYY-MM) を境界で検証して 400 を返し、DB 側でも CHECK 制約と主キーで守る規則 (qa-design-rules-ov-decision-001 の (1)) に反映した。書込ルートを CANONICAL_MUTATION_ROUTES に登録して取込・復元と同時に走れば 409 で止めること、明細をテキストとして描画することは qa-security-web-ov-observed-001 の観測である。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G5

#### 主たる接地根拠: `qa-security-web-ov-observed-001`

**問**

概況の作り替えは既存のセキュリティ方針 (CSP・外部送信なし・実データの扱い・書込の直列化) と衝突しないか。

**答**

衝突しない。CSP は packages/api/src/index.ts:52-81 の secureHeaders で connect/script/default とも 'self' に限られ、静的アセットは packages/web/public/_headers に同じ値があり index.test.ts が差分を検査する。信頼度は vendor_memory・ルール・MF中項目の既存データだけから決定論で計算し、AI/LLM や外部 API へ明細を送らない (U8 scope.out、C2)。フッターの『外部送信しません』はこの事実を表示するもので、connect-src 'self' が実装上の担保である。pnpm lint の security:content (bash scripts/hooks/guard-real-data.sh --scan-public-docs、ルート package.json:33) は公開文書とテスト fixture への実データ混入を検査するので、概況の fixture・画面例は匿名・架空の値だけを使う。保留・月次レビューの書込ルートはバックアップ対象テーブルを書くため CANONICAL_MUTATION_ROUTES に登録し、取込や復元と同時に走ったときは 409 canonical_write_busy で止める (canonical-mutation-fence.ts:119-140)。明細の内容・取引元は React のテキストとして描画し、HTML として挿入しない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: Explore サブエージェントが 2026-09-14 に packages/api・packages/core・packages/web・migrations・.github を読み、file:line を付けて報告した観測事実。報告受領後に date -u で実測した時刻を answered_at (上限値) とした。 / 回答時刻: 2026-09-14T11:54:38Z)

#### 裏付け質疑: `qa-design-rules-ov-decision-001`

**問**

仕様書の上流指針に『推定』として書いた設計規則のうち、仕様として確定させるものを選んでください (複数選択、選ばなかったものは『実装時の提案』と明記して残す)。選択肢: 入力検証とDB制約の二重化 / 計算は core の純関数に置く / 新部品を共通化・PUTは冪等 / 件数ずれの切り分け手順を文書化

**答**

4件すべてを確定する。(1) 入力検証とDB制約の二重化: 保留と月次レビューの書込 API は kind (classification|reconciliation|import の3値)・itemKey (長さ上限つき文字列)・month (YYYY-MM) を境界で検証して 400 を返し、DB 側でも CHECK 制約と主キーで守る。migration 0040 は CREATE TABLE と CREATE INDEX だけで既存テーブルを変えず、件数などの集計列は保存しない。(2) 計算は core の純関数に置く: 未処理キュー・信頼度・月次クローズ判定・直近12か月比較は packages/core の純関数にし、packages/api のルートは D1 から読んだ行を渡して JSON にするだけにする。web は応答型 OverviewResponse・ReviewQueueResponse だけを知り、優先順位や信頼度を画面側で再計算しない。(3) 新部品を共通化・PUT は冪等: サイドバーのバッジ・右パネル・固定アクションバーは packages/web/src/components/ の共通部品にし、他の画面でも使える形にする。保留と月次レビューの PUT は同じ値を再送しても結果が変わらない。(4) 件数ずれの切り分け手順を文書化: 件数が3か所でずれたときは API 応答 → React Query のキー共有 → 保留の内容指紋 の順に確認する手順と、描画検査が失敗したときに screenshot から幅を特定する方法を docs に残す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 4件の文言は完成度 evaluator が『確定質疑に無い』と指摘した doctrine 記述をそのまま選択肢にしたもの。 / 回答時刻: 2026-09-14T12:14:38Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 仕分け確認・照合確認・取込確認を1つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への1操作遷移を持つ。
- **G5**: 読込・空・エラー状態、WCAG 2.2 AA、レスポンシブ (右パネルのドロワー化)、外部送信なし・認証必須を維持する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 未処理件数がサイドバーのバッジ・未処理カード・固定アクションバーの3か所で一致する。 | DOM テストが3か所の件数表示を取得して一致を assert し、1件を後で確認にしたとき3か所が同時に減ること、ヘッダーの期間を 1年 から 3年 に切り替えても3か所の件数が変わらないことも検査する。core の単体テストが、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられることを assert する。 |
| O4 | 画像正本の表示順と広幅レイアウトを保ち、概況の描画検査が8幅で通る。 | `system-spec/ui-ux.md#表示順の正本` の順序、広幅の Review 3列・比較/内訳2列、横はみ出しなしを scripts/check-financial-visuals.mjs が観測し、Overview エントリを8幅で描画して exit 0 になる。 |
| O5 | 推奨科目の信頼度が決定論で、根拠が無ければ推奨なしを返す。 | core の単体テストが同じ入力で同じ信頼度を返すこと、vendor_memory・ルール・MF中項目のいずれも該当しない明細で推奨なしを返すことを assert する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 未処理カード3種 (仕分け確認・照合確認・取込確認)
- **I4**: 優先度順の未処理明細表
- **I5**: 右パネル (理由・取引元・類似取引・推奨仕訳と信頼度・仕分けを開く・後で確認)
- **I8**: 固定アクションバー (未処理件数と次の操作)
- **I9**: 本文のデータ最終更新と出典リンク

### 本章に効く確定意思決定

- **dec-review-state-storage**: 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか
  - 採択: D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする (`d1`)
  - 目的適合: G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない
- **dec-recommendation-confidence-source**: 右パネルの推奨科目と信頼度を何を根拠に出すか
  - 採択: 既存の判定根拠を統合 (vendor_memory の一致率 → ルール → MF中項目、どれも無ければ推奨なし) (`integrate-existing`)
  - 目的適合: G2 の『根拠種別付きの推奨科目と信頼度』を満たし、O5 の決定論を検査できる

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の Data lifecycle (収集最小化・バックアップまで設計) を保留と月次レビューに適用した。保存するのは明細キー・内容指紋・時刻・操作者だけで (qa-snooze-fingerprint-ov-decision-001、qa-auth-web-ov-observed-001)、明細本文の写しを新テーブルに持たない。バックアップへ入れるので復元でも判断が失われない (qa-database-web-ov-decision-001)。信頼度は既存データだけから決定論で計算し外部へ送らない (qa-security-web-ov-observed-001) ので、外部送信の経路は増えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 記録時刻: 2026-09-14T12:20:03Z)

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
| w3c-csp3 | CSP Level 3 (W3C Working Draft) | W3C (www.w3.org) | https://www.w3.org/TR/CSP3/ | 2026-09-14T12:16:39Z | 2026-09-14T12:16:39Z |
