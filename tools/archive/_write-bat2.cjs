// _write-bat2.cjs — 后端 bat 加自动重启循环(误关窗口/崩溃/DB未就绪均自愈)
const fs = require('fs')
const nl = '\r\n'
const backendBat = [
  '@echo off',
  'title YINJIA-MES backend (8090) - KEEP THIS WINDOW OPEN',
  'cd /d %~dp0',
  ':loop',
  '"%USERPROFILE%\\.jdks\\ms-25.0.4\\bin\\java.exe" -jar target\\yinjia-mes-backend-0.1.0.jar',
  'echo.',
  'echo Backend exited. Restarting in 5 seconds... (close this window to stop)',
  'timeout /t 5 /nobreak >nul',
  'goto loop',
].join(nl) + nl

fs.writeFileSync('backend/start-backend.bat', backendBat, 'utf8')
console.log(fs.readFileSync('backend/start-backend.bat', 'utf8'))
