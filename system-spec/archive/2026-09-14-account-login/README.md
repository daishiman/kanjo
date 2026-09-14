# 退避サイクル: 2026-09-14-account-login

共有パスワードをやめ、メールアドレス+パスワードの利用者アカウントで入れるようにするサイクル (PR #47、ログイン画面の単一カラム化 PR #48 を含む。2026-09-14 マージ済み) の確定仕様。次サイクル (FINAL-UI 20画面から抽出したデザインシステム基盤 feat-design-system-foundation) を main へ取り込むマージ時に退避した。

本サイクルの上位概念は「認証主体を利用者単位へ移す」であり、次サイクルの「色・文字・余白・シェル・ボタン・チャートを意味トークンと共通部品へ集約する」とは上位概念が入れ替わる。デザインシステム側は API・DB・認証方式を変更しないため、本サイクルの確定内容 (users / セッション / レート制限) はそのまま実装の正本として有効であり、`architecture/account-login-*.md` の source_path だけを本ディレクトリへ張り替えた。

退避したファイル:

- `00-requirements-definition.md`
- `auth.md`
- `backend.md`
- `completeness-findings.json`
- `database.md`
- `fetched-references.json`
- `frontend.md`
- `index.md`
- `infrastructure.md`
- `maintenance-ops.md`
- `security.md`
- `spec-state.json`
- `ui-ux.md`
