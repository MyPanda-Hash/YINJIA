#!/usr/bin/env node
/**
 * 修正 detail 第 2 行(尺寸规格)与第 3 行(重量)的结果显示:
 *  - 尺寸行:三行文本改成"外径/内径/长度"紧凑三行(保持),但把该格宽度用满、
 *    并把字号缩到 7 以容纳;
 *  - 重量行:结果 234.5/230.8/234.1/225.1/226.1 过长被折行 -> 也缩到 7 号字。
 * 做法:给这两行的"结果"格单独加一个更小字号的样式 cellXS(fontSize=7)。
 * 运行: node tools/archive\_insp-report\fix-result-font.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report";
const rd = (n) => fs.readFileSync(D + "\\" + n, "utf8");
const wr = (n, s) => fs.writeFileSync(D + "\\" + n, s, "utf8");

// ① p1 加 cellXS 样式(在 cellSC 之后)
let p1 = rd("p1-head.xml");
if (!/name="cellXS"/.test(p1)) {
  p1 = p1.replace(
    /(<style name="cellSC"[^>]*\/>)/,
    '$1\n  <style name="cellXS" style="base" fontSize="7" hAlign="Left" vAlign="Top">\n    <box padding="1"><pen lineWidth="0.5" lineColor="#8A8A8A"/></box>\n  </style>'
  );
  wr("p1-head.xml", p1);
}
console.log("P1_HAS_CELLXS=" + /name="cellXS"/.test(rd("p1-head.xml")));

// ② detail 里"结果"格(style="cellS" x="398")改用 cellXS
let d = rd("p3a-detail.xml");
const before = (d.match(/style="cellS" x="398"/g) || []).length;
d = d.split('style="cellS" x="398"').join('style="cellXS" x="398"');
wr("p3a-detail.xml", d);
console.log("RESULT_CELLS_CHANGED=" + before);
