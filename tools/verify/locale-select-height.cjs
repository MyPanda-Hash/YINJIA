/**
 * 登录页语言选择器(el-select)弹层高度探针
 *
 * 背景: 用户截图报告语言下拉弹层存在大片空白。
 * 顶栏用的是 el-dropdown(TopBar.vue:48), 登录页用的是 el-select
 * (views/login/index.vue:5-20), 二者共用 popper-class
 * "locale-select-popper locale-glass-popper"。
 * 本探针专门测登录页的 el-select 路径。
 *
 * 判定: 弹层尾部空白 > 24px 或 弹层高 - 选项合计 > 60px => FAIL
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { connect } = require('./lib/mini-ws.cjs');

const PORT = 9389;
const BASE = 'http://localhost:5173';
const OUT_PNG = path.join(__dirname, '_locale-select-height.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ` (${ms}ms)`)), ms)),
  ]);
}

function log(...a) {
  console.log(new Date().toISOString().slice(11, 19), ...a);
}

function findEdge() {
  const cands = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return cands.find((p) => fs.existsSync(p));
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
      const d = r.result.exceptionDetails;
      throw new Error('eval失败: ' + String((d.exception && d.exception.description) || d.text).slice(0, 400));
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  click(x, y) {
    const p = { x, y, button: 'left', clickCount: 1 };
    return this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p })
      .then(() => this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p }));
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  }
  close() { try { this.ws.close(); } catch { /* noop */ } }
}

(async () => {
  let edge;
  let cdp;
  try {
    log('启动 headless Edge, 端口', PORT);
    const exe = findEdge();
    if (!exe) throw new Error('找不到 msedge.exe');
    const profile = path.join(os.tmpdir(), '_mes_lsh_' + Date.now());
    edge = spawn(exe, [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ], { stdio: 'ignore' });

    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
        if (res.ok) target = await res.json();
      } catch { /* 还没起来 */ }
    }
    if (!target) throw new Error('无法连接 headless Edge');
    log('拿到 target:', target.id);

    cdp = await Cdp.open(target.webSocketDebuggerUrl);
    const selfTest = await withTimeout(cdp.eval('1+1'), 10000, 'Runtime.evaluate 自检超时');
    if (selfTest !== 2) throw new Error('CDP 自检返回值异常: ' + JSON.stringify(selfTest));
    log('CDP 自检通过');
    await cdp.send('Page.enable');

    // 登录页是公开路由, 无需 token
    log('导航到 /#/login ...');
    await cdp.send('Page.navigate', { url: `${BASE}/#/login` });
    await sleep(6000);
    log('当前地址:', await cdp.eval('location.href'));

    // 打开语言选择器
    const box = await cdp.eval(`(() => {
      const el = document.querySelector('.locale-select');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!box) throw new Error('找不到 .locale-select');
    log('点击坐标', JSON.stringify(box));
    await cdp.click(box.x, box.y);
    await sleep(400);
    // 兜底: 直接派发 DOM 事件(CDP 合成事件有时不触发 EP 内部状态)
    await cdp.eval(`(() => {
      const el = document.querySelector('.locale-select .el-select__wrapper') || document.querySelector('.locale-select input');
      if (el) ['mousedown','mouseup','click'].forEach((t) =>
        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })));
      return !!el;
    })()`);

    // 等弹层出现
    let popper = null;
    for (let i = 0; i < 20 && !popper; i++) {
      await sleep(250);
      popper = await cdp.eval(`(() => {
        const el = document.querySelector('.locale-select-popper');
        if (!el || el.offsetHeight === 0) return null;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, top: r.top, bottom: r.bottom };
      })()`);
    }
    if (!popper) throw new Error('弹层未出现(.locale-select-popper)');

    await cdp.shot(OUT_PNG);
    log('截图:', OUT_PNG);

    // 递归 dump 弹层 DOM
    const tree = await cdp.eval(`(() => {
      const root = document.querySelector('.locale-select-popper');
      const out = [];
      const walk = (el, d) => {
        if (d > 5) return;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.push({
          d,
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 70),
          box: Math.round(r.width) + 'x' + Math.round(r.height),
          top: Math.round(r.top),
          scrollH: el.scrollHeight, clientH: el.clientHeight, offsetH: el.offsetHeight,
          display: cs.display, position: cs.position,
          height: cs.height, minHeight: cs.minHeight, maxHeight: cs.maxHeight,
          padding: cs.padding, margin: cs.margin, flex: cs.flex, overflow: cs.overflow,
        });
        for (const c of el.children) walk(c, d + 1);
      };
      walk(root, 0);
      return out;
    })()`);

    console.log('\n=== 弹层 DOM 树尺寸 (depth/tag/class -> box) ===');
    for (const n of tree) {
      console.log(`[${n.d}] ${n.tag}.${n.cls} box=${n.box} top=${n.top} scrollH=${n.scrollH} clientH=${n.clientH} offsetH=${n.offsetH} | h=${n.height} minH=${n.minHeight} maxH=${n.maxHeight} pad=${n.padding} mar=${n.margin} flex=${n.flex} overflow=${n.overflow} pos=${n.position}`);
    }

    // 判定
    const metrics = await cdp.eval(`(() => {
      const p = document.querySelector('.locale-select-popper');
      const items = [...p.querySelectorAll('.el-select-dropdown__item')];
      if (!items.length) return { items: 0 };
      const pr = p.getBoundingClientRect();
      const last = items[items.length - 1].getBoundingClientRect();
      const first = items[0].getBoundingClientRect();
      const sum = items.reduce((a, it) => a + it.getBoundingClientRect().height, 0);
      return {
        items: items.length,
        popperH: Math.round(pr.height),
        popperBottom: Math.round(pr.bottom),
        firstTop: Math.round(first.top),
        lastBottom: Math.round(last.bottom),
        itemsSum: Math.round(sum),
        tail: Math.round(pr.bottom - last.bottom),
        head: Math.round(first.top - pr.top),
      };
    })()`);

    console.log('\n=== 判定 ===');
    if (!metrics.items) {
      console.log('FAIL: 弹层里没有任何 .el-select-dropdown__item —— 菜单项未渲染');
      process.exit(1);
    }
    console.log(`弹层高=${metrics.popperH}px, 可见选项=${metrics.items} 个`);
    console.log(`首项上边距=${metrics.head}px, 末项底边=${metrics.lastBottom}, 弹层底边=${metrics.popperBottom}, 尾部空白=${metrics.tail}px`);
    console.log(`选项高度合计≈${metrics.itemsSum}px（弹层高 ${metrics.popperH}px）`);

    const badTail = metrics.tail > 24;
    const badTotal = metrics.popperH - metrics.itemsSum - metrics.head > 60;
    if (badTail || badTotal) {
      console.log(`FAIL: ${badTail ? '尾部空白过大 ' : ''}${badTotal ? '整体高度远超内容' : ''}`);
      process.exit(1);
    }
    console.log('PASS: 弹层高度与内容一致，无异常空白');
    process.exit(0);
  } catch (e) {
    console.error('探针异常:', e && e.message ? e.message : e);
    if (cdp) { try { await cdp.shot(path.join(__dirname, '_locale-select-debug.png')); } catch { /* noop */ } }
    process.exit(2);
  } finally {
    if (cdp) cdp.close();
    if (edge) { try { edge.kill(); } catch { /* noop */ } }
  }
})();
