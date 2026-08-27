#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' \
    "Usage:" \
    "  $0 --phase capture --database NAME --config PATH --environment production --output PATH" \
    "  $0 --phase compare --database NAME --config PATH --environment production --baseline PATH --output PATH" \
    "" \
    "Runs fixed read-only schema inspection and SELECT COUNT(*) queries against remote D1." \
    "The compare phase fails when any post-migration count is lower than its baseline."
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

phase=""
database=""
config=""
environment=""
baseline=""
output=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase|--database|--config|--environment|--baseline|--output)
      [[ $# -ge 2 ]] || fail "$1 requires a value"
      value="$2"
      case "$1" in
        --phase) phase="$value" ;;
        --database) database="$value" ;;
        --config) config="$value" ;;
        --environment) environment="$value" ;;
        --baseline) baseline="$value" ;;
        --output) output="$value" ;;
      esac
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[[ "$phase" == "capture" || "$phase" == "compare" ]] || fail "phase must be capture or compare"
[[ "$database" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || fail "database is required and must be a D1 database name"
[[ -f "$config" ]] || fail "config must name an existing Wrangler configuration file"
[[ "$environment" == "production" ]] || fail "environment must be explicitly set to production"
[[ -n "$output" ]] || fail "output is required"
[[ ! -e "$output" ]] || fail "output already exists; use a new evidence path"
[[ -d "$(dirname "$output")" ]] || fail "output directory does not exist"

if [[ "$phase" == "compare" ]]; then
  [[ -f "$baseline" ]] || fail "compare phase requires an existing baseline file"
  [[ "$baseline" != "$output" ]] || fail "baseline and output must be different files"
elif [[ -n "$baseline" ]]; then
  fail "capture phase does not accept a baseline"
fi

for dependency in pnpm jq mktemp date awk; do
  command -v "$dependency" >/dev/null 2>&1 || fail "required command is unavailable: $dependency"
done

config_digest=""
if command -v sha256sum >/dev/null 2>&1; then
  config_digest="$(sha256sum "$config" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  config_digest="$(shasum -a 256 "$config" | awk '{print $1}')"
else
  fail "sha256sum or shasum is required to identify the Wrangler configuration"
fi

readonly tables=(
  account_norm_map
  ai_reports
  ai_tasks
  budgets
  cash_overrides
  cash_entries
  category_options
  attachment_cleanup_jobs
  attachment_object_tombstones
  attachments
  freee_deals
  import_active_targets
  import_runs
  import_writer_claims
  imports
  institution_owners
  mf_transactions
  monthly_agg
  overrides
  password_login_rate_limits
  restored_monthly_agg
  rules
  sub_vendors
  tradeoff_plans
  tx_edits
  unrecorded_months
)

expected_tables="$(printf '%s\n' "${tables[@]}" | jq -R . | jq -cs 'sort')"
table_literals=""
separator=""
for table in "${tables[@]}"; do
  table_literals+="${separator}'${table}'"
  separator=", "
done
discovery_sql="SELECT name AS table_name FROM sqlite_master WHERE type = 'table' AND name IN (${table_literals}) ORDER BY name"

umask 077
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT
discovery_output="$temporary/discovery.json"
discovery_error="$temporary/discovery.stderr"
existing_tables="$temporary/existing-tables.json"
count_output="$temporary/counts-response.json"
count_error="$temporary/counts-response.stderr"
normalized_counts="$temporary/counts.json"
result_file="$temporary/result.json"
baseline_counts="$temporary/baseline-counts.json"

if [[ "$phase" == "compare" ]]; then
  if ! jq -ce \
    --arg database "$database" \
    --arg environment "$environment" \
    --arg config_digest "$config_digest" \
    --argjson expected "$expected_tables" '
    if .schema_version != 1 or
       .document_type != "d1_row_count_evidence" or
       .phase != "before" or
       .status != "baseline_captured" or
       .database != $database or
       .environment != $environment or
       .config_digest != $config_digest or
       (.captured_at | type) != "string" or
       (.counts | type) != "array"
    then error("invalid baseline")
    else
      (.counts | map(
        if (.table | type) == "string" and
           (.count | type) == "number" and
           .count >= 0 and
           (.count | floor) == .count
        then {table, count}
        else error("invalid baseline count")
        end
      ) | sort_by(.table)) as $counts
      | if ($counts | length) == 0 then
          error("empty baseline table set")
        elif (($counts | map(.table) | unique | length) != ($counts | length)) then
          error("duplicate baseline table")
        elif any($counts[]; .table as $table | ($expected | index($table)) == null) then
          error("baseline contains a table outside the allowlist")
        else $counts
        end
    end
  ' "$baseline" >"$baseline_counts" 2>/dev/null; then
    fail "baseline is invalid or does not match the selected target"
  fi
fi

if ! pnpm --filter @kanjo/api exec wrangler d1 execute "$database" \
  --config "$config" \
  --remote \
  --json \
  --command "$discovery_sql" >"$discovery_output" 2>"$discovery_error"; then
  fail "D1 table inspection failed; no evidence file was written"
fi

if ! jq -ce --argjson allowed "$expected_tables" '
  if type != "array" or length != 1 or .[0].success != true or (.[0].results | type) != "array" then
    error("unexpected Wrangler response")
  else
    (.[0].results | map(
      if (.table_name | type) == "string"
      then .table_name
      else error("invalid table row")
      end
    ) | sort) as $existing
    | if ($existing | length) == 0 then
        error("empty table set")
      elif (($existing | unique | length) != ($existing | length)) then
        error("duplicate table")
      elif any($existing[]; . as $table | ($allowed | index($table)) == null) then
        error("table outside allowlist")
      else $existing
      end
  end
' "$discovery_output" >"$existing_tables" 2>/dev/null; then
  fail "D1 returned an unrecognized table inspection response; no evidence file was written"
fi

if [[ "$phase" == "compare" ]]; then
  before_json="$(<"$baseline_counts")"
  if ! jq -e --argjson before "$before_json" '
    . as $existing
    | all($before[]; .table as $table | ($existing | index($table)) != null)
  ' "$existing_tables" >/dev/null 2>&1; then
    fail "a baseline table is absent from the current database; no evidence file was written"
  fi
fi

sql=""
while IFS= read -r table; do
  # D1のcompound SELECT上限に依存しないよう、各tableを独立statementで数える。
  # Wranglerはstatementごとのresultを配列で返すため、後段で全resultを平坦化する。
  sql+="SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM \"${table}\";"
done < <(jq -r '.[]' "$existing_tables")

if ! pnpm --filter @kanjo/api exec wrangler d1 execute "$database" \
  --config "$config" \
  --remote \
  --json \
  --command "$sql" >"$count_output" 2>"$count_error"; then
  fail "D1 row-count inspection failed; no evidence file was written"
fi

existing_json="$(<"$existing_tables")"
if ! jq -ce --argjson expected "$existing_json" '
  if type != "array" or length == 0 or any(.[]; .success != true or (.results | type) != "array") then
    error("unexpected Wrangler response")
  else
    ([.[].results[]] | map(
      if (.table_name | type) == "string" and
         (.row_count | type) == "number" and
         .row_count >= 0 and
         (.row_count | floor) == .row_count
      then {table: .table_name, count: .row_count}
      else error("invalid count row")
      end
    ) | sort_by(.table)) as $counts
    | if ($counts | map(.table)) == $expected
      then $counts
      else error("table set mismatch")
      end
  end
' "$count_output" >"$normalized_counts" 2>/dev/null; then
  fail "D1 returned an unrecognized row-count response; no evidence file was written"
fi

captured_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
counts_json="$(<"$normalized_counts")"

if [[ "$phase" == "capture" ]]; then
  jq -cn \
    --arg database "$database" \
    --arg environment "$environment" \
    --arg config_digest "$config_digest" \
    --arg captured_at "$captured_at" \
    --argjson counts "$counts_json" \
    '{
      schema_version: 1,
      document_type: "d1_row_count_evidence",
      phase: "before",
      status: "baseline_captured",
      database: $database,
      environment: $environment,
      config_digest: $config_digest,
      captured_at: $captured_at,
      counts: $counts
    }' >"$result_file"
  mv "$result_file" "$output"
  jq -c '{status,captured_at,counts}' "$output"
  exit 0
fi

comparison="$(jq -cn --argjson before "$before_json" --argjson after "$counts_json" '
  [$before[] as $prior
    | ($after[] | select(.table == $prior.table)) as $current
    | {
        table: $prior.table,
        before: $prior.count,
        after: $current.count,
        delta: ($current.count - $prior.count),
        status: (if $current.count >= $prior.count then "pass" else "decreased" end)
      }
  ]
')"

status="$(jq -r 'if all(.[]; .status == "pass") then "pass" else "fail" end' <<<"$comparison")"
baseline_captured_at="$(jq -r '.captured_at' "$baseline")"

jq -cn \
  --arg database "$database" \
  --arg environment "$environment" \
  --arg config_digest "$config_digest" \
  --arg baseline_captured_at "$baseline_captured_at" \
  --arg captured_at "$captured_at" \
  --arg status "$status" \
  --argjson counts "$comparison" \
  '{
    schema_version: 1,
    document_type: "d1_row_count_evidence",
    phase: "after",
    status: $status,
    database: $database,
    environment: $environment,
    config_digest: $config_digest,
    baseline_captured_at: $baseline_captured_at,
    captured_at: $captured_at,
    counts: $counts
  }' >"$result_file"

mv "$result_file" "$output"
jq -c '{status,baseline_captured_at,captured_at,counts}' "$output"

[[ "$status" == "pass" ]] || exit 1
