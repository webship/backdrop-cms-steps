#!/usr/bin/env bash
# Builds a fresh Backdrop CMS site (the standard install profile: Post, Page and
# Card content types, the Basis theme, the Seven administration theme, the
# administration bar and the default layouts) inside a DDEV project,
# non-interactively, the way the DDEV quickstart documents it (the Bee command
# line add-on downloads core and installs the site). It then creates the test
# accounts and a little deterministic content, and exports LAUNCH_URL for the
# test job.
#
# Settings (environment variables, all optional):
#   PHP_VERSION      the PHP version of the container  (default 8.3)
#   PROJECT_NAME     the DDEV project name             (default backdropcmssteps)
#   SITE_DIR         the project folder                (default a new temporary folder)
#   ADMIN_USER, ADMIN_PASSWORD     the administrator        (default admin / Admin123456789!)
#   EDITOR_USER, EDITOR_PASSWORD   an account with the stock "Editor" role (default editor / Editor123456789!)
#   MEMBER_USER, MEMBER_PASSWORD   an account with no role beyond "Authenticated" (default member / Member123456789!)
#   GITHUB_TOKEN or GH_TOKEN       a token for the download of core, to lift the anonymous limit of the GitHub API
# The accounts are configuration: they are created once here and named in
# cucumber.js; the features never create or delete users.
set -euo pipefail

PHP_VERSION="${PHP_VERSION:-8.3}"
PROJECT_NAME="${PROJECT_NAME:-backdropcmssteps}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123456789!}"
EDITOR_USER="${EDITOR_USER:-editor}"
EDITOR_PASSWORD="${EDITOR_PASSWORD:-Editor123456789!}"
MEMBER_USER="${MEMBER_USER:-member}"
MEMBER_PASSWORD="${MEMBER_PASSWORD:-Member123456789!}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

ddev config --project-type=backdrop --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION"
ddev add-on get backdrop-ops/ddev-backdrop-bee
ddev start

# The current stable release of core, then the standard install profile.
# The download asks the GitHub API, which allows sixty anonymous requests an
# hour from one address. With a token (GITHUB_TOKEN or GH_TOKEN) the build does
# not depend on what else used that address.
DOWNLOAD_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -n "$DOWNLOAD_TOKEN" ]; then
  ddev bee download-core --github-token="$DOWNLOAD_TOKEN"
else
  ddev bee download-core
fi
ddev bee site-install --username="$ADMIN_USER" --password="$ADMIN_PASSWORD" --email="admin@example.com" \
  --db-name=db --db-user=db --db-pass=db --db-host=db --auto

# The test accounts. The administrator was created by the installer above; the
# "Editor" role ships with the standard profile.
ddev bee user-create "$EDITOR_USER" --mail="$EDITOR_USER@example.com" --password="$EDITOR_PASSWORD"
ddev bee user-add-role editor "$EDITOR_USER"
ddev bee user-create "$MEMBER_USER" --mail="$MEMBER_USER@example.com" --password="$MEMBER_PASSWORD"

# Deterministic content and the few settings the suite relies on (see the file).
cp "$SCRIPT_DIR/seed-site.php" "$SITE_DIR/seed-site.php"
ddev bee php-script seed-site.php
rm -f "$SITE_DIR/seed-site.php"

# The search index is filled by cron; without it every search answers "no results".
ddev bee cron
ddev bee cache-clear all

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
echo "Built Backdrop CMS $(ddev bee status 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | awk '/Backdrop CMS/ {print $NF; exit}') at $SITE_URL"
