/**
 * _i18n-org-user-del.cjs — 组织架构「删除账号」新增词条,补进 10 个语言包(zh-CN 是源语言不建行)
 *
 * 词条的键 = OrgAdmin.vue 里 tt() 的中文原文,必须逐字一致(含标点与「」)。
 * 幂等:已存在的键跳过,可重复执行。用法:node tools/archive/_i18n-org-user-del.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales')

// 键 → 各语言译文
const ENTRIES = [
  {
    key: '提示',
    v: {
      'zh-TW': '提示', en: 'Notice', ja: '確認', ko: '알림', es: 'Aviso', fr: 'Information',
      de: 'Hinweis', ru: 'Внимание', vi: 'Thông báo', th: 'แจ้งเตือน',
    },
  },
  {
    key: '删除账号「{name}」？删除后该账号无法再登录，历史单据上的记录不受影响。',
    v: {
      'zh-TW': '刪除帳號「{name}」？刪除後該帳號無法再登入，歷史單據上的記錄不受影響。',
      en: 'Delete account "{name}"? The account will no longer be able to sign in; records on existing documents are unaffected.',
      ja: 'アカウント「{name}」を削除しますか？削除するとログインできなくなります。既存の伝票の記録には影響しません。',
      ko: '계정 "{name}"을(를) 삭제하시겠습니까? 삭제 후에는 로그인할 수 없습니다. 기존 전표의 기록에는 영향을 주지 않습니다.',
      es: '¿Eliminar la cuenta "{name}"? La cuenta ya no podrá iniciar sesión; los registros de los documentos existentes no se verán afectados.',
      fr: 'Supprimer le compte « {name} » ? Le compte ne pourra plus se connecter ; les enregistrements des documents existants ne sont pas affectés.',
      de: 'Konto „{name}“ löschen? Das Konto kann sich danach nicht mehr anmelden; Einträge in bestehenden Belegen bleiben unverändert.',
      ru: 'Удалить учётную запись «{name}»? После удаления вход будет невозможен; записи в существующих документах не изменятся.',
      vi: 'Xóa tài khoản "{name}"? Sau khi xóa, tài khoản không thể đăng nhập nữa; các ghi nhận trên chứng từ cũ không bị ảnh hưởng.',
      th: 'ลบบัญชี "{name}" หรือไม่? หลังลบจะไม่สามารถเข้าสู่ระบบได้อีก การบันทึกในเอกสารเดิมไม่ได้รับผลกระทบ',
    },
  },
  {
    key: '账号已删除',
    v: {
      'zh-TW': '帳號已刪除', en: 'Account deleted', ja: 'アカウントを削除しました', ko: '계정이 삭제되었습니다',
      es: 'Cuenta eliminada', fr: 'Compte supprimé', de: 'Konto gelöscht', ru: 'Учётная запись удалена',
      vi: 'Đã xóa tài khoản', th: 'ลบบัญชีแล้ว',
    },
  },
  {
    key: '；管理员账号与当前登录账号不可删除',
    v: {
      'zh-TW': '；管理員帳號與當前登入帳號不可刪除',
      en: '; admin accounts and the current account cannot be deleted',
      ja: '；管理者アカウントとログイン中のアカウントは削除できません',
      ko: '; 관리자 계정과 현재 로그인한 계정은 삭제할 수 없습니다',
      es: '; las cuentas de administrador y la cuenta actual no se pueden eliminar',
      fr: ' ; les comptes administrateur et le compte actuel ne peuvent pas être supprimés',
      de: '; Administratorkonten und das aktuell angemeldete Konto können nicht gelöscht werden',
      ru: '; учётные записи администраторов и текущая учётная запись не могут быть удалены',
      vi: '; tài khoản quản trị và tài khoản đang đăng nhập không thể xóa',
      th: '; บัญชีผู้ดูแลระบบและบัญชีที่เข้าสู่ระบบอยู่ไม่สามารถลบได้',
    },
  },
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const LOCALES = ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

let total = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, loc + '.js')
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const bizIdx = lines.findIndex((l) => /^\s*biz:\s*\{/.test(l))
  if (bizIdx < 0) { console.log('  ⚠ ' + loc + ': 找不到 biz 块,跳过'); continue }

  const missing = ENTRIES.filter((e) => !lines.some((l) => l.includes("'" + e.key + "'")))
  if (!missing.length) { console.log('  = ' + loc + ': 词条已齐,跳过'); continue }

  const ins = missing.map((e) => {
    const val = e.v[loc]
    if (!val) throw new Error(loc + ' 缺译文: ' + e.key)
    return "    '" + esc(e.key) + "': '" + esc(val) + "',"
  })
  lines.splice(bizIdx + 1, 0, ...ins)
  fs.writeFileSync(file, lines.join('\n'))
  total += missing.length
  console.log('  + ' + loc + ': 补 ' + missing.length + ' 条 → ' + missing.map((m) => m.key.slice(0, 12)).join(' / '))
}
console.log('\n共写入 ' + total + ' 条词条')
