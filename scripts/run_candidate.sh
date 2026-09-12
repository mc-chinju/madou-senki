#!/usr/bin/env bash
# Freeze one candidate and bind complete suite reports to that exact input set.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Candidate run requires a clean worktree.' >&2
  exit 1
fi
mkdir -p .cache/run
python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-d4-not-applicable-bindings.json
python3 scripts/record_runtime_run.py --freeze-output .cache/run/snapshot.json
run_status=0
pnpm exec vitest run --maxWorkers=2 --reporter=json --outputFile=.cache/run/unit.json || run_status=1
WRANGLER_LOG_PATH=../../.cache/wrangler/logs pnpm --filter @madou/worker exec vitest run --maxWorkers=2 --reporter=json --outputFile=../../.cache/run/worker.json || run_status=1
PLAYWRIGHT_JSON_OUTPUT_FILE="$PWD/.cache/run/browser.json" pnpm exec playwright test --reporter=line,json || run_status=1
python3 scripts/record_runtime_run.py \
  --snapshot .cache/run/snapshot.json --vitest .cache/run/unit.json --vitest .cache/run/worker.json --playwright .cache/run/browser.json \
  --command 'pnpm exec vitest run --maxWorkers=2' \
  --command 'pnpm --filter @madou/worker exec vitest run --maxWorkers=2' \
  --command 'pnpm exec playwright test' \
  --exit-code "$run_status" --output "${1:-docs/operations/evidence/2026-09-11-candidate-run.json}"
exit "$run_status"
