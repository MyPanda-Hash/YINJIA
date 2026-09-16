// 生成器:面板字段与「文档并集(列表∪详情)」完全对应
//   访问记录哨兵跑 mapArchive/mapHead/mapLines → 得到映射已消费的接口键;
//   并集 − 已消费 − {id,custom_field} = 待补键 → 产出:
//     ① deploy/kingdee-extra-fields.mjs(自动映射表:runCore 合并写入)
//     ② tools/migrate-kingdee-full-union.sql(列+yj_field+英译,英译取 api 键人性化)
//   标签来源:deploy/面板字段对照.md 各章节「说明」列。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from '../../deploy/sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'));
// 现有物理列(档案表 + 订单头表)
const existCols = new Map();
for (const line of readFileSync(join(HERE, '_archcols.out'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('|')) continue;
  const [t, c] = line.split('|');
  if (!existCols.has(t)) existCols.set(t, new Set());
  existCols.get(t).add(c);
}
// 现有面板字段(避免与已注册列重名)
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, new Set());
  panelCols.get(p).add(c);
}
// 对照文档:章节 → (api键 → 说明)
const SECTION = {
  BD_CUSTOMER: '## 客户', BD_SUPPLIER: '## 供应商', BD_MATERIAL: '## 商品(存货)', BD_EMP: '## 职员',
  BD_DEPT: '## 部门', BD_STORE: '## 仓库', BD_UOM: '## 计量单位', BD_SETTLE: '## 结算方式',
  BD_CUSGRP: '## 客户分类', BD_SUPGRP: '## 供应商分类', BD_MATGRP: '## 商品分类', BD_CUR: '## 币别',
  SO_ORDER: '## 销售订单(表头+商品分录)', PU_ORDER: '## 采购订单(表头+商品分录)',
};
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
const TABLE = {
  BD_SETTLE: 'bs_settle_type', BD_CUSGRP: 'bs_customer_group', BD_SUPGRP: 'bs_supplier_group',
  BD_MATGRP: 'bs_material_group', BD_CUR: 'bs_currency', BD_UOM: 'bs_uom', BD_DEPT: 'bs_dept',
  BD_EMP: 'bs_emp', BD_STORE: 'bs_wh', BD_MATERIAL: 'bs_inv', BD_CUSTOMER: 'dm_kh', BD_SUPPLIER: 'dm_gf',
  SO_ORDER: 'bd_so_order', PU_ORDER: 'bd_pu_order',
};
const PANEL = {
  BD_SETTLE: 'SETTLE', BD_CUSGRP: 'CUSGRP', BD_SUPGRP: 'SUPGRP', BD_MATGRP: 'MATGRP', BD_CUR: 'CUR',
  BD_UOM: 'UOM', BD_DEPT: 'DEPT', BD_EMP: 'EMP', BD_STORE: 'WH', BD_MATERIAL: 'INV', BD_CUSTOMER: 'KHDA',
  BD_SUPPLIER: 'GFDA', SO_ORDER: 'SO_ORDER', PU_ORDER: 'PU_ORDER',
};
// 访问记录哨兵:leaf 返回 '#key' 字符串;实测样本为数组的键返回真实单元素数组(按码定制)
const accessedGlobal = new Set(); // (makeTop 闭包引用)
const SENT = '#sentinel';
const leaf = new Proxy({}, { get: (t, k) => (typeof k === 'symbol' ? undefined : `${SENT}${String(k)}`) });
const arrayKeysOf = (rec) => {
  const s = new Set();
  for (const src of [rec?.listFull, rec?.detailFull]) {
    for (const [k, v] of Object.entries(src || {})) if (Array.isArray(v)) s.add(k);
  }
  return s;
};
const makeTop = (arrKeys) => new Proxy({}, {
  get: (t, k) => {
    if (typeof k === 'symbol') return undefined;
    const s = String(k);
    accessedGlobal.add(s);
    return arrKeys.has(s) ? [leaf] : `${SENT}${s}`;
  },
});
const ctxS = { matgrpById: { get: () => 'x' }, matgrpNameById: { get: () => 'x' }, cusgrpById: { get: () => 'x' }, supgrpById: { get: () => 'x' }, currencyNameById: { get: () => 'x' } };

const SENS = /phone|mobile|email|bank_account|birthday|qq|wechat|id_number|address|contact_info/;
const humanize = (k) => k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
// 说明列缺失/过长时的手工标签(api 键 → 中文)
const LABEL_OVERRIDE = {
  settle_status: '结算状态', delivery_type: '交货方式', delivery_type_name: '交货方式', audit_date: '审核日期',
  material_group: '商品组合', material_qty: '商品数量', real_io_status: '实际出入库状态', io_status: '出入库状态',
  trans_type: '交易类型', send_status: '发货状态', io_amount: '出入库金额', un_io_amount: '未出入库数量',
  biz_mode: '业务模式', ivc_type: '发票类型', ivc_status: '发票状态', cost_fee: '采购费用', cost_fee_entity: '采购费用分录',
  all_debt: '应收余额', last_debt: '上次余额', due_date: '到期日', total_deposit: '订金总额',
  total_pre_settle_amount: '预结算总额', total_pre_settle_amount_for: '预结算总额本位币', total_pre_settle_status: '预结算状态',
  total_un_settle_amount: '未结算总额', bill_dis_rate: '整单折扣率%', bill_dis_amount: '整单折扣额',
  bill_dis_before_amount: '折前价税合计', recevice_delivery: '发货方式', subsist_info: '费用分摊信息',
  bill_close_state: '单据关闭状态', creator_name: '创建人', modifier_name: '修改人', create_time: '创建时间',
  attachments: '附件', contact_info: '联系信息', fetch_category_id: '收发类别id',
};
const sanitize = (s) => (s || '').replace(/\[.*?\]/g, '').split('（')[0].split('(')[0].replace(/\s+/g, '').trim() || null;

const EXTRA = {};
const sql = [];
sql.push('-- migrate-kingdee-full-union.sql — 面板字段与「文档并集(列表∪详情)」完全对应');
sql.push('-- 生成器:tools/archive/_gen-full-union.mjs(访问记录哨兵自动求差集;标签取面板字段对照.md 说明列)');
sql.push('-- 敏感键走解密(dec);数组键拼接 JSON(join);其余文本。订单头键 place=header。');
sql.push('USE HSDZ_MES;');
sql.push('SET NOCOUNT ON;');
sql.push('GO');
sql.push('');
const summary = [];
for (const [code, table] of Object.entries(TABLE)) {
  const rec = api[code];
  const doc = DOCS.find((d) => d.code === code);
  const union = new Set([...(rec?.listKeys || []), ...(rec?.detailKeys || [])]);
  // 已消费键
  accessedGlobal.clear();
  const top = makeTop(arrayKeysOf(rec));
  if (doc.archive) doc.mapArchive(top, ctxS);
  else { doc.mapHead(top, ctxS); doc.mapLines(top); }
  const delta = [...union].filter((k) => !accessedGlobal.has(k) && !['id', 'custom_field'].includes(k));
  const labels = docLabels.get(SECTION[code]) || new Map();
  const exist = existCols.get(table) || new Set();
  const panel = panelCols.get(PANEL[code]) || new Set();
  const used = new Set([...exist, ...panel]);
  EXTRA[code] = [];
  const place = doc.archive ? 'detail' : 'header';
  const stmts = [];
  for (const k of delta) {
    const sampleArr = Array.isArray((rec?.detailFull || {})[k]) || Array.isArray((rec?.listFull || {})[k]);
    const t = SENS.test(k) ? 'dec' : sampleArr ? 'join' : 'str';
    let label = sanitize(labels.get(k) || '') || LABEL_OVERRIDE[k] || k;
    if (used.has(label)) label = `${label}_${k}`;
    used.add(label);
    EXTRA[code].push({ c: label, a: k, t });
    stmts.push(`IF COL_LENGTH('dbo.${table}', N'${label}') IS NULL ALTER TABLE dbo.${table} ADD [${label}] nvarchar(500) NULL;`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${PANEL[code]}' AND col_name=N'${label}')`);
    stmts.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('${PANEL[code]}', N'${label}', N'${label}', N'文本', N'${place}', 950, 130, 1, 0, 0, 1);`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
    stmts.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'${humanize(k)}', 'manual');`);
  }
  summary.push({ code, panel: PANEL[code], union: union.size, before: panel.size, add: delta.length, after: panel.size + delta.length });
  if (delta.length) {
    sql.push(`-- ══ ${PANEL[code]}(${code}→${table}):并集 ${union.size} 键,补 ${delta.length} ══`);
    sql.push(...stmts, 'GO', '');
  }
}
sql.push("PRINT N'migrate-kingdee-full-union 完成';");
sql.push('GO');
writeFileSync(join(HERE, '..', 'migrate-kingdee-full-union.sql'), sql.join('\n'), 'utf8');
// EXTRA 模块
const js = ['// kingdee-extra-fields.mjs — 全并集自动映射表(生成器产出,勿手改)',
  '//   runCore 在 mapArchive/mapHead 之后合并:c=列 a=接口键 t=dec(解密)/join(数组拼接)/str',
  `export const EXTRA = ${JSON.stringify(EXTRA, null, 2)};`, ''];
writeFileSync(join(HERE, '..', '..', 'deploy', 'kingdee-extra-fields.mjs'), js.join('\n'), 'utf8');
console.log('面板        并集  原字段  补  现字段');
for (const s of summary) console.log(`${s.panel.padEnd(10)} ${String(s.union).padStart(4)} ${String(s.before).padStart(5)} ${String(s.add).padStart(4)} ${String(s.after).padStart(5)}`);
console.log(`\n已生成: tools/migrate-kingdee-full-union.sql + deploy/kingdee-extra-fields.mjs`);
