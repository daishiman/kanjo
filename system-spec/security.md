---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G1, G3, G10, G11]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-020 |
| モバイル (mobile) | 対象外 | 理由: モバイル固有のストレージ/権限モデルを使わず、web と同一のセキュリティ境界に収まるため対象外 |
| タブレット (tablet) | 対象外 | 理由: タブレット固有のストレージ/権限モデルを使わず、web と同一のセキュリティ境界に収まるため対象外 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 適用された設計知識

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

---

### コピーされて出回る指示文に載せられる認証情報の要件

- project candidate: `security-onetime-bearer-for-agent-fetch` (`deepened`)
- 解決対象: 確定セル security×web (qa-020) の要件は、指示文という『コピーされて出回る文字列』へ認証情報を載せることを前提とする。汎用の『秘密は保存も伝送も最小に』というカード原則だけでは、どの方式が適格かを判定できない。

#### 目的

D9 (opt-onetime-bearer-hashed) の確定を、失効可能性という一点で方式を選別する判断軸として章へ接地させる。

#### 解決する問題

- R2 の署名付き URL は漏えいしても期限内は無制限に再利用でき、個別失効の手段がない
- トークン平文を D1 へ保存すると、DB の閲覧権限がそのまま取得権限になる
- 期限切れと取得回数超過を汎用 500 へ丸めると、利用者もエージェントも次の行動を選べない

#### 適用条件

- acceptance『発行した Bearer トークンの平文が D1 のどの列にも保存されておらず、SHA-256 ハッシュだけが保存されている』: Workers の Web Crypto (crypto.subtle.digest) で発行時にハッシュ化し、照合はハッシュ同士で行う
- acceptance『TTL 超過のトークンと取得回数上限超過のトークンが、互いに区別できる拒否理由で拒否され、いずれも 500 にならない』: 失効判定を2種の明示エラーへ分ける
- acceptance『R2 のスクリーンショットに対する公開 URL・署名付き URL が発行されず、取得経路が Worker 経由の1本だけである』: 配信を Worker に限定し、失効判定を必ず経由させる
- acceptance『トークン値がアプリケーションログのどこにも出力されない』: 発行・検証・拒否のいずれの経路でも平文をログ引数に渡さない

#### 非適用条件

- 画面 (ブラウザ) からの投稿・一覧・詳細・状態更新。これらは既存 Cookie セッション (kanjo_session) と authGuard の担当であり、Bearer を持ち込まない
- R2 署名付き URL や公開バケット配信 (scope_out)

#### トレードオフ

- Worker 経由配信は署名 URL 直配信より Worker の実行回数を消費する。失効可能性と引き換えに受け入れる
- ハッシュのみ保存のため、発行後にトークン平文を再表示できない。再発行で対応する

#### 失敗モード

- デバッグ目的の一時ログでトークン平文が残り、指示文と同じ値が別経路から漏れる
- TTL 判定を取得側だけに置き、削除ジョブ停止時に無期限で有効になる
- エラーを握り潰して 500 へ丸め、期限切れなのか回数超過なのか判別できなくなる

#### goalへの寄与

G10 (エージェントが証跡を取り出せる) を、G11 (最小範囲・秘匿値を含めない) を壊さずに成立させる唯一の接点。失効可能性がなければ G10 の実現がそのまま G11 の違反になる。

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
| cloudflare-workers-web-crypto | 2026-04-23 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
