const fs = require('fs');
const f = 'D:/YINJIA-main/frontend/src/core/dashboard/flowSpec.js';
let s = fs.readFileSync(f, 'utf8');
function rep(a, b, label) {
  if (!s.includes(a)) { console.log('MISS', label); return; }
  s = s.replace(a, b); console.log('ok', label);
}
rep("    intro: '采购订单 → 暂收单 →(来料检验?)→ 检验/退货/特采 → 采购入库 → 转 ERP',",
    "    intro: '采购订单 → 暂收单 →(来料检验?)→ 检验 → 不合格品处理 / 退货 → 采购入库 → 转 ERP',", 'intro');
rep("        key: 'qc', name: '检验与判定', hint: '来料检验单审核后按合格数量 / 不合格数量分流',",
    "        key: 'qc', name: '检验与判定', hint: '合格数量直接进采购入库;不合格数量按检验单明细「特采」分流',", 'lane-qc');
rep("            note: '合格 → 采购入库单;不合格 → 退货单(特采=是,审批)',",
    "            note: '合格 → 采购入库单;不合格 → 不合格品处理单(来料)定让步接收与否,再由「特采」分流',", 'note-insp');
rep("            note: '检验单每条明细对应一张数据记录',",
    "            note: '检验单每条明细对应一张记录;结论=不合格 → 审批通过自动生成不合格品处理单',", 'note-rec');
rep("        key: 'put', name: '入库 / 退货 / 特采', hint: '特采必须二级审批通过才放行进采购入库',",
    "        key: 'put', name: '入库 / 不合格品处理 / 退货', hint: '不合格品处理单二级审批通过才回填「特采」,特采=是才放行进采购入库',", 'lane-put');
rep("            note: '不合格数量退料;「特采 = 是」的行转特采流程',",
    "            note: '只有不特采的不合格数量才走本单(退回供应商)',", 'note-ret');
rep("            key: 'tc', name: '特采单', code: 'QC_TC_IN', route: '/panelx/list/QC_TC_IN',",
    "            key: 'tc', name: '不合格品处理单(来料)', code: 'QC_TC_IN', route: '/panelx/list/QC_TC_IN',", 'node-tc');
rep("            note: '二级审批:通过后放行 → 采购入库单',",
    "            note: '二级审批通过 → 回填来料检验单「特采」=是 → 不合格数量进采购入库(让步接收)',", 'note-tc');
rep(" * 检验数据记录+检验目录→合格→采购入库 / 不合格→退货单(特采)→特采单(二级审批)→采购入库;",
    " * 检验数据记录+检验目录→合格→采购入库 / 不合格→不合格品处理单(来料,二级审批)→回填特采→采购入库或暂收退料;", 'doc-head');
fs.writeFileSync(f, s, 'utf8');
