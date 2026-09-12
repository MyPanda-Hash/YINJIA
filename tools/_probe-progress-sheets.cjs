// _probe-progress-sheets.cjs — 项目进度查询·项目编号链接查数据记录表 验收:
//   ① API:未知编号 → 空清单
//   ② 造数:立项申请(DSPROBE-x) + 实施计划(归档,同步进度行) + 功能性滤效&碱性两张数据记录表(归档,同文档编号)
//   ③ API:dataSheets 返回 ≥2 行(含两面板、状态已归档)
//   ④ UI:进度页点该行项目编号 📄 → 弹窗列出两单;点首行 → 跳对应面板且定位到目标单据(focus)
//   ⑤ 清理
// 用法: node tools/_probe-progress-sheets.cjs [BASE]
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9382
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const btn = (panelCode, buttonName, formData) => api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) })
  const MARK = 'DSPROBE-' + Date.now().toString().slice(-6)

  // ① 未知编号 → 空
  const empty = await api(`/api/px/progress/dataSheets?code=${encodeURIComponent('NO-SUCH-' + MARK)}`)
  ok((empty?.data || []).length === 0, `① 未知编号返回空(${(empty?.data || []).length})`)

  // ② 造数
  const appr = await btn('RD_APPROVAL', '保存', { 文档编号: MARK, 申请立项人: '系统管理员' })
  const apprNo = appr?.data?.['编号']
  // 进度单单据(若库里没有)
  const progRows = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROGRESS', pageNo: 1, pageSize: 5 }) })
  if (!(((progRows.data?.rows) || progRows.data?.list || []).length)) await btn('RD_PROGRESS', '保存', {})
  // 实施计划(directAdd+二存归档;归档同步进度行,说明=文档编号)
  const planDraft = await btn('RD_PLAN', '保存', {})
  const planNo = planDraft?.data?.['编号']
  const planSave = await btn('RD_PLAN', '保存', { 编号: planNo, 文档编号: MARK, 项目名称: '进度链接探针' + MARK, 阶段1_计划内容: '阶段一' })
  ok(planSave?.data?.['单据状态'] === '已归档', `②-1 实施计划归档(${planSave?.data?.['单据状态']})`)
  // 两张数据记录表(同文档编号,不同测试主题便于区分就地渲染内容)
  const mkSheet = async (pc, topic) => {
    const d = await btn(pc, '保存', {})
    const no = d?.data?.['编号']
    const s = await btn(pc, '保存', { 编号: no, 文档编号: MARK, 测试主题: topic })
    return { no, st: s?.data?.['单据状态'] }
  }
  const eff = await mkSheet('RD_FILTER_EFF', '链接探针功能F')
  const alk = await mkSheet('RD_ALKALINE', '链接探针碱性A')
  ok(eff.st === '已归档' && alk.st === '已归档', `②-2 两张数据记录表归档(${eff.no}/${alk.no})`)

  // ③ API 聚合
  const sheets = await api(`/api/px/progress/dataSheets?code=${encodeURIComponent(MARK)}`)
  const rows = sheets?.data || []
  ok(rows.length === 2, `③-1 聚合 2 行(=${rows.length})`)
  ok(rows.some((r) => r.panelCode === 'RD_FILTER_EFF' && r.docNo === eff.no && r.status === '已归档')
    && rows.some((r) => r.panelCode === 'RD_ALKALINE' && r.docNo === alk.no), `③-2 两面板/单号/状态齐(${rows.map((r) => r.panelCode + ':' + r.docNo).join(', ')})`)

  // ④ UI
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pd-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errs = []
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error')
        errs.push((m.params.args || []).map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 150))
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROGRESS`)
    await sleep(2600)
    // 找到 说明=MARK 的行的 📄 链接并点击
    const clicked = await ev(`(function(){var trs=[].slice.call(document.querySelectorAll('.ps-table tbody tr'));
      for(var i=0;i<trs.length;i++){if((trs[i].textContent||'').indexOf(${JSON.stringify(MARK)})>=0){
        var lk=trs[i].querySelector('.ps-code-link');if(lk){lk.click();return 1}}}return 0})()`)
    ok(clicked === 1, '④-1 找到该行项目编号链接并点击')
    await sleep(1800)
    // 弹窗:切换条列出两单 + 首张(功能性)就地只读渲染(纸张+主题文本)
    const dlgState = await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];if(!d)return JSON.stringify({dlg:0});
      var pills=[].slice.call(d.querySelectorAll('.ds-pill')).map(function(p){return (p.textContent||'').trim()});
      var paper=!!d.querySelector('.record-sheet');
      var txt=(d.querySelector('.ds-doc-wrap')||{}).textContent||'';
      return JSON.stringify({dlg:1,pills:pills,paper:paper,hasF:txt.indexOf('链接探针功能F')>=0,hasA:txt.indexOf('链接探针碱性A')>=0,docno:(d.querySelector('.rs-docno')||{textContent:''}).textContent.trim()})})()`)
    const ds = JSON.parse(dlgState || '{}')
    ok(ds.dlg === 1, '④-2 弹窗打开')
    ok((ds.pills || []).length === 2 && (ds.pills || []).some((p) => p.includes(eff.no)) && (ds.pills || []).some((p) => p.includes(alk.no)), `④-3 切换条列两单(${JSON.stringify(ds.pills)})`)
    ok(ds.paper === true && ds.hasF === true && String(ds.docno).includes(MARK), `④-4 首张(功能性)就地渲染(纸张=${ds.paper}, 主题F=${ds.hasF}, 编号=${String(ds.docno).slice(0, 20)})`)
    // 切到第二张(碱性) → 内容变为碱性纸张
    await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var pills=[].slice.call(d.querySelectorAll('.ds-pill'));
      for(var i=0;i<pills.length;i++){if((pills[i].textContent||'').indexOf(${JSON.stringify(alk.no)})>=0){pills[i].click();return 1}}return 0})()`)
    await sleep(1500)
    const afterSwitch = await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var txt=(d.querySelector('.ds-doc-wrap')||{}).textContent||'';
      return JSON.stringify({hasA:txt.indexOf('链接探针碱性A')>=0,hasF:txt.indexOf('链接探针功能F')>=0})})()`)
    const sw = JSON.parse(afterSwitch || '{}')
    ok(sw.hasA === true && sw.hasF !== true, `④-5 切换后渲染碱性单(碱性=${sw.hasA}, 功能=${sw.hasF})`)
    const hash = await ev('location.hash')
    ok(String(hash).includes('RD_PROGRESS'), `④-6 未跳转离开进度页(hash=${hash})`)
    ok(errs.length === 0, `④-7 无 console 错误(${errs.length ? errs[0] : ''})`)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }

  // ⑤ 清理
  const d1 = await btn('RD_FILTER_EFF', '删除', { 编号: eff.no })
  const d2 = await btn('RD_ALKALINE', '删除', { 编号: alk.no })
  const d3 = await btn('RD_PLAN', '删除', { 编号: planNo })
  const d4 = await btn('RD_APPROVAL', '删除', { 编号: apprNo })
  ok(d1.code === 200 && d2.code === 200 && d3.code === 200 && d4.code === 200, '⑤ 测试单清理(进度行残留由 _cleanup-progress-sheets.sql 清)')

  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
