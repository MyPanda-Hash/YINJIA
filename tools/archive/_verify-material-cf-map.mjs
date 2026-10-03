// 离线自检:商品档案(BD_MATERIAL)来料检验映射 —— 金蝶自定义字段键登记后 mapArchive 是否取得到值
// 不连金蝶、不写库,纯映射逻辑。用法:node tools/archive/_verify-material-cf-map.mjs
import { DOCS } from '../../deploy/sync-core.mjs';

const doc = DOCS.find((d) => d.code === 'BD_MATERIAL');
const base = { id: '1', number: 'YJ-XH-001', name: '鑫恒（80-250）', enable: '1', check_type: '1' };

const cases = [
  ['真实账套第 4 个自定义字段(对象形态)', { ...base, custom_field: { custom_field__1__62tvoyr1j4fa: '是' } }, '是'],
  ['真实账套键 + JSON 字符串形态', { ...base, custom_field: '{"custom_field__1__62tvoyr1j4fa":"是"}' }, '是'],
  ['沙箱键(旧)', { ...base, custom_field: { custom_field__1__62jiaob3z7yj97: '是' } }, '是'],
  ['该字段为空', { ...base, custom_field: { custom_field__1__62tvoyr1j4fa: '' } }, null],
  ['没有 custom_field 容器', { ...base }, null],
  ['老字段(规格/装箱量)不该被当成来料检验',
    { ...base, custom_field: { custom_field__1__4swgci5cr1vb: '57*21*66.5', custom_field__1__6jiafyhnnjic0w: '108支/箱' } }, null],
];

let bad = 0;
for (const [label, d, want] of cases) {
  const got = doc.mapArchive(d, {}).来料检验;
  const ok = got === want;
  if (!ok) bad++;
  console.log(`%s ${label.padEnd(44)} 期望 %s 实得 %s`, ok ? '✓' : '✗', JSON.stringify(want), JSON.stringify(got));
}
// 顺带看两个标准字段没被带坏
const m = doc.mapArchive({ ...base, model: 'X', custom_field: { custom_field__1__62tvoyr1j4fa: '是' } }, {});
console.log('%s 存货编码/商品类型未受影响', m.存货编码 === 'YJ-XH-001' && m.商品类型 === '1' ? '✓' : '✗');
console.log(bad ? `✗ 失败 ${bad} 例` : '✓ 全部通过');
process.exit(bad ? 1 : 0);
