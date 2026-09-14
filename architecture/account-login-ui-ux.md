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
scope_in: ["単一カラム構成 (中央にログインカード1枚)", "安心3項目によるセキュリティ姿勢の明示", "ログイン保持チェックと既定の帰結の開示", "エラー文言と復帰導線", "キーボード操作と初期フォーカス", "狭幅でも同一の単一カラム"]
scope_out: ["ヘッダー・フッター・サイドバーの描画", "脇に置く情報パネル・ブランド見出し・『月次の流れ』の説明", "Cloudflare Access の導線", "自己登録リンク", "外部 IdP ボタン", "利用規約リンク・版数表記", "web 以外の platform 向けレイアウト"]
acceptance: ["ログイン画面の DOM に header/footer/nav/aside が0件である", "ログインカードが1枚だけ中央に置かれる", "アイコンが常にテキストラベルと併記される", "初期フォーカスがメールアドレス入力にある", "Ctrl + Enter で送信できる", "狭幅 (~400px) で横スクロールが生じない", "左右の余白が最低 16px 保たれる"]
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
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "b35d162fb978ca17427996dbc7843e0668cd393ed95d95ae4eafc47743bcf688", "imported_at": "2026-09-14T04:15:00Z"}
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

単一カラム。中央にログインカードを1枚だけ置き、安心3項目はそのカードの中に収める。参照画像に写り込むサイドバー・ヘッダー・フッターは認証後のアプリ枠であり、ログイン画面では一切描画しない。脇に説明パネルを置くとそれ自体がサイドバーとして、ブランド見出しがヘッダーとして知覚されるため、枠に見える要素も同様に置かない。

## Context and drivers

利用文脈は「個人が自分の金融明細を確認するため、PC ブラウザから1日1回程度ログインする」。扱う情報が金融明細であるため、初見の利用者に対して保護方針を画面上で示せることが要件に含まれる。

## Goals and non-goals

- Goal: 資格情報の入力と送信を最短手数にし、失敗からの復帰導線を確実に見せ、保護方針を明示する。
- Non-goal: 外部 IdP、自己登録、利用規約・版数表記、web 以外のレイアウト。

## System context and boundaries

ログイン画面は認証前の唯一の画面であり、アプリ枠 (ヘッダー・フッター・サイドバー) の外側に置く。この境界が「ログイン画面専用レイアウト」の根拠である。

## Container and component view

**ログインカード (唯一の構成要素)**: 見出し『ログイン』 / リード文 / メールアドレス入力 (type=email, autoComplete=username) / パスワード入力 (type=password, autoComplete=current-password, 目アイコン + 『表示』トグル、エラー時は枠線を赤へ) / エラーメッセージ (警告アイコン付き、入力直下に role=alert) / チェックボックス『次回からもログイン状態を保持する』 / 全幅の主ボタン / ショートカット注記 / 区切り線 / 見出し『安心してご利用いただくために』と安心3項目 (盾・錠・書類のアイコン付き、セキュリティ / プライバシー / お客様のデータ) / 『パスワードをお忘れの方』と『サポートに問い合わせる』。

## Cross-cutting contracts

アイコンは常にテキストラベルと併記し、単独で意味を担わせない。初期フォーカスはメールアドレス入力。キーボードのみで全操作が完結し、Ctrl + Enter で送信できる。カードは最大幅 460px 程度で中央に置き、狭幅 (~400px) でも同じ単一カラムのまま左右の余白を最低 16px 保ち、横スクロールを生じさせない。

## Subtype architecture

**frontend**: 安心3項目は装飾ではなく規範として置く。「セキュリティを整えていることを UI で確認できる」という要件の実体がこの3項目であり、削ってはならない要素として情報優先度の第3位に固定する。

## Architecture decisions

1. 情報優先度を「task 頻度 × 失敗コスト」で決めた: 第1が資格情報の入力と送信、第2が失敗時の復帰導線、第3が安心3項目。月次の流れ4ステップとブランド見出しは、認証前に読ませる価値が上位3つに及ばないうえ、脇に置けば枠として知覚されるため落とす。
2. 落とす: 外部 IdP ボタン・自己登録リンク・利用規約リンク・版数表記。加工する: 『パスワードをお忘れの方』を自動再発行ではなく「管理者へ連絡して一時パスワードの発行を受ける」案内ダイアログへ意味を変える (メール送信基盤を持たないため)。
3. 『次回からもログイン状態を保持する』は既定 ON とし、ON=30日 / OFF=12時間であることをチェックボックス脇のマイクロコピーで明示する — 既定の帰結を隠さない。

## Delivery, migration and rollback

画面改修は認証 API の切替と同時に投入する。参照画像との差異が生じた場合は本章の規範を正とするが、本章の規範自体が実機の見え方と食い違ったときは `system-spec/ui-ux.md` を R4-reopen して直し、そのうえで本章を追従させる (2026-09-14 の2カラム廃止はこの経路で反映した)。

## Risks and verification

- リスク: アイコンのみで意味を運び、識別できなくなる → ラベル併記を受入条件に含めて検査する。
- リスク: 既定 ON の保持が利用者に意識されないまま 30 日セッションを生む → マイクロコピーでの開示を必須とする。
- リスク: タグ名だけを検査すると、`aside` や div の脇列が枠として残ったまま受入条件を通過する → DOM 検査は `header/footer/nav/aside` と枠系 class の全件0を課し、カードが1枚だけであることも併せて検査する。
- 検証: DOM に header/footer/nav/aside が0件であること、初期フォーカスと Ctrl + Enter の動作、狭幅で横スクロールが生じないことを検査する。
