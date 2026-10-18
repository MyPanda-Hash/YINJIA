#!/usr/bin/env node
/**
 * 探针:验证服务端「空闲长连接」是否会被主动关闭(keep-alive-timeout 是否生效)。
 * 做法:同一条 TCP 连接上发一次 GET,空转 N 秒,再发一次 —— 第二次能收到响应=服务端没关(坏),
 * 连接被对端关闭=服务端按超时关闭(好)。
 * 用法: node tools/archive/_diag-scan-report/_probe-keepalive.mjs [host] [port] [空闲秒数]
 */
import net from 'node:net'

const HOST = process.argv[2] || '127.0.0.1'
const PORT = Number(process.argv[3] || 8090)
const IDLE = Number(process.argv[4] || 15)

const sock = net.connect(PORT, HOST)
let buf = ''
let phase = 1
let closed = false

sock.on('connect', () => {
  console.log(`已连接 ${HOST}:${PORT},发第 1 个请求...`)
  sock.write('GET / HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: keep-alive\r\n\r\n')
})
sock.on('data', (d) => {
  buf += d.toString('latin1')
  if (phase === 1 && buf.includes('\r\n\r\n') && /Content-Length: (\d+)/i.test(buf)) {
    const m = buf.match(/Content-Length: (\d+)/i)
    const want = Number(m[1])
    const head = buf.indexOf('\r\n\r\n') + 4
    if (buf.length - head >= want) {
      const connHdr = (buf.match(/Connection:[^\r\n]*/i) || ['(无)'])[0]
      const kaHdr = (buf.match(/Keep-Alive:[^\r\n]*/i) || ['(无)'])[0]
      console.log(`第 1 个响应 OK;${connHdr};${kaHdr}`)
      phase = 2
      buf = ''
      console.log(`空转 ${IDLE} 秒(模拟页面长时间不用)...`)
      setTimeout(() => {
        if (closed) return
        console.log('空转结束,在同一连接上发第 2 个请求...')
        sock.write('GET /favicon.svg HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: keep-alive\r\n\r\n')
        setTimeout(() => {
          if (!closed) {
            console.log(buf ? '第 2 个响应:收到 ' + buf.length + ' 字节(说明服务端没关空闲连接)' : '第 2 个请求没有任何响应')
            process.exit(0)
          }
        }, 4000)
      }, IDLE * 1000)
    }
  }
})
sock.on('close', () => {
  closed = true
  if (phase === 2) console.log('✔ 服务端已按空闲超时关闭了这条连接(第 2 次请求需要新建连接)')
  else console.log('连接在收到完整响应前关闭')
  process.exit(0)
})
sock.on('error', (e) => { console.log('socket error:', e.message); process.exit(0) })
setTimeout(() => { console.log('兜底超时退出'); process.exit(0) }, (IDLE + 12) * 1000)
