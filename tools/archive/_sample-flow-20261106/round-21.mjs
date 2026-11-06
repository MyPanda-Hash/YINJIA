const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const log = (...a) => console.log(...a);
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.waitForTimeout(2500);
const out = await p.evaluate(async () => {
  const post = async (url, body, token) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
    let j = null; try { j = await r.json(); } catch (e) { j = { raw: await r.text() }; }
    return { status: r.status, body: j };
  };
  const get = async (url, token) => {
    const r = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    let j = null; try { j = await r.json(); } catch (e) { j = { raw: await r.text() }; }
    return { status: r.status, body: j };
  };
  const login = async (u, pw) => (await post('/api/auth/login', { userName: u, password: pw })).body?.data?.token;
  const admin = await login('admin', '123456');
  // 1) 建一个非管理员账号（已存在则跳过）
  const mkUser = await post('/api/sys/user/save', { userName: 'sampler', realName: '打样员', password: '123456', roleId: 2, enabled: 1 }, admin);
  const sampler = await login('sampler', '123456');
  // 2) 列表：sampler vs admin
  const listAs = async (tok) => {
    const r = await post('/api/px/queryFormDataList', { panelCode: 'RD_SAMPLE_EXT', condition: {}, pageNo: 1, pageSize: 50 }, tok);
    const list = r.body?.data?.list || [];
    return { status: r.status, total: r.body?.data?.totalSize, docs: list.map((d) => d['单据编号'] || d['编号']) };
  };
  const beforeSampler = await listAs(sampler);
  const beforeAdmin = await listAs(admin);
  // 3) sampler 直接按单号取 admin 的单据
  const peek = await get('/api/px/getFormDescriptor?panelCode=RD_SAMPLE_EXT&code=' + encodeURIComponent(beforeAdmin.docs[0]), sampler);
  // 4) sampler 建自己的单
  const save = await post('/api/px/callButton', {
    panelCode: 'RD_SAMPLE_EXT', buttonName: '保存',
    formData: { 单据日期: '2026-11-06', 客户名称: '惠州市芯悦纯净设备有限公司', 费用: '120',
      detail: { items: [{ 产品整体规格: 'sampler 的样品行', 样品数量: '3' }] } },
    buttonParam: {},
  }, sampler);
  const afterSampler = await listAs(sampler);
  const afterAdmin = await listAs(admin);
  return { mkUser: mkUser.status, samplerToken: !!sampler, beforeSampler, beforeAdmin,
    peek: { status: peek.status, msg: peek.body?.message || peek.body?.msg || '' },
    save: { status: save.status, code: save.body?.code, msg: save.body?.message || save.body?.msg || '' },
    afterSampler, afterAdmin };
});
log(JSON.stringify(out, null, 1));
await task.finish({ keep: [] });
process.exit(0);
