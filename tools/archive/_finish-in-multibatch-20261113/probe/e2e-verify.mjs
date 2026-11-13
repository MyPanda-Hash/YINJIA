// 2026-11-13 产成品入库单「多批次 + 放宽门禁」端到端验收(测试账套 HSDZ_MES_TEST,8091)
// 覆盖:①报工审核/补生成 → 一张未提交入库单承载多天批次;②幂等;③锁定后新批次另建新单;
//      ④门禁只要求两张检验单已审核(不再要求批次明细/全合格);⑤追溯按明细行显示多个批次号;
//      ⑥真实报工提交(/workReport/submit)触发自动生成。
import { execFileSync } from 'node:child_process'

const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const DB = 'HSDZ_MES_TEST'
const JAVA = 'C:\\Users\\vigna\\.jdks\\ms-25.0.4\\bin\\java.exe'
const CP = 'D:\\workspace\\yinjia\\tools\\lib\\mssql-jdbc.jar'
const PROBE = 'D:\\workspace\\yinjia\\tools\\archive\\_ProbeSql.java'
const EXEC = 'D:\\workspace\\yinjia\\tools\\archive\\_finish-in-multibatch-20261113\\probe\\_ExecSql.java'
const TODAY = '2026-11-13'
const results = []
const ok = (name, cond, detail) => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }

/** 执行任意 SQL:SELECT 解析成行数组;写语句返回 [](_ExecSql 打 [update] N) */
function sql(q) {
  const out = execFileSync(JAVA, ['-Dstdout.encoding=UTF-8', '-cp', CP, EXEC, q, DB], { encoding: 'utf8' })
  const lines = out.split(/\r?\n/).filter((l) => l !== '')
  if (!lines.length) return []
  if (lines[0].startsWith('[update]')) return []
  if (lines[0].includes('Exception')) throw new Error('SQL失败: ' + lines[0])
  const header = (lines[0] || '').split('\t')
  const rows = []
  for (const ln of lines.slice(1)) {
    if (ln.startsWith('[rows]')) break
    const cells = ln.split('\t')
    const o = {}
    header.forEach((h, i) => { o[h] = cells[i] })
    rows.push(o)
  }
  return rows
}
async function call(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const txt = await res.text()
  let json
  try { json = JSON.parse(txt) } catch { throw new Error(`${path} HTTP ${res.status}: ${txt.slice(0, 300)}`) }
  return { http: res.status, code: json.code, message: json.message, data: json.data }
}
const login = (await call('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })).data
const token = login.token
const post = (p, b) => call(p, b, token)

const WO = 'GD-VERIFY-FIN-' + Date.now().toString().slice(-6) // payload 备注用(实际单号由后端生成)
const WO2 = WO + '-R'
let rowId = null
let doc1 = null
let doc2 = null
let woA = null
let woB = null

async function createAndSchedule(no, qty) {
  const created = (await post('/api/px/workOrderList/create', {
    工单类型: '常规', 产品编码: 'A-32-01', 生产数量: qty, 工单日期: TODAY, 工艺路线: 'GY-CB-STD',
    备注: '多批次入库验收夹具',
  })).data || {}
  const wo = created['工单号']
  const list = (await post('/api/px/workOrderList', { keyword: wo })).data || []
  const row = list.find((r) => r['工单号'] === wo)
  const rs = (await post('/api/px/scheduleBoard/routeSteps', { 加工单号: wo, 行id: row['行id'] })).data || {}
  const lineOf = { 成型: '成型1线', 切炭: '切炭2(自动)', 组装: '组装线' }
  const steps = (rs['工序步骤'] || []).map((s) => ({ 工序: s['工序'], 生产线: lineOf[s['工序']] }))
  const pre = await post('/api/px/scheduleBoard/preplan', { 加工单号: wo, 行id: row['行id'], 排产数量: qty, 步骤: steps })
  if (pre.code !== 200) throw new Error('排产失败:' + JSON.stringify(pre))
  return { wo, row }
}
function insertReport(wo, qty, day, reportNo) {
  sql(`INSERT INTO dbo.scjl (comm, sc_no, wzdm, mc, gg, jldw, sc_date, gldh, gxdm, sl, [批次号], [报工单号], wgzt, wgsj, [工单行号], asp_user1, asp_time1, asp_cancel)
       SELECT N'0', N'', a.存货编码, a.存货名称, a.规格型号, a.计量单位, CAST(N'${day} 08:00:00' AS datetime2),
              N'${wo}', N'组装', ${qty}, N'${day.replace(/-/g, '')}', N'${reportNo}', N'Y',
              CAST(N'${day} 10:00:00' AS datetime2), 1, N'admin', GETDATE(), N'N'
         FROM dbo.bs_inv a WHERE a.存货编码 = N'A-32-01'`)
}
function cleanup() {
  const noPats = [woA, woB].filter(Boolean)
  for (const no of noPats) {
    sql(`DELETE FROM dbo.wo_split_log WHERE 父工单号 LIKE N'${no}%' OR 子工单号 LIKE N'${no}%';
         DELETE FROM dbo.form_flow_link WHERE target_form_no LIKE N'${no}%' OR source_form_no LIKE N'${no}%';
         DELETE FROM dbo.bl_finish_in WHERE 单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE 加工单号 LIKE N'${no}%');
         DELETE FROM dbo.yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE 加工单号 LIKE N'${no}%');
         DELETE FROM dbo.bd_finish_in WHERE 加工单号 LIKE N'${no}%';
         DELETE FROM dbo.yj_doc_status WHERE doc_no IN (SELECT DISTINCT [报工单号] FROM dbo.scjl WHERE gldh LIKE N'${no}%' AND ISNULL([报工单号],N'')<>N'');
         DELETE FROM dbo.scjl WHERE gldh LIKE N'${no}%';
         DELETE FROM dbo.wo_process_line WHERE 工单号 LIKE N'${no}%';
         DELETE FROM dbo.wo_day_plan WHERE 工单号 LIKE N'${no}%';
         DELETE FROM dbo.wo_bom WHERE 工单号 LIKE N'${no}%';
         DELETE FROM dbo.plang_pc WHERE pl_no LIKE N'${no}%';
         DELETE FROM dbo.plang WHERE pl_no LIKE N'${no}%';
         DELETE FROM dbo.yj_usage_log WHERE doc_no LIKE N'${no}%';`)
  }
  sql(`DELETE FROM dbo.yj_doc_status WHERE doc_no IN (N'ZC-VERIFY-MB-01', N'ZJ-VERIFY-MB-01')`)
}

try {
  // ── ① 建单+排产,然后造 2026-11-12 / 11-13 两个完工批次(最后一道工序 组装)──
  const a = await createAndSchedule(WO, 20)
  woA = a.wo
  rowId = a.row['行id']
  insertReport(woA, 8, '2026-11-12', 'BG-VERIFY-MB-01')
  insertReport(woA, 12, '2026-11-13', 'BG-VERIFY-MB-02')
  console.log('reports=' + JSON.stringify(sql(`SELECT [报工单号], [工单行号], sl, wgzt, CONVERT(varchar(10),wgsj,120) d FROM dbo.scjl WHERE gldh=N'${woA}'`)))

  // ── ② 补生成:一张未提交入库单,两条明细行(批次 20261112=8 / 20261113=12)──
  const b1 = await post('/api/px/scheduleBoard/finishInBackfill', { 加工单号: woA, 行id: rowId })
  ok('② 补生成成功(新建 1 张入库草稿)', b1.code === 200 && Number(b1.data?.['新建单据']) === 1, JSON.stringify(b1).slice(0, 400))
  let docs = sql(`SELECT f.单据编号, ISNULL(f.批次号,'') headBatch, ISNULL(d.批号,'') lineBatch, ISNULL(d.实收数量,0) qty
                    FROM dbo.bd_finish_in f LEFT JOIN dbo.bl_finish_in d ON d.单据编号=f.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
                   WHERE f.加工单号=N'${woA}' AND ISNULL(f.asp_cancel,'N')<>'Y' ORDER BY f.单据编号, d.序号`)
  ok('② 一张单两条明细(20261112=8 / 20261113=12)',
    docs.length === 2 && docs[0].lineBatch === '20261112' && Number(docs[0].qty) === 8
    && docs[1].lineBatch === '20261113' && Number(docs[1].qty) === 12,
    JSON.stringify(docs))
  doc1 = docs[0]?.单据编号
  ok('② 表头批次号=最早批次 20261112', docs[0]?.headBatch === '20261112', 'headBatch=' + docs[0]?.headBatch)

  // ── ③ 幂等:重复补生成不新增单据/行,数量不变 ──
  const b2 = await post('/api/px/scheduleBoard/finishInBackfill', { 加工单号: woA, 行id: rowId })
  const docs2 = sql(`SELECT COUNT(*) cnt FROM bl_finish_in WHERE 单据编号=N'${doc1}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  const docCnt = sql(`SELECT COUNT(*) cnt FROM dbo.bd_finish_in WHERE 加工单号=N'${woA}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  ok('③ 幂等:不新建单据、明细仍 2 行', Number(docCnt[0]?.cnt) === 1 && Number(docs2[0]?.cnt) === 2,
    `新建=${b2.data?.['新建单据']} 单据数=${docCnt[0]?.cnt} 明细=${docs2[0]?.cnt}`)

  // ── ④ 锁定第一张(提交审批)+ 新增 11-14 批次 5 ⇒ 另建新单 ──
  sql(`MERGE dbo.yj_doc_status AS t USING (VALUES (N'FINISH_IN', N'${doc1}')) AS s(panel_code, doc_no)
         ON t.panel_code=s.panel_code AND t.doc_no=s.doc_no
       WHEN MATCHED THEN UPDATE SET pending='Y', saved='Y', canceled='N', update_at=GETDATE()
       WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, pending, saved, canceled, update_at)
         VALUES (s.panel_code, s.doc_no, 'Y', 'Y', 'N', GETDATE());`)
  insertReport(woA, 5, '2026-11-14', 'BG-VERIFY-MB-03')
  const b3 = await post('/api/px/scheduleBoard/finishInBackfill', { 加工单号: woA, 行id: rowId })
  docs = sql(`SELECT f.单据编号, ISNULL(d.批号,'') lineBatch, ISNULL(d.实收数量,0) qty
                FROM dbo.bd_finish_in f LEFT JOIN dbo.bl_finish_in d ON d.单据编号=f.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
               WHERE f.加工单号=N'${woA}' AND ISNULL(f.asp_cancel,'N')<>'Y' ORDER BY f.单据编号, d.序号`)
  const newDocs = [...new Set(docs.map((x) => x.单据编号))]
  doc2 = newDocs.find((n) => n !== doc1)
  ok('④ 锁定后新批次另建新单(共 2 张;新单 20261114=5)', newDocs.length === 2 && !!doc2
    && docs.some((x) => x.单据编号 === doc2 && x.lineBatch === '20261114' && Number(x.qty) === 5),
    `新建=${b3.data?.['新建单据']} 单据=${newDocs.join(',')}`)
  const oldLines = sql(`SELECT COUNT(*) cnt FROM bl_finish_in WHERE 单据编号=N'${doc1}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  ok('④ 锁定单保持不动(仍 2 行)', Number(oldLines[0]?.cnt) === 2, '旧单明细=' + oldLines[0]?.cnt)

  // ── ⑤ 门禁放宽:只要求两张检验单已审核(伪造两张已审核检验单,无批次明细/合格项)──
  sql(`MERGE dbo.yj_doc_status AS t USING (VALUES
         (N'QC_PROC_INSP', N'ZC-VERIFY-MB-01'), (N'QC_ASM_INSP', N'ZJ-VERIFY-MB-01')) AS s(panel_code, doc_no)
         ON t.panel_code=s.panel_code AND t.doc_no=s.doc_no
       WHEN MATCHED THEN UPDATE SET shr=N'admin', shsj=GETDATE(), canceled='N', pending='N', saved='Y', update_at=GETDATE()
       WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, saved, update_at)
         VALUES (s.panel_code, s.doc_no, N'admin', GETDATE(), 'N', 'N', 'Y', GETDATE());`)
  sql(`UPDATE dbo.bd_finish_in SET 出货检验功能单号=N'ZC-VERIFY-MB-01', 出货检验表观单号=N'ZJ-VERIFY-MB-01' WHERE 单据编号=N'${doc2}'`)
  const sub = await post('/api/px/callButton', { panelCode: 'FINISH_IN', buttonName: '提交审批', formData: { 编号: doc2 }, buttonParam: {} })
  ok('⑤ 门禁放宽:两张检验单已审核即可提交(不再要求批次明细/全合格)', sub.code === 200, `code=${sub.code} message=${sub.message || ''}`)
  const st2 = sql(`SELECT ISNULL(pending,'') pending, DATALENGTH(ISNULL(shr,'')) shrLen FROM dbo.yj_doc_status WHERE panel_code=N'FINISH_IN' AND doc_no=N'${doc2}'`)
  ok('⑤ 提交后状态=审批中', st2[0]?.pending === 'Y', JSON.stringify(st2))

  // ── ⑥ 追溯:入库单据按明细行返回多个批次号 ──
  const tr = (await post('/api/px/scheduleBoard/trace', { 工单号: woA, 行id: rowId })).data || {}
  const fins = tr['入库单据'] || []
  const batches = fins.map((f) => f['批次号'])
  ok('⑥ 追溯入库段按明细行显示 3 个批次(20261112/13/14)', fins.length === 3
    && batches.includes('20261112') && batches.includes('20261113') && batches.includes('20261114'),
    JSON.stringify(fins.map((x) => ({ 单: x['单据编号'], 批: x['批次号'], 量: x['实收数量'], 状态: x['单据状态'] }))))

  // ── ⑦ 真实报工提交触发自动生成(无需补生成):按路线顺序 成型→切炭→组装 ──
  const c = await createAndSchedule('X', 10)
  woB = c.wo
  const r1 = await post('/api/px/workReport/submit', { woNo: woB, 工单行号: 1, 工序: '成型', 数量: 5 })
  const r2 = await post('/api/px/workReport/submit', { woNo: woB, 工单行号: 1, 工序: '切炭', 数量: 10 })
  const r3 = await post('/api/px/workReport/submit', { woNo: woB, 工单行号: 1, 工序: '组装', 数量: 10 })
  ok('⑦ 最后一道工序(组装)报工提交/审核成功', r3.code === 200,
    `成型=${r1.code} 切炭=${r2.code}(${r2.message || ''}) 组装=${r3.code}(${r3.message || ''})`)
  const auto = sql(`SELECT f.单据编号, ISNULL(f.批次号,'') batch, ISNULL(d.批号,'') lineBatch, ISNULL(d.实收数量,0) qty
                      FROM dbo.bd_finish_in f LEFT JOIN dbo.bl_finish_in d ON d.单据编号=f.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
                     WHERE f.加工单号=N'${woB}' AND ISNULL(f.asp_cancel,'N')<>'Y' ORDER BY f.单据编号, d.序号`)
  ok('⑦ 报工审核后自动生成入库草稿(批次=完工日,数量=10)', auto.length === 1
    && auto[0].lineBatch === '20261113' && Number(auto[0].qty) === 10,
    JSON.stringify(auto))
} finally {
  cleanup()
  console.log('\n== 汇总 ' + results.filter((x) => x.pass).length + '/' + results.length + ' PASS ==')
  console.log(JSON.stringify({ 工单: woA, 工单2: woB, 单1: doc1, 单2: doc2 }, null, 1))
  process.exit(results.every((x) => x.pass) ? 0 : 1)
}
