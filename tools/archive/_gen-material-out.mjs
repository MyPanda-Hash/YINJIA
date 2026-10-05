// 生成器:材料出库单(MATERIAL_OUT)面板字段与「金蝶·生产领料单 inv_pick」接口并集完全对应
//   —— 与 tools/archive/_gen-inbound-outbound.mjs(采购入库/销售出库)同构,口径一致:
//      ① 头并集 = 列表键 ∪ 详情键;行并集 = material_entity 子表键
//      ② 已由现有 MES 列代表的接口键(MAPPED)不重复建列
//      ③ 列类型统一 nvarchar(500)(与采购入库同款);yj_field + en 译名 + MS_Description 中文注明
//      ④ 可见性 = 「实测常见」:真实账套非空率 ≥50% 且非恒零的键显示,其余(id/创建修改/空值族)隐藏
//      ⑤ 价格族(price/cost/unit_cost)强制显示(用户口径:尤其关注价格)
//  输入:tools/archive/_invpick-fields.json(真实账套实测) + tools/archive/_matout-inventory.out(库现状)
//  输出:tools/migrate-material-out-fields.sql + deploy/kingdee-extra-fields.mjs 的 MATERIAL_OUT 条目
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(readFileSync(join(HERE, '_invpick-fields.json'), 'utf8'));

// ── 库现状(现有列 / 现有面板字段):从 SqlRunner 输出解析「| kind | a | b |」 ──
const cols = new Map();   // 表名 → Set(列名)
const panelFields = new Set();
for (const line of readFileSync(join(HERE, '_matout-inventory.out'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*\|\s*([CF])\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
  if (!m) continue;
  if (m[1] === 'C') { if (!cols.has(m[2])) cols.set(m[2], new Set()); cols.get(m[2]).add(m[3]); }
  else panelFields.add(m[3]);
}

// ── 现有 MES 列已代表的接口键(不重复建列;同步/推送直接映射到这些列) ──
const MAPPED_HEAD = ['bill_no', 'bill_date', 'remark', 'dept_name', 'emp_name'];
const MAPPED_LINE = ['material_number', 'material_name', 'material_model', 'qty', 'price',
  'unit_name', 'stock_name', 'batch_no', 'comment'];

// 容器/id 型键:不落列(与采购入库口径一致)
const SKIP = new Set(['id', 'custom_field', 'custom_entity_field', 'material_entity']);

// 标签表:沿用采购入库已验证的覆盖表(同名同义键跨面板共用一套中文标签与译名),
// 并补齐 inv_pick 独有键(领料类型/领料用途/单据类型/辅助属性 1..3/源单产品分录)
const LABEL = {
  // ⚠ 2026-09-28「中英文混杂」清理:下列标签曾按采购入库那份生成器的兜底规则长成
  //   `<中文>_<接口键>`(单据状态_bill_status / 审核时间_audit_time / 审核人_auditor_name),
  //   id 类键还直接用了裸英文列名(dept_id/creator_id/…)。已由
  //   tools/migrate-material-out-label-cleanup.sql 就地改名(列名+yj_field+译名),
  //   这里同步成清洁名,保证**再跑本生成器不会又把混杂名写回去**。
  //   注:磁盘上已应用的 tools/migrate-material-out-fields.sql 保留旧名(字节不能动,
  //   一动 DbSync 会重跑);新库由「字段并集 → 标签清理」两步得到同样的清洁名
  //   (清理脚本对「新旧两列并存」也有兜底,见该脚本注释)。
  bill_status: '金蝶单据状态', create_time: '创建时间', modify_time: '修改时间', audit_time: '金蝶审核时间',
  creator_name: '创建人', creator_number: '创建人编码', modifier_name: '修改人', modifier_number: '修改人编码',
  auditor_name: '金蝶审核人', auditor_number: '审核人编码', dept_name: '部门', dept_number: '部门编码',
  dept_id: '部门id', creator_id: '创建人id', modifier_id: '修改人id', auditor_id: '审核人id',
  bill_type_id: '单据类型id', emp_id: '经手人id', pick_use_id: '领料用途id',
  emp_number: '经手人编码', bill_type_name: '单据类型名称', bill_type_number: '单据类型编码',
  pick_type: '领料类型', pick_use_name: '领料用途名称', pick_use_number: '领料用途编码',
  mul_bill_label: '单据标签',
  // 行
  material_id: '商品id', stock_id: '仓库id', stock_name: '仓库名称', stock_number: '仓库编码',
  stock_is_allow_freight: '仓库启用仓位管理', sp_id: '仓位id', sp_name: '仓位名称', sp_number: '仓位编码',
  base_unit_id: '基本单位id', base_unit_name: '基本单位名称', base_unit_number: '基本单位编码',
  unit_id: '单位id', unit_number: '单位编码',
  aux_unit_id: '辅助单位id', aux_unit_name: '辅助单位名称', aux_unit_number: '辅助单位编码',
  aux_coefficient: '辅助换算系数', coefficient: '换算系数', conversion_rate: '换算率',
  aux_prop_id: '辅助属性id', aux_prop_name: '辅助属性名称', aux_prop_number: '辅助属性编码',
  aux1_id: '辅助属性1id', aux1_name: '辅助属性1名称', aux1_number: '辅助属性1编码',
  aux2_id: '辅助属性2id', aux2_name: '辅助属性2名称', aux2_number: '辅助属性2编码',
  aux3_id: '辅助属性3id', aux3_name: '辅助属性3名称', aux3_number: '辅助属性3编码',
  barcode: '条形码', pro_place: '产地', pro_reg_no: '注册证号', pro_license: '生产许可证',
  kf_date: '保质期到期日', valid_date: '有效期至', kf_type: '保质期类型', kf_period: '保质期',
  sn_list: '序列号清单', sn_list_id: '序列号流转ID', seq: '行号', picture: '图片',
  qty: '数量', inv_qty: '库存数量', base_qty: '基本数量', inv_base_qty: '库存基本数量',
  aux_qty: '辅助数量', def_float_qty: '默认浮动数量',
  price: '单价', cost: '成本', unit_cost: '单位成本',
  src_bill_no: '源单编号', src_bill_type_id: '源单类型id', src_bill_type_name: '源单类型名称',
  src_bill_type_number: '源单类型编码', src_inter_id: '源单内部id', src_bill_date: '源单日期',
  src_seq: '源单行号', src_entry_id: '源单分录id', src_product_entry_id: '源单产品分录id',
  material_is_multi_unit: '商品是否多单位', material_is_serial: '商品是否序列号',
  material_is_asst_attr: '商品是否辅助属性', material_is_kf_period: '商品是否保质期',
  material_is_batch: '商品是否批次', comment: '明细备注',
};

// ── 可见性口径(实测常见) ──
// 真实账套实测恒为零/空的键:即便接口有值位也不显示(避免一屏 0)
const ALL_ZERO = new Set(['price', 'cost', 'unit_cost', 'inv_base_qty', 'aux_qty', 'def_float_qty',
  'aux_coefficient', 'kf_period', 'src_seq', 'src_inter_id', 'src_entry_id', 'src_product_entry_id', 'sn_list_id']);
const FORCE_VISIBLE = /^(price|cost|unit_cost)$/;   // 价格族:用户口径「尤其关注价格」→ 一律显示
const HIDE = /_id$|creator|modifier|auditor_id|auditor_number|attachments|custom_field|^id$|picture/;
const humanize = (k) => k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
// 英文译名覆盖:与 migrate-material-out-label-cleanup.sql 里写死的 en 保持一致 ——
// 否则「先跑字段并集(新库)」与「先跑清理(老库)」两条路会得到不同的英文界面文案。
const EN_OVERRIDE = {
  bill_status: 'Kingdee Bill Status',
  audit_time: 'Kingdee Audit Time',
  auditor_name: 'Kingdee Auditor',
};
const enOf = (k) => EN_OVERRIDE[k] || humanize(k);

const isCommon = (key, stat, total) => (Number(stat[key] || 0) >= 0.5 * total) && !ALL_ZERO.has(key);
const isVisible = (key, stat, total) => (isCommon(key, stat, total) || FORCE_VISIBLE.test(key)) && !HIDE.test(key);

// ── 并集 ──
const headUnion = [...new Set([...(api.listKeys || []), ...(api.detailKeys || [])])];
const lineKeys = api.subKeys?.material_entity || [];
const headDelta = headUnion.filter((k) => !MAPPED_HEAD.includes(k) && !SKIP.has(k));
const lineDelta = lineKeys.filter((k) => !MAPPED_LINE.includes(k) && !SKIP.has(k));

const sql = [];
sql.push('-- migrate-material-out-fields.sql — 材料出库单(MATERIAL_OUT)面板字段与「金蝶·生产领料单 inv_pick」接口并集对应');
sql.push('-- 生成器:tools/archive/_gen-material-out.mjs(勿手改;改口径请改生成器后重跑)');
sql.push('-- 依据:金蝶云·星辰真实账套只读实测(生产领料单 4801 张,采样 40 张/156 行,探针 deploy/_probe-invpick-fields.mjs)');
sql.push('--   · 头并集 = 列表键 ∪ 详情键;行并集 = material_entity 子表键;类型统一 nvarchar(500)(与采购入库同款)');
sql.push('--   · 已由现有列代表的键不重复建列:头 ' + MAPPED_HEAD.join('/') + ';行 ' + MAPPED_LINE.join('/'));
sql.push('--   · 可见性=实测常见(非空率≥50% 且非恒零);id/创建人/修改人/图片等恒定隐藏;价格族(成本/单位成本)强制显示');
sql.push('--   · ⚠ 金蝶生产领料单**没有税金族键**(无 税率%/税额/含税单价/金额/价税合计)——按用户口径不建税金列');
// ⚠ 刻意不写 `USE HSDZ_MES;`(采购入库那份生成器写了,是个坑:两账套纪律下
//   对 HSDZ_MES_TEST 跑同一条脚本会被 USE 切回正式库)——按连接的当前库执行,两个账套各自生效。
sql.push('SET NOCOUNT ON;');
sql.push('GO');
sql.push('');

const EXTRA_NEW = [];
const EXTRA_LINES_NEW = [];
const visibleHead = [], visibleLine = [], hiddenHead = [], hiddenLine = [];
const comments = [];

let seqH = 970, seqL = 970;
for (const k of headDelta) {
  const label = panelFields.has(LABEL[k] || k) || (cols.get('bd_material_out') || new Set()).has(LABEL[k] || k)
    ? `${LABEL[k] || k}_${k}` : (LABEL[k] || k);
  if (panelFields.has(label)) continue;                       // 已注册则跳过(幂等)
  const vis = isVisible(k, api.headStat, api.docs) ? 1 : 0;
  (vis ? visibleHead : hiddenHead).push(`${k}→${label}`);
  EXTRA_NEW.push({ c: label, a: k, t: 'str' });
  sql.push(`-- 头.${label}  ← 金蝶 inv_pick 头键 ${k}(实测非空 ${api.headStat[k] || 0}/${api.docs})`);
  sql.push(`IF COL_LENGTH('dbo.bd_material_out', N'${label}') IS NULL ALTER TABLE dbo.bd_material_out ADD [${label}] nvarchar(500) NULL;`);
  sql.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'${label}')`);
  sql.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'${label}', N'${label}', N'文本', N'header', ${seqH++}, 130, 1, 0, ${1 - vis}, ${vis});`);
  sql.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
  sql.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'${enOf(k)}', 'manual');`);
  comments.push([label, 'bd_material_out', k]);
}
sql.push('GO', '');
for (const k of lineDelta) {
  const label = panelFields.has(LABEL[k] || k) || (cols.get('bl_material_out') || new Set()).has(LABEL[k] || k)
    ? `${LABEL[k] || k}_${k}` : (LABEL[k] || k);
  if (panelFields.has(label)) continue;
  const vis = isVisible(k, api.lineStat, api.lines) ? 1 : 0;
  (vis ? visibleLine : hiddenLine).push(`${k}→${label}`);
  EXTRA_LINES_NEW.push({ c: label, a: k, t: 'str' });
  sql.push(`-- 行.${label}  ← 金蝶 inv_pick 行键 ${k}(实测非空 ${api.lineStat[k] || 0}/${api.lines})`);
  sql.push(`IF COL_LENGTH('dbo.bl_material_out', N'${label}') IS NULL ALTER TABLE dbo.bl_material_out ADD [${label}] nvarchar(500) NULL;`);
  sql.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'${label}')`);
  sql.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'${label}', N'${label}', N'文本', N'detail', ${seqL++}, 120, 1, 0, ${1 - vis}, ${vis});`);
  sql.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
  sql.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'${enOf(k)}', 'manual');`);
  comments.push([label, 'bl_material_out', k]);
}
sql.push('GO', '');

// ── 中文注明(MS_Description;幂等:已存在则跳过) ──
sql.push('-- ══ 新增列中文注明(AGENTS.md:结构变更补注;幂等) ══');
for (const [label, tbl, key] of comments) {
  sql.push(`IF COL_LENGTH(N'dbo.${tbl}', N'${label}') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.${tbl}') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.${tbl}'), N'${label}', 'ColumnId') AND ep.name=N'MS_Description')`);
  sql.push(`  EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 ${key}', N'SCHEMA', N'dbo', N'TABLE', N'${tbl}', N'COLUMN', N'${label}';`);
}
sql.push('GO', '');
sql.push("PRINT N'migrate-material-out-fields 完成';");
sql.push('GO');
writeFileSync(join(HERE, '..', 'migrate-material-out-fields.sql'), sql.join('\n'), 'utf8');

// ── deploy/kingdee-extra-fields.mjs:追加 MATERIAL_OUT 条目(键顺序保持,新键追加在末尾) ──
const extraPath = join(HERE, '..', '..', 'deploy', 'kingdee-extra-fields.mjs');
const mod = await import(new URL('../../deploy/kingdee-extra-fields.mjs', import.meta.url).href + '?t=' + Date.now());
const EXTRA = { ...mod.EXTRA }, EXTRA_LINES = { ...mod.EXTRA_LINES };
if (EXTRA_NEW.length) EXTRA.MATERIAL_OUT = EXTRA_NEW;
if (EXTRA_LINES_NEW.length) EXTRA_LINES.MATERIAL_OUT = EXTRA_LINES_NEW;
writeFileSync(extraPath, [
  '// kingdee-extra-fields.mjs — 全并集自动映射表(生成器产出,勿手改)',
  '//   EXTRA: 头/档案级 c=列 a=接口键(支持 dotted) t=dec/join/str',
  '//   EXTRA_LINES: 单据行级(键取自 material_entity 元素)',
  '//   注意:PURCHASE_IN/SALE_OUT/MATERIAL_OUT 的条目已备好但 sync-core 尚未接入(待同步脚本特殊要求)',
  `export const EXTRA = ${JSON.stringify(EXTRA, null, 2)};`,
  '',
  `export const EXTRA_LINES = ${JSON.stringify(EXTRA_LINES, null, 2)};`,
  '',
].join('\n'), 'utf8');

console.log(`头并集 ${headUnion.length} 键(已对应 ${MAPPED_HEAD.length},补 ${headDelta.length})`);
console.log(`行并集 ${lineKeys.length} 键(已对应 ${MAPPED_LINE.length},补 ${lineDelta.length})`);
console.log(`\n【头·显示(${visibleHead.length})】${visibleHead.join(' | ')}`);
console.log(`【头·隐藏(${hiddenHead.length})】${hiddenHead.join(' | ')}`);
console.log(`\n【行·显示(${visibleLine.length})】${visibleLine.join(' | ')}`);
console.log(`【行·隐藏(${hiddenLine.length})】${hiddenLine.join(' | ')}`);
console.log('\n已生成:tools/migrate-material-out-fields.sql + deploy/kingdee-extra-fields.mjs(MATERIAL_OUT)');

