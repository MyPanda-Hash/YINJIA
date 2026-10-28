/**
 * closeBrowser(port) — 干净关掉无头浏览器(2026-10-25)
 *
 * 为什么不能用 taskkill:验证脚本 spawn 的是 Edge **启动器**,它拉起真正的浏览器后自己就退出了,
 * 所以 `taskkill /PID <启动器pid>` 什么也杀不到;真正在跑的是另一个 pid 及其十几个子进程。
 * 结果每跑一个 UI 脚本就泄漏一整份浏览器,实测一次会话累积 237 个 msedge 进程,
 * 把内存吃光后**连带把 8090 的 java 一起拖死**,表现为"服务莫名掉线"。
 *
 * 正确做法:走 CDP 的 `Browser.close` —— 浏览器自己有序退出,连子进程一起收掉。
 */
const http = require('http')

function httpJson(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

/** 关掉指定调试端口上的浏览器;连不上就当已退出(不抛错) */
async function closeBrowser(port) {
  try {
    const ver = await httpJson(port, '/json/version')
    const url = ver && ver.webSocketDebuggerUrl
    if (!url) return false
    const { connect } = require('./mini-ws.cjs')
    const sock = await connect(url)
    try {
      sock.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
    } catch (e) { /* 浏览器可能已先行退出 */ }
    // 给它一点时间收尾,再断开 socket
    await new Promise((r) => setTimeout(r, 500))
    try { sock.close() } catch (e) { /* ignore */ }
    return true
  } catch (e) {
    return false
  }
}

/**
 * 兜底清理:**只杀带 `--headless` 的 msedge**。
 *
 * 为什么需要:实测 `Browser.close` 并不总能穿透(有时 socket 刚连上就被 server 侧断开),
 * 残留的浏览器会继续吃内存。而验证脚本一律用 `--headless=new` 启动,
 * **用户真实的 Edge 从不带这个参数** —— 按它过滤既彻底又不会误伤。
 */
/**
 * 兜底清理:只杀**本脚本自己起的**那个无头浏览器。
 *
 * 为什么需要:`Browser.close` 并不总能穿透(有时 socket 刚连上就被 server 侧断开),
 * 残留的浏览器会继续吃内存 —— 实测一次会话累积 237 个 msedge 后把 8090 的 java 一起拖死。
 *
 * ⚠ 必须按 `--user-data-dir` 精确过滤,**不能写成"杀掉所有 --headless"**:
 *   同一台机器上可能还有别的会话/别人在跑同类脚本,一刀切会把人家正在用的浏览器一起杀掉,
 *   表现为"脚本跑到一半静默退出"(CDP socket 被对面关掉,promise 永不 settle,Node 事件循环空转退出)。
 *
 * @param {string} profileHint 该脚本 user-data-dir 里的独特片段(如 '_menu_loc')
 */
function killHeadlessEdge(profileHint) {
  if (!profileHint) return false
  try {
    // 找命令行里带本脚本 profile 的浏览器进程,再用 taskkill /T 连子进程一起收
    // —— 子进程(renderer/gpu/crashpad)的命令行里通常没有 profile 片段,只按它过滤会漏。
    const esc = String(profileHint).replace(/'/g, "''")
    const ps = "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\""
      + " | Where-Object { $_.CommandLine -like '*" + esc + "*' }"
      + " | ForEach-Object { & taskkill /PID $_.ProcessId /T /F 2>$null }"
    require('child_process').execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { stdio: 'ignore', timeout: 40000 })
    return true
  } catch (e) {
    return false
  }
}

module.exports = { closeBrowser, killHeadlessEdge }
