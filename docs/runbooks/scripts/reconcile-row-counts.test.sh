#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
target="$script_dir/reconcile-row-counts.sh"
fixture="$script_dir/test-fixtures/pnpm"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

mkdir -p "$temporary/bin"
ln -s "$fixture" "$temporary/bin/pnpm"

run_target() {
  PATH="$temporary/bin:$PATH" WRANGLER_STUB_SCENARIO="$1" bash "$target" "${@:2}"
}

common=(
  --database kanjo-db
  --config "$repo_root/packages/api/wrangler.jsonc"
  --environment production
)

before="$temporary/before.json"
after="$temporary/after.json"

run_target subset_before --phase capture "${common[@]}" --output "$before" >/dev/null
jq -e '
  .status == "baseline_captured" and
  .phase == "before" and
  (.counts | length) == 17 and
  ([.counts[].table] | index("mf_transactions")) != null and
  ([.counts[].count] | all(. == 2))
' "$before" >/dev/null

run_target full_after --phase compare "${common[@]}" --baseline "$before" --output "$after" >/dev/null
jq -e '
  .status == "pass" and
  .phase == "after" and
  (.counts | length) == 17 and
  ([.counts[].status] | all(. == "pass")) and
  ([.counts[].delta] | all(. == 1))
' "$after" >/dev/null

if run_target missing_baseline_table --phase compare "${common[@]}" \
  --baseline "$before" --output "$temporary/missing-table.json" >/dev/null 2>&1; then
  printf '%s\n' "a current schema missing a baseline table must fail closed" >&2
  exit 1
fi
if [[ -e "$temporary/missing-table.json" ]]; then
  printf '%s\n' "missing baseline tables must not produce comparison evidence" >&2
  exit 1
fi

if run_target decrease --phase compare "${common[@]}" --baseline "$before" --output "$temporary/decrease.json" >/dev/null 2>&1; then
  printf '%s\n' "expected a decreased row count to fail closed" >&2
  exit 1
fi
jq -e '.status == "fail" and ([.counts[] | select(.status == "decreased")] | length) == 1' \
  "$temporary/decrease.json" >/dev/null

failure_output="$(run_target command_failure --phase capture "${common[@]}" --output "$temporary/failure.json" 2>&1 || true)"
if [[ "$failure_output" == *"SHOULD_NOT_LEAK"* ]]; then
  printf '%s\n' "wrangler stderr leaked through the reconciliation script" >&2
  exit 1
fi
if [[ -e "$temporary/failure.json" ]]; then
  printf '%s\n' "command failure must not leave a successful evidence file" >&2
  exit 1
fi

if run_target malformed --phase capture "${common[@]}" --output "$temporary/malformed.json" >/dev/null 2>&1; then
  printf '%s\n' "malformed wrangler output must fail closed" >&2
  exit 1
fi

if run_target unknown_table --phase capture "${common[@]}" --output "$temporary/unknown.json" >/dev/null 2>&1; then
  printf '%s\n' "unknown discovered tables must fail closed" >&2
  exit 1
fi

if run_target empty_discovery --phase capture "${common[@]}" --output "$temporary/empty.json" >/dev/null 2>&1; then
  printf '%s\n' "an empty baseline table subset must fail closed" >&2
  exit 1
fi

if PATH="$temporary/bin:$PATH" WRANGLER_STUB_SCENARIO=subset_before \
  bash "$target" --phase capture --database kanjo-db >/dev/null 2>&1; then
  printf '%s\n' "missing config/environment/output arguments must fail" >&2
  exit 1
fi

printf '%s\n' "PASS: offline row-count reconciliation scenarios"
