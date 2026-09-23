/**
 * _cdpclient.cjs — 极简 CDP 客户端(自带 WebSocket 帧编解码)
 *
 * 为什么自己写:本机 Node 是 v20(**没有**全局 WebSocket),仓库里也没装 `ws`,
 * 而 Edge 支持 `--headless=new --remote-debugging-port`;CDP 走的是 WebSocket,
 * 所以要么装依赖、要么自己实现。这里选后者:只需要文本帧 + ping/pong + 分片拼接。
 *
 * 用法(供其它探针 require):
 *   const { launch, sleep } = require('./_cdpclient.cjs')
 *   const s = await launch({ port: 9388 })   // 返回 { evaluate, navigate, close, logs }
 */
'use strict'
const net = require('node:net')
const http = require('node:http')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

/** 最小 WebSocket 客户端(文本帧) */
class MiniWS {
  constructor(socket) {
    this.sock = socket
    this.buf = Buffer.alloc(0)
    this.frag = []
    this.handlers = { message: [], close: [] }
  }

  static connect(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const u = new URL(url)
      const key = crypto.randomBytes(16).toString('base64')
      const sock = net.connect(Number(u.port), u.hostname, () => {
        sock.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
          `Host: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
        )
      })
      sock.setNoDelay(true)
      let handshakeDone = false
      let acc = Buffer.alloc(0)
      const to = setTimeout(() => { if (!handshakeDone) { sock.destroy(); reject(new Error('WS 握手超时')) } }, timeoutMs)

      const ws = new MiniWS(sock)
      sock.on('data', (chunk) => {
        acc = Buffer.concat([acc, chunk])
        if (!handshakeDone) {
          const idx = acc.indexOf('\r\n\r\n')
          if (idx < 0) return
          const head = acc.slice(0, idx).toString()
          if (!/101/.test(head)) { clearTimeout(to); sock.destroy(); return reject(new Error('WS 握手失败: ' + head.split('\r\n')[0])) }
          handshakeDone = true
          clearTimeout(to)
          acc = acc.slice(idx + 4)
          resolve(ws)
        }
        ws._feed(acc)
        acc = Buffer.alloc(0)
      })
      sock.on('error', (e) => { if (!handshakeDone) { clearTimeout(to); reject(e) } })
      sock.on('close', () => ws.handlers.close.forEach((h) => h()))
    })
  }

  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this }

  _feed(buf) {
    this.buf = Buffer.concat([this.buf, buf])
    for (;;) {
      if (this.buf.length < 2) return
      const b0 = this.buf[0]
      const fin = (b0 & 0x80) !== 0
      const op = b0 & 0x0f
      const b1 = this.buf[1]
      const masked = (b1 & 0x80) !== 0
      let len = b1 & 0x7f
      let off = 2
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4 }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10 }
      let mask = null
      if (masked) { if (this.buf.length < off + 4) return; mask = this.buf.slice(off, off + 4); off += 4 }
      if (this.buf.length < off + len) return
      let payload = this.buf.slice(off, off + len)
      if (mask) { const p = Buffer.from(payload); for (let i = 0; i < p.length; i++) p[i] ^= mask[i % 4]; payload = p }
      this.buf = this.buf.slice(off + len)

      if (op === 0x8) { this.close(); return }
      if (op === 0x9) { this._send(payload, 0xa); continue }
      if (op === 0xa) continue
      if (op === 0x0) { this.frag.push(payload); if (fin) { this._emit(Buffer.concat(this.frag)); this.frag = [] } ; continue }
      this.frag = [payload]
      if (fin) { this._emit(payload); this.frag = [] }
    }
  }

  _emit(payload) {
    const txt = payload.toString('utf8')
    this.handlers.message.forEach((h) => h(txt))
  }

  _send(data, op = 0x1) {
    const mask = crypto.randomBytes(4)
    const len = data.length
    let header
    if (len < 126) header = Buffer.from([0x80 | op, 0x80 | len])
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2) }
    else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2) }
    const body = Buffer.from(data)
    for (let i = 0; i < body.length; i++) body[i] ^= mask[i % 4]
    this.sock.write(Buffer.concat([header, mask, body]))
  }

  sendText(s) { this._send(Buffer.from(s, 'utf8'), 0x1) }
  close() { try { this._send(Buffer.alloc(0), 0x8) } catch { /* ignore */ } try { this.sock.destroy() } catch { /* ignore */ } }
}

const httpJson = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let d = ''
    res.on('data', (c) => { d += c })
    res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
  }).on('error', reject)
})

/** 启动 headless Edge 并连上 CDP;返回可用的会话对象 */
async function launch(opts = {}) {
  const port = opts.port || 9388
  if (!fs.existsSync(EDGE)) throw new Error('找不到 Edge: ' + EDGE)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cdp-'))
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--no-sandbox', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })

  // 等 CDP 端口就绪
  let ver = null
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    try { ver = await httpJson(`http://127.0.0.1:${port}/json/version`); break } catch { /* retry */ }
  }
  if (!ver) { try { proc.kill() } catch { /* ignore */ } throw new Error('CDP 端口未就绪') }

  const tab = await httpJson(`http://127.0.0.1:${port}/json/new?about:blank`).catch(async () => {
    // 旧版要求 PUT
    return await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/json/new?about:blank', method: 'PUT' }, (res) => {
        let d = ''; res.on('data', (c) => { d += c }); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
      })
      req.on('error', reject); req.end()
    })
  })

  const ws = await MiniWS.connect(tab.webSocketDebuggerUrl)
  let seq = 0
  const pending = new Map()
  const logs = []

  ws.on('message', (txt) => {
    let m
    try { m = JSON.parse(txt) } catch { return }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text))
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      logs.push('console.error: ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      logs.push('log.error: ' + m.params.entry.text)
    }
  })

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    ws.sendText(JSON.stringify({ id, method, params }))
  })

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text }
    return r.result && r.result.result ? r.result.result.value : undefined
  }

  const navigate = async (url, waitMs = 2500) => { await send('Page.navigate', { url }); await sleep(waitMs) }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')

  return {
    evaluate, navigate, send, logs,
    close: () => { ws.close(); try { proc.kill() } catch { /* ignore */ } },
  }
}

module.exports = { launch, sleep, MiniWS, EDGE }
