#!/usr/bin/env node
/**
 * 终稿结构(不依赖 detail 行数):
 *   pageHeader   = 公司抬头 + 标题 + 元信息 + 表头网格        (每页重复)
 *   columnHeader = 检验项目表头 7 列                          (每页一次,不随数据行重复)
 *   detail       = 极小的"空白行"(height=1,无可见内容)       (数据源 N 行 => 只占 N pt 空隙)
 *   summary      = 结论 + 卫生安全段
 *   pageFooter   = 页码 + 签名 + 表单编号
 *
 * ⚠ 检验项目的 8 行是**静态内容**,放 columnHeader 里(只渲染一次)而不是 detail。
 *   这样无论销售出库单有几行明细,报告都只出一份。
 * 运行: node tools/archive\_insp-report\assemble-v4.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report";
const OUT = "D:\\workspace\\yinjia\\backend\\src\\main\\resources\\reports\\prod_insp.jrxml";
const rd = (n) => fs.readFileSync(D + "\\" + n, "utf8");

const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);
const P_CLOSE = "\n  " + LT + "/parameter" + GT + "\n";
const ROOT_CLOSE = LT + "/jasperReport" + GT + "\n";

// 把 p3a(detail 版)变形为 columnHeader:band 高度 +12 容纳表头行,所有 y +22
let d = rd("p3a-detail.xml");
const bandH = Number(/<band height="(\d+)"/.exec(d)[1]);
d = d.replace(/<band height="\d+">/, '<band height="' + (bandH + 24) + '">');
d = d.replace(/ y="(\d+)"/g, (m, y) => ' y="' + (Number(y) + 24) + '"');
// 表头 7 列(从 p9 取)插到最上面 y=0
const head7 = rd("p9-tablehead.xml").trim().replace(/ y="\d+"/g, ' y="0"');
const colHeader = "  <columnHeader>\n" + d.replace(/^\s*<detail>\s*/, "    ")
  .replace(/<\/detail>\s*$/, "").replace(/<band /, "<band ")
  .replace(/\n\s*$/, "\n") + "\n  </columnHeader>\n";

// 把表头行塞进 columnHeader 的 band 内(紧跟 <band ...> 之后)
const bandOpenEnd = colHeader.indexOf(GT, colHeader.indexOf("<band ")) + 1;
const colHeaderFinal = colHeader.slice(0, bandOpenEnd) + "\n" + head7 + "\n" + colHeader.slice(bandOpenEnd);

// 极小的空 detail —— 让 N 行数据只产生 N pt 空隙,不重复任何内容
const miniDetail = "  <detail>\n    <band height=\"1\">\n      <staticText><reportElement x=\"0\" y=\"0\" width=\"1\" height=\"1\" forecolor=\"#FFFFFF\"/><text><![CDATA[ ]]></text></staticText>\n    </band>\n  </detail>\n";

let p6 = rd("p6-footer.xml").replace(ROOT_CLOSE, "");
p6 = p6.replace(/\s*<detail>[\s\S]*?<\/detail>\s*/, "\n");

const parts = [
  rd("p1-head.xml"), P_CLOSE, rd("p8-fields.xml"),
  rd("p2-pageheader.xml"),
  colHeaderFinal,
  miniDetail,
  p6,
  rd("p3b-summary.xml"),
  ROOT_CLOSE,
];
const xml = parts.join("");
fs.writeFileSync(OUT, xml, "utf8");

const cnt = (re) => (xml.match(re) || []).length;
console.log("BYTES=" + fs.statSync(OUT).size);
console.log("pageHeader=" + cnt(/<pageHeader>/g) + " columnHeader=" + cnt(/<columnHeader>/g)
  + " detail=" + cnt(/<detail>/g) + " summary=" + cnt(/<summary>/g) + " pageFooter=" + cnt(/<pageFooter>/g));
console.log("COLHDR_HAS_8ROWS=" + (/外观检查/.test(xml) && /包装检查/.test(xml)));
