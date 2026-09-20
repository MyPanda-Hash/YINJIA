// _write-bat.cjs — 生成前后端启动 bat(ASCII,避免 bash/node 内联转义翻车)
const fs = require('fs')
const nl = '\r\n'

const backendBat = [
  '@echo off',
  'title YINJIA-MES backend (8090)',
  'cd /d %~dp0',
  '"%USERPROFILE%\\.jdks\\ms-25.0.4\\bin\\java.exe" -jar target\\yinjia-mes-backend-0.1.0.jar',
  'pause',
].join(nl) + nl

const viteBat = [
  '@echo off',
  'title YINJIA-MES vite (5173)',
  'cd /d %~dp0',
  'npm run dev',
  'pause',
].join(nl) + nl

fs.writeFileSync('backend/start-backend.bat', backendBat, 'utf8')
fs.writeFileSync('frontend/start-vite.bat', viteBat, 'utf8')
console.log(fs.readFileSync('backend/start-backend.bat', 'utf8'))
