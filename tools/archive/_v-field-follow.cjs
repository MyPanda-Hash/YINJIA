/**
 * _v-field-follow.cjs — 实测 FIELD_FOLLOW:改采购订单的字段,供应商面板自动跟随(2026-10-25)
 *
 * 背景:供应商采购打印的 yj_field 原本是"建面板时复制的快照",采购订单以后改字段不会同步,
 * 两边列会慢慢漂移。后端 PanelRegistry.FIELD_FOLLOW 让供应商面板**读取时直接复用采购订单的字段**。
 *
 * 本脚本用「改 label → 看供应商端是否跟着变 → 还原」实测这条机制(不新增物理列,风险最低):
 *   ① 记下采购订单某字段当前 label;
 *   ② 改成带标记的 label;
 *   ③ 等 PanelRegistry 快照过期(TTL 30s)后:
 *      · 采购订单端 = 新 label(源改了)
 *      · 供应商端 = 新 label(跟随生效)
 *      · yj_field 里供应商那份副本仍是旧 label(证明确实是"读取跟随",不是同步脚本写库)
 *   ④ 还原并复核。
 *
 * 用法:node tools/archive/_v-field-follow.cjs [baseUrl]
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const TOOLS = path.join(__dirname, '..')
const PROBE_FIELD = '单据日期'   // 采购订单与供应商面板共有的稳定字段

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sql(text) {
  const f = path.join(TOOLS, '_ff_probe.sql')
  fs.writeFileSync(f, 'SET NOCOUNT ON;\n' + text + '\nGO\n', 'utf8')
  try {
    return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
      'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
      'yinjia', 'env', '_ff_probe.sql'], {
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
// getPanelConfig 的 dataSchema.fields 用 dataName 承载**中文标签**(数据键=中文,见 ADR-0001),
// 不是 label —— 早先按 f.label 取会全部取到空串,断言变成"空集相等"的假通过。
const labelsOf = async (panel, token) =>
  ((await call('api/px/getPanelConfig?panelCode=' + panel, { token })).data?.dataSchema?.fields || [])
    .map((f) => String(f.dataName ?? f.label ?? ''))

async function main() {
  const at = (await call('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })).data.token
  const esc = (s) => String(s).replace(/'/g, "''")
  const MARK = '单据日期F'

  // ---------- ① 基线 ----------
  console.log('\n== ① 基线 ==')
  const basePu = await labelsOf('PU_ORDER', at)
  const baseSup = await labelsOf('SUPPLIER_PU_ORDER', at)
  check('采购订单字段集 = 供应商字段集(起点一致)', basePu.join('|') === baseSup.join('|'),
    `${basePu.length} / ${baseSup.length} 列`)

  // yj_field 里供应商那份副本当前是什么
  const copyBefore = sql(`SELECT label FROM yj_field WHERE panel_code=N'SUPPLIER_PU_ORDER' AND label=N'${esc(PROBE_FIELD)}';`)

  try {
    // ---------- ② 只改源(采购订单)的 label ----------
    console.log('\n== ② 只改采购订单的 label(不动供应商那份副本) ==')
    sql(`UPDATE yj_field SET label=N'${esc(MARK)}' WHERE panel_code=N'PU_ORDER' AND label=N'${esc(PROBE_FIELD)}';`)
    const copyAfter = sql(`SELECT label FROM yj_field WHERE panel_code=N'SUPPLIER_PU_ORDER' AND label=N'${esc(PROBE_FIELD)}';`)
    check('供应商那份 yj_field 副本没被改(仍是旧 label)', copyAfter.includes(PROBE_FIELD),
      copyBefore.trim() === copyAfter.trim() ? '副本未变' : '副本被动了')

    // 等注册表快照过期(TTL 30s)+ 一点余量
    console.log('  等 PanelRegistry 快照过期(35s)…')
    await sleep(35000)

    const pu = await labelsOf('PU_ORDER', at)
    const sup = await labelsOf('SUPPLIER_PU_ORDER', at)
    check('采购订单端已显示新 label', pu.includes(MARK), pu.includes(MARK) ? MARK : '(未跟随)')
    check('★ 供应商端也显示新 label(FIELD_FOLLOW 生效,无需同步脚本)', sup.includes(MARK),
      sup.includes(MARK) ? MARK : '(仍是旧 label —— 跟随没生效)')
    check('两端字段集仍然完全一致', pu.join('|') === sup.join('|'),
      pu.join('|') === sup.join('|') ? '一致' : '不一致')
    check('旧 label 已从两端消失', !pu.includes(PROBE_FIELD) && !sup.includes(PROBE_FIELD))
  } finally {
    // ---------- ③ 还原 ----------
    console.log('\n== ③ 还原 ==')
    sql(`UPDATE yj_field SET label=N'${esc(PROBE_FIELD)}' WHERE panel_code=N'PU_ORDER' AND label=N'${esc(MARK)}';`)
  }
  await sleep(35000)
  const backPu = await labelsOf('PU_ORDER', at)
  const backSup = await labelsOf('SUPPLIER_PU_ORDER', at)
  check('已还原:采购订单回到原 label', backPu.includes(PROBE_FIELD) && !backPu.includes(MARK))
  check('已还原:供应商端同步回到原 label', backSup.includes(PROBE_FIELD) && !backSup.includes(MARK))
  check('还原后两端字段集一致', backPu.join('|') === backSup.join('|'))

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => {
  console.error('[FATAL]', e)
  // 尽力还原
  try {
    const f = path.join(TOOLS, '_ff_probe.sql')
    fs.writeFileSync(f, "SET NOCOUNT ON;\nUPDATE yj_field SET label=N'单据日期' WHERE panel_code=N'PU_ORDER' AND label=N'单据日期F';\nGO\n", 'utf8')
    execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
      'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
      'yinjia', 'env', '_ff_probe.sql'], { cwd: TOOLS, env: { ...process.env, YINJIA_SQL_PASS: 'Yinjia@2026' }, stdio: 'pipe' })
    fs.unlinkSync(f)
    console.log('(已尝试还原 label)')
  } catch (e2) { console.log('(还原失败,请手工检查 yj_field)', e2.message) }
  process.exit(2)
})
