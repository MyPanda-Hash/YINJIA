// 生成器:单据面板(销售/采购订单)只保留"同步真能写入"的字段
// 手法:用 Proxy 哨兵喂给 mapHead/mapLines —— 映射里凡是取到接口值的键会拿到 '#xx' 哨兵,
//       凡是被硬编码成 null 的键(部门负责人/项目/品牌/到货地址…)= 永远无值 → 判为不可同步,从面板删除。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from '../../deploy/sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, []);
  panelCols.get(p).push(c);
}

const sentinel = () => new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : `#${String(k)}`) });
const lineElem = sentinel();
const arr = [lineElem];
const orderDetail = new Proxy({}, {
  get: (t, k) => (k === 'material_entity' ? arr : k === 'then' ? undefined : `#${String(k)}`),
});

const TARGETS = [
  { code: 'SO_ORDER', panel: 'SO_ORDER' },
  { code: 'PU_ORDER', panel: 'PU_ORDER' },
];
// ctx 哨兵:币别档案 id→名称 解析(运行期由 BD_CUR.afterList 填充)视为可同步
const ctxSentinel = { currencyNameById: { get: () => '#currency_name' } };
const sql = [];
sql.push('-- migrate-kingdee-order-keep-syncable.sql — 销售/采购订单面板只保留「同步真能写入」的字段');
sql.push('-- 口径:与档案一致(用户确认 2026-09-15)。用哨兵代理跑 mapHead/mapLines:');
sql.push('--   取到接口值的键=可同步;映射里硬编码 null 的键(部门负责人/项目/品牌/到货地址/发货状态/');
sql.push('--   合同号/订金金额/付款方式/现存量说明)= 永远无值 → 从面板删除(物理列保留)。');
sql.push('-- 生成器:tools/archive/_gen-order-keep-syncable.mjs');
sql.push('USE HSDZ_MES;');
sql.push('SET NOCOUNT ON;');
sql.push('GO');
sql.push('');
let total = 0;
for (const { code, panel } of TARGETS) {
  const doc = DOCS.find((d) => d.code === code);
  const head = doc.mapHead(orderDetail, ctxSentinel);
  const lines = doc.mapLines(orderDetail);
  const written = new Set(Object.keys(head).filter((k) => !k.startsWith('__')));
  for (const l of lines) for (const k of Object.keys(l)) if (!k.startsWith('__')) written.add(k);
  const emptyKeys = new Set([...Object.entries(head).filter(([, v]) => v === null).map(([k]) => k),
    ...Object.entries(lines[0] || {}).filter(([, v]) => v === null).map(([k]) => k)]);
  const current = panelCols.get(panel) || [];
  const drop = current.filter((c) => emptyKeys.has(c) || !written.has(c));
  const keep = current.filter((c) => !drop.includes(c));
  total += drop.length;
  console.log(`\n【${panel}】保留 ${keep.length} / 删 ${drop.length}`);
  console.log('  保留:', keep.join(', '));
  console.log('  删除:', drop.join(', ') || '(无)');
  sql.push(`-- ══ ${panel}:保留 ${keep.length} 删 ${drop.length} ══`);
  if (drop.length) sql.push(`DELETE FROM yj_field WHERE panel_code='${panel}' AND col_name IN (${drop.map((c) => `N'${c}'`).join(', ')});`);
  else sql.push('-- (无需删除)');
  sql.push('GO');
  sql.push('');
}
sql.push("SELECT panel_code, COUNT(*) AS 可同步字段数 FROM yj_field WHERE panel_code IN ('SO_ORDER','PU_ORDER') GROUP BY panel_code ORDER BY panel_code;");
sql.push("PRINT N'migrate-kingdee-order-keep-syncable 完成';");
sql.push('GO');
writeFileSync(join(HERE, '..', 'migrate-kingdee-order-keep-syncable.sql'), sql.join('\n'), 'utf8');
console.log(`\n共删除 ${total} 个不可同步字段`);
