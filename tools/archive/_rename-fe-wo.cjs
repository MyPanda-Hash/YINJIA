/**
 * 生产工单改名收尾(2026-09-24):
 *  ①各语言包补「生产工单/生产工单明细表/生产工单统计表」键(菜单标题走 tt 需要);
 *  ②用户可见文案 生产加工单 → 生产工单(6 个 Vue 文件)。
 */
const fs = require('fs');
const base = 'D:/workspace/yinjia/frontend/src/';

// ① 语言包:新键插在既有 '生产加工单' 行之后(找不到则插在 '生产加工单明细表' 行后)
const T = {
  en: ['Production Work Order', 'Production WO Detail List', 'Production WO Statistics'],
  'zh-TW': ['生產工單', '生產工單明細表', '生產工單統計表'],
  ja: ['製造オーダ', '製造オーダ明細', '製造オーダ統計'],
  ko: ['생산 작업지시', '생산 작업지시 명세', '생산 작업지시 통계'],
  de: ['Fertigungsauftrag', 'Fertigungsauftrag – Details', 'Fertigungsauftrag – Statistik'],
  es: ['Orden de fabricación', 'Detalle de orden de fabricación', 'Estadísticas de orden de fabricación'],
  fr: ["Ordre de fabrication", "Détail de l'ordre de fabrication", "Statistiques de l'ordre de fabrication"],
  ru: ['Производственный наряд', 'Детали производственного наряда', 'Статистика производственного наряда'],
  th: ['ใบสั่งผลิต', 'รายละเอียดใบสั่งผลิต', 'สถิติใบสั่งผลิต'],
  vi: ['Lệnh sản xuất', 'Chi tiết lệnh sản xuất', 'Thống kê lệnh sản xuất'],
};
let localesDone = 0;
for (const [loc, [a, b, c]] of Object.entries(T)) {
  const p = base + 'i18n/locales/' + loc + '.js';
  if (!fs.existsSync(p)) { console.log('缺语言包 ' + loc); continue; }
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes("'生产工单':")) { console.log(loc + ' 已有键,跳过'); continue; }
  const anchor = "    '生产加工单':";
  const lines = [`    '生产工单': ${JSON.stringify(a).replace(/"/g, "'")},`,
                 `    '生产工单明细表': ${JSON.stringify(b).replace(/"/g, "'")},`,
                 `    '生产工单统计表': ${JSON.stringify(c).replace(/"/g, "'")},`].join('\n');
  const i = s.indexOf(anchor);
  if (i < 0) { console.log(loc + ' 未找到锚点,跳过'); continue; }
  const eol = s.indexOf('\n', i);
  s = s.slice(0, eol + 1) + lines + '\n' + s.slice(eol + 1);
  fs.writeFileSync(p, s, 'utf8');
  localesDone++;
}
console.log('语言包补键 ' + localesDone + ' 个');

// ② 用户可见文案
const vue = [
  'core/views/PanelxList.vue', 'core/views/PanelxForm.vue',
  'views/dashboard/index.vue', 'views/scm/BusinessOverview.vue',
  'views/modules/ModuleView.vue', 'views/modules/solution/SolutionCenter.vue',
  'layout/HelpPanel.vue',
];
let n = 0;
for (const rel of vue) {
  const p = base + rel;
  if (!fs.existsSync(p)) { console.log('缺文件 ' + rel); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const cnt = s.split('生产加工单').length - 1;
  if (!cnt) continue;
  s = s.split('生产加工单').join('生产工单');
  fs.writeFileSync(p, s, 'utf8');
  n += cnt;
  console.log(rel + ' 改 ' + cnt + ' 处');
}
console.log('文案合计 ' + n + ' 处');
