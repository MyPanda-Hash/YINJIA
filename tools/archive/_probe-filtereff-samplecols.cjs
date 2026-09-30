'use strict'
/**
 * _probe-filtereff-samplecols.cjs — 功能性滤效「样品配方 列数跟样品信息同步」验证探针(2026-09-30)
 *
 * 用法:node tools/archive/_probe-filtereff-samplecols.cjs [http://localhost:5173]
 *   ⚠ 界面层必须打前端热更实例 5173(8090 供打包产物,源码改动不经 build 不进去)
 *
 * 四层断言:
 *   ① 配置层:yj_field 已登记 样品配方1..6(与 样品信息N / 测试装置及编号N 同列数上限)
 *   ② 界面层:**三行的格数恒等于 样品数**(样品信息 / 测试装置及编号 / 样品配方)——
 *             这正是用户报的那条:样品配方 原来是"一格跨全部样品列"
 *   ③ 交互层:点 ＋/－ 改样品数 → 三行格数跟着变;减列确认后该列数据被清空
 *   ④ 数据层:减列清空**含 样品配方N**(回读库中值;旧实现漏的正是这一个)
 *
 * ⚠ 造/改都在**测试账套**(factory='test' → HSDZ_MES_TEST):正式库只录真实业务。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9363
const PANEL = 'RD_FILTER_EFF'
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null

async function api(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'test' } })
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败: ' + JSON.stringify(lr).slice(0, 300))
  const call = async (buttonName, formData) => api('/api/px/callButton', { method: 'POST', token, body: { panelCode: PANEL, buttonName, formData, buttonParam: {} } })

  console.log('\n① 配置层:样品配方1..6 已登记(与 样品信息N 同口径)')
  const cfg = await api(`/api/px/getPanelConfig?panelCode=${PANEL}`, { token })
  const names = (cfg?.data?.dataSchema?.fields || []).map((f) => f.dataName || f.code)
  for (const n of [1, 2, 3, 4, 5, 6]) {
    check(`样品配方${n} 已下发`, names.includes(`样品配方${n}`))
  }
  check('样品信息1..6 仍在(对照)', [1, 2, 3, 4, 5, 6].every((n) => names.includes(`样品信息${n}`)))

  // ── 造一张草稿:样品数=3,三行都填值(含明细行),供界面与减列断言 ──
  console.log('\n② 造草稿(测试账套,3 个样品列都已填值)')
  const created = await call('新增', {})
  const no = created?.data?.['编号']
  if (!no) throw new Error('新增失败: ' + JSON.stringify(created).slice(0, 300))
  const items = []
  for (let n = 1; n <= 3; n++) {
    items.push({ 冲水时间: `探针${n}`, [`压力（PSI)样品${n}`]: `13${n}`, [`流速（L/min)样品${n}`]: '1.9', [`出水含量（ug/L）样品${n}`]: `1${n}`, [`去除率%样品${n}`]: '96' })
  }
  const draft = await call('保存为草稿', {
    编号: no, 样品数: '3',
    样品信息1: '探针-样品信息1', 样品信息2: '探针-样品信息2', 样品信息3: '探针-样品信息3',
    测试装置及编号1: '探针-装置1', 测试装置及编号2: '探针-装置2', 测试装置及编号3: '探针-装置3',
    样品配方1: '探针-配方1', 样品配方2: '探针-配方2', 样品配方3: '探针-配方3',
    detail: { items },
  })
  check(`草稿已保存(${no},状态 ${draft?.data?.['单据状态']})`, /草稿|已归档/.test(String(draft?.data?.['单据状态'] || '')), JSON.stringify(draft).slice(0, 200))

  // ── 界面层 ──
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fe-samples-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1900, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/${PANEL}?focus=${encodeURIComponent(no)}`)
    await sleep(2500)

    console.log('\n③ 界面层:三行的格数 = 样品数')
    /** 1.基本信息 里某标签行的**数据格数**(去掉行首标签格) */
    const rowCells = async (label) => ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('table.rs-t tr'));
      for (var i=0;i<rows.length;i++){
        var lb=rows[i].querySelector('td.rs-label');
        if (lb && lb.textContent.trim()===${JSON.stringify(label)}) return rows[i].querySelectorAll('td,th').length-1;
      }
      return -1;
    })()`)
    const n0 = await rowCells('样品信息')
    const dev0 = await rowCells('测试装置及编号')
    const f0 = await rowCells('样品配方')
    check(`样品信息 ${n0} 格(草稿 样品数=3)`, n0 === 3, String(n0))
    check(`测试装置及编号 ${dev0} 格`, dev0 === 3, String(dev0))
    check(`样品配方 ${f0} 格 = 样品信息 的格数(本次修复点)`, f0 === n0 && f0 === 3, `配方=${f0} 信息=${n0}`)
    const ctl = await ev(`(function(){ var n=document.querySelector('.rs-sample-num'); return n? n.textContent.trim() : 'NONE' })()`)
    check('样品列计数器显示 3', String(ctl) === '3', String(ctl))
    await shot('filtereff-samples-3cols.png')

    console.log('\n④ 交互层:＋ 加列 → 样品配方 跟着分裂;－ 减列 → 该列数据被清空')
    const clickSampleBtn = async (title) => ev(`(function(){
      var bs=[].slice.call(document.querySelectorAll('.rs-sample-btn'));
      for (var i=0;i<bs.length;i++){ if ((bs[i].getAttribute('title')||'').indexOf(${JSON.stringify(title)})>=0) { bs[i].click(); return 'CLICKED' } }
      return 'NO_BTN';
    })()`)
    await clickSampleBtn('增加样品列')
    await sleep(1200)
    const n4 = await rowCells('样品信息'); const f4 = await rowCells('样品配方')
    check(`加列后 样品信息=4 / 样品配方=4`, n4 === 4 && f4 === 4, `信息=${n4} 配方=${f4}`)
    await shot('filtereff-samples-4cols.png')

    // 触发一次清空:把 样品配方4 先填上,再减列
    await ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('table.rs-t tr'));
      for (var i=0;i<rows.length;i++){
        var lb=rows[i].querySelector('td.rs-label');
        if (lb && lb.textContent.trim()==='样品配方'){
          var ta=rows[i].querySelectorAll('td')[4].querySelector('textarea, input');
          if (ta){ var setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
            setter.call(ta,'探针-配方4'); ta.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' }
        }
      }
      return 'NO_CELL';
    })()`)
    await sleep(600)
    await clickSampleBtn('减少样品列')
    await sleep(800)
    // 确认弹窗:点「确定」
    const confirmed = await ev(`(function(){
      var bs=[].slice.call(document.querySelectorAll('.el-message-box__btns button'));
      for (var i=0;i<bs.length;i++){ if ((bs[i].textContent||'').trim()==='确定'){ bs[i].click(); return 'OK' } }
      return 'NO_CONFIRM';
    })()`)
    check('减列弹了确认框并点了确定', confirmed === 'OK', confirmed)
    await sleep(1500)
    const n3 = await rowCells('样品信息'); const f3 = await rowCells('样品配方')
    check(`减列后 样品信息=3 / 样品配方=3`, n3 === 3 && f3 === 3, `信息=${n3} 配方=${f3}`)

    // 界面点保存(把「减列清空」落库),再回读
    const saved = await ev(`(function(){
      var bs=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for (var i=0;i<bs.length;i++){ if (bs[i].offsetParent && (bs[i].textContent||'').trim()==='保存'){ bs[i].click(); return 'CLICKED' } }
      return 'NO_SAVE';
    })()`)
    check('界面上点了「保存」', saved === 'CLICKED', saved)
    await sleep(4000)

    console.log('\n⑤ 数据层:减列清空含 样品配方4(旧实现漏的正是这一个)')
    const list = await api('/api/px/queryFormDataList', { method: 'POST', token, body: { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 200 } })
    const row = (list?.data?.list || []).find((r) => (r['单据编号'] || r['编号']) === no) || {}
    check('样品数 回写成 3', String(row['样品数'] || '') === '3', String(row['样品数']))
    check('样品配方4 已清空', !String(row['样品配方4'] || '').trim(), JSON.stringify(row['样品配方4']))
    check('样品信息4 已清空(对照组)', !String(row['样品信息4'] || '').trim(), JSON.stringify(row['样品信息4']))
    check('样品配方1..3 的数据**没被动**(减列只清被减的那一列)',
      ['探针-配方1', '探针-配方2', '探针-配方3'].every((v, i) => String(row[`样品配方${i + 1}`] || '') === v),
      JSON.stringify([row['样品配方1'], row['样品配方2'], row['样品配方3']]))
    const it4 = (row.detail?.items || []).map((it) => String(it['压力（PSI)样品4'] || '')).join('')
    check('明细行 压力（PSI)样品4 已清空', it4 === '', JSON.stringify(it4))
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常: ' + (e && e.stack ? e.stack : e)); process.exit(2) })
