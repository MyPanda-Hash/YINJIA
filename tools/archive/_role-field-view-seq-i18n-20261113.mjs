/*
 * _role-field-view-seq-i18n-20261113.mjs —— 角色视图第二轮(序号 + 角色模板)新增文案 10 语言
 *
 * 用户口径:①「只存显隐,也可调整位置,并且这个字段排序,可以用序号来调整位置,只有勾选的字段了才有序号」
 *          ②「角色模板:从整体一键复制 / 套用到另一个角色」
 *
 * 用法(仓库根):node tools/archive/_role-field-view-seq-i18n-20261113.mjs
 * 幂等:已有该键的语言包跳过。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')

const K = {
  roleTip: '勾选=本角色显示；序号决定顺序（只有勾选的字段才有序号，1 在最前）；栏名仍按系统整体。',
  copyFromSystem: '从系统整体复制',
  applyToRole: '套用到其他角色',
  confirmCopy: '将用「系统整体」当前的字段显隐与顺序覆盖本角色在这个面板的设置，继续？',
  copied: '已从系统整体复制（{n} 个字段）',
  copyFailed: '复制失败',
  applyTip: '把本角色在这个面板的字段显隐与顺序整份复制给所选角色；目标角色原有定制会被覆盖。',
  pickRole: '选择目标角色',
  confirmApply: '确定套用',
  applied: '已套用到所选角色',
  applyFailed: '套用失败',
  roleListFailed: '读取角色清单失败',
}

const ORDER = [K.roleTip, K.copyFromSystem, K.applyToRole, K.confirmCopy, K.copied, K.copyFailed,
  K.applyTip, K.pickRole, K.confirmApply, K.applied, K.applyFailed, K.roleListFailed]

const T = {
  en: ['Tick = visible for this role; the number sets the order (only ticked fields have a number, 1 first); column names still come from the system setting.',
    'Copy from system', 'Apply to another role',
    'This overwrites this role’s settings on this panel with the current system field visibility and order. Continue?',
    'Copied from the system setting ({n} fields)', 'Copy failed',
    'Copies this role’s field visibility and order on this panel to the selected role; that role’s existing customisation will be overwritten.',
    'Select target role', 'Apply', 'Applied to the selected role', 'Apply failed', 'Failed to load the role list'],

  ja: ['チェック＝このロールで表示。番号が順序を決めます（番号が付くのはチェックした項目のみ、1 が先頭）。列名は引き続きシステム全体の設定に従います。',
    'システム全体からコピー', '他のロールへ適用',
    'このパネルにおける本ロールの設定を、システム全体の現在の表示/順序で上書きします。よろしいですか？',
    'システム全体からコピーしました（{n} 項目）', 'コピーできませんでした',
    'このパネルにおける本ロールのフィールド表示と順序を、選択したロールへそのままコピーします。コピー先の既存設定は上書きされます。',
    'コピー先のロールを選択', '適用する', '選択したロールへ適用しました', '適用できませんでした', 'ロール一覧を取得できませんでした'],

  ko: ['체크＝이 역할에서 표시. 번호가 순서를 정합니다(번호는 체크한 항목에만 붙고 1이 맨 앞). 열 이름은 계속 시스템 전체 설정을 따릅니다.',
    '시스템 전체에서 복사', '다른 역할에 적용',
    '이 패널에서 이 역할의 설정을 시스템 전체의 현재 표시/순서로 덮어씁니다. 진행할까요?',
    '시스템 전체에서 복사했습니다({n}개 항목)', '복사하지 못했습니다',
    '이 패널에서 이 역할의 필드 표시와 순서를 선택한 역할로 그대로 복사합니다. 대상 역할의 기존 설정은 덮어써집니다.',
    '대상 역할 선택', '적용', '선택한 역할에 적용했습니다', '적용하지 못했습니다', '역할 목록을 불러오지 못했습니다'],

  de: ['Häkchen = für diese Rolle sichtbar; die Nummer bestimmt die Reihenfolge (nur angehakte Felder haben eine Nummer, 1 zuerst); Spaltennamen kommen weiterhin aus der Systemeinstellung.',
    'Aus Systemeinstellung kopieren', 'Auf andere Rolle anwenden',
    'Damit werden die Einstellungen dieser Rolle für dieses Panel durch die aktuelle Sichtbarkeit und Reihenfolge der Systemeinstellung überschrieben. Fortfahren?',
    'Aus der Systemeinstellung kopiert ({n} Felder)', 'Kopieren fehlgeschlagen',
    'Kopiert Sichtbarkeit und Reihenfolge dieser Rolle für dieses Panel vollständig auf die gewählte Rolle; deren bestehende Anpassung wird überschrieben.',
    'Zielrolle wählen', 'Anwenden', 'Auf die gewählte Rolle angewendet', 'Anwenden fehlgeschlagen', 'Rollenliste konnte nicht geladen werden'],

  es: ['Marcado = visible para este rol; el número define el orden (solo los campos marcados tienen número, 1 primero); los nombres de columna siguen viniendo de la configuración del sistema.',
    'Copiar desde todo el sistema', 'Aplicar a otro rol',
    'Se sobrescribirá la configuración de este rol en este panel con la visibilidad y el orden actuales del sistema. ¿Continuar?',
    'Copiado desde todo el sistema ({n} campos)', 'No se pudo copiar',
    'Copia la visibilidad y el orden de campos de este rol en este panel al rol seleccionado; su personalización existente se sobrescribirá.',
    'Seleccionar rol de destino', 'Aplicar', 'Aplicado al rol seleccionado', 'No se pudo aplicar', 'No se pudo leer la lista de roles'],

  fr: ['Coché = visible pour ce rôle ; le numéro définit l’ordre (seuls les champs cochés ont un numéro, 1 en premier) ; les noms de colonnes viennent toujours du réglage système.',
    'Copier depuis le système', 'Appliquer à un autre rôle',
    'Les réglages de ce rôle sur ce panel seront remplacés par la visibilité et l’ordre actuels du réglage système. Continuer ?',
    'Copié depuis le système ({n} champs)', 'Échec de la copie',
    'Copie la visibilité et l’ordre des champs de ce rôle sur ce panel vers le rôle choisi ; sa personnalisation existante sera écrasée.',
    'Choisir le rôle cible', 'Appliquer', 'Appliqué au rôle choisi', 'Échec de l’application', 'Impossible de charger la liste des rôles'],

  ru: ['Флажок = видно для этой роли; номер задаёт порядок (номер только у отмеченных полей, 1 — первое); названия столбцов по-прежнему из системных настроек.',
    'Скопировать из системных настроек', 'Применить к другой роли',
    'Настройки этой роли для данной панели будут заменены текущей видимостью и порядком системных настроек. Продолжить?',
    'Скопировано из системных настроек ({n} полей)', 'Не удалось скопировать',
    'Копирует видимость и порядок полей этой роли на данной панели выбранной роли; её текущая настройка будет перезаписана.',
    'Выберите целевую роль', 'Применить', 'Применено к выбранной роли', 'Не удалось применить', 'Не удалось загрузить список ролей'],

  th: ['ติ๊ก=แสดงสำหรับบทบาทนี้ หมายเลขกำหนดลำดับ (เฉพาะฟิลด์ที่ติ๊กเท่านั้นที่มีหมายเลข 1 คือลำดับแรก) ชื่อคอลัมน์ยังคงตามการตั้งค่าของทั้งระบบ',
    'คัดลอกจากทั้งระบบ', 'ใช้กับบทบาทอื่น',
    'จะเขียนทับการตั้งค่าของบทบาทนี้ในแผงนี้ด้วยการแสดง/ลำดับปัจจุบันของทั้งระบบ ดำเนินการต่อหรือไม่?',
    'คัดลอกจากทั้งระบบแล้ว ({n} ฟิลด์)', 'คัดลอกไม่สำเร็จ',
    'คัดลอกการแสดงและลำดับฟิลด์ของบทบาทนี้ในแผงนี้ไปยังบทบาทที่เลือก การตั้งค่าเดิมของบทบาทปลายทางจะถูกเขียนทับ',
    'เลือกบทบาทปลายทาง', 'ยืนยันการใช้', 'ใช้กับบทบาทที่เลือกแล้ว', 'ใช้ไม่สำเร็จ', 'อ่านรายการบทบาทไม่สำเร็จ'],

  vi: ['Tích = hiển thị cho vai trò này; số quyết định thứ tự (chỉ trường được tích mới có số, 1 là đầu tiên); tên cột vẫn theo cấu hình toàn hệ thống.',
    'Sao chép từ toàn hệ thống', 'Áp dụng cho vai trò khác',
    'Sẽ ghi đè thiết lập của vai trò này trên bảng này bằng hiển thị và thứ tự hiện tại của toàn hệ thống. Tiếp tục?',
    'Đã sao chép từ toàn hệ thống ({n} trường)', 'Sao chép thất bại',
    'Sao chép toàn bộ hiển thị và thứ tự trường của vai trò này trên bảng này sang vai trò đã chọn; tùy chỉnh hiện có của vai trò đó sẽ bị ghi đè.',
    'Chọn vai trò đích', 'Xác nhận áp dụng', 'Đã áp dụng cho vai trò đã chọn', 'Áp dụng thất bại', 'Không đọc được danh sách vai trò'],

  'zh-TW': ['勾選＝本角色顯示；序號決定順序（只有勾選的欄位才有號，1 在最前）；欄名仍依系統整體。',
    '從系統整體複製', '套用到其他角色',
    '將用「系統整體」目前的欄位顯示與順序覆蓋本角色在這個面板的設定，繼續？',
    '已從系統整體複製（{n} 個欄位）', '複製失敗',
    '把本角色在這個面板的欄位顯示與順序整份複製給所選角色；目標角色原有設定會被覆蓋。',
    '選擇目標角色', '確定套用', '已套用到所選角色', '套用失敗', '讀取角色清單失敗'],
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, vals] of Object.entries(T)) {
  if (vals.length !== ORDER.length) throw new Error(`${loc}: 译文 ${vals.length} ≠ 键 ${ORDER.length}`)
  const file = path.join(DIR, `${loc}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const lines = []
  ORDER.forEach((k, i) => {
    const re = new RegExp(`(['"])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`)
    if (re.test(src)) return
    lines.push(`    '${esc(k)}': '${esc(vals[i])}',`)
  })
  if (!lines.length) { console.log(`${loc}: 无需补(已齐)`); continue }
  const m = /\r?\n(\s*)biz:\s*\{\r?\n/.exec(src)
  if (!m) { console.log(`${loc}: ⚠ 找不到 biz 锚点,跳过`); continue }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const at = m.index + m[0].length
  const block = `    // ---- 角色字段视图第二轮:序号排序 + 角色模板(从整体复制 / 套用到另一角色)----${nl}${lines.join(nl)}${nl}`
  fs.writeFileSync(file, src.slice(0, at) + block + src.slice(at), 'utf8')
  console.log(`${loc}: 补 ${lines.length} 条`)
  changed++
}
console.log(`\n完成:${changed} 个语言包有改动`)
