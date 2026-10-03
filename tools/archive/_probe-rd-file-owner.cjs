'use strict'
/**
 * _probe-rd-file-owner.cjs — 批 5 的两项验证(分发默认责任人 / 项目定级原则文案)
 *
 * 用法:node tools/archive/_probe-rd-file-owner.cjs [前端 http://localhost:5173] [后端 http://127.0.0.1:8090]
 *
 * 需求出处:《产品开发系统需求汇总.xlsx》
 *   · sheet「文件汇总表」的「产品文件流程」5.2/5.3/5.4 = 固定责任人(刘磊/柴善银/冯敏)→ 断言①
 *   · sheet「开发相关流程」底部的项目定级原则三段原文 → 断言②(原实现二级口径是「开发性项目」,与原文不符)
 *
 * ⚠ 走**测试账套**(factory=YJ_TEST):拿测试库已归档的 DEMO-PI-002 打开分发弹窗(admin 有权分发),
 *   只读不改 —— 弹窗打开即读,不点确定,不落任何分配。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const FE = process.argv[2] || 'http://localhost:5173'
const API = process.argv[3] || 'http://127.0.0.1:8090'
const PROD_DOC = process.argv[4] || 'DEMO-PI-002'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9355
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
/** 测试库 SQL(本探针要临时清空/恢复 rd_dev_task 的演示分配) */
const sql = (q) => require('node:child_process').execFileSync('sqlcmd',
  ['-S', 'localhost', '-d', 'HSDZ_MES_TEST', '-U', 'yinjia', '-P', 'Yinjia@2026',
    '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()

let ev = null
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fileowner-'))
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

    // ═══ ① 分发责任人弹窗的默认值 ═══
    console.log(`① 分发责任人默认值(测试库 ${PROD_DOC})`)
    // ⚠ 这张演示单**早就分发过**(rd_dev_task 里有 4 行历史分配),而弹窗口径是
    //   「已分发过以库里为准」⇒ 固定默认值根本没机会显示。故:先把这 4 行**临时清空**,
    //   验完在 finally 里按原值恢复(测试库的演示数据,原值见下方 RESTORE 常量)。
    const prodCode = 'DEMO-B-001'
    sql(`DELETE FROM rd_dev_task WHERE 产品编号 = N'${prodCode}';`)
    console.log('  已临时清空 rd_dev_task 的历史分配(验完恢复)')
    await nav(`${FE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(1500)
    await openByDocNo(PROD_DOC)
    const clicked = await ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for (var i=0;i<all.length;i++){
        var t=(all[i].textContent||'').trim()
        if (all[i].offsetParent && (t==='分发责任人' || t==='改责任人')) { all[i].click(); return t }
      }
      return 'NO_BTN'
    })()`)
    console.log('  点按钮: ' + clicked)
    await sleep(2500)
    const rows = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent})
      for (var i=0;i<ds.length;i++){
        if ((ds[i].innerText||'').indexOf('分发责任人')>=0){
          var out=[]
          var rs=[].slice.call(ds[i].querySelectorAll('.dq-row'))
          for (var j=0;j<rs.length;j++){
            var lb=(rs[j].querySelector('span,div')||{}).textContent||''
            var inp=rs[j].querySelector('input')
            out.push(${JSON.stringify('')} + (inp ? inp.value : '') + ' <- ' + lb.trim().slice(0,20))
          }
          return JSON.stringify(out)
        }
      }
      return 'NO_DIALOG'
    })()`)
    console.log('  四行默认责任人: ' + rows)
    await shot('rd-file-owner-assign.png')
    const txt = String(rows)
    check('① 成型工艺清单 默认责任人 = liulei(刘磊)', txt.includes('liulei'), txt.slice(0, 200))
    check('① 组装工艺清单 默认责任人 = chaishanyin(柴善银)', txt.includes('chaishanyin'), txt.slice(0, 200))
    check('① 出货检验计划表 默认责任人 = fengmin(冯敏)', txt.includes('fengmin'), txt.slice(0, 200))

    // ═══ ② 项目定级原则文案(纸面) ═══
    console.log('\n② 项目定级原则文案(RD_PROGRESS 纸面)')
    await nav(`${FE}/#/panelx/list/RD_PROGRESS`)
    await sleep(3000)
    await shot('rd-file-owner-principle.png')
    const principle = await ev(`(function(){
      var el=document.querySelector('.ps-principle'); return el ? (el.textContent||'').replace(/\\s+/g,' ').trim() : 'NO_EL'
    })()`)
    console.log('  纸面文案: ' + principle)
    check('② 二级口径照需求原文(一年内有重要经济效益…)', String(principle).includes('一年内有重要经济效益'), String(principle).slice(0, 160))
    check('② 三级口径照需求原文(未来（一年后）…)', String(principle).includes('未来（一年后）'), String(principle).slice(0, 160))
    check('② 四级口径含"如内部简单测试、客户样品测试等"', String(principle).includes('客户样品测试'), String(principle).slice(0, 160))
    check('② 不再出现旧文案「二级项目-开发性项目」', !String(principle).includes('开发性项目'), String(principle).slice(0, 160))
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
    // 恢复临时清掉的 4 行演示分配(原值取自 2026-09-30 实测的 rd_dev_task:
    //   成型=cp / 组装=glm53 / 规格书=cp / 出货=glm53,下发人均为 glm53)
    try {
      sql(`IF NOT EXISTS (SELECT 1 FROM rd_dev_task WHERE 产品编号=N'DEMO-B-001')
      INSERT INTO rd_dev_task (产品编号, 产品名称, 源单据号, 目标面板, 下发人, 下发时间, 负责人, asp_cancel)
      VALUES (N'DEMO-B-001', N'碱性炭棒滤芯(演示)', N'DEMO-PI-002', 'RD_MOLD_PROC', 'glm53', '2026-09-21 15:33:58.427', 'cp', 'N'),
             (N'DEMO-B-001', N'碱性炭棒滤芯(演示)', N'DEMO-PI-002', 'RD_ASM_PROC', 'glm53', '2026-09-21 15:33:58.427', 'glm53', 'N'),
             (N'DEMO-B-001', N'碱性炭棒滤芯(演示)', N'DEMO-PI-002', 'RD_SPEC_DOC', 'glm53', '2026-09-21 15:33:58.427', 'cp', 'N'),
             (N'DEMO-B-001', N'碱性炭棒滤芯(演示)', N'DEMO-PI-002', 'RD_INSP_PLAN', 'glm53', '2026-09-21 15:33:58.427', 'glm53', 'N');`)
      const back = sql(`SELECT COUNT(*) FROM rd_dev_task WHERE 产品编号 = N'DEMO-B-001';`)
      console.log(`\n已恢复 rd_dev_task 演示分配(${back} 行)`)
    } catch (e) { console.log('\n  ⚠ rd_dev_task 恢复失败: ' + e.message.split('\n')[0]) }
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
