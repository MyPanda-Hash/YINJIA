#!/usr/bin/env node
/**
 * _probe-fourdoc-local-vs-server.mjs — 四单面板「同口径投影」两边对比(只读)
 *
 * 为什么这样比:getPanelConfig 的 dataSchema.fields 是渲染投影(只有 dataName/dataType/width),
 * 对不上 yj_field 的 col_name/place/seq,不能直接当基线闸用。但**同一投影在本地与服务器各自取一次**,
 * 差集就是可比的事实:两边同一代 → 集合一致;差集非空 → 哪一代缺/多了什么都看得见。
 *
 * 用法: node tools/archive/_deploy-20261008/_probe-fourdoc-local-vs-server.mjs
 */
const LOCAL = 'http://127.0.0.1:8090';
const SERVER = 'http://36.140.66.163:8090';
const PANELS = ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN'];

async function pull(base) {
  const lg = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }), signal: AbortSignal.timeout(20000),
  });
  const token = (await lg.json()).data.token;
  const out = {};
  for (const p of PANELS) {
    const r = await fetch(base + '/api/px/getPanelConfig?panelCode=' + p, {
      headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000),
    });
    const f = (await r.json()).data?.dataSchema?.fields ?? [];
    out[p] = f.map((x) => ({ n: x.dataName, t: x.dataType ?? '', w: x.width ?? '' }));
  }
  return out;
}

const [loc, srv] = await Promise.all([pull(LOCAL), pull(SERVER)]);
let bad = 0;
for (const p of PANELS) {
  const L = loc[p], S = srv[p];
  const ln = new Set(L.map((x) => x.n)), sn = new Set(S.map((x) => x.n));
  const onlyLocal = [...ln].filter((x) => !sn.has(x));
  const onlyServer = [...sn].filter((x) => !ln.has(x));
  const typeDiff = L.filter((x) => {
    const m = S.find((y) => y.n === x.n);
    return m && (m.t !== x.t || String(m.w) !== String(x.w));
  });
  const same = onlyLocal.length === 0 && onlyServer.length === 0 && typeDiff.length === 0;
  console.log(`${p.padEnd(13)} 本地 ${String(L.length).padStart(3)} 项 / 服务器 ${String(S.length).padStart(3)} 项  | 仅本地有 ${onlyLocal.length} · 仅服务器有 ${onlyServer.length} · 类型/宽度不同 ${typeDiff.length}  ${same ? '✅ 同代' : '⚠ 有差'}`);
  if (onlyLocal.length) console.log('     仅本地: ' + onlyLocal.slice(0, 12).join(', ') + (onlyLocal.length > 12 ? ` …(+${onlyLocal.length - 12})` : ''));
  if (onlyServer.length) console.log('     仅服务器: ' + onlyServer.slice(0, 12).join(', ') + (onlyServer.length > 12 ? ` …(+${onlyServer.length - 12})` : ''));
  typeDiff.slice(0, 6).forEach((x) => {
    const m = S.find((y) => y.n === x.n);
    console.log(`     类型/宽度: ${x.n} 本地(${x.t},w=${x.w}) vs 服务器(${m.t},w=${m.w})`);
  });
  if (!same) bad++;
}
console.log(`\n四个面板中 ${bad} 个存在差异。0 = 两边同代(四单那 3 条脚本在服务器基本是空操作);`);
console.log('>0 = 存在代差 —— 回正脚本会把服务器改成基线(yj_field 台账口径),需你确认是否有意为之。');
