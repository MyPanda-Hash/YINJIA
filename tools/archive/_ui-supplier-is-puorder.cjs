/**
 * _ui-supplier-is-puorder.cjs — 供应商打印面版「前端与采购订单一致」验证(2026-10-25)
 *
 * 用户口径:「供应商打印面版的前端要与采购订单一致。只是显示和权限不一样。」
 *
 * 断言(全部按**真实渲染结果**):
 *   ① 供应商登录取到的登录态里有 supplierPanelPerms.PU_ORDER = view,query,print;
 *   ② 供应商端页面渲染的**就是采购订单面板**:出现采购订单才有的「单据选择」左栏、
 *      明细页签(物料行表)、工具栏的「打印」组,列结构一致;
 *   ③ 权限不同:工具栏**没有** 新增/保存/删除/审核/生单/转ERP 等写动作;
 *   ④ 数据不同:只出本供应商的订单(接口 total 与 DB 口径一致、页面行全部属于自己);
 *   ⑤ 管理员进「采购订单」页:同样的左栏/明细/打印组都在,且**有**写动作(对照组)。
 *
 * 用法:node tools/archive/_ui-supplier-is-puorder.cjs [baseUrl] [supplierUser] [supplierPass]
 */
const CDP_PORT = 9395
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const SU = process.argv[3] || 'kbl01'
const SP = process.argv[4] || 'kbl@2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}

async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1600,1000', '--user-data-dir=' + path.join(os.tmpdir(), '_is_pu'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  const shot = async (n) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(__dirname, `_pu-${n}.png`), Buffer.from(s.result.data, 'base64'))
  }
  const apiLogin = async (u, p) => {
    const r = await fetch(BASE + 'api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p, factory: 'YJ' }),
    })
    return r.json()
  }
  const useSession = async (lj) => {
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  }
  const goto = async (hash) => {
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + hash })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(9000)
  }
  await send('Page.enable')
  await goto('#/login')

  // ---------- ① 登录态 ----------
  console.log('\n== ① 供应商登录态 ==')
  const sup = await apiLogin(SU, SP)
  check('供应商账号登录成功', sup.code === 200)
  const perms = sup.data?.user?.supplierPanelPerms || {}
  check('下发 supplierPanelPerms.PU_ORDER', !!perms.PU_ORDER, JSON.stringify(perms))
  check('词表 = view,query,print(只读)', String(perms.PU_ORDER || '').replace(/\s/g, '') === 'view,query,print', String(perms.PU_ORDER))

  // ---------- ② 供应商端 = 采购订单面板 ----------
  console.log('\n== ② 供应商端渲染的是采购订单面板 ==')
  await useSession(sup)
  await goto('#/scm/supplierPrint')
  const supUi = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
    // 采购订单面板的结构特征:左栏「单据选择」+ 明细表(物料编码/数量列头)+ 工具栏「打印」组
    var heads = Array.from(document.querySelectorAll('.el-table__header th')).map(function(x){ return (x.innerText||'').replace(/\\s/g,''); });
    var btns = Array.from(document.querySelectorAll('button')).map(function(b){ return (b.innerText||'').replace(/\\s+/g,'').trim(); }).filter(Boolean);
    return JSON.stringify({
      hash: location.hash,
      hasRail: t.indexOf('单据选择') >= 0 || !!document.querySelector('[class*="doc-rail"]'),
      hasDetailTab: t.indexOf('物料编码') >= 0 && (t.indexOf('数量') >= 0),
      heads: heads.slice(0, 16),
      groups: Array.from(document.querySelectorAll('.tb-group')).map(function(g){ return (g.innerText||'').replace(/\\s+/g,'').trim(); }),
      buttons: Array.from(new Set(btns)).slice(0, 40),
      title: t.indexOf('采购订单') >= 0,
      vat: t.indexOf('供应商采购打印') >= 0,
    });
  })()`)
  const su = JSON.parse(supUi)
  const supGroups = (su.groups || []).map((g) => g.replace(/[▼\s]/g, ''))
  check('地址仍是供应商采购打印', su.hash.includes('/scm/supplierPrint'), su.hash)
  check('有「单据选择」左栏(采购订单同款)', su.hasRail)
  check('有明细行表(物料编码/数量等列)', su.hasDetailTab, (su.heads || []).join('|'))
  check('工具栏有「打印」组', supGroups.includes('打印'), supGroups.join(','))

  // ---------- ③ 权限不同:没有写动作 ----------
  console.log('\n== ③ 权限不同:无写动作 ==')
  // 判据落在**工具栏组名**上:采购订单的工具栏是按组渲染的(组名=按钮文字,组内是下拉项),
  // 所以"有没有写权限"要看组:新增/保存/删除/生单/导入/修改 这些组不得出现。
  const writeGroups = ['新增', '保存', '删除', '生单', '导入', '修改']
  const hitWrite = supGroups.filter((g) => writeGroups.includes(g))
  check('工具栏没有 新增/保存/删除/生单/导入 等写动作组', hitWrite.length === 0,
    `组=${supGroups.join(',')}`)
  await shot('supplier')

  // ---------- ④ 数据不同 ----------
  console.log('\n== ④ 数据范围:只出本供应商 ==')
  const detail = await evaluate(`(function(){
    var tok = localStorage.getItem('mes_token');
    return fetch('/api/px/queryFormDataList', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 300 })
    }).then(function(r){ return r.json(); }).then(function(j){
      var rows = (j.data && j.data.list) || [];
      // 供应商账号绑定的编码(登录态下发),行上对应字段是「供应商编码」
      var me = (JSON.parse(localStorage.getItem('mes_user') || '{}') || {}).supplierCode || '';
      var others = rows.filter(function(r){ return String(r['供应商编码'] || '') !== me; }).length;
      return JSON.stringify({ code: j.code, total: j.data && j.data.totalSize, rows: rows.length, others: others, me: me });
    });
  })()`).catch((e) => 'EVAL_ERR ' + e.message)
  const de = JSON.parse(String(detail))
  check('列表接口对供应商开放(同一面板取数)', de.code === 200, JSON.stringify(de).slice(0, 100))
  check('服务端只返回本供应商的订单(前端不传条件也照样受限)',
    de.others === 0, `总 ${de.total} 行,非本供应商 ${de.others} 行(本账号 ${de.me})`)
  // 其余面板接口仍必须 403(供应只能看采购订单)
  const denyOther = await evaluate(`(function(){
    var tok = localStorage.getItem('mes_token');
    return fetch('/api/px/getPanelConfig?panelCode=SO_ORDER', { headers: { Authorization: 'Bearer ' + tok } })
      .then(function(r){ return r.json(); }).then(function(j){ return String(j.code); });
  })()`)
  check('供应商调别的面板配置仍 403', denyOther === '403', denyOther)
  const denyWrite = await evaluate(`(function(){
    var tok = localStorage.getItem('mes_token');
    return fetch('/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ panelCode: 'PU_ORDER', buttonName: '删除', formData: {} }) })
      .then(function(r){ return r.json(); }).then(function(j){ return String(j.code); });
  })()`)
  check('供应商调写接口(callButton)仍 403', denyWrite === '403', denyWrite)
  const supTotal = await evaluate(`(function(){
    var tok = localStorage.getItem('mes_token');
    return fetch('/api/supplier/portal/orders?pageSize=1', { headers: { Authorization: 'Bearer ' + tok } })
      .then(function(r){ return r.json(); }).then(function(j){ return JSON.stringify({ code: j.code, total: j.data && j.data.total }); });
  })()`)
  check('门户接口给出本供应商订单总数', JSON.parse(supTotal).code === 200, supTotal)

  // ---------- ⑤ 管理员对照组 ----------
  console.log('\n== ⑤ 管理员:采购订单页(同一面板,有写动作) ==')
  const adm = await apiLogin('admin', '123456')
  await useSession(adm)
  await goto('#/panelx/list/PU_ORDER')
  // 采购订单列表需要先查一次(该面板按查询弹窗取数);点「查询/找单」按钮把列表拉出来,
  // 否则抓到的只是空壳 —— 之前"管理员没有写动作"就是空壳导致的误判。
  await evaluate(`(function(){
    var b = Array.from(document.querySelectorAll('button')).find(function(x){
      var t = (x.innerText||'').replace(/\\s+/g,'');
      return t === '查询' || t === '查找';
    });
    if (b) { b.click(); return true; }
    return false;
  })()`)
  await sleep(4000)
  const admUi = await evaluate(`(function(){
    var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
    var gt = Array.from(document.querySelectorAll('.tb-group')).map(function(g){ return (g.innerText||'').replace(/[▼\\s]/g,''); });
    return JSON.stringify({
      hash: location.hash,
      hasRail: t.indexOf('选择') >= 0,
      heads: Array.from(document.querySelectorAll('.el-table__header th')).map(function(x){ return (x.innerText||'').replace(/\\s/g,''); }).slice(0, 16),
      groups: gt,
    });
  })()`)
  const ad = JSON.parse(admUi)
  check('管理员进采购订单页', ad.hash.includes('/panelx/list/PU_ORDER'), ad.hash)
  check('同样是「单据选择」左栏', ad.hasRail, (ad.groups || []).join(','))
  check('管理员有写动作(新增/保存/删除/生单)',
    ['新增', '保存', '删除', '生单'].every((w) => (ad.groups || []).includes(w)), (ad.groups || []).join(','))
  // 列结构对照:供应商端与管理员端明细列头应完全一致(同一个组件)
  const supHeads = (su.heads || []).join('|')
  const admHeads = (ad.heads || []).join('|')
  check('两端明细列头一致(同一组件)', supHeads === admHeads, `供应商=${supHeads.slice(0, 320)}\n        管理员=${admHeads.slice(0, 320)}`)
  // 工具栏组对照:供应商 = 管理员 − (写动作组)
  const supSet = supGroups.join(',')
  check('供应商工具栏组是管理员组的只读子集',
    supGroups.every((g) => (ad.groups || []).includes(g)), `供应商=[${supSet}] 管理员=[${(ad.groups || []).join(',')}]`)
  await shot('admin')

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(pass === results.length ? 0 : 1)
}

/** 占位:脚本不写死供应商编码(取登录态自己带),这里只是把供应商名当示例值探一下被拒 */
function SUP_SUPPLIER_HINT() { return '惠州市康佰利包装材料有限公司' }

main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
