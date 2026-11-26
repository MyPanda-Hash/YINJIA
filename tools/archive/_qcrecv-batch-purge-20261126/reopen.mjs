// 把「检验数据记录明细表」里的目标行从「已完成检验」回弹为「正在检验中」(=点「修改/取消完成」)，
// 否则挂靠的检验单/暂收单不允许弃审。
import { readFileSync } from 'node:fs';
import { login, post } from './api.mjs';

const rows = JSON.parse(readFileSync('catalog-rows.json', 'utf8'));
const only = process.argv[2];           // 可选：只处理某张检验单
const dry = process.argv.includes('--dry');
await login();
for (const r of rows) {
  if (only && only !== '--dry' && r.检验单 !== only) continue;
  if (r.状态 !== '已完成检验') { console.log(`skip ${r.id} ${r.检验单} 状态=${r.状态}`); continue; }
  if (dry) { console.log(`dry 会回弹 id=${r.id} ${r.检验单} ${r.物料}/${r.批次}`); continue; }
  const res = await post('/px/callButton', {
    panelCode: 'QC_CATALOG', buttonName: '修改',
    formData: { 编号: r.目录单, id: r.id }, buttonParam: {},
  });
  console.log(res.body.code === 200
    ? `OK 回弹 id=${r.id} ${r.检验单} → ${JSON.stringify(res.body.data)}`
    : `FAIL id=${r.id} ${r.检验单}: ${res.body.message}`);
}
