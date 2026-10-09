/* 验证「仓位分区」弹窗(方案 A 修正版) —— CDP 真点(2026-10-08, 测试账套 YJ_TEST)
   验:①点格开弹窗 ②候选=数据派生(含仓位数) ③填入回填单元格 ④删除=带保护的指引(不触碰仓位数据)
   用法: node --experimental-websocket _probe-zonepick.cjs [frontUrl]
   ⚠ 只点「填入」改草稿,**不点保存**;测试账套。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const FRONT = process.argv[2] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9421
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lg = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })).json()
  const user = lg.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-zp-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--window-size=1920,1080',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || '').slice(0, 150) }; return r.result?.result?.value }
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i=0;i<50;i++){ await sleep(300); if ((await ev('document.readyState'))==='complete'){ await sleep(800); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});
localStorage.setItem('mes_login_date','2026-10-08'); 'ok'`)
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/WHLOC`)
    await sleep(4500)
    console.log('[title]', await ev('document.title'), '| 账套:', await ev(`(JSON.parse(localStorage.getItem('mes_factory')||'{}')).name`))

    const hdrs = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>th.textContent.replace(/\\s+/g,'').trim())`)
    const zIdx = hdrs.findIndex((h) => h.includes('存储分区'))
    const aIdx = hdrs.findIndex((h) => h.includes('大区'))
    console.log(`[列] 大区=${aIdx} 存储分区=${zIdx}`)

    // ① 点「存储分区」格 → 应开弹窗
    console.log('\n########## ① 点格开弹窗 ##########')
    console.log('[点格]', JSON.stringify(await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${zIdx}];
      const tgt=cell.querySelector('.zone-pick-cell')||cell.querySelector('.cell-lazy')||cell;
      tgt.click(); return 'clicked on ' + tgt.className;
    })()`)))
    await sleep(1200)
    const opened = await ev(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null);
      const t=d.length? (d[d.length-1].querySelector('.el-dialog__title')||{}).textContent : null;
      return { 弹窗数: d.length, 标题: t };
    })()`)
    console.log('[弹窗]', JSON.stringify(opened))
    if (!opened || opened.弹窗数 === 0) { console.log('  ★ 弹窗没打开'); return }

    // ② 读候选(应 10 组,含仓位数)
    console.log('\n########## ② 候选=数据派生 ##########')
    const combos = await ev(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null).pop();
      const rows=[...d.querySelectorAll('.el-table__body .el-table__row')];
      return { 组数: rows.length, 行: rows.map(r=>[...r.children].slice(0,3).map(c=>c.textContent.trim()).join(' | ')) };
    })()`)
    console.log('[候选]', JSON.stringify(combos, null, 1))
    console.log('[提示文案]', JSON.stringify(await ev(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null).pop();
      return (d.querySelector('.zpd-tip')||{}).textContent?.trim();
    })()`)))

    // ③ 点某行「填入」→ 应回填单元格
    console.log('\n########## ③ 填入回填 ##########')
    const before = await ev(`(() => { const r=document.querySelectorAll('.el-table__body .el-table__row')[0]; return JSON.stringify({大区:r.children[${aIdx}].textContent.trim(), 存储分区:r.children[${zIdx}].textContent.trim()}); })()`)
    console.log('  填入前(大区|存储分区) =', before)
    console.log('[点"填入"]', JSON.stringify(await ev(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null).pop();
      const rows=[...d.querySelectorAll('.el-table__body .el-table__row')];
      const target=rows.find(r=>r.textContent.includes('炭粉区')) || rows[0];
      const btn=[...target.querySelectorAll('button')].find(b=>b.textContent.trim()==='填入');
      if(!btn) return 'no-fill-btn'; btn.click(); return 'clicked on ' + target.textContent.replace(/\\s+/g,' ').trim().slice(0,40);
    })()`)))
    await sleep(1200)
    const after = await ev(`(() => { const r=document.querySelectorAll('.el-table__body .el-table__row')[0]; return JSON.stringify({大区:r.children[${aIdx}].textContent.trim(), 存储分区:r.children[${zIdx}].textContent.trim()}); })()`)
    console.log('  填入后(大区|存储分区) =', after, after !== before ? '✓ 已变化' : '★ 未变')

    // ④ 删除 = 带保护的指引
    console.log('\n########## ④ 删除(带保护) ##########')
    // 重开弹窗(填入后已关闭)
    await ev(`(() => { const c=document.querySelectorAll('.el-table__body .el-table__row')[1].children[${zIdx}]; (c.querySelector('.zone-pick-cell')||c.querySelector('.cell-lazy')||c).click(); return 'ok'; })()`)
    await sleep(1200)
    console.log('[点"删除"]', JSON.stringify(await ev(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null).pop();
      if(!d) return 'no-dialog';
      const rows=[...d.querySelectorAll('.el-table__body .el-table__row')];
      const target=rows.find(r=>r.textContent.includes('炭粉区')) || rows[0];
      const btn=[...target.querySelectorAll('button')].find(b=>b.textContent.trim()==='删除');
      if(!btn) return 'no-del-btn'; btn.click(); return 'clicked';
    })()`)))
    await sleep(1200)
    const msg = await ev(`(() => {
      const boxes=[...document.querySelectorAll('.el-message-box')].filter(x=>x.offsetParent!==null);
      if(!boxes.length) return { 无提示: true };
      const b=boxes[boxes.length-1];
      return { 标题: (b.querySelector('.el-message-box__title')||{}).textContent?.trim(),
               正文: (b.querySelector('.el-message-box__message')||{}).textContent?.trim(),
               按钮: [...b.querySelectorAll('button')].map(x=>x.textContent.trim()) };
    })()`)
    console.log('[提示]', JSON.stringify(msg, null, 1))
    await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')].pop(); if(b) b.click(); return 'ok'; })()`)
    await sleep(600)
    console.log('\n⚠ 未点保存,草稿随浏览器关闭丢弃;仓位数据未变。')
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
