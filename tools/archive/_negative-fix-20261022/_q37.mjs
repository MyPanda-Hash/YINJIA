/** 执行后的独立复核:三表自洽、单据完整、测试数据已清、月结口径未被破坏 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('① 负结存')
console.log('   ' + JSON.stringify((await q(`SELECT COUNT(*) neg FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`))[0]))

line('② 配平单概况')
for (const r of await q(`SELECT COUNT(*) heads, SUM(l.n) lines, CAST(SUM(l.q) AS decimal(18,4)) qty,
                                MIN(CONVERT(varchar(10),h.单据日期,120)) d1, MAX(CONVERT(varchar(10),h.单据日期,120)) d2,
                                MIN(h.审核人) a1, MAX(h.审核人) a2
                           FROM bd_other_in h JOIN (SELECT 单据编号, COUNT(*) n, SUM(数量) q FROM bl_other_in GROUP BY 单据编号) l
                             ON l.单据编号=h.单据编号
                          WHERE h.备注 LIKE N'负库存配平%'`)) console.log('   ' + JSON.stringify(r))

line('③ 单据头/行/流水/状态/留痕 五边一致性(配平单)')
for (const r of await q(`
  SELECT h.单据编号,
    (SELECT COUNT(*) FROM bl_other_in l WHERE l.单据编号=h.单据编号) lines,
    (SELECT COUNT(*) FROM inh i WHERE i.单据编号=h.单据编号 AND i.src=3) flows,
    (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='OTHER_IN' AND s.doc_no=h.单据编号 AND s.shr IS NOT NULL) status,
    (SELECT COUNT(*) FROM yj_form_approval a WHERE a.panel_code='OTHER_IN' AND a.form_no=h.单据编号) trail
    FROM bd_other_in h WHERE h.备注 LIKE N'负库存配平%'`).then((rows) => rows.filter((x) =>
      Number(x.lines) !== Number(x.flows) || Number(x.status) !== 1 || Number(x.trail) !== 2)))
  console.log('   ✗ 不一致: ' + JSON.stringify(r))
console.log('   (无输出 = 全部一致)')

line('④ 结存 vs 流水净额(排除月结结转)')
const d = await q(`
  WITH f AS (
    SELECT RTRIM(物料编码) w, ISNULL(RTRIM(仓库编码),'') c, ISNULL(RTRIM(批号),'') l, SUM(数量) n
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
     GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),''), -SUM(数量)
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
     GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
  ), n AS (SELECT w,c,l,SUM(n) net FROM f GROUP BY w,c,l)
  SELECT COUNT(*) mism FROM kucun k LEFT JOIN n ON n.w=RTRIM(k.wzdm) AND n.c=ISNULL(RTRIM(k.ckdm),'') AND n.l=ISNULL(RTRIM(k.lot_no),'')
   WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ABS(CAST(ISNULL(k.yl,0) AS decimal(18,4)) - ISNULL(n.net,0)) > 0.0001`)
console.log('   不一致行数: ' + d[0].mism + '(历史月结口径造成,执行前为 1713)')

line('⑤ 测试数据')
console.log('   ' + JSON.stringify((await q(`SELECT
  (SELECT COUNT(*) FROM inh WHERE 物料编码 LIKE 'TEST%') inh_test,
  (SELECT COUNT(*) FROM outh WHERE 物料编码 LIKE 'TEST%') outh_test,
  (SELECT COUNT(*) FROM kucun WHERE wzdm LIKE 'TEST%') kucun_test`))[0]))

line('⑥ 重复入库是否已消除')
for (const r of await q(`
  WITH d AS (SELECT 单据编号, 物料编码, 仓库编码, 数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
              GROUP BY 单据编号, 物料编码, 仓库编码, 数量 HAVING COUNT(*)>1)
  SELECT COUNT(*) grp FROM d`)) console.log('   仍有同单同物料同数量的流水组: ' + r.grp + '(含产成品入库的正常多行)')

line('⑦ 补建的存货档案')
for (const r of await q(`SELECT 存货编码, 存货名称, 规格型号, 计量单位, 所属类别, 数据来源 FROM bs_inv WHERE 数据来源=N'配平补建'`))
  console.log('   ' + JSON.stringify(r))

line('⑧ 下月结转行是否已关(应为 0)')
console.log('   ' + JSON.stringify((await q(`SELECT COUNT(*) n, MIN(CONVERT(varchar(10),单据日期,120)) d FROM inh WHERE 单据类型=N'月结结转'`))[0]))
await pool.close()
