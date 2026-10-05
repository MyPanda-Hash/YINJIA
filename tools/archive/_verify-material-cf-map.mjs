// 离线自检 + 实测:商品档案(BD_MATERIAL)来料检验映射 ——
//   口径「金蝶填了 是 就照搬,没填写的按 否」(用户 2026-10-03)。
// 默认离线(纯映射逻辑,不连网);加 --live 则再从真实账套取两个商品的详情跑同一个 mapArchive。
// 用法:node tools/archive/_verify-material-cf-map.mjs [--live]
import { DOCS } from '../../deploy/sync-core.mjs';

const doc = DOCS.find((d) => d.code === 'BD_MATERIAL');
const base = { id: '1', number: 'YJ-XH-001', name: '鑫恒（80-250）', enable: '1', check_type: '1' };

const cases = [
  ['真实账套第 4 个自定义字段填了「是」', { ...base, custom_field: { custom_field__1__62tvoyr1j4fa: '是' } }, '是'],
  ['同一形态走 JSON 字符串', { ...base, custom_field: '{"custom_field__1__62tvoyr1j4fa":"是"}' }, '是'],
  ['沙箱键填了「是」(旧账套)', { ...base, custom_field: { custom_field__1__62jiaob3z7yj97: '是' } }, '是'],
  ['该字段为空串 → 否(用户口径)', { ...base, custom_field: { custom_field__1__62tvoyr1j4fa: '' } }, '否'],
  ['字段键不存在(接口给 null)', { ...base, custom_field: { custom_field__1__62tvoyr1j4fa: null } }, '否'],
  ['没有 custom_field 容器 → 否', { ...base }, '否'],
  ['只有老字段(规格/装箱量)→ 否', { ...base, custom_field: { custom_field__1__4swgci5cr1vb: '57*21*66.5', custom_field__1__6jiafyhnnjic0w: '108支/箱' } }, '否'],
];

let bad = 0;
console.log('—— 离线:映射逻辑 ——');
for (const [label, d, want] of cases) {
  const got = doc.mapArchive(d, {}).来料检验;
  const ok = got === want;
  if (!ok) bad++;
  console.log(`%s ${label.padEnd(34)} 期望 %s 实得 %s`, ok ? '✓' : '✗', JSON.stringify(want), JSON.stringify(got));
}
const m = doc.mapArchive({ ...base, model: 'X', custom_field: { custom_field__1__62tvoyr1j4fa: '是' } }, {});
const intact = m.存货编码 === 'YJ-XH-001' && m.商品类型 === '1';
if (!intact) bad++;
console.log('%s 标准字段(存货编码/商品类型)未受影响', intact ? '✓' : '✗');

if (process.argv.includes('--live')) {
  console.log('\n—— 实测:真实账套接口 → 同一个 mapArchive ——');
  const { readFileSync } = await import('node:fs');
  const { fetchAppToken, kingdeeGet } = await import('../../deploy/kingdee-client.mjs');
  const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
  const { token } = await fetchAppToken(cfg.kingdee);
  const want = [['YJ-XH-001', '是'], ['C-95-13', '否']];   // 金蝶已勾选 / 未勾选(实测值)
  for (const [code, expect] of want) {
    // 注:列表不支持按编号过滤(number= 实测被忽略,会返回列表首页第 1 条),
    //     只认 search 全文检索 ⇒ 用它定位,再按编号精确比对。
    const list = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '50', search: code });
    const row = (list.rows || []).find((r) => r.number === code);
    if (!row) { console.log('✗ 真实账套按 search=%s 没定位到该商品(返回 %d 条)', code, (list.rows || []).length); bad++; continue; }
    const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material_detail', { id: row.id });
    const got = doc.mapArchive({ ...row, ...d }, {}).来料检验;
    const raw = (typeof d.custom_field === 'string' ? JSON.parse(d.custom_field) : d.custom_field) || {};
    const ok = got === expect;
    if (!ok) bad++;
    console.log('%s %s 金蝶原值 %s → 映射 %s(期望 %s)',
      ok ? '✓' : '✗', code, JSON.stringify(raw.custom_field__1__62tvoyr1j4fa ?? ''), JSON.stringify(got), JSON.stringify(expect));
  }
}

console.log(bad ? `\n✗ 失败 ${bad} 例` : '\n✓ 全部通过');
process.exit(bad ? 1 : 0);
