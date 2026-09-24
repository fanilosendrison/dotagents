#!/usr/bin/env bash
set -euo pipefail

platform_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
printf 'platform-root=%s\n' "$platform_root" >> "${GITHUB_OUTPUT:?}"
