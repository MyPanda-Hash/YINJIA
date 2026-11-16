/**
 * 一次性探针(任务产物,随任务提交):把「需方联系人名单管理」新增词条写进 10 个语言包。
 *
 * 背景:2026-11-11 用户口径「没有删除按钮吗,输错了怎么办」⇒ 打印弹窗加「管理名单」(可改/可删/可加)。
 * AGENTS.md 多语言硬规矩:新增 UI 文案必须同时交付译名(至少 en),否则视为功能未完成。
 *
 * 写法:在每份 locales/*.js 里「这两个会印在…」那一行**之前**插入新词条,
 * 保持原有缩进(4 空格)与单引号风格;幂等 —— 已存在则跳过,重复跑不会插两遍。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const LOCALES = resolve(here, '../../../frontend/src/i18n/locales')
const MARK = "'这两个会印在「需方」框里"
const TIP = '名字或电话输错了，在这里改掉或删掉；删掉的不再出现在打印下拉里'

/** 每种语言:[管理名单, 需方联系人名单, 上面那句提示, 保存名单, 名单已保存, 名单保存失败, 请先填写联系人姓名, 新增一行] */
const T = {
  en: ['Manage list', 'Buyer contact list',
    'Typo in a name or phone? Fix or delete it here; deleted entries no longer show in the print dropdown',
    'Save list', 'List saved', 'Saving the list failed', 'Please fill in the contact name first', 'Add row'],
  'zh-TW': ['管理名單', '需方聯絡人名單',
    '名字或電話輸錯了，在這裡改掉或刪掉；刪掉的不再出現在列印下拉裡',
    '儲存名單', '名單已儲存', '名單儲存失敗', '請先填寫聯絡人姓名', '新增一行'],
  ja: ['リスト管理', '需方担当者リスト',
    '名前や電話番号が間違っている場合はここで修正・削除できます。削除したものは印刷の選択肢に出なくなります',
    'リストを保存', 'リストを保存しました', 'リストの保存に失敗しました', '先に担当者名を入力してください', '行を追加'],
  ko: ['목록 관리', '수요자 담당자 목록',
    '이름이나 전화번호가 틀렸다면 여기서 수정하거나 삭제하세요. 삭제한 항목은 인쇄 드롭다운에 더 이상 나오지 않습니다',
    '목록 저장', '목록이 저장되었습니다', '목록 저장 실패', '담당자 이름을 먼저 입력하세요', '행 추가'],
  de: ['Liste verwalten', 'Käuferkontakte',
    'Name oder Nummer falsch? Hier korrigieren oder löschen; Gelöschtes erscheint nicht mehr in der Druckauswahl',
    'Liste speichern', 'Liste gespeichert', 'Liste konnte nicht gespeichert werden',
    'Bitte zuerst den Namen des Ansprechpartners eingeben', 'Zeile hinzufügen'],
  es: ['Gestionar lista', 'Lista de contactos del comprador',
    '¿Nombre o teléfono erróneo? Corrígelo o elimínalo aquí; lo eliminado ya no aparece en el desplegable de impresión',
    'Guardar lista', 'Lista guardada', 'Error al guardar la lista', 'Indique primero el nombre del contacto', 'Añadir fila'],
  fr: ['Gérer la liste', 'Liste des contacts acheteur',
    'Nom ou téléphone erroné ? Corrigez-le ou supprimez-le ici ; les entrées supprimées n’apparaissent plus dans la liste d’impression',
    'Enregistrer la liste', 'Liste enregistrée', "Échec de l'enregistrement de la liste",
    'Veuillez d’abord saisir le nom du contact', 'Ajouter une ligne'],
  ru: ['Управление списком', 'Список контактов покупателя',
    'Ошибка в имени или телефоне? Исправьте или удалите здесь; удалённые больше не появятся в списке при печати',
    'Сохранить список', 'Список сохранён', 'Не удалось сохранить список',
    'Сначала укажите имя контакта', 'Добавить строку'],
  th: ['จัดการรายชื่อ', 'รายชื่อผู้ติดต่อฝ่ายผู้ซื้อ',
    'ชื่อหรือเบอร์ผิด? แก้ไขหรือลบได้ที่นี่ รายการที่ลบจะไม่แสดงในการพิมพ์อีก',
    'บันทึกรายชื่อ', 'บันทึกรายชื่อแล้ว', 'บันทึกรายชื่อไม่สำเร็จ', 'กรุณากรอกชื่อผู้ติดต่อก่อน', 'เพิ่มแถว'],
  vi: ['Quản lý danh sách', 'Danh sách liên hệ bên mua',
    'Sai tên hoặc số điện thoại? Sửa hoặc xóa tại đây; mục đã xóa sẽ không còn hiện trong danh sách khi in',
    'Lưu danh sách', 'Đã lưu danh sách', 'Lưu danh sách thất bại', 'Vui lòng nhập tên liên hệ trước', 'Thêm dòng'],
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
let touched = 0

for (const [loc, tr] of Object.entries(T)) {
  const file = resolve(LOCALES, `${loc}.js`)
  let text = readFileSync(file, 'utf8')
  if (text.includes("'管理名单'")) { console.log(`[skip] ${loc}: 已存在`); continue }
  const idx = text.indexOf(MARK)
  if (idx < 0) { console.log(`[FAIL] ${loc}: 找不到锚点行`); process.exitCode = 1; continue }
  // 锚点行行首位置(带 4 空格缩进)
  const lineStart = text.lastIndexOf('\n', idx) + 1
  const pad = text.slice(lineStart, idx)          // 通常是 4 个空格
  const keys = ['管理名单', '需方联系人名单', TIP, '保存名单', '名单已保存', '名单保存失败', '请先填写联系人姓名', '新增一行']
  const block = keys
    .map((k, i) => (k === '新增一行' && text.includes("'新增一行'")) ? null : `${pad}${q(k)}: ${q(tr[i])},`)
    .filter(Boolean).join('\n')
  text = text.slice(0, lineStart) + block + '\n' + text.slice(lineStart)
  writeFileSync(file, text, 'utf8')
  touched++
  console.log(`[OK] ${loc}: +${block.split('\n').length} 条`)
}
console.log(`DONE 写入 ${touched} 个语言包`)
