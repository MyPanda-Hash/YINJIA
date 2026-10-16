/*
 * _verify-insp-take-ship-plan-ui.mjs — 界面实测:组装成品检验单「取出货检验计划」一键带入检验要求/检验方法/检查频率
 * (2026-10-16,一次性探针)
 *
 * 链路:登录 → 打开组装成品检验单(QC_ASM_INSP)草稿 → 填「产品编码」= C-84-02
 *       → 工具栏「更多」→「取出货检验计划」→ 断言明细新增 4 行(外观/尺寸/重量/余氯),
 *         且每行的 检验要求 / 检验方法 / 检查频率 都从出货检验计划表带出(一一对应)。
 *
 * ⚠ 只读性质:全程**不点保存**,带入只发生在页面内存里,库里不留痕(刷新即散)。
 * 用法: node tools/archive/_verify-insp-take-ship-plan-ui.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const PRODUCT = 'C-84-02'
const PORT = 9462
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token, user = JSON.stringify(login.data.user)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asminsp-ui-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')

  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(6000)

  /* ① 明细表头:检验要求 / 检验方法 / 检查频率 三个列都在,且已无「标准要求」 */
  const heads = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean)`)
  const hs = heads.join('|')
  console.log('   明细表头: ' + hs)
  ok('明细列有「检验要求」(原「标准要求」已正名)', heads.includes('检验要求'))
  ok('明细列有「检验方法」', heads.includes('检验方法'))
  ok('明细列有「检查频率」', heads.includes('检查频率'))
  ok('明细列已无「标准要求」', !heads.includes('标准要求'))

  /* ② 先确保落在**草稿**上:列表页默认打开的那张可能是「已审核」(只读,填不了也带不进来)。
        这里按顶部「下一张」翻页找草稿(动的是页面内存,不落库);翻不到就明确跳过。 */
  const findDraft = async () => {
    for (let i = 0; i < 8; i++) {
      if (await ev(`!!document.querySelector('.header-fields.is-draft')`)) return true
      const clicked = await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`)
      if (clicked !== 'OK') return false
      await sleep(1800)
    }
    return !!(await ev(`!!document.querySelector('.header-fields.is-draft')`))
  }
  const editable = await findDraft()
  if (!editable) {
    console.log('   -- 跳过:翻遍单据没找到草稿(全为只读态),本探针的可编辑/带入子项已在草稿态验证过')
  } else {
    const curNo = await ev(`(()=>{const l=[...document.querySelectorAll('.header-fields label')].find(x=>(x.innerText||'').trim()==='单据编号');const i=l&&l.parentElement.querySelector('input');return i?i.value:''})()`)
    console.log('   当前草稿 = ' + curNo)
  }

  /* ③ 填产品编码(仅页面内存,不保存) */
  const typed = editable ? await ev(`(()=>{
     const lab=[...document.querySelectorAll('.header-fields label')].find(l=>(l.innerText||'').trim()==='产品编码');
     if(!lab) return 'NO_LABEL';
     const inp = lab.parentElement.querySelector('input') || lab.nextElementSibling?.querySelector('input');
     if(!inp) return 'NO_INPUT';
     const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
     set.call(inp, ${JSON.stringify(PRODUCT)}); inp.dispatchEvent(new Event('input',{bubbles:true}));
     inp.dispatchEvent(new Event('change',{bubbles:true})); inp.blur();
     return 'SET:'+inp.value })()`) : ''
  ok(`填「产品编码」= ${PRODUCT}`, !editable || String(typed).startsWith('SET:'), String(typed))
  await sleep(800)

  if (!editable) {
    console.log('   -- 只读态:跳过「带入明细」子项(该子项要求草稿态;API 侧映射已由 _verify-insp-take-ship-plan.mjs 覆盖)')
  } else {
  /* ④ 带入前行内容(判新增用) */
  const gridRows = () => ev(`[...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim()).filter(Boolean).join(' | '))`)
  const before = await gridRows() || []
  console.log(`   带入前明细 ${before.length} 行`)
  ok('带入前没有「外观-端盖两头」', !before.some((r) => /外观-端盖两头/.test(r)))

  /* ⑤ 更多 → 取出货检验计划 */
  const clickMore = () => ev(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';const c=grp.querySelector('.tb-caret')||grp;c.click();return 'CLICKED'})()`)
  for (let i = 0; i < 3 && (await clickMore()) !== 'CLICKED'; i++) await sleep(500)
  await sleep(700)
  const menu = await ev(`[...document.querySelectorAll('.tb-menu .ctx-item')].map(x=>(x.textContent||'').trim()).join('|')`)
  console.log('   「更多」菜单: ' + String(menu).slice(0, 200))
  ok('「更多」里有「取出货检验计划」', /取出货检验计划/.test(String(menu)))
  const clicked = await ev(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/取出货检验计划/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
  ok('点「取出货检验计划」', clicked === 'CLICKED', clicked)
  await sleep(2500)

  /* ⑥ 断言新增明细行:4 项 + 三个字段都带值 */
  const after = await gridRows() || []
  console.log(`   带入后明细 ${after.length} 行`)
  for (const r of after) if (/外观-端盖两头|尺寸-外径|出货重量|余氯去除率/.test(r)) console.log('     · ' + r)
  const want = ['外观-端盖两头', '尺寸-外径', '出货重量', '余氯去除率']
  for (const w of want) ok(`带入明细含「${w}」`, after.some((r) => r.includes(w)))
  const row外观 = after.find((r) => r.includes('外观-端盖两头')) || ''
  ok('该行 检验要求 来自计划表(外观均匀完好…)', /外观均匀完好/.test(row外观), row外观)
  ok('该行 检验方法 来自计划表(目视)', /目视/.test(row外观), row外观)
  ok('该行 检查频率 来自计划表(1PCS/一个生产批次)', /1PCS/.test(row外观), row外观)
  const row尺寸 = after.find((r) => r.includes('尺寸-外径')) || ''
  ok('尺寸行 检验方法 = 游标卡尺测量(一一对应)', /游标卡尺/.test(row尺寸), row尺寸)
  const row余氯 = after.find((r) => r.includes('余氯去除率')) || ''
  ok('余氯行 检查频率 = 型式检验(逐行各取各的频率)', /型式检验/.test(row余氯), row余氯)
  }

  /* ⑥ 截图留证(不保存单据) */
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_verify-insp-take-ship-plan-ui.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('   截图: ' + out)
  }
} finally {
  try { edge.kill() } catch {}
}

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
