/**
 * 生产加工单 → 生产工单 改名批量替换(2026-09-24)
 * 纪律:①可用数据键一律不动(buttonName 已在代码各处单独改,不在此列);
 *      ②yj_usage_log 历史留痕面板名保持旧值,读取处必须两代名兼容(ScheduleBoardService.trace);
 *      ③只改文案/注释/新写入的面板名。
 */
const fs = require('fs');
const base = 'D:/workspace/yinjia/backend/src/main/java/com/yinjia/mes/';
const jobs = [
  ['service/QuickScheduleService.java', [
    ['生产加工单', '生产工单'],
    ['加工单草稿', '工单草稿'],
    ['仅已审核加工单可排产', '仅已审核工单可排产'],
  ]],
  ['service/ScheduleBoardService.java', [
    // 先修追溯读取:两代面板名都认(历史留痕=生产加工单,改名后新留痕=生产工单)
    ["AND panel_name=N'生产加工单' AND doc_no=?", "AND panel_name IN (N'生产加工单', N'生产工单') AND doc_no=?"],
    ["生产加工单", "生产工单"],
  ]],
  ['panel/ManuCloseHandler.java', [['生产加工单', '生产工单']]],
  ['panel/ManuFirstArticleHandler.java', [['生产加工单', '生产工单']]],
  ['panel/ManuPurchaseReqHandler.java', [
    ['生产加工单', '生产工单'],
    ["head.put(\"来源单据\", \"生产工单\")", "head.put(\"来源单据\", \"生产工单\")"],
  ]],
  ['panel/ManuSplitHandler.java', [['生产加工单', '生产工单']]],
  ['service/ManuWritebackService.java', [['生产加工单', '生产工单']]],
  ['service/WoReportService.java', [['生产加工单', '生产工单']]],
  ['service/PanelPermissionService.java', [['生产加工单', '生产工单']]],
  ['service/PanelConfigService.java', [['生产加工单', '生产工单']]],
  ['service/ButtonService.java', [
    ['仅生产加工单/生产工单支持生成产品批号', '仅生产工单支持生成产品批号'],
    ['生产加工单', '生产工单'],
  ]],
];
let total = 0;
for (const [rel, rules] of jobs) {
  const p = base + rel;
  if (!fs.existsSync(p)) { console.log('缺文件: ' + rel); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  for (const [from, to] of rules) {
    if (from === to) continue;
    const n = s.split(from).length - 1;
    if (n) { s = s.split(from).join(to); total += n; }
  }
  if (s !== before) fs.writeFileSync(p, s, 'utf8');
  console.log(rel + ' : ' + (s === before ? '无改动' : '已改'));
}
console.log('替换处数合计 ' + total);
