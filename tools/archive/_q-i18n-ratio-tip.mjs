import fs from 'node:fs';
import path from 'node:path';
const DIR = 'D:/YINJIA-main/frontend/src/i18n/locales';
const KEYS = {
  '（0 = 不允许超送；本次生效）': { en: ' (0 = not allowed; applies to this delivery)', ja: '（0 = 過納不可、今回のみ有効）', ko: ' (0 = 초과 불가, 이번만 적용)', de: ' (0 = nicht erlaubt; gilt nur diesmal)', fr: ' (0 = interdit ; valable cette fois)', es: ' (0 = no permitido; solo esta vez)', ru: ' (0 = запрещено; только сейчас)', vi: ' (0 = không cho phép; chỉ lần này)', th: ' (0 = ไม่อนุญาต; ใช้ครั้งนี้)', 'zh-TW': '（0 = 不允許超送；本次生效）' },
};
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js') && x !== 'zh-CN.js')) {
  const locale = f.replace(/\.js$/, '');
  const fp = path.join(DIR, f);
  let src = fs.readFileSync(fp, 'utf8');
  const adds = Object.entries(KEYS).filter(([k, tr]) => tr[locale] && !src.includes(`'${k}'`));
  if (!adds.length) { console.log(`${locale}: 无需补`); continue; }
  const m = src.match(/\n(\s*)'([^']+)':\s*'[^']*',\n\}/);
  const clamp = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const block = adds.map(([k, tr]) => `    '${clamp(k)}': '${clamp(tr[locale])}',`).join('\n');
  if (m) src = src.replace(m[0], `\n${block}${m[0]}`);
  fs.writeFileSync(fp, src, 'utf8');
  console.log(`${locale}: 补 ${adds.length} 条`);
}
