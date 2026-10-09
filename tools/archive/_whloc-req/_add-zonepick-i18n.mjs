// 往 10 个语言包的 biz 段注入「仓位分区」弹窗的新词条(2026-10-08)
// 定位方式:找到 `biz: {` → 逐字符扫(跳过字符串与转义)做花括号配对 → 在闭合花括号前插入。
import fs from 'node:fs'
import path from 'node:path'

const T = {
  '仓位分区': { en: 'Location Zones', 'zh-TW': '倉位分區', ja: 'ロケーションゾーン', de: 'Lagerzonen', es: 'Zonas de ubicación', fr: "Zones d'emplacement", ko: '로케이션 구역', ru: 'Зоны хранения', th: 'โซนตำแหน่งจัดเก็บ', vi: 'Khu vị trí' },
  '分区跟随仓位存在：候选自动来自仓位的实际数据，不需要单独登记；仓位没了，分区就没了。': {
    en: 'Zones exist only through locations: the list is derived from actual location data, with no separate registration. No locations, no zone.',
    'zh-TW': '分區跟隨倉位存在：候選自動來自倉位的實際資料，不需要單獨登記；倉位沒了，分區就沒了。',
    ja: 'ゾーンはロケーションに従属します：候補は実際のロケーションデータから自動生成され、個別登録は不要です。ロケーションが無ければゾーンもありません。',
    de: 'Zonen existieren nur über Lagerplätze: Die Liste wird aus den tatsächlichen Daten abgeleitet, ohne separate Registrierung. Keine Lagerplätze, keine Zone.',
    es: 'Las zonas existen solo a través de las ubicaciones: la lista se deriva de los datos reales, sin registro aparte. Sin ubicaciones, no hay zona.',
    fr: "Les zones n'existent que par les emplacements : la liste est dérivée des données réelles, sans enregistrement séparé. Pas d'emplacement, pas de zone.",
    ko: '구역은 로케이션을 통해서만 존재합니다: 목록은 실제 로케이션 데이터에서 자동 생성되며 별도 등록이 필요 없습니다. 로케이션이 없으면 구역도 없습니다.',
    ru: 'Зоны существуют только через места хранения: список формируется из фактических данных, отдельная регистрация не нужна. Нет мест — нет зоны.',
    th: 'โซนมีอยู่เพราะมีตำแหน่งจัดเก็บ: รายการดึงจากข้อมูลจริงโดยอัตโนมัติ ไม่ต้องลงทะเบียนแยก ไม่มีตำแหน่ง ก็ไม่มีโซน',
    vi: 'Khu chỉ tồn tại nhờ vị trí: danh sách được suy ra từ dữ liệu thực tế, không cần đăng ký riêng. Không có vị trí thì không có khu.',
  },
  '填一个新名字即可新增分区（保存后进入候选）': {
    en: 'Type a new name to add a zone (it joins the list after saving)',
    'zh-TW': '填一個新名字即可新增分區（儲存後進入候選）',
    ja: '新しい名前を入力するとゾーンを追加できます（保存後に候補へ入ります）',
    de: 'Neuen Namen eingeben, um eine Zone anzulegen (erscheint nach dem Speichern in der Liste)',
    es: 'Escriba un nombre nuevo para añadir una zona (entra en la lista al guardar)',
    fr: 'Saisissez un nouveau nom pour ajouter une zone (elle rejoint la liste après enregistrement)',
    ko: '새 이름을 입력하면 구역이 추가됩니다(저장 후 목록에 반영)',
    ru: 'Введите новое имя, чтобы добавить зону (появится в списке после сохранения)',
    th: 'พิมพ์ชื่อใหม่เพื่อเพิ่มโซน (จะเข้าสู่รายการหลังบันทึก)',
    vi: 'Nhập tên mới để thêm khu (vào danh sách sau khi lưu)',
  },
  '填入本格': { en: 'Fill this cell', 'zh-TW': '填入本格', ja: 'このセルに入力', de: 'In diese Zelle übernehmen', es: 'Rellenar esta celda', fr: 'Remplir cette cellule', ko: '이 셀에 채우기', ru: 'Заполнить эту ячейку', th: 'เติมในช่องนี้', vi: 'Điền vào ô này' },
  '清空本格': { en: 'Clear this cell', 'zh-TW': '清空本格', ja: 'このセルをクリア', de: 'Diese Zelle leeren', es: 'Vaciar esta celda', fr: 'Vider cette cellule', ko: '이 셀 비우기', ru: 'Очистить эту ячейку', th: 'ล้างช่องนี้', vi: 'Xóa ô này' },
  '点击选择分区': { en: 'Click to choose a zone', 'zh-TW': '點擊選擇分區', ja: 'クリックしてゾーンを選択', de: 'Klicken, um eine Zone zu wählen', es: 'Clic para elegir una zona', fr: 'Cliquez pour choisir une zone', ko: '클릭하여 구역 선택', ru: 'Нажмите, чтобы выбрать зону', th: 'คลิกเพื่อเลือกโซน', vi: 'Bấm để chọn khu' },
  '仓位数': { en: 'Locations', 'zh-TW': '倉位數', ja: 'ロケーション数', de: 'Lagerplätze', es: 'Ubicaciones', fr: 'Emplacements', ko: '로케이션 수', ru: 'Мест хранения', th: 'จำนวนตำแหน่ง', vi: 'Số vị trí' },
  '(不分区)': { en: '(no area)', 'zh-TW': '(不分區)', ja: '(エリアなし)', de: '(kein Bereich)', es: '(sin área)', fr: '(sans zone fonctionnelle)', ko: '(구역 없음)', ru: '(без зоны)', th: '(ไม่แบ่งโซน)', vi: '(không chia khu)' },
  '(不细分)': { en: '(no sub-zone)', 'zh-TW': '(不細分)', ja: '(サブゾーンなし)', de: '(keine Unterzone)', es: '(sin subzona)', fr: '(sans sous-zone)', ko: '(하위 구역 없음)', ru: '(без подзоны)', th: '(ไม่แบ่งโซนย่อย)', vi: '(không chia khu con)' },
  '无法删除': { en: 'Cannot delete', 'zh-TW': '無法刪除', ja: '削除できません', de: 'Löschen nicht möglich', es: 'No se puede eliminar', fr: 'Suppression impossible', ko: '삭제할 수 없음', ru: 'Удаление невозможно', th: 'ลบไม่ได้', vi: 'Không thể xóa' },
  '个仓位仍在使用该分区，无法删除。分区跟随仓位存在：请先把这些仓位改到别的分区或删除它们；当最后一个仓位离开后，本分区会自动从候选里消失。': {
    en: 'locations still use this zone, so it cannot be deleted. Zones exist only through locations: move those locations to another zone (or delete them) first; once the last one leaves, this zone disappears from the list automatically.',
    'zh-TW': '個倉位仍在使用該分區，無法刪除。分區跟隨倉位存在：請先把這些倉位改到別的分區或刪除它們；當最後一個倉位離開後，本分區會自動從候選裡消失。',
    ja: '個のロケーションがこのゾーンを使用中のため削除できません。ゾーンはロケーションに従属します：先にそれらのロケーションを別のゾーンへ移動するか削除してください。最後の1件が離れると、このゾーンは候補から自動的に消えます。',
    de: 'Lagerplätze nutzen diese Zone noch, daher kann sie nicht gelöscht werden. Zonen existieren nur über Lagerplätze: Verschieben Sie diese Lagerplätze zuerst in eine andere Zone (oder löschen Sie sie); sobald der letzte sie verlässt, verschwindet diese Zone automatisch aus der Liste.',
    es: 'ubicaciones siguen usando esta zona, por lo que no se puede eliminar. Las zonas existen solo a través de las ubicaciones: mueva primero esas ubicaciones a otra zona (o elimínelas); cuando la última salga, esta zona desaparecerá automáticamente de la lista.',
    fr: "emplacements utilisent encore cette zone, elle ne peut donc pas être supprimée. Les zones n'existent que par les emplacements : déplacez d'abord ces emplacements vers une autre zone (ou supprimez-les) ; lorsque le dernier partira, cette zone disparaîtra automatiquement de la liste.",
    ko: '개의 로케이션이 이 구역을 사용 중이므로 삭제할 수 없습니다. 구역은 로케이션을 통해서만 존재합니다: 먼저 해당 로케이션을 다른 구역으로 옮기거나 삭제하세요. 마지막 하나가 떠나면 이 구역은 목록에서 자동으로 사라집니다.',
    ru: 'мест хранения всё ещё используют эту зону, поэтому удалить её нельзя. Зоны существуют только через места хранения: сначала перенесите эти места в другую зону (или удалите их); когда уйдёт последнее, зона автоматически исчезнет из списка.',
    th: 'ตำแหน่งยังใช้โซนนี้อยู่ จึงลบไม่ได้ โซนมีอยู่เพราะมีตำแหน่งจัดเก็บ: กรุณาย้ายตำแหน่งเหล่านี้ไปโซนอื่น (หรือลบตำแหน่งเหล่านั้น) ก่อน เมื่อตำแหน่งสุดท้ายออกไป โซนนี้จะหายจากรายการโดยอัตโนมัติ',
    vi: 'vị trí vẫn đang dùng khu này nên không thể xóa. Khu chỉ tồn tại nhờ vị trí: hãy chuyển các vị trí đó sang khu khác (hoặc xóa chúng) trước; khi vị trí cuối cùng rời đi, khu này sẽ tự động biến mất khỏi danh sách.',
  },
  '该分区已没有仓位，它已经随仓位一起从候选里消失了。': {
    en: 'This zone has no locations left — it has already disappeared from the list along with them.',
    'zh-TW': '該分區已沒有倉位，它已經隨倉位一起從候選裡消失了。',
    ja: 'このゾーンにはロケーションがありません。すでに候補から消えています。',
    de: 'Diese Zone hat keine Lagerplätze mehr – sie ist bereits mit ihnen aus der Liste verschwunden.',
    es: 'Esta zona ya no tiene ubicaciones: ya ha desaparecido de la lista junto con ellas.',
    fr: "Cette zone n'a plus d'emplacement : elle a déjà disparu de la liste avec eux.",
    ko: '이 구역에는 로케이션이 없습니다. 이미 목록에서 사라졌습니다.',
    ru: 'В этой зоне больше нет мест хранения — она уже исчезла из списка вместе с ними.',
    th: 'โซนนี้ไม่มีตำแหน่งแล้ว มันหายจากรายการไปพร้อมกับตำแหน่งแล้ว',
    vi: 'Khu này không còn vị trí nào — nó đã biến mất khỏi danh sách cùng với chúng.',
  },
  '分区已消失': { en: 'Zone no longer exists', 'zh-TW': '分區已消失', ja: 'ゾーンは消滅しました', de: 'Zone existiert nicht mehr', es: 'La zona ya no existe', fr: "La zone n'existe plus", ko: '구역이 사라졌습니다', ru: 'Зона больше не существует', th: 'โซนหายไปแล้ว', vi: 'Khu đã biến mất' },
  '大区': { en: 'Area', 'zh-TW': '大區', ja: 'エリア', de: 'Bereich', es: 'Área', fr: 'Zone fonctionnelle', ko: '구역', ru: 'Зона', th: 'โซน', vi: 'Khu' },
  '存储分区': { en: 'Sub-zone', 'zh-TW': '儲存分區', ja: 'サブゾーン', de: 'Unterzone', es: 'Subzona', fr: 'Sous-zone', ko: '하위 구역', ru: 'Подзона', th: 'โซนย่อย', vi: 'Khu con' },
}

/** 找到 `biz: {` 的闭合花括号位置(跳过字符串字面量与转义) */
function bizCloseIndex(src) {
  const start = src.search(/\bbiz\s*:\s*\{/)
  if (start < 0) throw new Error('找不到 biz 段')
  let i = src.indexOf('{', start)
  let depth = 0
  let quote = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') { i++; continue }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  throw new Error('biz 段未闭合')
}
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

const dir = 'D:/workspace/yinjia/frontend/src/i18n/locales'
let done = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const loc = f.replace(/\.js$/, '')
  const abs = path.join(dir, f)
  let src = fs.readFileSync(abs, 'utf8')
  const add = []
  for (const [key, map] of Object.entries(T)) {
    if (src.includes(q(key) + ':')) continue           // 已有则跳过(幂等)
    const val = map[loc] || map.en
    add.push(`    ${q(key)}: ${q(val)},`)
  }
  if (!add.length) { console.log(`  = ${f} 无新增`); continue }
  let at = -1
  try {
    at = bizCloseIndex(src)
  } catch (e) {
    console.log(`  - ${f} 无 biz 段(源语言文件),跳过`)
    continue
  }
  src = src.slice(0, at) + '\n' + add.join('\n') + '\n  ' + src.slice(at)
  fs.writeFileSync(abs, src, 'utf8')
  console.log(`  ✓ ${f}  +${add.length} 键`)
  done++
}
console.log(`\n改了 ${done} 个语言包`)
