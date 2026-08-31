# アーカイブ: 本番D1スキーマ復旧 (2026-08-27 確定)

このディレクトリは、`system-spec/` が旧テーマ「本番環境のデータベーススキーマ復旧と再発防止」で
全8カテゴリ確定していた時点の仕様書一式である。

## 経緯

2026-08-30、新機能「取込データの削除・上書き・再取込」の仕様を構築するにあたり、
`system-spec/` はリポジトリに1テーマぶんの正本しか持たない構造のため、
利用者承認のうえで旧テーマをここへ退避し、`spec-state.json` を新テーマで再 bootstrap した。

退避前に、8カテゴリの `web` セルは正規 writer (`apply-spec-transition.py` の `action=reopen`) で
根拠付きに再オープンしてある (確定の直接巻き戻しは行っていない)。

## 収録物

- `00-requirements-definition.md` — 旧テーマの要件定義書 (上位概念 U1-U9)
- `index.md` — 旧テーマの章 index と集約状態
- `database.md` / `auth.md` / `ui-ux.md` / `security.md` / `infrastructure.md` / `backend.md` / `frontend.md` / `maintenance-ops.md` — 旧テーマの技術章
- `completeness-findings.json` — 旧テーマの完成度 evaluator 結果
- `fetched-references.json` — 旧テーマで取得した公式ドキュメント出典

## 旧 spec-state.json の参照先

正本 `system-spec/spec-state.json` は保護 hook (`guard-confirmed-chapter-overwrite.py`) により
複製・移動ができないため、ここには含めていない。旧テーマ時点の正本は git 履歴から参照する。

```
git show 6b98b32:system-spec/spec-state.json
```

旧テーマの決定記録 (D1-migration-gate / D2-pre-apply-backup / D3-runtime-schema-guard /
D4-schema-mismatch-user-message) と qa_log / approval_log はこのファイルにある。
