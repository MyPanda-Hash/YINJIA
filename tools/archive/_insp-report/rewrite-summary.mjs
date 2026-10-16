#!/usr/bin/env node
/**
 * 重写 p3b-summary.xml(结论 + 卫生安全段),版式:
 *    y=0   检验结论：合格      备注：测试环境…
 *    y=26  ── 分隔线 ──
 *    y=30  按《生活饮用水输配水设备及防护材料卫生安全评价规范》项目
 *    y=46  卫生要求 | 结果   (表头)
 *    y=64  起 15 行数据,每行 17
 *   band 高 = 64 + 15*17 + 6 = 325
 * 运行: node tools/archive\_insp-report\rewrite-summary.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report";
const u = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// [卫生要求文案, 结果]
const H = [
  ["\\u6d8c\\u6cd5\\u5ea6\\u589e\\u52a0\\u91cf\\uff080.2NTU\\uff09", "0.12"],
  ["\\u81a4\\u548c\\u5473\\uff1a\\u6d78\\u6ce1\\u540e\\u6c34\\u65e0\\u5f02\\u81a0\\u3001\\u5f02\\u5473", "\\u65e0"],
  ["\\u7728\\u773c\\u53ef\\u89c1\\u7269\\uff1a\\u6d78\\u6ce1\\u540e\\u6c34\\u4e0d\\u4ea7\\u751f\\u4efb\\u4f55\\u7728\\u773c\\u53ef\\u89c1\\u7684\\u788e\\u7247\\u6742\\u7269\\u7b49", "\\u65e0"],
  ["\\u6539\\u53d8\\u5ea6\\uff080.5\\uff09", "1.79"],
  ["\\u878d\\u89e3\\u6027\\u603b\\u56fa\\u4f53\\uff0820 mg/L\\uff09", "\\u2014"],
  ["\\u8017\\u6c27\\u91cf\\uff08\\u4ee5O2\\u8ba1\\uff09\\u589e\\u52a0\\u91cf\\uff081 mg/L\\uff09", "0.46"],
  ["\\u7847\\u589e\\u52a0\\u91cf\\uff080.001 mg/L\\uff09", "\\u2014"],
  ["\\u950c\\u589e\\u52a0\\u91cf\\uff080.005 mg/L\\uff09", "\\u2014"],
  ["\\u94dd\\u589e\\u52a0\\u91cf\\uff080.02 mg/L\\uff09", "\\u2014"],
  ["\\u94c0\\u589e\\u52a0\\u91cf\\uff080.001 mg/L\\uff09", "\\u2014"],
  ["\\u6c5e\\u589e\\u52a0\\u91cf\\uff080.0001 mg/L\\uff09", "\\u2014"],
  ["\\u94c1\\u589e\\u52a0\\u91cf\\uff080.06 mg/L\\uff09", "\\u2014"],
  ["\\u9530\\u589e\\u52a0\\u91cf\\uff080.02 mg/L\\uff09", "\\u2014"],
  ["\\u94dc\\u589e\\u52a0\\u91cf\\uff080.2 mg/L\\uff09   /   \\u950c\\u589e\\u52a0\\u91cf\\uff080.2 mg/L\\uff09", "\\u2014"],
  ["\\u603b\\u786c\\u5ea6\\u589e\\u52a0\\u91cf\\uff08\\u6309\\u78b3\\u9178\\u9499\\u8ba1 100 mg/L\\uff09", "\\u2014"],
];

const note = u("\\u5907\\u6ce8\\uff1a\\u6d4b\\u8bd5\\u73af\\u5883\\uff1a\\u6e29\\u5ea624\\u2103  \\u6e7f\\u5ea6\\uff1a48 %\\uff1b"
  + "\\u6d4b\\u8bd5\\u6837\\u672c\\u8d85\\u8fc75\\u4e2a\\u65f6\\uff0c\\u586b\\u51995\\u4e2a\\u6570\\u636e\\uff0c"
  + "\\u8bb0\\u5f55\\u6570\\u636e\\u65f6\\u9009\\u62e9\\u504f\\u9ad8\\u79bb\\u6807\\u51c6\\u6700\\u8fdc\\u7684\\u6570\\u636e\\u8fdb\\u884c\\u8bb0\\u5f55");
const spec = u("\\u6309\\u300a\\u751f\\u6d3b\\u996e\\u7528\\u6c34\\u8f93\\u914d\\u6c34\\u8bbe\\u5907\\u53ca\\u9632\\u62a4\\u6750\\u6599\\u536b\\u751f\\u5b89\\u5168\\u8bc4\\u4ef7\\u89c4\\u8303\\u300b\\u9879\\u76ee");
const hHyg = u("\\u536b\\u751f\\u8981\\u6c42");
const hRes = u("\\u7ed3\\u679c");
const cLbl = u("\\u68c0\\u9a8c\\u7ed3\\u8bba\\uff1a");
const cVal = u("\\u5408\\u683c");

const rows = H.map(([k, v], i) => {
  const y = 64 + i * 17;
  return `      <staticText><reportElement style="cellS" x="0" y="${y}" width="359" height="17"/><text><![CDATA[${u(k)}]]></text></staticText>\n`
       + `      <staticText><reportElement style="cellSC" x="359" y="${y}" width="180" height="17"/><text><![CDATA[${u(v)}]]></text></staticText>`;
}).join("\n");

const bandH = 64 + H.length * 17 + 8;

const xml = `  <summary>
    <band height="${bandH}">
      <staticText><reportElement style="gridLabel" x="0" y="0" width="76" height="20"/><text><![CDATA[${cLbl}]]></text></staticText>
      <staticText><reportElement style="conclusion" x="76" y="0" width="60" height="20"/><text><![CDATA[${cVal}]]></text></staticText>
      <staticText><reportElement style="note" x="140" y="0" width="399" height="20"/><text><![CDATA[${note}]]></text></staticText>

      <staticText><reportElement style="gridLabel" x="0" y="30" width="539" height="14"/><text><![CDATA[${spec}]]></text></staticText>
      <staticText><reportElement style="th" x="0" y="46" width="359" height="16"/><text><![CDATA[${hHyg}]]></text></staticText>
      <staticText><reportElement style="th" x="359" y="46" width="180" height="16"/><text><![CDATA[${hRes}]]></text></staticText>

${rows}
    </band>
  </summary>
`;
fs.writeFileSync(D + "\\p3b-summary.xml", xml, "utf8");
console.log("BAND=" + bandH + " ROWS=" + H.length);
console.log("BYTES=" + xml.length);
