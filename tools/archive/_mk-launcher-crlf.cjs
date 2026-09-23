/**
 * _mk-launcher-crlf.cjs — 一次性小工具:把 tools/scripts/start-backend.bat 做成可在临时目录运行的副本
 *
 * 【为什么需要它】
 *   ① 原脚本是 **LF-only**(仓库里就这样,不要改它 —— 它同时在 Linux 侧被用),而 cmd.exe 执行
 *      .bat 时按字节偏移找 `goto :label`,LF-only 会让跳转错位 ⇒ 不能直接 `cmd /c` 跑它。
 *   ② 副本放到临时目录后,脚本里的 `cd /d "%~dp0..\backend"` 会指到临时目录的上级 ⇒ 找不到 jar。
 *      故把 `%~dp0` 就地换成原脚本所在目录的绝对路径。
 *   其余内容(含从 User 作用域取 AK 的两条 powershell 回退)**逐字不动** ——
 *   本工具只搬路径,不碰任何凭证。
 *
 * 用法:node tools/archive/_mk-launcher-crlf.cjs
 */
const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '..', 'scripts', 'start-backend.bat')
const SCRIPT_DIR = path.dirname(SRC) + path.sep // 结尾带反斜杠,替掉 %~dp0 后拼出同样的路径

const raw = fs.readFileSync(SRC)
if (/\r\n/.test(raw.toString('latin1'))) {
  console.log('⚠ 源脚本已含 CRLF —— 可能已被改过,先确认再跑')
} else {
  console.log('源脚本确为 LF-only(仓库里保持原样)')
}

const fixed = raw
  .toString('latin1')
  .split('%~dp0')
  .join(SCRIPT_DIR)
  .replace(/\r?\n/g, '\r\n')

const out = path.join(process.env.TEMP || 'C:/Windows/Temp', '_start-backend-crlf.bat')
fs.writeFileSync(out, Buffer.from(fixed, 'latin1'))
console.log('副本 ->', out)
console.log('cd 行:', fixed.split(/\r\n/).find((l) => l.startsWith('cd /d')))
