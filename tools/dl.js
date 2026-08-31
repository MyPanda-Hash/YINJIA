// 用 Node 的 TLS 栈下载文件(绕过损坏的 Schannel)
// 用法: node dl.js <url> <outPath>
const fs = require('fs');
const [url, outPath] = process.argv.slice(2);
(async () => {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) { console.error(`HTTP ${res.status} ${res.statusText}`); process.exit(1); }
  const total = +(res.headers.get('content-length') || 0);
  let got = 0;
  const out = fs.createWriteStream(outPath);
  for await (const chunk of res.body) {
    out.write(chunk); got += chunk.length;
    if (total) process.stdout.write(`\r${(got / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`);
  }
  out.end();
  await new Promise(r => out.on('close', r));
  console.log(`\nDONE ${(got / 1048576).toFixed(1)} MB -> ${outPath}`);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
