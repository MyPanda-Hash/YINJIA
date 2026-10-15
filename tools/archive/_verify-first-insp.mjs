/*
 * _verify-first-insp.mjs — 首件检验单(QC_FIRST_INSP)端到端验收(2026-10-15)
 *
 * 【用户口径】「当前增加首件检验,实现方式参考成品检验单,首件检验的数据来源于当前生产工单的单据
 *   当前批次第一次报工产生,检验方式参考成型工艺清单内的检验要求进行编写」。
 *
 * 【验什么】
 *   ① 面板就绪:getPanelConfig(QC_FIRST_INSP) 200 + 工具栏含「取成型工艺清单」;
 *   ② 取数接口:/qc/firstInsp/fromMoldProc 按产品编码取《成型工艺清单》→ 5 个检验项目
 *      (炭棒尺寸/密度管控/跌落强度/抗压强度/压降),检验要求按该单字段**拼接**;
 *      该产品没有工艺清单时 moldProcNo 为空、仍回 5 行项目名(不编造要求文案);
 *   ③ 自动出单:本(工单号,批次号,工单行号)**第一张**报工审核 → 自动出一张首件检验单草稿,
 *      表头照抄报工、明细预铺 5 行;
 *   ④ 幂等:同批次第二张报工审核 → **不再**出第二张;
 *   ⑤ 可撤回:报工弃审 → 首件检验单作废(与三张工序检验单同一套占用链)。
 *
 * ⚠ 全在**测试账套** HSDZ_MES_TEST(factory=YJ_TEST)上跑:会写业务单据,跑完自删(硬删)并还原
 *   被临时改过的演示工艺清单。不碰正式账。
 * 用法: node tools/archive/_verify-first-insp.mjs [base]
 */
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const API = BASE + '/api'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const made = { 报工单: [], 首件检验单: [] }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
async function get(path) {
  const r = await fetch(API + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
const msg = (r) => r.json?.message || r.text?.slice(0, 220)
const rowsOf = (r) => {
  const d = r.json?.data
  if (Array.isArray(d)) return d
  return d?.list || d?.rows || d?.records || d?.items || []
}
const list = (panel) => post('/px/queryFormDataList', { panelCode: panel, condition: {}, pageNo: 1, pageSize: 500 })
const btn = (panelCode, buttonName, formData, buttonParam) =>
  post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: buttonParam || {} })

const lg = await post('/auth/login', { userName: 'admin', password: '123456', factory: FACTORY })
token = lg.json?.data?.token
if (!token) { console.error('登录失败: ' + msg(lg)); process.exit(1) }
console.log(`== 首件检验单验收 @ ${BASE} (账套 ${DB}) ==`)

try {
  // ── ① 面板就绪 ───────────────────────────────────────────────────────────
  const cfg = await get('/px/getPanelConfig?panelCode=QC_FIRST_INSP')
  const cfgData = cfg.json?.data || {}
  const buttons = JSON.stringify(cfgData.metadata?.buttonGroups || [])
  ok('① getPanelConfig(QC_FIRST_INSP) 200', cfg.status === 200, `status=${cfg.status}`)
  ok('① 工具栏含「取成型工艺清单」', buttons.includes('取成型工艺清单'))
  ok('① 工具栏含「检验项目/检验方案」', buttons.includes('检验项目/检验方案'))
  ok('① 工具栏不含「取出货检验计划」(来源是成型工艺清单,不是出货计划)',
    !buttons.includes('取出货检验计划'))
  const hdrFields = (cfgData.dataSchema?.fields || cfgData.dataSchema?.headerFields || [])
  console.log(`    表头字段数=${hdrFields.length}`)

  // ── ② 取数接口:工艺清单 → 5 个检验项目 ────────────────────────────────────
  const MP = 'DEMO-MP-001'
  const PROD = 'DEMO-A-001'
  const backup = (await q(`SELECT 外径mm,外径公差,内径mm,内径公差,密度管控要求,实际密度管控下限,实际密度管控上限,
      跌落高度cm,跌落次数,跌落要求,测试间距mm,压头下降速度,强度要求kgf,压降测试管路,压降测试流速,压降标准kpa,压降是否测试
    FROM dbo.rd_mold_proc_head WHERE 单据编号=N'${MP}'`))[0]
  // 临时给演示工艺清单填上检验要求(验完还原;测试账套允许造数)
  await q(`UPDATE dbo.rd_mold_proc_head SET 外径mm=N'34.5',外径公差=N'±0.5',内径mm=N'12.5',内径公差=N'±0.5',
      密度管控要求=N'密度范围 0.55~0.65',实际密度管控下限=N'0.55',实际密度管控上限=N'0.65',
      跌落高度cm=N'50',跌落次数=N'3',跌落要求=N'炭棒无断裂',
      测试间距mm=N'40',压头下降速度=N'5',强度要求kgf=N'30',
      压降测试管路=N'大T滤瓶',压降测试流速=N'0.9',压降标准kpa=N'20',压降是否测试=N'√'
    WHERE 单据编号=N'${MP}'`)

  const fm = await get(`/qc/firstInsp/fromMoldProc?productCode=${encodeURIComponent(PROD)}`)
  const fmd = fm.json?.data || {}
  ok('② fromMoldProc 200', fm.status === 200, `status=${fm.status}`)
  ok('② 命中工艺清单单号', String(fmd.moldProcNo || '') === MP, `moldProcNo=${fmd.moldProcNo}`)
  const frows = fmd.rows || []
  const names = frows.map((r) => r['检验项目'])
  ok('② 回 5 个检验项目且顺序与检验要求区块一致',
    JSON.stringify(names) === JSON.stringify(['炭棒尺寸', '密度管控', '跌落强度', '抗压强度', '压降']),
    JSON.stringify(names))
  const reqOf = (n) => String((frows.find((r) => r['检验项目'] === n) || {})['检验要求'] || '')
  ok('② 炭棒尺寸:外径/内径+公差拼接', reqOf('炭棒尺寸') === '炭棒外径:34.5±0.5;炭棒内径:12.5±0.5', reqOf('炭棒尺寸'))
  ok('② 密度管控:范围+上下限拼接',
    reqOf('密度管控') === '密度范围:密度范围 0.55~0.65;实际管控下限:0.55;实际管控上限:0.65', reqOf('密度管控'))
  ok('② 跌落强度:高度+次数+要求拼接(带单位)',
    reqOf('跌落强度') === '高度:50cm;跌落次数:3次;要求:炭棒无断裂', reqOf('跌落强度'))
  ok('② 抗压强度:间距+速度+强度拼接(带单位)',
    reqOf('抗压强度') === '测试间距:40mm;压头下降速度:5mm/min;强度要求:30kgf', reqOf('抗压强度'))
  ok('② 压降:管路+流速+标准+是否测试拼接',
    reqOf('压降') === '测试管路:大T滤瓶;测试流速:0.9L/min;压降标准:20kpa;是否测试:√', reqOf('压降'))
  ok('② 每行的表区都是「检验项目」', frows.every((r) => r['表区'] === '检验项目'))

  const none = await get('/qc/firstInsp/fromMoldProc?productCode=NO-SUCH-PRODUCT-XYZ')
  const nd = none.json?.data || {}
  ok('② 无工艺清单的产品:moldProcNo 为空但仍是 5 行(只有项目名,不编造要求)',
    !nd.moldProcNo && (nd.rows || []).length === 5 && (nd.rows || []).every((r) => !r['检验要求']),
    `moldProcNo=${nd.moldProcNo} rows=${(nd.rows || []).length}`)

  // ── ③ 报工审核 → 自动出首件检验单 ─────────────────────────────────────────
  const cands = await q(`SELECT TOP 20 p.pl_no AS 工单号, p.pl_xc AS 行, ISNULL(p.[批次号],'') AS 批次号, p.dm AS 产品编码, p.scx AS 生产线
    FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') NOT IN ('Y','T')
      AND ISNULL(p.scx,'')<>'' AND ISNULL(p.pl_sl,0)>0 AND ISNULL(p.[批次号],'')<>''
      AND NOT EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'
            AND (EXISTS(SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=p.id)
                 OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],'')=ISNULL(p.[批次号],''))))
      AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h WHERE h.工单号=p.pl_no AND ISNULL(h.批次号,'')=ISNULL(p.[批次号],'') AND ISNULL(h.asp_cancel,'N')<>'Y')
    ORDER BY p.id DESC`)
  const cand = cands[0]
  if (!cand) { bad('③ 测试库找不到「本行本批次还没有已审核报工」的工单行,无法验收自动出单') } else {
    console.log(`    工单 ${cand.工单号}#${cand.行} 批次 ${cand.批次号} 产品 ${cand.产品编码}`)
    // 工序必须走该工单行**工艺路线的首道**(报工审核有「不得跳序」守卫,见 WoReportService.complete)
    const route = (await q(`SELECT TOP 1 ISNULL([工艺路线],'') AS r FROM dbo.plang
      WHERE pl_no=N'${cand.工单号}' AND ISNULL(pl_xc,0)=${cand.行} AND ISNULL(asp_cancel,'N')<>'Y'`))[0]?.r || ''
    let ops = []
    if (route) {
      ops = (await q(`SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=N'${route}'
        AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,'')<>'' ORDER BY ISNULL(加工顺序,999)`)).map((r) => r['工序名称'])
    }
    const firstOp = ops[0] || '成型'
    console.log(`    工艺路线 ${route || '(未关联)'} 首道工序 = ${firstOp}`)
    const save = await btn('WO_REPORT', '保存', {
      单据日期: new Date().toISOString().slice(0, 10),
      detail: { items: [{ 工单号: cand.工单号, 工序: firstOp, 报工数量: 5, 报工人: 'admin', 批次号: cand.批次号 }] },
    })
    const repNo = save.json?.data?.编号
    if (!repNo) { bad('③ 报工单保存失败: ' + msg(save)) } else {
      made.报工单.push(repNo)
      const au = await btn('WO_REPORT', '审核', { 编号: repNo })
      if (au.status !== 200) { bad('③ 报工审核失败: ' + msg(au)) } else {
        const l = await list('QC_FIRST_INSP')
        const doc = rowsOf(l).find((r) => String(r['报工单号'] || '') === String(repNo))
        if (!doc) {
          bad(`③ 报工 ${repNo}(工序 ${firstOp}) 审核后未见首件检验单`)
        } else {
          const no = doc['单据编号']
          made.首件检验单.push(no)
          ok(`③ 第一张报工审核 → 自动生成首件检验单 ${no}`)
          ok('③ 表头照抄报工(工单号/批次号/工单行号/产品编码)',
            String(doc['工单号']) === cand.工单号 && String(doc['批次号']) === cand.批次号
            && String(doc['产品编码']) === cand.产品编码,
            JSON.stringify({ 工单号: doc['工单号'], 批次号: doc['批次号'], 产品编码: doc['产品编码'] }))
          const fd = await get('/px/getFormDescriptor?panelCode=QC_FIRST_INSP&code=' + encodeURIComponent(no))
          const fdoc = fd.json?.data || {}
          const dd = fdoc.detailData
          const items = Array.isArray(dd) ? dd : (dd?.items || [])
          ok('③ 明细预铺 5 行检验项目',
            items.length === 5 && items.every((r) => r['检验项目']),
            `n=${items.length} ${JSON.stringify(items.map((r) => r['检验项目']))}`)
          ok('③ 明细 5 行 = 工艺清单检验要求区块的 5 个块',
            JSON.stringify(items.map((r) => r['检验项目']).sort()) ===
            JSON.stringify(['压降', '密度管控', '抗压强度', '炭棒尺寸', '跌落强度']))

          // ── ④ 幂等:同批次再来一张报工 ─────────────────────────────────────
          const save2 = await btn('WO_REPORT', '保存', {
            单据日期: new Date().toISOString().slice(0, 10),
            detail: { items: [{ 工单号: cand.工单号, 工序: firstOp, 报工数量: 3, 报工人: 'admin', 批次号: cand.批次号 }] },
          })
          const repNo2 = save2.json?.data?.编号
          if (repNo2) {
            made.报工单.push(repNo2)
            const au2 = await btn('WO_REPORT', '审核', { 编号: repNo2 })
            if (au2.status !== 200) { bad('④ 第二张报工审核失败: ' + msg(au2)) } else {
              const l2 = await list('QC_FIRST_INSP')
              const mine = rowsOf(l2).filter((r) => String(r['工单号']) === cand.工单号
                && String(r['批次号']) === cand.批次号 && String(r['asp_cancel'] || 'N') !== 'Y')
              ok('④ 同批次第二张报工审核 → 不再出第二张首件检验单', mine.length === 1,
                `本行本批次存活首件检验单 = ${mine.length} 张`)
            }
          } else bad('④ 第二张报工保存失败: ' + msg(save2))

          // ── ⑤ 弃审 → 首件检验单随之作废 ────────────────────────────────────
          const un = await btn('WO_REPORT', '弃审', { 编号: repNo })
          if (un.status !== 200) {
            bad('⑤ 报工弃审失败: ' + msg(un))
          } else {
            const l3 = await list('QC_FIRST_INSP')
            const alive = rowsOf(l3).find((r) => String(r['单据编号']) === no)
            ok('⑤ 报工弃审 → 首件检验单作废(列表不再出现)', !alive)
            const dbAlive = (await q(`SELECT ISNULL(asp_cancel,'N') AS c FROM dbo.qc_first_insp_head WHERE 单据编号=N'${no}'`))[0]
            ok('⑤ 库内该单已标 asp_cancel=Y', dbAlive?.c === 'Y', `asp_cancel=${dbAlive?.c}`)
          }
        }
      }
    }
  }

  // ── 还原演练用的演示工艺清单 ───────────────────────────────────────────────
  const setSql = Object.entries(backup || {}).map(([k, v]) => `[${k}]=${v === null ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`}`).join(',')
  if (setSql) await q(`UPDATE dbo.rd_mold_proc_head SET ${setSql} WHERE 单据编号=N'${MP}'`)
  console.log('  (演示工艺清单已还原)')

  // ── 清场:硬删本探针造的单据(测试账套) ─────────────────────────────────────
  for (const no of made.首件检验单) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${no}'; DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=N'${no}'`)
  }
  for (const no of made.报工单) {
    await q(`DELETE FROM dbo.form_flow_link WHERE source_panel_code='WO_REPORT' AND source_form_no=N'${no}'`)
    await q(`DELETE FROM dbo.scjl WHERE 报工单号=N'${no}'`)
  }
  await q(`DELETE FROM dbo.form_flow_link WHERE target_panel_code='QC_FIRST_INSP'
             AND target_form_no NOT IN (SELECT 单据编号 FROM dbo.qc_first_insp_head)`)
  console.log(`  清场:删报工单 ${made.报工单.length} 张 / 首件检验单 ${made.首件检验单.length} 张`)
} finally {
  await pool.close()
}

console.log(`\n== 首件检验单验收:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
