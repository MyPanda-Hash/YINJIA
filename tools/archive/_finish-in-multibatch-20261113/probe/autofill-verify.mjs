// auto-fill-verify:提交审批时自动带入两张已审核检验单号 + 新单明细序号
import { execFileSync } from 'node:child_process'
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const DB = 'HSDZ_MES_TEST'
const JAVA = 'C:\\Users\\vigna\\.jdks\\ms-25.0.4\\bin\\java.exe'
const CP = 'D:\\workspace\\yinjia\\tools\\lib\\mssql-jdbc.jar'
const PROBE = 'D:\\workspace\\yinjia\\tools\\archive\\_ProbeSql.java'
const EXEC = 'D:\\workspace\\yinjia\\tools\\archive\\_finish-in-multibatch-20261113\\probe\\_ExecSql.java'
const results = []
const ok = (n, c, d) => { results.push({ n, c: !!c, d }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`) }
function run(file, q) {
  const out = execFileSync(JAVA, ['-Dstdout.encoding=UTF-8', '-cp', CP, file, q, DB], { encoding: 'utf8' })
  const lines = out.split(/\r?\n/).filter((l) => l !== '')
  if (!lines.length || lines[0].startsWith('[update]')) return []
  const header = lines[0].split('\t'); const rows = []
  for (const ln of lines.slice(1)) { if (ln.startsWith('[rows]')) break; const c = ln.split('\t'); const o = {}; header.forEach((h, i) => { o[h] = c[i] }); rows.push(o) }
  return rows
}
const sqlSel = (q) => run(PROBE, q)
const sqlUpd = (q) => run(EXEC, q)
const call = async (p, b, t) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b ?? {}) }); return JSON.parse(await r.text()) }
const login = (await call('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })).data
const t = login.token
let WO = null, rowId = null, docNo = null
try {
  const created = (await call('/api/px/workOrderList/create', { 工单类型: '常规', 产品编码: 'A-32-01', 生产数量: 10, 工单日期: '2026-11-13', 工艺路线: 'GY-CB-STD', 备注: '自动带检验单号验收' }, t)).data
  WO = created['工单号']
  const row = ((await call('/api/px/workOrderList', { keyword: WO }, t)).data || []).find((r) => r['工单号'] === WO)
  rowId = row['行id']
  const rs = (await call('/api/px/scheduleBoard/routeSteps', { 加工单号: WO, 行id: rowId }, t)).data || {}
  const lineOf = { 成型: '成型1线', 切炭: '切炭2(自动)', 组装: '组装线' }
  const steps = (rs['工序步骤'] || []).map((s) => ({ 工序: s['工序'], 生产线: lineOf[s['工序']] }))
  await call('/api/px/scheduleBoard/preplan', { 加工单号: WO, 行id: rowId, 排产数量: 10, 步骤: steps }, t)
  sqlUpd(`INSERT INTO dbo.scjl (comm, sc_no, wzdm, mc, gg, jldw, sc_date, gldh, gxdm, sl, [批次号], [报工单号], wgzt, wgsj, [工单行号], asp_user1, asp_time1, asp_cancel)
          VALUES (N'0',N'',N'A-32-01',N'S阻垢炭棒/滤芯',N'40.5*16*80',N'支',GETDATE(),N'${WO}',N'组装',10,N'20261113',N'BG-VERIFY-AF-01',N'Y',CAST(N'2026-11-13 10:00:00' AS datetime2),1,N'admin',GETDATE(),N'N')`)
  const bf = await call('/api/px/scheduleBoard/finishInBackfill', { 加工单号: WO, 行id: rowId }, t)
  docNo = (sqlSel(`SELECT TOP 1 单据编号 FROM dbo.bd_finish_in WHERE 加工单号=N'${WO}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`)[0] || {})['单据编号']
  ok('前置:补生成草稿(两张检验单号暂空)', bf.code === 200 && !!docNo, `doc=${docNo} bf=${JSON.stringify(bf.data)}`)
  let head = sqlSel(`SELECT ISNULL(出货检验功能单号,'') f, ISNULL(出货检验表观单号,'') l FROM dbo.bd_finish_in WHERE 单据编号=N'${docNo}'`)[0] || {}
  ok('前置:草稿的两张检验单号为空', !head.f && !head.l, JSON.stringify(head))
  const seq = sqlSel(`SELECT ISNULL(序号,-1) seq FROM dbo.bl_finish_in WHERE 单据编号=N'${docNo}' AND ISNULL(asp_cancel,'N')<>'Y'`)[0] || {}
  ok('新单明细「序号」有值(=1)', Number(seq.seq) === 1, JSON.stringify(seq))
  // 造两张已审核检验单(头+状态),再提交审批
  sqlUpd(`INSERT INTO dbo.qc_proc_insp_head (单据编号, 单据日期, 工单号, 工单行号, asp_cancel, asp_user1, asp_time1)
          VALUES (N'ZC-VERIFY-AF-01', CAST(GETDATE() AS date), N'${WO}', 1, N'N', N'admin', GETDATE())`)
  sqlUpd(`INSERT INTO dbo.qc_asm_insp_head (单据编号, 单据日期, 工单号, 工单行号, asp_cancel, asp_user1, asp_time1)
          VALUES (N'ZJ-VERIFY-AF-01', CAST(GETDATE() AS date), N'${WO}', 1, N'N', N'admin', GETDATE())`)
  for (const [panel, doc] of [['QC_PROC_INSP', 'ZC-VERIFY-AF-01'], ['QC_ASM_INSP', 'ZJ-VERIFY-AF-01']]) {
    sqlUpd(`MERGE dbo.yj_doc_status AS t USING (VALUES (N'${panel}', N'${doc}')) AS s(panel_code, doc_no)
            ON t.panel_code=s.panel_code AND t.doc_no=s.doc_no
            WHEN MATCHED THEN UPDATE SET shr=N'admin', shsj=GETDATE(), canceled='N', pending='N', saved='Y', update_at=GETDATE()
            WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, saved, update_at)
              VALUES (s.panel_code, s.doc_no, N'admin', GETDATE(), 'N', 'N', 'Y', GETDATE());`)
  }
  const sub = await call('/api/px/callButton', { panelCode: 'FINISH_IN', buttonName: '提交审批', formData: { 编号: docNo }, buttonParam: {} }, t)
  ok('提交审批成功(门禁只要求两张已审核)', sub.code === 200, `code=${sub.code} message=${sub.message || ''}`)
  head = sqlSel(`SELECT ISNULL(出货检验功能单号,'') f, ISNULL(出货检验表观单号,'') l FROM dbo.bd_finish_in WHERE 单据编号=N'${docNo}'`)[0] || {}
  ok('提交时自动带入两张检验单号', head.f === 'ZC-VERIFY-AF-01' && head.l === 'ZJ-VERIFY-AF-01', JSON.stringify(head))
  const st = sqlSel(`SELECT ISNULL(pending,'') p FROM dbo.yj_doc_status WHERE panel_code=N'FINISH_IN' AND doc_no=N'${docNo}'`)[0] || {}
  ok('提交后状态=审批中', st.p === 'Y', JSON.stringify(st))
} finally {
  if (WO) {
    sqlUpd(`DELETE FROM dbo.bl_finish_in WHERE 单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE 加工单号 LIKE N'${WO}%');
            DELETE FROM dbo.yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE 加工单号 LIKE N'${WO}%');
            DELETE FROM dbo.bd_finish_in WHERE 加工单号 LIKE N'${WO}%';
            DELETE FROM dbo.yj_doc_status WHERE doc_no IN (N'BG-VERIFY-AF-01');
            DELETE FROM dbo.scjl WHERE gldh LIKE N'${WO}%';
            DELETE FROM dbo.wo_process_line WHERE 工单号 LIKE N'${WO}%';
            DELETE FROM dbo.wo_day_plan WHERE 工单号 LIKE N'${WO}%';
            DELETE FROM dbo.plang_pc WHERE pl_no LIKE N'${WO}%';
            DELETE FROM dbo.plang WHERE pl_no LIKE N'${WO}%';`)
  }
  sqlUpd(`DELETE FROM dbo.qc_proc_insp_head WHERE 单据编号=N'ZC-VERIFY-AF-01';
          DELETE FROM dbo.qc_asm_insp_head WHERE 单据编号=N'ZJ-VERIFY-AF-01';
          DELETE FROM dbo.yj_doc_status WHERE doc_no IN (N'ZC-VERIFY-AF-01', N'ZJ-VERIFY-AF-01');`)
  console.log('\n== 汇总 ' + results.filter((x) => x.c).length + '/' + results.length + ' PASS ==')
  process.exit(results.every((x) => x.c) ? 0 : 1)
}
