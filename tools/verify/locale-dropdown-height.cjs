/**
 * 语言下拉弹层「高度异常 / 空白」探测器
 *
 * 用法: node tools/verify/locale-dropdown-height.cjs
 * 依赖: tools/verify/lib/mini-ws.cjs (零依赖 CDP 客户端)
 *
 * 背景: 用户截图 (m01194) 显示语言下拉在「简体中文」下方留大片空白。
 * 本探针不猜样式，直接把弹层 DOM 树的 box 尺寸打出来，定位撑高节点。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { connect } = require('./lib/mini-ws.cjs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9388;
const PROFILE = path.join(process.env.TEMP, `_mes_ldh_${Date.now()}`);
const BASE = 'http://localhost:5173';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 给任意 promise 套超时, 避免探针静默挂死(挂死比报错更难查) */
function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ` (${ms}ms)`)), ms)),
  ]);
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.evts = []; }
  static async open(wsUrl) {
    const ws = await connect(wsUrl);
    const c = new Cdp(ws);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const k = String(m.id);
      if (k !== 'undefined' && c.waiting.has(k)) { c.waiting.get(k)(m); c.waiting.delete(k); }
      else c.evts.push(m);
    });
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve) => { this.waiting.set(String(id), resolve); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      throw new Error('eval失败: ' + JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails).slice(0, 400));
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const fails = [];
  log('启动 headless Edge, 端口', PORT);
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  let cdp = null;
  try {
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
        if (res.ok) target = await res.json();
      } catch { /* 还没起来 */ }
    }
    if (!target) throw new Error('无法连接 headless Edge');
    log('拿到 target:', target.id, 'WS:', target.webSocketDebuggerUrl.slice(0, 80));

    cdp = await Cdp.open(target.webSocketDebuggerUrl);
    log('WS 已建立, 阻塞式自检 Runtime.evaluate ...');
    const selfTest = await withTimeout(cdp.eval('1+1'), 10000, 'Runtime.evaluate 自检超时');
    if (selfTest !== 2) throw new Error('CDP 自检返回值异常: ' + JSON.stringify(selfTest));
    log('CDP 自检通过');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    log('Runtime/Page enabled');

    // 1. 登录拿 token（字段是 userName，大写 N）
    log('登录 /api/auth/login ...');
    const loginRes = await fetch('http://127.0.0.1:8090/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456' }),
      signal: AbortSignal.timeout(15000),
    });
    const login = await loginRes.json();
    if (login.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login));
    const token = login.data.token;
    log('登录成功, token 长度', String(token).length);

    // 2. 真实 origin 下写 localStorage
    log('导航到 /#/login ...');
    await cdp.send('Page.navigate', { url: `${BASE}/#/login` });
    await sleep(4000);
    log('注入 localStorage ...');
    await cdp.eval(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))}); 'ok'`);
    log('导航到 /#/dashboard ...');
    await cdp.send('Page.navigate', { url: `${BASE}/#/dashboard` });
    await sleep(3000);
    log('reload ...');
    await cdp.send('Page.reload', {});
    await sleep(8000);
    const href = await cdp.eval('location.href');
    log('当前地址:', href);
    if (!String(href).includes('/dashboard')) throw new Error('未进入 dashboard, 停在 ' + href);

    // 3. 打开语言下拉（CDP 真鼠标 + DOM 兜底双保险）
    log('查找 .locale-switch ...');
    const rect = await cdp.eval(`(function(){ var el = document.querySelector('.locale-switch'); if(!el) return null; var r = el.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
    if (!rect) throw new Error('找不到 .locale-switch');
    log('点击坐标', JSON.stringify(rect));
    for (const [t, b] of [['mousePressed', 1], ['mouseReleased', 1]]) {
      await cdp.send('Input.dispatchMouseEvent', { type: t, x: rect.x, y: rect.y, button: 'left', buttons: b, clickCount: 1 });
      await sleep(80);
    }
    await cdp.eval(`(function(){ var el = document.querySelector('.locale-switch'); if(el){ ['mousedown','mouseup','click'].forEach(function(t){ el.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window})); }); } return 'ok'; })()`);

    let popper = null;
    for (let i = 0; i < 25 && !popper; i++) {
      await sleep(200);
      popper = await cdp.eval(`(function(){ var p = document.querySelector('.locale-glass-popper'); if(!p) return null; var r = p.getBoundingClientRect(); if (r.width < 5 || r.height < 5) return null; return {visible:true}; })()`);
    }
    if (!popper) throw new Error('弹层未出现');

    // 4. 打印弹层 DOM 树尺寸 —— 定位撑高节点
    const dump = await cdp.eval(`(function(){
      var out = [];
      var p = document.querySelector('.locale-glass-popper');
      function desc(el, depth){
        if (!el || el.nodeType !== 1) return;
        var r = el.getBoundingClientRect();
        var cs = getComputedStyle(el);
        out.push({
          depth: depth,
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 70),
          w: Math.round(r.width), h: Math.round(r.height),
          top: Math.round(r.top),
          scrollH: el.scrollHeight, clientH: el.clientHeight, offsetH: el.offsetHeight,
          disp: cs.display, pos: cs.position,
          h_: cs.height, minH: cs.minHeight, maxH: cs.maxHeight,
          pad: cs.padding, mar: cs.margin, flex: cs.flex,
          overflow: cs.overflow
        });
        if (depth >= 5) return;
        for (var i = 0; i < el.children.length; i++) desc(el.children[i], depth + 1);
      }
      desc(p, 0);
      return JSON.stringify(out);
    })()`);

    const nodes = JSON.parse(dump);
    console.log('=== 弹层 DOM 树尺寸 (depth/tag/class -> box) ===');
    for (const n of nodes) {
      console.log(`${'  '.repeat(n.depth)}[${n.depth}] ${n.tag}.${n.cls} box=${n.w}x${n.h} top=${n.top} scrollH=${n.scrollH} clientH=${n.clientH} offsetH=${n.offsetH} | h=${n.h_} minH=${n.minH} maxH=${n.maxH} pad=${n.pad} mar=${n.mar} flex=${n.flex} overflow=${n.overflow} pos=${n.pos}`);
    }

    const root = nodes[0];
    console.log('\n=== 判定 ===');
    const popperH = root.h;
    const items = nodes.filter((n) => n.cls.includes('el-dropdown-menu__item'));
    console.log(`弹层高=${popperH}px, 可见菜单项=${items.length} 个`);
    if (items.length === 0) fails.push('未渲染出任何 el-dropdown-menu__item');
    else {
      const last = items[items.length - 1];
      const contentBottom = last.top + last.h;
      const tailGap = (root.top + root.h) - contentBottom;
      console.log(`末项底边=${contentBottom}, 弹层底边=${root.top + root.h}, 尾部空白=${tailGap}px`);
      if (tailGap > 24) fails.push(`弹层尾部空白 ${tailGap}px 过大 (>24px)`);
      const totalItemH = items.reduce((s, n) => s + n.h + (n.mar ? parseFloat(n.mar) || 0 : 0), 0);
      console.log(`菜单项高度合计≈${Math.round(totalItemH)}px（弹层高 ${popperH}px）`);
      if (popperH - totalItemH > 60) fails.push(`弹层高 ${popperH} 远超内容合计 ${Math.round(totalItemH)}`);
    }

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const png = path.join(__dirname, '_locale-dropdown-height.png');
    fs.writeFileSync(png, Buffer.from(shot.result.data, 'base64'));
    console.log(`\n截图: ${png}`);

    if (fails.length) { console.log('\nFAIL:'); fails.forEach((f) => console.log(' - ' + f)); }
    else console.log('\nPASS: 弹层高度与内容一致，无异常空白');
    return fails.length ? 1 : 0;
  } finally {
    try { if (cdp) cdp.ws.close(); } catch {}
    try { child.kill(); } catch {}
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error('探针异常:', e.message); process.exit(2); });
