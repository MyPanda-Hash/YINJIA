const fs = require('fs');
function edit(f, pairs) {
  let s = fs.readFileSync(f, 'utf8'); let ok = 0;
  for (const [a, b, l] of pairs) { if (!s.includes(a)) { console.log('MISS', l); continue; } s = s.split(a).join(b); ok++; }
  fs.writeFileSync(f, s, 'utf8'); console.log(f.split('/').pop(), ok, '/', pairs.length);
}
edit('D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/ButtonService.java', [
  ['throw new IllegalStateException("特采单 " + tcNo + " 已审核(已生成采购入库单),请先弃审该入库单再弃审检验单");',
   'throw new IllegalStateException("不合格品处理单 " + tcNo + " 已审核(已生成采购入库单),请先弃审该入库单再弃审检验单");', 'msg1'],
  ['throw new IllegalStateException("本退料单生成的特采单 " + tcNo + " 已审核(已生成采购入库单),"\n                        + "请先弃审那张入库单与特采单,再弃审退料单");',
   'throw new IllegalStateException("本退料单生成的不合格品处理单 " + tcNo + " 已审核(已生成采购入库单),"\n                        + "请先弃审那张入库单与处理单,再弃审退料单");', 'msg2'],
]);
edit('D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', [
  ['            // 2026-10-04:**不放「特采」按钮** —— 用户口径「应该是**一个明细的 bool 字段**不是按钮,删除按钮」,\n'
 + '            // 特采发起 = 明细行勾「特采」(QC_RETURN 明细是否字段),本单审核/审批通过时自动逐行生成特采单\n'
 + '            // (ButtonService.returnAutoSpecialAccept)。',
   '            // 2026-10-04「不放特采按钮」的口径仍成立,但**发起口已经换了**(2026-11-28):\n'
 + '            // 退料单明细的「特采」字段已下线,特采改由「检验数据记录判不合格 → 不合格品处理单(来料)」发起\n'
 + '            // (ButtonService.inspRecNgGenerate)。本单现在只承接**不特采**的不合格数量(退回供应商)。', 'ret-comment'],
]);
edit('D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/panel/PushGenerateHandler.java', [
  ['     * - 特采(2026-10-04 口径变更):**本路径恒为「否」**。检验明细的「特采」字段已整体下线,\n'
 + '     *   特采改由「暂收退料单审批通过 → 特采按钮 → 特采单 → 采购入库单」表达,那条链上的入库行\n',
   '     * - 特采(2026-11-28 口径):**本路径恒为「否」**。免检直达/直接选单出来的入库行不是让步接收,\n'
 + '     *   让步接收由「检验数据记录判不合格 → 不合格品处理单(来料)审批通过 → 回填检验单特采 → inspAutoSpecialIn」\n'
 + '     *   那条链写「是」(ButtonService)。\n', 'push-comment'],
]);
