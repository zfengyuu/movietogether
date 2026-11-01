#!/usr/bin/env bash
set -e
if ! command -v node >/dev/null; then
 echo 'Cần cài Node.js 20.19+ hoặc 22.12+: https://nodejs.org/'
 exit 1
fi
npm install
echo 'Mở http://localhost:5173'
npm run dev
