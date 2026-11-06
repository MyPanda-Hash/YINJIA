/**
 * _i18n-delprint-20261106.mjs — 「删除离线打印电脑 / 已存在的单也打印」两条文案进 9 个语言包
 *
 * 用法(仓库根):node tools/archive/_i18n-delprint-20261106.mjs [--write|--audit]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const locDir = resolve(root, 'frontend/src/i18n/locales')
const files = [
  resolve(root, 'frontend/src/views/sys/PrintStation.vue'),
  resolve(root, 'frontend/src/views/mobile/MobilePickCreate.vue'),
]
const WRITE = process.argv.includes('--write')
const AUDIT = process.argv.includes('--audit')

const LOCALES = { en: 1, ja: 2, ko: 3, es: 4, fr: 5, de: 6, ru: 7, vi: 8, th: 9 }

/** [中文, en, ja, ko, es, fr, de, ru, vi, th] */
const ROWS = [
  ['删除', 'Delete', '削除', '삭제', 'Eliminar', 'Supprimer', 'Löschen', 'Удалить', 'Xóa', 'ลบ'],
  ['删除打印电脑', 'Delete print computer', '印刷PCを削除', '인쇄 PC 삭제', 'Eliminar equipo de impresión', 'Supprimer le poste d\'impression', 'Druck-PC löschen', 'Удалить печатающий ПК', 'Xóa máy in', 'ลบเครื่องพิมพ์'],
  ['确定删除打印电脑「', 'Delete print computer "', '印刷PC「', '인쇄 PC "', '¿Eliminar el equipo "', 'Supprimer le poste « ', 'Druck-PC „', 'Удалить ПК «', 'Xóa máquina in "', 'ลบเครื่องพิมพ์ "'],
  ['」吗?它现在离线;删掉后再连上来需要重新添加', '"? It is offline now; after deleting, it must be re-added when it reconnects', '」を削除しますか?現在オフラインです。再接続時は再追加が必要です', '"을(를) 삭제할까요? 현재 오프라인입니다. 다시 연결되면 재추가해야 합니다', '"? Ahora está desconectado; si vuelve, habrá que añadirlo de nuevo', ' » ? Il est hors ligne ; une fois reconnecté il faudra le rajouter', '“ löschen? Er ist offline; beim nächsten Verbinden muss er neu hinzugefügt werden', '»? Сейчас он офлайн; при повторном подключении его нужно добавить заново', '"? Hiện đang ngoại tuyến; khi kết nối lại phải thêm lại', '" หรือไม่? ตอนนี้ออฟไลน์ หากเชื่อมต่ออีกต้องเพิ่มใหม่'],
  ['已删除', 'Deleted', '削除しました', '삭제됨', 'Eliminado', 'Supprimé', 'Gelöscht', 'Удалено', 'Đã xóa', 'ลบแล้ว'],
  ['删除失败', 'Delete failed', '削除に失敗しました', '삭제 실패', 'Error al eliminar', 'Échec de la suppression', 'Löschen fehlgeschlagen', 'Не удалось удалить', 'Xóa thất bại', 'ลบไม่สำเร็จ'],
  ['已存在·已打印', 'Exists · printed', '既存・印刷済み', '기존·인쇄됨', 'Existe · impreso', 'Existe · imprimé', 'Vorhanden · gedruckt', 'Есть · напечатано', 'Đã có · đã in', 'มีอยู่ · พิมพ์แล้ว'],
  ['已开过单的按原单重打', 'existing slips reprinted', '既存伝票は再印刷', '기존 전표 재인쇄', 'vales existentes reimpresos', 'bons existants réimprimés', 'bestehende Belege erneut gedruckt', 'существующие накладные перепечатаны', 'phiếu đã có được in lại', 'พิมพ์ใบเดิมซ้ำ'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const unesc = (s) => s.replace(/\\\\/g, '\\').replace(/\\'/g, "'")

if (AUDIT) {
  const en = readFileSync(resolve(locDir, 'en.js'), 'utf8')
  const uniq = new Set()
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/tt\('([^']*)'\)/g)) uniq.add(unesc(m[1]))
  }
  const miss = [...uniq].filter((k) => !en.includes(`'${esc(k)}':`))
  console.log(`tt() 文案 ${uniq.size} 条,缺译名 ${miss.length} 条`)
  miss.forEach((k) => console.log('  缺: ' + k))
  process.exit(0)
}

for (const [loc, idx] of Object.entries(LOCALES)) {
  const file = resolve(locDir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const missing = ROWS.filter((r) => !src.includes(`'${esc(r[0])}':`))
  if (!missing.length) { console.log(`[SKIP] ${loc}`); continue }
  if (!WRITE) { console.log(`[DRY] ${loc}: 缺 ${missing.length}`); continue }
  const lines = missing.map((r) => `    '${esc(r[0])}': '${esc(r[idx])}',`)
  const lastClose = src.lastIndexOf('\n  }')
  if (lastClose < 0) { console.error(`[FAIL] ${loc}: 找不到 biz 收尾`); continue }
  writeFileSync(file, src.slice(0, lastClose) + '\n' + lines.join('\n') + src.slice(lastClose), 'utf8')
  console.log(`[OK]   ${loc}: +${missing.length}`)
}
