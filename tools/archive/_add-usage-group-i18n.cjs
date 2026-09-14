/* 为 9 个语言包插入「按账号分组」新词条(锚点:'使用权限查看' 行后) */
const fs = require('fs')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales/'

const T = {
  en: { '条记录': 'records', '暂无记录': 'No records', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'Over 2000 records; only recent ones shown. Use filters to narrow down.' },
  ja: { '条记录': '件の記録', '暂无记录': '記録なし', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': '記録が2000件を超えています。直近のみ表示します。フィルターで絞り込んでください。' },
  ko: { '条记录': '개 기록', '暂无记录': '기록 없음', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': '기록이 2000개를 초과하여 최근 항목만 표시됩니다. 필터로 범위를 좁히세요.' },
  de: { '条记录': 'Datensätze', '暂无记录': 'Keine Datensätze', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'Über 2000 Datensätze; nur die neuesten werden angezeigt. Nutzen Sie die Filter.' },
  es: { '条记录': 'registros', '暂无记录': 'Sin registros', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'Más de 2000 registros; solo se muestran los recientes. Use los filtros.' },
  fr: { '条记录': 'enregistrements', '暂无记录': 'Aucun enregistrement', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'Plus de 2000 enregistrements; seuls les récents sont affichés. Utilisez les filtres.' },
  ru: { '条记录': 'записей', '暂无记录': 'Нет записей', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'Более 2000 записей; показаны только последние. Используйте фильтры.' },
  th: { '条记录': 'รายการ', '暂无记录': 'ไม่มีบันทึก', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'มีบันทึกเกิน 2000 รายการ แสดงเฉพาะรายการล่าสุด กรุณาใช้ตัวกรอง' },
  vi: { '条记录': 'bản ghi', '暂无记录': 'Không có bản ghi', '记录超过 2000 条，仅展示最近部分，请用筛选缩小范围': 'Hơn 2000 bản ghi; chỉ hiển thị gần đây. Hãy dùng bộ lọc.' },
}

for (const loc of Object.keys(T)) {
  const f = dir + loc + '.js'
  let s = fs.readFileSync(f, 'utf8')
  const add = []
  for (const w of Object.keys(T[loc])) {
    if (!s.includes("'" + w + "'")) add.push("    '" + w + "': '" + T[loc][w] + "',\n")
  }
  if (!add.length) { console.log(loc + ': nothing to add'); continue }
  const re = /('使用权限查看': [^\n]*\n)/
  if (!re.test(s)) { console.log(loc + ': anchor not found!'); continue }
  s = s.replace(re, '$1' + add.join(''))
  fs.writeFileSync(f, s, 'utf8')
  console.log(loc + ': added ' + add.length + ' entries')
}
