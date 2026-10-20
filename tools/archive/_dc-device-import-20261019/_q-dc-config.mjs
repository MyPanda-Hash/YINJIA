/**
 * 只读:远端 /api/dc/config 的设备总数与「非 LW-」设备清单,用于解释页面 132 vs 导入 129。
 * 用法: node _q-dc-config.mjs http://36.140.66.163:8090 admin 123456
 */
const [base = 'http://36.140.66.163:8090', user = 'admin', pass = '123456', factory = ''] = process.argv.slice(2);

async function req(path, opts = {}) {
  const r = await fetch(base + path, opts);
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`); }
  return j;
}

const login = await req('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: user, password: pass, ...(factory ? { factory } : {}) }),
});
const token = login?.data?.token;
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(2); }
const auth = { Authorization: 'Bearer ' + token };

const cfg = await req('/api/dc/config', { headers: auth });
const k = cfg?.data?.kpis ?? {};
const devs = cfg?.data?.devices ?? [];
console.log('base =', base);
console.log('kpis =', JSON.stringify(k));
console.log('devices.length =', devs.length);
const lw = devs.filter((d) => /^LW-\d{3}$/.test(d.code));
console.log('LW-### 台数 =', lw.length);
const other = devs.filter((d) => !/^LW-\d{3}$/.test(d.code));
console.log('非 LW 台数 =', other.length);
for (const d of other) {
  console.log(`  ${d.code} | ${d.name} | ${d.type} | 状态=${d.status} | 在线=${d.online} | 已作废=${d.cancel ?? '-'} | 建档=${d.createdAt ?? '-'}`);
}
const byType = {};
for (const d of other) byType[d.type] = (byType[d.type] || 0) + 1;
console.log('非 LW 按类型 =', JSON.stringify(byType));
