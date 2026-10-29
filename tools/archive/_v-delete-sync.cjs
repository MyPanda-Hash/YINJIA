/**
 * _v-delete-sync.cjs — 采购订单删一张单,供应商端必须同步消失(2026-10-25)
 *
 * 用户报障:「采购订单删除数据,供应商打印并不同步」。
 * 本脚本用**真单据**走完整链路(建 → 查得到 → 删 → 两边都查不到),比只看条数更硬。
 *
 * 做法:直接用 SQL 造一张归属测试供应商(YJ-KBL)的采购订单,不碰真实业务单;
 * 删除时写 yj_doc_status(panel_code='PU_ORDER', canceled='Y') —— 与界面「删除」同一口径。
 * 结束时把造的数据彻底清掉。
 *
 * 用法:node tools/archive/_v-delete-sync.cjs [baseUrl]
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const TOOLS = path.join(__dirname, '..')
const SUP_CODE = 'YJ-KBL'
const DOC_NO = 'YJ-DELTEST-' + Date.now()

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
function sql(text) {
  const f = path.join(TOOLS, '_del_probe.sql')
  fs.writeFileSync(f, 'SET NOCOUNT ON;\n' + text + '\nGO\n', 'utf8')
  try {
    return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
      'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
      'yinjia', 'env', '_del_probe.sql'], {
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
/** 该单号在指定面板/令牌下是否出现 */
async function visible(panel, token, docNo) {
  const d = (await call('api/px/queryFormDataList', {
    method: 'POST', token,
    body: { panelCode: panel, condition: { 单据编号: docNo }, pageNo: 1, pageSize: 5 },
  })).data
  const rows = d?.list || []
  return { hit: rows.some((r) => r['单据编号'] === docNo), total: d?.totalSize ?? -1, row: rows[0] || null }
}

async function main() {
  const at = (await call('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })).data.token
  const st = (await call('api/auth/login', { method: 'POST', body: { userName: 'kbl01', password: 'kbl@2026', factory: 'YJ' } })).data
  if (!st || !st.token) throw new Error('供应商测试账号不可用')
  const supTok = st.token
  const esc = (s) => String(s).replace(/'/g, "''")

  try {
    // ---------- 造一张归属测试供应商的单 ----------
    console.log('\n== 造一张测试单(' + DOC_NO + ',供应商 ' + SUP_CODE + ') ==')
    sql(`INSERT INTO bd_pu_order ([单据编号],[单据日期],[供应商],[供应商编码],[单据状态],[asp_user1],[asp_time1])
         VALUES (N'${esc(DOC_NO)}', CAST(GETDATE() AS date), N'惠州市康佰利包装材料有限公司', N'${esc(SUP_CODE)}', N'已审核', N'验证', SYSDATETIME());`)
    sql(`INSERT INTO yj_doc_status (panel_code, doc_no, canceled, saved) VALUES (N'PU_ORDER', N'${esc(DOC_NO)}', 'N', '1');`)

    const a0 = await visible('PU_ORDER', at, DOC_NO)
    const b0 = await visible('SUPPLIER_PU_ORDER', supTok, DOC_NO)
    check('① 新单在采购订单可见', a0.hit, `total=${a0.total}`)
    check('① 同一张新单在供应商端可见(同一张表)', b0.hit, `total=${b0.total}`)
    check('① 供应商端看到的供应商编码正确', b0.row && b0.row['供应商编码'] === SUP_CODE, String(b0.row?.['供应商编码']))

    // ---------- 删除(与界面「删除」同口径:yj_doc_status.canceled='Y') ----------
    console.log('\n== 删除这张单(界面删除写的就是 yj_doc_status.canceled) ==')
    sql(`UPDATE yj_doc_status SET canceled='Y' WHERE panel_code=N'PU_ORDER' AND doc_no=N'${esc(DOC_NO)}';`)

    const a1 = await visible('PU_ORDER', at, DOC_NO)
    const b1 = await visible('SUPPLIER_PU_ORDER', supTok, DOC_NO)
    check('② 删除后采购订单查不到', !a1.hit, `total=${a1.total}`)
    check('② ★ 删除后供应商端**同步**查不到', !b1.hit, `total=${b1.total}${b1.hit ? ' (仍在 —— 不同步!)' : ''}`)

    // ---------- 两面板总条数一致 ----------
    const ta = (await call('api/px/queryFormDataList', { method: 'POST', token: at, body: { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 } })).data.totalSize
    const tb = (await call('api/px/queryFormDataList', { method: 'POST', token: at, body: { panelCode: 'SUPPLIER_PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 } })).data.totalSize
    check('③ 两面板总条数仍然一致', ta === tb, `采购订单 ${ta} / 供应商 ${tb}`)
  } finally {
    // ---------- 清理 ----------
    console.log('\n== 清理测试数据 ==')
    sql(`DELETE FROM yj_doc_status WHERE panel_code=N'PU_ORDER' AND doc_no=N'${esc(DOC_NO)}';`)
    sql(`DELETE FROM bd_pu_order WHERE 单据编号=N'${esc(DOC_NO)}';`)
    const ta = (await call('api/px/queryFormDataList', { method: 'POST', token: at, body: { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 } })).data.totalSize
    const tb = (await call('api/px/queryFormDataList', { method: 'POST', token: at, body: { panelCode: 'SUPPLIER_PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 } })).data.totalSize
    check('清理后条数回到基线且两边一致', ta === tb, `采购订单 ${ta} / 供应商 ${tb}`)
  }

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
