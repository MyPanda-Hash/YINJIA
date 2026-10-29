/**
 * _v-supplier-material-label.cjs — 供应商「打印材料码」必须弹窗并登记(2026-10-29)
 *
 * 用户报障:「供应商登录打印材料码时,直接就显示打印成功了,没有和采购订单一样有弹窗。这是一个错误」
 *
 * 断言:
 *   ① 供应商会话能取到弹窗数据 /px/puLabel/dialog(自己的单) —— 弹窗能打开的前提;
 *   ② 供应商拿**别人的**采购订单取弹窗数据 → 403(逐单归属核对);
 *   ③ 供应商能登记打印 /px/puLabel/print(自己的单),落在 bd_pu_label;
 *   ④ 登记后该行「可打印量」减少(预约生效)—— 证明真的走了弹窗那条链路,不是"假装成功";
 *   ⑤ 内部账号照旧(不受影响)。
 *
 * 用法:node tools/archive/_v-supplier-material-label.cjs [baseUrl]
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
  const f = path.join(TOOLS, '_ml_probe.sql')
  fs.writeFileSync(f, 'SET NOCOUNT ON;\n' + text + '\nGO\n', 'utf8')
  try {
    return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
      'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
      'yinjia', 'env', '_ml_probe.sql'], {
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
  if (!sup.data?.token) throw new Error('供应商测试账号不可用(先建 kbl01/YJ-KBL)')
  const supTok = sup.data.token
  const me = sup.data.user.supplierCode
  const adm = await login('admin', '123456')
  const admTok = adm.data.token
  console.log(`供应商账号 = ${me}`)

  // 找一张自己的单 + 一行有可打印量的
  const list = (await call('api/px/queryFormDataList', {
    method: 'POST', token: supTok,
    body: { panelCode: 'SUPPLIER_PU_ORDER', condition: {}, pageNo: 1, pageSize: 50 },
  })).data
  const rows = list.list || []
  check('供应商能查到自己的单', rows.length > 0, `${rows.length} 张`)

  let target = null
  for (const r of rows) {
    const no = r['单据编号']
    const d = await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(no), { token: supTok })
    if (d.code === 200 && (d.data?.lines || d.data?.rows || []).length) {
      const lines = d.data.lines || d.data.rows || []
      const printable = lines.find((l) => Number(l.剩余可打 ?? l.可打印量 ?? 0) > 0)
      if (printable) { target = { no, line: printable, dialog: d.data }; break }
    }
  }

  // ---------- ① 弹窗取数 ----------
  console.log('\n== ① 供应商能取到「打印材料码」弹窗数据 ==')
  check('找到一张有可打印量的本供应商订单', !!target, target ? target.no : '未找到')
  if (!target) { console.log('\n=== 结果: 1/5(跳过后续,需要一张有可打印量的单) ==='); process.exit(1) }
  const beforeQty = Number(target.line.剩余可打 ?? 0)
  check('弹窗返回订单行 + 可打印量', true, `${target.no} 行可打印 ${beforeQty}`)
  check('弹窗带预填批次号(按公式预填)', !!target.dialog.prefBatchNo, String(target.dialog.prefBatchNo ?? '(空)'))

  // ---------- ② 别人的单 ----------
  console.log('\n== ② 别人的采购订单必须拒绝 ==')
  const other = sql(`SELECT TOP 1 单据编号 FROM bd_pu_order WHERE ISNULL(供应商编码,N'') <> N'${me}' AND ISNULL(asp_cancel,'N') <> 'Y';`).match(/YJ-\d{8}-\d+/)?.[0]
  if (other) {
    const r2 = await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(other), { token: supTok })
    check('取别人订单的弹窗数据被拒', r2.code === 403, `${other} -> code=${r2.code}`)
  } else {
    check('取别人订单的弹窗数据被拒', false, '找不到别人的单做对照')
  }

  // ---------- ③④ 登记打印 ----------
  console.log('\n== ③ 供应商登记打印(弹窗「确认打印」那条链路) ==')
  const batch = 'ML' + Date.now().toString().slice(-6)
  const lineId = target.line.id   // 打印接口按**行 id** 定位(不是行号)
  const printQty = Math.min(beforeQty, 1)
  const p = await call('api/px/puLabel/print', {
    method: 'POST', token: supTok,
    body: { orderNo: target.no, batchNo: batch, prodDate: '', lines: [{ 采购订单行id: lineId, 打印数量: printQty }] },
  })
  check('登记打印成功', p.code === 200, `code=${p.code} ${p.message || ''}`)

  const after = await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(target.no), { token: supTok })
  const afterLines = after.data?.lines || after.data?.rows || []
  const afterLine = afterLines.find((l) => String(l.id) === String(lineId))
  const afterQty = Number(afterLine?.剩余可打 ?? 0)
  check('★ 可打印量已扣减(证明确实登记并预约,不是"假装成功")', afterQty < beforeQty,
    `${beforeQty} → ${afterQty}`)

  // 打印记录以「采购订单号」关联订单,「单据编号」是打印单号(MQ-…)
  const inDb = sql(`SELECT N'COUNT=' + CAST(COUNT(*) AS varchar) AS r FROM bd_pu_label WHERE 采购订单号 = N'${target.no}' AND 批次号 = N'${batch}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
  const cnt = Number((inDb.match(/COUNT=(\d+)/) || [])[1] || 0)
  check('打印记录已落库(bd_pu_label)', cnt > 0, 'COUNT=' + cnt)

  // ---------- ⑤ 内部账号不受影响 ----------
  console.log('\n== ⑤ 内部账号照旧 ==')
  const a1 = await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(target.no), { token: admTok })
  check('管理员仍能取弹窗数据', a1.code === 200, `code=${a1.code}`)

  // 清理本次登记(软删,释放预约)
  console.log('\n== 清理 ==')
  sql(`UPDATE bd_pu_label SET asp_cancel = 'Y' WHERE 采购订单号 = N'${target.no}' AND 批次号 = N'${batch}';`)
  console.log(`  (已软删本次测试打印记录 ${batch})`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  process.exitCode = pass === results.length ? 0 : 1
}
main().catch((e) => { console.error('[FATAL]', e); process.exitCode = 2 })
