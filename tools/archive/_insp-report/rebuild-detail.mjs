#!/usr/bin/env node
/**
 * 重建 detail band:8 行检验项目,坐标按各行实际需要的高度精确累加,杜绝重叠。
 * 行高:1=22 2=52 3=22 4=22 5=40 6=48 7=56 8=22,行间距 2。
 * 运行: node tools/archive\_insp-report\rebuild-detail.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report";
const u = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// 列坐标(x/宽度)
const X = { seq: 0, item: 26, req: 102, std: 292, qty: 358, res: 398, vd: 508 };
const W = { seq: 26, item: 76, req: 190, std: 66, qty: 40, res: 110, vd: 31 };

// 8 行:[序号, 项目, 检验要求, 抽样标准, 抽检量, 结果, 判定, 行高]
const R = [
  ["1", "\\u5916\\u89c2\\u68c0\\u67e5",
   "\\u5916\\u89c2\\u5747\\u5300\\u5b8c\\u597d\\uff0c\\u65e0\\u5f2f\\u66f2\\u53d8\\u5f62\\u3001\\u65e0\\u660e\\u663e\\u5212\\u75d5\\u88c2\\u7eb9\\u3001\\u65e0\\u6cb9\\u6c61",
   "GBT2828II\\u7ea7", "50", "", "\\u7b26\\u5408", 22],
  ["2", "\\u5c3a\\u5bf8\\u89c4\\u683c\\u68c0\\u67e5",
   "\\u5916\\u5f84\\uff1a44.5\\u00b10.5mm  \\u5185\\u5f84\\uff1a20.8\\u00b10.5mm  \\u957f\\u5ea6\\uff1a256.5\\u00b10.5mm",
   "GBT2828S-2", "5",
   "\\u5916\\u5f84 44.5/44.6/44.5/44.7/44.6\\n\\u5185\\u5f84 20.9/20.8/21.0/20.7/20.8\\n\\u957f\\u5ea6 256.2/256.2/256.9/256.4/256.6",
   "\\u7b26\\u5408", 52],
  ["3", "\\u91cd\\u91cf\\u68c0\\u67e5", "\\uff1e200\\u514b", "GBT2828S-2", "5",
   "234.5/230.8/234.1/225.1/226.1", "\\u7b26\\u5408", 22],
  ["4", "\\u6324\\u538b\\u5f3a\\u5ea6\\u68c0\\u67e5",
   "\\u53c2\\u8003\\u4f0a\\u53ef\\u666e\\u6d4b\\u8bd5\\u65b9\\u6cd5\\uff0c\\u6324\\u538b\\u5f3a\\u5ea6\\u226530kgf",
   "GBT2828S-1", "3", "\\u65e0\\u7834\\u635f", "\\u7b26\\u5408", 22],
  ["5", "\\u9ed1\\u6c34\\u68c0\\u67e5",
   "\\u8fdb\\u6c34\\u538b\\u529b0.4\\u00b10.02Mpa\\uff0c\\u6d41\\u901f1.4L/min\\uff0c\\u63a5\\u6c34\\u6d4b\\u8bd5\\u9ed1\\u6c34\\u91cf\\uff1b\\u540c\\u4e00\\u6839\\u70ad\\u68ad\\u51b2\\u6d17\\u4e94\\u5206\\u949f\\u540e\\u9759\\u7f6e\\u6d78\\u6ce1\\u56db\\u5c0f\\u65f6\\u518d\\u6b21\\u901a\\u6c34\\uff0c\\u63a5\\u6c34200ml\\uff0c\\u68c0\\u67e5\\u662f\\u5426\\u6709\\u9ed1\\u6c34\\u3001\\u9ed1\\u6e23",
   "GBT2828S-1", "3", "\\u65e0\\u9ed1\\u6c34\\uff0c\\u65e0\\u53ef\\u89c1\\u9897\\u7c92\\u7269", "\\u7b26\\u5408", 40],
  ["6", "\\u4f59\\u6c2f\\u6d4b\\u8bd5",
   "\\u91c7\\u7528\\u6b21\\u6c2f\\u9178\\u94a0\\u539f\\u6db2\\uff0c\\u4f59\\u6c2f\\u6d53\\u5ea6\\u63a7\\u5236\\u57282.0(\\u00b10.2)mg/L\\uff0cpH7.5\\u00b10.5;\\u8fdb\\u6c34\\u538b\\u529b60psi\\uff0c\\u6d41\\u901f1.4L/min,\\u6e29\\u5ea620\\u00b13\\u2103;\\u5728\\u521d\\u59cb\\u30011/4\\u5bff\\u547d\\u30011/2\\u5bff\\u547d\\u30013/4\\u5bff\\u547d\\u3001\\u5bff\\u547d\\u7ec8\\u70b9\\u6d4b\\u8bd5\\uff0c\\u5bff\\u547d\\u22654000L\\uff08\\u53bb\\u9664\\u7387\\uff1a\\u521d\\u59cb98%,\\u7ec8\\u70b950%\\uff09",
   "GBT2828S-1", "1", "0L\\uff1a99.1%  4000L\\uff1a77.5%", "\\u7b26\\u5408", 48],
  ["7", "\\u78b1\\u6027\\u5bff\\u547d\\u6d4b\\u8bd5",
   "\\u7eaf\\u6c34\\u6d4b\\u8bd5\\uff08\\u94f6\\u5609\\u7eaf\\u6c34\\uff09\\u6d4b\\u8bd525\\u00b13\\u2103\\u3001\\u6d41\\u901f1.4L/min\\uff0c\\u5728\\u521d\\u59cb\\u30011/4\\u5bff\\u547d\\u30011/2\\u5bff\\u547d\\u30013/4\\u5bff\\u547d\\u3001\\u5bff\\u547d\\u7ec8\\u70b9\\u6d4b\\u8bd5\\uff0c\\u6d4b\\u8bd5\\u7eaf\\u6c34\\u53ca\\u70ad\\u68ad\\u51fa\\u6c34PH\\u503c\\uff0c4000L\\u5bff\\u547d\\u672b\\u7aefpH\\u63d0\\u5347\\u503c\\u22650.5\\uff0c\\u70ad\\u68ad\\u5728\\u8fc7\\u6d41\\u548c\\u6d78\\u6ce1\\u6761\\u4ef6\\u4e0b\\u7684\\u6ee4\\u540e\\u6c34\\u53e3\\u611f\\u65e0\\u660e\\u663e\\u5f02\\u5e38",
   "GBT2828S-1", "1", "4000L:0.65", "\\u7b26\\u5408", 56],
  ["8", "\\u5305\\u88c5\\u68c0\\u67e5",
   "\\u7eb8\\u7bb1\\u65e0\\u7834\\u635f\\uff0c\\u80f6\\u5e26\\u5c01\\u7bb1\\u5b8c\\u597d\\uff0c\\u51fa\\u8d27\\u6807\\u793a\\u5b8c\\u6574\\u6e05\\u6670",
   "GBT2828II\\u7ea7", "50", "\\u65e0\\u7834\\u635f", "\\u7b26\\u5408", 22],
];

let y = 0;
const rows = R.map(([n, item, req, std, qty, res, vd, h]) => {
  const top = y;
  y += h + 2;
  const lines = res.split("\\n").map((t) => '"' + u(t) + '"').join(' + "\\n" + ');
  const resExpr = res === "" ? '""' : (res.includes("\\n") ? lines : '"' + u(res) + '"');
  return `      <textField><reportElement style="cellSC" x="${X.seq}" y="${top}" width="${W.seq}" height="${h}"/><textFieldExpression><![CDATA["${n}"]]></textFieldExpression></textField>
      <textField><reportElement style="itemC" x="${X.item}" y="${top}" width="${W.item}" height="${h}"/><textFieldExpression><![CDATA["${u(item)}"]]></textFieldExpression></textField>
      <textField textAdjust="StretchHeight"><reportElement style="cellS" x="${X.req}" y="${top}" width="${W.req}" height="${h}"/><textFieldExpression><![CDATA["${u(req)}"]]></textFieldExpression></textField>
      <textField><reportElement style="cellSC" x="${X.std}" y="${top}" width="${W.std}" height="${h}"/><textFieldExpression><![CDATA["${u(std)}"]]></textFieldExpression></textField>
      <textField><reportElement style="cellSC" x="${X.qty}" y="${top}" width="${W.qty}" height="${h}"/><textFieldExpression><![CDATA["${qty}"]]></textFieldExpression></textField>
      <textField textAdjust="StretchHeight"><reportElement style="cellS" x="${X.res}" y="${top}" width="${W.res}" height="${h}"/><textFieldExpression><![CDATA[${resExpr}]]></textFieldExpression></textField>
      <textField><reportElement style="cellSC" x="${X.vd}" y="${top}" width="${W.vd}" height="${h}"/><textFieldExpression><![CDATA["${u(vd)}"]]></textFieldExpression></textField>`;
}).join("\n");

const xml = `  <detail>
    <band height="${y + 2}">
${rows}
    </band>
  </detail>
`;
fs.writeFileSync(D + "\\p3a-detail.xml", xml, "utf8");
console.log("BAND_HEIGHT=" + (y + 2));
console.log("ROWS=" + R.length);
