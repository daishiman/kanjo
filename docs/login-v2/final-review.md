# Login v2 の独立差分レビュー

確認日: 2026-10-31。親エージェントが実装担当とは別に現行差分と固定版依存ソースを確認した。

## 指摘と修正

| ID | 重要度 | 指摘 | 是正と検証 |
|---|---|---|---|
| R1 | HIGH | Googleのprofile変換で全利用者へ未承諾招待を要求し、招待消費後の再ログインと既存利用者の連携を拒否していた | 署名済みGoogle profileのメール確認後、既存active利用者のDB上の役割/状態を使用。新規だけに招待を要求。停止中・未検証・未招待新規を拒否。再現1件失敗→認証境界全16件成功 |
| R2 | HIGH（運用） | 本番設定helperが旧gh CLIで未対応の `gh variable` を呼び、一部設定後に失敗する | VariableをREST APIのPOST/PATCHへ変更し値はstdin JSONで渡す。Worker所有先・読取権限を外部変更前に確認。本人の検証済みAccount/TokenをWrangler子プロセス環境へ固定。再現2件失敗→回帰成功 |
| R3 | LOW（診断） | 設定診断が送信元の予約サブドメインを受理し、runtimeの拒否条件とずれていた | 送信元検証をruntimeと一致させ、大文字・サブドメイン・末尾空白を回帰。再現1件失敗→回帰成功 |

R1は固定版 `@better-auth/core` のGoogle providerが毎回 `mapProfileToUser` を呼び、
Better Authのcallbackが既存利用者/連携分岐より先にprofileを取得することを依存ソースで確認して再現した。
暗黙の連携拒否と一回限りのlink grantは維持する。profile変換だけで連携を許可しない。

## 確認した境界

- 公開認証endpointのmethod/path allowlist、未認証API保護、停止利用者拒否。
- Googleの `email_verified`、link grantの本人/対象一致と一回消費、同一originへの遷移制限。
- MFA設定token・利用者・factorのD1 batch、最後の管理者を残す原子的更新。
- 秘密・tokenを出力しない監査、メールのtimeoutと未設定時のfail-closed。
- R1/R2と設定診断修正後の独立再レビューで指摘の解消を確認。追加の確定HIGHはなし。

判定: ローカル差分の認証境界レビューはPASS。実Google/メールと本番受入は未確認であり、配信完了とは判定しない。
