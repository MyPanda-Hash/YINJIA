/**
 * 生成器(2026-10-14):产出「出入库单据补金蝶字段」的迁移 SQL。
 *
 * 为什么用生成器:产品入库单 / 其他入库单 / 其他出库单 三类要补的是**同一套套路**
 *   (金蝶回写族 + 金蝶有数据的对照字段 + 拉取幂等族),逐张手写 SQL 容易漏注明/漏译名/漏自检。
 *   规格表写在下面,生成器负责:① 加列(幂等)② 列级中文注明 MS_Description(幂等)
 *   ③ yj_field 面板字段登记(幂等)④ yj_translation en 译名(幂等)⑤ 末尾自检(缺一即 RAISERROR)。
 *
 * 字段取舍依据(用户口径「主要的字段不能少、有数据的字段要保留、不要无用数据」):
 *   金蝶侧真源 = tools/archive/_dump-out/kingdee-3docs-fields-1014.md(逐键 + 样例值)
 *   非空率     = tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.md(30 张真实单据逐键统计)
 *   ⇒ 只登记「非空率 > 0」的键 + 链路必需键(拉取幂等族/转ERP 回写族);恒空键在文档里列明「未登记及原因」。
 *
 * 用法: node tools/archive/_gen-outin-erp-migration.mjs            # 生成全部(或指定 --only FINISH_IN)
 * 产物: tools/migrate-<slug>.sql(仓库迁移链;执行由 DbSync 负责)
 */
import { writeFileSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────
// 通用列族(三类单据共用;与参照面板 采购入库单/销售出库单 同名)
// ─────────────────────────────────────────────────────────────

/** 转ERP 回写族(MES → 金蝶):与 bd_purchase_in / bd_sale_out 同名同型 */
const ERP_FAMILY = [
  ['是否已转ERP', 'nvarchar(10)', '是否已转ERP(转ERP 成功后置「是」;弃审时由 ButtonService 清回「否」)', '文本', 172, 80, 0, 0, 1, 1],
  ['ERP单号', 'nvarchar(50)', 'ERP单号(转ERP 成功后回写的金蝶单号,取自保存响应 data.id_number_map)', '文本', 170, 120, 0, 0, 0, 1],
  ['转ERP操作人', 'nvarchar(50)', '转ERP操作人(执行转ERP 的 MES 用户)', '文本', 174, 100, 0, 0, 0, 1],
  ['转ERP时间', 'datetime2', '转ERP时间(转ERP 成功时刻)', '日期', 176, 130, 0, 0, 0, 1],
]

/** 拉取幂等族(金蝶 → MES):与 bd_so_order / bd_pu_order 同名同型 */
const PULL_FAMILY = [
  ['外部数据ID', 'nvarchar(50)', '外部数据ID(金蝶单据内部 id;拉取同步的幂等键,与 bd_so_order/bd_pu_order 同款)', '文本', 162, 120, 0, 0, 1, 0],
  ['外部单据号', 'nvarchar(50)', '外部单据号(金蝶侧单号,如 CPRK-20261014-00004)', '文本', 160, 130, 0, 0, 0, 1],
  ['外部指纹', 'nvarchar(200)', '外部指纹(金蝶侧关键字段拼接,用于增量同步时判断是否变更)', '文本', 164, 160, 0, 0, 1, 0],
]

/** 金蝶状态族(拉取时回填;与 bd_material_out 同名) */
const KD_STATUS_FAMILY = [
  ['金蝶单据状态', 'nvarchar(20)', '金蝶单据状态(拉取回填:c=已审核 等;转ERP 推送的金蝶侧状态另行查询)', '文本', 178, 100, 0, 0, 0, 1],
  ['金蝶审核人', 'nvarchar(50)', '金蝶审核人(拉取回填)', '文本', 180, 130, 0, 0, 0, 1],
  ['金蝶审核时间', 'datetime2', '金蝶审核时间(拉取回填)', '日期', 182, 130, 0, 0, 0, 1],
]

/** 通用头字段(三类共用的金蝶有数据键;部门/经手人编码/单据类型/创建修改审核族) */
const COMMON_HEAD_KD = [
  ['单据类型', 'nvarchar(50)', '单据类型(金蝶 bill_type_name,如「产品入库单」)', '文本', 135, 120, 0, 0, 0, 1],
  ['部门', 'nvarchar(50)', '部门(金蝶 dept_name;参照部门档案)', '文本', 130, 130, 0, 0, 0, 1],
  ['部门编码', 'nvarchar(50)', '部门编码(金蝶 dept_number;转ERP 推 dept_number 用)', '文本', 131, 110, 0, 0, 0, 1],
  ['经手人编码', 'nvarchar(50)', '经手人编码(金蝶 emp_number;转ERP 推 emp_number 用)', '文本', 72, 110, 0, 0, 0, 1],
  ['创建人', 'nvarchar(50)', '创建人(金蝶 creator_name)', '文本', 140, 100, 0, 0, 1, 0],
  ['创建时间', 'datetime2', '创建时间(金蝶 create_time)', '日期', 142, 130, 0, 0, 1, 0],
  ['修改人', 'nvarchar(50)', '修改人(金蝶 modifier_name)', '文本', 144, 100, 0, 0, 1, 0],
  ['修改时间', 'datetime2', '修改时间(金蝶 modify_time)', '日期', 146, 130, 0, 0, 1, 0],
  ['审核人', 'nvarchar(50)', '审核人(金蝶 auditor_name / MES 审核留痕)', '文本', 150, 100, 0, 0, 0, 1],
  ['审核时间', 'datetime2', '审核时间(金蝶 audit_time / MES 审核留痕)', '日期', 152, 130, 0, 0, 0, 1],
]

/** 行字段:金蝶 inv_product/inv_other_* 分录里「有数据」的单位族与数量族(三类同款) */
const COMMON_LINE_KD = [
  ['序号', 'int', '序号(金蝶分录 seq;打印/核对用)', '整数', 5, 60, 0, 0, 0, 1],
  ['基本单位名称', 'nvarchar(50)', '基本单位名称(金蝶 base_unit_name)', '文本', 62, 100, 0, 0, 0, 1],
  ['基本单位编码', 'nvarchar(50)', '基本单位编码(金蝶 base_unit_number;转ERP 推 base_unit_id 用)', '文本', 63, 100, 0, 0, 1, 0],
  ['基本单位id', 'nvarchar(50)', '基本单位id(金蝶 base_unit_id;转ERP 保存接口收 id)', '文本', 64, 100, 0, 0, 1, 0],
  ['辅助单位名称', 'nvarchar(50)', '辅助单位名称(金蝶 aux_unit_name;多单位商品才有值)', '文本', 65, 100, 0, 0, 0, 1],
  ['辅助单位编码', 'nvarchar(50)', '辅助单位编码(金蝶 aux_unit_number)', '文本', 66, 100, 0, 0, 1, 0],
  ['辅助单位id', 'nvarchar(50)', '辅助单位id(金蝶 aux_unit_id)', '文本', 67, 100, 0, 0, 1, 0],
  ['换算率', 'nvarchar(50)', '换算率(金蝶 conversion_rate,形如「1 kg = 1000 g」,故按文本存)', '文本', 68, 120, 0, 0, 0, 1],
  ['换算系数', 'nvarchar(50)', '换算系数(金蝶 coefficient)', '文本', 69, 100, 0, 0, 1, 0],
  ['辅助换算系数', 'nvarchar(50)', '辅助换算系数(金蝶 aux_coefficient;多单位商品才有值)', '文本', 71, 110, 0, 0, 1, 0],
  ['库存数量', 'nvarchar(50)', '库存数量(金蝶 inv_qty;与该仓库现存量口径一致,按同族面板惯例存文本)', '文本', 92, 100, 0, 0, 0, 1],
]

/** 检验方式:用户 2026-10-14 指定「放明细行、每行一个」;取值与检验方案 QC_PLAN.检验方式 同口径 */
const INSPECT_LINE = ['检验方式', 'nvarchar(10)', '检验方式(全检/抽检;用户 2026-10-14 口径:成品入库后要检验,按明细行登记。⚠ 金蝶 inv_product 保存接口对检验类键静默忽略,故只存 MES 本地、不推送)', '下拉框', 95, 100, 1, 0, 0, 1]

const INSPECT_DICT = "SELECT v FROM (VALUES (N'全检'),(N'抽检')) AS t(v)"

// ─────────────────────────────────────────────────────────────
// 各单据规格(表头表/明细表/额外列/字段清单)
// ─────────────────────────────────────────────────────────────
/** 列定义:[列名, 类型, 中文注明, 字段类型, seq, 宽, editable, required, hidden, visible, dictSql?] */
const SPEC = {
  FINISH_IN: {
    slug: 'finish-in-erp-cols-20261014',
    title: '产成品入库单(FINISH_IN)补金蝶字段 + 明细「检验方式」',
    headTable: 'bd_finish_in',
    lineTable: 'bl_finish_in',
    panel: 'FINISH_IN',
    // 表头已有「经手人」参照字段,这里补编码;部门/创建修改审核/金蝶族全补
    headCols: [...COMMON_HEAD_KD, ...PULL_FAMILY, ...ERP_FAMILY, ...KD_STATUS_FAMILY],
    lineCols: [...COMMON_LINE_KD, INSPECT_LINE],
    inspectDict: INSPECT_DICT,
  },
}

// ─────────────────────────────────────────────────────────────
// 生成
// ─────────────────────────────────────────────────────────────
const q = (s) => (s === null || s === undefined ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`)

function genColAlter(table, [col, type]) {
  return `IF OBJECT_ID(N'dbo.${table}', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.${table}', N'${col}') IS NULL\n    ALTER TABLE dbo.${table} ADD [${col}] ${type} NULL;\nGO`
}
function genColComment(table, [col, , comment]) {
  const guard = `IF COL_LENGTH(N'dbo.${table}', N'${col}') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.${table}')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.${table}'), N'${col}', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'${comment}',
             N'SCHEMA', N'dbo', N'TABLE', N'${table}', N'COLUMN', N'${col}';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'${comment}',
             N'SCHEMA', N'dbo', N'TABLE', N'${table}', N'COLUMN', N'${col}';
END
GO`
  return guard
}
function genField(spec, place, [col, , , dataType, seq, width, editable, required, hidden, visible], dict) {
  const dictSql = dict ? q(dict) : 'NULL'
  return `IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = '${spec.panel}')
   AND COL_LENGTH(N'dbo.${place === 'detail' ? spec.lineTable : spec.headTable}', N'${col}') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = '${spec.panel}' AND label = N'${col}')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('${spec.panel}', N'${col}', N'${col}', N'${dataType}', ${dictSql}, NULL, NULL,
            NULL, '${place}', ${seq}, ${width}, ${editable}, ${required}, ${hidden}, NULL, ${visible});
GO`
}
/** 英文译名(至少 en;AGENTS 多语言强制规范)—— 与既有面板用词保持一致 */
const EN = {
  单据类型: 'Bill Type', 部门: 'Department', 部门编码: 'Department Code', 经手人编码: 'Handler code',
  创建人: 'Creator', 创建时间: 'Created at', 修改人: 'Modifier', 修改时间: 'Modified at',
  审核人: 'Auditor', 审核时间: 'Audit time',
  外部数据ID: 'External ID', 外部单据号: 'External Bill No.', 外部指纹: 'External Fingerprint',
  是否已转ERP: 'Pushed to ERP', ERP单号: 'ERP Bill No.', 转ERP操作人: 'ERP Pushed By', 转ERP时间: 'ERP Pushed At',
  金蝶单据状态: 'Kingdee Bill Status', 金蝶审核人: 'Kingdee Auditor', 金蝶审核时间: 'Kingdee Audit Time',
  序号: 'Seq', 基本单位名称: 'Base Unit', 基本单位编码: 'Base Unit Code', 基本单位id: 'Base Unit ID',
  辅助单位名称: 'Aux Unit', 辅助单位编码: 'Aux Unit Code', 辅助单位id: 'Aux Unit ID',
  换算率: 'Conversion Rate', 换算系数: 'Coefficient', 辅助换算系数: 'Aux Coefficient', 库存数量: 'Inventory Qty',
  检验方式: 'Inspection Mode',
}

function build(spec) {
  const L = []
  L.push('/* ============================================================')
  L.push(`   migrate-${spec.slug}.sql — 2026-10-14`)
  L.push(`   ${spec.title}`)
  L.push('')
  L.push('   背景(用户口径 2026-10-14):')
  L.push('     ① 转ERP 补齐:产品入库单此前**没有**转ERP 通道(现有通道仅 采购入库/销售出库/材料出库),')
  L.push('        要能推金蝶「产品入库单」/jdy/v2/scm/inv_product;')
  L.push('     ② 金蝶回写族 + 拉取幂等族按参照面板同名落地(采购入库单/销售出库单有 ERP 族,')
  L.push('        销售订单/采购订单有 外部数据ID/外部单据号/外部指纹 族);')
  L.push('     ③ 检验字段:用户指定放**明细行**(每行一个「检验方式」= 全检/抽检,与检验方案 QC_PLAN.检验方式 同口径)。')
  L.push('        ⚠ 沙箱实测(2026-10-14):金蝶 inv_product 保存接口对 check_type/inspect_way/qc_type')
  L.push('          **静默忽略且不报错** ⇒ 该字段只存 MES 本地,不推送(证据 tools/archive/_dump-out/kingdee-save-inv-product-1014.md);')
  L.push('     ④ 对照字段取自金蝶有数据的键(30 张真实单据逐键非空率统计见')
  L.push('        tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.md):表头 单据类型/部门(编码)/经手人编码/创建修改审核族;')
  L.push('        分录 序号/基本单位三件套/辅助单位三件套/换算率/换算系数/辅助换算系数/库存数量。')
  L.push('        恒空键(sp_ 族 / src_ 族 / price / cost / kf_ 族 / sn_ 族 / pro_ 族 / barcode / customer_ 族 等)按用户口径「不要无用数据」**不登记**。')
  L.push('')
  L.push('   幂等(COL_LENGTH 守卫 + 注明 add/update 双向 + yj_field NOT EXISTS + 译名 NOT EXISTS);两账套均执行。')
  L.push('   ============================================================ */')
  L.push('SET NOCOUNT ON;')
  L.push('GO')
  L.push(`-- ① 加列:${spec.headTable}(表头)`)
  for (const c of spec.headCols) L.push(genColAlter(spec.headTable, c))
  L.push(`-- ① 加列:${spec.lineTable}(明细)`)
  for (const c of spec.lineCols) L.push(genColAlter(spec.lineTable, c))
  L.push('-- ② 列级中文注明(规范 §4.7:新增列必须注明)')
  for (const c of spec.headCols) L.push(genColComment(spec.headTable, c))
  for (const c of spec.lineCols) L.push(genColComment(spec.lineTable, c))
  L.push('-- ③ 面板字段登记(表头 + 明细)')
  for (const c of spec.headCols) L.push(genField(spec, 'header', c))
  for (const c of spec.lineCols) L.push(genField(spec, 'detail', c, c[0] === '检验方式' ? spec.inspectDict : null))
  L.push('-- ④ en 译名(标签全局共享;已有则不重复插,避免撞 uq_translation)')
  for (const c of [...spec.headCols, ...spec.lineCols]) {
    const label = c[0]
    const en = EN[label]
    if (!en) continue
    L.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'${label}' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'${label}', 'en', N'${en}', 'manual');
GO`)
  }
  L.push('-- ⑤ 自检:列 + 注明 + 字段登记 + 译名 齐备(缺一即失败)')
  L.push('DECLARE @bad int = 0;')
  for (const c of spec.headCols) {
    L.push(`IF COL_LENGTH(N'dbo.${spec.headTable}', N'${c[0]}') IS NULL SET @bad = @bad + 1;`)
    L.push(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.${spec.headTable}') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.${spec.headTable}'), N'${c[0]}', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;`)
    L.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = '${spec.panel}' AND label = N'${c[0]}') SET @bad = @bad + 1;`)
  }
  for (const c of spec.lineCols) {
    L.push(`IF COL_LENGTH(N'dbo.${spec.lineTable}', N'${c[0]}') IS NULL SET @bad = @bad + 1;`)
    L.push(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.${spec.lineTable}') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.${spec.lineTable}'), N'${c[0]}', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;`)
    L.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = '${spec.panel}' AND label = N'${c[0]}') SET @bad = @bad + 1;`)
  }
  L.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'检验方式' AND locale = 'en') SET @bad = @bad + 1;`)
  L.push(`IF @bad > 0 RAISERROR(N'${spec.panel} 金蝶字段自检失败(%d 项缺失)', 16, 1, @bad);`)
  L.push(`ELSE PRINT N'${spec.panel} 金蝶字段就绪(列 + 注明 + 字段登记 + en 译名;幂等)';`)
  L.push('GO')
  return L.join('\n') + '\n'
}

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
let n = 0
for (const [panel, spec] of Object.entries(SPEC)) {
  if (only && only !== panel) continue
  const sql = build(spec)
  const out = new URL(`../migrate-${spec.slug}.sql`, import.meta.url)
  writeFileSync(out, sql, 'utf8')
  console.log(`生成 tools/migrate-${spec.slug}.sql  (${sql.split('\n').length} 行;表头列 ${spec.headCols.length} / 明细列 ${spec.lineCols.length})`)
  n++
}
if (n === 0) console.log('没有匹配的规格')
