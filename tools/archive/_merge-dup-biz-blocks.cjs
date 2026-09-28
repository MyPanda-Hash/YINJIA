#!/usr/bin/env node
/**
 * _merge-dup-biz-blocks.cjs — 一次性修复:语言包双顶层 `biz:` 键合并(2026-10-14)。
 *
 * 背景:frontend/src/i18n/locales/{en,zh-TW,ja,ko,es,fr,de,ru,vi,th}.js 曾由
 * "自动合并(ours+theirs 词条并集)"脚本生成,产物里出现**两个顶层 `biz:` 键**——
 * JS 对象字面量语义后者胜出,第一个块(几千条人工词条)解析时被静默丢弃,
 * 英文界面一直靠 tt() miss→机翻管线兜底(node eval 实证 obj.biz['工单排产']===undefined)。
 *
 * 修法(纯文本拼接,语义零变化):把第二块的**内部条目**原样搬到第一块闭括号之前。
 * 两块若有同名键,搬运后第二块的条目排后 ⇒ 仍是"后者胜出",与修复前运行时行为一致;
 * 同一对象内重复键在 ES2015+ 合法。逐包验证:eval 解析通过 + biz 词条数显著回升
 * + 抽查键命中,任一失败则**不写回**(该包保持原样,git 兜底)。
 *
 * 用法(node ≥18):node tools/archive/_merge-dup-biz-blocks.cjs [--check]
 *   --check 只诊断不写回。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th'];
const FRONT = path.resolve(__dirname, '../../frontend/src/i18n/locales');
const CHECK_ONLY = process.argv.includes('--check');

/** 在 mini 词法(跳过字符串/注释)下找与 open 处 `{` 配对的 `}` 下标;找不到返回 -1 */
function matchBrace(text, open) {
  let depth = 0, i = open, mode = 0; // 0 普通 1 单引号串 2 双引号串 3 行注释 4 块注释
  while (i < text.length) {
    const c = text[i], d = i + 1 < text.length ? text[i + 1] : '';
    if (mode === 0) {
      if (c === "'") mode = 1;
      else if (c === '"') mode = 2;
      else if (c === '/' && d === '/') { mode = 3; i++; }
      else if (c === '/' && d === '*') { mode = 4; i++; }
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return i; }
    } else if (mode === 1) {
      if (c === '\\') i++;
      else if (c === "'" || c === '\n') mode = 0;
    } else if (mode === 2) {
      if (c === '\\') i++;
      else if (c === '"' || c === '\n') mode = 0;
    } else if (mode === 3) {
      if (c === '\n') mode = 0;
    } else if (mode === 4) {
      if (c === '*' && d === '/') { mode = 0; i++; }
    }
    i++;
  }
  return -1;
}

/** eval 解析语言包(剥掉 export default);失败返回 { ok:false } */
function parsePack(text) {
  try {
    const obj = eval('(' + text.replace(/export default/, '') + ')');
    return { ok: true, obj, count: Object.keys((obj && obj.biz) || {}).length };
  } catch (e) {
    return { ok: false, err: e.message, count: -1 };
  }
}

let fail = 0;
for (const loc of LOCALES) {
  const file = path.join(FRONT, loc + '.js');
  const text = fs.readFileSync(file, 'utf8');

  // 诊断:其它顶层键是否也有重复(只报不修)
  for (const sec of ['locale', 'common', 'topbar', 'login']) {
    const n = [...text.matchAll(new RegExp('^ {2}' + sec + ': \\{', 'gm'))].length;
    if (n > 1) console.log(`  [WARN] ${loc}.js 顶层 ${sec}: 也有 ${n} 个重复块(本次不修,需另查)`);
  }

  const hits = [...text.matchAll(/^ {2}biz: \{/gm)];
  if (hits.length !== 2) {
    console.log(`${loc}.js: biz 块数=${hits.length},非 2 跳过`);
    if (hits.length > 2) fail++;
    continue;
  }
  const i1 = hits[0].index, i2 = hits[1].index;
  const open1 = text.indexOf('{', i1), open2 = text.indexOf('{', i2);
  const close1 = matchBrace(text, open1), close2 = matchBrace(text, open2);
  if (close1 < 0 || close2 < 0 || !(close1 < i2 && i2 < close2)) {
    console.log(`${loc}.js: 括号配对异常(${close1}/${close2}),跳过`); fail++; continue;
  }

  const before = parsePack(text);
  if (!before.ok) { console.log(`${loc}.js: 原文件本就解析失败(${before.err}),跳过`); fail++; continue; }

  const inner2 = text.slice(open2 + 1, close2);
  let rest = text.slice(close2 + 1);
  if (rest.startsWith(',')) rest = rest.slice(1);
  let out = text.slice(0, close1) + inner2 + text.slice(close1, i2) + rest;
  out = out.replace(/\n[ \t]*\n(\})\s*$/, '\n$1'); // 收尾清理:合并产生的 EOF 孤行(仅文件末尾)

  const after = parsePack(out);
  const recovered = after.ok && after.count > before.count;
  if (!after.ok) { console.log(`${loc}.js: 合并后解析失败(${after.err}),未写回`); fail++; continue; }
  if (!recovered) { console.log(`${loc}.js: 词条数未回升(${before.count}→${after.count}),未写回`); fail++; continue; }

  const spot = after.obj.biz['工单排产'] !== undefined || after.obj.biz['转领料'] !== undefined;
  console.log(`${loc}.js: ${before.count} → ${after.count} 条(+${after.count - before.count}),抽查第一块键: ${spot ? '命中' : '未命中(该包第一块本就没有此键,以词条数回升为准)'}`);
  if (!CHECK_ONLY) fs.writeFileSync(file, out, 'utf8');
}
console.log(CHECK_ONLY ? '[check-only 未写回]' : '[done]');
process.exit(fail ? 1 : 0);
