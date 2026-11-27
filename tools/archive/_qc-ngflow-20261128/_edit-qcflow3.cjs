const fs = require('fs');
const f = 'D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/QcFlowService.java';
let s = fs.readFileSync(f, 'utf8');
function rep(a, b, label) {
  if (!s.includes(a)) { console.log('MISS', label); return; }
  s = s.split(a).join(b);
  console.log('ok', label);
}
// ① APPLY 块:tc → ng(用短锚点定位)
const A = 'r.id DESC) ret';
const B = '/* 采购入库单:';
const i = s.indexOf(A), j = s.indexOf(B);
if (i < 0 || j < 0 || j < i) throw new Error('markers');
const replacement = A + '\n'
  + '                  /* 不合格品处理单(来料,2026-11-28 由「特采单」正名;让步接收的真正决定方):\n'
  + '                     先按检验单号,再按「批次号 + 产品名称=物料名称」兜底 */\n'
  + '                  OUTER APPLY (SELECT TOP 1 t.单据编号 AS 不合格品处理单号, t.单据日期 AS 不合格品处理日期,\n'
  + '                                      t.不合格品数量, t.最终处理结果,\n'
  + '                                      t.单据状态 AS 不合格品处理头状态, t.审核时间 AS 不合格品处理审核时间\n'
  + '                                 FROM dbo.qc_tc_in t\n'
  + "                                WHERE ISNULL(t.asp_cancel,'N') <> 'Y'\n"
  + '                                  AND ((ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号)\n'
  + "                                       OR (ISNULL(d.批次号, N'') <> N'' AND t.批次号 = d.批次号\n"
  + '                                           AND t.产品名称 = d.物料名称))\n'
  + '                                ORDER BY CASE WHEN ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号 THEN 0 ELSE 1 END,\n'
  + '                                         t.id DESC) ng\n                  ';
s = s.slice(0, i) + replacement + s.slice(j);
// ② 剩余键名
rep("WHERE s.panel_code = N'QC_TC_IN' AND s.doc_no = tc.特采单号) d5",
    "WHERE s.panel_code = N'QC_TC_IN' AND s.doc_no = ng.不合格品处理单号) d5", 'd5');
rep("OR ISNULL(退货单号,N'') LIKE ? OR ISNULL(特采单号,N'') LIKE ?)",
    "OR ISNULL(退货单号,N'') LIKE ? OR ISNULL(不合格品处理单号,N'') LIKE ?)", 'like');
rep("w.append(\" AND 当前环节 IN (N'送料', N'检验', N'退货', N'特采', N'入库') AND 异常 = 0\");",
    "w.append(\" AND 当前环节 IN (N'送料', N'检验', N'不合格品处理', N'退货', N'入库') AND 异常 = 0\");", 'undone-stage');
rep('} else if ("待特采".equals(state)) {\n            w.append(" AND 当前环节 = N\'特采\'");',
    '} else if ("待不合格品处理".equals(state)) {\n            w.append(" AND 当前环节 = N\'不合格品处理\'");', 'filter');
rep('str(r.get("检验日期")), str(r.get("退货日期")), str(r.get("特采日期")), str(r.get("入库日期"))));',
    'str(r.get("检验日期")), str(r.get("退货日期")), str(r.get("不合格品处理日期")), str(r.get("入库日期"))));', 'stuck-call');
rep('{@code 状态}(全部/未完成/已完成/待检验/待退货/待特采/待入库/异常,默认未完成)',
    '{@code 状态}(全部/未完成/已完成/待检验/待不合格品处理/待退货/待入库/异常,默认未完成)', 'doc-state');
rep(' * 没有检验单就退回送料日期;待退货 → 退货日期;待特采 → 特采日期;待入库 → 入库日期);',
    ' * 没有检验单就退回送料日期;待不合格品处理 → 处理单日期;待退货 → 退货日期;待入库 → 入库日期);', 'doc-stuck');
rep(' * 行取数(不含筛选/排序):送料行 × 检验行 × 退货行 × 特采单 × 入库行 × 五张单的状态 × 商品档案检验口径。',
    ' * 行取数(不含筛选/排序):送料行 × 检验行 × 退货行 × 不合格品处理单 × 入库行 × 各单的状态 × 商品档案检验口径。', 'doc-rows');
rep(' *   退货/特采要先于入库(入库的②级关联要用它们的单号)。',
    ' *   退货/不合格品处理要先于入库(入库的②级关联要用它们的单号)。', 'doc-order');
rep(' * 两个分支单都带自己的状态与跳转(暂收退回单 / 特采单)。',
    ' * 两个分支单都带自己的状态与跳转(不合格品处理单(来料) / 暂收退回单)。', 'doc-branch');
rep(' *   <li>不合格 → 暂收退回单(退回供应商)→ 若让步接收则再开特采单 → 特采审批通过后 → 采购入库单。</li>',
    ' *   <li>不合格 → 检验数据记录判「不合格」→ 不合格品处理单(来料)→ 审批通过回填检验单「特采」:\n'
  + ' *       特采=是 → 采购入库单(让步接收);否则 → 暂收退回单(退回供应商)。</li>', 'doc-ng');
rep(' *   <li>检验 → 特采:{@code qc_tc_in.检验单号 = 检验单号};取不到再按「批次号 + 产品名称=物料名称」兜;</li>',
    ' *   <li>检验 → 不合格品处理:优先按检验数据记录上的「不合格品处理单号」,\n'
  + ' *       其次 {@code qc_tc_in.检验单号 = 检验单号};取不到再按「批次号 + 产品名称=物料名称」兜;</li>', 'doc-ng2');
rep(' *   <li>检验/送料/退货/特采 → 入库,按可信度三级:',
    ' *   <li>检验/送料/退货/不合格品处理 → 入库,按可信度三级:', 'doc-in');
rep(' *       ① 检验行上直接记了入库单号;② 入库单 {@code 来源单号} = 检验单号 / 暂收单号 / 退货单号 / 特采单号;',
    ' *       ① 检验行上直接记了入库单号;② 入库单 {@code 来源单号} = 检验单号 / 暂收单号 / 退货单号 / 不合格品处理单号;', 'doc-in2');
rep(' * 「送料暂收单 {@code sl_recv} → 来料检验单 {@code qc_insp} →(不合格时)暂收退回单 {@code qc_return}\n'
  + ' * →(让步接收时)特采单 {@code qc_tc_in} → 采购入库单 {@code bd_purchase_in}」上的落点摊平到一行 ——',
  ' * 「送料暂收单 {@code sl_recv} → 来料检验单 {@code qc_insp} →(不合格时)不合格品处理单(来料) {@code qc_tc_in}\n'
  + ' * → 暂收退回单 {@code qc_return}(不特采)／采购入库单 {@code bd_purchase_in}(让步接收)」上的落点摊平到一行 ——', 'doc-head');
rep('        //   → (让步)特采 → 入库 → 完成。', '        //   → 不合格品处理(让步则回填特采) → 入库或退货 → 完成。', 'doc-stage');
fs.writeFileSync(f, s, 'utf8');
