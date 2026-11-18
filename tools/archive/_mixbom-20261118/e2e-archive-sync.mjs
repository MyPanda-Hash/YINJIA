/**
 * E2E(测试账套):验证「工艺清单归档 → 基础数据清单」两个新链路
 *   ① 组装工艺清单 RD_ASM_PROC 归档 → 组装物料清单 ASM_BOM(bs_asm_bom)
 *   ② 烧结工艺清单 RD_MOLD_PROC 归档 → 混料物料清单 MIX_BOM(bs_mix_bom) 烧结类型=烧结工艺清单
 *   ③ X烧结工艺清单 RD_X_SINTER 归档 → 混料物料清单 MIX_BOM 烧结类型=X烧结工艺清单
 * 走的是真接口(保存→提交审批→审批通过),因此覆盖 ButtonService.markArchived 这条唯一归档入口。
 * 造数走测试库(YJ_TEST),脚本末尾打印清理用的单据号。
 */
const base = process.env.BASE || 'http://127.0.0.1:8091';

const login = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' })
}).then(r => r.json());
const token = login.data?.token;
if (!token) { console.error('LOGIN FAIL', JSON.stringify(login)); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
const call = async (panelCode, buttonName, formData = {}) => {
  const r = await fetch(base + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode, buttonName, formData })
  });
  const j = await r.json();
  if (j.code !== 200) throw new Error(`${panelCode}/${buttonName} -> ${r.status} ${JSON.stringify(j)}`);
  return j.data || {};
};

const log = (...a) => console.log(...a);
const results = [];

async function flow(label, panelCode, form) {
  log(`\n=== ${label} :: ${panelCode} ===`);
  const saved = await call(panelCode, '保存', form);
  const no = saved['编号'] || saved['单据编号'];
  log('保存 →', no, '状态', saved['单据状态']);
  // 文书面板(含研发三张工艺清单)保存=自动提交审批;个别面板保存是草稿,则补一次提交。
  if (saved['单据状态'] === '草稿') {
    const sub = await call(panelCode, '提交审批', { ...form, 编号: no });
    log('提交审批 →', sub['单据状态'] || JSON.stringify(sub).slice(0, 120));
  }
  const app = await call(panelCode, '审批通过', { ...form, 编号: no });
  log('审批通过 →', app['单据状态'] || JSON.stringify(app).slice(0, 120));
  results.push({ label, panelCode, no });
  return no;
}

const stamp = Date.now().toString().slice(-6);
const prodA = `E2EASM-${stamp}`;
const prodM = `E2EMIX-${stamp}`;
const prodX = `E2EXS-${stamp}`;

// ① 组装工艺清单:BOM 表两行
const asmNo = await flow('组装工艺清单', 'RD_ASM_PROC', {
  单据日期: '2026-11-18',
  产品编号: prodA,
  产品名称: 'E2E组装测试产品',
  密级: '保密',
  使用范围: '银嘉内部',
  版本号: 'V-E2E-01',
  detail: { items: [
    { 表区: '物料清单', 序号: '1', 物料编号: 'YJ-TS-033', 物料名: 'PP棉', 物料规格: '40±1*30+1*497.5±0.5mm', 用量: '1' },
    { 表区: '物料清单', 序号: '2', 物料编号: 'YJ-SX-065', 物料名: '端盖', 物料规格: '蓝色水卫适（无棉)', 用量: '2' },
  ] },
});

// ② 烧结工艺清单:配方表两行
const moldNo = await flow('烧结工艺清单', 'RD_MOLD_PROC', {
  单据日期: '2026-11-18',
  产品编号: prodM,
  产品名称: 'E2E烧结测试产品',
  密级: '保密',
  使用范围: '银嘉内部',
  版本号: 'V-E2E-02',
  detail: { items: [
    { 表区: '配方表', 序号: '1', 物料种类: '功能料-粉末', 物料编号: 'YJ-KG-C12', 物料名称: '阻垢料', 实际添加比例: '32.43%', 单支物料含量: '324', 设计添加量: '32.43%' },
    { 表区: '配方表', 序号: '2', 物料种类: '炭粉', 物料编号: 'YJ-HKK-007', 物料名称: '竹炭活性炭80-200', 实际添加比例: '1.23%', 单支物料含量: '231', 设计添加量: '1.23%' },
  ] },
});

// ③ X烧结工艺清单:配方表两行
const xNo = await flow('X烧结工艺清单', 'RD_X_SINTER', {
  单据日期: '2026-11-18',
  产品编号: prodX,
  产品名称: 'E2E X烧结测试产品',
  密级: '保密',
  使用范围: '银嘉内部',
  版本号: 'V-E2E-03',
  detail: { items: [
    { 表区: '配方表', 序号: '1', 物料种类: '功能料-粉末', 物料编号: 'YJ-KG-C12', 物料名称: '阻垢料', 添加比例: '45', 单支含量g: '12.5', 设计添加量: '45' },
    { 表区: '配方表', 序号: '2', 物料种类: '胶粉', 物料编号: 'YJ-HKK-007', 物料名称: '竹炭活性炭80-200', 添加比例: '2', 单支含量g: '3.2', 设计添加量: '2' },
  ] },
});

log('\n=== 单据号(清理用) ===');
for (const r of results) log(`${r.panelCode}\t${r.no}\t产品 ${r.label === '组装工艺清单' ? prodA : r.label === '烧结工艺清单' ? prodM : prodX}`);
