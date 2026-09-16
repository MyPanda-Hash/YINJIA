// 生成器:子实体全并集(订单行 material_entity + 客户/供应商联系人 bomentity)与面板完全对应
// 输出:① kingdee-extra-fields.mjs 追加 EXTRA_LINES(行级)/EXTRA 子项(联系人 dotted 路径)
//      ② tools/migrate-kingdee-subentity-union.sql(行表/档案表补列+面板字段+英译)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from '../../deploy/sync-core.mjs';
import { EXTRA } from '../../deploy/kingdee-extra-fields.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sub = JSON.parse(readFileSync(join(HERE, '_subentity-keys.json'), 'utf8'));
// 现有物理列
const existCols = new Map();
for (const line of readFileSync(join(HERE, '_archcols.out'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('|')) continue;
  const [t, c] = line.split('|');
  if (!existCols.has(t)) existCols.set(t, new Set());
  existCols.get(t).add(c);
}
// 现有面板列
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, new Set());
  panelCols.get(p).add(c);
}
// 对照文档标签
const SECTION = { BD_CUSTOMER: '## 客户', BD_SUPPLIER: '## 供应商', SO_ORDER: '## 销售订单(表头+商品分录)', PU_ORDER: '## 采购订单(表头+商品分录)' };
const docLabels = new Map();
{
  const lines = readFileSync(join(HERE, '..', '..', 'deploy', '面板字段对照.md'), 'utf8').split(/\r?\n/);
  let sec = null;
  for (const l of lines) {
    if (l.startsWith('## ') || l.startsWith('# ')) { sec = l.trim(); continue; }
    if (!sec || !l.startsWith('|')) continue;
    const cells = l.split('|').map((x) => x.trim());
    if (cells.length < 4 || cells[1] === '字段' || /^-+$/.test(cells[1])) continue;
    if (!docLabels.has(sec)) docLabels.set(sec, new Map());
    docLabels.get(sec).set(cells[1], cells[3]);
  }
}
const LABEL_OVERRIDE = {
  material_id: '商品id', stock_id: '仓库id', sp_id: '仓位id', base_unit_id: '基本单位id', unit_id: '单位id',
  aux_unit_id: '辅助单位id', aux_id1: '辅助属性1id', aux_id2: '辅助属性2id', aux_id3: '辅助属性3id',
  aux_prop_id: '辅助属性id', src_order_id: '源单id', src_inter_id: '源单内部id', src_entry_id: '源单分录id',
  sn_list_id: '序列号流转ID', custom_entity_field: '自定义字段', kf_date: '保质期到期日', valid_date: '有效期至',
  kf_type: '保质期单位类型', is_free: '是否赠品', seq: '行号', batch_no: '批号', barcode: '条形码',
  picture: '图片', cess: '税率%', qty: '数量', price: '单价', amount: '金额', comment: '备注',
  delivery_date: '交货日期', inv_qty: '现存量', dis_amount: '折扣金额', dis_rate: '折扣率%',
  all_amount: '价税合计', tax_amount: '税额', fee: '费用', cost: '成本', unit_cost: '单位成本',
  contact_person: '联系人', gender: '性别', mobile: '手机', phone: '座机', email: '邮箱', birthday: '生日',
  qq: 'QQ', wechat: '微信', contact_address: '地址', is_default_linkman: '首要联系人',
  create_time_contact: '联系人创建时间', group_number: '联系人组编码', rate: '联系人税率',
};
const SENS = /mobile|phone|email|birthday|qq|wechat|contact_address|sn_list$|^picture/;
const humanize = (k) => k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const sanitize = (s) => (s || '').replace(/\[.*?\]/g, '').split('（')[0].split('(')[0].split('：')[0].split(':')[0].split(',')[0].replace(/\s+/g, '').trim() || null;

// 哨兵:top 记录 + leaf(行/联系人元素)记录
const accTop = new Set(), accLeaf = new Set();
const leaf = new Proxy({}, { get: (t, k) => { if (typeof k === 'symbol') return undefined; accLeaf.add(String(k)); return `#L${String(k)}`; } });
const mkTop = (arrKeys) => new Proxy({}, {
  get: (t, k) => {
    if (typeof k === 'symbol') return undefined;
    const s = String(k);
    accTop.add(s);
    return arrKeys.has(s) ? [leaf] : `#T${s}`;
  },
});
const ctxS = { matgrpById: { get: () => 'x' }, matgrpNameById: { get: () => 'x' }, cusgrpById: { get: () => 'x' }, supgrpById: { get: () => 'x' }, currencyNameById: { get: () => 'x' } };
const arrayKeysOf = (rec) => {
  const s = new Set();
  for (const src of [rec?.listFull, rec?.detailFull]) for (const [k, v] of Object.entries(src || {})) if (Array.isArray(v)) s.add(k);
  return s;
};

const sql = [];
sql.push('-- migrate-kingdee-subentity-union.sql — 子实体(订单行+联系人)字段与文档并集完全对应');
sql.push('-- 生成器:tools/archive/_gen-subentity-union.mjs;行级补 bl_so_order/bl_pu_order,联系人级补 dm_kh/dm_gf(dotted 路径 bomentity.xx)');
sql.push('USE HSDZ_MES;');
sql.push('SET NOCOUNT ON;');
sql.push('GO');
sql.push('');
const EXTRA_LINES = {};
const newExtraEntries = { BD_CUSTOMER: [], BD_SUPPLIER: [] };
const report = [];

// ── 订单行 ──
for (const code of ['SO_ORDER', 'PU_ORDER']) {
  const doc = DOCS.find((d) => d.code === code);
  const rec = sub[code];
  const lineKeys = new Set(rec.lineKeys);
  const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'))[code];
  accTop.clear(); accLeaf.clear();
  doc.mapHead(mkTop(arrayKeysOf(api)), ctxS);
  doc.mapLines(mkTop(arrayKeysOf(api)));
  const delta = [...lineKeys].filter((k) => !accLeaf.has(k) && k !== 'id' && k !== 'custom_entity_field');
  const table = code === 'SO_ORDER' ? 'bl_so_order' : 'bl_pu_order';
  const exist = existCols.get(table) || new Set();
  const panel = panelCols.get(code) || new Set();
  const used = new Set([...exist, ...panel]);
  const labels = docLabels.get(SECTION[code]) || new Map();
  EXTRA_LINES[code] = [];
  const stmts = [];
  for (const k of delta) {
    const t = SENS.test(k) ? 'dec' : /qty|amount|price|rate|cost|coefficient|fee|seq|discount/i.test(k) ? 'num' : 'str';
    let label = sanitize(labels.get(k) || '') || LABEL_OVERRIDE[k] || k;
    if (used.has(label)) label = `${label}_${k}`;
    used.add(label);
    EXTRA_LINES[code].push({ c: label, a: k, t });
    stmts.push(`IF COL_LENGTH('dbo.${table}', N'${label}') IS NULL ALTER TABLE dbo.${table} ADD [${label}] nvarchar(500) NULL;`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${code}' AND col_name=N'${label}')`);
    stmts.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('${code}', N'${label}', N'${label}', N'文本', N'detail', 960, 120, 1, 0, 0, 1);`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
    stmts.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'${humanize(k)}', 'manual');`);
  }
  report.push(`${code} 行:并集 ${lineKeys.size} | 已映射 ${[...lineKeys].filter((k) => accLeaf.has(k)).length} | 补 ${delta.length} | 行表列 ${exist.size}→${exist.size + delta.length}`);
  if (delta.length) sql.push(`-- ══ ${code} 行子实体:补 ${delta.length} 列 ══`, ...stmts, 'GO', '');
}

// ── 联系人(客户/供应商 bomentity 首行) ──
for (const code of ['BD_CUSTOMER', 'BD_SUPPLIER']) {
  const doc = DOCS.find((d) => d.code === code);
  const rec = sub[code];
  const ctKeys = new Set(rec.contactKeys);
  const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'))[code];
  accTop.clear(); accLeaf.clear();
  doc.mapArchive(mkTop(arrayKeysOf(api)), ctxS);
  const delta = [...ctKeys].filter((k) => !accLeaf.has(k) && k !== 'id');
  const table = code === 'BD_CUSTOMER' ? 'dm_kh' : 'dm_gf';
  const panelCode = code === 'BD_CUSTOMER' ? 'KHDA' : 'GFDA';
  const exist = existCols.get(table) || new Set();
  const panel = panelCols.get(panelCode) || new Set();
  const used = new Set([...exist, ...panel]);
  const labels = docLabels.get(SECTION[code]) || new Map();
  const arrName = code === 'BD_CUSTOMER' ? 'bomentity' : 'bom_entity';
  const stmts = [];
  for (const k of delta) {
    const t = SENS.test(k) ? 'dec' : 'str';
    let label = sanitize(labels.get(k) || '') || LABEL_OVERRIDE[k] || k;
    // 联系人子键与顶层键标签可能同名(如 创建时间),加前缀区分
    const prefix = code === 'BD_CUSTOMER' ? '联系人' : '供应商联系人';
    if (used.has(label) || ['创建时间', '修改时间', '性别', '备注'].includes(label)) label = `${prefix}${label}`;
    if (used.has(label)) label = `${label}_${k}`;
    used.add(label);
    newExtraEntries[code].push({ c: label, a: `${arrName}.${k}`, t });
    stmts.push(`IF COL_LENGTH('dbo.${table}', N'${label}') IS NULL ALTER TABLE dbo.${table} ADD [${label}] nvarchar(500) NULL;`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${panelCode}' AND col_name=N'${label}')`);
    stmts.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('${panelCode}', N'${label}', N'${label}', N'文本', N'detail', 960, 120, 1, 0, 0, 1);`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
    stmts.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'Contact ${humanize(k)}', 'manual');`);
  }
  report.push(`${code} 联系人:并集 ${ctKeys.size} | 已映射 ${[...ctKeys].filter((k) => accLeaf.has(k)).length} | 补 ${delta.length}`);
  if (delta.length) sql.push(`-- ══ ${code} 联系人子实体:补 ${delta.length} 列 ══`, ...stmts, 'GO', '');
}
sql.push("PRINT N'migrate-kingdee-subentity-union 完成';");
sql.push('GO');
writeFileSync(join(HERE, '..', 'migrate-kingdee-subentity-union.sql'), sql.join('\n'), 'utf8');

// 更新 EXTRA 模块:替换整个文件(EXTRA 含追加的 dotted 条目 + EXTRA_LINES;幂等:每次从当前 EXTRA 对象重建)
for (const [code, entries] of Object.entries(newExtraEntries)) {
  if (!EXTRA[code]) EXTRA[code] = [];
  const existing = new Set((EXTRA[code] || []).map((e) => e.a));
  for (const e of entries) if (!existing.has(e.a)) EXTRA[code].push(e);
}
const js = [
  '// kingdee-extra-fields.mjs — 全并集自动映射表(生成器产出,勿手改)',
  '//   EXTRA: 头/档案级 c=列 a=接口键(支持 bomentity.xxx dotted=子实体首行) t=dec/join/str',
  '//   EXTRA_LINES: 订单行级(键取自 material_entity 元素)',
  `export const EXTRA = ${JSON.stringify(EXTRA, null, 2)};`,
  '',
  `export const EXTRA_LINES = ${JSON.stringify(EXTRA_LINES, null, 2)};`,
  '',
].join('\n');
writeFileSync(join(HERE, '..', '..', 'deploy', 'kingdee-extra-fields.mjs'), js, 'utf8');
console.log(report.join('\n'));
console.log('\n已生成: migrate-kingdee-subentity-union.sql + EXTRA_LINES(行级) + 联系人 dotted 条目');
