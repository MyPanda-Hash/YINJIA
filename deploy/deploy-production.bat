@echo off
rem ==================================================================
rem  YINJIA-MES  DEFAULT DEPLOY ROUTE  (incremental: migrate + swap jar)
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE (zh-CN cmd parses .bat as GBK).
rem
rem  Since 2026-10-25 this is the ONLY normal production update route.
rem  It NEVER drops the server database: stop app -> backup DB -> run
rem  the curated migration list -> baseline -> bare-sync recheck ->
rem  swap app.jar -> start -> real login probe.
rem
rem  Full replace (drops the server DB) is an explicit exception and
rem  lives in deploy-all.bat, which now requires CONFIRM-FULL-REPLACE.
rem
rem  Usage (run ON THE SERVER, from the extracted package dir):
rem    deploy-production.bat            read-only CHECK
rem    deploy-production.bat GO         incremental deploy
rem    deploy-production.bat GO APP     jar swap only (no DB steps)
rem ==================================================================
setlocal
set "HERE=%~dp0"
set "MODE=%~1"
set "SUB=%~2"

if /i not "%MODE%"=="GO" goto :pass
rem Refuse accidental full-replace intent on the default entry point.
if /i "%SUB%"=="CONFIRM-FULL-REPLACE" (
  echo RESULT: FAIL-WRONG-ENTRYPOINT
  echo   CONFIRM-FULL-REPLACE belongs to deploy-all.bat, not this script.
  echo   Full replace: deploy-all.bat GO CONFIRM-FULL-REPLACE
  echo   Nothing was changed.
  exit /b 2
)
:pass

if not exist "%HERE%deploy-incremental.bat" (
  echo RESULT: FAIL-NO-INCREMENTAL-SCRIPT
  echo   deploy-incremental.bat is missing from this package.
  echo   Do NOT fall back to a full replace on a production server.
  exit /b 2
)

echo [route] production default = INCREMENTAL (server DB is never dropped)
call "%HERE%deploy-incremental.bat" %1 %2
exit /b %ERRORLEVEL%
