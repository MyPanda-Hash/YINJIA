/**
 * killTree(pid) — 在 Windows 上真正杀掉整棵进程树(2026-10-25)
 *
 * 为什么需要它:验证脚本用 `spawn(EDGE, [...], { detached: true })` 起无头浏览器,
 * 收尾`process.kill(-pid)` 在 Windows 上**杀不掉** —— Node 不支持负 pid 的进程组语义,
 * 抛错又被 try/catch 吞掉 ⇒ Edge 进程越积越多(实测一次会话泄漏 237 个),
 * 最终把机器内存吃光、把 8090 的 java 一起拖死,表现为"服务莫名掉线"。
 *
 * 正确做法:走 `taskkill /PID <pid> /T /F`(/T = 连同子进程一起)。
 */
const { execFileSync } = require('child_process')

function killTree(pid) {
  if (!pid) return
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch (e) {
    // 进程已退出时 taskkill 返回非 0,属正常
  }
}

module.exports = { killTree }
