#!/usr/bin/env node
/**
 * _i18n-qcrecv-split.cjs — 暂收单「生单」按商品档案分流(2026-10-05)新增 UI 文案的译名批量注入。
 *
 * 起因:PanelxList.onButton 新增两处显示文案(生单结果回显 / 未登记商品提示),
 * 按 AGENTS「多语言强制规范」需要 10 语言译名(中文原文即 key,不写 en 会回落中文)。
 * 惯例:语言包批量写入一律走 Node 脚本(PS 经命令通道传 CJK 不可靠,见开发与质量 §5.5 C1)。
 *
 * 锚点:各语言包都已登记的 '生成采购入库单'(该动作本次被合并掉,条目保留不动),
 * 在它后面各插两行 —— 位置与既有"采购链生单"词条聚在一起,便于日后查找。
 *
 * 幂等:已存在同名 key 则跳过。
 * 用法:node tools/archive/_i18n-qcrecv-split.cjs [--check]
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const ANCHOR = "'生成采购入库单':";

/** 中文原文(key,与 .vue 里 tt('…') 逐字一致) → 各语言译名 */
const NEW_KEYS = [
  {
    key: '请在列表页继续填写',
    texts: {
      en: 'Continue filling in on the list page',
      'zh-TW': '請在列表頁繼續填寫',
      ja: '続きは一覧画面で入力してください',
      ko: '목록 화면에서 계속 입력하세요',
      de: 'Bitte auf der Listenansicht weiter ausfüllen',
      es: 'Continúe rellenando en la lista',
      fr: 'Continuez la saisie dans la liste',
      ru: 'Продолжите заполнение в списке',
      vi: 'Tiếp tục nhập ở trang danh sách',
      th: 'กรอกข้อมูลต่อในหน้ารายการ',
    },
  },
  {
    key: '商品档案未登记的商品按免检（否）处理',
    texts: {
      en: 'Items not registered in the item master are treated as inspection-free (No)',
      'zh-TW': '商品檔案未登記的商品以免檢（否）處理',
      ja: '商品マスタ未登録の商品は免検（否）として処理します',
      ko: '품목 마스터에 미등록된 품목은 면검(아니오)으로 처리됩니다',
      de: 'Nicht im Artikelstamm geführte Artikel gelten als prüffrei (Nein)',
      es: 'Los artículos no registrados en el maestro se tratan como exentos de inspección (No)',
      fr: 'Les articles non enregistrés dans le référentiel sont traités comme dispensés de contrôle (Non)',
      ru: 'Позиции, отсутствующие в справочнике номенклатуры, считаются без проверки (Нет)',
      vi: 'Mặt hàng chưa đăng ký trong danh mục được xử lý là miễn kiểm (Không)',
      th: 'สินค้าที่ไม่ลงทะเบียนในทะเบียนสินค้าจะถือเป็นยกเว้นการตรวจ (ไม่)',
    },
  },
];

const NAME_BY_FILE = {
  'en.js': 'en',
  'zh-TW.js': 'zh-TW',
  'ja.js': 'ja',
  'ko.js': 'ko',
  'de.js': 'de',
  'es.js': 'es',
  'fr.js': 'fr',
  'ru.js': 'ru',
  'vi.js': 'vi',
  'th.js': 'th',
};

const checkOnly = process.argv.includes('--check');
let files = 0;
let inserted = 0;
let skipped = 0;

for (const [file, locale] of Object.entries(NAME_BY_FILE)) {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) {
    console.log(`[skip] ${file} 不存在`);
    continue;
  }
  // 语言包在仓库里一律 LF(.gitattributes 未给 *.js 定 eol,HEAD 里就是 LF)。
  // 工作区若被某个工具改成了 CRLF,整个文件会被 git 判成"整篇重写"(实测 4216 行假改动)——
  // 故本脚本顺手归一为 LF,让 diff 只剩真正的词条变化。
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const anchorAt = lines.findIndex((l) => l.includes(ANCHOR));
  if (anchorAt < 0) {
    console.log(`[FAIL] ${file} 找不到锚点 ${ANCHOR}`);
    process.exitCode = 1;
    continue;
  }
  const add = [];
  for (const entry of NEW_KEYS) {
    const decl = `'${entry.key}':`;
    if (lines.some((l) => l.trim().startsWith(decl))) {
      skipped++;
      continue;
    }
    const text = entry.texts[locale];
    if (!text) {
      console.log(`[FAIL] ${file} 缺 ${locale} 译名:${entry.key}`);
      process.exitCode = 1;
      continue;
    }
    if (/['\\]/.test(text)) {
      console.log(`[FAIL] ${file} 译名含引号/反斜杠,需手工转义:${text}`);
      process.exitCode = 1;
      continue;
    }
    add.push(`    ${decl} '${text}',`);
  }
  if (!add.length) {
    if (!checkOnly) fs.writeFileSync(full, lines.join('\n'), 'utf8');   // 只为把 CRLF 归一回 LF
    console.log(`[ok]   ${file} 词条齐全`);
    continue;
  }
  lines.splice(anchorAt + 1, 0, ...add);
  if (!checkOnly) fs.writeFileSync(full, lines.join('\n'), 'utf8');
  files++;
  inserted += add.length;
  console.log(`[add]  ${file} +${add.length}`);
}

console.log(`\n${checkOnly ? '[check] ' : ''}改动文件 ${files} 个 / 新增词条 ${inserted} 条 / 已存在跳过 ${skipped} 条`);
