'use strict'
/**
 * _probe-insp-spec-carry.cjs — 出货检验计划表「检验方法按规格书自动填充」+ **规格书必须审批完**的门禁
 *
 * 用户口径(2026-09-21):
 *   「出货检验计划表检验方法按规格书自动填充/带入,避免重复选择。
 *     必须得规格书已经填写提交审批完才可以在选择产品编码时自动填充带入。」
 *
 * 探针按真实路径走:
 *   ① 造数:产品信息 + 规格书(草稿,带 3 行「检验要求」明细),按分发口径给 head.编号 盖产品编号章;
 *   ② 计划表新增 → 选产品编号 → **此刻规格书还是草稿** ⇒ 必须**不带入**,并明确告知原因(这是本次要修的点);
 *   ③ 规格书 提交审批 → 审批通过(已归档) → 回到计划表重选产品编号 ⇒ 表头三格 + 表体四列按规格书带入;
 *   ④ 按精确单号清理,残留 0。
 *
 * 用法:node _probe-insp-spec-carry.cjs [http://localhost:8090]
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:8090'
const PLAN = 'RD_INSP_PLAN'
const SPEC = 'RD_SPEC_DOC'
const PROD = 'RD_PROD_INFO'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9345
const SHOTS = path.join(__dirname, '_shots')

const PROD_CODE = 'ZZ-E2E-INSP'
const PROD_NAME = '探针出货检验产品'
const SPEC_NAME = 'CHKSPEC-出货检验带出'
const SPEC_HEAD = { 客户项目名称: '探针项目-INSP', 产品类别: '成品', 整体规格参数: 'Φ59.5×120' }
const SPEC_ROWS = [
  { 表区: '检验要求', 序号: '1', 检验项目: '外观', 检验要求: '无黑点、无杂质', 检验方法: '目视检查' },
  { 表区: '检验要求', 序号: '2', 检验项目: '压降', 检验要求: '≤5 kPa', 检验方法: '压降试验台' },
  { 表区: '检验要求', 序号: '3', 检验项目: '抗压强度', 检验要求: '≥12 kgf', 检验方法: '万能试验机' },
]

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SQL = (q) => {
  try {
    return execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
      '-I', '-f', '65001', '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8' })
  } catch (e) { return '<<SQL-ERR ' + (e.stdout || e.message) + '>>' }
}

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const call = async (panel, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam: {} }),
  })).json())
  const list = async (panel, condition) => {
    const r = (await (await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, condition: condition || {}, pageNo: 1, pageSize: 10 }),
    })).json())
    const d = r?.data
    return Array.isArray(d) ? d : (d?.list || d?.rows || [])
  }

  /* ① 造数:产品 + 规格书(草稿) + 盖产品编号章 */
  const pc = await call(PROD, '保存为草稿', { 产品编号: PROD_CODE, 产品名称: PROD_NAME, 产品形态: '圆柱', 产品管控等级: 'B' })
  const prodNo = pc?.data?.['编号'] || ''
  if (!prodNo) throw new Error('产品建失败:' + JSON.stringify(pc))
  const sc = await call(SPEC, '保存为草稿', { 名称: SPEC_NAME, 规格书种类: '飞利浦沐浴阻垢滤芯', ...SPEC_HEAD, detail: { items: SPEC_ROWS } })
  const specNo = sc?.data?.['编号'] || ''
  if (!specNo) throw new Error('规格书建失败:' + JSON.stringify(sc))
  // 产品↔规格书的绑定正常由「规格书分发」盖章(specAssign);探针直接写库模拟,免去两级审核与分配人
  SQL(`UPDATE rd_spec_doc_head SET 编号=N'${PROD_CODE}' WHERE 单据编号='${specNo}';`)
  console.log(`  --   造数:产品 ${prodNo}(${PROD_CODE}) / 规格书 ${specNo}(草稿,3 行检验要求,已盖产品编号章)`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-spec-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1600', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  let planNo = ''
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const specCalls = []      // /px/specByProduct 的响应(证"服务端怎么回的")
    ws.on('message', (d) => {
      let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.responseReceived' && /specByProduct/.test(m.params.response.url)) {
        specCalls.push({ id: m.params.requestId, status: m.params.response.status, body: '' })
      }
      if (m.method === 'Network.loadingFinished') {
        const hit = specCalls.filter((c) => c.id === m.params.requestId)[0]
        if (hit && !hit.body) send('Network.getResponseBody', { requestId: m.params.requestId }).then((rr) => { hit.body = String(rr?.result?.body || '').slice(0, 400) })
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `insp-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1600, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/${PLAN}`)
    await sleep(2500)

    const KIT = `
      window.__vis = function(){ return [].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(t){return t.offsetParent}) };
      window.__labelTd = function(label, ci){ var tds=[].slice.call(document.querySelectorAll('.record-sheet td')).filter(function(td){
        return td.offsetParent && (td.innerText||'').trim()===label }); return tds.length ? tds[ci||0] : null };
      window.__ctls = function(tr){ var out=[]
        ;[].slice.call(tr.children).forEach(function(td, i){
          var el = td.querySelector('.rs-ref-ctl') || td.querySelector('.el-select__wrapper') || td.querySelector('textarea') || td.querySelector('input:not([type=hidden])')
          if (el) out.push({ i:i, kind: el.classList.contains('rs-ref-ctl') ? 'ref' : (el.classList.contains('el-select__wrapper') ? 'select' : (el.tagName==='TEXTAREA' ? 'area' : 'input')), el:el }) })
        return out };
      window.__read = function(c){ if(!c) return null; var el=c.el
        if (c.kind==='ref'){ var t=el.querySelector('.rs-ref-text'); return t ? t.textContent.trim() : '' }
        if (c.kind==='select'){ return (el.innerText||'').replace(/\\s+/g,' ').trim() }
        return el.value };
      window.__pair = function(label){ var td=window.__labelTd(label); if(!td) return null
        var tr=td.parentElement, idx=[].indexOf.call(tr.children, td)
        if (window.__ctls(tr).length===0){ var nx=tr.nextElementSibling; while(nx && !nx.offsetParent) nx=nx.nextElementSibling
          var cs = nx ? window.__ctls(nx) : []; return cs.length ? cs[0] : null }
        return window.__ctls(tr).filter(function(c){ return c.i>idx })[0] || null };
      window.__get = function(label){ return window.__read(window.__pair(label)) };
      window.__docNo = function(){ var td=document.querySelector('.record-sheet td.rs-docno'); return td ? (td.innerText||'').replace(/编号：/,'').trim() : 'NO_CELL' };
      window.__clickVisible = function(sel, text){ var all=[].slice.call(document.querySelectorAll(sel))
        for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (!text || (all[i].textContent||'').trim()===text)){ all[i].click(); return 'CLICKED' } } return 'NO_EL' };
      window.__gridTrs = function(){ var hdr=[].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(tr){
          return tr.offsetParent && (tr.innerText||'').indexOf('检验项目')>=0 && tr.querySelector('th') })[0]
        if(!hdr) return []
        var out=[], n=hdr.nextElementSibling
        while(n && !n.querySelector('th')){ if(n.offsetParent && !n.querySelector('td.rs-empty') && (n.children[0] ? (n.children[0].innerText||'').trim() !== '合计' : false)) out.push(n); n=n.nextElementSibling }
        return out };
      window.__cols = function(){ var hdr=[].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(tr){
          return tr.offsetParent && (tr.innerText||'').indexOf('检验项目')>=0 && tr.querySelector('th') })[0]
        if(!hdr) return []
        return [].slice.call(hdr.querySelectorAll('th')).map(function(t){ return (t.innerText||'').replace(/\\s+/g,'').trim() }) };
      window.__cellText = function(td){ var i=td.querySelector('input,textarea'); if(i && i.value!==undefined && i.value!=='') return i.value
        var t=(td.innerText||'').trim(); return t };
      window.__gridRows = function(){ return window.__gridTrs().map(function(tr){ return [].slice.call(tr.children).map(function(td){ return window.__cellText(td) }) }) };
      window.__gridGet = function(colName){ var cols=window.__cols(); var ci=-1
        for (var i=0;i<cols.length;i++){ if(cols[i].indexOf(colName)>=0){ ci=i; break } }
        if(ci<0) return 'NO_COL:'+JSON.stringify(cols)
        return window.__gridTrs().map(function(tr){ return window.__cellText(tr.children[ci] || document.createElement('td')) }) };
      'KIT-OK'`
    if (await ev(KIT) !== 'KIT-OK') throw new Error('注入工具失败')

    const clickSide = (t) => ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()===${JSON.stringify(t)}){ all[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)
    const msgText = () => ev(`(function(){ var m=[].slice.call(document.querySelectorAll('.el-message,.el-message-box'))
      .filter(function(x){ var r=x.getBoundingClientRect(); return r.height>0 && r.width>0 })
      return m.map(function(x){return (x.innerText||'').replace(/\\n/g,' ').trim()}).join(' ‖ ') })()`)
    const waitFor = async (expr, ms = 12000, every = 400) => {
      const t0 = Date.now(); let v
      while (Date.now() - t0 < ms) { v = await ev(expr); if (v) return v; await sleep(every) }
      return v
    }
    /** 选产品编号:点参照 → 勾行 → 确定。⚠ 没勾上时"确定"是禁用的,不校验就会"点了没反应",
     *  于是把"这次没选上"误记成"没自动带入"。确认后校验格子值,没落上就重试(最多 3 次)。 */
    const pickProduct = async () => {
      let last = {}
      for (let attempt = 1; attempt <= 3; attempt++) {
        const opened = await ev(`(function(){ var c=window.__pair('产品编号'); if(!c) return 'NO_PAIR'
          if(c.kind!=='ref') return 'NOT_REF:'+c.kind; c.el.click(); return 'OPENED' })()`)
        await waitFor(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
          return d ? 'OPEN' : '' })()`, 8000)
        const picked = await ev(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
          if(!d) return 'NO_DIALOG'
          var rows=[].slice.call(d.querySelectorAll('.el-table__body tbody tr'))
          var hit=rows.filter(function(r){ return (r.innerText||'').indexOf(${JSON.stringify(PROD_CODE)})>=0 })[0] || rows[0]
          if(!hit) return 'NO_ROW'
          var cb=hit.querySelector('.el-checkbox__inner')
          var box=hit.querySelector('.el-checkbox')
          var already = box && box.classList.contains('is-checked')   // 已选中时再点=取消(重选场景会反勾)
          if(cb && !already){ cb.click(); return 'CHECKED' }
          if(already) return 'ALREADY'
          hit.click(); return 'ROWCLICK' })()`)
        await sleep(700)
        const confirmState = await ev(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
          if(!d) return 'NO_DIALOG'; var f=d.querySelector('.el-dialog__footer .el-button--primary')
          if(!f) return 'NO_BTN'; return (f.disabled || f.classList.contains('is-disabled')) ? 'DISABLED' : 'ENABLED' })()`)
        const clicked = await ev(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
          if(!d) return 'NO_DIALOG'; var f=d.querySelector('.el-dialog__footer .el-button--primary'); if(f && !f.disabled){ f.click(); return 'OK' }
          var bs=[].slice.call(d.querySelectorAll('button')).filter(function(b){return !b.disabled && /确\\s*定|确认/.test(b.textContent||'')})
          if(bs.length){ bs[bs.length-1].click(); return 'OK2' } return 'NO_BTN' })()`)
        // ⚠ 提示条是 position:fixed 且约 3s 就消失:必须**点完立刻**抓,晚了(等弹窗/替换确认)就抓不到
        await sleep(700)
        const toast = await msgText()
        const closed = await waitFor(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop(); return d ? '' : 'CLOSED' })()`, 6000)
        const hasConfirm = await ev(`(function(){ return [].slice.call(document.querySelectorAll('.el-message-box')).some(function(b){
          return b.getBoundingClientRect().height>0 && /替换|取消/.test(b.innerText||'') }) })()`)
        if (hasConfirm) { await ev(`window.__clickVisible('.el-message-box__btns .el-button--primary')`); await sleep(1200) }
        const prodVal = await ev(`window.__get('产品编号')`)
        last = { opened, picked, confirmState, clicked, closed, hasConfirm, toast, prodVal, attempt }
        // 判定"这一下选成了"要看**动作完成**(确定点到了且弹窗关了),不能只看格子值 ——
        // 重选时格子本来就有旧值,按值判断会提前跳出、其实没点确定。
        if (closed === 'CLOSED' && String(clicked).indexOf('OK') === 0 && String(prodVal || '').indexOf(PROD_CODE) >= 0) return last
        await sleep(900)
      }
      return last
    }
    const specStatusNow = async () => {
      const rows = await list(SPEC, { 单据编号: specNo })
      return rows.length ? String(rows[0]['单据状态'] || '') : '(查不到)'
    }

    // ② 计划表新增 + 选产品编号(此刻规格书还是草稿)
    const addRes = await clickSide('新增')
    await sleep(2400)
    const addMsg = await msgText()
    const toastNo = (String(addMsg).match(/(MP|IP|SD|PI)[-\d]{8,}/) || [])[0] || ''
    planNo = (await ev('window.__docNo()')) || toastNo
    if (addRes === 'CLICKED' && toastNo) ok(`②-1 新建出货检验计划表 ${toastNo}(提示:「${String(addMsg).slice(0, 56)}」)`)
    else bad(`②-1 建单失败:click=${addRes} 提示=${JSON.stringify(addMsg)}`)
    console.log(`  --   规格书 ${specNo} 当前状态 = ${await specStatusNow()}`)
    const r1 = await pickProduct()
    if (String(r1.prodVal || '').indexOf(PROD_CODE) >= 0) ok(`②-0 产品编号已选上 = ${r1.prodVal}(第 ${r1.attempt} 次尝试)`)
    else bad(`②-0 产品编号没选上(prodVal=${JSON.stringify(r1.prodVal)} 确定=${r1.clicked} 关闭=${r1.closed}) —— 后面的"没带入"不算数`)
    await sleep(400)
    const msg1 = specCalls.length ? specCalls[specCalls.length - 1].body : '(没有调接口)'
    const msg1b = await msgText()
    const rows1 = (await ev('window.__gridRows()')) || []
    const head1 = { 客户项目名称: await ev(`window.__get('客户项目名称')`), 产品功能类别: await ev(`window.__get('产品功能类别')`), 产品整体尺寸: await ev(`window.__get('产品整体尺寸')`) }
    const specItems = SPEC_ROWS.map((r) => r.检验项目)
    const body1 = rows1.flat().filter((x) => String(x || '').trim())
    const leaked = specItems.filter((it) => body1.includes(it))
    const head1Filled = Object.values(head1).some((v) => String(v || '').trim() && String(v).indexOf('点击选择') < 0)
    if (!leaked.length && !head1Filled) ok('②-2 规格书还是草稿 ⇒ 一个格都没带入(表头三格与表体都没规格书内容)')
    else bad(`②-2 规格书是草稿却带入了:命中 ${JSON.stringify(leaked)} 表头 ${JSON.stringify(head1)} 表体 ${JSON.stringify(body1).slice(0, 90)}`)
    const allMsg1 = String(msg1b) + ' ' + String(r1.toast || '') + ' ' + JSON.stringify(specCalls.map((c) => c.body))
    if (/审批|草稿|不能自动带入/.test(allMsg1)) ok(`②-3 明确告知原因:${String(msg1b).replace(/\s+/g, ' ').slice(0, 96)}`)
    else bad(`②-3 没给出"规格书未审批完"的原因:提示=${JSON.stringify(msg1b)} toast=${JSON.stringify(r1.toast)} 产品编号格=${JSON.stringify(r1.prodVal)} 接口=${JSON.stringify(specCalls.map((c) => c.body))}`)
    await shot('01-draft-no-fill')

    /* ③ 规格书提交审批 → 审批通过 */
    const sub = await call(SPEC, '提交审批', { 编号: specNo })
    await sleep(1200)
    const st1 = await specStatusNow()
    const appr = await call(SPEC, '审批通过', { 编号: specNo })
    await sleep(1200)
    const st2 = await specStatusNow()
    if (st2 === '已归档' || st2 === '已审核') ok(`③-1 规格书走完审批:提交后=${st1} → 审批通过=${st2}`)
    else bad(`③-1 规格书审批没走通:提交=${JSON.stringify(sub?.message)} 状态=${st1} 通过=${JSON.stringify(appr?.message)} 状态=${st2}`)

    /* ④ 重选产品编号 ⇒ 应带入 */
    const r2 = await pickProduct()
    await sleep(1200)
    const msg2 = await msgText()
    const head2 = { 客户项目名称: await ev(`window.__get('客户项目名称')`), 产品功能类别: await ev(`window.__get('产品功能类别')`), 产品整体尺寸: await ev(`window.__get('产品整体尺寸')`) }
    const colsNow = await ev('window.__cols()')
    const items = (await ev(`window.__gridGet('检验项目')`)).filter((x) => String(x || '').trim())
    const reqs = (await ev(`window.__gridGet('检验要求')`)).filter((x) => String(x || '').trim())
    const methods = (await ev(`window.__gridGet('检验方法')`)).filter((x) => String(x || '').trim())
    const seqs = (await ev(`window.__gridGet('序号')`)).filter((x) => String(x || '').trim())
    console.log('  --   表体列头:' + JSON.stringify(colsNow))
    const headOk = head2['客户项目名称'] === SPEC_HEAD['客户项目名称'] && head2['产品功能类别'] === SPEC_HEAD['产品类别'] && head2['产品整体尺寸'] === SPEC_HEAD['整体规格参数']
    if (headOk) ok(`④-1 表头三格按规格书带入(${JSON.stringify(head2)})`)
    else bad(`④-1 表头没带入:${JSON.stringify(head2)} 提示=${JSON.stringify(msg2)}`)
    const bodyOk = JSON.stringify(items) === JSON.stringify(SPEC_ROWS.map((r) => r.检验项目)) &&
      JSON.stringify(methods) === JSON.stringify(SPEC_ROWS.map((r) => r.检验方法)) &&
      JSON.stringify(reqs) === JSON.stringify(SPEC_ROWS.map((r) => r.检验要求))
    if (bodyOk) ok(`④-2 表体按规格书带入 3 行(序号 ${JSON.stringify(seqs)} / 检验方法 ${JSON.stringify(methods)})`)
    else bad(`④-2 表体没带入:项目=${JSON.stringify(items)} 要求=${JSON.stringify(reqs)} 方法=${JSON.stringify(methods)} 列=${JSON.stringify(colsNow)}`)
    if (/已按规格书/.test(String(msg2))) ok(`④-3 提示说明按哪张规格书填的:${String(msg2).replace(/\s+/g, ' ').slice(0, 80)}`)
    else bad(`④-3 提示里没说明来源规格书:${JSON.stringify(msg2)}`)
    await shot('02-approved-filled')
    console.log(`  --   选产品时的动作:opened=${r2.opened} pick=${r2.picked} 替换确认=${r2.hasConfirm}`)
  } finally {
    try { if (ws) ws.close() } catch { }
    try { edge.kill() } catch { }
    if (planNo) {
      SQL(`DELETE FROM rd_insp_plan_detail WHERE 单据编号='${planNo}'; DELETE FROM rd_insp_plan_head WHERE 单据编号='${planNo}'; DELETE FROM yj_doc_status WHERE doc_no='${planNo}';`)
      console.log(`  --   清理计划表 ${planNo}`)
    }
    if (specNo) {
      SQL(`DELETE FROM rd_spec_doc_detail WHERE 单据编号='${specNo}'; DELETE FROM rd_spec_doc_head WHERE 单据编号='${specNo}'; DELETE FROM yj_doc_status WHERE doc_no='${specNo}';`)
      console.log(`  --   清理规格书 ${specNo}`)
    }
    if (prodNo) {
      SQL(`DELETE FROM rd_prod_info_detail WHERE 单据编号='${prodNo}'; DELETE FROM rd_prod_info_head WHERE 单据编号='${prodNo}'; DELETE FROM yj_doc_status WHERE doc_no='${prodNo}';`)
      console.log(`  --   清理产品 ${prodNo}`)
    }
  }
  console.log(failed ? `\n✗ ${failed} 项未通过` : '\n✓ 全绿')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
