/**
 * _cdp.mjs — 探针共用的最小 CDP 客户端(2026-09-21)
 *
 * 为什么不用 node 内置 WebSocket:本机(node v24 / undici)连 Edge 的**页面级** ws 端点
 * (`/json/new` 返回的 webSocketDebuggerUrl)会在发出第一条命令后立刻被服务端 reset
 * (`read ECONNRESET`),.NET ClientWebSocket 同样如此;而**浏览器级**端点
 * (`/json/version` 的 webSocketDebuggerUrl)完全正常(`Browser.getVersion`/`Target.getTargets` 有回应)。
 * 因此这里走浏览器级端点 + `Target.attachToTarget {flatten:true}` 的会话方式驱动页面,
 * 并用自实现的 WebSocket 客户端(不依赖内置实现/第三方包,见 AGENTS.md 工具依赖约定)。
 *
 * 用法:
 *   import { attachCdp } from './_cdp.mjs';
 *   const cdp = await attachCdp(9477, tabId);   // tabId 可省略(自动取第一个 page 目标)
 *   await cdp.send('Page.enable');
 *   const v = await cdp.ev('1+1');
 *   cdp.close();
 */
import net from 'node:net';
import crypto from 'node:crypto';

/** 最小 WebSocket 客户端:握手 + 掩码帧 + 分片重组(ping→pong),只实现 CDP 需要的部分 */
function rawConnect(url) {
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(Number(u.port), u.hostname);
  let buf = Buffer.alloc(0);
  let handshaken = false;
  let closed = false;
  let seq = 0;
  const waiters = new Map();
  let frag = [];                       // 分片累积
  const onMessage = (text) => {
    let m;
    try { m = JSON.parse(text); } catch { return; }
    if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
  };
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    if (!handshaken) {
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) return;
      const line = buf.subarray(0, idx).toString('latin1').split('\r\n')[0];
      handshaken = / 101 /.test(line);
      buf = buf.subarray(idx + 4);
      if (!handshaken) { console.error('[cdp] 握手失败:' + line); sock.destroy(); return; }
    }
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const op = buf[0] & 0x0f;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const payload = buf.subarray(off, off + len);
      buf = buf.subarray(off + len);
      if (op === 9) { sendFrame(sock, 10, payload); continue; }        // ping → pong
      if (op === 8) { closed = true; sock.destroy(); continue; }        // close
      if (op === 1 || op === 0 || op === 2) {
        frag.push(payload);
        if (fin) { const all = Buffer.concat(frag); frag = []; if (op !== 2) onMessage(all.toString('utf8')); }
      }
    }
  });
  sock.on('error', (e) => { closed = true; console.error('[cdp] socket:' + e.message); });
  const ready = new Promise((res) => {
    sock.on('connect', () => {
      sock.write(`GET ${u.pathname} HTTP/1.1\r\nHost: ${u.hostname}:${u.port}\r\nUpgrade: websocket\r\n`
        + `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      const t = setInterval(() => { if (handshaken || closed) { clearInterval(t); res(handshaken); } }, 20);
      setTimeout(() => { clearInterval(t); res(handshaken); }, 10000);
    });
    sock.on('error', () => res(false));
  });
  /** 发一条 CDP 命令;sessionId 非空时走扁平会话 */
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    if (closed) return res('CLOSED');
    const id = ++seq;
    waiters.set(id, res);
    sendFrame(sock, 1, Buffer.from(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }), 'utf8'));
    setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); res('TIMEOUT'); } }, 20000);
  });
  return { ready, send, close: () => { try { sock.destroy(); } catch { /* ignore */ } } };
}

function sendFrame(sock, op, payload) {
  const mask = crypto.randomBytes(4);
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = 0x80 | len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | op;
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  sock.write(Buffer.concat([head, mask, masked]));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 连上 Edge 调试端口并挂到一个页面目标(浏览器级端点 + flatten 会话)。
 * @param {number} port       --remote-debugging-port
 * @param {string} [targetId] 指定页面目标(/json/new 返回的 id);省略则取第一个 page 目标
 */
export async function attachCdp(port, targetId) {
  let ver = null;
  for (let i = 0; i < 30 && !ver; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) ver = await r.json(); } catch { await sleep(500); }
  }
  if (!ver) throw new Error('CDP 浏览器端点未就绪(端口 ' + port + ')');
  const ws = rawConnect(ver.webSocketDebuggerUrl);
  if (!await ws.ready) throw new Error('CDP WebSocket 握手失败');
  let tid = targetId;
  if (!tid) {
    const t = await ws.send('Target.getTargets');
    tid = (t?.result?.targetInfos || []).find((x) => x.type === 'page')?.targetId;
  }
  if (!tid) throw new Error('CDP 无可用 page 目标');
  const att = await ws.send('Target.attachToTarget', { targetId: tid, flatten: true });
  const sid = att?.result?.sessionId;
  if (!sid) throw new Error('Target.attachToTarget 失败:' + JSON.stringify(att).slice(0, 200));
  const send = (method, params = {}) => ws.send(method, params, sid);
  /** 求值(与旧探针的 ev() 同形:returnByValue + awaitPromise,取 value) */
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.result?.value;
  return { send, ev, targetId: tid, sessionId: sid, close: () => ws.close() };
}
