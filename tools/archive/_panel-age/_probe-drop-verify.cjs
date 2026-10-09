/**
 * _probe-drop-verify.cjs — 「下架 13 面板」的端到端验证(2026-10-08/09)
 *
 * ① 已下架的 13 张:接口应当**取不到配置**(面板行已删)⇒ 期望 code != 200 / 404;
 * ② 保留的出入库单 + 明细/统计 + 库存三表 + 委外加工单:配置与取数都必须 200;
 * ③ 顺带核对「面板总数」:登录后取一次角色面板清单/或直接看错误面,不做断言。
 *
 * 用法: node tools/archive/_panel-age/_probe-drop-verify.cjs http://127.0.0.1:8090
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';

const DROPPED = ['PU_REQ',
  'OTHER_IN', 'OTHER_IN_DETAIL', 'OTHER_IN_STATS',
  'OTHER_OUT', 'OTHER_OUT_DETAIL', 'OTHER_OUT_STATS',
  'OUTSOURCE_IN', 'OUTSOURCE_IN_DETAIL', 'OUTSOURCE_IN_STATS',
  'OUTSOURCE_ISSUE', 'OUTSOURCE_ISSUE_DETAIL', 'OUTSOURCE_ISSUE_STATS'];

const KEPT = ['PURCHASE_IN', 'PURCHASE_IN_DETAIL', 'PURCHASE_IN_STATS',
  'SALE_OUT', 'SALE_OUT_DETAIL', 'SALE_OUT_STATS',
  'MATERIAL_OUT', 'MATERIAL_OUT_DETAIL', 'MATERIAL_OUT_STATS',
  'FINISH_IN', 'FINISH_IN_DETAIL', 'FINISH_IN_STATS',
  'QC_RECV', 'QC_RETURN', 'QC_INSP', 'PU_ORDER', 'SO_ORDER', 'OUTSOURCE_ORDER',
  'STOCK_BALANCE', 'STOCK_SUMMARY', 'STOCK_LEDGER'];

const get = async (path, token) => {
  const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
};
const post = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
};

(async () => {
  const login = await post('/auth/login', { userName: 'admin', password: '123456' }, null);
  const token = login.json?.data?.token;
  if (!token) { console.log('FAIL 登录失败:' + (login.json?.message || login.text).slice(0, 120)); process.exitCode = 1; return; }
  console.log('登录 OK');

  let pass = 0, fail = 0;
  console.log('\n===== ① 已下架面板:应取不到配置 =====');
  for (const pc of DROPPED) {
    const cfg = await get('/px/getPanelConfig?panelCode=' + pc, token);
    const gone = cfg.json?.code !== 200;
    console.log(`  ${gone ? 'PASS' : 'FAIL'}  ${pc.padEnd(22)} http=${cfg.status} code=${cfg.json?.code} ${gone ? '' : '(!! 仍能取到配置)'}`);
    gone ? pass++ : fail++;
  }

  console.log('\n===== ② 保留面板:配置 + 取数都应 200 =====');
  for (const pc of KEPT) {
    const cfg = await get('/px/getPanelConfig?panelCode=' + pc, token);
    if (cfg.status !== 200 || cfg.json?.code !== 200) {
      console.log(`  FAIL  ${pc.padEnd(22)} 配置失败 http=${cfg.status} ${(cfg.json?.message || cfg.text || '').slice(0, 100)}`);
      fail++; continue;
    }
    const name = cfg.json?.data?.metadata?.panelName || '(无)';
    const q = await post('/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token);
    if (q.status !== 200 || q.json?.code !== 200) {
      console.log(`  FAIL  ${pc.padEnd(22)} [${name}] 取数失败 http=${q.status} ${(q.json?.message || q.text || '').slice(0, 100)}`);
      fail++; continue;
    }
    const rows = (q.json?.data?.list || q.json?.data?.rows || []).length;
    console.log(`  PASS  ${pc.padEnd(22)} [${name}] 取数 OK(${rows} 行)`);
    pass++;
  }

  console.log(`\n===== 汇总:PASS ${pass} / FAIL ${fail} =====`);
  if (fail) process.exitCode = 1;
})();
