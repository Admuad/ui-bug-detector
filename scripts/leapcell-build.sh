#!/bin/sh

# Fail on any error
set -e

echo "--- Leapcell Build Started ---"

# 1. Install system dependencies for Playwright
# This requires a Debian-based runtime (like nodejs20 debian)
echo "Installing Playwright system dependencies..."
npx playwright install-deps chromium

# 2. Install the browser binary itself
echo "Installing Chromium browser..."
npx playwright install chromium

# 3. Standard Next.js build
echo "Installing npm dependencies..."
npm install --legacy-peer-deps

echo "Building Next.js app..."
npm run build

echo "--- Leapcell Build Complete ---"
