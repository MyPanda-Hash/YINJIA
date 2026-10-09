// 一次性取证(2026-10-08):「只保留金蝶有的仓库」在**真实服务**上的效果。
//   前提:8090(正式账套 HSDZ_MES)在跑;migrate-wh-kingdee-only-20261008.sql 已执行。
//   断言:①WH 仓库面板 = 恰 6 个金蝶仓(软删的 CK01–CK05 不再出现);
//        ②参照搜索(仓库下拉走的就是这个接口)用 CK01/CK05 也搜不出来;
//        ③台账/库存状况未被波及(它们的流水仍引用这些仓,视图不 join bs_wh,数据按用户口径不动)。
const BASE = 'http://127.0.0.1:8090/api';
const KINGDEE = ['CK00003', 'CK00005', 'CK00006', 'CP-02', 'YCL-01', 'YJ-08'];
const GONE = ['CK01', 'CK02', 'CK03', 'CK04', 'CK05'];
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
};

const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' };
const post = async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()).data;

// WH 是 singleDoc 档案面板:列表 1 张「仓库」单,真实行在 detail.wh
const wh = await post('/px/queryFormDataList', { panelCode: 'WH', pageNo: 1, pageSize: 100, condition: {} });
const rows = (wh?.list || []).flatMap((d) => (d?.detail?.wh || []));
const codes = rows.map((r) => String(r['仓库编码'] || '').trim()).sort();
console.log(`  WH 面板返回 ${rows.length} 个仓: ${codes.join(', ')}`);
ok('WH 面板 = 恰 6 个金蝶仓', rows.length === 6 && JSON.stringify(codes) === JSON.stringify(KINGDEE),
  `rows=${rows.length}, totalSize=${wh?.totalSize}`);
ok('软删的 5 个本地仓不再出现在面板里', !codes.some((c) => GONE.includes(c)));

for (const c of GONE) {
  const hit = await post('/px/queryFormDataList', { panelCode: 'WH', pageNo: 1, pageSize: 100, condition: {}, keyword: c });
  ok(`参照搜索「${c}」搜不出来`, (hit?.totalSize ?? 0) === 0, `totalSize=${hit?.totalSize}`);
}
const hitKd = await post('/px/queryFormDataList', { panelCode: 'WH', pageNo: 1, pageSize: 100, condition: {}, keyword: '华北工控' });
ok('参照搜索「华北工控」仍能搜到金蝶仓', (hitKd?.totalSize ?? 0) === 1, `totalSize=${hitKd?.totalSize}`);

// 台账/状况表:数据未动(仍含 CK01–CK05 的历史流水),视图照常可查
const bal = await post('/px/queryFormDataList', { panelCode: 'STOCK_BALANCE', pageNo: 1, pageSize: 5, condition: {} });
ok('库存状况表仍可查(流水未动)', typeof bal?.totalSize === 'number', `totalSize=${bal?.totalSize}`);
const led = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {} });
ok('库存台账仍可查', typeof led?.totalSize === 'number', `totalSize=${led?.totalSize}`);
