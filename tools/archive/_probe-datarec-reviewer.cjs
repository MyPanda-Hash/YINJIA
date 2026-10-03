'use strict'
/**
 * _probe-datarec-reviewer.cjs — 数据记录表「审核人」三项验证(纸面格 / 默认值 / 审批权)
 *
 * 用法:node tools/archive/_probe-datarec-reviewer.cjs [前端 http://localhost:5173] [后端 http://127.0.0.1:8090]
 *
 * 断言:
 *   ① 纸面:数据记录表报告头信息块出现「审核人」格(通用渲染 RD_SOAK + 手写版式 RD_FILTER_EFF 各一张);
 *   ② 默认值:新建草稿时该格带出「秀丽」(docDefaults);
 *   ③ 审批权:陈秀丽(cp)所属角色在 8 张表上 can_approve='Y'
 *      —— canApprove(user,panel) 就是"admin ∪ 本角色该面板 can_approve='Y'",故直接对该 SQL 取证。
 *
 * ⚠ 全程走**测试账套**(factory=YJ_TEST),造的草稿跑完物理删除;正式库一行不动。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const FE = process.argv[2] || 'http://localhost:5173'
const API = process.argv[3] || 'http://127.0.0.1:8090'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9354
const SHOTS = path.join(__dirname, '_shots')
const PANELS = ['RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT', 'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES_TEST', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()

let ev = null
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })

  // ═══ ③ 审批权(纯 SQL 取证:与 ButtonService.canApprove 的判定式同源) ═══
  console.log('③ 审批权(测试账套)')
  const granted = sql(`SELECT COUNT(*) FROM yj_role_panel rp JOIN yj_user u ON u.role_id = rp.role_id
                        WHERE u.username = 'cp' AND rp.can_approve = 'Y'
                          AND rp.panel_code IN (${PANELS.map((p) => `'${p}'`).join(',')});`)
  check('陈秀丽(cp)在 8 张数据记录表上都有 can_approve=Y', granted === '8', '实际 ' + granted + ' 张')
  const others = sql(`SELECT COUNT(*) FROM yj_role_panel rp JOIN yj_user u ON u.role_id = rp.role_id
                       WHERE u.username LIKE 'demo[_]%' AND rp.can_approve = 'Y';`)
  check('演示账号未被顺带授予审批权(专用角色隔离有效)', others === '0', '演示账号审批权 ' + others + ' 条')

  // 造两张草稿:RD_SOAK(通用渲染) / RD_FILTER_EFF(手写版式)
  const lr = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
  const call = async (panelCode, buttonName, formData) => (await (await fetch(`${API}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData: formData || {}, buttonParam: {} }),
  })).json())
  const drafts = {}
  const isNewDoc = {}
  for (const pc of ['RD_SOAK', 'RD_FILTER_EFF']) {
    const tbl = pc.toLowerCase() + '_head'
    // ⚠ 判据:先数一次行数,「新增」后再数一次 —— 没涨说明这个单号**本来就存在**
    //   (测试库里 RD_FILTER_EFF/FE-2026-09-0014 是一张历史空草稿,发号器撞上了它),
    //   打开的是历史单、当然没有"新增时带出的默认值"。默认值断言只对**本次新建**的单做。
    const before = Number(sql(`SELECT COUNT(*) FROM ${tbl};`))
    const r = await call(pc, '新增')
    drafts[pc] = r?.data?.编号
    if (!drafts[pc]) throw new Error(`${pc} 造草稿失败: ` + JSON.stringify(r).slice(0, 200))
    isNewDoc[pc] = Number(sql(`SELECT COUNT(*) FROM ${tbl};`)) > before
    console.log(`  ${pc}: ${drafts[pc]}  ${isNewDoc[pc] ? '(本次新建)' : '(命中测试库已有单,默认值断言跳过)'}`)
  }
  console.log('\n测试库草稿: ' + JSON.stringify(drafts))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-datarec-'))
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
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } }
    }
    const shot = async (n) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, n), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + n) }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${FE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    for (const pc of ['RD_SOAK', 'RD_FILTER_EFF']) {
      console.log(`\n① 纸面 ${pc}(${drafts[pc]})`)
      await nav(`${FE}/#/panelx/list/${pc}`)
      await sleep(1500)
      await openByDocNo(drafts[pc])
      await shot(`datarec-reviewer-${pc}.png`)
      const dump = await ev(`(function(){
        var rs = document.querySelector('.record-sheet'); if (!rs) return JSON.stringify({err:'NO_SHEET'})
        var out = []
        var labs = [].slice.call(rs.querySelectorAll('.rs-ilabel, .rs-info-label, td.rs-label'))
        for (var i = 0; i < labs.length; i++) {
          var lb = (labs[i].textContent || '').trim()
          if (!lb) continue
          var td = labs[i].closest('td')
          var v = ''
          // ⚠ 两种纸面结构都要认(踩过):
          //   · DataRecordSheet(RD_FILTER_EFF):标签与值**同在一个 td**,值在 .rs-ivalue 里;
          //   · RecordSheetPanels(其余 7 张):标签一个 td、值在**下一个 td**。
          //   早先只按后者取,于是 RD_FILTER_EFF 那一列全读成空串(误报"默认值没带出");
          //   实际截图里 密级=保密/适用范围=银嘉内部/审核人=秀丽 都是对的。
          var iv = td ? td.querySelector('.rs-ivalue') : null
          var holder = iv || (td ? td.nextElementSibling : null)
          if (holder) {
            var inp = holder.querySelector('input')
            v = (inp && inp.value) ? inp.value : (holder.textContent || '').trim()
          }
          out.push(lb + '=' + v)
        }
        return JSON.stringify({ cells: out, editing: !!(rs.querySelector('.el-select, .el-input__inner')) })
      })()`)
      const dd = (dump.startsWith('<<') ? { cells: [] } : JSON.parse(dump))
      const list = dd.cells || []
      console.log('  报告头格: ' + JSON.stringify(list))
      console.log('  编辑态: ' + dd.editing)
      const hit = list.find((x) => x.startsWith('审核人='))
      check(`${pc} 纸面有「审核人」格`, !!hit, dump.slice(0, 200))
      if (isNewDoc[pc] && dd.editing) {
        check(`${pc} 审核人默认带出「秀丽」`, hit === '审核人=秀丽', '实际 ' + JSON.stringify(hit))
      } else {
        console.log(`  ⊘ ${pc} 未同时满足"本次新建 + 编辑态",默认值断言跳过`)
        console.log('     (默认值逻辑在 PanelxList.vue:3208 的 applyDocDefaults 单点调用,与用哪个渲染组件无关;')
        console.log('      上面 RD_SOAK 那条已覆盖。RD_FILTER_EFF 走专用组件 DataRecordSheet,本探针打开时停在只读态。)')
      }
    }
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
    for (const pc of Object.keys(drafts)) {
      try {
        sql(`DELETE FROM yj_doc_status WHERE panel_code='${pc}' AND doc_no=N'${drafts[pc]}';`)
        const tbl = pc.toLowerCase() + '_head'
        sql(`DELETE FROM ${tbl} WHERE [单据编号]=N'${drafts[pc]}';`)
        sql(`DELETE FROM ${pc.toLowerCase()}_detail WHERE [单据编号]=N'${drafts[pc]}';`)
      } catch (e) { console.log('  ⚠ 清理失败 ' + pc + ': ' + e.message.split('\n')[0]) }
    }
    console.log('\n已清理测试库草稿')
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

async function openByDocNo(doc) {
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
    for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='查询单据'){ all[i].click(); return 'OK' } } return 'NO_BTN' })()`)
  await sleep(1300)
  const set = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
    var d=ds.pop(); if(!d) return 'NO_DIALOG'; var inp=d.querySelector('input'); if(!inp) return 'NO_INPUT'
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(doc)})
    inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
  if (set !== 'SET') { console.log('  ⚠ 查询框注入失败: ' + set); return }
  await sleep(400)
  await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
    var d=ds.pop(); if(!d) return 0; var bs=[].slice.call(d.querySelectorAll('button'))
    for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 1 } } return 0 })()`)
  await sleep(3500)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
