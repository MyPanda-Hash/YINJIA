/**
 * _print-cache-i18n-20261116.mjs —「打印缓存(离线补打)」新增 UI 文案补进 9 个语言包
 *
 * 为什么用脚本:本次在 PrintStation.vue 新增 17 条 tt() 文案,逐个人工编辑 9 个语言包必漏
 * (AGENTS.md 硬规矩:新增 UI 文案必须走 tt(),且切换语言后不能还是中文)。
 * 脚本做法 = 在语言包 biz 对象**末尾、闭合括号之前**插入一批键值;
 * 已存在的键**不覆盖**(人工校对过的译名优先),只补缺的。
 *
 * 用法(在仓库根):
 *   node tools/archive/_print-cache-i18n-20261116.mjs            # 干跑,只报告缺哪些
 *   node tools/archive/_print-cache-i18n-20261116.mjs --write    # 真写
 *   node tools/archive/_print-cache-i18n-20261116.mjs --audit    # 列出 PrintStation.vue 里缺译名的 tt()
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const locDir = resolve(root, 'frontend/src/i18n/locales')
const vueFile = resolve(root, 'frontend/src/views/sys/PrintStation.vue')
const WRITE = process.argv.includes('--write')
const AUDIT = process.argv.includes('--audit')

const LOCALES = { en: 1, ja: 2, ko: 3, es: 4, fr: 5, de: 6, ru: 7, vi: 8, th: 9 }

/**
 * 词条表 [中文原文, en, ja, ko, es, fr, de, ru, vi, th]
 *
 * 收录范围 = 本次改造后 PrintStation.vue 里**其它页面没译过**的那批
 * (「已保存」「已删除」「删除」「清空」「失败」等全站通用词条已在语言包里,不重复)。
 */
const ROWS = [
  // ── 卡片标题 / 说明 ──
  ['打印缓存(离线补打)', 'Print cache (offline catch-up)', '印刷キャッシュ(オフライン補印)', '인쇄 캐시(오프라인 보충 인쇄)', 'Caché de impresión (recuperación sin conexión)', 'Cache d\'impression (rattrapage hors ligne)', 'Druckcache (Nachdruck offline)', 'Кэш печати (допечать при офлайне)', 'Bộ đệm in (in bù khi mất kết nối)', 'แคชการพิมพ์ (พิมพ์ชดเชยตอนออฟไลน์)'],
  ['代理掉线期间的单子留在这里,回来按顺序补打', 'Jobs created while the agent is offline wait here and print in order once it is back', 'エージェント切断中に作成された伝票はここに残り、復帰後に順番に印刷されます', '에이전트가 끊긴 동안 만든 전표는 여기에 남아 복구되면 순서대로 인쇄됩니다', 'Los documentos creados sin conexión esperan aquí y se imprimen en orden al volver', 'Les documents créés pendant la coupure attendent ici et s\'impriment dans l\'ordre au retour', 'Belege aus der Offline-Zeit warten hier und werden nach der Rückkehr der Reihe nach gedruckt', 'Документы, созданные во время офлайна, ждут здесь и печатаются по порядку после восстановления', 'Phiếu tạo khi mất kết nối nằm ở đây và in lần lượt khi kết nối lại', 'เอกสารที่สร้างตอนออฟไลน์จะรอที่นี่ และพิมพ์ตามลำดับเมื่อกลับมาออนไลน์'],
  ['代理掉线时缓存打印任务', 'Cache print jobs while the agent is offline', 'エージェント切断中は印刷ジョブをキャッシュする', '에이전트가 끊긴 동안 인쇄 작업을 캐시', 'Guardar los trabajos en caché mientras el agente está desconectado', 'Mettre les travaux en cache pendant la coupure', 'Druckaufträge in der Offline-Zeit zwischenspeichern', 'Сохранять задания печати, пока агент офлайн', 'Lưu tạm lệnh in khi mất kết nối', 'เก็บงานพิมพ์ไว้ชั่วคราวตอนเอเจนต์ออฟไลน์'],
  ['开着:那台电脑掉线期间点的打印会留在这里,代理一回来就按顺序补打;关着:掉线就退回手机自己打印', 'On: jobs clicked while that computer is offline stay here and print in order once the agent is back; Off: the phone falls back to its own print dialog', 'オン:そのパソコンが切断中に押した印刷はここに残り、復帰後に順番に補印されます。オフ:切断時はスマホ側の印刷になります', '켜짐: 해당 PC가 끊긴 동안 누른 인쇄는 여기에 남아 복구되면 순서대로 보충 인쇄됩니다. 꺼짐: 끊기면 휴대폰이 직접 인쇄합니다', 'Activado: lo enviado a imprimir sin conexión se guarda aquí y se imprime en orden al volver; Desactivado: el móvil imprime por su cuenta', 'Activé : ce qui est imprimé pendant la coupure est gardé ici et imprimé dans l\'ordre au retour ; désactivé : le mobile imprime lui-même', 'An: Aufträge aus der Offline-Zeit bleiben hier und werden nach der Rückkehr gedruckt; Aus: das Handy druckt selbst', 'Вкл: задания, отправленные во время офлайна, ждут здесь и печатаются по порядку после восстановления; Выкл: печатает телефон', 'Bật: phiếu bấm in khi máy đó mất kết nối sẽ nằm ở đây và in lần lượt khi kết nối lại; Tắt: điện thoại tự in', 'เปิด: งานที่สั่งพิมพ์ตอนเครื่องนั้นออฟไลน์จะรอที่นี่และพิมพ์ตามลำดับเมื่อกลับมา; ปิด: มือถือพิมพ์เอง'],
  ['缓存里没有待补打的单子', 'No jobs waiting in the cache', 'キャッシュに補印待ちの伝票はありません', '캐시에 보충 인쇄 대기 전표가 없습니다', 'No hay documentos esperando en la caché', 'Aucun document en attente dans le cache', 'Keine Belege im Cache', 'В кэше нет документов, ожидающих печати', 'Không có phiếu nào chờ in bù', 'ไม่มีงานรอพิมพ์ชดเชยในแคช'],
  ['缓存保留 3 天;过期的单子不再补打,列表里还能看到', 'Cached for 3 days; expired jobs are no longer printed but stay listed', 'キャッシュは3日間保持。期限切れの伝票は補印されませんが一覧には残ります', '캐시는 3일간 보관됩니다. 만료된 전표는 보충 인쇄되지 않지만 목록에는 남습니다', 'La caché dura 3 días; los documentos caducados ya no se imprimen pero siguen listados', 'Cache de 3 jours ; les documents expirés ne sont plus imprimés mais restent listés', 'Cache 3 Tage; abgelaufene Belege werden nicht mehr gedruckt, bleiben aber gelistet', 'Кэш хранится 3 дня; просроченные документы не печатаются, но видны в списке', 'Lưu đệm 3 ngày; phiếu quá hạn không in bù nhưng vẫn hiện trong danh sách', 'เก็บแคช 3 วัน งานที่หมดอายุจะไม่พิมพ์ชดเชยแต่ยังแสดงในรายการ'],
  // ── 每行状态 / 操作 ──
  ['已发出,等回执', 'Sent, waiting for confirmation', '送信済み(応答待ち)', '전송됨(응답 대기)', 'Enviado, esperando confirmación', 'Envoyé, en attente de retour', 'Gesendet, wartet auf Rückmeldung', 'Отправлено, ждём подтверждения', 'Đã gửi, chờ phản hồi', 'ส่งแล้ว รอผลตอบกลับ'],
  ['等待补打', 'Waiting to print', '補印待ち', '보충 인쇄 대기', 'Esperando impresión', 'En attente d\'impression', 'Wartet auf Druck', 'Ожидает печати', 'Chờ in bù', 'รอพิมพ์ชดเชย'],
  ['目标电脑', 'Target computers', '対象パソコン', '대상 PC', 'Equipos de destino', 'Postes cibles', 'Zielrechner', 'Целевые компьютеры', 'Máy đích', 'เครื่องปลายทาง'],
  ['补打', 'Print now', '補印', '보충 인쇄', 'Imprimir ahora', 'Réimprimer', 'Nachdrucken', 'Допечатать', 'In bù', 'พิมพ์ชดเชย'],
  ['清空缓存', 'Clear cache', 'キャッシュを消去', '캐시 비우기', 'Vaciar caché', 'Vider le cache', 'Cache leeren', 'Очистить кэш', 'Xóa bộ đệm', 'ล้างแคช'],
  // ── 操作反馈 / 确认框 ──
  ['已重新排队,代理下一次轮询就会补打', 'Re-queued; it prints on the agent\'s next poll', '再キューに入れました。次回ポーリングで補印します', '다시 대기열에 넣었습니다. 다음 폴링에서 보충 인쇄됩니다', 'Vuelto a la cola; se imprime en la próxima consulta del agente', 'Remis en file ; impression au prochain sondage de l\'agent', 'Neu eingereiht; Druck beim nächsten Abruf des Agenten', 'Снова в очереди; напечатается при следующем опросе агента', 'Đã xếp lại hàng đợi; sẽ in ở lần lấy tiếp theo của agent', 'เข้าคิวใหม่แล้ว จะพิมพ์ในการดึงงานครั้งถัดไปของเอเจนต์'],
  ['补打发不出去', 'Could not re-queue the print job', '補印を再キューできませんでした', '보충 인쇄를 다시 대기열에 넣지 못했습니다', 'No se pudo reencolar el trabajo', 'Impossible de remettre en file', 'Erneut einreihen fehlgeschlagen', 'Не удалось поставить в очередь', 'Không xếp lại hàng đợi được', 'ไม่สามารถเข้าคิวงานพิมพ์ชดเชยได้'],
  ['已清空', 'Cleared', '消去しました', '비웠습니다', 'Vaciado', 'Vidé', 'Geleert', 'Очищено', 'Đã xóa', 'ล้างแล้ว'],
  ['删除缓存', 'Delete cached job', 'キャッシュを削除', '캐시 삭제', 'Eliminar de la caché', 'Supprimer du cache', 'Cache-Eintrag löschen', 'Удалить из кэша', 'Xóa khỏi bộ đệm', 'ลบแคช'],
  ['确定删除这条缓存吗?删掉后不再补打', 'Delete this cached job? It will not be printed', 'このキャッシュを削除しますか?補印されなくなります', '이 캐시를 삭제할까요? 더 이상 보충 인쇄되지 않습니다', '¿Eliminar este documento de la caché? No se imprimirá', 'Supprimer ce document du cache ? Il ne sera plus imprimé', 'Diesen Cache-Eintrag löschen? Er wird nicht mehr gedruckt', 'Удалить этот документ из кэша? Он не будет напечатан', 'Xóa phiếu này khỏi bộ đệm? Sẽ không in bù nữa', 'ลบแคชรายการนี้หรือไม่? จะไม่พิมพ์ชดเชยอีก'],
  ['确定清空打印缓存吗?清空后这些单子不再补打', 'Clear the whole print cache? These jobs will not be printed', '印刷キャッシュをすべて消去しますか?これらの伝票は補印されません', '인쇄 캐시를 모두 비울까요? 이 전표들은 보충 인쇄되지 않습니다', '¿Vaciar toda la caché? Estos documentos no se imprimirán', 'Vider tout le cache ? Ces documents ne seront plus imprimés', 'Den gesamten Druckcache leeren? Diese Belege werden nicht mehr gedruckt', 'Очистить весь кэш печати? Эти документы не будут напечатаны', 'Xóa toàn bộ bộ đệm in? Các phiếu này sẽ không được in bù', 'ล้างแคชการพิมพ์ทั้งหมดหรือไม่? งานเหล่านี้จะไม่ถูกพิมพ์ชดเชย'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

// ── --audit:PrintStation.vue 里出现但 en.js 没有的 tt() 文案 ──
if (AUDIT) {
  const src = readFileSync(vueFile, 'utf8')
  const en = readFileSync(resolve(locDir, 'en.js'), 'utf8')
  const unesc = (s) => s.replace(/\\\\/g, '\\').replace(/\\'/g, "'")
  const uniq = new Set()
  for (const m of src.matchAll(/tt\('([^']*)'\)/g)) uniq.add(unesc(m[1]))
  const miss = [...uniq].filter((k) => !en.includes(`'${esc(k)}':`))
  console.log(`tt() 文案 ${uniq.size} 条,缺译名 ${miss.length} 条`)
  miss.forEach((k) => console.log('  缺: ' + k))
  process.exit(0)
}

let totalAdded = 0
for (const [loc, idx] of Object.entries(LOCALES)) {
  const file = resolve(locDir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const missing = ROWS.filter((r) => !src.includes(`'${esc(r[0])}':`))
  if (!missing.length) {
    console.log(`[SKIP] ${loc}: 无缺失`)
    continue
  }
  if (!WRITE) {
    console.log(`[DRY]  ${loc}: 缺 ${missing.length} 条(例:${missing.slice(0, 3).map((m) => m[0]).join('、')})`)
    continue
  }
  const lines = missing
    .map((r) => (r[idx] == null || r[idx] === '' ? null : `    '${esc(r[0])}': '${esc(r[idx])}',`))
    .filter(Boolean)
  if (!lines.length) { console.log(`[SKIP] ${loc}: 无可插入行`); continue }
  // 插到 biz 对象末尾(该文件 biz 在文件末尾,收尾是最后一个 "\n  }")
  const lastClose = src.lastIndexOf('\n  }')
  if (lastClose < 0) { console.error(`[FAIL] ${loc}: 找不到 biz 收尾,跳过`); continue }
  writeFileSync(file, src.slice(0, lastClose) + '\n' + lines.join('\n') + src.slice(lastClose), 'utf8')
  totalAdded += lines.length
  console.log(`[OK]   ${loc}: +${lines.length} 条`)
}
if (WRITE) console.log(`\n合计新增 ${totalAdded} 条`)
