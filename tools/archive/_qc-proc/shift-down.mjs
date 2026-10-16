#!/usr/bin/env node
/**
 * 把制程检验组网格整体下移 52(给公司/标题/元信息腾位置),并同步 band 高度。
 * 只动 y=18/32/66 这三档(表头组标题/子标题/数据行),不碰刚加的 y=0/20/40/52。
 * 运行: node tools/archive/_qc-proc/shift-down.mjs
 */
import fs from "node:fs";

const p = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\r3a-body.xml";
let s = fs.readFileSync(p, "utf8");

const SHIFT = 52;
const map = { 18: 18 + SHIFT, 32: 32 + SHIFT, 66: 66 + SHIFT };  // 70 / 84 / 118
let n = 0;
for (const [from, to] of Object.entries(map)) {
  const re = new RegExp(' y="' + from + '"', "g");
  const before = s;
  s = s.replace(re, ' y="' + to + '"');
  if (s !== before) n++;
}
// band 高度:70(组标题) ... 数据行 118+34=152,留 6pt 余量 -> 158
s = s.replace(/<band height="140">/, '<band height="160">');
fs.writeFileSync(p, s, "utf8");

console.log("SHIFTED=" + n);
const ys = [...new Set([...s.matchAll(/ y="(\d+)"/g)].map((m) => +m[1]))].sort((a, b) => a - b);
console.log("Y值=" + ys.join(","));
const bandH = /<band height="(\d+)"/.exec(s)[1];
const maxY = Math.max(...[...s.matchAll(/y="(\d+)" height="(\d+)"/g)].map((m) => +m[1] + +m[2]));
console.log("bandH=" + bandH + " 最大下沿=" + maxY + " 容纳=" + (+bandH >= maxY));
