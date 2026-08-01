#!/usr/bin/env bash
set -euo pipefail
: "${STAGING_BASE_URL:?Set STAGING_BASE_URL to the staging API origin}"
curl --fail --silent --show-error "${STAGING_BASE_URL%/}/api/health"
curl --fail --silent --show-error "${STAGING_BASE_URL%/}/api/readiness"
printf '\nReadiness probes passed. Complete docs/smoke-testing.md with staging test accounts.\n'
