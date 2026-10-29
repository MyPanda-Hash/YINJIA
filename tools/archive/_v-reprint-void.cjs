/**
 * _v-reprint-void.cjs — 供应商「重打 / 作废」必须真的生效(2026-10-29)
 *
 * 用户报障:
 *   「打印材料码的时候作废和重打,都有问题,作废显示成功,时间没有变化,重打就是报错 undefined」
 *
 * 根因:SupplierPortalGuardFilter 只放行了 puLabel/dialog / print / batchLock,
 *       **没放行 reprint / void** ⇒ 供应商调这两个全 403;而 engine 用 unwrap(403 不抛错)
 *       ⇒ 作废"显示成功"但记录没动、重打 res 为 undefined 就弹「第 undefined 次 undefined」。
 *
 * 断言(供应商视角,真实数据):
 *   ① 供应商登记一次打印 → 拿到打印单号;
 *   ② 重打 → 200 且**打印次数 +1**、打印时间刷新;
 *   ③ 作废 → 200 且记录消失(或标作废)、**可打印量回升**;
 *   ④ 作废别人的打印单 → 403;
 *   ⑤ 内部账号不受影响。
 *
 * 用法:node tools/archive/_v-reprint-void.cjs [baseUrl]
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const TOOLS = path.join(__dirname, '..')

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
function sql(text) {
  const f = path.join(TOOLS, '_rv_probe.sql')
  fs.writeFileSync(f, 'SET NOCOUNT ON;\n' + text + '\nGO\n', 'utf8')
  try {
    return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
      'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
      'yinjia', 'env', '_rv_probe.sql'], {
      cwd: TOOLS, env: { ...process.env, YINJIA_SQL_PASS: 'Yinjia@2026' }, encoding: 'utf8',
    })
  } finally { try { fs.unlinkSync(f) } catch (e) { /* ignore */ } }
}
async function call(p, { method = 'GET', token, body } = {}) {
  const r = await fetch(BASE + p.replace(/^\//, ''), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch (e) { return { raw: t, http: r.status } }
}
const login = async (u, p) => call('api/auth/login', { method: 'POST', body: { userName: u, password: p, factory: 'YJ' } })

async function main() {
  const sup = await login(process.argv[3] || 'kbl01', process.argv[4] || 'kbl@2026')
  if (!sup.data?.token) throw new Error('供应商测试账号不可用')
  const supTok = sup.data.token
  const admTok = (await login('admin', '123456')).data.token

  // 找一张有可打印量的自己的单
  const rows = ((await call('api/px/queryFormDataList', {
    method: 'POST', token: supTok,
    body: { panelCode: 'SUPPLIER_PU_ORDER', condition: {}, pageNo: 1, pageSize: 50 },
  })).data.list) || []

  let target = null
  for (const r of rows) {
    const d = await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(r['单据编号']), { token: supTok })
    const line = (d.data?.lines || []).find((l) => Number(l['剩余可打'] || 0) > 0)
    if (line) { target = { no: r['单据编号'], line }; break }
  }
  if (!target) throw new Error('找不到有可打印量的供应商订单')
  const capBefore = Number(target.line['剩余可打'])

  // ---------- ① 登记打印 ----------
  console.log('\n== ① 供应商登记打印(准备数据) ==')
  const batch = 'RV' + Date.now().toString().slice(-6)
  const p = await call('api/px/puLabel/print', {
    method: 'POST', token: supTok,
    body: { orderNo: target.no, batchNo: batch, prodDate: '', lines: [{ 采购订单行id: target.line.id, 打印数量: 1 }] },
  })
  check('登记打印成功', p.code === 200, `code=${p.code}`)
  const labelDoc = p.data?.['单据编号'] || (p.data?.['单据编号列表'] || [])[0]
  check('拿到打印单号', !!labelDoc, String(labelDoc))
  if (!labelDoc) { console.log('=== 结果: 中止 ==='); process.exit(1) }

  const verify = (expr) => {
    const out = sql(`SELECT N'V=' + CAST(${expr} AS varchar(50)) AS r FROM bd_pu_label WHERE 单据编号 = N'${labelDoc}';`)
    return (out.match(/V=([^\s|]+)/) || [])[1] || ''
  }

  // ---------- ② 重打 ----------
  console.log('\n== ② 重打(原来报 undefined) ==')
  const timesBefore = Number(verify('ISNULL([打印次数],0)'))
  const rp = await call('api/px/puLabel/reprint', { method: 'POST', token: supTok, body: { docNo: labelDoc } })
  check('供应商能重打(不再 403)', rp.code === 200, `code=${rp.code} ${rp.message || ''}`)
  check('重打返回了打印单数据(不是 undefined)', !!rp.data && !!rp.data['单据编号'], rp.data ? `单号=${rp.data['单据编号']}` : '(空)')
  check('返回体带「打印次数」', rp.data && rp.data['打印次数'] !== undefined, String(rp.data?.['打印次数']))
  const timesAfter = Number(verify('ISNULL([打印次数],0)'))
  check('★ 打印次数已 +1(真的重打了)', timesAfter === timesBefore + 1, `${timesBefore} → ${timesAfter}`)

  // ---------- ③ 作废 ----------
  console.log('\n== ③ 作废(原来"显示成功但没变化") ==')
  const capBeforeVoid = Number(((await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(target.no), { token: supTok })).data.lines || [])
    .find((l) => String(l.id) === String(target.line.id))?.['剩余可打'])
  const vd = await call('api/px/puLabel/void', { method: 'POST', token: supTok, body: { docNo: labelDoc } })
  check('供应商能作废', vd.code === 200, `code=${vd.code} ${vd.message || ''}`)
  const canceled = verify("ISNULL(asp_cancel,'N')")
  check('★ 记录真的被作废(asp_cancel=Y)', canceled === 'Y', `asp_cancel=${canceled}`)
  const capAfterVoid = Number(((await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(target.no), { token: supTok })).data.lines || [])
    .find((l) => String(l.id) === String(target.line.id))?.['剩余可打'])
  check('★ 可打印量已回升(预约释放)', capAfterVoid > capBeforeVoid, `${capBeforeVoid} → ${capAfterVoid}`)
  check('可打印量回到测试前', capAfterVoid === capBefore, `${capAfterVoid} vs 初始 ${capBefore}`)

  // ---------- ④ 别人的打印单 ----------
  console.log('\n== ④ 别人的打印单不能动 ==')
  const otherDoc = (sql(`SELECT TOP 1 单据编号 FROM bd_pu_label WHERE ISNULL(供应商编码,N'') <> N'${sup.data.user.supplierCode}' AND ISNULL(asp_cancel,'N') <> 'Y';`).match(/MQ-\d{4}-\d{2}-\d{4}/) || [])[0]
  if (otherDoc) {
    const bad = await call('api/px/puLabel/reprint', { method: 'POST', token: supTok, body: { docNo: otherDoc } })
    check('重打别人的打印单被拒(403)', bad.code === 403, `${otherDoc} -> code=${bad.code}`)
  } else {
    check('重打别人的打印单被拒(403)', false, '找不到别人的打印单做对照')
  }

  // ---------- ⑤ 内部账号 ----------
  console.log('\n== ⑤ 内部账号照旧 ==')
  const admDial = await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(target.no), { token: admTok })
  check('管理员仍能取弹窗数据', admDial.code === 200, `code=${admDial.code}`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  // 清理:作废测试单(若还剩)
  try {
    const st = verify("ISNULL(asp_cancel,'N')")
    if (st === 'N') await call('api/px/puLabel/void', { method: 'POST', token: admTok, body: { docNo: labelDoc } })
  } catch (e) { /* ignore */ }
  process.exitCode = pass === results.length ? 0 : 1
}
main().catch((e) => { console.error('[FATAL]', e); process.exitCode = 2 })
