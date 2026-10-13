/*
 * _verify-qc-insp-plan-ui.cjs — 「检验项目维护」入口与弹窗 界面实测(2026-10-09,一次性探针)
 *
 * 链路:登录 → 打开组装成品检验单(QC_ASM_INSP)→ 工具栏「更多」→「检验项目维护」→
 *       断言弹窗打开、方案表出现 QP-CAS18、选中后其下 2 条目数项目渲染、截图留证。
 *
 * 只读:全程不点保存/停用(维护写操作由 _verify-qc-insp-plan-crud.mjs 在测试账套验)。
 * 用法: node tools/archive/_verify-qc-insp-plan-ui.cjs http://127.0.0.1:8091
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const PORT = 9454
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token, user = JSON.stringify(login.data.user)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qcplan-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(5000)

  ok('组装成品检验单已渲染', (await ev(`!!document.querySelector('.tb-group')||!!document.querySelector('.el-table__row')`)) === true)

  // 「更多」组 → 下拉 → 检验项目维护
  const clickMore = () => ev(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';const c=grp.querySelector('.tb-caret');if(!c)return 'NO_CARET';c.click();return 'CLICKED'})()`)
  for (let i = 0; i < 3 && (await clickMore()) !== 'CLICKED'; i++) await sleep(500)
  await sleep(600)
  const menuHas = await ev(`[...document.querySelectorAll('.tb-menu .ctx-item')].map(x=>(x.textContent||'').trim()).join('|')`)
  ok('「更多」下拉里出现「检验项目维护」', /检验项目维护/.test(String(menuHas)), String(menuHas).slice(0, 200))
  // 入口取证:点开之前先拍一张「更多」下拉里菜单项的样子
  {
    const shot0 = await send('Page.captureScreenshot', { format: 'png' })
    if (shot0?.result?.data) {
      const out0 = path.join(HERE, '_shot-qc-insp-plan-entry.png')
      fs.writeFileSync(out0, Buffer.from(shot0.result.data, 'base64'))
      console.log('    [截图] ' + out0)
    }
  }
  const clicked = await ev(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/检验项目维护/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
  ok('点开「检验项目维护」', clicked === 'CLICKED', clicked)

  const dlgReady = async () => ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案维护/.test(x.innerText||''));if(!d)return false;const r=d.getBoundingClientRect();return r.height>0&&r.width>0})()`)
  let up = false
  for (let i = 0; i < 25 && !up; i++) { up = (await dlgReady()) === true; if (!up) await sleep(300) }
  ok('维护弹窗已打开', up)

  // 等方案表真正加载出数据(弹窗渲染与 /plans 请求是两拍)
  const planRowCount = async () => ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案维护/.test(x.innerText||''));if(!d)return -1;const t=d.querySelectorAll('.el-table')[0];return t?t.querySelectorAll('.el-table__body-wrapper tbody tr').length:-1})()`)
  let planRows = 0
  for (let i = 0; i < 30; i++) { planRows = await planRowCount(); if (planRows > 0) break; await sleep(300) }
  ok('方案表加载出数据行', planRows > 0, planRows + ' 行')

  const info = await ev(`(()=>{
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案维护/.test(x.innerText||''));
    if(!d) return null;
    const tabs=[...d.querySelectorAll('.el-table')].map(t=>({
      rows:[...t.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim())),
      heads:[...t.querySelectorAll('.el-table__header-wrapper th')].map(th=>(th.innerText||'').trim().split('\\n')[0]).filter(Boolean)
    }));
    return { text:(d.innerText||'').slice(0,400), tables:tabs };
  })()`)
  ok('取到弹窗内容', !!info, info ? '' : 'null')
  if (info) {
    const planT = info.tables[0] || { rows: [], heads: [] }
    const itemT = info.tables[1] || { rows: [], heads: [] }
    ok('方案表含 QP-CAS18', planT.rows.some((r) => r.includes('QP-CAS18')), JSON.stringify(planT.rows.map((r) => r[0])).slice(0, 200))
    ok('方案表列头含 方案编码/取样规则/项目数', ['方案编码', '取样规则', '项目数'].every((k) => planT.heads.includes(k)), JSON.stringify(planT.heads))
    // 选中 QP-CAS18 行 → 下方项目表应出 2 条目数项
    await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案维护/.test(x.innerText||''));const t=d.querySelectorAll('.el-table')[0];const tr=[...t.querySelectorAll('.el-table__body-wrapper tbody tr')].find(r=>/QP-CAS18/.test(r.innerText||''));if(tr)tr.click();return 'ok'})()`)
    await sleep(1200)
    const item2 = await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>/检验项目\\/检验方案维护/.test(x.innerText||''));const t=d.querySelectorAll('.el-table')[1];
      return { rows:[...t.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim())),
               heads:[...t.querySelectorAll('.el-table__header-wrapper th')].map(th=>(th.innerText||'').trim().split('\\n')[0]).filter(Boolean) };})()`)
    ok('项目表显示 QP-CAS18 下 2 条目数项', (item2?.rows || []).filter((r) => /FIN-MESH/.test(r.join('|'))).length === 2,
      JSON.stringify((item2?.rows || []).map((r) => r[1])))
    ok('项目表列头含 检验方法/取样要求/合格处置/不合格处置',
      ['检验方法', '取样要求', '合格处置', '不合格处置'].every((k) => (item2?.heads || []).includes(k)), JSON.stringify(item2?.heads))
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_shot-qc-insp-plan-dialog.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('    [截图] ' + out)
  }
} finally { try { edge.kill() } catch { /* ignore */ } }

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
