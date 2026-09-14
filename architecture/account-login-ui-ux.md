---
graph_node_id: "arch-account-login-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "アカウントログイン — 画面構成と情報優先度"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "ui-ux"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-frontend", "arch-account-login-security", "arch-account-login-auth"]
resource_scope: ["packages/web/src/pages", "packages/web/src/components", "design/FINAL-UI/images"]
purpose: "参照画像 01-login.png を正として、ログイン画面の構成・情報優先度・遷移を規範化する。"
goal: "初見の利用者が何をする場所か・何が守られるかを理解でき、日次のログインが最短手数で完了する画面にする。"
scope_in: ["2カラム構成 (左: 情報パネル / 右: ログインカード)", "安心3項目によるセキュリティ姿勢の明示", "ログイン保持チェックと既定の帰結の開示", "エラー文言と復帰導線", "キーボード操作と初期フォーカス", "狭幅時の1カラム畳み"]
scope_out: ["ヘッダー・フッター・サイドバーの描画", "Cloudflare Access の導線", "自己登録リンク", "外部 IdP ボタン", "利用規約リンク・版数表記", "web 以外の platform 向けレイアウト"]
acceptance: ["ログイン画面の DOM に header/footer/サイドバーのナビゲーション要素が0件である", "アイコンが常にテキストラベルと併記される", "初期フォーカスがメールアドレス入力にある", "Ctrl + Enter で送信できる", "狭幅 (~400px) でログインカードが先頭に来る", "左右の余白が最低 16px 保たれる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-ui-ux.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2fb715fb56285f2d817b0a0ed2a73b5ccbe1bfce2cfd15ac6b84e252cd7acfcd"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "b18de64994cb64bb724a4b69f66879135e14cc8aa695b51d23942e71ba52365c", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "画面の情報構造と優先順位を規範として定めるため architecture / frontend subtype として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G4, G1, G2]
---

# アカウントログイン — 画面構成と情報優先度

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/ui-ux.md`。参照画像は `design/FINAL-UI/images/01-login.png`。

## Architecture overview

2カラム。左に情報パネル (ブランド表記『FOCUS LEDGER』/ 2行見出し『収支を、/ 迷わず締める。』/ リード文 / 『月次の流れ』4ステップ / 『安心してご利用いただくために』3項目)、右にログインカード。参照画像に写り込むサイドバー・ヘッダー・フッターは認証後のアプリ枠であり、ログイン画面では一切描画しない。

## Context and drivers

利用文脈は「個人が自分の金融明細を確認するため、PC ブラウザから1日1回程度ログインする」。扱う情報が金融明細であるため、初見の利用者に対して保護方針を画面上で示せることが要件に含まれる。

## Goals and non-goals

- Goal: 資格情報の入力と送信を最短手数にし、失敗からの復帰導線を確実に見せ、保護方針を明示する。
- Non-goal: 外部 IdP、自己登録、利用規約・版数表記、web 以外のレイアウト。

## System context and boundaries

ログイン画面は認証前の唯一の画面であり、アプリ枠 (ヘッダー・フッター・サイドバー) の外側に置く。この境界が「ログイン画面専用レイアウト」の根拠である。

## Container and component view

**左パネル**: ブランド表記 / 見出し / リード文 / 月次の流れ4ステップ (番号バッジ + アイコン + 一言説明をシェブロンで連結) / 区切り線 / 安心3項目 (盾・錠・書類のアイコン付き、セキュリティ / プライバシー / お客様のデータ)。

**右カード**: 見出し『ログイン』 / リード文 / メールアドレス入力 (type=email, autoComplete=username) / パスワード入力 (type=password, autoComplete=current-password, 目アイコン + 『表示』トグル、エラー時は枠線を赤へ) / エラーメッセージ (警告アイコン付き、入力直下に role=alert) / チェックボックス『次回からもログイン状態を保持する』 / 全幅の主ボタン / ショートカット注記 / 区切り線の下に『パスワードをお忘れの方』と『サポートに問い合わせる』。

## Cross-cutting contracts

アイコンは常にテキストラベルと併記し、単独で意味を担わせない。初期フォーカスはメールアドレス入力。キーボードのみで全操作が完結し、Ctrl + Enter で送信できる。狭幅 (~400px) では1カラムへ畳み、ログインカードを先頭へ回す。左右の余白は最低 16px を保つ。

## Subtype architecture

**frontend**: 安心3項目は装飾ではなく規範として置く。「セキュリティを整えていることを UI で確認できる」という要件の実体がこの3項目であり、削ってはならない要素として情報優先度の第3位に固定する。

## Architecture decisions

1. 情報優先度を「task 頻度 × 失敗コスト」で決めた: 第1が資格情報の入力と送信、第2が失敗時の復帰導線、第3が安心3項目、第4が月次の流れ、最下位がブランド見出し。狭幅で情報パネルを後ろへ回す判断も同じ順位から導いた。
2. 落とす: 外部 IdP ボタン・自己登録リンク・利用規約リンク・版数表記。加工する: 『パスワードをお忘れの方』を自動再発行ではなく「管理者へ連絡して一時パスワードの発行を受ける」案内ダイアログへ意味を変える (メール送信基盤を持たないため)。
3. 『次回からもログイン状態を保持する』は既定 ON とし、ON=30日 / OFF=12時間であることをチェックボックス脇のマイクロコピーで明示する — 既定の帰結を隠さない。

## Delivery, migration and rollback

画面改修は認証 API の切替と同時に投入する。参照画像との差異が生じた場合は、画像側ではなく本章の規範を正とする (画像は確定時点の表現であり、確定内容は本章に移管済み)。

## Risks and verification

- リスク: アイコンのみで意味を運び、識別できなくなる → ラベル併記を受入条件に含めて検査する。
- リスク: 既定 ON の保持が利用者に意識されないまま 30 日セッションを生む → マイクロコピーでの開示を必須とする。
- 検証: DOM に header/footer/サイドバーが0件であること、初期フォーカスと Ctrl + Enter の動作、狭幅での並び替えを検査する。
