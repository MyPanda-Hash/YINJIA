/**
 * 远程服务器(测试/正式实例)体检:来料检验单/送料暂收单的列表里还有没有
 * "空白行 + 已审核"的重号假象;并打印最新几张单号。
 *
 * 用法:node tools/archive/_probe-add-newdoc-20261019/_remote-check.mjs [host:port]
 */
const host = process.argv[2] || '36.140.66.163:8090';
const API = `http://${host}/api`;
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
if (!login?.data?.token) { console.error('登录失败', JSON.stringify(login).slice(0, 200)); process.exit(2); }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };

for (const panel of ['QC_RECV', 'QC_INSP']) {
  const res = await (await fetch(API + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, condition: {}, pageNo: 1, pageSize: 300 }),
  })).json();
  const list = res?.data?.list || [];
  const nums = new Set();
  let dup = 0, blankAudited = 0;
  const samples = [];
  for (const r of list) {
    const no = r['编号'];
    if (nums.has(no)) dup++;
    nums.add(no);
    const blank = !r['供应商'] && !r['采购订单号'] && !r['批次号'] && !r['备注'];
    if (blank && r['单据状态'] === '已审核') {
      blankAudited++;
      if (samples.length < 6) samples.push(`${no} ${r['单据日期']} ${r['单据状态']}`);
    }
  }
  console.log(`== ${host} ${panel}: total=${res?.data?.totalSize}, 本页=${list.length}, 同页重号=${dup}, 空白且已审核=${blankAudited}`);
  for (const s of samples) console.log('   ', s);
  const head = list.slice(0, 6).map((r) => `${r['编号']}(${r['单据日期'] || '-'},${r['单据状态']})`).join(' ');
  console.log('   最新6张:', head);
}
