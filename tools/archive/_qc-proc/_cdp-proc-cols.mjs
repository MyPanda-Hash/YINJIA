/**
 * _cdp-proc-cols.mjs — 制程检验单纸张表验收探针(**纵向表版**,2026-10-17 第六轮口径)。
 *
 * 用户口径:「好的当前制程检验形式错误了,这个内容进行修改实现……不需要那些外观什么的」
 *   +「等下,表头内容可以不进行修改,当前针对检验结果处的格式进行修改即可」
 *   ⇒ 抬头/结论区不动,只把「检验结果」那块改成截图(《生产相关品质检验.xlsx》制程检验页签第二块)那种
 *     **纵向表:一行一个检验项目**。
 *
 * 断言:
 *   ① 抬头(单据要素)照旧在(单据编号/单据日期/检验类别…),即抬头没被动过;
 *   ② 表头 = 客户名称|产品编码|型号（mm）|批号|检验人员：|产线常规功能性结果|结果判断,
 *      第二行两句「以下检验要求/检验方法自动填充出货检验计划表」;
 *   ③ **不再有 表区 分组/外观|尺寸|出货重量 组头**(「不需要那些外观什么的」);
 *   ④ 表体 = 一行一个检验项目:检验要求|检验方法|产线常规功能性结果|结果判断(+ 删行 ×);
 *   ⑤ 「＋新增检验项」加一行、「⧉带入检验项目」入口在;删有内容的行要弹确认;
 *   ⑥ 只读态照旧(输入框变文本)。
 * 另附截图(zh-CN / en)。
 *
 * 用法(node tools/archive/_qc-proc/_cdp-proc-cols.mjs [baseUrl] [panelCode] [docNo])
 * ⚠ Edge 坑:--headless=new 会塞 edge://sync-confirmation-dialog,取页要过滤 ^edge://。
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../node_modules/ws/index.js'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const panel = process.argv[3] || 'QC_PROC_INSP'
const wantNo = process.argv[4] || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const factory = process.env.YJ_PROBE_FACTORY || 'YJ'
/** 只有测试账套允许探针**建单**(正式账套一律只读:可编辑断言在只读单上自动跳过,见下) */
const canWrite = factory === 'YJ_TEST'
const head = b64({ alg: 'HS256' })
const body = b64({ sub: 'admin', factory, iat: now, exp: now + 6 * 3600 })
const token = `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
let createdForProbe = ''

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1800,1100',
    '--remote-debugging-port=9391', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'proc-cols-')), 'about:blank'],
  { stdio: 'ignore' })

let ws
const fail = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}${extra ? ' — ' + extra : ''}`)
  else { fail.push(name); console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}

try {
  let tab
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9391/json/list').then((r) => r.json())
      tab = list.find((t) => t.type === 'page' && !/^edge:/.test(t.url)) || null
      if (!tab) tab = await fetch('http://127.0.0.1:9391/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
      break
    } catch { await sleep(250) }
  }
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let n = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Page.navigate', { url: base + '/#/login' })
  await sleep(1500)
  await ev(`localStorage.setItem('mes_token',${JSON.stringify(token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify({ userName: 'admin', realName: '系统管理员', isAdmin: true }))});localStorage.setItem('mes_init_done','1');localStorage.setItem('mes_locale','zh-CN')`)
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(200)
  await send('Page.navigate', { url: `${base}/#/panelx/list/${panel}` })
  await sleep(6000)
  await ev(`(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach(b => b.click()); return 1 })()`)
  await sleep(300)
  ok('面板纸张表渲染', await ev(`!!document.querySelector('.qr-sheet, .qr-grid')`))
  // ── 可写账套(仅测试库)自备一张草稿:列表里没有草稿时探针没法验可编辑行为 ──
  const statusOfPage = () => ev(`(() => { const s = document.querySelector('.as-side-status-row .doc-status'); return s ? s.innerText.trim() : '' })()`)
  const noOfPage = () => ev(`(() => {
    const vals = [...document.querySelectorAll('.qr-sheet input, .qr-sheet textarea')].map((i) => String(i.value || ''))
    const hit = vals.find((v) => /^ZC-\\d{4}-\\d{2}-\\d{4}$/.test(v))
      || ((document.querySelector('.qr-sheet') || document.body).innerText.match(/ZC-\\d{4}-\\d{2}-\\d{4}/) || [''])[0]
    return hit || ''
  })()`)
  if (canWrite && (await statusOfPage()) !== '草稿') {
    const added = await ev(`(() => {
      const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '新增')
      if (!b) return false
      b.click(); return true
    })()`)
    await sleep(4000)
    createdForProbe = await noOfPage()
    console.log(`  (测试账套)探针自备草稿:${createdForProbe} 点新增=${added} 状态=${await statusOfPage()}`)
  }
  if (wantNo) {
    await ev(`(() => { const el=[...document.querySelectorAll('.approval-side .as-side-btn')].find(b=>/查询单据/.test(b.innerText)); el&&el.click(); return 1 })()`)
    await sleep(800)
    await ev(`(() => { const i=document.querySelector('.el-dialog input'); if(!i) return 0; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i, ${JSON.stringify(wantNo)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 1 })()`)
    await sleep(300)
    await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog .el-button--primary')].pop(); b&&b.click(); return 1 })()`)
    await sleep(3000)
  }

  // ── ① 抬头 + 表头结构 ──
  const probe = await ev(`(() => {
    const grid = document.querySelector('.qr-grid')
    if (!grid) return { err: 'no .qr-grid' }
    const clean = (s) => s.replace(/[\\s：:]/g, '')
    const rows = [...grid.querySelectorAll('thead tr')]
    return {
      headFields: [...document.querySelectorAll('.qr-head-table .qr-label')].map((th) => th.innerText.trim()),
      row1: rows[0] ? [...rows[0].children].map((th) => clean(th.innerText)) : [],
      row1colspans: rows[0] ? [...rows[0].children].map((th) => Number(th.getAttribute('colspan') || 1)) : [],
      row2: rows[1] ? [...rows[1].children].map((th) => th.innerText.trim()) : [],
      sectorHeaders: grid.querySelectorAll('th.c-group').length,
      oldColbar: !!document.querySelector('.qr-colbar'),
      bandText: (document.querySelector('.qr-band') || {}).innerText.replace(/\\s+/g, ' ').trim(),
      bodyRows: grid.querySelectorAll('tbody tr').length,
      rowDel: grid.querySelectorAll('tbody tr .qr-row-del').length,
      leftMerged: grid.querySelectorAll('tbody td.c-fixed[rowspan]').length,
      cellInputs: grid.querySelectorAll('tbody tr td.c-req input, tbody tr td.c-mtd input').length,
    }
  })()`)
  console.log(JSON.stringify(probe, null, 2))

  ok('抬头照旧在(单据要素没被动过)', probe.headFields.includes('单据编号') && probe.headFields.includes('检验类别'), probe.headFields.join(','))
  ok('左四列 = 客户名称/产品编码/型号（mm）/批号', ['客户名称', '产品编码', '型号（mm）', '批号'].every((t) => probe.row1.includes(t)), probe.row1.join(' | '))
  ok('第 5 格 = 检验人员(跨 2 列)', /检验人员/.test(probe.row1.join('|')) && probe.row1colspans.includes(2), JSON.stringify(probe.row1colspans))
  ok('右侧 = 产线常规功能性结果 + 结果判断', probe.row1.includes('产线常规功能性结果') && probe.row1.includes('结果判断'), probe.row1.join(' | '))
  ok('第二行 = 「检验要求」「检验方法」两个字段名(自动填充那句挪进 tooltip)',
    probe.row2.length === 2 && probe.row2[0] === '检验要求' && probe.row2[1] === '检验方法',
    probe.row2.join(' | '))
  const tips = await ev(`(() => {
    const ths = [...document.querySelectorAll('.qr-grid thead tr:nth-child(2) th.c-sub')]
    return ths.map((th) => th.getAttribute('title') || '')
  })()`)
  ok('两句「以下…自动填充出货检验计划表」仍在(tooltip)',
    /以下检验要求自动填充出货检验计划表/.test(tips[0] || '') && /以下检验方法自动填充出货检验计划表/.test(tips[1] || ''),
    tips.join(' | '))
  ok('不再有 表区 分组(无 c-group 组头,「不需要那些外观什么的」)', probe.sectorHeaders === 0)
  ok('顶部「列数」控件也不在(上一轮已撤)', probe.oldColbar === false)
  ok('左四列是纵向合并的单据级格(rowspan)', probe.leftMerged === 4, `rowspan 格 = ${probe.leftMerged}`)

  // ── 可编辑性判定(2026-10-17 补)──
  // 纸张表在**只读态**(非草稿)不渲染录入框,也不出「＋新增检验项 / ⧉带入检验项目」动作 ——
  // 用户把手上的草稿审掉之后,探针默认打开的可能就是只读单:此时可编辑断言没有意义,
  // 判失败只会变成噪声。故:结构断言照跑;可编辑断言只在有录入框时跑,否则打印 SKIP。
  // 要全量验可编辑行为,用测试账套跑:`YJ_PROBE_FACTORY=YJ_TEST node ...`(可写账套会自查/建草稿,结束自清)。
  const editable = await ev(`!!document.querySelector('.qr-grid tbody textarea, .qr-grid tbody input')`)
  const curStatus = await ev(`(() => { const s = document.querySelector('.as-side-status-row .doc-status'); return s ? s.innerText.trim() : '' })()`)
  if (!editable) {
    for (const nm of ['「＋新增检验项」加一行(且同时给出四个录入格)', '新增的行一加出来就是 3 行高',
      '「⧉带入检验项目」入口在', '删除有内容的行:弹确认', '取消后行还在', '确认后该行被删掉',
      '铺样例两行:四列都渲染出输入格且值在', '检验要求/检验方法 是多行域(一打开就 3 行高、随内容长高)']) {
      console.log(`SKIP ${nm} — 当前单据只读(状态=${curStatus}),无录入框`)
    }
    ok('只读态:表体格子是纯文本(没有录入框)', (await ev(`document.querySelectorAll('.qr-grid tbody input, .qr-grid tbody textarea').length`)) === 0, `状态=${curStatus}`)
    ok('只读态:不显示「＋新增检验项 / ⧉带入检验项目」动作', !/新增检验项/.test(probe.bandText), probe.bandText)
  } else {

  // ── ② ＋新增检验项 / 一行一个检验项目 ──
  const bodyState = () => ev(`(() => {
    const grid = document.querySelector('.qr-grid')
    const trs = [...grid.querySelectorAll('tbody tr')].filter((tr) => !tr.querySelector('.c-empty'))
    return {
      rows: trs.length,
      reqInputs: grid.querySelectorAll('tbody td.c-req input').length,
      funcInputs: grid.querySelectorAll('tbody td.c-func input').length,
      del: grid.querySelectorAll('tbody .qr-row-del').length,
    }
  })()`)
  const b0 = await bodyState()
  await ev(`(() => { const el=[...document.querySelectorAll('.qr-band-act2')].find((s)=>/新增检验项/.test(s.innerText)); el && el.click(); return 1 })()`)
  await sleep(500)
  const b1 = await bodyState()
  ok('「＋新增检验项」加一行(且同时给出四个录入格)',
    b1.rows === b0.rows + 1 && b1.funcInputs === b1.rows && b1.del === b1.rows,
    `${b0.rows} → ${b1.rows} 行;结果格 ${b1.funcInputs};删行按钮 ${b1.del}`)
  const newRowH = await ev(`(() => {
    const tr = [...document.querySelectorAll('.qr-grid tbody tr')].pop()
    const ta = tr.querySelector('td.c-mtd textarea')
    let h = 0
    if (ta) h = ta.offsetHeight
    else { const i = tr.querySelector('td.c-mtd input'); h = i ? i.offsetHeight : -1 }
    return { h, tag: ta ? 'textarea' : 'input/other', rowH: tr.offsetHeight }
  })()`)
  ok('新增的行**一加出来就是 3 行高**(口径「点击新增检验项就是3行高」)',
    newRowH.tag === 'textarea' && newRowH.h >= 40, `新行 检验方法 格高 ${newRowH.h}px(行高 ${newRowH.rowH})`)
  ok('「⧉带入检验项目」入口在', /带入检验项目/.test(probe.bandText), probe.bandText)

  // ── ③ 填内容 → 删行弹确认(⚠ 检验要求/检验方法 是多行域 textarea,赋值要挑对原型)──
  await ev(`(() => {
    const tr = document.querySelector('.qr-grid tbody tr:last-child')
    const el = tr && tr.querySelector('td.c-req textarea, td.c-req input')
    if (!el) return 0
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '探针-检验要求')
    el.dispatchEvent(new Event('input', { bubbles: true })); return 1
  })()`)
  await sleep(400)
  await ev(`(() => { const b=[...document.querySelectorAll('.qr-grid tbody .qr-row-del')].pop(); b && b.click(); return 1 })()`)
  await sleep(600)
  ok('删除有内容的行:弹确认', (await ev(`!!document.querySelector('.el-message-box')`)) === true)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box .el-button')].find(x=>/取消|Cancel/.test(x.innerText)); b && b.click(); return 1 })()`)
  await sleep(400)
  ok('取消后行还在', (await bodyState()).rows === b1.rows, `行数=${(await bodyState()).rows}`)
  await ev(`(() => { const b=[...document.querySelectorAll('.qr-grid tbody .qr-row-del')].pop(); b && b.click(); return 1 })()`)
  await sleep(500)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box .el-button')].find(x=>/确定|OK/.test(x.innerText)); b && b.click(); return 1 })()`)
  await sleep(500)
  ok('确认后该行被删掉', (await bodyState()).rows === b0.rows, `行数=${(await bodyState()).rows}(原 ${b0.rows})`)
  }

  // ── ④ 截图 + 英文态(第 5 个参数传 fill 时:先铺两行样例数据,便于人工核对"填满"的样子)──
  if (editable && process.argv[5] === 'fill') {
    const sample = [
      { 检验要求: '炭棒无断裂', 检验方法: '高度30cm，水泥地面垂直跌落3次，', 产线常规功能性结果: '无断裂', 结果判断: '合格' },
      { 检验要求: '初始流速大于11.0L/min', 检验方法: '将炭棒组装好装入滤瓶（20寸滤瓶），水流方向外进内出，在0.2 MPa静态压力下，', 产线常规功能性结果: '12.3L/min', 结果判断: '合格' },
    ]
    await ev(`(() => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const clickAdd = () => { const el=[...document.querySelectorAll('.qr-band-act2')].find((s)=>/新增检验项/.test(s.innerText)); el && el.click() }
      return 1
    })()`)
    for (const s of sample) {
      await ev(`(() => { const el=[...document.querySelectorAll('.qr-band-act2')].find((x)=>/新增检验项/.test(x.innerText)); el && el.click(); return 1 })()`)
      await sleep(300)
      await ev(`(() => {
        const tr = [...document.querySelectorAll('.qr-grid tbody tr')].pop()
        const put = (cls, v) => {
          const el = tr.querySelector('td.' + cls + ' textarea, td.' + cls + ' input')
          if (!el) return
          const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        put('c-req', ${JSON.stringify(s['检验要求'])})
        put('c-mtd', ${JSON.stringify(s['检验方法'])})
        put('c-func', ${JSON.stringify(s['产线常规功能性结果'])})
        put('c-verdict', ${JSON.stringify(s['结果判断'])})
        return 1
      })()`)
      await sleep(300)
    }
    const filled = await ev(`(() => {
      const trs = [...document.querySelectorAll('.qr-grid tbody tr')]
      return trs.map((tr) => ['c-req', 'c-mtd', 'c-func', 'c-verdict'].map((c) => {
        const el = tr.querySelector('td.' + c + ' textarea, td.' + c + ' input')
        return el ? el.value : ''
      }))
    })()`)
    console.log('FILLED:', JSON.stringify(filled))
    ok('铺样例两行:四列都渲染出输入格且值在', filled.length >= 2 && filled.slice(-2).every((r) => r[0] && r[3]),
      JSON.stringify(filled.slice(-2)))
  }
  // ── ⑤ 长文本格自动长高 + Excel 导出(2026-10-17 第七轮口径)──
  if (editable) {
  await ev(`(() => { const el=[...document.querySelectorAll('.qr-band-act2')].find((x)=>/新增检验项/.test(x.innerText)); el && el.click(); return 1 })()`)
  await sleep(400)
  const grew = await ev(`(() => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    const tr = [...document.querySelectorAll('.qr-grid tbody tr')].pop()
    const ta = tr.querySelector('td.c-mtd textarea')
    if (!ta) return { err: 'no textarea in c-mtd' }
    const h0 = ta.offsetHeight
    const long = '1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分，称量各目数占比并记录；'.repeat(4)
    set.call(ta, long); ta.dispatchEvent(new Event('input', { bubbles: true }))
    return { h0, first: ta.offsetHeight, rows: tr.querySelectorAll('td.c-mtd textarea').length, len: long.length }
  })()`)
  await sleep(500)
  const grew2 = await ev(`(() => {
    const tr = [...document.querySelectorAll('.qr-grid tbody tr')].pop()
    const ta = tr.querySelector('td.c-mtd textarea')
    return { h: ta ? ta.offsetHeight : -1, rowH: tr.offsetHeight }
  })()`)
  ok('检验要求/检验方法 是多行域:一打开就有 3 行高、且随内容继续长高不截断', !grew.err && grew.rows === 1 && grew.h0 >= 40 && grew2.h > grew.h0 + 10,
    `初始高度 ${grew.h0}(≥40 才算"一开始就变大") → 输入 ${grew.len} 字后 ${grew2.h}(行高 ${grew2.rowH})`)
  } else if (!editable) {
    console.log('SKIP 检验要求/检验方法 是多行域(长高) — 只读态无录入框')
  }

  const dl = path.join(os.tmpdir(), 'proc-insp-xlsx-' + Date.now())
  fs.mkdirSync(dl, { recursive: true })
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl })
  const exp = await ev(`(async () => {
    const el = document.querySelector('.qr-sheet')
    const inst = el && el.__vueParentComponent
    const fn = inst && inst.exposed && inst.exposed.exportProcInspExcel
    if (typeof fn !== 'function') return { ok: false, why: 'not exposed' }
    await fn()
    return { ok: true }
  })()`)
  await sleep(2500)
  const files = fs.existsSync(dl) ? fs.readdirSync(dl) : []
  ok('「文档输出 → 导出 Excel」路由到纸面导出(defineExpose 在)', exp.ok === true, JSON.stringify(exp))
  ok('导出真的产出 .xlsx 文件', files.some((f) => /\.xlsx$/i.test(f)), files.join(', ') || '(无文件)')

  // ── ⑥ 侧栏「审核 / 弃审」按钮(2026-10-17 用户口径「为当前制程检验单增加审核」)──
  // ⚠ 只读断言:这里**绝不点审核**(当前页面连的是正式账套,点了就是真业务动作);
  //   审核动作的落库往返在测试账套上用 _api-proc-audit.mjs 验。
  const side = await ev(`(() => {
    const btns = [...document.querySelectorAll('.as-side-btn')].map((b) => (b.innerText || '').trim())
    const find = (t) => [...document.querySelectorAll('.as-side-btn')].find((b) => (b.innerText || '').trim() === t)
    const a = find('审核'), u = find('弃审')
    const st = document.querySelector('.as-side-status-row .doc-status')
    return {
      btns,
      hasAudit: !!a, hasUnaudit: !!u,
      auditDisabled: a ? a.classList.contains('disabled') : null,
      unauditDisabled: u ? u.classList.contains('disabled') : null,
      status: st ? (st.innerText || '').trim() : '',
    }
  })()`)
  ok('侧栏有「审核」直审入口(制程检验单)', side.hasAudit, side.btns.join(' / ').slice(0, 160))
  ok('侧栏有「弃审」入口', side.hasUnaudit)
  // ── ⑦ 审核记录:侧栏「审批情况」入口 + 弹窗(2026-10-17:直审也写 yj_form_approval)──
  ok('侧栏有「审批情况」(审核记录)入口', side.btns.includes('审批情况'), side.btns.join(' / ').slice(0, 160))
  await ev(`(() => {
    const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '审批情况')
    if (b) b.click(); return !!b
  })()`)
  await sleep(1800)
  const trail = await ev(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => /审批情况/.test(d.innerText || ''))
    if (!dlg) return { open: false }
    const rows = [...dlg.querySelectorAll('.el-table__body tr')].map((tr) => (tr.innerText || '').replace(/\\s+/g, ' ').trim())
    const empty = /暂无审批记录/.test(dlg.innerText || '')
    return { open: true, rows, empty }
  })()`)
  ok('「审批情况」弹窗能打开', trail.open === true, JSON.stringify(trail).slice(0, 200))
  if (trail.open && side.status === '已审核') {
    ok('已审核单据看得到审核记录(不是「暂无审批记录」)', !trail.empty && trail.rows.length >= 1,
      `记录 ${trail.rows.length} 条:${(trail.rows[0] || '').slice(0, 80)}`)
  } else if (trail.open) {
    console.log(`  (当前单据状态=${side.status},审批记录 ${trail.rows.length} 条,不断言条数)`)
  }
  await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog .el-button')].find(x=>/关闭/.test(x.innerText)); b && b.click(); return 1 })()`)
  await sleep(400)
  // 只在真有状态可比时判(列表为空/没选中单据时状态是「—」,两个按钮都置灰,不是缺陷)
  if (['草稿', '已审核'].includes(side.status)) {
    const draft = side.status === '草稿'
    ok('按钮置灰与单据状态一致(草稿才可审、已审核才可弃审)',
      side.auditDisabled !== draft && side.unauditDisabled !== !draft,
      `状态=${side.status} 审核置灰=${side.auditDisabled} 弃审置灰=${side.unauditDisabled}`)
  }

  for (const locale of ['zh-CN', 'en']) {
    if (locale !== 'zh-CN') {
      await ev(`(async()=>{const app=document.querySelector('#app').__vue_app__;await app.config.globalProperties.$pinia._s.get('locale').set(${JSON.stringify(locale)})})()`)
      await sleep(1500)
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const out = `tools/archive/_qc-proc/_proc-cols-${locale}.png`
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log(`shot -> ${out}`)
  }
  const enProbe = await ev(`(() => {
    const rows = [...document.querySelectorAll('.qr-grid thead tr')]
    return {
      row1: rows[0] ? [...rows[0].children].map((th) => th.innerText.trim()) : [],
      row2: rows[1] ? [...rows[1].children].map((th) => th.innerText.trim()) : [],
    }
  })()`)
  console.log('EN:', JSON.stringify(enProbe))
  ok('英文态:表头两句说明走 tt()(不再是中文)',
    enProbe.row2.every((t) => !/以下检验/.test(t)), enProbe.row2.join(' | '))
} catch (e) {
  console.log('PROBE ERROR: ' + (e?.stack || e))
  fail.push('probe-error')
} finally {
  // 测试账套里自备的草稿要清掉(弃审 → 删除,走业务动作;正式账套永远不会走到这儿)
  if (createdForProbe) {
    const api = base.replace(/:\d+$/, ':8090') + '/api'
    for (const buttonName of ['弃审', '删除']) {
      try {
        await fetch(`${api}/px/callButton`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ panelCode: panel, buttonName, formData: { 编号: createdForProbe }, buttonParam: {} }),
        })
      } catch { /* 清理失败不判失败 */ }
    }
    console.log(`  已清理探针自备草稿 ${createdForProbe}`)
  }
  ws?.close()
  edge.kill()
}
console.log(fail.length ? `\n=== 探针失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 探针全部通过 ===')
process.exit(fail.length ? 1 : 0)
