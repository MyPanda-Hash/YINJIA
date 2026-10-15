/**
 * 界面级验收:出货检验计划表「产品编号」一选,规格书的检验项目落进本表明细 ——
 *   ① 序号不再是空白(按规格书同口径的**组号**,炭棒尺寸 三行同号);
 *   ② 带下去的名字规范化(冗余组名前缀去掉、保住 * / # 必检标记):
 *      `强度·*抗压强度` → `*抗压强度`;`强度·（裸棒）` 与 `*余氯去除性能·初始去除率` 原样。
 *
 * 用法:node insp-plan-carry.cjs prep                   # 测试账套建一张空白计划表,打印 DOCNO=
 *      node insp-plan-carry.cjs verify <单号> [产品编号]  # 界面验收(断言 + 截图)
 *      node insp-plan-carry.cjs clean  <单号>           # 删单(按精确单号)
 * ⚠ 全程**不点保存**;收尾按精确单号删(头表/明细/流转三处由外部 SQL 兜底)。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const MODE = (process.argv[2] || 'verify').toLowerCase()
const DOCARG = process.argv[3] || ''
const CODE = process.argv[4] || 'CB-YL-001'
const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9395
const OUT = path.join(process.env.TEMP, 'mes-ann2')
const PANEL = 'RD_INSP_PLAN'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 400)}`)
  if (!ok) fails++
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  const tok = lj?.data?.token, user = lj?.data?.user
  if (!tok) throw new Error('登录失败(测试账套)')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + tok }
  const post = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
  const listDocs = async () => {
    const r = await post('/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 50 })
    return (r?.data?.rows || r?.data?.list || []).map((x) => x['单据编号']).filter(Boolean)
  }
  if (MODE === 'clean') {
    console.log('删单:', JSON.stringify(await post('/px/deleteForms', { panelCode: PANEL, rowCodes: [DOCARG] })).slice(0, 160))
    console.log('剩余单号:', JSON.stringify(await listDocs()))
    return
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1700,1300', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map(); const errs = []; const net = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      const u = String(m.params?.response?.url || '')
      if (m.method === 'Network.responseReceived' && u.includes('specByProduct')) net.push(`${m.params.response.status} ${u.replace(BASE, '')}`)
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r2 = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      const ed = r2.result?.exceptionDetails
      if (ed) return '[JS异常] ' + (ed.exception?.description || ed.text)
      return r2.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1300, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(9000)

    if (MODE === 'prep') {
      const before = await listDocs()
      await ev(`(async () => {
        const txt = (e) => (e.innerText || '').trim()
        const btn = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b) === '新增')
        if (btn) btn.click(); await new Promise((r) => setTimeout(r, 6000)); return 'ok'
      })()`)
      const docs = await listDocs()
      const created = docs.find((n) => !before.includes(n))
      console.log('DOCNO=' + created)
      chk('PREP', '测试账套建了一张空白出货检验计划表', !!created, `单号=${created};新增前=${before.length} 张`)
      return
    }

    // verify:打开目标单 → 选产品编号 → 读明细
    const opened = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
      const prev = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b).includes('单据预览'))
      if (prev) { prev.click(); await sleep2(1200) }
      const box = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('快速'))
      if (box) {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(box, ${JSON.stringify(DOCARG)})
        box.dispatchEvent(new Event('input', { bubbles: true }))
        await sleep2(2000)
      }
      const card = [...document.querySelectorAll('.preview-card')].find((c) => txt(c).includes(${JSON.stringify(DOCARG)}))
      if (card) { card.click(); await sleep2(4000) }
      return { card: !!card, sheet: !!document.querySelector('.record-sheet') }
    })()`)
    console.log('[开单]', JSON.stringify(opened))
    chk(`① 打开目标单 ${DOCARG}`, !!opened?.card && !!opened?.sheet, JSON.stringify(opened))

    const picked = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
      const cells = [...document.querySelectorAll('.rs-ref-ctl')]
      if (!cells.length) return { err: '没有参照格' }
      cells[0].click()
      await sleep2(2500)
      const dlg = document.querySelector('.el-dialog')
      if (!dlg) return { err: '参照弹窗没打开' }
      const box = dlg.querySelector('input')
      if (box) {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(box, ${JSON.stringify(CODE)})
        box.dispatchEvent(new Event('input', { bubbles: true }))
        await sleep2(300)
        const q = [...dlg.querySelectorAll('button')].find((b) => txt(b).includes('查询'))
        if (q) q.click()
        await sleep2(2500)
      }
      const row = dlg.querySelector('.el-table__body tbody tr')
      if (row) { const cb = row.querySelector('.el-checkbox'); if (cb) cb.click(); await sleep2(400) }
      const btn = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => txt(b).includes('确定导入'))
      if (btn && !btn.disabled) btn.click()
      await sleep2(5500)
      return { ok: true, dlgClosed: !document.querySelector('.el-dialog') }
    })()`)
    console.log('[选参照]', JSON.stringify(picked))
    chk('② 参照弹窗选中 CB-YL-001 并确定导入', !!picked?.ok, JSON.stringify(picked))

    const rows = await ev(`(() => {
      const norm = (s) => String(s || '').replace(/\\s+/g, '')
      // ⚠ 表头显示的是**设计原文**(检验要求/检验方法/检查频率 —— 由 yj_field.alias 覆盖),
      //   不是数据键(控制标准及要求/控制方法);按设计原文找表才可以(踩过一次)。
      const tbl = [...document.querySelectorAll('table')].filter((t) => t.offsetParent && norm(t.innerText).includes('不合格应对措施')).pop()
      if (!tbl) return { err: '找不到明细表' }
      const trs0 = [...tbl.querySelectorAll('tr')]
      const ths = (trs0.map((tr) => [...tr.children].map((c) => norm(c.innerText))).find((r) => r.includes('检验项目') && r.includes('检验要求'))) || []
      const idx = (n) => ths.findIndex((h) => h.includes(n))
      const trs = trs0.filter((tr) => !tr.querySelector('th') && tr.querySelector('input, textarea'))
      return {
        ths,
        rows: trs.map((tr) => ({
          序号: ((tr.children[idx('序号')] || {}).querySelector && (tr.children[idx('序号')].querySelector('input, textarea') || {}).value) || '',
          项目: ((tr.children[idx('检验项目')] || {}).querySelector && (tr.children[idx('检验项目')].querySelector('input, textarea') || {}).value) || '',
          要求: (((tr.children[idx('检验要求')] || {}).querySelector && (tr.children[idx('检验要求')].querySelector('input, textarea') || {}).value) || '').slice(0, 16),
        })).filter((r) => r.项目),
      }
    })()`)
    console.log('[明细]', JSON.stringify(rows, null, 1).slice(0, 1400))
    if (rows?.err) { chk('③ 读到明细行', false, rows.err) } else {
      const list = rows.rows || []
      chk('③ 明细行已按规格书填入(行数>0)', list.length > 0, `${list.length} 行`)
      chk('③ 序号不再是空白', list.every((r) => String(r.序号).trim() !== ''), list.map((r) => r.序号).join(','))
      chk('③ 序号 = 规格书同口径组号(同项目同号)', new Set(list.map((r) => r.序号)).size === 4 && [...new Set(list.map((r) => r.序号))].every((n, i) => Number(n) === i + 1),
        list.map((r) => `${r.序号}:${r.项目}`).join(' | '))
      const names = list.map((r) => r.项目)
      chk('③ 带下去的名字规范了(强度·*抗压强度 → *抗压强度)', names.includes('*抗压强度') && !names.includes('强度·*抗压强度'), JSON.stringify(names))
      chk('③ 组名是真信息/括号补语的名字原样保留', names.includes('强度·（裸棒）') && names.some((n) => n.includes('余氯去除性能')), JSON.stringify(names))
      chk('③ 保留 * / # 必检标记', names.some((n) => n.startsWith('*')) && names.some((n) => n.startsWith('#')), JSON.stringify(names))
      // 刚按规格书带完 ⇒ 不许弹「规格书已变动」(实测踩过:同名多行被 Map 盖掉导致误报)
      const drift = await ev(`(() => { const b = document.querySelector('.rs-drift-btn'); return b ? b.innerText.trim().slice(0, 120) : '' })()`)
      chk('③ 不误报「规格书已变动」', drift === '', drift || '(无提示条)')
    }
    chk('④ 取了规格书(接口 2xx)', net.some((n) => /^2\d\d/.test(n)), net.join(' | ') || '无')
    chk('⑤ 无 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '))

    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot?.result?.data) {
      const p = path.join(OUT, 'insp-plan-carry.png')
      fs.writeFileSync(p, Buffer.from(shot.result.data, 'base64'))
      console.log('SHOT=' + p)
    }
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
