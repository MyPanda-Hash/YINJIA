// 一次性验证探针:金蝶对齐后 en 词典下发(tt() 取词通道)+ 面板列标签 + 查询
const BASE = 'http://127.0.0.1:8090/api';

async function main() {
  const lr = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  if (lr.code !== 200) throw new Error('login failed: ' + lr.message);
  const token = lr.data.token;
  console.log('[login] ok');

  // 1) 词典接口:新标签 en 译名(tt() 取词通道,命中即前端列头可翻译)
  const keys = ['编码', '客户分类', '供应商分类', '详细地址', '开票税号', '价格等级', '采购员', '条形码',
    '数量小数位', '结算方式', '商品分类', '币别', '是否叶子节点', '上级编码', '币别符号', '汇率类型',
    '金额小数位', '单价小数位', '是否默认', '级次', '开户银行'];
  const dr = await fetch(`${BASE}/locale/dict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Accept-Language': 'en' },
    body: JSON.stringify({ locale: 'en', keys }),
  }).then((r) => r.json());
  const dict = (dr.data && dr.data.dict) || {};
  const missing = keys.filter((k) => !dict[k] || dict[k] === k);
  for (const k of keys) console.log('  %s -> %s', k, dict[k] || '(missing)');
  console.log('[dict] missing=%d (期望0)', missing.length);

  // 2) 各面板 en 元数据(列标签保持中文键,面板名走译名通道;列头翻译由前端 tt() 用 1) 的词典)
  for (const pc of ['CUR', 'SETTLE', 'CUSGRP', 'SUPGRP', 'MATGRP', 'KHDA', 'GFDA', 'INV', 'UOM']) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, {
      headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'en' },
    }).then((r) => r.json());
    if (cfg.code !== 200) { console.log('[en %s] FAIL %s', pc, cfg.message); missing.push(pc); continue; }
    const m = cfg.data.metadata;
    const cols = m.panelPageDto.tablePages[0].gridTabs[0].columns;
    console.log('[en %s] panel=%s(%s) cols=%d', pc, m.panelName, m.panelNameEn || '-', cols.length);
  }

  // 3) 查询通路(列缺失会在此暴露)
  for (const pc of ['SETTLE', 'CUSGRP', 'SUPGRP', 'MATGRP', 'CUR', 'KHDA', 'GFDA', 'INV', 'UOM']) {
    const q = await fetch(`${BASE}/px/queryFormDataList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: pc, pageNo: 1, pageSize: 5 }),
    }).then((r) => r.json());
    if (q.code !== 200) { console.log('[query %s] FAIL %s', pc, q.message); missing.push(pc); continue; }
    console.log('[query %s] ok total=%s', pc, q.data.totalSize);
  }

  if (missing.length > 0) { console.log('RESULT: FAIL (%d)', missing.length); process.exit(1); }
  console.log('RESULT: ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
