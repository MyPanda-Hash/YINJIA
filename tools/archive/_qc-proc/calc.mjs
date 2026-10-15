#!/usr/bin/env node
/**
 * 算制程检验组表头列宽:总宽 758pt,必须精确填满不错位。
 * 结构(照截图):
 *   7 个固定列 + 外观(3 子列) + 尺寸(5 格) + 出货重量(5 格) + 结果判断
 * 运行: node tools/archive/_qc-proc/calc.mjs
 */
const TOTAL = 758;

// 固定列(截图看宽度:检验时间/客户名称/产品编码/型号/批号 窄,抽检总量 宽)
const fixed = [
  ["检验时间", 52],
  ["客户名称", 76],
  ["产品编码", 62],
  ["型号（mm)", 72],
  ["批号", 62],
  ["抽检总量", 118],
];
const fixedSum = fixed.reduce((a, [, w]) => a + w, 0);

// 外观 3 子列 + 尺寸(5格) + 出货重量(5格) + 结果判断
// 截图比例:外观较窄,尺寸与出货重量各占约 1/5 页宽,结果判断窄
const result = 44;
const remain = TOTAL - fixedSum - result;   // 分给 外观/尺寸/重量
const appW = Math.round(remain * 0.26);     // 外观
const dimW = Math.round((remain - appW) / 2);
const wgtW = remain - appW - dimW;

console.log("TOTAL=" + TOTAL + " fixedSum=" + fixedSum + " remain=" + remain);
console.log("外观组宽=" + appW + " (3 子列各 " + (appW / 3).toFixed(2) + ")");
console.log("尺寸组宽=" + dimW + " (5 格各 " + (dimW / 5).toFixed(2) + ")");
console.log("出货重量组宽=" + wgtW + " (5 格各 " + (wgtW / 5).toFixed(2) + ")");
console.log("结果判断=" + result);

// 输出 x 坐标
let x = 0;
console.log("\n--- 固定列 ---");
for (const [n, w] of fixed) { console.log(`  x=${x} w=${w}  ${n}`); x += w; }
console.log("--- 外观(组标题 x=" + x + " w=" + appW + ") ---");
const appX = x;
for (let i = 0; i < 3; i++) {
  const cw = i === 2 ? appW - Math.floor(appW / 3) * 2 : Math.floor(appW / 3);
  console.log(`  x=${appX + Math.floor(appW / 3) * i} w=${cw}  子列${i + 1}`);
}
x += appW;
console.log("--- 尺寸(组标题 x=" + x + " w=" + dimW + ") ---");
const dimX = x;
const cw5 = Math.floor(dimW / 5);
for (let i = 0; i < 5; i++) {
  const w = i === 4 ? dimW - cw5 * 4 : cw5;
  console.log(`  x=${dimX + cw5 * i} w=${w}`);
}
x += dimW;
console.log("--- 出货重量(组标题 x=" + x + " w=" + wgtW + ") ---");
const wgtX = x;
for (let i = 0; i < 5; i++) {
  const w = i === 4 ? wgtW - cw5 * 4 : cw5;
  console.log(`  x=${wgtX + cw5 * i} w=${w}`);
}
x += wgtW;
console.log("--- 结果判断 x=" + x + " w=" + result + " ---");
console.log("合计=" + (x + result) + " (应=" + TOTAL + ")");
