#!/bin/bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
GUARD="$SCRIPT_DIR/guard-real-data.sh"
TEST_REPO=$(mktemp -d)
trap 'rm -rf "$TEST_REPO"' EXIT

git -C "$TEST_REPO" init -q
mkdir -p "$TEST_REPO/docs"
mkdir -p "$TEST_REPO/.dev-graph/plans/example"
mkdir -p "$TEST_REPO/.dev-graph/plans/feature-package-feat-mf-business-classification"

run_hook() {
  local command="$1"
  printf '{"tool_input":{"command":"%s"}}' "$command" \
    | (cd "$TEST_REPO" && bash "$GUARD" --host test)
}

expect_pass() {
  local label="$1" command="$2"
  if ! run_hook "$command" >/dev/null 2>&1; then
    printf 'FAIL: %s\n' "$label" >&2
    exit 1
  fi
}

expect_block() {
  local label="$1" command="$2" output status
  set +e
  output=$(run_hook "$command" 2>&1)
  status=$?
  set -e
  if [ "$status" -ne 2 ]; then
    printf 'FAIL: %s (exit=%s)\n' "$label" "$status" >&2
    exit 1
  fi
  if printf '%s' "$output" | grep -Eq 'example|private-export'; then
    printf 'FAIL: %s (検出した値を出力している)\n' "$label" >&2
    exit 1
  fi
}

printf '# safe\n\n`samples/sample-mf-2025.csv` と `/api/import` は許可する。\n' \
  > "$TEST_REPO/docs/note.md"
printf '%s\n' '{"sample":"samples/sample-mf-2025-10-01.csv","endpoint":"/api/import"}' \
  > "$TEST_REPO/docs/safe.json"
printf '%s\n' '<a href="/api/import">import</a><code>samples/sample-mf-2025.csv</code>' \
  > "$TEST_REPO/docs/safe.html"
expect_pass '匿名化サンプルとAPIパスは許可' 'git add docs/note.md'
expect_pass '読み取り専用git操作は許可' 'git status --short'
expect_block '強制addは拒否' 'git add -f samples/example.csv'
expect_block 'コマンド引数の実データパスを値非表示で拒否' 'git add /Users/example/Downloads/private-export.csv'

printf '# unsafe\n\n`/Users/example/Downloads/private-export.csv`\n' \
  > "$TEST_REPO/docs/note.md"
expect_block 'ホーム配下の書出し参照を拒否' 'git add docs/note.md'

printf '%s\n' '# unsafe' '' '`/home/example/Documents/export.xlsx`' \
  > "$TEST_REPO/docs/note.md"
expect_block 'Linuxホームの絶対パスを拒否' 'git commit -m test'

printf '%s\n' '# unsafe' '' '`C:\Users\example\Documents\export.xlsx`' \
  > "$TEST_REPO/docs/note.md"
expect_block 'Windowsホームの絶対パスを拒否' 'git push origin test'

printf '# unsafe\n\n`data/private-export.csv`\n' > "$TEST_REPO/docs/note.md"
expect_block 'data配下の具体ファイル参照を拒否' 'git commit -m test'

printf '# safe again\n' > "$TEST_REPO/docs/note.md"
printf '%s\n' '{"source":"/Users/example/Documents/report.json"}' \
  > "$TEST_REPO/.dev-graph/plans/example/goal-spec.json"
expect_block '.dev-graphのgoal-spec JSONも拒否' 'git add .dev-graph'

printf '%s\n' '{"source":"${LOCAL_HOME}/Documents/report.json"}' \
  > "$TEST_REPO/.dev-graph/plans/example/goal-spec.json"
printf '%s\n' '<code>raw-data/private-export.xlsx</code>' \
  > "$TEST_REPO/.dev-graph/plans/example/task-specs.html"
expect_block '.dev-graphの生成HTMLも拒否' 'git push origin test'

printf '%s\n' '<code>${LOCAL_DATA_FILE}</code>' \
  > "$TEST_REPO/.dev-graph/plans/example/task-specs.html"

printf '%s\n' '{"source":"statement_2025-10-01.csv"}' \
  > "$TEST_REPO/.dev-graph/plans/feature-package-feat-mf-business-classification/goal-spec.json"
expect_block '日付付きの裸の書出し名を拒否' 'git add .dev-graph'

printf '%s\n' '{"source":"${LOCAL_SOURCE_FILE}"}' \
  > "$TEST_REPO/.dev-graph/plans/feature-package-feat-mf-business-classification/goal-spec.json"
printf '%s\n' '<p>実CSVの実測値は12件</p>' \
  > "$TEST_REPO/.dev-graph/plans/feature-package-feat-mf-business-classification/task-specs.html"
expect_block '生成HTMLの実入力と具体集計の併記を拒否' 'git commit -m test'

printf '%s\n' '<p>匿名合成入力の検証結果は ${LOCAL_RECORD_COUNT}</p>' \
  > "$TEST_REPO/.dev-graph/plans/feature-package-feat-mf-business-classification/task-specs.html"
printf '%s\n' '<code>raw-data/private-export.xlsx</code>' \
  > "$TEST_REPO/docs/generated.html"
expect_block 'HTML内のraw-data参照も拒否' 'git push origin test'

printf '%s\n' '<code>${LOCAL_DATA_FILE}</code>' > "$TEST_REPO/docs/generated.html"
(cd "$TEST_REPO" && bash "$GUARD" --scan-public-docs >/dev/null)

printf 'guard-real-data: all tests passed\n'
