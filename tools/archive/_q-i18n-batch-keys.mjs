// 一次性工具:把分批送料对话框的新增词条补进各语言 locales(缺失才插)
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'D:/YINJIA-main/frontend/src/i18n/locales';
// 中文键 → 各语言译名
const KEYS = {
  '分批送料': { en: 'Batch delivery', ja: '分割納入', ko: '분할 납품', de: 'Teillieferung', fr: 'Livraison partielle', es: 'Entrega parcial', ru: 'Партийная поставка', vi: 'Giao theo lô', th: 'ส่งมอบเป็นล็อต', 'zh-TW': '分批送料' },
  '本次送料数量': { en: 'Delivery qty (this time)', ja: '今回納入数量', ko: '이번 납품 수량', de: 'Liefermenge (diesmal)', fr: 'Qté livrée (cette fois)', es: 'Cantidad entregada (esta vez)', ru: 'Кол-во поставки (сейчас)', vi: 'Số lượng giao lần này', th: 'จำนวนส่งมอบครั้งนี้', 'zh-TW': '本次送料數量' },
  '已送': { en: 'Delivered', ja: '納入済', ko: '납품됨', de: 'Geliefert', fr: 'Livré', es: 'Entregado', ru: 'Поставлено', vi: 'Đã giao', th: 'ส่งแล้ว', 'zh-TW': '已送' },
  '已退回': { en: 'Returned', ja: '返品済', ko: '반품됨', de: 'Zurückgesandt', fr: 'Retourné', es: 'Devuelto', ru: 'Возвращено', vi: 'Đã trả lại', th: 'คืนแล้ว', 'zh-TW': '已退回' },
  '可送上限': { en: 'Max deliverable', ja: '納入上限', ko: '납품 상한', de: 'Max. lieferbar', fr: 'Max livrable', es: 'Máx. entregable', ru: 'Макс. к поставке', vi: 'Tối đa giao', th: 'ส่งได้สูงสุด', 'zh-TW': '可送上限' },
  '订单数量': { en: 'Order qty', ja: '発注数量', ko: '주문 수량', de: 'Bestellmenge', fr: 'Qté commandée', es: 'Cantidad pedida', ru: 'Кол-во заказа', vi: 'SL đặt hàng', th: 'จำนวนสั่ง', 'zh-TW': '訂單數量' },
  '超送比例': { en: 'Over-delivery ratio', ja: '過納比率', ko: '초과 납품 비율', de: 'Überlieferungsquote', fr: 'Taux de sur-livraison', es: 'Ratio de sobreentrega', ru: 'Допуск перепоставки', vi: 'Tỷ lệ giao vượt', th: 'อัตราส่งเกิน', 'zh-TW': '超送比例' },
  '已有批次': { en: 'Existing batches', ja: '既存バッチ', ko: '기존 배치', de: 'Vorhandene Chargen', fr: 'Lots existants', es: 'Lotes existentes', ru: 'Существующие партии', vi: 'Lô hiện có', th: 'ล็อตที่มีอยู่', 'zh-TW': '已有批次' },
  '本次合计': { en: 'Total this time', ja: '今回合計', ko: '이번 합계', de: 'Summe (diesmal)', fr: 'Total cette fois', es: 'Total esta vez', ru: 'Итого сейчас', vi: 'Tổng lần này', th: 'รวมครั้งนี้', 'zh-TW': '本次合計' },
  '按剩余量填充': { en: 'Fill remaining', ja: '残量を入力', ko: '잔량 채우기', de: 'Restmenge einsetzen', fr: 'Remplir le reste', es: 'Rellenar el resto', ru: 'Заполнить остаток', vi: 'Điền phần còn lại', th: 'เติมส่วนที่เหลือ', 'zh-TW': '按剩餘量填充' },
  '确定生单': { en: 'Create', ja: '作成', ko: '생성', de: 'Erzeugen', fr: 'Créer', es: 'Crear', ru: 'Создать', vi: 'Tạo', th: 'สร้าง', 'zh-TW': '確定生單' },
  '每行留空或 0 = 本次不送;不超过「可送上限」(剩余 ×（1+超送比例）)': {
    en: 'Blank or 0 = not delivered this time; must not exceed "Max deliverable" (remaining × (1 + over-delivery ratio))',
    ja: '空欄または 0 = 今回は納入しない。「納入上限」(残量 ×(1+過納比率))を超えないこと',
    ko: '비우거나 0 = 이번 미납품. "납품 상한"(잔량 ×(1+초과 비율)) 이하',
    de: 'Leer oder 0 = diesmal keine Lieferung; max. "Max. lieferbar" (Rest × (1 + Quote))',
    fr: 'Vide ou 0 = non livré cette fois ; ne pas dépasser le max livrable (reste × (1 + taux))',
    es: 'Vacío o 0 = no entregado; no superar el máximo (resto × (1 + ratio))',
    ru: 'Пусто или 0 = не поставлять; не более максимума (остаток × (1 + допуск))',
    vi: 'Để trống hoặc 0 = không giao lần này; không vượt mức tối đa (còn lại × (1 + tỷ lệ))',
    th: 'ว่างหรือ 0 = ไม่ส่งครั้งนี้; ต้องไม่เกิน "ส่งได้สูงสุด" (คงเหลือ × (1 + อัตรา))',
    'zh-TW': '每行留空或 0 = 本次不送;不超過「可送上限」(剩餘 ×（1+超送比例）)',
  },
  '请至少填写一行的本次送料数量': { en: 'Fill the delivery qty of at least one line', ja: '少なくとも 1 行の今回納入数量を入力してください', ko: '최소 한 행의 이번 납품 수량을 입력하세요', de: 'Bitte für mindestens eine Zeile die Liefermenge eintragen', fr: 'Saisissez la quantité d\'au moins une ligne', es: 'Introduzca la cantidad de al menos una línea', ru: 'Укажите количество хотя бы для одной строки', vi: 'Nhập số lượng cho ít nhất một dòng', th: 'กรอกจำนวนอย่างน้อยหนึ่งบรรทัด', 'zh-TW': '請至少填寫一行的本次送料數量' },
  '分批送料数据加载失败': { en: 'Failed to load batch delivery data', ja: '分割納入データの読み込みに失敗', ko: '분할 납품 데이터 로드 실패', de: 'Teillieferungsdaten konnten nicht geladen werden', fr: 'Échec du chargement des données de livraison partielle', es: 'Error al cargar datos de entrega parcial', ru: 'Не удалось загрузить данные партийной поставки', vi: 'Không tải được dữ liệu giao theo lô', th: 'โหลดข้อมูลส่งมอบเป็นล็อตไม่สำเร็จ', 'zh-TW': '分批送料資料載入失敗' },
  '所选来源行已无剩余可送': { en: 'Selected source lines have no remaining qty', ja: '選択した明細行に残量がありません', ko: '선택한 행에 잔량이 없습니다', de: 'Ausgewählte Zeilen haben keine Restmenge', fr: 'Les lignes sélectionnées n\'ont plus de reste', es: 'Las líneas seleccionadas no tienen resto', ru: 'У выбранных строк нет остатка', vi: 'Các dòng đã chọn không còn phần còn lại', th: 'บรรทัดที่เลือกไม่มีส่วนที่เหลือ', 'zh-TW': '所選來源行已無剩餘可送' },
};

const missing = {};
for (const loc of fs.readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'zh-CN.js')) {
  const locale = loc.replace(/\.js$/, '');
  const f = path.join(DIR, loc);
  let src = fs.readFileSync(f, 'utf8');
  const additions = [];
  for (const [key, tr] of Object.entries(KEYS)) {
    const text = tr[locale];
    if (!text) continue;
    if (src.includes(`'${key}'`)) continue;
    additions.push([key, text]);
  }
  if (!additions.length) { console.log(`${locale}: 无需补`); continue; }
  // 插到 biz 段末尾前(biz 段以 "  }," 结束):用最后一个 "    '...': '...'," 之后插入
  const m = src.match(/\n(\s*)'([^']+)':\s*'[^']*',\n\}/);
  const anchor = m ? m[0] : null;
  const clamp = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const block = additions.map(([k, v]) => `    '${clamp(k)}': '${clamp(v)}',`).join('\n');
  if (anchor) {
    src = src.replace(anchor, `\n${block}${anchor}`);
  } else {
    // 兜底:插在最后一个 biz 对象结束前
    src = src.replace(/\n\}\s*$/, `\n  biz: {\n${block}\n  },\n}\n`);
  }
  fs.writeFileSync(f, src, 'utf8');
  missing[locale] = additions.length;
  console.log(`${locale}: 补 ${additions.length} 条`);
}
console.log('汇总:', JSON.stringify(missing));
