#!/usr/bin/env bash
set -euo pipefail

: "${APP_URL:?APP_URL is required}"

app_url="${APP_URL%/}"
html_file="$(mktemp)"
headers_file="$(mktemp)"
trap 'rm -f "$html_file" "$headers_file"' EXIT

curl --fail --silent --show-error --location "$app_url/" --dump-header "$headers_file" --output "$html_file"
grep --quiet '<title>収支統合管理</title>' "$html_file"

for header in \
  content-security-policy \
  permissions-policy \
  referrer-policy \
  strict-transport-security \
  x-content-type-options \
  x-frame-options; do
  if ! grep --ignore-case --quiet "^${header}:" "$headers_file"; then
    echo "静的HTMLのセキュリティヘッダーが不足しています: $header" >&2
    exit 1
  fi
done

api_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$app_url/api/not-found")"
if [ "$api_status" != "401" ]; then
  echo "APIの未認証確認に失敗しました（期待: 401、実際: $api_status）" >&2
  exit 1
fi

echo "本番スモークテストに成功しました"
