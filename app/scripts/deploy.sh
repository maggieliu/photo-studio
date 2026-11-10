#!/usr/bin/env bash
# Tests, builds and publishes the site to Firebase Hosting, then checks that the live site is serving it.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=photo-studio-63929
SITE=https://$PROJECT.web.app

# Pi checks this file to confirm we own the address. It is git-ignored, so it must exist on this computer.
[ -s public/validation-key.txt ] || { echo "Missing public/validation-key.txt (the Pi ownership key). Not deploying."; exit 1; }

echo "Checking..."
npm run lint --silent
npm test --silent

echo "Building..."
npm run build --silent

echo "Publishing..."
npx --yes firebase-tools@latest deploy --only hosting --project "$PROJECT"

echo "Verifying..."
sleep 3
live=$(curl -s "$SITE/" | grep -o 'assets/index-[^"]*\.js' | head -1)
built=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
key=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/validation-key.txt")
[ "$live" = "$built" ] || { echo "Live site serves $live but the build is $built. Try again in a minute."; exit 1; }
[ "$key" = 200 ] || { echo "validation-key.txt returned $key on the live site."; exit 1; }
echo "Live and verified: $SITE ($built)"
