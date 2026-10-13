#!/usr/bin/env node
/**
 * 把 reportElement 上的 fontSize 属性改成对应 style(JR 6 XSD 不允许 reportElement 带 fontSize)。
 * 映射:style="th" + fontSize=N  ->  style="thN"
 *       style="cellC" + fontSize=N -> style="cN"
 *       style="cell" + fontSize=N  -> style="lN"
 * 运行: node tools/archive/_qc-proc/fix-fontsize.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\";
const files = ["r3a-body.xml", "r4-group2.xml"];

let total = 0;
for (const f of files) {
  const p = D + f;
  let s = fs.readFileSync(p, "utf8");
  const before = (s.match(/fontSize="\d+"/g) || []).length;

  // <reportElement style="X" ... fontSize="N" .../>  ->  style="XN"
  s = s.replace(/(<reportElement\b[^>]*?)style="(th|cellC|cell|cellR|bandTitle|notice)"([^>]*?)fontSize="(\d+)"([^>]*?)\/>/g,
    (m, pre, st, mid, size, post) => {
      const map = { th: "th", cellC: "c", cell: "l", cellR: "c" };
      const ns = map[st] ? map[st] + size : st;
      // 去掉 fontSize,换 style
      return pre + 'style="' + ns + '"' + mid + post + "/>";
    });

  const after = (s.match(/fontSize="\d+"/g) || []).length;
  fs.writeFileSync(p, s, "utf8");
  console.log(f + ": " + before + " -> " + after);
  total += after;
}
console.log("REMAINING_FONTSIZE=" + total);
