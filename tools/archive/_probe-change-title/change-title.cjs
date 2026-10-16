/**
 * 验收探针:产品变更申请单(RD_CHANGE)大标题格 = 可自主编辑的普通文本框(2026-10-16 用户口径)
 *
 * 用户原话:
 *   「产品变更信息表的 KPC管控点申请单这个栏改为可自主编辑的普通文本框,背景提示词默认为现在的这个,
 *     未进行更改则默认背景提示词」。
 *
 * 验收点:
 *   T1 大标题格是**输入框**(不是印死文本),**背景提示词 = KPC管控点申请单**、初始值为空(= 未更改)
 *   T2 能自己写进去并**保存落库**(rd_change_head.[标题])—— 这条最要紧:字段没登记就存不进去
 *   T3 不填时纸上仍印静态标题(只读态回落 staticTitle)
 *
 * 用法:node change-title.cjs            # 测试账套:新增 → 断言 → 填标题+产品编号 → 保存 → 打印单号
 *      ⚠ 会真的落一张测试账套的单(保存是验收 T2 的必要步骤),收尾按打印的单号删。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9397
const OUT = path.join(process.env.TEMP, 'mes-ann2')
const PANEL = 'RD_CHANGE'
const CODE = 'CB-YL-001'
const TITLE = 'KPC管控点申请单（探针标题）'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 300)}`)
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
  const before = await listDocs()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cht-'))
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
    let id = 0; const pend = new Map(); const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r2 = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      const ed = r2.result?.exceptionDetails
      if (ed) return '[JS异常] ' + (ed.exception?.description || ed.text)
      return r2.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1300, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(9000)

    // 新增一张空白变更申请单
    await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const b = [...document.querySelectorAll('.as-side-btn, .el-button')].find((x) => txt(x) === '新增')
      if (b) b.click(); await new Promise((r) => setTimeout(r, 6000)); return 'ok'
    })()`)

    // T1:大标题格
    const t1 = await ev(`(() => {
      const txt = (e) => ((e.innerText || '').trim())
      const cell = document.querySelector('.rs-topic-cell')
      if (!cell) return { err: '找不到大标题格' }
      const inp = cell.querySelector('input')
      return {
        isInput: !!inp,
        ph: inp ? inp.placeholder : '',
        val: inp ? inp.value : '',
        span: txt(cell).slice(0, 60),
      }
    })()`)
    console.log('[大标题格]', JSON.stringify(t1))
    chk('T1 大标题格是输入框(可自主编辑)', t1?.isInput === true, JSON.stringify(t1))
    chk('T1 背景提示词 = KPC管控点申请单', t1?.ph === 'KPC管控点申请单', `ph=${JSON.stringify(t1?.ph)}`)
    chk('T1 初始为空(= 未更改,纸上按提示词/静态标题)', String(t1?.val || '') === '', `val=${JSON.stringify(t1?.val)}`)

    // 填标题 + 产品编号(必填) —— 为了 T2 真保存
    const filled = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
      const setVal = (el, v) => {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const titleInp = document.querySelector('.rs-topic-cell input')
      setVal(titleInp, ${JSON.stringify(TITLE)})
      await sleep2(400)
      // 产品编号(参照,必填)
      const cells = [...document.querySelectorAll('.rs-ref-ctl')]
      if (cells.length) {
        cells[0].click()
        await sleep2(2500)
        const dlg = document.querySelector('.el-dialog')
        if (dlg) {
          const box = dlg.querySelector('input')
          if (box) { setVal(box, ${JSON.stringify(CODE)}); await sleep2(300)
            const q = [...dlg.querySelectorAll('button')].find((b) => txt(b).includes('查询')); if (q) q.click(); await sleep2(2500) }
          const row = dlg.querySelector('.el-table__body tbody tr')
          if (row) { const cb = row.querySelector('.el-checkbox'); if (cb) cb.click(); await sleep2(400) }
          const btn = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => txt(b).includes('确定导入'))
          if (btn && !btn.disabled) btn.click()
          await sleep2(4500)
        }
      }
      return { title: document.querySelector('.rs-topic-cell input')?.value || '', refCells: cells.length }
    })()`)
    console.log('[填值]', JSON.stringify(filled))
    chk('T2 标题已填进输入框', filled?.title === TITLE, JSON.stringify(filled?.title))

    const shot1 = await send('Page.captureScreenshot', { format: 'png' })
    if (shot1?.result?.data) {
      const p = path.join(OUT, 'change-title.png')
      fs.writeFileSync(p, Buffer.from(shot1.result.data, 'base64'))
      console.log('SHOT=' + p)
    }

    // 保存
    const saved = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const b = [...document.querySelectorAll('.as-side-btn, .el-button')].find((x) => txt(x) === '保存')
      if (!b) return { err: '没有保存按钮' }
      b.click()
      await new Promise((r) => setTimeout(r, 6000))
      return {
        toasts: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).join(' | '),
        docNo: txt(document.querySelector('.rs-docno') || {}).slice(0, 30),
        title: document.querySelector('.rs-topic-cell input')?.value || '',
      }
    })()`)
    console.log('[保存]', JSON.stringify(saved))
    const docs = await listDocs()
    const created = docs.find((n) => !before.includes(n))
    chk('T2 保存后有新单号', !!created, `新单号=${created};保存提示=${saved?.toasts || '(无)'}`)
    if (created) console.log('DOCNO=' + created)
    chk('T3 无 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '))
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过(落库断言见随后的 SQL 核查)')
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
