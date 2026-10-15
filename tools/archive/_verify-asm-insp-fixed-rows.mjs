/*
 * _verify-asm-insp-fixed-rows.mjs — 「固定项=真行,能填且不落脏行」实测(2026-10-16,一次性探针)
 *
 * 用户口径:「当前这三行无法填写啊,如果当前实现存在问题有没有其他方法能够实现的?」
 * ⇒ 实现换成:打开草稿时按 yj_panel.config 的 fixedItems **自动把固定项补成明细真行**
 *    (表区=外观、检验项目=端盖两头/管身两侧),分区里**直接可填**;没填的行保存时**剔除**。
 *
 * 验(测试账套,可造数、用完删):
 *   ① 打开探针草稿 ⇒ 外观区两行是**真行**(非占位 ph-row),且格可点开编辑器;
 *   ② 填一格(检验结果=无异常)⇒ 值进页面模型;
 *   ③ 保存后查库:只有**填过的那一行**落库(端盖两头),另一行(管身两侧)不落库 ⇒ 不留空行;
 *   ④ 清理探针单。
 * 用法: node tools/archive/_verify-asm-insp-fixed-rows.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const PORT = 9473
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

/* ── 测试账套:建一张探针草稿(界面用它验"能填",保存走界面按钮,落库用 API 查)
     ⚠ 必须带必填的表头(单据日期/工单号):空建的草稿点「保存」会卡在必填校验上不上报,
       表现为"点了保存但库里没行"(2026-10-16 实测踩到 —— 提示 3 秒后自动消失,容易误判)。 ── */
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('测试账套登录失败'); process.exit(1) }
const TOK = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK }
const post = async (u, b) => (await fetch(`${BASE}${u}`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json()))
const created = await post('/api/px/callButton', {
  panelCode: PANEL, buttonName: '保存',
  formData: { 单据日期: '2026-10-16', 工单号: 'PROBE-FIXEDROWS-0001' }, buttonParam: {},
})
const NO = created?.data?.['编号'] || created?.['编号']
ok('建探针草稿(测试账套)', !!NO, JSON.stringify(created).slice(0, 140))
if (!NO) process.exit(1)
console.log('   探针单号 = ' + NO)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fxr-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1200',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let n = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(TOK)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(7000)

  /* 翻到刚建的探针单(它是最后一张草稿) */
  const findDoc = async () => {
    for (let i = 0; i < 30; i++) {
      const txt = await ev(`document.body.innerText || ''`)
      if (String(txt).includes(NO)) return true
      const c = await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`)
      if (c !== 'OK') return false
      await sleep(1500)
    }
    return false
  }
  const onProbe = await findDoc()
  ok('定位到探针单', onProbe, 'target=' + NO)

  /* ① 外观区两行是**真行**(非 ph-row),不是只读展示行 */
  const appRows = await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
     if(!s) return JSON.stringify({err:'NO_SEC'});
     return JSON.stringify([...s.querySelectorAll('.el-table__body tbody tr')].map(tr=>({
        ph:tr.className.includes('ph-row'), txt:(tr.innerText||'').replace(/\\s+/g,' ').trim()})))})()`)
  const rows = JSON.parse(String(appRows))
  console.log('   外观区行: ' + JSON.stringify(rows))
  const real = (rows || []).filter((r) => !r.ph)
  ok('外观区的「端盖两头 / 管身两侧」是**真行**(可填,不是只读展示行)',
    real.some((r) => /端盖两头/.test(r.txt)) && real.some((r) => /管身两侧/.test(r.txt)), JSON.stringify(rows))
  ok('外观区没有出现"点击新增一行"这种加行提示(加行仍在下方明细行)',
    !(rows || []).some((r) => /点击新增一行|点击开始填写/.test(r.txt)))

  /* ② 点「无异常」那一格 ⇒ 出现编辑器,输入后进模型
     ⚠ 必须点**格里的 span**(.cell-lazy),不能点 td 中心:空格子的 span 宽度≈0,
       点 td 中心落在空白处、编辑器不弹(2026-10-16 实测,第一版探针因此假失败)。 */
  const cellPt = async (label, rowText) => JSON.parse(String(await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
     const hs=[...s.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=hs.indexOf(${JSON.stringify(label)});
     const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>new RegExp(${JSON.stringify(rowText)}).test(x.innerText||''));
     if(!tr||ci<0) return JSON.stringify({err:true,ci:ci});
     const td=tr.querySelectorAll('td')[ci];
     const sp=td.querySelector('.cell-lazy') || td.querySelector('.cell');
     const r=(sp||td).getBoundingClientRect();
     return JSON.stringify({x:Math.round(r.x+Math.min(12, Math.max(2, r.width/2))), y:Math.round(r.y+r.height/2)}) })()`)))
  const p1 = await cellPt('检验结果', '端盖两头')
  ok('定位到「端盖两头」行的「检验结果」格', !!p1 && !p1.err, JSON.stringify(p1))
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: p1.x, y: p1.y, button: 'left', clickCount: 1 })
  }
  await sleep(800)
  const ready = await ev(`(()=>{const i=document.querySelector('.arch-section .el-table__body input, .arch-section .el-table__body textarea');return i?'EDITOR':'NO_EDITOR'})()`)
  ok('该格可点开录入(出现编辑器)——"无法填写"已解决', ready === 'EDITOR', String(ready))
  await send('Input.insertText', { text: '无异常' })
  await sleep(400)
  /* 收格:点别处,再读回该行 */
  const p2 = await cellPt('检验要求', '端盖两头')
  if (p2 && !p2.err) {
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: p2.x, y: p2.y, button: 'left', clickCount: 1 })
    }
  }
  await sleep(700)
  const back = await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
     const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>/端盖两头/.test(x.innerText||''));
     return tr?(tr.innerText||'').replace(/\\s+/g,' ').trim():''})()`)
  ok('键入「无异常」后回显在该行(值进了页面模型)', /无异常/.test(String(back)), String(back).slice(0, 120))

  /* ③ 保存(走界面「保存」按钮)⇒ 只有填过的那行落库
     ⚠ 提示要**立刻**抓:ElMessage 3 秒后自动消失(卡校验时只有提示能说明原因)。 */
  const saved = await ev(`(()=>{const b=[...document.querySelectorAll('.tb-group,.tb-main')].find(x=>/^保存/.test((x.innerText||'').trim()));
     if(!b) return 'NO_BTN'; const m=b.querySelector('.tb-main')||b; m.click(); return 'CLICKED'})()`)
  ok('点「保存」', saved === 'CLICKED', String(saved))
  await sleep(1200)
  const msg = await ev(`[...document.querySelectorAll('.el-message,.el-message__content')].map(x=>(x.innerText||'').trim()).join(' || ')`)
  console.log('   保存提示: ' + String(msg).slice(0, 200))
  ok('保存没有卡校验/报错', !/不能为空|必填|失败/.test(String(msg)), String(msg).slice(0, 160))
  await sleep(3000)
} finally { try { edge.kill() } catch {} }

/* ④ 查库:只有 端盖两头 那一行(填过的)落库,管身两侧 不落库 */
const chk = await post('/api/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 200 })
const doc = (chk.data?.list || []).find((x) => x['单据编号'] === NO || x['编号'] === NO)
const items = doc?.detail?.items || []
console.log('   落库明细: ' + JSON.stringify(items.map((r) => ({ t: r['表区'], i: r['检验项目'], v: r['检验结果'] }))))
ok('填过的固定项行落库(端盖两头 + 检验结果=无异常)',
  items.some((r) => /端盖两头/.test(r['检验项目'] || '') && /无异常/.test(r['检验结果'] || '')), JSON.stringify(items).slice(0, 240))
ok('**没填**的固定项行没落库(不留空行:管身两侧不在库里)',
  !items.some((r) => /管身两侧/.test(r['检验项目'] || '')), JSON.stringify(items).slice(0, 240))

/* 清理 */
const del = await post('/api/px/callButton', { panelCode: PANEL, buttonName: '删除', formData: { 编号: NO, 单据编号: NO }, buttonParam: {} })
ok('清理:探针单已删除', del?.code === 200, JSON.stringify(del).slice(0, 140))

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
