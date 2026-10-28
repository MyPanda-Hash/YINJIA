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

module.exports = { closeBrowser }
