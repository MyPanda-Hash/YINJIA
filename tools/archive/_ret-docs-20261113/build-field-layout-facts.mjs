// 生成「字段布局」用的事实表:金蝶键↔中文名(从接口文档解析)+ MES 现役字段 + 金蝶非空率
// 用法: node tools/archive/_ret-docs-20261113/build-field-layout-facts.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sql from '../../../deploy/node_modules/mssql/index.js';

const DIR = new URL('./', import.meta.url);
const fill = JSON.parse(readFileSync(new URL('./ret-fieldfill.json', DIR), 'utf8'));

// ---- 1) 解析接口文档:key → 中文说明 ----
function parseKeys(md) {
  const map = {};   // key -> 中文
  const TYPE = /^(string|number|integer|boolean|List|Map|array|object)/i;
  for (const ln of md.split(/\r?\n/)) {
    if (!ln.trim().startsWith('|')) continue;
    const cells = ln.split('|').map((c) => c.trim());
    // 形如 | key | type | 说明 |  或  | key | type | 必填 | 说明 |
    const key = cells[1];
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(key || '')) continue;
    if (!TYPE.test(cells[2] || '')) continue;
    const desc = cells.slice(3).filter((c) => c && !/^(true|false)$/i.test(c)).join(' ').trim();
    if (desc && !map[key]) map[key] = desc;
  }
  return map;
}
const saleDoc = readFileSync(new URL('./9e65978e712511eda0b3f3188c79acb5-销售退货单详情.md', DIR), 'utf8');
const pickDoc = readFileSync(new URL('./9e327981712511eda0b3e928c9721b4f-生产退料单详情.md', DIR), 'utf8');
const saleKeys = parseKeys(saleDoc);
const pickKeys = parseKeys(pickDoc);

// ---- 2) MES 现役字段 ----
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).database;
const pool = await sql.connect({
  server: cfg.server, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password,
  options: { encrypt: false, trustServerCertificate: true },
});
const fieldsOf = async (p) => (await pool.request().query(
  `SELECT col_name, label, place, seq, visible, hidden, editable, required FROM yj_field WHERE panel_code='${p}' ORDER BY seq, id`)).recordset;
const F = {
  SALE_IN: await fieldsOf('SALE_IN'),
  MATERIAL_RET: await fieldsOf('MATERIAL_RET'),
  SALE_OUT: await fieldsOf('SALE_OUT'),
  MATERIAL_OUT: await fieldsOf('MATERIAL_OUT'),
};
await pool.close();

// ---- 3) 中文名 → 金蝶键(自动,后接人工同义词) ----
const SYN = {
  // MES 标签 → 金蝶中文名(用于反查 key)
  存货编码: ['商品编码'], 存货名称: ['商品名称'], 存货: ['商品名称'],
  材料编码: ['商品编码'], 材料名称: ['商品名称'], 材料规格: ['商品规格'],
  经手人: ['业务员名称'], 经手人编码: ['业务员编码'], 领用人: ['业务员名称'],
  生产车间: ['部门名称'], 部门: ['部门名称'], 部门编码: ['部门编码'],
  单价: ['单价'], 售价: ['单价'], 数量: ['数量'], 批号: ['批次号'],
  计量单位: ['单位名称'], 单位: ['单位名称'], 规格型号: ['商品规格'],
  仓库: ['仓库名称'], 仓库编码: ['仓库编码'],
  退货数量: ['退货数量'], 退货原因: ['退货原因'],
  单据编号: ['单据编码'], 单据日期: ['单据日期'], 备注: ['备注'],
  业务类型: ['业务类型'], 单据类型名称: ['业务类型'],
  供应商: ['供应商名称'], 客户: ['客户名称'], 客户编码: ['客户编码'],
  制单人: ['创建人名称'], 审核人: ['审核人名称'],
  成本价: ['成本'], 成本: ['成本'], 单位成本: ['出库单位成本'],
  金额: ['金额'], 销售金额: ['金额'], 税额: ['税额'], 税率: ['增值税率'],
  价税合计: ['价税合计'], 含税售价: ['含税单价'],
  基本单位名称: ['基本单位名称'], 基本单位编码: ['基本单位编码'],
  辅助数量: ['辅助单位数量'], 库存数量: ['库存数量'], 基本数量: ['基本数量'],
  源单编号: ['源单编码'], 源单行号: ['源单行号'], 源单类型名称: ['源单类型名称'],
  销售订单号: ['源订单号'], 源单日期: ['源单日期'],
};
function mapLabel(label, cnMap, fillByKey) {
  const cands = SYN[label] ? [label, ...SYN[label]] : [label];
  for (const cn of cands) {
    for (const [key, desc] of Object.entries(cnMap)) {
      if (desc === cn) {
        const f = fillByKey[key] || 0;
        return { key, cn, pct: f };
      }
    }
  }
  return null;
}
const facts = {};
for (const panel of ['SALE_IN', 'MATERIAL_RET']) {
  const isSale = panel === 'SALE_IN';
  const cnMap = isSale ? saleKeys : pickKeys;
  const fillArr = isSale ? fill['销售退货单'] : fill['生产退料单'];
  const headFill = Object.fromEntries(fillArr.head.map((x) => [x.key, x.pct]));
  const lineFill = Object.fromEntries(fillArr.line.map((x) => [x.key, x.pct]));
  facts[panel] = F[panel].map((f) => {
    const inDetail = String(f.place || '').includes('detail');
    const hit = mapLabel(f.label, cnMap, inDetail ? lineFill : headFill);
    return { ...f, isDetail: inDetail, kingdeeKey: hit?.key || null, kingdeePct: hit ? hit.pct : null };
  });
}

// ---- 4) 对照:兄弟面板里同名字段的可见性 ----
const sibling = (panel, col) => {
  const src = panel === 'SALE_IN' ? 'SALE_OUT' : 'MATERIAL_OUT';
  return F[src].find((x) => x.col_name === col) || null;
};

const lines = [];
lines.push('| MES 字段 | place | seq | 现visible | 金蝶键 | 金蝶非空 | 兄弟面板 |');
lines.push('|---|---|---|---|---|---|---|');
for (const panel of ['SALE_IN', 'MATERIAL_RET']) {
  lines.push(`\n### ${panel}\n`);
  for (const f of facts[panel]) {
    const sb = sibling(panel, f.col_name);
    lines.push(`| ${f.label} | ${f.place} | ${f.seq} | ${f.visible ? 'T' : 'F'} | ${f.kingdeeKey || '-'} | ${f.kingdeePct === null ? '-' : f.kingdeePct + '%'} | ${sb ? (sb.visible ? '可见' : '隐藏') : (panel === 'SALE_IN' ? 'SALE_OUT无' : 'MATERIAL_OUT无')} |`);
  }
}
writeFileSync(new URL('./field-layout-facts.md', DIR), lines.join('\n'), 'utf8');
writeFileSync(new URL('./field-layout-facts.json', DIR), JSON.stringify({ facts, saleKeys, pickKeys }, null, 2), 'utf8');
console.log('写出 field-layout-facts.md / .json');
console.log('SALE_IN 映射到金蝶键的字段数:', facts.SALE_IN.filter((f) => f.kingdeeKey).length, '/', facts.SALE_IN.length);
console.log('MATERIAL_RET 映射到金蝶键的字段数:', facts.MATERIAL_RET.filter((f) => f.kingdeeKey).length, '/', facts.MATERIAL_RET.length);
