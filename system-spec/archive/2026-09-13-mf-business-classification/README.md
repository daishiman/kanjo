# 退避サイクル: 2026-09-13-mf-business-classification

Money Forward の中項目が「事業」で始まる明細を収入・支出とも事業へ寄せるサイクル (PR #44, 2026-09-13 時点で main にマージ済み) の確定仕様。次サイクル (FINAL-UI「Focus Ledger」を正本とするデザインシステム共通化) を立ち上げるにあたり、利用者承認 (2026-09-13、AskUserQuestion で「退避して作り直す」を選択) のもと退避した。

退避前に、8カテゴリの `web` セルは正規 writer (`apply-spec-transition.py` の `action=reopen`、`reopened_at=2026-09-13T04:55:23Z`) で根拠付きに再オープンしてある (確定の直接巻き戻しは行っていない)。退避した `spec-state.json` は writer の `aggregate --out` で書き出したもので、退避直前の正本とバイト同一である。

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
