#!/usr/bin/env node
/**
 * 修正 p9 表头行:p9 是从 q1 的 title band 里抠出来的,元素带着 title 的 y 偏移(120),
 * 塞进 height=20 的 columnHeader band 后元素超出边界 => Jasper "Report design not valid"。
 * 这里把 y 全部归零。运行: node tools/archive\_insp-report\fix-p9.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report";
const f = D + "\\p9-tablehead.xml";
let s = fs.readFileSync(f, "utf8");
const before = s.match(/y="\d+"/g);
s = s.replace(/ y="\d+"/g, ' y="0"');
fs.writeFileSync(f, s, "utf8");
console.log("BEFORE_Y=" + JSON.stringify(before));
console.log("AFTER_Y=" + JSON.stringify(s.match(/y="\d+"/g)));
