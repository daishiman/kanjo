# 退避サイクル: 2026-09-11-mf-business-classification

MF の中項目が「事業」で始まる明細を収入・支出とも事業へ寄せるサイクル (PR #44, 2026-09-11 マージ済み) の確定仕様。次サイクル (メールアドレス+パスワードによる利用者単位のログイン) を立ち上げるにあたり、利用者承認 (2026-09-11) のもと退避した。

本サイクルの上位概念は「MF 明細の事業/家計の振り分け精度」であり、次サイクルの「認証主体を共有パスワードから利用者単位へ移す」とは上位概念が入れ替わる。requirements_foundation を継承せず、新しい envelope を bootstrap する判断の根拠はこの点にある。

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
