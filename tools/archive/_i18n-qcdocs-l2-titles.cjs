/**
 * _i18n-qcdocs-l2-titles.cjs — 质量单据两级审批:消息标题去「特采单」专用化(2026-10-04)
 *
 * 背景:同一套两级审批(编制/审核/批准)这一轮从特采单扩到品质管理·质量单据 7 张,
 * 消息标题里的「特采单」字样就对不上了。改名(中文即 key,zh-CN.js 无需条目):
 *   '特采单待超级管理员批准' → '待超级管理员批准'
 *   '特采单已批准'         → '单据已批准'
 * 用法:node tools/archive/_i18n-qcdocs-l2-titles.cjs   (幂等;新键已在则删旧键即可)
 */
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales')
const RENAME = [
  ['特采单待超级管理员批准', '待超级管理员批准'],
  ['特采单已批准', '单据已批准'],
]

/** 旧键的译名(按语言) —— 直接搬成新键的值,不再让机翻重来一遍 */
const NEW = {
  en: { '待超级管理员批准': 'Awaiting super-admin approval', '单据已批准': 'Document approved' },
  'zh-TW': { '待超级管理员批准': '待超級管理員批准', '单据已批准': '單據已批准' },
  ja: { '待超级管理员批准': 'スーパー管理者の承認待ち', '单据已批准': '書類が承認されました' },
  ko: { '待超级管理员批准': '최고 관리자 승인 대기', '单据已批准': '문서가 승인되었습니다' },
  es: { '待超级管理员批准': 'Pendiente de aprobación del superadministrador', '单据已批准': 'Documento aprobado' },
  fr: { '待超级管理员批准': "En attente d'approbation du super-administrateur", '单据已批准': 'Document approuvé' },
  de: { '待超级管理员批准': 'Wartet auf Genehmigung des Superadministrators', '单据已批准': 'Dokument genehmigt' },
  ru: { '待超级管理员批准': 'Ожидает утверждения супер-администратора', '单据已批准': 'Документ утверждён' },
  vi: { '待超级管理员批准': 'Chờ quản trị viên cấp cao phê duyệt', '单据已批准': 'Chứng từ đã được phê duyệt' },
  th: { '待超级管理员批准': 'รอการอนุมัติจากผู้ดูแลระบบสูงสุด', '单据已批准': 'เอกสารได้รับอนุมัติแล้ว' },
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, dict] of Object.entries(NEW)) {
  const file = path.join(DIR, `${loc}.js`)
  let txt = fs.readFileSync(file, 'utf8')
  let touched = false
  for (const [oldKey, newKey] of RENAME) {
    const oldRe = new RegExp(`^\\s*'${esc(oldKey)}':.*\\n`, 'gm')
    if (!oldRe.test(txt)) continue
    txt = txt.replace(oldRe, '')
    touched = true
  }
  const missing = RENAME.map(([, nk]) => nk).filter((nk) => !txt.includes(`'${nk}':`))
  if (missing.length) {
    const lines = missing.map((nk) => `    '${esc(nk)}': '${esc(dict[nk])}',`)
    const anchor = /(^ {2}biz: \{\n)/m
    if (!anchor.test(txt)) throw new Error(`${loc}.js 未找到 biz 段锚点`)
    txt = txt.replace(anchor, `$1${lines.join('\n')}\n`)
    touched = true
  }
  if (touched) { fs.writeFileSync(file, txt, 'utf8'); changed++; console.log(`${loc}.js: 标题已改`) }
  else console.log(`${loc}.js: 已齐,跳过`)
}
console.log(`完成:改动 ${changed} 个语言包`)
