const fs = require('fs');
const f = 'D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/QcFlowService.java';
let s = fs.readFileSync(f, 'utf8');
const pairs = [
  // ① 状态串
  ['        String tcStatus = "CASE WHEN tc.特采单号 IS NULL THEN NULL ELSE "\n                + statusOf("d5", "tc.特采头状态", "tc.特采审核时间") + " END";',
   '        String ngStatus = "CASE WHEN ng.不合格品处理单号 IS NULL THEN NULL ELSE "\n                + statusOf("d5", "ng.不合格品处理单头状态", "ng.不合格品处理审核时间") + " END";'],
  // ② 列
  ['                    /* ── 不合格分支二:特采单(让步接收) ── */\n'
   + '                    tc.特采单号 AS 特采单号,\n'
   + '                    CONVERT(nvarchar(10), tc.特采日期, 120) AS 特采日期,\n'
   + '                    tc.不合格品数量 AS 特采数量,\n'
   + '                    ISNULL(tc.最终处理结果, N\'\') AS 特采结果,\n'
   + '                    %s AS 特采状态,',
   '                    /* ── 不合格分支二:不合格品处理单(来料,2026-11-28 由「特采单」正名) ── */\n'
   + '                    ng.不合格品处理单号 AS 不合格品处理单号,\n'
   + '                    CONVERT(nvarchar(10), ng.不合格品处理日期, 120) AS 不合格品处理日期,\n'
   + '                    ng.不合格品数量 AS 不合格品处理数量,\n'
   + '                    ISNULL(ng.最终处理结果, N\'\') AS 不合格品处理结果,\n'
   + '                    %s AS 不合格品处理状态,\n'
   + '                    /* 检验行的「特采」回填(2026-11-28 用户口径:靠它判断不合格数量进采购入库还是暂收退料) */\n'
   + '                    ISNULL(ins.特采, 0) AS 特采,'],
  // ③ APPLY:`tc` → `ng`
  ['                  /* 特采单(让步接收):先按检验单号,再按「批次号 + 产品名称=物料名称」兜底 */\n'
   + '                  OUTER APPLY (SELECT TOP 1 t.单据编号 AS 特采单号, t.单据日期 AS 特采日期,\n'
   + '                                      t.不合格品数量, t.最终处理结果,\n'
   + '                                      t.单据状态 AS 特采头状态, t.审核时间 AS 特采审核时间\n'
   + '                                 FROM dbo.qc_tc_in t\n'
   + '                                WHERE ISNULL(t.asp_cancel,N\'\') <> N\'Y\'\n'
   + '                                  AND ((ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号)\n'
   + '                                       OR (ISNULL(d.批次号, N\'\') <> N\'\' AND t.批次号 = d.批次号\n'
   + '                                           AND t.产品名称 = d.物料名称))\n'
   + '                                ORDER BY CASE WHEN ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号 THEN 0 ELSE 1 END,\n'
   + '                                         t.id DESC) tc',
   '                  /* 不合格品处理单(来料,让步接收的真正决定方):先按检验单号,再按「批次号 + 产品名称=物料名称」兜底 */\n'
   + '                  OUTER APPLY (SELECT TOP 1 t.单据编号 AS 不合格品处理单号, t.单据日期 AS 不合格品处理日期,\n'
   + '                                      t.不合格品数量, t.最终处理结果,\n'
   + '                                      t.单据状态 AS 不合格品处理头状态, t.审核时间 AS 不合格品处理审核时间\n'
   + '                                 FROM dbo.qc_tc_in t\n'
   + '                                WHERE ISNULL(t.asp_cancel,N\'\') <> N\'Y\'\n'
   + '                                  AND ((ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号)\n'
   + '                                       OR (ISNULL(d.批次号, N\'\') <> N\'\' AND t.批次号 = d.批次号\n'
   + '                                           AND t.产品名称 = d.物料名称))\n'
   + '                                ORDER BY CASE WHEN ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号 THEN 0 ELSE 1 END,\n'
   + '                                         t.id DESC) ng'],
  // ④ 入库来源单号里引用
  ['b.来源单号 IN (ins.检验单号, h.单据编号, ret.退货单号, tc.特采单号)',
   'b.来源单号 IN (ins.检验单号, h.单据编号, ret.退货单号, ng.不合格品处理单号)'],
  // ⑤ 状态表 panel 查找
  ['                                 WHERE s.panel_code = N\'QC_TC_IN\' AND s.doc_no = tc.特采单号) d5',
   '                                 WHERE s.panel_code = N\'QC_TC_IN\' AND s.doc_no = ng.不合格品处理单号) d5'],
  // ⑥ 检验行取 特采
  ['                                      x.送检数量, x.合格数量, x.不合格数量, x.入库单号 AS 检验入库单号',
   '                                      x.送检数量, x.合格数量, x.不合格数量, ISNULL(x.特采, 0) AS 特采,\n'
   + '                                      x.入库单号 AS 检验入库单号'],
  // ⑦ 当前环节
  ['                  WHEN c.特采单号 IS NOT NULL AND c.特采状态 IN (N\'草稿\', N\'审批中\') THEN N\'特采\'\n'
   + '                  WHEN c.特采单号 IS NULL AND c.退货单号 IS NOT NULL\n'
   + '                       AND c.退货状态 IN (N\'草稿\', N\'审批中\') THEN N\'退货\'\n'
   + '                  WHEN c.特采单号 IS NULL AND c.退货单号 IS NULL AND c.入库单号 IS NULL\n'
   + '                       AND c.检验结论 = N\'不合格\' THEN N\'退货\'\n'
   + '                  WHEN c.入库单号 IS NOT NULL AND c.入库状态 <> N\'已审核\' THEN N\'入库\'\n'
   + '                  WHEN c.入库单号 IS NULL AND c.特采单号 IS NULL AND c.退货单号 IS NOT NULL\n'
   + '                       AND c.退货状态 = N\'已审核\' THEN N\'完成\'',
   '                  WHEN c.不合格品处理单号 IS NOT NULL\n'
   + '                       AND c.不合格品处理状态 IN (N\'草稿\', N\'审批中\') THEN N\'不合格品处理\'\n'
   + '                  WHEN c.退货单号 IS NOT NULL AND c.退货状态 IN (N\'草稿\', N\'审批中\') THEN N\'退货\'\n'
   + '                  WHEN c.入库单号 IS NULL AND c.退货单号 IS NULL\n'
   + '                       AND c.检验结论 = N\'不合格\' THEN N\'不合格品处理\'\n'
   + '                  WHEN c.入库单号 IS NOT NULL AND c.入库状态 <> N\'已审核\' THEN N\'入库\'\n'
   + '                  WHEN c.入库单号 IS NULL AND c.退货单号 IS NOT NULL\n'
   + '                       AND c.退货状态 = N\'已审核\' THEN N\'完成\''],
  // ⑧ 汇总
  ['            if ("特采".equals(stage)) waitTc++;', '            if ("不合格品处理".equals(stage)) waitNg++;'],
  ['        int waitTc = 0;', '        int waitNg = 0;'],
  ['        s.put("待特采", waitTc);', '        s.put("待不合格品处理", waitNg);'],
  // ⑨ 停留天数
  ['        } else if ("特采".equals(stage)) {\n            base = firstNonEmpty(tcDate, retDate, inspDate, recvDate);',
   '        } else if ("不合格品处理".equals(stage)) {\n            base = firstNonEmpty(ngDate, retDate, inspDate, recvDate);'],
  ['                                 String retDate, String tcDate, String inDate) {',
   '                                 String retDate, String ngDate, String inDate) {'],
  ['            base = firstNonEmpty(inDate, tcDate, retDate, inspDate, recvDate);\n        } else {\n            base = firstNonEmpty(inDate, tcDate, retDate, inspDate, recvDate);',
   '            base = firstNonEmpty(inDate, ngDate, retDate, inspDate, recvDate);\n        } else {\n            base = firstNonEmpty(inDate, ngDate, retDate, inspDate, recvDate);'],
];
let n = 0;
for (const [a, b] of pairs) {
  if (!s.includes(a)) { console.log('MISS:', JSON.stringify(a.slice(0, 70))); continue; }
  s = s.replace(a, b);
  n++;
}
fs.writeFileSync(f, s, 'utf8');
console.log('replaced', n, 'of', pairs.length);
