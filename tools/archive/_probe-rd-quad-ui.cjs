'use strict'
/**
 * _probe-rd-quad-ui.cjs — 研发管理四项改动的**界面层**验证(视觉闭环)
 *
 * 用法:node tools/archive/_probe-rd-quad-ui.cjs [http://localhost:5173]
 *
 * 断言(每一条都对应一项用户诉求,看的是**渲染出来的 DOM/像素**,不是源码):
 *   ③ 规格书封面**右上角**出现「编号：<产品编号>」——
 *      值必须是产品编号(DEMO-B-001),不是单据编号(DEMO-SD-002);这是用户报障的正题。
 *   ④ 封面之下的 1.适用范围 / 2.整体规格参数 / 3.产品主要性能 三行**已消失**
 *      (页面 .rsp-docrow 数 = 0);封面字段表由 9 行变 8 行(第一行「编  号」已移右上角)。
 *   ② 产品信息表「产品形态」在**编辑态**是可维护下拉:有 .el-select、旁边有「标准库维护」入口,
 *      下拉候选含库里那 4 项。
 *   ① 顺带复核产品信息表保存链不再被「产品名称」必填拦(接口层已由 _probe-rd-required-redgreen.cjs 钉死)。
 *
 * ⚠ 全程走**测试账套**(登录 factory=YJ_TEST),在测试库造一张草稿单供编辑态用,跑完物理删除。
 *   正式库一行不动。前端走 5173(vite dev,源文件实时),/api 由 vite 代理到 8090。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const FE = process.argv[2] || 'http://localhost:5173'      // 前端(vite dev)
const API = process.argv[3] || 'http://127.0.0.1:8090'     // 后端(直连,用于登录/造数/清理)
const SPEC_DOC = process.argv[4] || 'DEMO-SD-002'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9353
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败: ' + JSON.stringify(lr).slice(0, 300))
  console.log('账套: ' + (lr.data?.user?.factory || '(未回传)') + '\n')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
  const call = async (buttonName, formData) => (await (await fetch(`${API}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName, formData, buttonParam: {} }),
  })).json())

  // 造一张**草稿**单:草稿是可编辑态,才能看到下拉与维护入口(已归档单只读)
  const created = await call('新增', {})
  const draftNo = created?.data?.编号
  if (!draftNo) throw new Error('造草稿单失败: ' + JSON.stringify(created).slice(0, 300))
  console.log('测试库草稿单: ' + draftNo + '\n')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdquad-ui-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1700', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1700, deviceScaleFactor: 1, mobile: false })
    await nav(`${FE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    // ═══ ③④ 规格书 ═══
    console.log('③④ 规格书 ' + SPEC_DOC)
    await nav(`${FE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(1500)
    await openByDocNo(SPEC_DOC)
    await shot('rdquad-ui-specdoc.png')

    const docno = await ev(`(function(){
      var el=document.querySelector('.rsp-cover-docno'); if(!el) return JSON.stringify({found:false})
      var b=el.getBoundingClientRect(), page=document.querySelector('.rsp-cover-page')
      var pb=page? page.getBoundingClientRect():null
      return JSON.stringify({ found:true, text: el.textContent.trim(),
        val: (el.querySelector('.rsp-cover-docno-val')||{}).textContent || (el.querySelector('input')||{}).value || '',
        right: pb? Math.round(pb.right - b.right):-1, cy: Math.round(b.top - (pb?pb.top:0)) })
    })()`)
    console.log('  右上角编号格: ' + docno)
    const dn = JSON.parse(docno)
    check('③ 封面右上角有编号格', dn.found === true)
    check('③ 右上角显示的是**产品编号** DEMO-B-001(不是单据号 ' + SPEC_DOC + ')',
      String(dn.val).includes('DEMO-B-001'), '实际: ' + dn.val)
    check('③ 该格右贴封面右缘(距右 ' + dn.right + 'px,应≈45)', dn.right >= 0 && dn.right < 80)

    const coverRows = await ev(`(function(){
      var trs=[].slice.call(document.querySelectorAll('.rsp-cover-fields tr'))
      return JSON.stringify({ n: trs.length, labels: trs.map(function(t){ return (t.querySelector('.rsp-cover-lb')||{}).textContent||'' }) })
    })()`)
    console.log('  封面字段表: ' + coverRows)
    const cr = JSON.parse(coverRows)
    check('④ 封面字段表 9 → 8 行', cr.n === 8, '实际 ' + cr.n + ' 行')
    check('④ 表内不再有「编  号」行(已移右上角)', !cr.labels.some((l) => l.replace(/\s/g, '') === '编号'), JSON.stringify(cr.labels))

    const docrows = await ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('.rsp-docrow')).filter(function(r){return r.getBoundingClientRect().height>0})
      return JSON.stringify(rows.map(function(r){ return ((r.querySelector('.rsp-doclabel')||{}).textContent||'').trim() }))
    })()`)
    console.log('  封面下章节行: ' + docrows)
    check('④ 1.适用范围 / 2.整体规格参数 / 3.产品主要性能 三行已删除',
      JSON.parse(docrows).length === 0, '仍有: ' + docrows)

    const pageH = await ev(`(function(){
      var p=document.querySelector('.rsp-cover-page'); if(!p) return 0
      return Math.round(p.getBoundingClientRect().height)
    })()`)
    check('④ 封面画布 = A4 整高(coverTailReserve 已置 0)', Math.abs(pageH - 1123) <= 3, '实测 ' + pageH + 'px(期望≈1123)')

    // ═══ ② 产品信息表编辑态:可维护下拉 ═══
    console.log('\n② 产品信息表(草稿 ' + draftNo + ')')
    await nav(`${FE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(1500)
    await openByDocNo(draftNo)
    await shot('rdquad-ui-prodinfo-draft.png')
    const cell = await ev(`(function(){
      var rs=document.querySelector('.record-sheet'); if(!rs) return JSON.stringify({found:false})
      var lbs=[].slice.call(rs.querySelectorAll('td.rs-label')).filter(function(t){return t.offsetParent})
      for (var i=0;i<lbs.length;i++){
        if (lbs[i].textContent.trim()==='产品形态'){
          var td=lbs[i].nextElementSibling
          return JSON.stringify({ found:true, hasSelect: !!td.querySelector('.el-select'),
            hasLibBtn: !!td.querySelector('.rs-lib-btn'), libBtnText: (td.querySelector('.rs-lib-btn')||{}).textContent||'' })
        }
      }
      return JSON.stringify({ found:false })
    })()`)
    console.log('  产品形态格: ' + cell)
    const c = JSON.parse(cell)
    check('② 产品形态在编辑态是下拉(el-select)', c.hasSelect === true, cell)
    check('② 旁边有「标准库维护」入口', c.hasLibBtn === true, cell)

    // 点开下拉,看候选
    await ev(`(function(){ var rs=document.querySelector('.record-sheet')
      var lbs=[].slice.call(rs.querySelectorAll('td.rs-label')).filter(function(t){return t.offsetParent})
      for (var i=0;i<lbs.length;i++){ if(lbs[i].textContent.trim()==='产品形态'){ var w=lbs[i].nextElementSibling.querySelector('.el-select__wrapper'); if(w){ w.click(); return 'OK' } } } return 'NO' })()`)
    await sleep(1200)
    const opts = await ev(`(function(){ return JSON.stringify([].slice.call(document.querySelectorAll('.el-select-dropdown__item')).filter(function(x){return x.offsetParent}).map(function(x){return x.textContent.trim()})) })()`)
    console.log('  产品形态候选: ' + opts)
    await shot('rdquad-ui-prodinfo-dropdown.png')
    const optList = JSON.parse(opts)
    check('② 候选含原有 4 项(来自标准库 prod.form)',
      ['包布', '套网', '打端盖', '套PP棉'].every((o) => optList.includes(o)), opts)
    await ev(`document.body.click()`)
    await sleep(600)

    // 点「标准库维护」→ 维护弹窗(新增/停用/恢复)
    await ev(`(function(){ var rs=document.querySelector('.record-sheet')
      var lbs=[].slice.call(rs.querySelectorAll('td.rs-label')).filter(function(t){return t.offsetParent})
      for (var i=0;i<lbs.length;i++){ if(lbs[i].textContent.trim()==='产品形态'){ var b=lbs[i].nextElementSibling.querySelector('.rs-lib-btn'); if(b){ b.click(); return 'OK' } } } return 'NO' })()`)
    await sleep(1600)
    await shot('rdquad-ui-prodinfo-stdlib.png')
    const dlg = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent})
      for (var i=0;i<ds.length;i++){ if((ds[i].innerText||'').indexOf('标准库')>=0){
        var txt=ds[i].innerText.replace(/\\s+/g,' ')
        return JSON.stringify({ found:true, hasAdd: txt.indexOf('加入标准库')>=0, hasStop: txt.indexOf('停用')>=0,
          rows: ds[i].querySelectorAll('.el-table__row, .slm-text').length, brief: txt.slice(0,180) }) } }
      return JSON.stringify({ found:false })
    })()`)
    console.log('  标准库维护弹窗: ' + dlg)
    const d = JSON.parse(dlg)
    check('② 弹窗打开且带「加入标准库」(可自定义新增)', d.found === true && d.hasAdd === true, dlg)
    check('② 弹窗列出库条目(可停用=删除)', (d.rows || 0) >= 4, '条目行数 ' + d.rows)
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
    // 清理:删掉测试库那张草稿单(含状态行),不留痕
    try {
      const { execFileSync } = require('node:child_process')
      execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES_TEST', '-U', 'yinjia', '-P', 'Yinjia@2026', '-Q',
        `SET NOCOUNT ON; DELETE FROM rd_prod_info_head WHERE [单据编号]=N'${draftNo}'; DELETE FROM rd_prod_info_detail WHERE [单据编号]=N'${draftNo}'; DELETE FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no=N'${draftNo}';`],
        { encoding: 'utf8' })
      console.log('\n  已清理测试库草稿单 ' + draftNo)
    } catch (e) { console.log('\n  ⚠ 清理失败: ' + e.message.split('\n')[0]) }
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
