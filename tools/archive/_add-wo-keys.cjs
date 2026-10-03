/** 补 3 个新词条(日期范围/确认排产/请选择生产线)到 11 个语言包 */
const fs = require('fs');
const dir = 'D:/workspace/yinjia/frontend/src/i18n/locales/';
const T = {
  en: { 日期范围: 'Date Range', 确认排产: 'Confirm Schedule', 请选择生产线: 'Select a production line' },
  'zh-TW': { 日期范围: '日期範圍', 确认排产: '確認排產', 请选择生产线: '請選擇生產線' },
  ja: { 日期范围: '日付範囲', 确认排产: '生産計画を確定', 请选择生产线: '生産ラインを選択してください' },
  ko: { 日期范围: '날짜 범위', 确认排产: '일정 확정', 请选择生产线: '생산 라인을 선택하세요' },
  de: { 日期范围: 'Datumsbereich', 确认排产: 'Planung bestätigen', 请选择生产线: 'Fertigungslinie wählen' },
  es: { 日期范围: 'Rango de fechas', 确认排产: 'Confirmar programación', 请选择生产线: 'Seleccione una línea de producción' },
  fr: { 日期范围: 'Plage de dates', 确认排产: 'Confirmer la planification', 请选择生产线: 'Sélectionnez une ligne de production' },
  ru: { 日期范围: 'Диапазон дат', 确认排产: 'Подтвердить планирование', 请选择生产线: 'Выберите производственную линию' },
  th: { 日期范围: 'ช่วงวันที่', 确认排产: 'ยืนยันการจัดตาราง', 请选择生产线: 'เลือกสายการผลิต' },
  vi: { 日期范围: 'Khoảng ngày', 确认排产: 'Xác nhận lịch sản xuất', 请选择生产线: 'Chọn dây chuyền sản xuất' },
};
let done = 0;
for (const [loc, kv] of Object.entries(T)) {
  const p = dir + loc + '.js';
  if (!fs.existsSync(p)) { console.log('缺 ' + loc); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const lines = [];
  for (const [k, v] of Object.entries(kv)) {
    if (s.includes("'" + k + "'")) continue;
    lines.push(`    '${k}': ${JSON.stringify(v).replace(/"/g, "'")},`);
  }
  if (!lines.length) continue;
  const anchor = "    '生产工单':";
  const i = s.indexOf(anchor);
  if (i < 0) { console.log(loc + ' 无锚点'); continue; }
  const eol = s.indexOf('\n', i);
  s = s.slice(0, eol + 1) + lines.join('\n') + '\n' + s.slice(eol + 1);
  fs.writeFileSync(p, s, 'utf8');
  done++;
  console.log(loc + ' +' + lines.length);
}
console.log('语言包更新 ' + done + ' 个');
