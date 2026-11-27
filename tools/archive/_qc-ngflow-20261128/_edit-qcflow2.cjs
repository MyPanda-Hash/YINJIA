const fs = require('fs');
const f = 'D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/QcFlowService.java';
let s = fs.readFileSync(f, 'utf8');
const A = "                                          r.id DESC) ret";
const B = "                  /* 采购入库单:";
const i = s.indexOf(A), j = s.indexOf(B);
if (i < 0 || j < 0 || j < i) throw new Error('markers ' + i + ' ' + j);
const replacement = "                                          r.id DESC) ret\n"
  + "                  /* 不合格品处理单(来料,2026-11-28 由「特采单」正名;让步接收的真正决定方):\n"
  + "                     先按检验单号,再按「批次号 + 产品名称=物料名称」兜底 */\n"
  + "                  OUTER APPLY (SELECT TOP 1 t.单据编号 AS 不合格品处理单号, t.单据日期 AS 不合格品处理日期,\n"
  + "                                      t.不合格品数量, t.最终处理结果,\n"
  + "                                      t.单据状态 AS 不合格品处理头状态, t.审核时间 AS 不合格品处理审核时间\n"
  + "                                 FROM dbo.qc_tc_in t\n"
  + "                                WHERE ISNULL(t.asp_cancel,'N') <> 'Y'\n"
  + "                                  AND ((ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号)\n"
  + "                                       OR (ISNULL(d.批次号, N'') <> N'' AND t.批次号 = d.批次号\n"
  + "                                           AND t.产品名称 = d.物料名称))\n"
  + "                                ORDER BY CASE WHEN ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号 THEN 0 ELSE 1 END,\n"
  + "                                         t.id DESC) ng\n";
s = s.slice(0, i) + replacement + s.slice(j);
s = s.replace("WHERE s.panel_code = N'QC_TC_IN' AND s.doc_no = tc.特采单号) d5",
              "WHERE s.panel_code = N'QC_TC_IN' AND s.doc_no = ng.不合格品处理单号) d5");
// 头部说明(链路注释)
s = s.replace(" * 「送料暂收单 {@code sl_recv} → 来料检验单 {@code qc_insp} →(不合格时)暂收退回单 {@code qc_return}\n"
            + " * →(让步接收时)特采单 {@code qc_tc_in} → 采购入库单 {@code bd_purchase_in}」上的落点摊平到一行 ——",
  " * 「送料暂收单 {@code sl_recv} → 来料检验单 {@code qc_insp} →(不合格时)不合格品处理单(来料) {@code qc_tc_in}\n"
  + " * → 暂收退回单 {@code qc_return}(不特采)／采购入库单 {@code bd_purchase_in}(让步接收)」上的落点摊平到一行 ——");
s = s.replace(" *   <li>检验 → 特采:{@code qc_tc_in.检验单号 = 检验单号};取不到再按「批次号 + 产品名称=物料名称」兜;</li>",
  " *   <li>检验 → 不合格品处理:优先按检验数据记录上的「不合格品处理单号」,其次 {@code qc_tc_in.检验单号 = 检验单号},\n"
  + " *       取不到再按「批次号 + 产品名称=物料名称」兜;</li>");
fs.writeFileSync(f, s, 'utf8');
console.log('ok');
