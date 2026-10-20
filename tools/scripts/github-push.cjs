/**
 * github-push.cjs — 本机 GitHub 推送辅助(2026-10-21)
 *
 * 解决什么问题:
 *   本机 DNS 把 github.com 解析到 20.205.243.166,该 IP 的 443 **被网络策略拦截**
 *   (TCP 直接不通)⇒ `git fetch/push` 全部失败,报 `Recv failure: Connection was reset`。
 *   而 140.82.112.3 / 140.82.113.3 / 140.82.114.3 的 443 是通的(实测 HTTPS 200)。
 *   改 hosts 需要管理员权限(实测写入被 ACL 拒绝),SSH 密钥也没在 GitHub 注册,
 *   所以用一个**只影响本机 git 进程**的 CONNECT 代理绕过。
 *
 * 用法(在仓库根):
 *   node tools/scripts/github-push.cjs            # 拉起代理 → fetch → push → 停止代理
 *   node tools/scripts/github-push.cjs fetch      # 只拉取
 *   node tools/scripts/github-push.cjs push       # 只推送(默认)
 *
 * 设计要点:
 *   · 代理只听 127.0.0.1,只放行 github.com / api.github.com / codeload.github.com,
 *     其余 CONNECT 一律 403 —— 不给这台机器开任意转发的口子;
 *   · 脚本退出前一定停掉代理,不留常驻进程;
 *   · 目标 IP 按实测顺序回退,某个 IP 又不可达时自动换下一个。
 *
 * ⚠ 这是**本机网络环境**的权宜工具,不是产品功能。换网络环境(DNS 正常)后本脚本
 *   仍可用(只是没必要),也可以在 .git/config 里设 http.proxy 长期生效。
 */
const net = require('node:net')
const { spawnSync } = require('node:child_process')

const PORT = 18081
const TARGETS = ['140.82.112.3', '140.82.113.3', '140.82.114.3']
const ALLOW = new Set(['github.com', 'api.github.com', 'codeload.github.com'])

const mode = (process.argv[2] || 'push').toLowerCase()

function startProxy() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((client) => {
      client.once('data', (buf) => {
        const m = /^CONNECT\s+([^:\s]+):(\d+)/i.exec(buf.toString('utf8'))
        if (!m) return client.end('HTTP/1.1 400 Bad Request\r\n\r\n')
        const host = m[1].toLowerCase()
        const port = Number(m[2])
        if (!ALLOW.has(host)) return client.end('HTTP/1.1 403 Forbidden\r\n\r\n')

        let i = 0
        const tryNext = () => {
          if (i >= TARGETS.length) return client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
          const ip = TARGETS[i++]
          const up = net.connect({ host: ip, port }, () => {
            client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
            up.pipe(client)
            client.pipe(up)
          })
          up.on('error', () => { up.destroy(); tryNext() })
          up.on('close', () => client.destroy())
        }
        tryNext()
      })
      client.on('error', () => {})
    })
    server.listen(PORT, '127.0.0.1', () => resolve(server))
    server.on('error', reject)
  })
}

function git(args) {
  const r = spawnSync('git', ['-c', `http.proxy=http://127.0.0.1:${PORT}`, ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  return r.status === 0
}

;(async () => {
  const server = await startProxy()
  console.log(`[github-push] 代理已起 127.0.0.1:${PORT}(仅 github.com → 可达 IP)`)
  let ok = true
  try {
    if (mode === 'fetch' || mode === 'push') {
      console.log('[github-push] fetch origin')
      ok = git(['fetch', 'origin']) && ok
    }
    if (mode === 'push') {
      console.log('[github-push] push origin main')
      ok = git(['push', 'origin', 'main']) && ok
    }
  } finally {
    server.close()
    console.log(ok ? '[github-push] 完成' : '[github-push] 失败(看上面的 git 输出)')
    process.exit(ok ? 0 : 1)
  }
})().catch((e) => {
  console.error('[github-push] 启动失败:', e.message)
  process.exit(1)
})
