/**
 * _i18n-patch4.mjs — 采购订单打印:送货单改名 + 需方联系人弹窗 相关词条(2026-11-11)
 *
 * 用户口径:
 *   ①「打印无金额的采购订单报表名字改为送货单。送货单下方不需要写供方和需方。」
 *   ②「打印有金额的采购订单,下面的供方单位名称带入供应商名称。还有需方的联系人和联系方式改为打印前先弹窗。
 *      下拉选择名字和联系方式。可以新增」
 *
 * 本脚本给 10 个语言文件补 4 条显示层词条(幂等,已存在跳过):
 *   需方联系人 / 联系方式 / 选择或输入联系人 / 选择或输入联系方式 / 需方联系人的作用说明
 *
 * 用法:node tools/archive/_pu-print-sign-20261111/_i18n-patch.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = resolve(here, '../../../frontend/src/i18n/locales')

const KEYS = [
  ['联系方式', {
    en: 'Phone', 'zh-TW': '聯繫方式', ja: '連絡先', ko: '연락처',
    de: 'Telefon', es: 'Teléfono', fr: 'Téléphone',
    ru: 'Телефон', th: 'เบอร์ติดต่อ', vi: 'Số liên hệ',
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
    ru: 'Выберите или введите контактное лицо', th: 'เลือกหรือพิมพ์ผู้ติดต่อ',
    vi: 'Chọn hoặc nhập người liên hệ',
  }],
  ['选择或输入联系方式', {
    en: 'Pick or type a phone', 'zh-TW': '選擇或輸入聯繫方式', ja: '連絡先を選択または入力',
    ko: '연락처를 선택하거나 입력', de: 'Telefon wählen oder eingeben',
    es: 'Elija o escriba un teléfono', fr: 'Choisir ou saisir un téléphone',
    ru: 'Выберите или введите телефон', th: 'เลือกหรือพิมพ์เบอร์ติดต่อ',
    vi: 'Chọn hoặc nhập số liên hệ',
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

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
/** 插入锚点:采购订单打印弹窗那批词条里的第一条 */
const ANCHORS = [/^(\s*)'打印采购订单':/, /^(\s*)'打印版式':/, /^(\s*)'打印材料码':/]

let total = 0
for (const loc of LOCALES) {
  const file = resolve(localesDir, `${loc}.js`)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const src = lines.join('\n')
  const missing = KEYS.filter(([k]) => !src.includes(`'${k}':`))
  if (!missing.length) { console.log(`${loc}: 已有全部词条,跳过`); continue }
  let idx = -1
  let indent = '    '
  for (const rx of ANCHORS) {
    const i = lines.findIndex((l) => rx.test(l))
    if (i >= 0) { idx = i; indent = lines[i].match(rx)[1]; break }
  }
  if (idx < 0) { console.error(`${loc}: 找不到锚点,跳过`); continue }
  lines.splice(idx + 1, 0, ...missing.map(([k, t]) => `${indent}${q(k)}: ${q(t[loc] ?? t.en)},`))
  writeFileSync(file, lines.join('\n'), 'utf8')
  total += missing.length
  console.log(`${loc}: 插入 ${missing.length} 条`)
}
console.log(`完成,共插入 ${total} 条`)
