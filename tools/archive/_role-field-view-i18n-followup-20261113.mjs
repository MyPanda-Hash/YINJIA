/*
 * _role-field-view-i18n-followup-20261113.mjs —— 角色字段视图:补 1 条兜底提示文案(10 语言)
 *
 * 背景:表格调整/表头调整切「本角色」时,若账号没有角色**或**接口没就绪(老后端没有 /px/fieldView),
 * 都会落回「系统整体」。原来两句话分开写,但界面上分不清是谁 —— 合并成一句,免得报错信息误导人。
 *
 * 用法(仓库根):node tools/archive/_role-field-view-i18n-followup-20261113.mjs
 * 幂等:已有该键的语言包跳过。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')
const KEY = '当前账号未分配角色或本角色视图不可用，已切到「系统整体」。'

const T = {
  en: 'This account has no role, or the role field view is unavailable; switched to “System (all users)”.',
  ja: 'このアカウントにはロールがないか、自ロールのフィールド表示を利用できません。「システム全体」に切り替えました。',
  ko: '이 계정에 역할이 없거나 이 역할의 필드 보기를 사용할 수 없어 「시스템 전체」로 전환했습니다.',
  de: 'Dieses Konto hat keine Rolle oder die Feldansicht der Rolle ist nicht verfügbar – auf „Systemweit“ umgestellt.',
  es: 'Esta cuenta no tiene rol o la vista de campos del rol no está disponible; se cambió a «Todo el sistema».',
  fr: 'Ce compte n’a pas de rôle ou la vue des champs du rôle est indisponible ; passage à « Système (tous) ».',
  ru: 'У этой учётной записи нет роли или вид полей роли недоступен — переключено на «Вся система».',
  th: 'บัญชีนี้ยังไม่ได้กำหนดบทบาทหรือมุมมองฟิลด์ของบทบาทใช้ไม่ได้ เปลี่ยนเป็น「ทั้งระบบ」แล้ว',
  vi: 'Tài khoản này chưa có vai trò hoặc không dùng được chế độ xem trường của vai trò, đã chuyển sang「Toàn hệ thống」.',
  'zh-TW': '目前帳號未分配角色或本角色欄位檢視無法使用，已切到「系統整體」。',
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, val] of Object.entries(T)) {
  const file = path.join(DIR, `${loc}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const re = new RegExp(`(['"])${KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`)
  if (re.test(src)) { console.log(`${loc}: 已有,跳过`); continue }
  const m = /\r?\n(\s*)biz:\s*\{\r?\n/.exec(src)
  if (!m) { console.log(`${loc}: ⚠ 找不到 biz 锚点,跳过`); continue }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const at = m.index + m[0].length
  const block = `    // 角色字段视图:无角色/接口未就绪时落回系统整体的提示(2026-11-13)${nl}    '${esc(KEY)}': '${esc(val)}',${nl}`
  fs.writeFileSync(file, src.slice(0, at) + block + src.slice(at), 'utf8')
  console.log(`${loc}: 补 1 条`)
  changed++
}
console.log(`\n完成:${changed} 个语言包有改动`)
