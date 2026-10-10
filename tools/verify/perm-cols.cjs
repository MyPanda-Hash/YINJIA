/**
 * 权限矩阵列布局实测:面板名不得竖排、列头不得换行、横向溢出须在 wrap 内滚动。
 * 用法: node tools/verify/perm-cols.cjs [--w=1440]
 * 产出: tools/verify/_perm-cols-<w>.png
 */
const CDP_PORT = Number((process.argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 9391)
const WIDTH = Number((process.argv.find((a) => a.startsWith('--w=')) || '').split('=')[1] || 1440)
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const { connect } = require('./lib/mini-ws.cjs')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('[probe]', ...a)

function httpJson(p, method) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: CDP_PORT, path: p, method: method || 'GET' }, (x) => {
      let d = ''
      x.on('data', (c) => (d += c))
      x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { res(d) } })
    })
    r.on('error', rej)
    r.end()
  })
}

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  const token = lj.data.token
  const user = JSON.stringify(lj.data.user || {})

  const proc = spawn(EDGE, [
    `--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    `--window-size=${WIDTH},900`,
    '--user-data-dir=' + path.join(require('os').tmpdir(), '_perm_cdp_' + CDP_PORT),
    'about:blank',
  ], { detached: true, stdio: 'ignore' })
  proc.unref()

  let ver = null
  for (let i = 0; i < 40; i++) {
    try { ver = await httpJson('/json/version'); break } catch { await sleep(500) }
  }
  if (!ver) { log('FAIL: CDP 未就绪'); process.exit(2) }
  log('edge ready', ver.Browser)

  const tgt = await httpJson('/json/new?about:blank', 'PUT')
  const c = await connect(tgt.webSocketDebuggerUrl)
  let seq = 0
  const pend = new Map()
  c.on('message', (raw) => {
    let m; try { m = JSON.parse(raw) } catch { return }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  })
  const send = (method, params) => new Promise((res) => {
    const id = ++seq
    pend.set(id, res)
    c.send(JSON.stringify({ id, method, params: params || {} }))
  })
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval err')
    return r.result?.result?.value
  }
  await send('Page.enable'); await send('Runtime.enable')

  log('goto #/login')
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(3500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); 'ok'`)
  log('goto #/sys/org')
  await send('Page.navigate', { url: 'http://localhost:5173/#/sys/org' })
  await sleep(2500)
  await send('Page.reload', {})
  await sleep(9000)
  let hash = await ev('location.hash')
  if (!String(hash).includes('/sys/org')) {
    await ev(`location.hash = '#/sys/org'`)
    await sleep(4000)
    hash = await ev('location.hash')
  }
  log('hash =', hash)

  // 点第一张角色表(表头含「角色名称」)的非 admin 行
  const clicked = await ev(`(() => {
    const ds = [...document.querySelectorAll('.el-dialog__headerbtn')];
    ds.forEach(b => b.click());
    const ts = [...document.querySelectorAll('.el-table')];
    const t = ts.find(x => (x.querySelector('.el-table__header') || {}).innerText?.includes('角色名称'));
    if (!t) return 'no role table';
    const rows = [...t.querySelectorAll('tbody tr')];
    const r = rows.find(x => !x.innerText.includes('admin')) || rows[0];
    if (!r) return 'no row';
    const cell = [...r.querySelectorAll('td')].find(td => td.innerText.trim());
    (cell || r).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
    return 'clicked :: ' + r.innerText.replace(/\\s+/g, ' ').slice(0, 40);
  })()`)
  log(clicked)
  await sleep(3000)

  // 展开最大的组
  const expand = await ev(`(() => {
    const hs = [...document.querySelectorAll('.perm-collapse .el-collapse-item__header')];
    const h = hs.find(x => x.innerText.includes('生产制造')) || hs[0];
    if (!h) return 'no header';
    h.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
    return 'expanded ' + h.innerText.replace(/\\s+/g, ' ').slice(0, 20);
  })()`)
  log(expand)
  await sleep(2500)

  // 组内筛选:输入关键字后 tbody 行数应下降,清空后应恢复
  const filterTest = await ev(`(() => {
    const item = document.querySelector('.perm-collapse .el-collapse-item__wrap:not([style*="none"])');
    if (!item) return JSON.stringify({ err: 'no open group' });
    const input = item.closest('.el-collapse-item').querySelector('.g-filter input');
    if (!input) return JSON.stringify({ err: 'no filter input' });
    const rowsBefore = item.querySelectorAll('.perm-table tbody tr:not(.pt-empty-row)').length;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ZZZ_NOMATCH_ZZZ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return JSON.stringify({ rowsBefore });
  })()`)
  await sleep(900)
  const emptyState = await ev(`(() => {
    const item = document.querySelector('.perm-collapse .el-collapse-item__wrap:not([style*="none"])');
    if (!item) return JSON.stringify({ err: 'no open group' });
    const table = item.querySelector('.perm-table');
    return JSON.stringify({
      rows: table.querySelectorAll('tbody tr').length,
      emptyRow: !!table.querySelector('td.pt-empty'),
      emptyText: (table.querySelector('td.pt-empty') || {}).innerText || '',
      scrollW: item.querySelector('.perm-table-wrap').scrollWidth,
      wrapW: item.querySelector('.perm-table-wrap').clientWidth,
      headH: Math.round(item.closest('.el-collapse-item').querySelector('.el-collapse-item__header').getBoundingClientRect().height),
      filterW: Math.round(item.closest('.el-collapse-item').querySelector('.g-filter').getBoundingClientRect().width),
    });
  })()`)
  log('filterTest =', filterTest)
  log('emptyState =', emptyState)

  const restore = await ev(`(() => {
    const item = document.querySelector('.perm-collapse .el-collapse-item__wrap:not([style*="none"])');
    const input = item.closest('.el-collapse-item').querySelector('.g-filter input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'cleared';
  })()`)
  log(restore)
  await sleep(900)
  const afterClear = await ev(`(() => {
    const item = document.querySelector('.perm-collapse .el-collapse-item__wrap:not([style*="none"])');
    const table = item.querySelector('.perm-table');
    return JSON.stringify({
      rows: table.querySelectorAll('tbody tr').length,
      emptyRow: !!table.querySelector('td.pt-empty'),
    });
  })()`)
  log('afterClear =', afterClear)

  const report = await ev(`(() => {
    const wrap = document.querySelector('.perm-collapse .el-collapse-item__wrap:not([style*="none"]) .perm-table-wrap');
    if (!wrap) return JSON.stringify({ err: 'no visible wrap' });
    const table = wrap.querySelector('table.perm-table');
    const first = table.querySelector('tbody tr');
    const nameCell = first.querySelector('td.pt-panel');
    const nr = nameCell.getBoundingClientRect();
    const cs = getComputedStyle(nameCell);
    const heads = [...table.querySelectorAll('thead th')].map(th => {
      const r = th.getBoundingClientRect();
      return { text: th.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height) };
    });
    // 竖排判定:单元格高度远大于单行行高(约 26px)说明文字折成多行
    const lineH = parseFloat(cs.lineHeight) || 16;
    const wrapped = nr.height > lineH * 1.9;
    const headWrapped = heads.some(h => h.h > 34);
    return JSON.stringify({
      winW: innerWidth,
      cols: [...document.querySelectorAll('.org-col')].map(e => ({
        cls: e.className.replace('org-col', '').trim(), w: Math.round(e.getBoundingClientRect().width),
      })),
      chain: ['.portal-content', '.org-wrap', '.org-col.roles', '.perm-box', '.perm-collapse',
        '.el-collapse-item__wrap:not([style*="none"])', '.perm-table-wrap'].map(sel => {
        const e = document.querySelector(sel);
        if (!e) return { sel, missing: true };
        const r = e.getBoundingClientRect();
        return { sel, w: Math.round(r.width), clientW: e.clientWidth, scrollW: e.scrollWidth };
      }),
      wrapClientW: wrap.clientWidth,
      wrapScrollW: wrap.scrollWidth,
      overflowX: wrap.scrollWidth > wrap.clientWidth + 1,
      stickyPanel: (() => {
        const th = document.querySelector('.perm-table th.pt-panel')
        if (!th) return null
        return getComputedStyle(th).position === 'sticky'
      })(),
      nameCellW: Math.round(nr.width),
      nameCellH: Math.round(nr.height),
      lineHeight: lineH,
      nameWrapped: wrapped,
      nameText: nameCell.innerText.trim(),
      paintedLines: nameCell.innerText.trim().length ? Math.round(nr.height / lineH) : 0,
      headWrapped,
      headMaxH: Math.max(...heads.map(h => h.h)),
      headSample: heads.slice(0, 4).concat(heads.slice(-3)),
      totalCols: heads.length,
    });
  })()`)
  const R = JSON.parse(report)
  log('report =', JSON.stringify(R, null, 1))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  require('fs').writeFileSync(path.join(OUT, `_perm-cols-${WIDTH}.png`), Buffer.from(shot.result.data, 'base64'))
  log('shot ->', `_perm-cols-${WIDTH}.png`)

  // 断言分档:宽屏(矩阵可用宽 >= 1070px,即 14 列 1068px 能放下)要求零横向滚动;
  // 窄屏不可能放下 14 列,横向滚动是设计内行为,只要求首列 sticky 生效(面板名始终可见)。
  const wide = R.wrapClientW >= 1070
  const F = JSON.parse(filterTest)
  const E = JSON.parse(emptyState)
  const A = JSON.parse(afterClear)
  const checks = [
    ['面板名未竖排(高度 <= 2 行)', R.paintedLines <= 2],
    ['列头未换行(表头高 <= 34px)', !R.headWrapped],
    wide
      ? [`宽屏(${R.wrapClientW}px)无横向滚动`, !R.overflowX]
      : [`窄屏(${R.wrapClientW}px)允许横滚且首列钉左`, R.overflowX && R.stickyPanel === true],
    ['组头有筛选框且宽 100~180px', !E.err && E.filterW >= 100 && E.filterW <= 180],
    ['筛选框未撑高组头(<= 36px)', !E.err && E.headH <= 36],
    ['无匹配时仅留占位行', !E.err && E.emptyRow === true && E.emptyText.includes('无匹配')],
    ['清空筛选后恢复全量行', !E.err && A.rows === F.rowsBefore && A.rows > 3],
    // 窄屏下 1068px 表格本就靠横滚承载(见上一行断言),空态占位行同样落在该表格内。
    // 只要求空态未把表格撑得更宽:宽屏须完全贴合容器,窄屏不得超过 min-width 基线。
    [`筛到空时表格${R.overflowX ? '不超过 min-width' : '未横向撑出'}`, !E.err && (wide ? E.scrollW <= E.wrapW + 1 : E.scrollW <= R.wrapScrollW + 1)],
  ]
  let ok = true
  for (const [n, p] of checks) { console.log((p ? 'PASS  ' : 'FAIL  ') + n); if (!p) ok = false }
  log(ok ? 'ALL PASS' : 'HAS FAIL')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(2) })
