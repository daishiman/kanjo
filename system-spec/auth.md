---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G4]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-005 |
| モバイル (mobile) | 対象外 | 理由: 専用モバイルアプリを提供せず、webのレスポンシブ表示で到達するためモバイル固有の要件を持たない |
| タブレット (tablet) | 対象外 | 理由: 専用タブレットアプリを提供せず、webのレスポンシブ表示で到達するためタブレット固有の要件を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 確定内容 (質疑録)

### qa-005 (対応セル: web)

**質問**: web の認証とセキュリティの要件は何か。削除という不可逆操作を足すにあたり守るべき境界は何か。

**回答**: 認証はパスワード + 署名付きセッションCookie方式で、Cloudflare Access を使う場合のみ ACCESS_AUD/ACCESS_TEAM_DOMAIN を設定して Access JWT 検証へ切り替わる。AUTH_PASSWORD と SESSION_SECRET は wrangler secrets で管理し、リポジトリへ平文で置かない。削除・上書き・差分プレビュー・取り消しの各APIは、既存の session/token 認証後の共通入口の配下に置き、public auth 経路からは到達させない。認証方式そのものは変更せず、単一利用者の運用であるため削除操作に対する追加の再認証 (step-up) は求めない代わりに、画面側の二段階確認と、サーバ側の範囲指定の明示をもって誤操作の歯止めとする。セキュリティ要件として、(a) 明細内容・金額をログおよびエラー応答へ含めない既存方針を維持する、(b) 監査記録には操作種別・範囲・件数・日時のみを残し、明細本体を複製しない、(c) undoスナップショットは明細を含むため、保持期間を定めて期限切れを確実に消し、期間中も user_id スコープの外から読めないようにする、(d) 削除範囲の指定はサーバ側で user_id スコープに閉じ、クライアントから渡された範囲をそのまま信用して他利用者のデータへ及ばないようにする、(e) 全件削除のような影響最大の操作は、範囲の明示入力と確認を必須とし、単一のクリックで到達させない、(f) 税務上の正はfreeeの記帳であり、本システムの削除がfreee側へ波及しないこと (本システムは読み取ったCSV/ZIPの取込結果のみを扱う) を保つ、を定める。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| authentication | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | owasp-asvs は取得済み (retrieval-evidence/owasp-asvs.json, 67761 B) だが、取得したのは project landing page であって ASVS 本体ではない。ASVS の章番号・要件番号は本体側にあり landing page には無いため、引くべき条項が取得物に存在しない。 |
| security | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | authentication と同一 authority・同一取得物 (landing page)。条項が取得物に無い点も同じ。 |

- **authentication が引用可になる条件**: 章番号・要件番号を持つ ASVS 本体 (公式配布の要件文書) を targets[] に足して取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。
- **security が引用可になる条件**: authentication の reversal と同じ。ASVS 本体を取得できた日に両 concern を同時に available へ変える。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

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

#### 本章での適用

##### 確定内容 qa-005 (対応セル: web)

- 確定要件: 認証はパスワード + 署名付きセッションCookie方式で、Cloudflare Access を使う場合のみ ACCESS_AUD/ACCESS_TEAM_DOMAIN を設定して Access JWT 検証へ切り替わる。AUTH_PASSWORD と SESSION_SECRET は wrangler secrets で管理し、リポジトリへ平文で置かない。削除・上書き・差分プレビュー・取り消しの各APIは、既存の session/token 認証後の共通入口の配下に置き、public auth 経路からは到達させない。認証方式そのものは変更せず、単一利用者の運用であるため削除操作に対する追加の再認証 (step-up) は求めない代わりに、画面側の二段階確認と、サーバ側の範囲指定の明示をもって誤操作の歯止めとする。セキュリティ要件として、(a) 明細内容・金額をログおよびエラー応答へ含めない既存方針を維持する、(b) 監査記録には操作種別・範囲・件数・日時のみを残し、明細本体を複製しない、(c) undoスナップショットは明細を含むため、保持期間を定めて期限切れを確実に消し、期間中も user_id スコープの外から読めないようにする、(d) 削除範囲の指定はサーバ側で user_id スコープに閉じ、クライアントから渡された範囲をそのまま信用して他利用者のデータへ及ばないようにする、(e) 全件削除のような影響最大の操作は、範囲の明示入力と確認を必須とし、単一のクリックで到達させない、(f) 税務上の正はfreeeの記帳であり、本システムの削除がfreee側へ波及しないこと (本システムは読み取ったCSV/ZIPの取込結果のみを扱う) を保つ、を定める。
- 設計解釈の記録経路: `unrecorded`
- 設計原則の採否根拠: (未記録 — qa_log[].design_applications を writer 経由で補完すること)
- 資するゴール: G4

## 最新ドキュメント出典

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
