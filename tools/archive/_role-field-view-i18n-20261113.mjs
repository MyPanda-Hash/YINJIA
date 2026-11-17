/*
 * _role-field-view-i18n-20261113.mjs —— 角色字段视图(2026-11-13)新增 UI 文案的 10 语言补齐。
 *
 * 为什么手写:AGENTS.md 的多语言规范不可豁免(新增 UI 功能必须同时交付译文),
 *   而本机/CI 的机翻通道不一定可用,故按 en 定稿后人工翻译其余 9 个语言包落盘。
 *
 * 用法(仓库根):node tools/archive/_role-field-view-i18n-20261113.mjs
 * 幂等:某语言包已有该键则跳过(不覆盖人工译文)。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')

/** 中文原文(唯一数据键,永不翻译) */
const K = {
  fieldView: '字段视图',
  systemWhole: '系统整体',
  myRole: '本角色',
  roleCustom: '本角色定制',
  customizedPanels: '本角色已定制 {n} 个面板',
  roleOnlyTip: '这里只调「显示 / 隐藏」：本角色所有账号生效，顺序与栏名仍按系统整体。',
  required: '必填',
  overridden: '已定制',
  resetInherit: '恢复继承',
  resetInherited: '已恢复继承（系统整体）',
  confirmReset: '将清除本角色在该面板的全部字段显示/隐藏设置，恢复为系统整体？',
  saved: '本角色字段视图已保存',
  skipRequired: '必填字段不可隐藏，已跳过：',
  noRole: '当前账号未分配角色，已切到「系统整体」。',
  dragTipCols: '拖动或用箭头调整列顺序；勾选=显示；栏名可改。',
  uiHint: '「本角色定制」由本角色任一账号在「表格调整 / 表头调整」里设置，对本角色所有账号生效；「系统整体」只看未定制时的样子。',
  resetFailed: '恢复失败',
}

/**
 * locale -> 与 ORDER 同序的译文
 * ORDER = [fieldView, systemWhole, myRole, roleCustom, customizedPanels, roleOnlyTip,
 *          required, overridden, resetInherit, resetInherited, confirmReset, saved,
 *          skipRequired, noRole, dragTipCols, uiHint, resetFailed]
 */
const T = {
  en: ['Field view', 'System (all users)', 'My role', 'Customize for my role',
    'Panels customized for this role: {n}',
    'Only “show / hide” can be changed here: it applies to every account with this role, while order and column names still follow the system setting.',
    'Required', 'Customized', 'Reset to inherited', 'Reset to inherited (system setting)',
    'This clears every field show/hide setting of this role on this panel and falls back to the system setting. Continue?',
    'Field view for this role saved',
    'Required fields cannot be hidden; skipped: ', 'This account has no role, switched to “System (all users)”.',
    'Drag or use the arrows to reorder columns; tick = show; column names are editable.',
    '“Customize for my role” is set by any account with this role via “Adjust table / Adjust header” and applies to every account with the role; “System (all users)” shows the un-customized state.',
    'Reset failed'],

  ja: ['フィールド表示', 'システム全体', '自ロール', '自ロール向けカスタマイズ',
    'このロールでカスタマイズ済み: {n} 件',
    'ここでは「表示 / 非表示」のみ調整できます。同じロールの全アカウントに反映され、順序と列名は引き続きシステム全体の設定に従います。',
    '必須', 'カスタマイズ済み', '継承に戻す', '継承に戻しました（システム全体）',
    'このパネルにおける本ロールの表示/非表示設定をすべて消去し、システム全体に戻します。よろしいですか？',
    '本ロールのフィールド表示を保存しました',
    '必須項目は非表示にできません。スキップ: ', 'このアカウントにはロールがありません。「システム全体」に切り替えました。',
    'ドラッグまたは矢印で列の順序を変更；チェック=表示；列名は変更できます。',
    '「自ロール向けカスタマイズ」は、このロールのいずれかのアカウントが「表調整 / ヘッダー調整」で設定し、同じロールの全アカウントに反映されます。「システム全体」は未カスタマイズ時の表示です。',
    '戻せませんでした'],

  ko: ['필드 보기', '시스템 전체', '내 역할', '내 역할 맞춤',
    '이 역할에서 맞춤 설정한 패널: {n}',
    '여기서는 「표시 / 숨김」만 조정할 수 있습니다. 이 역할의 모든 계정에 적용되며, 순서와 열 이름은 계속 시스템 전체 설정을 따릅니다.',
    '필수', '맞춤 설정됨', '상속으로 되돌리기', '상속으로 되돌렸습니다(시스템 전체)',
    '이 패널에서 이 역할의 필드 표시/숨김 설정을 모두 지우고 시스템 전체로 되돌립니다. 진행할까요?',
    '이 역할의 필드 보기가 저장되었습니다',
    '필수 필드는 숨길 수 없습니다. 건너뜀: ', '이 계정에는 역할이 없어 「시스템 전체」로 전환했습니다.',
    '드래그하거나 화살표로 열 순서를 조정; 체크=표시; 열 이름 수정 가능.',
    '「내 역할 맞춤」은 이 역할의 모든 계정이 「표 조정 / 헤더 조정」에서 설정하며 이 역할의 모든 계정에 적용됩니다. 「시스템 전체」는 맞춤 설정 전 상태를 보여 줍니다.',
    '되돌리지 못했습니다'],

  de: ['Feldansicht', 'Systemweit', 'Meine Rolle', 'Für meine Rolle anpassen',
    'Für diese Rolle angepasste Panels: {n}',
    'Hier lässt sich nur „Anzeigen / Ausblenden“ einstellen: gilt für alle Konten dieser Rolle; Reihenfolge und Spaltennamen folgen weiterhin der Systemeinstellung.',
    'Pflichtfeld', 'Angepasst', 'Vererbung wiederherstellen', 'Vererbung wiederhergestellt (systemweit)',
    'Dadurch werden alle Anzeigen/Ausblenden-Einstellungen dieser Rolle für dieses Panel gelöscht und die Systemeinstellung wiederhergestellt. Fortfahren?',
    'Feldansicht dieser Rolle gespeichert',
    'Pflichtfelder können nicht ausgeblendet werden; übersprungen: ', 'Dieses Konto hat keine Rolle – auf „Systemweit“ umgestellt.',
    'Zum Sortieren ziehen oder Pfeile nutzen; Häkchen = anzeigen; Spaltennamen sind änderbar.',
    '„Für meine Rolle anpassen“ wird von jedem Konto dieser Rolle über „Tabelle anpassen / Kopf anpassen“ gesetzt und gilt für alle Konten der Rolle; „Systemweit“ zeigt den nicht angepassten Zustand.',
    'Zurücksetzen fehlgeschlagen'],

  es: ['Vista de campos', 'Todo el sistema', 'Mi rol', 'Personalizar para mi rol',
    'Paneles personalizados para este rol: {n}',
    'Aquí solo se puede ajustar «mostrar / ocultar»: se aplica a todas las cuentas de este rol; el orden y los nombres de columna siguen la configuración del sistema.',
    'Obligatorio', 'Personalizado', 'Volver a heredar', 'Herencia restablecida (todo el sistema)',
    'Se borrarán todos los ajustes de mostrar/ocultar de este rol en este panel y se volverá a la configuración del sistema. ¿Continuar?',
    'Vista de campos de este rol guardada',
    'Los campos obligatorios no se pueden ocultar; omitidos: ', 'Esta cuenta no tiene rol; se cambió a «Todo el sistema».',
    'Arrastre o use las flechas para ordenar las columnas; marcado = mostrar; los nombres de columna se pueden editar.',
    '«Personalizar para mi rol» lo ajusta cualquier cuenta de este rol desde «Ajustar tabla / Ajustar encabezado» y se aplica a todas las cuentas del rol; «Todo el sistema» muestra el estado sin personalizar.',
    'No se pudo restablecer'],

  fr: ['Vue des champs', 'Système (tous)', 'Mon rôle', 'Personnaliser pour mon rôle',
    'Panels personnalisés pour ce rôle : {n}',
    'Ici, seul « afficher / masquer » est modifiable : cela s’applique à tous les comptes de ce rôle ; l’ordre et les noms de colonnes suivent toujours le réglage système.',
    'Obligatoire', 'Personnalisé', 'Revenir à l’héritage', 'Héritage rétabli (système)',
    'Cela effacera tous les réglages afficher/masquer de ce rôle sur ce panel et reviendra au réglage système. Continuer ?',
    'Vue des champs de ce rôle enregistrée',
    'Les champs obligatoires ne peuvent pas être masqués ; ignorés : ', 'Ce compte n’a pas de rôle ; passage à « Système (tous) ».',
    'Glissez ou utilisez les flèches pour réordonner les colonnes ; coché = afficher ; les noms de colonnes sont modifiables.',
    '« Personnaliser pour mon rôle » est défini par n’importe quel compte de ce rôle via « Ajuster le tableau / Ajuster l’en-tête » et s’applique à tous les comptes du rôle ; « Système (tous) » montre l’état non personnalisé.',
    'Échec du rétablissement'],

  ru: ['Вид полей', 'Вся система', 'Моя роль', 'Настроить для моей роли',
    'Панелей настроено для этой роли: {n}',
    'Здесь можно менять только «показать / скрыть»: это действует на все учётные записи этой роли; порядок и названия столбцов по-прежнему задаются системными настройками.',
    'Обязательное', 'Настроено', 'Вернуть наследование', 'Наследование восстановлено (вся система)',
    'Будут удалены все настройки показа/скрытия этой роли для данной панели и восстановлены системные. Продолжить?',
    'Вид полей для этой роли сохранён',
    'Обязательные поля нельзя скрыть; пропущены: ', 'У этой учётной записи нет роли — переключено на «Вся система».',
    'Перетащите или используйте стрелки для порядка столбцов; флажок = показать; названия столбцов можно менять.',
    '«Настроить для моей роли» задаётся любой учётной записью этой роли через «Настроить таблицу / Настроить шапку» и действует на все её записи; «Вся система» показывает состояние без настройки.',
    'Не удалось вернуть'],

  th: ['มุมมองฟิลด์', 'ทั้งระบบ', 'บทบาทของฉัน', 'ปรับแต่งสำหรับบทบาทของฉัน',
    'แผงที่ปรับแต่งสำหรับบทบาทนี้: {n}',
    'ที่นี่ปรับได้เฉพาะ「แสดง / ซ่อน」 ซึ่งมีผลกับทุกบัญชีในบทบาทนี้ ส่วนลำดับและชื่อคอลัมน์ยังเป็นไปตามการตั้งค่าของทั้งระบบ',
    'จำเป็น', 'ปรับแต่งแล้ว', 'คืนค่าการสืบทอด', 'คืนค่าการสืบทอดแล้ว (ทั้งระบบ)',
    'จะล้างการตั้งค่าการแสดง/ซ่อนฟิลด์ทั้งหมดของบทบาทนี้ในแผงนี้ และกลับไปใช้ค่าของทั้งระบบ ดำเนินการต่อหรือไม่?',
    'บันทึกมุมมองฟิลด์ของบทบาทนี้แล้ว',
    'ฟิลด์ที่จำเป็นซ่อนไม่ได้ ข้าม: ', 'บัญชีนี้ยังไม่ได้กำหนดบทบาท เปลี่ยนเป็น「ทั้งระบบ」แล้ว',
    'ลากหรือใช้ลูกศรเพื่อจัดลำดับคอลัมน์ ติ๊ก=แสดง แก้ชื่อคอลัมน์ได้',
    '「ปรับแต่งสำหรับบทบาทของฉัน」ตั้งได้โดยบัญชีใดก็ได้ในบทบาทนี้ผ่าน「ปรับตาราง / ปรับหัวตาราง」และมีผลกับทุกบัญชีในบทบาท ส่วน「ทั้งระบบ」จะแสดงสถานะที่ยังไม่ปรับแต่ง',
    'คืนค่าไม่สำเร็จ'],

  vi: ['Chế độ xem trường', 'Toàn hệ thống', 'Vai trò của tôi', 'Tùy chỉnh cho vai trò của tôi',
    'Số bảng đã tùy chỉnh cho vai trò này: {n}',
    'Ở đây chỉ chỉnh được「hiện / ẩn」: áp dụng cho mọi tài khoản cùng vai trò này; thứ tự và tên cột vẫn theo cấu hình toàn hệ thống.',
    'Bắt buộc', 'Đã tùy chỉnh', 'Khôi phục kế thừa', 'Đã khôi phục kế thừa (toàn hệ thống)',
    'Thao tác này sẽ xóa toàn bộ thiết lập hiện/ẩn của vai trò này trên bảng này và trở về cấu hình toàn hệ thống. Tiếp tục?',
    'Đã lưu chế độ xem trường của vai trò này',
    'Không thể ẩn trường bắt buộc; đã bỏ qua: ', 'Tài khoản này chưa được gán vai trò, đã chuyển sang「Toàn hệ thống」.',
    'Kéo hoặc dùng mũi tên để sắp xếp cột; tích = hiện; có thể sửa tên cột.',
    '「Tùy chỉnh cho vai trò của tôi」do bất kỳ tài khoản nào thuộc vai trò này đặt trong「Điều chỉnh bảng / Điều chỉnh đầu biểu」và áp dụng cho mọi tài khoản của vai trò; 「Toàn hệ thống」hiển thị trạng thái chưa tùy chỉnh.',
    'Khôi phục thất bại'],

  'zh-TW': ['欄位檢視', '系統整體', '本角色', '本角色自訂',
    '本角色已自訂 {n} 個面板',
    '這裡只調「顯示 / 隱藏」：本角色所有帳號生效，順序與欄名仍依系統整體。',
    '必填', '已自訂', '恢復繼承', '已恢復繼承（系統整體）',
    '將清除本角色在該面板的全部欄位顯示/隱藏設定，恢復為系統整體？',
    '本角色欄位檢視已儲存',
    '必填欄位不可隱藏，已略過：', '目前帳號未分配角色，已切到「系統整體」。',
    '拖曳或用箭頭調整欄位順序；勾選=顯示；欄名可改。',
    '「本角色自訂」由本角色任一帳號在「表格調整 / 表頭調整」裡設定，對本角色所有帳號生效；「系統整體」只看未自訂時的樣子。',
    '恢復失敗'],
}

const ORDER = [K.fieldView, K.systemWhole, K.myRole, K.roleCustom, K.customizedPanels, K.roleOnlyTip,
  K.required, K.overridden, K.resetInherit, K.resetInherited, K.confirmReset, K.saved,
  K.skipRequired, K.noRole, K.dragTipCols, K.uiHint, K.resetFailed]
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

let changed = 0
for (const [loc, vals] of Object.entries(T)) {
  if (vals.length !== ORDER.length) throw new Error(`${loc}: 译文条数 ${vals.length} ≠ 键 ${ORDER.length}`)
  const file = path.join(DIR, `${loc}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const lines = []
  ORDER.forEach((k, i) => {
    // 查重(单/双引号两种写法都算已有):已有则跳过,不覆盖人工译文
    const re = new RegExp(`(['"])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`)
    if (re.test(src)) return
    lines.push(`    '${esc(k)}': '${esc(vals[i])}',`)
  })
  if (!lines.length) { console.log(`${loc}: 无需补(已齐)`); continue }
  // ⚠ 语言包是 CRLF 行尾,锚点要兼容 \r\n
  const m = /\r?\n(\s*)biz:\s*\{\r?\n/.exec(src)
  if (!m) { console.log(`${loc}: ⚠ 找不到 biz 锚点,跳过`); continue }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const at = m.index + m[0].length
  const block = `    // ---- 角色字段视图(2026-11-13):表格调整/表头调整的作用域 + 界面设置「字段视图」----${nl}${lines.join(nl)}${nl}`
  src = src.slice(0, at) + block + src.slice(at)
  fs.writeFileSync(file, src, 'utf8')
  console.log(`${loc}: 补 ${lines.length} 条`)
  changed++
}
console.log(`\n完成:${changed} 个语言包有改动`)
