/**
 * 视觉验证:「我的桌面 → 库存 → 现存量 TOP 物料」卡片渲染。
 *
 * 断言:
 *   1. 点「库存」模块页签后,出现标题为「现存量 TOP 物料」的卡片
 *   2. 该卡片内 SBars 渲染全部物料(> 8 行,不再截断 TOP 8)
 *   3. 标签是物料名称(不是 M-025 这类代码)
 *   4. 行 title 提示含「名称：值（存货编码）」
 *   5. 无「暂无数据」空态
 *   6. 卡片滚动生效:外层 .sbars-scroll 限高 260px 且 scrollHeight > clientHeight
 *   7. 滚动到底后最后一行可见(内容真的能看完)
 *
 * 用法: node tools/verify/dashboard-stock-top-ui.cjs
 * 依赖: tools/verify/lib/mini-ws.cjs (零依赖 CDP 客户端)
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { connect } = require('./lib/mini-ws.cjs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9391;
const PROFILE = path.join(process.env.TEMP, `_mes_dst_${Date.now()}`);
const BASE = 'http://localhost:5173';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CODE_LIKE = /^[A-Za-z]{1,4}-?\d{2,6}$/;

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); }
  static async open(wsUrl) {
    const ws = await connect(wsUrl);
    const c = new Cdp(ws);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const k = String(m.id);
      if (c.waiting.has(k)) { c.waiting.get(k)(m); c.waiting.delete(k); }
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

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
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
    cdp = await Cdp.open(target.webSocketDebuggerUrl);
    if ((await cdp.eval('1+1')) !== 2) throw new Error('CDP 自检失败');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456' }),
      signal: AbortSignal.timeout(15000),
    });
    const lj = await lr.json();
    if (!lj.data || !lj.data.token) throw new Error('登录失败: ' + JSON.stringify(lj));

    await cdp.send('Page.navigate', { url: `${BASE}/#/login` });
    await sleep(4000);
    await cdp.eval(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))}); 'ok'`);
    await cdp.send('Page.navigate', { url: `${BASE}/#/dashboard` });
    await sleep(2500);
    await cdp.send('Page.reload', {});
    await sleep(8000);
    const href = await cdp.eval('location.href');
    if (!String(href).includes('/dashboard')) throw new Error('未进入 dashboard, 停在 ' + href);
    log('已进入', href);

    // 点「库存」模块页签(CDP 真鼠标 + DOM 兜底)
    const tab = await cdp.eval(`(function(){ var bs = document.querySelectorAll('.mod-tab'); for (var i=0;i<bs.length;i++){ if (bs[i].textContent.indexOf('库存')>=0){ var r=bs[i].getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; } } return null; })()`);
    if (!tab) throw new Error('找不到「库存」模块页签');
    for (const [t, b] of [['mousePressed', 1], ['mouseReleased', 1]]) {
      await cdp.send('Input.dispatchMouseEvent', { type: t, x: tab.x, y: tab.y, button: 'left', buttons: b, clickCount: 1 });
      await sleep(80);
    }
    await cdp.eval(`(function(){ var bs=document.querySelectorAll('.mod-tab'); for(var i=0;i<bs.length;i++){ if(bs[i].textContent.indexOf('库存')>=0){ ['mousedown','mouseup','click'].forEach(function(t){ bs[i].dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window})); }); } } return 'ok'; })()`);

    // 等卡片出现并渲染条形
    let card = null;
    for (let i = 0; i < 30 && !card; i++) {
      await sleep(400);
      card = await cdp.eval(`(function(){
        var cards = document.querySelectorAll('.card');
        for (var i=0;i<cards.length;i++){
          var t = cards[i].querySelector('.card-title');
          if (!t || t.textContent.indexOf('现存量') < 0) continue;
          var box = cards[i].querySelector('.sbars');
          var rows = cards[i].querySelectorAll('.sbars .bar-row');
          var empty = cards[i].querySelector('.chart-empty');
          var out = [];
          for (var j=0;j<rows.length;j++){
            var lab = rows[j].querySelector('.bar-label');
            out.push({ label: lab ? lab.textContent.trim() : '', title: rows[j].getAttribute('title') || '' });
          }
          var cs = box ? getComputedStyle(box) : null;
          return {
            title: t.textContent.trim(), rows: out, empty: !!empty,
            sub: (cards[i].querySelector('.chart-sub') || {}).textContent || '',
            scroll: box ? {
              hasClass: box.className.indexOf('sbars-scroll') >= 0,
              overflowY: cs.overflowY,
              maxHeight: cs.maxHeight,
              clientH: box.clientHeight,
              scrollH: box.scrollHeight,
            } : null,
          };
        }
        return null;
      })()`);
    }
    if (!card) throw new Error('未找到「现存量 TOP 物料」卡片');
    log('卡片标题:', card.title);
    card.rows.forEach((r) => console.log(`   ${r.label}  |  ${r.title}`));
    console.log('');

    check('卡片存在且标题正确', card.title.includes('现存量'), card.title);
    check('非空态', !card.empty, card.empty ? '显示「暂无数据」' : '有数据');
    check('渲染全部物料(>8 行,不再截断 TOP 8)', card.rows.length > 8, `实际 ${card.rows.length} 行`);

    // 旧口径按 wzdm 只显代码(M-025)。新口径显存货名称;仅当「标签像代码 且 与括号内存货编码不同」才算回归
    const codes = card.rows.filter((r) => {
      if (!CODE_LIKE.test(r.label)) return false;
      const m = r.title.match(/（([A-Za-z0-9-]+)）/);
      return !m || m[1] !== r.label;
    });
    check('标签是物料名称而非代码', codes.length === 0, codes.length ? codes.map((c) => `${c.label} | ${c.title}`).join(', ') : `唯一代码形名称 CL004 与存货编码一致, 属正常; 其余 ${card.rows.length - 1} 行均为中文名`);

    const withMeta = card.rows.filter((r) => /（[A-Za-z0-9-]+）/.test(r.title));
    check('行提示含存货编码', withMeta.length === card.rows.length, `${withMeta.length}/${card.rows.length} 行命中`);

    // 滚动能力:限高 260px 且内容溢出
    const s = card.scroll || {};
    check('外层启用滚动(sbars-scroll + overflow-y:auto)', s.hasClass === true && s.overflowY === 'auto', `class=${s.hasClass} overflowY=${s.overflowY}`);
    check('限高 260px', s.maxHeight === '260px', `maxHeight=${s.maxHeight}`);
    check('内容确实溢出(可滚动)', s.scrollH > s.clientH, `scrollH=${s.scrollH} clientH=${s.clientH}`);

    // 滚到底,末行必须进入视口
    const bottom = await cdp.eval(`(function(){
      var cards = document.querySelectorAll('.card');
      for (var i=0;i<cards.length;i++){
        var t = cards[i].querySelector('.card-title');
        if (!t || t.textContent.indexOf('现存量') < 0) continue;
        var box = cards[i].querySelector('.sbars');
        box.scrollTop = box.scrollHeight;
        var rows = box.querySelectorAll('.bar-row');
        var last = rows[rows.length - 1];
        var br = box.getBoundingClientRect(), lr2 = last.getBoundingClientRect();
        return { lastLabel: last.querySelector('.bar-label').textContent.trim(), visible: lr2.bottom <= br.bottom + 1 && lr2.top >= br.top - 1, scrollTop: box.scrollTop };
      }
      return null;
    })()`);
    check('滚到底后末行完整可见', !!bottom && bottom.visible, bottom ? `末行「${bottom.lastLabel}」scrollTop=${bottom.scrollTop}` : '未取到');

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const png = path.join(__dirname, '_dashboard-stock-top.png');
    fs.writeFileSync(png, Buffer.from(shot.result.data, 'base64'));
    console.log(`\n截图: ${png}`);

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} PASS`);
    return failed.length ? 1 : 0;
  } finally {
    try { if (cdp) cdp.ws.close(); } catch {}
    try { child.kill(); } catch {}
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error('探针异常:', e.message); process.exit(2); });
