#!/usr/bin/env bash
# Tests, builds and publishes to Firebase Hosting, then checks that each live site serves the new build.
#   npm run deploy            both sites (default)
#   npm run deploy -- testnet only the Testnet site
#   npm run deploy -- mainnet only the Mainnet site
# Each Pi app has its own ownership key, so each site serves its own validation-key.txt.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET=${1:-both}
PROJECT=photo-studio-63929
TESTNET_SITE=https://photo-studio-63929.web.app
MAINNET_SITE=https://photo-studio-live-63929.web.app

[ -s public/validation-key.txt ] || { echo "Missing public/validation-key.txt (Testnet ownership key). Not deploying."; exit 1; }
[ -s keys/mainnet-validation-key.txt ] || { echo "Missing keys/mainnet-validation-key.txt (Mainnet ownership key). Not deploying."; exit 1; }

echo "Checking..."
npm run lint --silent
npm test --silent

echo "Building..."
npm run build --silent
built=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)

verify() { # site url, label
  local live key
  live=$(curl -s "$1/" | grep -o 'assets/index-[^"]*\.js' | head -1)
  key=$(curl -s -o /dev/null -w '%{http_code}' "$1/validation-key.txt")
  [ "$live" = "$built" ] || { echo "$2: live site serves $live but the build is $built. Try again in a minute."; exit 1; }
  [ "$key" = 200 ] || { echo "$2: validation-key.txt returned $key."; exit 1; }
  echo "Live and verified ($2): $1 ($built)"
}

if [ "$TARGET" = both ] || [ "$TARGET" = testnet ]; then
  echo "Publishing Testnet site..."
  npx --yes firebase-tools@latest deploy --only hosting --project "$PROJECT"
fi
if [ "$TARGET" = both ] || [ "$TARGET" = mainnet ]; then
  echo "Publishing Mainnet site..."
  rm -rf dist-live && cp -R dist dist-live && cp keys/mainnet-validation-key.txt dist-live/validation-key.txt
  npx --yes firebase-tools@latest deploy --only hosting --config firebase.mainnet.json --project "$PROJECT"
fi

echo "Verifying..."
sleep 3
{ [ "$TARGET" = both ] || [ "$TARGET" = testnet ]; } && verify "$TESTNET_SITE" Testnet
{ [ "$TARGET" = both ] || [ "$TARGET" = mainnet ]; } && verify "$MAINNET_SITE" Mainnet
exit 0
