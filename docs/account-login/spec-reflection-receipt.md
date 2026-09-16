# アカウントログイン 仕様反映の受領書 (SYS-ACCTLOGIN-P13 運用手順の修正)

- Beads: kanjo-4o5.13
- dev-graph: SYS-ACCTLOGIN-P13 (feat-account-login)
- 判定日: 2026-09-15

## 1. 結論

**仕様 (system-spec/・specs/) の本文変更は無し。architecture は運用リスクを1行追記しました。**

## 2. 変更と判定

| 変更 | 判定 | 根拠 |
|---|---|---|
| `docs/runbooks/scripts/admin-credential-remote.sh` を追加し、runbook §1 本番 / §5 を置き換え | 仕様影響なし | `specs/spec-account-login.md` は「全 admin がログイン不能になった場合の最終手段は runbook の break-glass reset を使う」とだけ定め、実行手段を規定しない。reset の意味 (email/role/id を変えず、ハッシュ・停止状態・一時期限・世代を更新) は `seed-admin.mjs` のまま変わらない |
| パスワード・セッション・API の挙動 | 変更なし | アプリのコード (`packages/`) を変えていない。PBKDF2 100,000 回の反映は #52 で specs / architecture / features / tasks に済んでいる |
| `architecture/account-login-maintenance-ops.md` の Risks に投入経路のリスクを追記 | 反映 | 設計判断 3「最終手段を runbook として文書化する」の実施で出たリスクと対処。決定そのものは変えない |
| `features/feat-account-login.md`、`tasks/feat-account-login/SYS-ACCTLOGIN-P13.md` に本番反映の状況を追記 | 反映 | P13 の成果物「反映記録」。記録本体は `docs/account-login/release-record.md` |

`system-spec/` の確定章は、挙動の変更が無いため reopen せず、書き換えていません。
