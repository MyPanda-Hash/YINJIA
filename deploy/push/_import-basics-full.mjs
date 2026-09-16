// _import-basics-full.mjs — 一次性:MES 全量基础资料导入金蝶沙箱(全字段,含规格型号)
// 导入后删除本脚本
// 覆盖:供应商(含解密地址电话)、客户(含解密)、商品(含规格型号/助记码/条形码等)、仓库、职员、部门
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PARENT = join(HERE, '..');
const { fetchAppToken, kingdeeGet, kingdeePost } = await import(pathToFileURL(join(PARENT, 'kingdee-client.mjs')).href);
const { setSecret, dec } = await import(pathToFileURL(join(PARENT, 'kingdee-crypto.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const origCfg = JSON.parse(readFileSync(join(PARENT, 'config.json'), 'utf8')); // 原沙箱(解密用)
setSecret(origCfg.kingdee.clientSecret);

const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();
const { token } = await fetchAppToken(cfg.kingdee);

// ── 沙箱已有编码 ──
const cache = { supplier: new Set(), customer: new Set(), material: new Set(), store: new Set(), emp: new Set(), dept: new Set() };
async function loadCache() {
  for (const [key, path] of [
    ['supplier','/jdy/v2/bd/supplier'],['customer','/jdy/v2/bd/customer'],
    ['material','/jdy/v2/bd/material'],['store','/jdy/v2/bd/store'],
    ['emp','/jdy/v2/bd/emp'],['dept','/jdy/v2/bd/department'],
  ]) {
    try {
      let page = 1;
      for (;;) {
        const r = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: '200' });
        for (const row of (r.rows || [])) cache[key].add(String(row.number));
        if (!r.rows || r.rows.length < 200 || page > 50) break;
        page++;
      }
    } catch {}
  }
}
let unitId = null, unitIdByNum = new Map();
async function loadUnits() {
  try {
    const r = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '50' });
    for (const u of (r.rows || [])) unitIdByNum.set(String(u.number), u.id);
    const dft = (r.rows || []).find((x) => x.number === '个') || (r.rows || [])[0];
    if (dft) unitId = dft.id;
  } catch {}
}
async function unitIdFor(name) {
  if (!name) return unitId;
  return unitIdByNum.get(String(name).trim()) || unitId;
}

// ── 通用创建(带名称消歧) ──
async function create(type, body, number, name) {
  if (cache[type].has(String(number))) return 'skip';
  const paths = { supplier: '/jdy/v2/bd/supplier', customer: '/jdy/v2/bd/customer', material: '/jdy/v2/bd/material', store: '/jdy/v2/bd/store', emp: '/jdy/v2/bd/emp', dept: '/jdy/v2/bd/department' };
  let r = await kingdeePost(cfg.kingdee, token, paths[type], {}, body);
  if (r.ok) { cache[type].add(String(number)); return 'created'; }
  if (/已存在/.test(String(r.error || ''))) {
    // 名称冲突 → 加编码消歧
    r = await kingdeePost(cfg.kingdee, token, paths[type], {}, { ...body, name: `${name}(${number})` });
    if (r.ok) { cache[type].add(String(number)); return 'created-renamed'; }
    // 也失败 → 标记已有(同名不同码已存在)
    cache[type].add(String(number));
    return 'skip-nameconflict';
  }
  return `fail:${String(r.error || '').slice(0, 60)}`;
}

const stats = {};
async function importType(label, fn) {
  const s = { created: 0, renamed: 0, skipped: 0, failed: 0, errors: [] };
  await fn(s);
  stats[label] = s;
  console.log(`【${label}】新建${s.created} 改名${s.renamed} 跳过${s.skipped} 失败${s.failed}${s.errors.length ? ' ⚠' + s.errors.slice(0,3).join('; ') : ''}`);
}

console.log('── 加载沙箱缓存 ──');
await loadCache();
await loadUnits();
console.log(`沙箱: 供${cache.supplier.size} 客${cache.customer.size} 商${cache.material.size} 仓${cache.store.size} 员${cache.emp.size} 部${cache.dept.size} 单位${unitIdByNum.size}`);

// ══ 1. 供应商(全字段:含解密地址/电话/银行) ══
await importType('供应商', async (s) => {
  const rows = (await pool.request().query(`
    SELECT dm, mc, gysfl, addr, tel, ywman, sui_no, bank, bank_no, bz FROM dm_gf
    WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>''`)).recordset;
  for (const r of rows) {
    const body = {
      number: r.dm, name: r.mc,
      group_name: r.gysfl || undefined,
      saler_name: r.ywman || undefined,
      taxpayer_no: r.sui_no || undefined,
      bank: r.bank || undefined,
      remark: r.bz || undefined,
    };
    const addr = dec(r.addr); if (addr) body.contact_address = addr;
    const tel = dec(r.tel); if (tel) body.phone = tel;
    const result = await create('supplier', body, r.dm, r.mc);
    if (result === 'created') s.created++;
    else if (result === 'created-renamed') { s.renamed++; s.errors.push(`${r.dm}同名改名`); }
    else if (result.startsWith('skip')) s.skipped++;
    else { s.failed++; s.errors.push(`${r.dm}: ${result}`); }
  }
});

// ══ 2. 客户(全字段:含解密地址/电话/邮箱/银行/联系人) ══
await importType('客户', async (s) => {
  const rows = (await pool.request().query(`
    SELECT dm, mc, khlb, khjb, addr, tel, email, lxr, ywman, sui_no, bank, bank_no, bz FROM dm_kh
    WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>''`)).recordset;
  for (const r of rows) {
    const body = {
      number: r.dm, name: r.mc,
      group_name: r.khlb || undefined,
      c_level_name: r.khjb || undefined,
      saler_name: r.ywman || undefined,
      taxpayer_no: r.sui_no || undefined,
      bank: r.bank || undefined,
      remark: r.bz || undefined,
    };
    const addr = dec(r.addr); if (addr) body.addr = addr;
    const tel = dec(r.tel); if (tel) body.phone = tel;
    const email = dec(r.email); if (email) body.email = email;
    if (r.lxr) body.bomentity = [{ contact_person: r.lxr }];
    const result = await create('customer', body, r.dm, r.mc);
    if (result === 'created') s.created++;
    else if (result === 'created-renamed') { s.renamed++; s.errors.push(`${r.dm}同名改名`); }
    else if (result.startsWith('skip')) s.skipped++;
    else { s.failed++; s.errors.push(`${r.dm}: ${result}`); }
  }
});

// ══ 3. 商品(全字段:规格型号/助记码/条形码/产地/保质期/税率等) ══
await importType('商品', async (s) => {
  const rows = (await pool.request().query(`
    SELECT 存货编码, 存货名称, 规格型号, 条形码, 计量单位, 助记码, 产地, 品牌,
           是否启用保质期, 保质期, 销项税率, 进项税率, 备注
    FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货编码,'')<>''`)).recordset;
  for (const r of rows) {
    const uid = await unitIdFor(r.计量单位);
    if (!uid) { s.failed++; s.errors.push(`${r.存货编码}: 无计量单位`); continue; }
    const body = {
      number: r.存货编码, name: r.存货名称,
      model: r.规格型号 || undefined,           // ← 规格型号(上次遗漏!)
      barcode: r.条形码 || undefined,
      base_unit_id: uid, purchase_unit_id: uid, sale_unit_id: uid, store_unit_id: uid,
      help_code: r.助记码 || undefined,
      producing_pace: r.产地 || undefined,
      brand_name: r.品牌 || undefined,
      is_kf_period: r.是否启用保质期 === true,
      kf_period: Number(r.保质期) || undefined,
      tax_rate: Number(r.销项税率) || undefined,
      in_tax_rate: Number(r.进项税率) || undefined,
      remark: r.备注 || undefined,
    };
    const result = await create('material', body, r.存货编码, r.存货名称);
    if (result === 'created') s.created++;
    else if (result === 'created-renamed') { s.renamed++; }
    else if (result.startsWith('skip')) s.skipped++;
    else { s.failed++; s.errors.push(`${r.存货编码}: ${result}`); }
  }
});

// ══ 4. 仓库 ══
await importType('仓库', async (s) => {
  const rows = (await pool.request().query(`
    SELECT 仓库编码, 仓库名称, 仓库地址, 负责人, 允许零库存出库, 启用仓位管理 FROM bs_wh
    WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(仓库编码,'')<>''`)).recordset;
  for (const r of rows) {
    const body = {
      number: r.仓库编码, name: r.仓库名称,
      address: r.仓库地址 || undefined,
      storekeeper_name: r.负责人 || undefined,
      allow_negative: r.允许零库存出库 === true,
      is_allow_freight: r.启用仓位管理 === true,
    };
    const result = await create('store', body, r.仓库编码, r.仓库名称);
    if (result === 'created') s.created++;
    else if (result === 'created-renamed') { s.renamed++; }
    else if (result.startsWith('skip')) s.skipped++;
    else { s.failed++; s.errors.push(`${r.仓库编码}: ${result}`); }
  }
});

// ══ 5. 职员(含解密手机/证件号) ══
await importType('职员', async (s) => {
  const rows = (await pool.request().query(`
    SELECT 员工编码, 员工名称, 所属部门, 性别, 手机, 证件号码 FROM bs_emp
    WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(员工编码,'')<>'' AND ISNULL(停用,0)<>1`)).recordset;
  for (const r of rows) {
    const body = { number: r.员工编码, name: r.员工名称, department_name: r.所属部门 || undefined };
    if (r.性别 === '男') body.gender = '1'; else if (r.性别 === '女') body.gender = '0';
    const mobile = dec(r.手机); if (mobile) body.mobile = mobile;
    const idn = dec(r.证件号码); if (idn) body.id_number = idn;
    const result = await create('emp', body, r.员工编码, r.员工名称);
    if (result === 'created') s.created++;
    else if (result.startsWith('skip')) s.skipped++;
    else { s.failed++; s.errors.push(`${r.员工编码}: ${result}`); }
  }
});

// ══ 6. 部门 ══
await importType('部门', async (s) => {
  const rows = (await pool.request().query(`
    SELECT 部门编码, 部门名称, 上级部门 FROM bs_dept
    WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(部门编码,'')<>'' AND ISNULL(停用,0)<>1`)).recordset;
  for (const r of rows) {
    const body = { number: r.部门编码, name: r.部门名称 };
    if (r.上级部门) body.parent_name = r.上级部门;
    const result = await create('dept', body, r.部门编码, r.部门名称);
    if (result === 'created') s.created++;
    else if (result.startsWith('skip')) s.skipped++;
    else { s.failed++; s.errors.push(`${r.部门编码}: ${result}`); }
  }
});

// ══ 复查:验证关键字段是否导入成功 ══
console.log('\n══ 复查 ══');
// 商品规格型号复查
const matList = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '100' });
const withModel = (matList.rows || []).filter((m) => m.name && !m.name.includes('(')).length; // 非消歧的
console.log(`商品: 沙箱${(matList.rows || []).length}个(首页), MES ${stats['商品'].created + stats['商品'].skipped} 个目标`);
// 抽查几个商品的详情
for (const code of ['CL001', 'CL003', 'YJ-SX-031']) {
  const found = (matList.rows || []).find((m) => m.number === code);
  if (found) {
    const detail = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material_detail', { id: found.id });
    console.log(`  ${code}: model=${JSON.stringify(detail.model)} help_code=${JSON.stringify(detail.help_code)}`);
  }
}
// 供应商地址/电话复查
const supList = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/supplier', { page: '1', page_size: '100' });
const yjyc = (supList.rows || []).find((s) => s.number === 'YJ-YC');
if (yjyc) {
  const detail = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/supplier_detail', { id: yjyc.id });
  console.log(`  供应商YJ-YC: name=${detail.name} group=${detail.group_name}`);
}

console.log('\n══ 汇总 ══');
for (const [label, s] of Object.entries(stats)) {
  console.log(`${label}: 新建${s.created} 改名${s.renamed} 跳过${s.skipped} 失败${s.failed}`);
}
await pool.close();
console.log('\n完成(请删除本脚本)');
