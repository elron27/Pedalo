@echo off
rem Startet Pedalo: baut bei Bedarf die App und öffnet sie in Chrome (Fenster offen lassen, solange du fährst).
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist dist\index.html call npm run build
node tools\serve.mjs
pause
