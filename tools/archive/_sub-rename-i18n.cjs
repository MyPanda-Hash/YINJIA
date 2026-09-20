// _sub-rename-i18n.cjs — 副标题去「全公司共享资料：」前缀(2026-09-17 用户要求)
// ① 10 语言包:旧键行整行替换为新键+新译;② 归档合并脚本同步改(防复跑复活旧键)
const fs = require('fs')

const OLD_KEY = '全公司共享资料：标准、测试报告、认证报告，指定人上传维护，其余仅查阅'
const NEW_KEY = '标准、测试报告、认证报告，指定人上传维护，其余仅查阅'
const VAL = {
  en: 'Standards, test reports and certification reports. Designated maintainers upload; everyone else reads only.',
  ja: '標準・試験報告・認証報告。指定者がアップロード・管理し、他は閲覧のみ',
  ko: '표준·시험 보고서·인증 보고서. 지정 담당자만 업로드·관리, 그 외 열람 전용',
  es: 'Normas, informes de ensayo e informes de certificación. Solo personas designadas suben; el resto solo consulta',
  fr: "Normes, rapports d'essai et rapports de certification. Seules les personnes désignées téléversent ; les autres consultent seulement",
  de: 'Normen, Prüfberichte und Zertifizierungsberichte. Nur benannte Personen laden hoch; alle anderen lesen nur',
  ru: 'Стандарты, протоколы испытаний и сертификаты. Загружают только назначенные лица; остальные только читают',
  vi: 'Tiêu chuẩn, báo cáo thử nghiệm, báo cáo chứng nhận. Chỉ người được chỉ định tải lên; phần còn lại chỉ xem',
  th: 'มาตรฐาน รายงานทดสอบ รายงานรับรอง ผู้ที่ได้รับมอบหมายเท่านั้นที่อัปโหลด ส่วนอื่นอ่านอย่างเดียว',
  'zh-TW': '標準、測試報告、認證報告，指定人上傳維護，其餘僅查閱',
}

const out = []
for (const [loc, v] of Object.entries(VAL)) {
  const f = `frontend/src/i18n/locales/${loc}.js`
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  const i = lines.findIndex((l) => l.includes(`'${OLD_KEY}'`))
  if (i < 0) { out.push(`${loc}:未找到旧键`); continue }
  const indent = (lines[i].match(/^\s*/) || [''])[0]
  const eol = fs.readFileSync(f, 'utf8').includes('\r\n') ? '\r\n' : '\n'
  lines[i] = `${indent}'${NEW_KEY}': '${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`
  fs.writeFileSync(f, lines.join(eol), 'utf8')
  out.push(`${loc}:替换`)
}
// 归档合并脚本:旧键行(各语言块各一行)替换为新键+同值
{
  const f = 'tools/archive/_share-file-i18n-merge.cjs'
  let s = fs.readFileSync(f, 'utf8')
  let n = 0
  for (const [loc, v] of Object.entries(VAL)) {
    const re = new RegExp(`'${OLD_KEY.replace(/[：，、]/g, (c) => '\\\\u' + c.codePointAt(0).toString(16).padStart(4, '0'))}': '[^']*'`)
    // 上面的 unicode 转义方式对源码字面量不可靠,直接用原字符匹配:
    const re2 = new RegExp(`'${OLD_KEY}': '[^']*'`)
    const rep = `'${NEW_KEY}': '${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    if (re2.test(s)) { s = s.replace(re2, rep); n++ }
    else if (re.test(s)) { s = s.replace(re, rep); n++ }
  }
  fs.writeFileSync(f, s, 'utf8')
  out.push(`merge-script:${n} 处`)
}
console.log(out.join(' '))
