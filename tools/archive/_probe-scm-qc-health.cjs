/**
 * 智能供应链 + 品质 面板健康探针:逐个 getPanelConfig + queryFormDataList,报出 500/异常
 * 判定"模块能否正确运行"的客观依据。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SCM = ['PU_REQ', 'PU_ORDER', 'PURCHASE_IN', 'SO_ORDER', 'SALE_OUT', 'QC_RECV', 'SL_RECV',
  'STOCK_STATUS', 'STOCK_LEDGER', 'STOCK_BALANCE', 'STOCK_SUMMARY', 'MATERIAL_OUT', 'FINISH_IN',
  'OUTSOURCE_ORDER', 'OUTSOURCE_ISSUE', 'SAMPLE_REQ'];
const QC = ['QC_INSP', 'QC_RETURN', 'QC_CATALOG', 'INSP_REQ', 'QC_BHG', 'QC_BHC', 'QC_BHZ',
  'QC_SCY', 'QC_SCP', 'QC_JJF', 'QC_TC_IN', 'QC_INSP_REC', 'SPEC'];
const get = async (path, token) => {
  const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
};
const post = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
};
(async () => {
  const login = await post('/auth/login', { userName: 'admin', password: '123456' }, null);
  const token = login.json?.data?.token;
  if (!token) { console.log('登录失败'); process.exitCode = 1; return; }
  const bad = [];
  for (const [group, list] of [['供应链', SCM], ['品质', QC]]) {
    console.log('===== ' + group + ' =====');
    for (const pc of list) {
      const cfg = await get('/px/getPanelConfig?panelCode=' + pc, token);
      const name = cfg.json?.data?.metadata?.panelName || '(无)';
      if (cfg.status !== 200 || cfg.json?.code !== 200) {
        console.log(`  ✗ ${pc.padEnd(18)} 配置失败 http=${cfg.status} ${(cfg.json?.message || cfg.text || '').slice(0, 90)}`);
        bad.push(pc + '(config)');
        continue;
      }
      const q = await post('/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token);
      if (q.status !== 200 || q.json?.code !== 200) {
        console.log(`  ✗ ${pc.padEnd(18)} [${name}] 取数失败 http=${q.status} ${(q.json?.message || q.text || '').slice(0, 110)}`);
        bad.push(pc + '(query)');
      } else {
        console.log(`  ✓ ${pc.padEnd(18)} [${name}] 行=${q.json?.data?.totalSize ?? 0}`);
      }
    }
  }
  console.log('\n异常面板 ' + bad.length + ' 个' + (bad.length ? ': ' + bad.join(', ') : ' —— 全部正常'));
  if (bad.length) process.exitCode = 1;
})();
