# アカウントログイン 本番反映記録 (SYS-ACCTLOGIN-P13)

- Beads: kanjo-4o5.13 (epic kanjo-4o5)
- dev-graph: SYS-ACCTLOGIN-P13 (feat-account-login)
- 記録日: 2026-09-15

秘密情報 (パスワード・ハッシュ・secret の値) と個人のメールアドレスはここに書きません。

## 1. 受入条件ごとの状況

| 受入条件 | 状況 | 根拠 |
|---|---|---|
| 本番 D1 に users と audit_log があり、スキーマ版数が記録されている | 達成 | 本番 D1 の読み取り: `d1_migrations` 39 件、最新 `0040_review_snoozes_and_monthly_close_reviews.sql`。`audit_log` 表あり、`users` 1 件 |
| `AUTH_PASSWORD` が本番から削除され、旧経路でログインできない | **未達** | `wrangler secret list` に `AUTH_PASSWORD` と `SESSION_SECRET` が残っている。削除は runbook §3 手順 6 のとおり、新 Worker のログイン確認後に所有者が行う |
| 作成した管理者でログインでき、設定画面から利用者を追加できる | 確認待ち | 下記 §2 の修正と reset の後、所有者がログインして確かめる |

## 2. 経緯

| 時点 | 出来事 | 対応 |
|---|---|---|
| #51 配信後 | migration 0039 / 0040 を本番へ適用。初期 admin を作成 | runbook §1 |
| 同日 | 本番のログインが全件 500。Workers の WebCrypto が 100,000 回を超える PBKDF2 を `NotSupportedError` で拒否していた (Node とローカル Miniflare では再現しない) | 反復を 100,000 回へ下げ、上限を回帰テストで固定 (#52) |
| #52 配信後 | 既存 admin のハッシュは 210,000 回のままでログインできない | runbook §5 の break-glass reset を実施 |
| reset 1 回目 | `pnpm exec wrangler` が 7403 で失敗し、pnpm がハッシュ入り SQL を表示した。書き込みは無し | そのパスワードは破棄。投入経路を `docs/runbooks/scripts/admin-credential-remote.sh` に作り直した |
| reset 2 回目 | 成功。対象 admin は `status=active`、`must_change_password=1`、`session_generation` 2→3、ハッシュ先頭 `pbkdf2-sha256$100000$` | 一時パスワードの期限は 72 時間。初回ログインで変更を強制 |

break-glass は `audit_log` に残らない経路のため、この表を運用記録とします。

## 3. 残り

1. 所有者が admin でログインし、パスワード変更と利用者追加ができることを確かめる。
2. 確認後、`AUTH_PASSWORD` を削除し、旧共有パスワードで入れないことを確かめる (runbook §3 手順 6–7)。
3. 以上が揃ったら kanjo-4o5.13 を閉じる。
