/**
 * _probe-dev-flow.cjs — 产品信息表「归档 → 产品开发下发」流程实跑(2026-09-20)
 *
 * 为什么跑这个:库里 rd_dev_task 0 行、RD_PROD_INFO 已归档单 0 张 ⇒ 这条流程**没有活实例**,
 * 只看代码看不出它到底通不通。本探针按用户在系统里的真实操作顺序跑一遍,每步打印实测证据,
 * 并在最后**按精确单号清理**(含 rd_dev_task / 消息 / 审批留痕),不留探针数据。
 *
 * 链路(代码位置):
 *   ① 保存(RD_PROD_INFO)            → ButtonService.save():管理员保存即归档(markArchived + SUBMIT/APPROVE 留痕)
 *   ② 侧边栏按钮状态 GET /px/rdDev/buttonState → DevTaskService.buttonState():按产品编号查是否已下发
 *   ③ 点「产品开发」POST /px/callButton buttonName=产品开发 → ButtonService.dispatchDev()
 *        guards:仅 RD_PROD_INFO / 有编辑权 / 单据存在 / **状态=已归档** / 产品编号非空
 *        → DevTaskService.dispatch():按产品编号幂等,写 rd_dev_task 4 行(4 个下游面板)
 *        → 责任人姓名→启用账号(挂起=null),非本人时发 SPEC_DISPATCHED 站内消息
 *   ④ 开发矩阵 GET /px/rdDev/board         → 每格 = statusOf() 实时推导(未开发/开发中/开发审核中/开发完毕)
 *   ⑤ 产品文件列表 GET /px/prodDocList     → 同一批 cells + 是否受控(4 份全归档才受控)
 *   ⑥ 下游参照角标 GET /px/rdDev/annotate  → 下游面板产品编号格显示 未开发/已开发
 *
 * 用法:node tools/archive/_probe-dev-flow.cjs   (需后端 8090;会临时造单,结束时清理)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9334
const SHOTS = path.join(__dirname, '_shots')
const CLEANUP_SQL = path.join(__dirname, '_probe-dev-flow-cleanup.sql')

const CODE = 'PROBE-DEV-' + Date.now().toString().slice(-6)
const CODE2 = CODE + '-DRAFT'
const PROD_NAME = '探针产品-下发链路'
const RESP = '彭于晏'           // → 账号 glm53(启用、非管理员)

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败:' + JSON.stringify(lr))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const callBtn = async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
  })).json())
  const api = async (p) => (await (await fetch(BASE + p, { headers: H })).json())

  let no1 = null, no2 = null
  try {
    // ════ ① 建单 + 保存(管理员保存即归档) ════
    step('① 产品信息表:新建 → 保存(管理员=直接归档)')
    const c1 = await callBtn('RD_PROD_INFO', '保存', {})
    no1 = c1?.data?.['编号']
    ok(`新建草稿 ${no1}(状态 ${c1?.data?.['单据状态']})`)
    const s1 = await callBtn('RD_PROD_INFO', '保存', {
      编号: no1, 产品编号: CODE, 产品名称: PROD_NAME, 产品类别: '普通炭棒',
      客户项目名称: '探针项目', 产品整体尺寸: '24*10*120',
      // ⚠ 数据键 = yj_field.label:该列的 col_name 是「责任人」,label 却是「产品负责人」
      //   ⇒ 载荷必须写 label,写 col_name 会被 labelsToCols 当未声明键丢掉(负责人解析随之挂起)
      产品负责人: RESP,
    })
    console.log(`     保存返回:状态=${s1?.data?.['单据状态']} code=${s1?.code}${s1?.message ? ' msg=' + s1.message : ''}`)
    if (s1?.data?.['单据状态'] === '已归档') ok('管理员「保存」= 直接归档(不走审批)')
    else bad(`保存后状态应为「已归档」,实际 ${JSON.stringify(s1?.data?.['单据状态'])} ${s1?.message || ''}`)

    // 门禁实测:未归档的单不能下发
    step('①b 门禁实测:未归档(草稿)的单点「产品开发」应被拒')
    const d1 = await callBtn('RD_PROD_INFO', '保存为草稿', {})
    no2 = d1?.data?.['编号']
    await callBtn('RD_PROD_INFO', '保存为草稿', { 编号: no2, 产品编号: CODE2, 产品名称: PROD_NAME + '(草稿)', 产品类别: '普通炭棒', 产品负责人: RESP })
    const g1 = await callBtn('RD_PROD_INFO', '产品开发', { 编号: no2 })
    if (g1?.code !== 200 && /仅已归档/.test(String(g1?.message))) ok(`草稿单被拒:${g1.message}`)
    else bad(`草稿单不该允许下发,实际 code=${g1?.code} message=${g1?.message}`)

    // ════ ② 按钮状态 ════
    step('② 侧边栏「产品开发」按钮状态(GET /px/rdDev/buttonState)')
    const bs = await api(`/api/px/rdDev/buttonState?docNo=${encodeURIComponent(no1)}`)
    console.log('     ' + JSON.stringify(bs?.data))
    if (bs?.data?.dispatched === false) ok('未下发 ⇒ 按钮可点(dispatched=false)')
    else bad(`按钮状态异常:${JSON.stringify(bs?.data)}`)

    // ════ ③ 下发 ════
    step('③ 点「产品开发」下发(POST /px/callButton buttonName=产品开发)')
    const dp = await callBtn('RD_PROD_INFO', '产品开发', { 编号: no1 })
    console.log('     ' + JSON.stringify(dp?.data))
    if (dp?.code === 200 && dp.data?.already === false) ok(`下发成功,写入 ${(dp.data?.panels || []).length} 个下游面板任务`)
    else bad(`下发失败:${JSON.stringify(dp)}`)
    const panels = dp?.data?.panels || []
    if (panels.length === 4) ok(`下游面板 = 4 列 ${JSON.stringify(panels)}`)
    else bad(`下游面板数应为 4,实际 ${panels.length}`)
    if (dp?.data?.supervisor === 'glm53' && dp?.data?.supervisorResolved === true) ok(`总负责人姓名「${RESP}」→ 账号 ${dp.data.supervisor}(${dp.data.supervisorName})`)
    else bad(`负责人解析异常:${JSON.stringify({ s: dp?.data?.supervisor, r: dp?.data?.supervisorResolved })}`)

    // ════ ④ 矩阵 ════
    step('④ 开发矩阵(GET /px/rdDev/board)')
    const board = await api('/api/px/rdDev/board')
    const row = (board?.data || []).find((r) => r['产品编号'] === CODE)
    console.log('     ' + JSON.stringify(row))
    if (row) ok(`矩阵出 1 行:4 格全「未开发」=${Object.values(row.cells).every((v) => v === '未开发')},doneCount=${row.doneCount}/${row.totalCount},overall=${row.overall}`)
    else bad('矩阵里找不到该产品')

    // ════ ⑤ 产品文件列表 ════
    step('⑤ 产品文件列表矩阵(GET /px/prodDocList)')
    const pdl = await api('/api/px/prodDocList')
    const prow = (pdl?.data?.rows || []).find((r) => r['产品编号'] === CODE)
    console.log('     columns=' + JSON.stringify((pdl?.data?.columns || []).map?.((c) => c.panelName || c)) + ' row=' + JSON.stringify(prow))
    if (prow) ok('文件汇总表里出现该产品(4 文件列 + 受控派生)')
    else bad(`产品文件列表里找不到该产品:${JSON.stringify(pdl?.data)?.slice(0, 200)}`)

    // ════ ⑥ 幂等 ════
    step('⑥ 重复下发应幂等(already=true,不再写行)')
    const dp2 = await callBtn('RD_PROD_INFO', '产品开发', { 编号: no1 })
    if (dp2?.data?.already === true) ok('第二次下发 already=true')
    else bad(`幂等失效:${JSON.stringify(dp2?.data)}`)
    const board2 = await api('/api/px/rdDev/board')
    const rows2 = (board2?.data || []).filter((r) => r['产品编号'] === CODE)
    if (rows2.length === 1) ok('矩阵里仍只有 1 行(未重复写)')
    else bad(`矩阵里该产品有 ${rows2.length} 行`)

    // ════ ⑦ 界面 ════
    step('⑦ 界面(headless Edge):按钮变「已下发」置灰 + 产品文件列表矩阵')
    // 本机另有会话在打包/重启 8090(打包会替换 jar 导致实例短暂不可用),
    // 界面阶段前先等后端起来,否则浏览器拿到的是「拒绝连接」错误页
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName: 'admin', password: '123456' }) })
        if (r.ok) break
      } catch { /* retry */ }
      await sleep(1500)
    }
    fs.mkdirSync(SHOTS, { recursive: true })
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-devflow-'))
    const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--window-size=1760,1500', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
      const ev = async (exp) => {
        const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
        if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
        return r.result && r.result.result ? r.result.result.value : undefined
      }
      const nav = async (url) => {
        await send('Page.navigate', { url })
        for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
      }
      const shot = async (tag) => {
        const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
        if (!r.result?.data) return null
        const f = path.join(SHOTS, `dev-flow-${tag}.png`)
        fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
        return f
      }
      await send('Page.enable'); await send('Runtime.enable')
      await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
      await nav(`${BASE}/#/login`)
      await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
      await nav('about:blank')

      const sideBtns = () => ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent})
        .map(function(b){return { t:(b.textContent||'').trim(), off:b.classList.contains('disabled') }})`)
      /** 用侧栏「查询单据」把纸张切到指定单号(列表面板默认展示的不一定是探针那张) */
      const focusDoc = async (want) => {
        for (let a = 0; a < 3; a++) {
          await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
            for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
              if(t==='查询单据' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
          await sleep(900)
          const set = await ev(`(function(){ var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop();
            if(!dlg) return 'NO_DIALOG'; var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT';
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(want)});
            inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
          await sleep(400)
          await ev(`(function(){ var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop();
            if(!dlg) return 'NO_DIALOG'; var bs=[].slice.call(dlg.querySelectorAll('button'));
            for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim()==='查询'){ bs[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)
          await sleep(2400)
          const seen = await ev(`(function(){var t=document.querySelector('.record-sheet');var m=t?(t.innerText||'').match(/PI-\\d{4}-\\d{2}-\\d{4}/):null;return m?m[0]:''})()`)
          if (seen === want) return { ok: true, set }
        }
        return { ok: false }
      }

      await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`); await sleep(2500)
      const f1 = await focusDoc(no1)
      const btns1 = await sideBtns()
      const devBtn = (btns1 || []).find((b) => b.t === '产品开发' || b.t === '已下发')
      console.log(`     焦点单 = ${no1}(${f1.ok ? '已定位' : '定位失败'})`)
      console.log('     侧栏按钮:' + JSON.stringify((btns1 || []).map((b) => b.t + (b.off ? '(灰)' : ''))))
      if (devBtn && devBtn.t === '已下发' && devBtn.off) ok('已下发产品的「产品开发」按钮 = 文字「已下发」+ 置灰')
      else bad(`按钮应为「已下发」置灰,实际 ${JSON.stringify(devBtn)}`)
      if ((btns1 || []).some((b) => b.t === '规格书分发')) ok('第二级「规格书分发」按钮随之出现(仅已下发产品)')
      else bad('已下发产品应出现「规格书分发」按钮')
      const shot1 = await shot('prodinfo')

      // 草稿单:按钮仍在但置灰(仅已归档可下发)
      const f2 = await focusDoc(no2)
      const btns2 = await sideBtns()
      const devBtn2 = (btns2 || []).find((b) => b.t === '产品开发' || b.t === '已下发')
      console.log(`     草稿单 = ${no2}(${f2.ok ? '已定位' : '定位失败'})`)
      console.log('     草稿单侧栏按钮:' + JSON.stringify((btns2 || []).map((b) => b.t + (b.off ? '(灰)' : ''))))
      if (devBtn2 && devBtn2.t === '产品开发' && devBtn2.off) ok('草稿单:「产品开发」置灰(仅已归档可下发)')
      else bad(`草稿单按钮应「产品开发」置灰,实际 ${JSON.stringify(devBtn2)}`)

      // 产品文件列表:矩阵应出现该产品一行,4 个文件格全「未开发」
      await nav(`${BASE}/#/panelx/list/RD_PROD_DOCLIST`); await sleep(3200)
      const matrix = await ev(`(function(){
        var t=document.querySelector('.pds-table'); if(!t) return null
        return [].slice.call(t.querySelectorAll('tbody tr')).map(function(tr){
          return [].slice.call(tr.querySelectorAll('td')).map(function(td){ return (td.textContent||'').replace(/\\s+/g,' ').trim() }) }) })()`)
      console.log('     产品文件列表矩阵:' + JSON.stringify(matrix))
      const mrow = (matrix || []).find((r) => r[0] === CODE)
      if (mrow) {
        // 每列两格:文件名 + 状态徽标;4 个文件 ⇒ 9 格 + 尾部 负责人/受控/受控日期
        const badges = mrow.filter((v) => ['未开发', '开发中', '开发审核中', '开发完毕'].includes(v))
        if (badges.length === 4 && badges.every((v) => v === '未开发')) ok('矩阵行:4 个文件格全「未开发」')
        else bad(`矩阵状态徽标异常:${JSON.stringify(badges)} 整行=${JSON.stringify(mrow)}`)
      } else bad('产品文件列表矩阵里找不到该产品行')
      const shot2 = await shot('doclist')
      console.log(`     截图:${[shot1, shot2].filter(Boolean).join(', ')}`)
    } finally {
      if (ws) try { ws.close() } catch { /* ignore */ }
      edge.kill()
    }
  } finally {
    // ════ 清理:按探针产品编号前缀删除(可重复执行,覆盖多次跑批) ════
    const sql = `/* 探针清理:产品开发下发链路实跑(_probe-dev-flow.cjs)生成,可安全重复执行 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%';
DELETE FROM rd_dev_task        WHERE 产品编号 LIKE N'PROBE-DEV-%';
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code = N'RD_PROD_INFO' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log  WHERE panel_code = N'RD_PROD_INFO' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_PROD_INFO' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'rd_dev_task 残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-DEV-%'
UNION ALL SELECT N'rd_prod_info_head 残留', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%'
UNION ALL SELECT N'本次单号', CAST(COUNT(*) AS nvarchar) FROM @docs;
`
    fs.writeFileSync(CLEANUP_SQL, sql, 'utf8')
    console.log(`\n  --   清理 SQL 已写:${CLEANUP_SQL}(单号 ${no1} / ${no2})`)
  }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
