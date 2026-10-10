// _v-cascade-hint.mjs — 核对 8090 下发的入口 chunk 是否带上「级联空态说明」与元数据查找修复
const BASE = 'http://127.0.0.1:8090';
const html = await (await fetch(BASE + '/')).text();
const entry = (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
const js = await (await fetch(BASE + '/' + entry)).text();
console.log('入口 chunk: ' + entry + ' (' + (js.length / 1024).toFixed(0) + ' KB)');
const needles = ['请先选择', '下暂无候选数据', 'rpd-cascade-hint', '该「'];
for (const n of needles) console.log('  ' + (js.includes(n) ? '✅ 有' : '❌ 无') + '  ' + n);
// 元数据查找修复:明细页签优先 —— 特征串(源码按顺序出现)
const hasFix = /detail\?\.tabs/.test(js) && js.includes('真实姓名') === false;
console.log('  明细优先查找片段存在: ' + (js.includes('dataSchema') ? '✅(chunk 内含 dataSchema 引用)' : '❌'));
