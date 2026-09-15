// 一次性验证探针:sync-core.mjs 档案条目映射核对(列名 ⊆ 物理表列 + codeCol + ctx 链 + 指纹)
// 用法:node tools/archive/_verify-archsync.mjs
import { DOCS } from '../../deploy/sync-core.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const cols = new Map();
for (const line of readFileSync(join(HERE, '_archcols.out'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('|')) continue;
  const [t, c] = line.split('|');
  if (!cols.has(t)) cols.set(t, new Set());
  cols.get(t).add(c);
}

// 代表性金蝶响应(列表行/详情合并形态)
const fixtures = {
  BD_SETTLE: { id: '9001', name: '月结30天', enable: 1, is_default: true },
  BD_CUSGRP: { id: '9101', number: 'FL001', name: '批发客户', level: '1', is_leaf: true, parent_id: '0', remark: '备注' },
  BD_SUPGRP: { id: '9201', number: 'GYS01', name: '原材料供应商', level: '1', is_leaf: true, parent_id: '0' },
  BD_MATGRP: { id: '9301', number: 'LB01', name: '滤芯', level: '2', is_leaf: true, parent_id: '9300' },
  BD_CUR: { id: '9401', number: 'RMB', name: '人民币', sign: '¥', rate: '1.000000', exc_type: '1', amt_precision: '2', price_precision: '2', enable: 1, create_time: '2026-01-01 00:00:00' },
  BD_UOM: { id: '9501', number: 'U01', name: '个', precision: 0, enable: '1', create_time: '2026-01-01 00:00:00' },
  BD_DEPT: { id: '9601', number: 'D01', name: '销售部', parent_name: null, comment: null, enable: '1', create_time: '2026-01-01 00:00:00' },
  BD_EMP: { id: '9701', number: 'E01', name: '张三', department_name: '销售部', mobile: 'ENC', id_number: 'ENC', enable: '1', create_time: '2026-01-01 00:00:00' },
  BD_STORE: { id: '9801', number: 'CK01', name: '原料仓', address: '上海市', storekeeper_name: '李四', mobile: 'ENC', enable: '1', create_time: '2026-01-01 00:00:00' },
  BD_MATERIAL: { id: '9901', number: 'T382', name: '炭棒滤芯', model: '10寸', parent_id: '9301', parent_number: 'LB01', cost_method: '1', base_unit_name: '支', is_batch: true, is_serial: false, barcode: 'BC123', create_time: '2026-01-02 10:00:00', modify_time: '2026-09-15 10:00:00', enable: '1' },
  BD_CUSTOMER: { id: '8001', number: 'KH001', name: '华东铝业', addr: 'ENC', tel: 'ENC', email: 'ENC', bank: '工商银行', bank_account: 'ENC', taxpayer_no: '91310000X', group_name: '批发客户', c_level_name: '一级', saler_name: '王五', remark: '老客户', enable: '1', create_time: '2026-01-01 00:00:00' },
  BD_SUPPLIER: { id: '8101', number: 'GYS001', name: '炭业公司', group_name: '原材料供应商', saler_name: '赵六', taxpayer_no: '91310Y', remark: null, enable: '1', account_entity: [{ acct_is_default: true, income_bank_name: '建设银行', income_acc_no: 'ENC' }], create_time: '2026-01-01 00:00:00' },
};

let fail = 0;
const ctx = {};
const archives = DOCS.filter((d) => d.archive);
console.log('DOCS 档案条目 %d 个(顺序:%s)', archives.length, archives.map((d) => d.label).join('→'));
if (archives.length !== 12) { console.log('✗ 期望 12 个档案条目'); fail++; }
if (DOCS[0].archive !== true) { console.log('✗ 档案应排在订单之前'); fail++; }
// 分类映射先于使用方(MATGRP 在 MATERIAL 前)
const iGrp = DOCS.findIndex((d) => d.code === 'BD_MATGRP'), iMat = DOCS.findIndex((d) => d.code === 'BD_MATERIAL');
if (!(iGrp >= 0 && iMat > iGrp)) { console.log('✗ BD_MATGRP 应在 BD_MATERIAL 之前'); fail++; }

for (const doc of archives) {
  const fx = fixtures[doc.code];
  if (!fx) { console.log('[%s] ✗ 缺 fixture', doc.code); fail++; continue; }
  if (doc.afterList) doc.afterList([fx], ctx); // 单行注册(自引用 parent 为空)
  const mapped = doc.mapArchive(fx, ctx);
  // __cancel 必须是 'Y'/'N'
  if (!['Y', 'N'].includes(mapped.__cancel)) { console.log('[%s] ✗ __cancel=%j', doc.code, mapped.__cancel); fail++; }
  const table = cols.get(doc.table);
  if (!table) { console.log('[%s] ✗ 表 %s 不在列清单', doc.code, doc.table); fail++; continue; }
  const bad = Object.keys(mapped).filter((k) => !k.startsWith('__') && !table.has(k.replace(/^\[|\]$/g, '')));
  const codeOk = table.has(doc.codeCol);
  console.log('[%s→%s] 列名%s codeCol(%s)%s 值=%j', doc.code, doc.table, bad.length ? '✗缺失:' + bad.join(',') : '✓', doc.codeCol, codeOk ? '✓' : '✗', mapped);
  if (bad.length || !codeOk) fail++;
  // 指纹函数可用性
  const fp = doc.fingerprintOf(fx);
  if (typeof fp !== 'string' || !fp.length) { console.log('[%s] ✗ 指纹异常 %j', doc.code, fp); fail++; }
}
// ctx 链:物料的 所属类别 应解析为分类名称(经 matgrpNameById)
ctx.matgrpById = new Map([['9300', 'LB00'], ['9301', 'LB01']]);
ctx.matgrpNameById = new Map([['9300', '滤芯大类'], ['9301', '滤芯']]);
const mat = DOCS.find((d) => d.code === 'BD_MATERIAL');
const m = mat.mapArchive(fixtures.BD_MATERIAL, ctx);
if (m.所属类别 !== '滤芯') { console.log('✗ ctx 解析 所属类别=%j(期望 滤芯)', m.所属类别); fail++; } else console.log('[ctx] 材料.所属类别=%s ✓', m.所属类别);
// 敏感字段必须置空(起步策略)
const kh = DOCS.find((d) => d.code === 'BD_CUSTOMER').mapArchive(fixtures.BD_CUSTOMER, ctx);
for (const k of ['addr', 'tel', 'email', 'bank_no']) if (kh[k] !== null) { console.log('✗ 客户敏感字段 %s 未置空:%j', k, kh[k]); fail++; }
console.log(fail ? `RESULT: FAIL(${fail})` : 'RESULT: ALL PASS');
process.exit(fail ? 1 : 0);
