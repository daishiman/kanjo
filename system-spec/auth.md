---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G1, G3]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-005 |
| モバイル (mobile) | 対象外 | 理由: 認証はweb SPAのセッションCookieのみで、モバイル専用の認証経路を持たない |
| タブレット (tablet) | 対象外 | 理由: 認証はweb SPAのセッションCookieのみで、タブレット専用の認証経路を持たない |
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

### 画面経路とエージェント経路で認証主体を分ける境界

- project candidate: `auth-session-boundary-between-browser-and-agent` (`deepened`)
- 解決対象: 確定セル auth×web (qa-005) は既存の Cookie セッションを前提とする。改善要望はここへエージェント経路を追加するため、既存 authGuard の適用範囲を変えずに新経路を足すという境界条件が章に残る必要がある。

#### 目的

『認証方式は主体の種類ごとに分け、既存経路の適用範囲を変えない』という原則を、改善要望の 2 経路へ接地させる。

#### 解決する問題

- エージェントを通すために authGuard を緩めると、既存の全画面 API の保護が同時に下がる
- 1 つのミドルウェアで 2 種の認証を受け付けると、どちらで通ったかが後段から判別できない

#### 適用条件

- 画面からの投稿・一覧・詳細・状態更新・コピー記録は Cookie (kanjo_session) + 既存 authGuard (arch 3章の表)
- エージェントからの成果物取得は使い捨て Bearer + agentGuard と同型 (D9)
- D3 で確定した入口検査 (session 経路のスキーマ版数ガード) は public auth を除いて適用する

#### 非適用条件

- 認証不要の公開エンドポイント。改善要望には存在しない
- エージェント経路での投稿・状態更新。エージェントは取得のみで、書き込みは画面経路に限る

#### トレードオフ

- ガードが 2 本になり、テストも 2 系統必要になる。既存経路の安全性を変えない代償として受け入れる

#### 失敗モード

- エージェント経路の実装を既存 authGuard の分岐として書き、Cookie 経路の判定を巻き込んで壊す
- agentGuard を書き込み系エンドポイントにも付け、使い捨てトークンで状態更新できてしまう

#### goalへの寄与

G3 (原因を即座に特定できる) を認証層から支える。経路が分かれていることで、拒否がどちらの主体に対するものか即座に判別できる。

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 今回の feature scope

本章の仕様は確定済みであり、今回の feature `feat-mobile-financial-visualization` では**変更しない**。

- feature scope: 変更対象は ui-ux / frontend のみ (承認: `appr-mobile-scope-narrowing-001`)
- 本章の spec cell state は「確定」のまま維持する。「今回触らない」ことと「仕様が存在しない (対象外)」ことは別軸であり、feature scope を cell state へ書くと D1・認証・Workers の実在する契約が仕様上消え、以後の completeness 評価や dev-graph の要件導出がその前提で走ってしまう。
- 境界維持の検証は ui-ux / frontend 側の制約と受入条件で行う (`qa-mobile-boundaries-001`)。

- 正本へ入れた理由: feature 単位の「今回触らない」を恒久的な spec cell state (確定/対象外) と取り違えた降格が起きたため、意図を state とは別の軸で保持する。

## 最新ドキュメント出典

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
