// 反事实:把金蝶 2026-08-31 期初(1,347 行)加回当前 kucun,看负结存会怎么变
// 用法: node _cf-opening.mjs
import fs from 'node:fs';

const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const opening = JSON.parse(fs.readFileSync(here + '../_kd-opening-probe/_out/opening-A-0831-lot.json', 'utf8'));

const lines = fs.readFileSync(here + 'out-kucun.tsv', 'utf8').split(/\r?\n/).slice(2);
const key = (w, c) => w + '|' + c;

const kucun = new Map();   // key -> {w,c,qty,rows}
for (const ln of lines) {
  const p = ln.split('\t');
  if (p.length < 4) continue;
  const k = key(p[0], p[1]);
  const e = kucun.get(k) || { w: p[0], c: p[1], qty: 0, rows: 0 };
  e.qty += Number(p[3]); e.rows++;
  kucun.set(k, e);
}

let negBefore = 0, negQtyBefore = 0, negAfter = 0, negQtyAfter = 0, totalBefore = 0, totalAfter = 0;
for (const e of kucun.values()) {
  totalBefore += e.qty;
  if (e.qty < 0) { negBefore++; negQtyBefore += e.qty; }
}

const add = new Map();
for (const o of opening) {
  const k = key(o.wzdm, o.ckdm);
  add.set(k, (add.get(k) || 0) + Number(o.qty));
}

const allKeys = new Set([...kucun.keys(), ...add.keys()]);
let covered = 0, coveredQty = 0;
for (const k of allKeys) {
  const q = (kucun.get(k)?.qty || 0) + (add.get(k) || 0);
  totalAfter += q;
  if (q < 0) { negAfter++; negQtyAfter += q; }
}
for (const [k, v] of add) {
  if ((kucun.get(k)?.qty || 0) < 0 && v > 0) { covered++; coveredQty += v; }
}

const fmt = (n) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log('== 反事实:加回 2026-08-31 金蝶期初(1,347 行 / ' + fmt(opening.reduce((s, x) => s + x.qty, 0)) + ') ==');
console.log('(物料,仓库) 组合数            ', allKeys.size);
console.log('现在(9/30 口径)负组合 / 缺口   ', negBefore, '/', fmt(negQtyBefore));
console.log('加回期初后 负组合 / 缺口       ', negAfter, '/', fmt(negQtyAfter));
console.log('总数 现在 → 加回期初           ', fmt(totalBefore), '→', fmt(totalAfter));
console.log('被期初直接救回来的负组合        ', covered, '(期初量', fmt(coveredQty) + ')');
console.log('加回期初后仍然为负的组合        ', negAfter);
