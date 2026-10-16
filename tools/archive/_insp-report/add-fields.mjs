#!/usr/bin/env node
/**
 * 补 <field> 声明:模板引用了 $F{存货名称}/$F{存货编码}/$F{规格型号}/$F{数量}
 * (bl_sale_out 明细字段,yj_field.label),但缺 <field> 声明 => Jasper 报 Field not found。
 * 把 field 声明插入到 p2(pageHeader)之前。运行: node tools/archive/_insp-report/add-fields.mjs
 */
import fs from "node:fs";

const D = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report";
const u = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// 明细字段(来自 ReportService.detailRows -> bl_sale_out 行,键=yj_field.label)
const fields = [
  ["\\u5b58\\u8d27\\u7f16\\u7801", "java.lang.String"],   // 存货编码
  ["\\u5b58\\u8d27\\u540d\\u79f0", "java.lang.String"],   // 存货名称
  ["\\u89c4\\u683c\\u578b\\u53f7", "java.lang.String"],   // 规格型号
  ["\\u8ba1\\u91cf\\u5355\\u4f4d", "java.lang.String"],   // 计量单位
  ["\\u6570\\u91cf",       "java.math.BigDecimal"],   // 数量
  ["\\u6279\\u53f7",       "java.lang.String"],      // 批号
];

const block = fields
  .map(([n, t]) => `  <field name="${u(n)}" class="${t}"/>`)
  .join("\n");

fs.writeFileSync(D + "\\p8-fields.xml", block + "\n", "utf8");
console.log("FIELDS=" + fields.length);
console.log(block);
