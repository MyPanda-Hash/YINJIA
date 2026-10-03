/** 行尾体检 + 规范化:bat 必须 CRLF(cmd 解析 LF 会撕碎,尤其中文注释) */
const fs = require('fs');
const files = ['D:/workspace/yinjia/tools/sync-db.bat', 'D:/workspace/yinjia/start-project.bat',
  'D:/workspace/yinjia/tools/scripts/start-prod.ps1', 'D:/workspace/yinjia/tools/pull-sync.bat'];
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('缺: ' + f); continue; }
  const raw = fs.readFileSync(f, 'utf8');
  const crlf = (raw.match(/\r\n/g) || []).length;
  const lfOnly = (raw.match(/(?<!\r)\n/g) || []).length;
  console.log(`${f.split('/').pop().padEnd(18)} CRLF=${crlf}  LF-only=${lfOnly}`);
  if (lfOnly > 0) {
    const fixed = raw.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    fs.writeFileSync(f, fixed, 'utf8');
    console.log('   → 已规范化为 CRLF');
  }
}
