/** PS 脚本 BOM 体检:含中文的 .ps1 必须带 UTF-8 BOM,否则 PowerShell 5.1 按 GBK 解析 → 语法错 */
const fs = require('fs');
const path = require('path');
const roots = ['D:/workspace/yinjia', 'D:/workspace/yinjia/tools', 'D:/workspace/yinjia/tools/scripts'];
const seen = new Set();
let fixed = 0, ok = 0, ascii = 0;
const walk = (dir, depth) => {
  if (depth > 2) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|dist|archive/.test(e.name)) walk(p, depth + 1); continue; }
    if (!e.name.endsWith('.ps1') || seen.has(p)) continue;
    seen.add(p);
    const buf = fs.readFileSync(p);
    const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    const text = buf.toString('utf8');
    const hasCjk = /[\u4e00-\u9fa5]/.test(text);
    if (!hasCjk) { ascii++; continue; }
    if (hasBom) { ok++; console.log('OK    ' + p.replace('D:/workspace/yinjia/', '')); continue; }
    fs.writeFileSync(p, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), buf]));
    fixed++;
    console.log('FIXED ' + p.replace('D:/workspace/yinjia/', '') + '  (补回 UTF-8 BOM)');
  }
};
roots.forEach((r) => { if (fs.existsSync(r)) walk(r, 0); });
console.log(`\n带 BOM: ${ok}  补写: ${fixed}  纯 ASCII(无需): ${ascii}`);
