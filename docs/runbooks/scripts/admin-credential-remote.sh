#!/usr/bin/env bash
# 本番 D1 へ管理者の資格情報を入れる (account-login-operations.md §1 bootstrap / §5 reset-admin)。
#
#   bash docs/runbooks/scripts/admin-credential-remote.sh bootstrap --email owner@example.com
#   bash docs/runbooks/scripts/admin-credential-remote.sh reset-admin --user-id usr_xxx
#
# 2026-09-15 の break-glass で踏んだ失敗を手順から外すための専用経路:
# - `wrangler d1 execute --file` は本番で /import の認証エラー (10000) になるため `--command` で流す。
# - `pnpm exec wrangler` は失敗時に argv (= ハッシュ入り SQL) を丸ごと表示するため wrangler を直接呼ぶ。
# - パスワードは画面・argv・一時ファイルに置かず、stdin だけで seed-admin.mjs へ渡す。
# - wrangler の出力はハッシュを伏せ字にしてから表示する。
# 複数アカウントにログインしている wrangler では CLOUDFLARE_ACCOUNT_ID を環境変数で渡すこと。
set -euo pipefail

usage() {
  echo 'usage: admin-credential-remote.sh bootstrap --email <email> | reset-admin --user-id <id>' >&2
  exit 2
}

MODE=${1:-}
case "$MODE" in
  bootstrap) [ "${2:-}" = '--email' ] && [ -n "${3:-}" ] || usage ;;
  reset-admin) [ "${2:-}" = '--user-id' ] && [ -n "${3:-}" ] || usage ;;
  *) usage ;;
esac
TARGET_FLAG=$2
TARGET=$3

REPO=$(cd "$(dirname "$0")/../../.." && pwd)
WRANGLER=(node "$REPO/node_modules/wrangler/bin/wrangler.js")
DB=kanjo-db
cd "$REPO/packages/api"

redact() { sed -E 's/pbkdf2-sha256\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+/pbkdf2-sha256$***REDACTED***/g'; }

# d1 execute --json を実行し、成功時は JSON を stdout へ返す。失敗時はエラー行だけを伏せ字で出す。
# 7403 (アカウント認可の一時失敗) はリクエスト受理前の拒否なので、1回だけ再試行しても二重適用にならない。
d1() {
  local out status attempt
  for attempt in 1 2; do
    set +e
    out=$("${WRANGLER[@]}" d1 execute "$DB" --remote --json --command "$1" 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
      printf '%s\n' "$out"
      return 0
    fi
    if [ "$attempt" -eq 1 ] && grep -q '7403' <<<"$out"; then
      echo '… 認可エラー 7403。5秒後に1回だけ再試行します' >&2
      sleep 5
      continue
    fi
    printf '%s\n' "$out" | redact | grep -E 'ERROR|code' | head -5 >&2
    return "$status"
  done
}

echo '本番 D1 への接続を確認しています…'
d1 'SELECT 1 AS ok;' >/dev/null || { echo 'NG: 本番 D1 に接続できません。wrangler login / CLOUDFLARE_ACCOUNT_ID を確認してください'; exit 1; }
echo 'OK: 本番 D1 に接続できました'

read -r -s -p '新しいパスワード (12文字以上): ' PW1; echo
read -r -s -p 'もう一度入力: ' PW2; echo
[ "$PW1" = "$PW2" ] || { echo 'NG: 2回の入力が一致しません'; exit 1; }
[ "${#PW1}" -ge 12 ] || { echo "NG: ${#PW1} 文字です。12文字以上にしてください"; exit 1; }

SQL=$(printf '%s' "$PW1" | node "$REPO/scripts/seed-admin.mjs" --print-sql --mode "$MODE" "$TARGET_FLAG" "$TARGET" --password-stdin)
unset PW1 PW2

EXPECTED_HEAD='UPDATE users'
[ "$MODE" = bootstrap ] && EXPECTED_HEAD='INSERT INTO users'
head -1 <<<"$SQL" | grep -q "^$EXPECTED_HEAD" || { unset SQL; echo "NG: SQL が $EXPECTED_HEAD で始まっていません"; exit 1; }
grep -qE 'DELETE|DROP' <<<"$SQL" && { unset SQL; echo 'NG: SQL に DELETE/DROP が含まれています'; exit 1; }
echo "OK: SQL は $EXPECTED_HEAD"

d1 "$SQL" >/dev/null || { unset SQL; echo 'NG: 書き込みに失敗しました'; exit 1; }
unset SQL
echo 'OK: 書き込みました'

if [ "$MODE" = bootstrap ]; then
  WHERE="email = '${TARGET//\'/\'\'}'"
else
  WHERE="id = '${TARGET//\'/\'\'}'"
fi
echo '--- 確認 (ハッシュは先頭だけ) ---'
d1 "SELECT id, email, role, status, must_change_password, session_generation, temporary_password_expires_at, substr(password_hash, 1, 21) AS hash_head FROM users WHERE $WHERE;" |
  node -e 'const rows = JSON.parse(require("fs").readFileSync(0, "utf8"))[0].results; console.table(rows); if (rows.length !== 1) process.exit(1);'
