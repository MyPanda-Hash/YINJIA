// 汇总:14 个面板的 API 并集键数(列表∪详情顶层 + 子实体键) vs 面板字段数
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'));
const sub = JSON.parse(readFileSync(join(HERE, '_subentity-keys.json'), 'utf8'));

// 面板字段数(从 _panel-fields.out)
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, new Set());
  panelCols.get(p).add(c);
}

const TARGETS = [
  ['BD_SETTLE', 'SETTLE', '结算方式', false],
  ['BD_CUSGRP', 'CUSGRP', '客户分类', false],
  ['BD_SUPGRP', 'SUPGRP', '供应商分类', false],
  ['BD_MATGRP', 'MATGRP', '商品分类', false],
  ['BD_CUR', 'CUR', '币别', false],
  ['BD_UOM', 'UOM', '计量单位', false],
  ['BD_DEPT', 'DEPT', '部门', false],
  ['BD_EMP', 'EMP', '职员', false],
  ['BD_STORE', 'WH', '仓库', false],
  ['BD_MATERIAL', 'INV', '商品', false],
  ['BD_CUSTOMER', 'KHDA', '客户', true],
  ['BD_SUPPLIER', 'GFDA', '供应商', true],
  ['SO_ORDER', 'SO_ORDER', '销售订单', true],
  ['PU_ORDER', 'PU_ORDER', '采购订单', true],
];

console.log('面板              列表键  详情键  顶层并集  子实体键  API总键  面板字段');
console.log('─'.repeat(85));
let tL = 0, tD = 0, tU = 0, tS = 0, tA = 0, tP = 0;
for (const [code, panel, label, hasSub] of TARGETS) {
  const rec = api[code];
  const lk = (rec?.listKeys || []).length;
  const dk = (rec?.detailKeys || []).length;
  const uk = new Set([...(rec?.listKeys || []), ...(rec?.detailKeys || [])]).size;
  // 子实体键
  let sk = 0;
  if (hasSub && sub[code]) {
    if (sub[code].lineKeys) sk = sub[code].lineKeys.length;
    else if (sub[code].contactKeys) sk = sub[code].contactKeys.length;
  }
  const total = uk + sk;
  const pf = (panelCols.get(panel) || new Set()).size;
  console.log(`${label.padEnd(14)} ${String(lk).padStart(5)} ${String(dk).padStart(6)} ${String(uk).padStart(7)} ${String(sk).padStart(7)} ${String(total).padStart(7)} ${String(pf).padStart(7)}`);
  tL += lk; tD += dk; tU += uk; tS += sk; tA += total; tP += pf;
}
console.log('─'.repeat(85));
console.log(`${'合计'.padEnd(14)} ${String(tL).padStart(5)} ${String(tD).padStart(6)} ${String(tU).padStart(7)} ${String(tS).padStart(7)} ${String(tA).padStart(7)} ${String(tP).padStart(7)}`);
