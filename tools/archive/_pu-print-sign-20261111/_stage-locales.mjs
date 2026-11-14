/**
 * _stage-locales.mjs — 只把**本任务**的 5 条词条暂存进 git 索引(2026-11-11)
 *
 * 背景:同一工作区里有并行会话在改别的功能(审批消息文案),它也动了同一批
 * `src/i18n/locales/*.js`。为遵守「单任务单提交」,提交时不能让对方的在途词条混进本提交:
 * 做法 = 以 **HEAD 版本**为底,插进本任务的 5 条,写成 blob 后 `git update-index --cacheinfo`
 * 挂到索引上(工作区文件不动,仍包含双方改动)。
 *
 * 用法(仓库根):node tools/archive/_pu-print-sign-20261111/_stage-locales.mjs
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']

const KEYS = [
  ['联系方式', {
    en: 'Phone', 'zh-TW': '聯繫方式', ja: '連絡先', ko: '연락처',
    de: 'Telefon', es: 'Teléfono', fr: 'Téléphone', ru: 'Телефон', th: 'เบอร์ติดต่อ', vi: 'Số liên hệ',
  }],
  ['需方联系人', {
    en: 'Buyer contact', 'zh-TW': '需方聯繫人', ja: '発注者側の担当者', ko: '수요측 담당자',
    de: 'Ansprechpartner Käufer', es: 'Contacto del comprador', fr: 'Contact de l’acheteur',
    ru: 'Контактное лицо покупателя', th: 'ผู้ติดต่อฝ่ายผู้ซื้อ', vi: 'Người liên hệ bên mua',
  }],
  ['选择或输入联系人', {
    en: 'Pick or type a contact', 'zh-TW': '選擇或輸入聯繫人', ja: '担当者を選択または入力',
    ko: '담당자를 선택하거나 입력', de: 'Ansprechpartner wählen oder eingeben',
    es: 'Elija o escriba un contacto', fr: 'Choisir ou saisir un contact',
    ru: 'Выберите или введите контактное лицо', th: 'เลือกหรือพิมพ์ผู้ติดต่อ', vi: 'Chọn hoặc nhập người liên hệ',
  }],
  ['选择或输入联系方式', {
    en: 'Pick or type a phone', 'zh-TW': '選擇或輸入聯繫方式', ja: '連絡先を選択または入力',
    ko: '연락처를 선택하거나 입력', de: 'Telefon wählen oder eingeben',
    es: 'Elija o escriba un teléfono', fr: 'Choisir ou saisir un téléphone',
    ru: 'Выберите или введите телефон', th: 'เลือกหรือพิมพ์เบอร์ติดต่อ', vi: 'Chọn hoặc nhập số liên hệ',
  }],
  ['这两个会印在「需方」框里；填了名单里没有的名字或电话，打印时会自动存进下拉选项', {
    en: 'Both are printed in the Buyer box; a name or phone not in the list is saved into the dropdown when you print',
    'zh-TW': '這兩個會印在「需方」框裡；填了名單裡沒有的名字或電話，列印時會自動存進下拉選項',
    ja: 'この2つは「需方」欄に印刷されます。一覧にない名前や電話は印刷時に自動で選択肢へ保存されます',
    ko: '이 두 값은 "수요자" 칸에 인쇄됩니다. 목록에 없는 이름/전화는 인쇄 시 자동으로 목록에 저장됩니다',
    de: 'Beide werden im Kasten „Käufer“ gedruckt; nicht gelistete Namen/Nummern werden beim Drucken gespeichert',
    es: 'Ambos se imprimen en el recuadro «Comprador»; un nombre o teléfono no listado se guarda al imprimir',
    fr: 'Les deux sont imprimés dans le cadre « Acheteur » ; un nom ou téléphone absent est enregistré à l’impression',
    ru: 'Оба печатаются в рамке «Покупатель»; отсутствующие в списке имя/телефон сохраняются при печати',
    th: 'ทั้งสองค่าจะพิมพ์ในช่อง "ผู้ซื้อ" ชื่อ/เบอร์ที่ไม่มีในรายการจะถูกบันทึกอัตโนมัติเมื่อพิมพ์',
    vi: 'Cả hai được in trong khung "Bên mua"; tên/số chưa có trong danh sách sẽ tự lưu khi in',
  }],
]

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const tmp = mkdtempSync(resolve(tmpdir(), 'yj-stage-'))
const git = (args, input) => execFileSync('git', args, { cwd: root, input, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 })

for (const loc of LOCALES) {
  const rel = `frontend/src/i18n/locales/${loc}.js`
  const head = git(['show', `HEAD:${rel}`])
  const lines = head.split('\n')
  // 锚点:各语言的 biz 里都有的那几条(en 有「打印采购订单」,其它语言只有「打印材料码」等)
  const ANCHORS = [/^(\s*)'打印采购订单':/, /^(\s*)'打印版式':/, /^(\s*)'打印材料码':/, /^(\s*)'打印':/]
  let idx = -1
  let indent = '    '
  for (const rx of ANCHORS) {
    const i = lines.findIndex((l) => rx.test(l))
    if (i >= 0) { idx = i; indent = lines[i].match(/^(\s*)/)[1]; break }
  }
  if (idx < 0) { console.error(`${loc}: HEAD 里找不到锚点,跳过`); continue }
  // HEAD 里可能已有部分键(理论上没有),去重后再插
  const missing = KEYS.filter(([k]) => !head.includes(`'${k}':`))
  lines.splice(idx + 1, 0, ...missing.map(([k, t]) => `${indent}${q(k)}: ${q(t[loc] ?? t.en)},`))
  const file = resolve(tmp, `${loc}.js`)
  writeFileSync(file, lines.join('\n'), 'utf8')
  const sha = git(['hash-object', '-w', file]).trim()
  git(['update-index', '--cacheinfo', `100644,${sha},${rel}`])
  console.log(`${loc}: 已暂存(HEAD 版 + ${missing.length} 条) sha=${sha.slice(0, 8)}`)
}
console.log('完成:10 个语言文件的**索引版本**只含本任务词条')
