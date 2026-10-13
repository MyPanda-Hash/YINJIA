#!/usr/bin/env node
/**
 * 组装制程检验记录表 jrxml(照截图版式)。
 * band 顺序(严格):title → pageHeader → columnHeader → detail → pageFooter
 *   pageHeader   = 公司 + 标题 + 元信息
 *   title        = ① 制程检验组(黄底提示 + 7 固定列 + 外观/尺寸/重量)
 *   columnHeader = ② 出货检验功能性测试组 表头
 *   detail       = ② 的检验要求/检验方法行
 *   pageFooter   = 页码 + 打印时间 + 签名
 * 运行: node tools/archive/_qc-proc/assemble.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\";
const OUT = "D:\\workspace\\yinjia\\backend\\src\\main\\resources\\reports\\qc_proc_insp.jrxml";
const rd = (n) => fs.readFileSync(D + n, "utf8");

const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);

// r1-head 结尾停在最后一个 <field>,这里补上根元素的开标签收尾
const HEAD_TAIL = "\n";

// ⚠ band 顺序按规范:title 必须在 pageHeader 之前;footer 自带 </jasperReport>
const title = rd("r3a-body.xml");
const pageHeader = rd("r2-pageheader.xml");

const parts = [
  rd("r1-head.xml"), HEAD_TAIL,   // 根 + 样式 + 参数 + 字段
  title,                          // ① 制程检验组(title 在最前)
  pageHeader,                     // 页眉(公司/标题/元信息)
  rd("r4-group2.xml"),            // ② columnHeader + detail
  rd("r5-footer.xml"),            // pageFooter + </jasperReport>
];
const xml = parts.join("");
fs.writeFileSync(OUT, xml, "utf8");

const cnt = (re) => (xml.match(re) || []).length;
console.log("BYTES=" + fs.statSync(OUT).size);
console.log("title=" + cnt(/<title>/g) + " pageHeader=" + cnt(/<pageHeader>/g)
  + " columnHeader=" + cnt(/<columnHeader>/g) + " detail=" + cnt(/<detail>/g)
  + " pageFooter=" + cnt(/<pageFooter>/g) + " summary=" + cnt(/<summary>/g));
console.log("ROOT_CLOSED=" + xml.includes(LT + "/jasperReport" + GT));
const seq = ["title", "pageHeader", "columnHeader", "detail", "pageFooter"];
const idx = seq.map((n) => xml.indexOf(LT + n + GT));
console.log("ORDER=" + seq.map((n, i) => n + "@" + idx[i]).join(" "));
console.log("ORDER_OK=" + idx.every((v, i) => v > 0 && (i === 0 || v > idx[i - 1])));
