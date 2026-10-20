/**
 * 一次性:把「结案异常」tooltip 的旧文案(含组装成品检验条件)换成新口径文案(2026-10-19)。
 * 键是中文原文,所以必须**同时**换 key 与 value;10 个语言包各一条,幂等(找不到旧键就跳过)。
 * 用法: node tools/archive/_close-anomaly-20261019/_retip-i18n.mjs
 */
import fs from 'fs';
import path from 'path';

const DIR = 'frontend/src/i18n/locales';
const OLD_KEY = '该行已结案，但不满足 MES 的结案条件（入库≥排产 + 组装成品检验已审核）—— 通常是手机端小程序/参考库直连写库造成的，可用「结案体检」核对后回正';
const NEW_KEY = '该行写着已结案，但入库数量没达到排产数量 —— MES 的两条结案路径都要求入库≥排产，所以这行不是 MES 结的（通常是手机端小程序/参考库直连写库）。可用「结案回正」一键改回未结案';

const VAL = {
  en: "This row is marked closed, but the received quantity has not reached the planned quantity. Both MES closing paths require received ≥ planned, so this row was not closed by MES (usually written straight into the database by the mobile mini-program / legacy system). Use \"Revert closing\" to reopen it.",
  ja: 'この行は結案になっていますが、入庫数量が計画数量に達していません。MES の結案はどちらの経路も「入庫≥計画」を要求するため、この行は MES が結案したものではありません（多くはスマホ側ミニプログラム／参照システムが DB へ直接書き込んだため）。「結案回正」で未結案に戻せます。',
  ko: '이 행은 마감으로 표시되어 있지만 입고 수량이 생산계획 수량에 미달합니다. MES의 두 마감 경로 모두 입고≥계획을 요구하므로 이 행은 MES가 마감한 것이 아닙니다(대개 모바일 미니프로그램/레거시 시스템이 DB에 직접 기록). 「마감 되돌리기」로 미마감으로 되돌릴 수 있습니다.',
  es: 'Esta fila figura cerrada, pero la cantidad ingresada no alcanza la planificada. Las dos vías de cierre de MES exigen ingreso ≥ planificado, así que esta fila no la cerró MES (normalmente la escribe directamente el mini-programa o el sistema heredado). Use «Revertir cierre» para volver a abierta.',
  fr: "Cette ligne est clôturée, mais la quantité entrée n'atteint pas la quantité planifiée. Les deux voies de clôture MES exigent entrée ≥ planifié : cette ligne n'a donc pas été clôturée par MES (généralement écrite directement en base par le mini-programme ou le système hérité). Utilisez « Annuler clôture » pour la rouvrir.",
  de: 'Die Zeile ist abgeschlossen, aber die Zugangsmenge erreicht die geplante Menge nicht. Beide MES-Abschlusswege verlangen Zugang ≥ geplant, daher wurde diese Zeile nicht von MES abgeschlossen (meist direkt vom Mini-Programm oder Altsystem in die DB geschrieben). Mit „Abschluss zurücksetzen“ wieder öffnen.',
  ru: 'Строка помечена как закрытая, но количество прихода меньше планового. Оба пути закрытия в MES требуют приход ≥ план, значит строку закрыл не MES (обычно это прямая запись в БД из мини-программы или старой системы). Нажмите «Откат закрытия», чтобы вернуть в незакрытые.',
  vi: 'Dòng này đang ở trạng thái đã đóng nhưng số lượng nhập chưa đạt số lượng kế hoạch. Cả hai đường đóng lệnh của MES đều yêu cầu nhập ≥ kế hoạch, nên dòng này không phải do MES đóng (thường do mini-program/hệ thống cũ ghi trực tiếp vào CSDL). Dùng «Hoàn tác đóng lệnh» để mở lại.',
  th: 'แถวนี้ถูกปิดงานแล้วแต่จำนวนรับเข้าไม่ถึงจำนวนแผนผลิต การปิดงานของ MES ทั้งสองเส้นทางต้องมีรับเข้า ≥ แผนผลิต ดังนั้นแถวนี้ไม่ได้ถูกปิดโดย MES (มักเกิดจากมินิโปรแกรม/ระบบเดิมเขียนฐานข้อมูลโดยตรง) ใช้ «แก้การปิดงาน» เพื่อเปิดกลับ',
  'zh-TW': '該行寫著已結案，但入庫數量未達排產數量 —— MES 的兩條結案路徑都要求入庫≥排產，所以這行不是 MES 結的（通常是手機端小程式/參考庫直連寫庫）。可用「結案回正」一鍵改回未結案',
};

/** 从 keyStart 起找这条 entry 的 value 结束位置(单引号字符串,支持 \\' 转义) */
function findEntryEnd(s, keyStart) {
  const keyEnd = s.indexOf("'", keyStart + 1);      // 键的收尾引号
  const colon = s.indexOf(':', keyEnd);
  const valStart = s.indexOf("'", colon);
  let i = valStart + 1;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === "'") return i;
    i++;
  }
  return -1;
}

const esc = (v) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

let changed = 0;
for (const [loc, val] of Object.entries(VAL)) {
  const f = path.join(DIR, `${loc}.js`);
  let s = fs.readFileSync(f, 'utf8');
  const at = s.indexOf(`'${OLD_KEY}'`);
  if (at < 0) { console.log(`[跳过] ${loc}:没有旧键(可能已换过)`); continue; }
  const end = findEntryEnd(s, at);
  if (end < 0) { console.log(`[失败] ${loc}:找不到 value 结束引号`); continue; }
  const entry = `'${esc(NEW_KEY)}':\n      '${esc(val)}'`;
  s = s.slice(0, at) + entry + s.slice(end + 1);
  fs.writeFileSync(f, s, 'utf8');
  console.log(`[OK] ${loc}: ${old_len(entry)}`);
  changed++;
}
console.log(`完成:改了 ${changed} 个语言包`);

function old_len(e) { return `${e.length} 字节条目`; }
