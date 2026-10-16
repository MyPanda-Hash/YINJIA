#!/usr/bin/env node
/**
 * 重排制程检验组(title band)列宽:固定列缩窄,让 尺寸/重量 各 5 格的格宽从 20 增到 26。
 * 新布局(合计 758):
 *   检验时间 0/50 | 客户名称 50/66 | 产品编码 116/58 | 型号 174/64 | 批号 238/56 | 抽检总量 294/96
 *   外观 390/66(3×22) | 尺寸 456/131(26×4+27) | 重量 587/131(26×4+27) | 结果判断 718/40
 * 运行: node tools/archive/_qc-proc/relayout.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\";
const p = D + "r3a-body.xml";
let s = fs.readFileSync(p, "utf8");

// 旧 x -> 新 x 的映射(按元素顺序逐类替换)
const map = [
  // 固定 6 列
  [/x="0" y="18" width="52"/, 'x="0" y="18" width="50"'],
  [/x="52" y="18" width="76"/, 'x="50" y="18" width="66"'],
  [/x="128" y="18" width="62"/, 'x="116" y="18" width="58"'],
  [/x="190" y="18" width="72"/, 'x="174" y="18" width="64"'],
  [/x="262" y="18" width="62"/, 'x="238" y="18" width="56"'],
  [/x="324" y="18" width="118"/, 'x="294" y="18" width="96"'],
  // 外观组
  [/x="442" y="18" width="71"/, 'x="390" y="18" width="66"'],
  [/x="442" y="32" width="23"/, 'x="390" y="32" width="22"'],
  [/x="465" y="32" width="23"/, 'x="412" y="32" width="22"'],
  [/x="488" y="32" width="25"/, 'x="434" y="32" width="22"'],
  // 尺寸组
  [/x="513" y="18" width="101"/, 'x="456" y="18" width="131"'],
  [/x="513" y="32" width="101"/, 'x="456" y="32" width="131"'],
  // 重量组
  [/x="614" y="18" width="100"/, 'x="587" y="18" width="131"'],
  [/x="614" y="32" width="100"/, 'x="587" y="32" width="131"'],
  // 结果判断
  [/x="714" y="18" width="44"/, 'x="718" y="18" width="40"'],
  // 数据行:固定列
  [/x="0" y="66" width="52"/, 'x="0" y="66" width="50"'],
  [/x="52" y="66" width="76"/, 'x="50" y="66" width="66"'],
  [/x="128" y="66" width="62"/, 'x="116" y="66" width="58"'],
  [/x="190" y="66" width="72"/, 'x="174" y="66" width="64"'],
  [/x="262" y="66" width="62"/, 'x="238" y="66" width="56"'],
  [/x="324" y="66" width="118"/, 'x="294" y="66" width="96"'],
  // 数据行:外观 3 格
  [/x="442" y="66" width="23"/, 'x="390" y="66" width="22"'],
  [/x="465" y="66" width="23"/, 'x="412" y="66" width="22"'],
  [/x="488" y="66" width="25"/, 'x="434" y="66" width="22"'],
  // 数据行:尺寸 5 格
  [/x="513" y="66" width="20"/, 'x="456" y="66" width="26"'],
  [/x="533" y="66" width="20"/, 'x="482" y="66" width="26"'],
  [/x="553" y="66" width="20"/, 'x="508" y="66" width="26"'],
  [/x="573" y="66" width="20"/, 'x="534" y="66" width="26"'],
  [/x="593" y="66" width="21"/, 'x="560" y="66" width="27"'],
  // 数据行:重量 5 格
  [/x="614" y="66" width="20"/, 'x="587" y="66" width="26"'],
  [/x="634" y="66" width="20"/, 'x="613" y="66" width="26"'],
  [/x="654" y="66" width="20"/, 'x="639" y="66" width="26"'],
  [/x="674" y="66" width="20"/, 'x="665" y="66" width="26"'],
  [/x="694" y="66" width="20"/, 'x="691" y="66" width="27"'],
  // 数据行:结果判断
  [/x="714" y="66" width="44"/, 'x="718" y="66" width="40"'],
];

let n = 0;
for (const [re, to] of map) {
  const before = s;
  s = s.replace(re, to);
  if (s !== before) n++;
}
fs.writeFileSync(p, s, "utf8");
console.log("REPLACED=" + n + "/" + map.length);

// 校验:最大右沿必须 = 758
const maxX = Math.max(...[...s.matchAll(/x="(\d+)" y="\d+" width="(\d+)"/g)].map((m) => +m[1] + +m[2]));
console.log("MAX_RIGHT=" + maxX + " (应=758)");
