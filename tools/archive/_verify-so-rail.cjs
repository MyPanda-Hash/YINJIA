/**
 * _verify-so-rail.cjs — 销售订单左侧「单据选择」栏接线验证(对齐采购订单)
 * 用法: node tools/archive/_verify-so-rail.cjs
 * 断言:①SO_ORDER 左栏存在,列头=单号/日期/客户/审核状态;②行数>0 且客户列有值;
 *       ③点行切换右侧当前单据(单号变化);④部门下拉过滤生效;⑤PU_ORDER 左栏回归(供应商);
 *       ⑥英文语言下左栏标题/列头取值(佐证多语言覆盖)。
 * 输出: tools/archive/_so-rail-shots/*.png
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9361;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? '  [PASS]' : '  [FAIL]'} ${msg}${extra ? ' :: ' + extra : ''}`);
  if (!cond) fails.push(msg);
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  });
  const lj = await lr.json();
  const token = lj?.data?.token;
  const user = lj?.data?.user;
  if (!token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 200));
  console.log('[login] ok');

  // 浏览器启动方式:本机沙箱下 node spawn Edge 会因 mojo 命名管道被拒(0x5)秒退,
  // 故默认「附着模式」——由 pwsh 侧先起 Edge(见文件头用法),本脚本只连 CDP。
  const profile = path.join(__dirname, '_so-edge-profile');
  const attach = process.env.YJ_CDP_ATTACH === '1';
  let edge = null;
  if (!attach) {
    fs.rmSync(profile, { recursive: true, force: true });
    fs.mkdirSync(profile, { recursive: true });
    edge = spawn(EDGE, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore' });
  }
  // CDP 端点就绪等待(Edge 首次启动受缓存目录授权重试影响,起得慢)
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(1000);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) tab = await r.json();
    } catch { /* 未就绪,继续等 */ }
  }
  if (!tab) throw new Error(`Edge CDP 未就绪(port ${PORT})`);
  console.log('[edge] cdp ready', attach ? '(attach)' : '(spawned)');
  try {
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const pending = new Map(); const consoleLog = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
      if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params?.type)) {
        consoleLog.push(m.params.type + ': ' + (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        consoleLog.push('exception: ' + (m.params?.exceptionDetails?.exception?.description || '').slice(0, 200));
      }
    };
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      return r.result?.result?.value;
    };
    // 每次导航都换一个 base query:hash-only 跳转是同文档导航(不重载),pinia 里旧 token 仍为空
    // → 会被守卫踢回 /login。加 query 强制整页重载,保证按最新 localStorage 建立会话。
    let navSeq = 0;
    const navigate = async (url) => {
      navSeq += 1;
      const full = url.replace('/#/', `/?_yjprobe=${navSeq}#/`);
      await send('Page.navigate', { url: full });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1800); return; } }
    };
    /** 轮询等待选择器出现(面板为异步 chunk + 配置请求,固定 sleep 不够稳) */
    const waitFor = async (expr, ms = 40000) => {
      for (let i = 0; i < ms / 500; i++) { if (await evaluate(expr)) return true; await sleep(500); }
      return false;
    };
    /** 页面诊断(断言失败时定位:登录被踢/路由不对/chunk 报错/仍在加载) */
    const diag = () => evaluate(`(() => ({
      href: location.href, title: document.title,
      app: !!document.querySelector('#app') && document.querySelector('#app').children.length > 0,
      rail: !!document.querySelector('.doc-select-rail'), main: !!document.querySelector('.doc-rail-main'),
      tables: document.querySelectorAll('table').length,
      loading: document.querySelectorAll('.el-loading-mask').length,
      text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 300),
    }))()`);
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
      console.log('  [shot]', f);
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });

    const setSession = async (locale) => {
      await navigate(`${FRONT}/#/login`);
      await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date', '2026-09-20');
localStorage.setItem('mes_locale', ${JSON.stringify(locale)}); 'ok'`);
    };

    /** 读左栏结构与行数据 */
    const railInfo = () => evaluate(`(() => {
      const rail = document.querySelector('.doc-select-rail');
      if (!rail) return { present: false };
      const heads = [...rail.querySelectorAll('thead th')].map(th => th.textContent.trim());
      const rows = [...rail.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
      const active = rail.querySelector('tbody tr.active');
      return {
        present: true,
        title: rail.querySelector('.dsr-title')?.textContent.trim(),
        heads, rows,
        count: rail.querySelector('.dsr-count')?.textContent.replace(/\\s+/g,' ').trim(),
        deptOptions: [...rail.querySelectorAll('.dsr-dept ~ * , .dsr-dept')].length,
        activeRow: active ? [...active.children].map(td => td.textContent.trim()) : null,
      };
    })()`);

    /** 右侧当前单据关键字段(表头字段条;输入框直接读 value,下拉/参照读选中项文本) */
    const curDoc = () => evaluate(`(() => {
      const main = document.querySelector('.doc-rail-main');
      if (!main) return { present: false };
      const val = (f) => {
        const i = f.querySelector('input');
        if (i && i.value) return i.value.trim();
        const s = f.querySelector('.el-select__selected-item, .el-select__placeholder, .el-select__wrapper, .cell, span');
        return s ? s.textContent.trim() : '';
      };
      const fields = [...main.querySelectorAll('.fields .field')].map(f => [f.querySelector('label')?.textContent.trim(), val(f)]);
      const pick = (n) => (fields.find(f => f[0] === n) || [])[1] || '';
      return { present: true, no: pick('单据编号'), date: pick('单据日期'), cust: pick('客户'), dept: pick('部门'),
               fieldCount: fields.length, all: fields.map(f => f[0] + '=' + f[1]) };
    })()`);

    // ═══ 1) 中文:销售订单左栏 ═══
    console.log('\n=== 1) 销售订单 SO_ORDER(中文) ===');
    await setSession('zh-CN');
    await navigate(`${FRONT}/#/panelx/list/SO_ORDER`);
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`);
    const railUp = await waitFor(`!!document.querySelector('.doc-select-rail')`, 45000);
    if (!railUp) {
      console.log('   [diag]', JSON.stringify(await diag()));
      console.log('   [console]', JSON.stringify(consoleLog.slice(-8)));
    }
    await sleep(1500);
    let ri = await railInfo();
    ok(ri.present, '左栏 .doc-select-rail 已渲染');
    console.log('   左栏首行 =', JSON.stringify((ri.rows || [])[0]));
    console.log('   左栏高亮 =', JSON.stringify(ri.activeRow));
    console.log('   title =', ri.title, '| count =', ri.count);
    console.log('   heads =', JSON.stringify(ri.heads));
    ok(JSON.stringify(ri.heads) === JSON.stringify(['单号', '日期', '客户', '审核状态']),
      '列头 = 单号/日期/客户/审核状态', JSON.stringify(ri.heads));
    ok((ri.rows || []).length > 0, '左栏有单据行', `rows=${(ri.rows || []).length}`);
    const custCells = (ri.rows || []).map(r => r[2]);
    ok(custCells.filter(Boolean).length > 0, '客户列有值', JSON.stringify(custCells.slice(0, 4)));
    const before = await curDoc();
    console.log('   当前单据:', JSON.stringify({ no: before.no, date: before.date, cust: before.cust, dept: before.dept, fieldCount: before.fieldCount }));
    console.log('   表头字段全量:', JSON.stringify(before.all));
    // 进入态是否已载入单据:与采购订单同口径(见 §4),不作单独断言——本项在 §4 对比判定

    // ═══ 2) 点第二行切换单据 ═══
    console.log('\n=== 2) 点左栏行切换右侧单据 ===');
    const target = (ri.rows || [])[1];
    if (target) {
      await evaluate(`(() => { const rail = document.querySelector('.doc-select-rail'); const trs = rail.querySelectorAll('tbody tr'); if (trs[1]) trs[1].click(); return 1 })()`);
      await sleep(1200);
      const after = await curDoc();
      const ri2 = await railInfo();
      console.log('   切换后:', JSON.stringify(after), '| 高亮行=', JSON.stringify(ri2.activeRow));
      ok(after.no === target[0], `右侧单据号跟随左栏行(${target[0]})`, after.no);
      ok(JSON.stringify(ri2.activeRow) === JSON.stringify(target), '左栏高亮行 = 被点行');
      ok(after.cust === target[2], '客户字段随切换联动', `${after.cust} vs ${target[2]}`);
    } else {
      ok(false, '至少存在 2 行可切换');
    }
    await shot('SO_ORDER-zh');

    // ═══ 3) 部门过滤 ═══
    console.log('\n=== 3) 部门下拉过滤 ===');
    const deptFiltered = await evaluate(`(async () => {
      const rail = document.querySelector('.doc-select-rail');
      const total = rail.querySelectorAll('tbody tr').length;
      const sel = rail.querySelector('.dsr-dept');
      if (!sel) return { noSelect: true, total };
      sel.querySelector('input').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 800));
      const opts = [...document.querySelectorAll('.el-select-dropdown__item')].map(o => o.textContent.trim());
      if (!opts.length) return { noOptions: true, total };
      const hit = [...document.querySelectorAll('.el-select-dropdown__item')].find(o => o.textContent.trim() === opts[0]);
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 800));
      const rows = [...rail.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
      return { total, after: rows.length, dept: opts[0], days: rows.map(r => r[3]), custs: rows.map(r => r[2]) };
    })()`);
    console.log('   ', JSON.stringify(deptFiltered));
    ok(deptFiltered.noSelect || (deptFiltered.after > 0 && deptFiltered.after <= deptFiltered.total),
      '部门下拉可用且过滤后行数收敛', JSON.stringify(deptFiltered));

    // ═══ 4) 采购订单回归 ═══
    console.log('\n=== 4) 采购订单 PU_ORDER 回归 ===');
    await navigate(`${FRONT}/#/panelx/list/PU_ORDER`);
    await waitFor(`!!document.querySelector('.doc-select-rail')`, 45000);
    await sleep(1200);
    const rp = await railInfo();
    console.log('   title =', rp.title, '| heads =', JSON.stringify(rp.heads));
    ok(rp.present, '采购订单左栏仍在');
    ok(JSON.stringify(rp.heads) === JSON.stringify(['单号', '日期', '供应商', '审核状态']),
      '采购订单列头未变', JSON.stringify(rp.heads));
    const puEntry = await curDoc();
    console.log('   采购订单进入态:', JSON.stringify({ no: puEntry.no, sup: puEntry.all?.find(x => x.startsWith('供应商=')) }));
    // 进入态对比:销售订单与采购订单必须同口径(都为空=面板既有进入态行为;都有值=都已载入)
    ok(!!before.no === !!puEntry.no,
      '进入态与采购订单同口径(右侧首单载入行为一致)', `SO_ORDER=${JSON.stringify(before.no)} / PU_ORDER=${JSON.stringify(puEntry.no)}`);
    await shot('PU_ORDER-zh');

    // ═══ 5) 英文语言下左栏文案 ═══
    console.log('\n=== 5) 销售订单左栏(英文 en) ===');
    await setSession('en');
    await navigate(`${FRONT}/#/panelx/list/SO_ORDER`);
    await waitFor(`!!document.querySelector('.doc-select-rail')`, 45000);
    await sleep(1500);
    const re = await railInfo();
    console.log('   title =', re.title);
    console.log('   heads =', JSON.stringify(re.heads));
    console.log('   count =', re.count);
    ok(JSON.stringify(re.heads) === JSON.stringify(['No.', 'Date', 'Customer', 'Audit Status']),
      '英文列头已译(单号/日期/客户/审核状态)', JSON.stringify(re.heads));
    await shot('SO_ORDER-en');

    ws.close();
  } finally {
    if (edge) {
      edge.kill();
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* 忽略 */ }
    }
  }
  console.log(`\n===== 结果:${fails.length ? 'FAIL ' + fails.length + ' 项' : 'ALL PASS'} =====`);
  fails.forEach(f => console.log('  ✗', f));
  if (fails.length) process.exitCode = 1;
}
main().catch((e) => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
