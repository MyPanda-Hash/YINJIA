// 一次性探针:拉「金蝶真实账套」的仓库档案(/jdy/v2/bd/store)并落盘(UTF-8),
// 同时列出本库 bs_wh 行,便于两侧对照。
//   用法: node tools/archive/_q-kingdee-stores.mjs [--account=prod|sandbox]
//   凭证来源:deploy/config.json 的 kingdee 段(outerInstanceId 非空 = 真实账套)。
// 输出:tools/archive/_kingdee-stores.out.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const kd = cfg.kingdee;
const out = [];
const log = (...a) => { out.push(a.join(' ')); };

log('# 凭证来源 deploy/config.json');
log('clientId=' + kd.clientId + ' outerInstanceId=' + (kd.outerInstanceId || '(空=静态密钥/沙箱)') + ' domain=' + kd.domain);
log('数据库目标=' + cfg.database.database);
log('');

const { token, domain } = await fetchAppToken(kd);
log('app-token 获取成功,doman=' + domain);

// 仓库列表:档案接口全量(不分时间窗),翻页取完
const rows = [];
let total = null, totalPage = null;
for (let page = 1; page <= 50; page++) {
  const data = await kingdeeGet(kd, token, '/jdy/v2/bd/store', { page: String(page), page_size: '100' });
  const list = data.rows || data.list || data.data || [];
  if (page === 1) { total = data.count; totalPage = data.total_page; }
  rows.push(...list);
  if (!list.length || page >= Number(data.total_page || 1)) break;
}
log('仓库档案条数 = ' + rows.length + '(接口 count=' + total + ', total_page=' + totalPage + ')');
log('');
log('## 金蝶真实账套 · 仓库档案');
log(['序号', '编码', '名称', '分类', '启用', '停用标记', '地址', '负责人', '仓管员编码', 'id'].join(' | '));
rows.forEach((r, i) => {
  log([i + 1, r.number, r.name, r.group_name ?? r.group_number ?? '', r.enable,
    r.is_default === undefined ? '' : ('is_default=' + r.is_default),
    r.address ?? '', r.storekeeper_name ?? '', r.storekeeper_number ?? '', r.id].join(' | '));
});
log('');
log('## 列表接口返回的全部键(首行)');
log(JSON.stringify(Object.keys(rows[0] || {})));

// 详情接口补字段(仓库地址/库位管理等)
log('');
log('## 详情接口 /jdy/v2/bd/store_detail(逐仓)');
for (const r of rows) {
  try {
    const d = await kingdeeGet(kd, token, '/jdy/v2/bd/store_detail', { id: String(r.id) });
    const o = Array.isArray(d) ? d[0] : d;
    log('--- ' + r.number + ' ' + r.name + ' → ' + JSON.stringify(o));
  } catch (e) {
    log('--- ' + r.number + ' ' + r.name + ' → 详情失败: ' + e.message);
  }
}

writeFileSync(join(HERE, '_kingdee-stores.out.txt'), out.join('\n') + '\n', 'utf8');
console.log('OK rows=' + rows.length + ' -> tools/archive/_kingdee-stores.out.txt');
