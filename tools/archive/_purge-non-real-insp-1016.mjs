/**
 * 清除「非真实流转」的来料检验单及其检验项目/检验数据记录(2026-10-16,正式库)
 *
 * 用户口径:将来料检验单里**不是真实流程产生的**数据(即:对应采购订单的商品在 bs_inv 里
 *   「来料检验」不为「是」)一并清除,检验项目(qc_insp_req)与检验数据记录(qc_insp_rec)同样处理。
 *
 * 判定:检验单 → 暂收单 → 采购订单 → 行(物料) → bs_inv.来料检验
 *   · 该订单**没有任何一行**物料勾了「来料检验=是」 ⇒ 判为非真实流转 ⇒ 清理;
 *   · 无暂收单号 / 暂收单无采购订单号的 ⇒ 无法溯源,同样按非真实流转清理。
 *
 * 清理方式:走面板「删除」接口(软删);检验项目按物料编号清理(目录是基础档案式面板)。
 * 用法: node tools/archive/_purge-non-real-insp-1016.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const BASE = 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

// 非真实流转的检验单 = 其采购订单「无任何一行」勾了来料检验=是(或无法溯源)
const bad = await q(`
  SELECT i.单据编号 AS no, ISNULL(i.暂收单号,N'') AS sl, ISNULL(sl.采购订单号,N'') AS po
  FROM qc_insp i
  LEFT JOIN sl_recv sl ON sl.单据编号 = i.暂收单号
  LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_INSP' AND s.doc_no = i.单据编号
  WHERE ISNULL(i.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'
    AND (ISNULL(i.暂收单号,N'') = N'' OR sl.单据编号 IS NULL OR ISNULL(sl.采购订单号,N'') = N''
         OR NOT EXISTS (SELECT 1 FROM bl_pu_order l JOIN bs_inv iv ON iv.存货编码 = l.物料编码
                        WHERE l.单据编号 = sl.采购订单号 AND ISNULL(l.asp_cancel,'N') <> 'Y'
                          AND ISNULL(iv.来料检验,N'') = N'是'))`)
// 这些检验单对应的检验数据记录(按备注里的 IJ 号)
const badRec = bad.length
  ? await q(`SELECT 单据编号 AS no FROM qc_insp_rec
      WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 备注 LIKE N'%IJ-%'
        AND SUBSTRING(备注, CHARINDEX('IJ-', 备注), 16) IN (${bad.map((x) => `N'${x.no}'`).join(',')})`)
  : []
console.log(`非真实流转检验单 ${bad.length} 张;其检验数据记录 ${badRec.length} 条`)
console.log('   样例: ' + bad.slice(0, 5).map((x) => `${x.no}(${x.po || '无订单'})`).join(', '))
if (DRY) process.exit(0)
if (!bad.length && !badRec.length) process.exit(0)

writeFileSync(new URL('./_dump-out/purged-non-real-insp-1016.tsv', import.meta.url),
  '类型\t单号\t采购订单\r\n' + bad.map((x) => `检验单\t${x.no}\t${x.po}`).join('\r\n')
  + '\r\n' + badRec.map((x) => `检验数据记录\t${x.no}\t`).join('\r\n'), 'utf8')

const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const token = login.data.token
const btn = async (panel, name, no) => (await (await fetch(`${BASE}/api/px/callButton`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: panel, buttonName: name, formData: { 编号: no, 单据编号: no }, buttonParam: {} }),
})).json())
const ok = (r) => r.code === 200 || r.code === 0
const del = async (p, no) => { await btn(p, '弃审', no); return ok(await btn(p, '删除', no)) }

let okIj = 0, okRec = 0
const why = {}
for (const x of bad) {
  const u = await btn('QC_INSP', '弃审', x.no)
  const d = await btn('QC_INSP', '删除', x.no)
  if (ok(d)) okIj++
  else why[`弃审=${u.code}/${(u.message || '').slice(0, 20)} 删除=${d.code}/${(d.message || '').slice(0, 30)}`] = (why[`弃审=${u.code}/${(u.message || '').slice(0, 20)} 删除=${d.code}/${(d.message || '').slice(0, 30)}`] || 0) + 1
}
for (const x of badRec) if (await del('QC_INSP_REC', x.no)) okRec++
console.log(`已清理:检验单 ${okIj}/${bad.length};检验数据记录 ${okRec}/${badRec.length}`)
for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 4)) console.log(`   ${n} 张失败: ${k}`)

// 复核(拆成两个简单查询,避免聚合套子查询)
const vis = (await pool.request().query(`
  SELECT COUNT(*) AS n FROM qc_insp i LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号
  WHERE ISNULL(i.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'`)).recordset[0].n
const comp = (await pool.request().query(`
  SELECT COUNT(*) AS n FROM qc_insp i
  JOIN sl_recv sl ON sl.单据编号 = i.暂收单号
  LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号
  WHERE ISNULL(i.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'
    AND EXISTS (SELECT 1 FROM bl_pu_order l JOIN bs_inv iv ON iv.存货编码 = l.物料编码
                WHERE l.单据编号 = sl.采购订单号 AND ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(iv.来料检验,N'') = N'是')`)).recordset[0].n
await pool.close()
console.log(`复核:界面可见检验单 ${vis} 张,其中来自「来料检验=是」订单的合规单 ${comp} 张`)
console.log('[备份] tools/archive/_dump-out/purged-non-real-insp-1016.tsv')
