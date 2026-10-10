/**
 * 极简 CDP WebSocket 客户端 —— 零依赖(Node 20 无全局 WebSocket,仓库无 ws 依赖)。
 * 只实现 CDP 用得到的最小面:客户端发文本帧(带掩码),收服务端文本帧(可能分片)。
 *
 * 用法(注意 await):
 *   const ws = await connect(wsUrl)   // 返回时握手已完成, 可立即 send
 *   ws.on('message', fn); ws.send(str); ws.close()
 *
 * 2026-10-10 修复: 原实现 connect() 同步返回, Cdp.send() 会在 HTTP 升级握手
 * 完成之前就把 WebSocket 帧写进 socket, 导致 Edge 返回 500 / 静默无响应。
 * 现在返回 Promise, 仅当收到 "101 Switching Protocols" 才 resolve。
 */
const net = require('net')
const crypto = require('crypto')
const { URL } = require('url')

const DEBUG = process.env.WS_DEBUG === '1'
const dbg = (...a) => { if (DEBUG) console.log('[ws]', ...a) }

function connect(wsUrl) {
  const u = new URL(wsUrl)
  const key = crypto.randomBytes(16).toString('base64')
  const sock = net.connect(Number(u.port), u.hostname)
  const handlers = { message: [], open: [], error: [], close: [] }
  let buf = Buffer.alloc(0)
  let handshaken = false
  let frags = []

  const api = {
    on(ev, fn) { handlers[ev].push(fn); return api },
    send(str) {
      const payload = Buffer.from(str, 'utf8')
      const len = payload.length
      let header
      const mask = crypto.randomBytes(4)
      if (len < 126) {
        header = Buffer.alloc(6); header[1] = 0x80 | len
      } else if (len < 65536) {
        header = Buffer.alloc(8); header[1] = 0x80 | 126; header.writeUInt16BE(len, 2)
      } else {
        header = Buffer.alloc(14); header[1] = 0x80 | 127
        header.writeUInt32BE(Math.floor(len / 2 ** 32), 2); header.writeUInt32BE(len >>> 0, 6)
      }
      header[0] = 0x81
      mask.copy(header, header.length - 4)
      const masked = Buffer.alloc(len)
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3]
      sock.write(Buffer.concat([header, masked]))
    },
    close() { try { sock.destroy() } catch (e) {} },
  }

  const emit = (ev, arg) => handlers[ev].forEach((f) => f(arg))

  sock.on('error', (e) => { dbg('socket error', e.message); emit('error', e) })
  sock.on('close', () => { dbg('socket closed'); emit('close') })
  sock.on('data', (chunk) => {
    dbg('rx bytes', chunk.length)
    buf = Buffer.concat([buf, chunk])
    if (!handshaken) {
      const idx = buf.indexOf('\r\n\r\n')
      if (idx < 0) return
      const head = buf.slice(0, idx).toString('latin1')
      buf = buf.slice(idx + 4)
      dbg('握手响应首行:', head.split('\r\n')[0])
      if (!/101/.test(head.split('\r\n')[0])) return emit('error', new Error('WS 握手失败: ' + head.split('\r\n')[0]))
      handshaken = true
      emit('open')
    }
    // 解析帧
    for (;;) {
      if (buf.length < 2) return
      const fin = (buf[0] & 0x80) !== 0
      const opcode = buf[0] & 0x0f
      let len = buf[1] & 0x7f
      let off = 2
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      if (buf.length < off + len) return
      const payload = buf.slice(off, off + len)
      buf = buf.slice(off + len)
      dbg('recv opcode=0x' + opcode.toString(16), 'len=' + len, payload.toString('utf8').slice(0, 120))
      if (opcode === 0x8) { api.close(); return emit('close') }
      if (opcode === 0x9) continue // ping:CDP 场景不需要回 pong
      if (opcode === 0xa) continue // pong
      if (opcode === 0x0) { frags.push(payload) } else { frags = [payload] }
      if (fin) { emit('message', Buffer.concat(frags).toString('utf8')); frags = [] }
    }
  })

  const req = [
    `GET ${u.pathname}${u.search} HTTP/1.1`,
    `Host: ${u.hostname}:${u.port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '', '',
  ].join('\r\n')

  // 握手完成(或失败)才 resolve / reject —— 见文件头注释
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { sock.destroy() } catch (e) {}
      reject(new Error('WS 握手超时(10s): ' + wsUrl))
    }, 10000)
    api.on('open', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      dbg('握手完成')
      resolve(api)
    })
    api.on('error', (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(e)
    })
    sock.on('connect', () => {
      dbg('TCP 连接建立, 发送握手')
      sock.write(req)
    })
  })
}

module.exports = { connect }
