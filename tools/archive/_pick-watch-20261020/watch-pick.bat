@echo off
chcp 65001 >nul
REM ============================================================
REM  watch-pick.bat - why the scan-pick app cannot write (run ON THE SERVER)
REM
REM  usage (in C:\yinjia\tools):
REM    watch-pick.bat state     read-only: is the rid-unblock applied? any new flow today? can target rid be written?
REM    watch-pick.bat sessions  read-only: who is connected (host / program / database)
REM    watch-pick.bat start     start capturing write errors (errors only, no business data touched)
REM    watch-pick.bat read      show captured errors (error no / message / db / client / sql text)
REM    watch-pick.bat stop      stop and drop the capture session
REM
REM  typical:  state  ->  start  ->  scan once on the phone  ->  read  ->  stop
REM ============================================================
setlocal
set ACTION=%1
set DIR=%~dp0
set SQLCMD=sqlcmd
where sqlcmd >nul 2>nul
if errorlevel 1 set SQLCMD="C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"

if /i "%ACTION%"=="state"    goto STATE
if /i "%ACTION%"=="sessions" goto SESSIONS
if /i "%ACTION%"=="start"    goto START
if /i "%ACTION%"=="read"     goto READ
if /i "%ACTION%"=="stop"     goto STOP
goto USAGE

:STATE
echo === state snapshot (read-only) ===
%SQLCMD% -I -S localhost -E -d HSDZ_MES -f i:65001 -i "%DIR%_state.sql" -W -s " | "
goto END

:SESSIONS
echo === sessions connected to this SQL Server ===
%SQLCMD% -I -S localhost -E -d master -W -s " | " -Q "SET NOCOUNT ON; SELECT session_id,login_name,host_name,program_name,DB_NAME(database_id) AS db_name,status,CONVERT(varchar(19),last_request_start_time,120) AS last_req FROM sys.dm_exec_sessions WHERE is_user_process=1 ORDER BY session_id"
goto END

:START
echo === start capturing write errors ===
%SQLCMD% -I -S localhost -E -d master -f i:65001 -i "%DIR%_xe_start.sql" -W
echo.
echo now scan once on the phone, then run:  watch-pick.bat read
goto END

:READ
echo === captured write errors ===
%SQLCMD% -I -S localhost -E -d master -f i:65001 -i "%DIR%_xe_read.sql" -W -s " | "
goto END

:STOP
echo === stop and drop capture session ===
%SQLCMD% -I -S localhost -E -d master -f i:65001 -i "%DIR%_xe_stop.sql" -W
goto END

:USAGE
echo usage: watch-pick.bat state ^| sessions ^| start ^| read ^| stop

:END
endlocal
