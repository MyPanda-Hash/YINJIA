// 账套使用情况探测(权威版):路径来自官方文档(doc-endpoints.json,由 _fetch-docs.mjs 生成)
// 用法:node _discover.mjs [--config=路径]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(readText(join(HERE, 'config.json')));

// 分组规则(按路径前缀)
const groupOf = (path, label) => {
  if (/sal_|销售/.test(path + label)) return '销售';
  if (/pur_|采购/.test(path + label)) return '采购';
  if (/\/inv|盘点|调拨|组装|领料|入库单|出库单|库存/.test(path + label)) return '库存';
  if (/arap|收款|付款/.test(path + label)) return '资金';
  if (/\/fi|凭证|科目|工资|资产/.test(path + label)) return '财务';
  if (/\/pm|生产|委外/.test(path + label)) return '生产';
  if (/\/ls|门店|会员/.test(path + label)) return '零售';
  if (/\/sys|用户/.test(path + label)) return '系统';
  return '基础资料';
};

// 目标清单:doc-endpoints.json(官方文档路径) + 已同步的销/采订单
const TARGETS = [];
const epFile = join(HERE, 'doc-endpoints.json');
if (existsSync(epFile)) {
  for (const e of JSON.parse(readText(epFile))) {
    if (e.path) TARGETS.push({ group: groupOf(e.path, e.label), label: e.label, path: e.path });
  }
}
for (const [label, path] of [['销售订单', '/jdy/v2/scm/sal_order'], ['采购订单', '/jdy/v2/scm/pur_order']]) {
  if (!TARGETS.some((t) => t.path === path)) TARGETS.push({ group: groupOf(path, label), label, path });
}
// 去重(按 path)
const seen = new Set();
const targets = TARGETS.filter((t) => (seen.has(t.path) ? false : (seen.add(t.path), true)));

const { token } = await fetchAppToken(cfg.kingdee);
console.log(`授权 ✓,开始探测 ${targets.length} 个官方接口...\n`);
console.log('模块    | 单据类型             | 数据量    | 状态');
console.log('-------|----------------------|----------|---------');
const inUse = [];
for (const t of targets) {
  const r = await kingdeeTryGet(cfg.kingdee, token, t.path, { page: '1', page_size: '1' });
  if (!r.ok) { console.log(`${t.group.padEnd(6)} | ${t.label.padEnd(18)} | ${'-'.padEnd(8)} | 接口不可用`); continue; }
  const d = r.data || {};
  const count = Number(d.count !== undefined ? d.count : (d.rows ? d.rows.length : '?'));
  const state = count > 0 ? '★ 在用' : '空';
  console.log(`${t.group.padEnd(6)} | ${t.label.padEnd(18)} | ${String(count).padEnd(8)} | ${state}`);
  if (count > 0) inUse.push(t);
}
console.log(`\n===== 结论:有数据录入的面板(${inUse.length} 个) =====`);
for (const t of inUse) console.log(`★ [${t.group}] ${t.label}  ${t.path}`);
