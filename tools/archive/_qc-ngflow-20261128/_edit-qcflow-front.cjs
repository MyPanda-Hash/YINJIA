const fs = require('fs');
function edit(f, pairs) {
  let s = fs.readFileSync(f, 'utf8');
  let ok = 0;
  for (const [a, b, label] of pairs) {
    if (!s.includes(a)) { console.log('MISS', f.split('/').pop(), label); continue; }
    s = s.split(a).join(b); ok++;
  }
  fs.writeFileSync(f, s, 'utf8');
  console.log(f.split('/').pop(), 'ok', ok, '/', pairs.length);
}

const qcFlow = 'D:/YINJIA-main/frontend/src/core/qc/qcFlow.js';
edit(qcFlow, [
  ["  tc: Object.freeze({ code: 'QC_TC_IN', name: '特采单' }),",
   "  tc: Object.freeze({ code: 'QC_TC_IN', name: '不合格品处理单(来料)' }),", 'panel-name'],
  [" * recv/insp/rec/in 是主链(insp 与 rec 并列);ret(暂收退回单)/tc(特采单)是不合格分支。",
   " * recv/insp/rec/in 是主链(insp 与 rec 并列);tc(不合格品处理单(来料))/ret(暂收退回单)是不合格分支。", 'doc-panels'],
  ["  // 分支链只在「有退回单/特采单,或检验被判不合格」时才显示(全合格批次不占版面)。",
   "  // 分支链只在「有不合格品处理单/退回单,或检验被判不合格」时才显示(全合格批次不占版面)。", 'doc-showng'],
  [" *   分支链只在「有退回单/特采单,或检验被判不合格」时才显示(全合格批次不占版面)。",
   " *   分支链只在「有不合格品处理单/退回单,或检验被判不合格」时才显示(全合格批次不占版面)。", 'doc-showng2'],
  [" * 把后端一行数据摊成「送料 →(检验单 ∥ 检验数据记录)→ 入库」主链 + 「不合格 → 退回 / 特采」分支,",
   " * 把后端一行数据摊成「送料 →(检验单 ∥ 检验数据记录)→ 入库」主链 + 「不合格 → 不合格品处理 / 退回」分支,", 'doc-head'],
  [" * + 不合格分支(退回→特采)。", " * + 不合格分支(不合格品处理 → 让步接收入库 / 退回供应商)。", 'doc-branch'],
  ["  const ng = [\n    makeNode('ret', row?.['退货单号'], row?.['退货状态'], row?.['退货日期']),\n"
   + "    makeNode('tc', row?.['特采单号'], row?.['特采状态'], row?.['特采日期']),\n  ];",
   "  // 分支顺序 = 业务发生顺序:先出不合格品处理单(来料)(判让步接收与否),再走暂收退回(不特采时才有)\n"
   + "  const ng = [\n"
   + "    makeNode('tc', row?.['不合格品处理单号'], row?.['不合格品处理状态'], row?.['不合格品处理日期']),\n"
   + "    makeNode('ret', row?.['退货单号'], row?.['退货状态'], row?.['退货日期']),\n  ];", 'ng-nodes'],
  ["  // 分支链什么时候出现:有退回/特采单,或检验判了不合格(含部分不合格)。",
   "  // 分支链什么时候出现:有不合格品处理单/退回单,或检验判了不合格(含部分不合格)。", 'doc-when'],
  ["  const hasNgDoc = !!(String(row?.['退货单号'] ?? '').trim() || String(row?.['特采单号'] ?? '').trim())",
   "  const hasNgDoc = !!(String(row?.['不合格品处理单号'] ?? '').trim() || String(row?.['退货单号'] ?? '').trim())", 'hasng'],
]);

const monitor = 'D:/YINJIA-main/frontend/src/views/modules/qc/QcFlowMonitor.vue';
edit(monitor, [
  ["      <span class=\"qcf-stat is-warn\"><em>{{ tt('待特采') }}</em><b>{{ stat.waitTc }}</b></span>",
   "      <span class=\"qcf-stat is-warn\"><em>{{ tt('待不合格品处理') }}</em><b>{{ stat.waitNg }}</b></span>", 'statbar'],
  ["    waitTc: count('待特采', (r) => r?.['当前环节'] === '特采'),",
   "    waitNg: count('待不合格品处理', (r) => r?.['当前环节'] === '不合格品处理'),", 'stat'],
  ["  { value: '待特采', label: '待特采' },", "  { value: '待不合格品处理', label: '待不合格品处理' },", 'filter-opt'],
  ["              <div v-if=\"row['特采单号']\" class=\"qcf-l-sub\">\n"
   + "                <a class=\"qcf-link\" :title=\"nodeTitleOf(row, 'tc')\"\n"
   + "                   @click.stop=\"openDoc('QC_TC_IN', row['特采单号'])\">{{ tt('特采') }} {{ row['特采单号'] }}</a>\n"
   + "              </div>",
   "              <div v-if=\"row['不合格品处理单号']\" class=\"qcf-l-sub\">\n"
   + "                <a class=\"qcf-link\" :title=\"nodeTitleOf(row, 'tc')\"\n"
   + "                   @click.stop=\"openDoc('QC_TC_IN', row['不合格品处理单号'])\">{{ tt('不合格品处理') }} {{ row['不合格品处理单号'] }}</a>\n"
   + "              </div>\n"
   + "              <!-- 不合格数量去向(2026-11-28):特采=1 ⇒ 让步接收进采购入库;否则走暂收退料 -->\n"
   + "              <div v-if=\"Number(row['特采'] || 0) === 1\" class=\"qcf-l-sub is-tc\">{{ tt('特采→采购入库') }}</div>", 'list-tc'],
  ["  const tcQty = row?.['特采数量']", "  const tcQty = row?.['不合格品处理数量']", 'tcqty'],
  ["      if (s.key === 'tc') return { ...s, qty: tcQty != null ? `${tt('特采')} ${num(tcQty)}` : '' }",
   "      if (s.key === 'tc') return { ...s, qty: tcQty != null ? `${tt('不合格')} ${num(tcQty)}` : '' }", 'tcnode-qty'],
  ["      tc: '还没有特采单',", "      tc: '还没有不合格品处理单(来料):检验数据记录判「不合格」并审批通过后自动生成',", 'node-title'],
  ["  if (key === 'tc') return nodeTitle({ no: row?.['特采单号'], panel: 'QC_TC_IN' })",
   "  if (key === 'tc') return nodeTitle({ no: row?.['不合格品处理单号'], panel: 'QC_TC_IN' })", 'nodeTitleOf'],
  ["  if (stage === '特采') return 'warn'", "  if (stage === '不合格品处理') return 'warn'", 'tone'],
  [" * 检验给 合格/不合格,入库给 实收,退货给 退货数量,特采给 不合格品数量。",
   " * 检验给 合格/不合格,入库给 实收,不合格品处理单给 不合格品数量,退货单给 退货数量。", 'doc-chainOf'],
  ["            <!-- 不合格分支:只在「有退回/特采单」或「检验判了不合格」时出现,全合格批次不占版面 -->",
   "            <!-- 不合格分支:只在「有不合格品处理单/退回单」或「检验判了不合格」时出现,全合格批次不占版面 -->", 'doc-lane'],
]);
