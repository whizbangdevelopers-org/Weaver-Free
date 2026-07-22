#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Build the foundry-local pre-baked E2E runner BASE image on king (which has WAN + docker),
# then ship it to airgapped foundry via `docker save | gzip | ssh foundry docker load`.
#
# WHY: foundry cannot reach Ubuntu apt repos, so it cannot run the apt layer
# (git/openssh/ca-certificates/curl + `npx playwright install-deps`). This bakes that layer
# once on king; foundry's runner (testing/e2e-docker/config/Dockerfile.foundry) then FROMs
# the shipped image and does only `npm ci` (Verdaccio) + `COPY`, no apt. See that Dockerfile
# and Dockerfile.foundry-base for the full rationale.
#
# Usage: ./scripts/build-foundry-e2e-base.sh [playwright-tag]   (default v1.58.2-jammy)
# Keep the tag in sync with @playwright/test in package-lock.json AND
# hosts/foundry/playwright-browser.nix (the CDP browser rides the same base tag).
set -euo pipefail

TAG="${1:-v1.58.2-jammy}"
IMAGE="weaver-e2e-base:${TAG}"
CONFIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../testing/e2e-docker/config" && pwd)"

echo ">> building ${IMAGE} on king (WAN + apt)"
docker build -f "${CONFIG_DIR}/Dockerfile.foundry-base" -t "${IMAGE}" "${CONFIG_DIR}"

echo ">> shipping ${IMAGE} → foundry (docker save | gzip | ssh docker load)"
docker save "${IMAGE}" | gzip -c | ssh foundry 'docker load'

echo ">> verify on foundry"
ssh foundry "docker images ${IMAGE%%:*} --format '{{.Repository}}:{{.Tag}} {{.Size}} {{.ID}}'"
echo ">> done. foundry runner build: cd <clone>/code && docker build -f testing/e2e-docker/config/Dockerfile.foundry -t weaver-e2e-runner ."
