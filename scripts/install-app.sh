#!/bin/bash
# Reconstruit Todo.app et remplace celle de /Applications (sans passer par le .dmg).
set -e
cd "$(dirname "$0")/.."
npx electron-builder --mac dir
APP=$(ls -d dist/mac*/Todo.app | head -1)
osascript -e 'tell application "Todo" to quit' 2>/dev/null || true
sleep 1
rm -rf /Applications/Todo.app
cp -R "$APP" /Applications/Todo.app
xattr -cr /Applications/Todo.app
open /Applications/Todo.app
echo "Todo installée : $APP"
