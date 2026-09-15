// 金蝶云·星辰单据/基础资料同步 · 共享核心(由 sync.mjs / init-sync.mjs 调用)
// 支持多类型注册表(DOCS):订单(SO_ORDER/PU_ORDER,头+行) + 基础资料档案(archive:true,单表,12 个)
//   订单 mode='incremental'(增量): 已审核 + 时间窗(默认31天),计划任务高频跑
//   订单 mode='init'(初始化/复核): 全量(无时间窗),首次部署与定期对账用
//   档案(archive): 不做时间窗/状态过滤,每轮全量列表 + 指纹跳过(指引 §四.3;量小约4600条/46页)
//
// 关键机制:
//   指纹跳过  : 列表级字段指纹存 头表.外部指纹,无变化的单/档案不调详情
//   幂等      : 外部数据ID 唯一索引,重拉=覆盖更新;订单镜像 yj_doc_status,档案不写(无审核流)
//   授权轮换  : outerInstanceId 自动获取 appKey/appSecret(24h轮换),1030002006 自愈
//   窗口端点  : modify_end_time 前移 endBiasMinutes(实测端点=now会偶发漏单,前移规避)
//   档案映射  : 敏感字段(AES密文)按指引 §四.6 起步策略跳过置空,界面在金蝶维护
import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
import { makeLogger, confirmBatch, backupBeforeWrite } from './safety.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const N_SYNC_USER = '金蝶同步'; // 星辰审核人缺失时 yj_doc_status.shr 的兜底留痕

// ---------- 类型注册表 ----------
// 订单条目:{ code,label,listPath,detailPath,headTable,lineTable,fingerprintOf,mapHead,mapLines }
// 档案条目:{ code,label,archive:true,listPath,detailPath(可空=仅列表),table,codeCol,
//            fingerprintOf,mapArchive(d,ctx),afterList(rows,ctx)? }
//   ctx 跨条目共享:BD_MATGRP.afterList 登记 id→名称,供 BD_MATERIAL 解析 所属类别;
//   分类条目用自身列表建 id→编码 映射解析 上级编码(指引 §四.7)。
export const DOCS = [
  // ══════════ 基础资料档案(12;指引 §二映射,先于订单同步) ══════════
  {
    code: 'BD_SETTLE', label: '结算方式', archive: true,
    listPath: '/jdy/v2/bd/settlement_type', detailPath: null, // 仅列表接口
    table: 'bs_settle_type', codeCol: '名称',
    fingerprintOf: (r) => [r.name, r.enable, r.is_default].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      const en = Number(d.enable);
      return { 名称: str(d.name), 是否默认: d.is_default === true, 停用: en === 0, 状态: en === 0 ? '停用' : '启用', 备注: null, __cancel: 'N' };
    },
  },
  {
    code: 'BD_CUSGRP', label: '客户分类', archive: true,
    listPath: '/jdy/v2/bd/customer_group', detailPath: null,
    table: 'bs_customer_group', codeCol: '编码',
    fingerprintOf: (r) => [r.number, r.name, r.level, r.is_leaf, r.parent_id, r.remark].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    afterList(rows, ctx) { ctx.cusgrpById = new Map(rows.map((r) => [String(r.id), r.number])); },
    mapArchive(d, ctx) {
      return { 编码: str(d.number), 名称: str(d.name), 级次: str(d.level), 是否叶子节点: d.is_leaf === true,
        上级编码: (ctx.cusgrpById && ctx.cusgrpById.get(String(d.parent_id))) || null,
        备注: str(d.remark), 停用: 0, 状态: '启用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_SUPGRP', label: '供应商分类', archive: true,
    listPath: '/jdy/v2/bd/supplier_group', detailPath: null,
    table: 'bs_supplier_group', codeCol: '编码',
    fingerprintOf: (r) => [r.number, r.name, r.level, r.is_leaf, r.parent_id].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    afterList(rows, ctx) { ctx.supgrpById = new Map(rows.map((r) => [String(r.id), r.number])); },
    mapArchive(d, ctx) {
      return { 编码: str(d.number), 名称: str(d.name), 级次: str(d.level), 是否叶子节点: d.is_leaf === true,
        上级编码: (ctx.supgrpById && ctx.supgrpById.get(String(d.parent_id))) || null,
        停用: 0, 状态: '启用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_MATGRP', label: '商品分类', archive: true,
    listPath: '/jdy/v2/bd/material_group', detailPath: null, // 列表已含全部字段,detail 免调省额度
    table: 'bs_material_group', codeCol: '编码',
    fingerprintOf: (r) => [r.number, r.name, r.level, r.is_leaf, r.parent_id].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    afterList(rows, ctx) { ctx.matgrpById = new Map(rows.map((r) => [String(r.id), r.number])); ctx.matgrpNameById = new Map(rows.map((r) => [String(r.id), r.name])); },
    mapArchive(d, ctx) {
      return { 编码: str(d.number), 名称: str(d.name), 级次: str(d.level), 是否叶子节点: d.is_leaf === true,
        上级编码: (ctx.matgrpById && ctx.matgrpById.get(String(d.parent_id))) || null,
        停用: 0, 状态: '启用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_CUR', label: '币别', archive: true,
    listPath: '/jdy/v2/bd/currency', detailPath: '/jdy/v2/bd/currency_detail',
    table: 'bs_currency', codeCol: '编码',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.rate, r.sign, r.exc_type].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      const en = Number(d.enable);
      return { 编码: str(d.number), 名称: str(d.name), 币别符号: str(d.sign), 汇率: num(d.rate),
        汇率类型: d.exc_type === '1' ? '固定汇率' : d.exc_type === '2' ? '浮动汇率' : null,
        金额小数位: d.amt_precision == null ? null : Number(d.amt_precision), 单价小数位: d.price_precision == null ? null : Number(d.price_precision),
        停用: en === 0, 状态: en === 0 ? '停用' : '启用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_UOM', label: '计量单位', archive: true,
    listPath: '/jdy/v2/bd/measure_unit', detailPath: '/jdy/v2/bd/measure_unit_detail',
    table: 'bs_uom', codeCol: '计量单位编码',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.precision].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      return { 计量单位编码: str(d.number), 计量单位名称: str(d.name),
        小数位数: d.precision == null ? null : Number(d.precision), // 物理列=小数位数(标签展示为数量小数位)
        停用: d.enable !== '1', 状态: d.enable === '1' ? '启用' : '停用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_DEPT', label: '部门', archive: true,
    listPath: '/jdy/v2/bd/department', detailPath: '/jdy/v2/bd/department_detail',
    table: 'bs_dept', codeCol: '部门编码',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.parent_name, r.comment].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      return { 部门编码: str(d.number), 部门名称: str(d.name), 负责人: null, 上级部门: str(d.parent_name),
        备注: str(d.comment), 停用: d.enable !== '1', 状态: d.enable === '1' ? '启用' : '停用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_EMP', label: '职员', archive: true,
    listPath: '/jdy/v2/bd/emp', detailPath: '/jdy/v2/bd/emp_detail',
    table: 'bs_emp', codeCol: '员工编码',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.department_name].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      // 敏感字段(手机/证件号,指引 §四.6)跳过置空,联系方式在金蝶界面维护
      return { 员工编码: str(d.number), 员工名称: str(d.name), 所属部门: str(d.department_name),
        手机: null, 办公电话: null, 证件号码: null,
        停用: d.enable !== '1', 状态: d.enable === '1' ? '启用' : '停用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_STORE', label: '仓库', archive: true,
    listPath: '/jdy/v2/bd/store', detailPath: '/jdy/v2/bd/store_detail',
    table: 'bs_wh', codeCol: '仓库编码',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.address, r.storekeeper_name].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      return { 仓库编码: str(d.number), 仓库名称: str(d.name), 仓库地址: str(d.address),
        负责人: str(d.storekeeper_name), 联系电话: null,
        停用: d.enable !== '1', 状态: d.enable === '1' ? '启用' : '停用', __cancel: 'N' };
    },
  },
  {
    code: 'BD_MATERIAL', label: '商品', archive: true,
    listPath: '/jdy/v2/bd/material', detailPath: '/jdy/v2/bd/material_detail',
    table: 'bs_inv', codeCol: '存货编码',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.model, r.parent_number, r.modify_time].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d, ctx) {
      const costWay = { 1: '移动平均', 2: '加权平均', 3: '先进先出' }[String(d.cost_method || '')] || '移动平均';
      const attr = [d.is_batch === true && '批次管理', d.is_serial === true && '序列号管理'].filter(Boolean).join('/') || null;
      return { 存货编码: str(d.number), 存货名称: str(d.name), 规格型号: str(d.model),
        所属类别: (ctx.matgrpNameById && ctx.matgrpNameById.get(String(d.parent_id))) || str(d.parent_number) || '',
        计价方式: costWay, 品牌: null, 计量单位: str(d.base_unit_name), 属性: attr, 条形码: str(d.barcode),
        建档日期: str(d.create_time).slice(0, 10) || null,
        停用: d.enable !== '1', 状态: d.enable === '1' ? '启用' : '停用',
        是否检验: 0, 数据来源: '金蝶同步', ERP更新时间: str(d.modify_time) || nowLocal(), __cancel: 'N' };
    },
  },
  {
    code: 'BD_CUSTOMER', label: '客户', archive: true,
    listPath: '/jdy/v2/bd/customer', detailPath: '/jdy/v2/bd/customer_detail',
    table: 'dm_kh', codeCol: 'dm',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.group_name, r.c_level_name, r.saler_name, r.remark].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      // 敏感字段(详细地址/电话/邮箱/银行账号)AES密文,起步策略跳过(指引 §四.6)
      return { dm: str(d.number), mc: str(d.name), khlb: str(d.group_name), khjb: str(d.c_level_name),
        addr: null, tel: null, email: null, lxr: null, ywman: str(d.saler_name),
        sui_no: str(d.taxpayer_no), bank: str(d.bank), bank_no: null, bz: str(d.remark), comm: '',
        __cancel: d.enable === '1' ? 'N' : 'Y' }; // dm_kh 无停用列,停用走 asp_cancel(指引 §四.5)
    },
  },
  {
    code: 'BD_SUPPLIER', label: '供应商', archive: true,
    listPath: '/jdy/v2/bd/supplier', detailPath: '/jdy/v2/bd/supplier_detail',
    table: 'dm_gf', codeCol: 'dm',
    fingerprintOf: (r) => [r.number, r.name, r.enable, r.group_name, r.saler_name, r.remark].map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapArchive(d) {
      const acc = (d.account_entity || [])[0] || {};
      return { dm: str(d.number), mc: str(d.name), gysfl: str(d.group_name),
        addr: null, tel: null, ywman: str(d.saler_name), sui_no: str(d.taxpayer_no),
        bank: str(acc.income_bank_name), bank_no: null, bz: str(d.remark),
        __cancel: d.enable === '1' ? 'N' : 'Y' };
    },
  },

  // ══════════ 订单(头+行) ══════════
  {
    code: 'SO_ORDER', label: '销售订单',
    listPath: '/jdy/v2/scm/sal_order',
    detailPath: '/jdy/v2/scm/sal_order_detail',
    headTable: 'bd_so_order', lineTable: 'bl_so_order',
    fingerprintOf: (r) => [r.bill_status, r.bill_close_state, r.bill_date, r.customer_name,
      r.customer_number, r.dept_name, r.emp_name, r.total_amount, r.io_status, r.real_io_status]
      .map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapHead(d) {
      const dates = (d.material_entity || []).map((m) => m.delivery_date).filter(Boolean).sort();
      return {
        单据编号: str(d.bill_no), 单据日期: str(d.bill_date),
        客户: str(d.customer_name), 客户编码: str(d.customer_number), 结算客户: str(d.settle_customer_number),
        部门: str(d.dept_name), 部门负责人: null, 业务员: str(d.emp_name), 项目: null,
        汇率: num(d.exchange_rate), 结算期限: str(d.setting_term_name), // 币种待「币别」档案同步后经 currency_id→名称对照回填
        预计交货日期: dates[0] || null, 联系人: str(d.contact_linkman), 备注: str(d.remark),
        单据状态: d.bill_status === 'C' ? '已审核' : '草稿',
        审核人: str(d.auditor_name), 审核时间: str(d.audit_time),
      };
    },
    mapLines(d) {
      return (d.material_entity || []).map((m) => ({
        单据编号: str(d.bill_no), 品牌: null,
        存货名称: str(m.material_name), 存货编码: str(m.material_number), 规格型号: str(m.material_model),
        数量: num(m.qty), 销售单位: str(m.unit_name) || str(m.unit_number),
        单价: num(m.price), '税率%': num(m.cess), 含税单价: num(m.tax_price),
        金额: num(m.amount), 含税金额: num(m.all_amount), 折扣金额: num(m.dis_amount),
        预计交货日期: str(m.delivery_date), 现存量: num(m.inv_qty), 备注: str(m.comment),
      }));
    },
  },
  {
    code: 'PU_ORDER', label: '采购订单',
    listPath: '/jdy/v2/scm/pur_order',
    detailPath: '/jdy/v2/scm/pur_order_detail',
    headTable: 'bd_pu_order', lineTable: 'bl_pu_order',
    // 采购列表行无金额字段,指纹以供应商/执行状态/备注等组合
    fingerprintOf: (r) => [r.bill_status, r.bill_close_state, r.bill_date, r.supplier_name,
      r.supplier_number, r.emp_name, r.io_status, r.real_io_status, r.remark]
      .map((v) => (v === undefined || v === null ? '' : String(v))).join('|'),
    mapHead(d) {
      const dates = (d.material_entity || []).map((m) => m.delivery_date).filter(Boolean).sort();
      return {
        单据编号: str(d.bill_no), 单据日期: str(d.bill_date),
        供应商: str(d.supplier_name), 供应商编码: str(d.supplier_number),
        // 本地列 NOT NULL:星辰只给 currency_id(无名称),默认人民币/汇率1
        币种: '人民币', 汇率: num(d.exchange_rate) ?? 1, 到货地址: null, 结算期限: str(d.setting_term_name),
        交货日期: dates[0] || null, 发货状态: null, 合同号: null, 订金金额: null, 付款方式: null,
        数据来源: '金蝶同步', 备注: str(d.remark),
        单据状态: d.bill_status === 'C' ? '已审核' : '草稿',
        审核人: str(d.auditor_name), 审核时间: str(d.audit_time),
      };
    },
    mapLines(d) {
      return (d.material_entity || []).map((m) => ({
        单据编号: str(d.bill_no),
        // 本地列 NOT NULL:物料/单位/数量/单价 缺失时兜底空串/0
        物料编码: str(m.material_number) || '', 物料名称: str(m.material_name) || '', 规格型号: str(m.material_model),
        单位: str(m.unit_name) || str(m.unit_number) || '', 数量: num(m.qty) ?? 0,
        单价: num(m.price) ?? 0, 金额: num(m.amount), '税率%': num(m.cess),
        含税单价: num(m.tax_price), 含税金额: num(m.all_amount),
        数量2: num(m.aux_qty), 计量单位2: str(m.aux_unit_name), 仓库: str(m.stock_name),
        '折扣%': num(m.dis_rate), 折扣金额: num(m.dis_amount),
        预计到货日期: str(m.delivery_date), 现存量: num(m.inv_qty), 现存量说明: null, 备注: str(m.comment),
      }));
    },
  },
];

// ---------- 基础 ----------
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const str = (v) => (v === undefined || v === null || v === '' ? null : String(v));
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const nowLocal = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 日志:控制台 + logs/sync-YYYY-MM-DD.log(按日轮转,规范要求保留至少一年)
let logger = null;
const log = (msg) => {
  if (logger) return logger.log(msg);
  const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`;
  console.log(line);
};

/** 进程是否存活(判断锁归属者是否还在运行) */
function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * 跨进程互斥锁:锁文件记录持有者 PID。
 * 持有者进程仍存活 → 让行(无论运行多久,长跑初始化不会被误判过期);
 * 持有者已退出 或 锁文件损坏且超龄 → 接管。
 */
function acquireLock() {
  const lock = join(HERE, 'sync.lock');
  try {
    if (existsSync(lock)) {
      const owner = Number(readText(lock).trim());
      const age = Date.now() - statSync(lock).mtimeMs;
      if (owner && owner !== process.pid && pidAlive(owner)) {
        log(`另一同步实例运行中(PID ${owner}),本次跳过`);
        return false;
      }
      if (!owner && age < 10 * 60000) {
        log('锁文件存在且未超龄,本次跳过');
        return false;
      }
      log(`接管过期锁(原持有者 PID ${owner || '未知'} 已退出)`);
    }
  } catch { /* 锁文件异常则视为无锁 */ }
  writeFileSync(lock, String(process.pid), 'utf8');
  return true;
}
/** 仅释放自己的锁(避免误删其他实例的锁) */
function releaseLock() {
  try {
    const lock = join(HERE, 'sync.lock');
    if (existsSync(lock) && Number(readText(lock).trim()) === process.pid) unlinkSync(lock);
  } catch { /* 忽略 */ }
}

/** 通用参数类型推断:null→nvarchar,布尔→bit(档案 是否默认/是否叶子节点/停用),数字→decimal(18,4),其余→nvarchar */
function inferType(value) {
  if (typeof value === 'boolean') return { type: 'bit' };
  if (typeof value === 'number') return { type: 'decimal', precision: 18, scale: 4 };
  return { type: 'nvarchar', length: 500 };
}
/** 生成参数化 SQL 片段:返回 { sql:@pN 占位, inputs:[[name,type,value]...] } */
function paramify(req, mssql, entries) {
  const inputs = [];
  const names = entries.map(([col, val]) => {
    const p = `p${inputs.length}`;
    const t = inferType(val);
    if (t.type === 'decimal') req.input(p, mssql.Decimal(t.precision, t.scale), val);
    else if (t.type === 'bit') req.input(p, mssql.Bit, val);
    else req.input(p, mssql.NVarChar(t.length), val);
    inputs.push(col);
    return `@${p}`;
  });
  return { names, inputs };
}

/** 单据落库(通用):头表 upsert + 行表先删后插 + 审核状态镜像,单事务 */
async function upsertDoc(doc, mssql, pool, head, lines, fp) {
  const tx = new mssql.Transaction(pool);
  await tx.begin();
  try {
    const r = new mssql.Request(tx);
    // 头表参数:仅业务列(剔除 元数据__前缀列 与 外部数据ID,它们由核心统一管理)
    const headEntries = Object.entries(head)
      .filter(([col]) => !col.startsWith('__') && col !== '外部数据ID')
      .map(([col, val]) => [ `[${col}]`, val ]);
    const setPairs = headEntries.map(([col], i) => `${col}=@p${i}`);
    const insCols = headEntries.map(([col]) => col);
    // 元数据参数从 headEntries.length 起编号
    const base = headEntries.length;
    headEntries.push(['@__ctime', head.__创建时间], ['@__extid', head.外部数据ID], ['@__fp', fp], ['@__now', nowLocal()]);
    const { names } = paramify(r, mssql, headEntries);
    await r.query(`
      UPDATE ${doc.headTable} SET
        ${setPairs.join(', ')},
        asp_user1=N'jdy-sync', asp_time1=COALESCE(@p${base}, asp_time1), asp_cancel=N'N',
        外部数据ID=@p${base + 1}, 外部指纹=@p${base + 2}
      WHERE 外部数据ID=@p${base + 1} OR (外部数据ID IS NULL AND 单据编号=@p0);
      IF @@ROWCOUNT = 0
        INSERT INTO ${doc.headTable} (${insCols.join(', ')}, asp_user1, asp_time1, asp_cancel, 外部数据ID, 外部单据号, 外部指纹)
        VALUES (${names.slice(0, base).join(', ')}, N'jdy-sync', COALESCE(@p${base}, @p${base + 3}), N'N', @p${base + 1}, @p0, @p${base + 2});
      DELETE FROM ${doc.lineTable} WHERE 单据编号=@p0;`);
    // 审核状态镜像(工作流注册表)
    r.input('m_shr', mssql.NVarChar(50), head.单据状态 === '已审核' ? (head.审核人 || N_SYNC_USER) : null);
    r.input('m_shsj', mssql.NVarChar(30), head.单据状态 === '已审核' ? head.审核时间 : null);
    r.input('m_stopped', mssql.NVarChar(1), head.__已关闭 ? 'Y' : 'N');
    await r.query(`
      MERGE yj_doc_status AS t USING (VALUES (N'${doc.code}', @p0)) AS s(panel_code, doc_no)
      ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
      WHEN MATCHED THEN UPDATE SET
        shr = @m_shr, shsj = @m_shsj, canceled = N'N', stopped = @m_stopped, pending = N'N', update_at = GETDATE()
      WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, stopped, pending, update_at)
        VALUES (s.panel_code, s.doc_no, @m_shr, @m_shsj, N'N', @m_stopped, N'N', GETDATE());`);
    // 行表(列名直接用本地中文列;asp_time1 作为普通参数)
    for (const l of lines) {
      const lr = new mssql.Request(tx);
      const entries = Object.entries(l).map(([col, val]) => [`[${col}]`, val]);
      entries.push(['@__lnow', nowLocal()]);
      const { names: ln } = paramify(lr, mssql, entries);
      await lr.query(`INSERT INTO ${doc.lineTable} (${entries.slice(0, -1).map(([c]) => c).join(', ')}, asp_user1, asp_time1, asp_cancel)
        VALUES (${ln.slice(0, -1).join(', ')}, N'jdy-sync', @p${entries.length - 1}, N'N');`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/** 档案落库(指引 §四.2):单表 upsert,无行表/无 yj_doc_status;WHERE=外部数据ID 或 空锚点+编码列 */
export async function upsertArchive(doc, mssql, pool, mapped, fp) {
  const tx = new mssql.Transaction(pool);
  await tx.begin();
  try {
    const r = new mssql.Request(tx);
    // 业务列(锚点三列由下方统一管理,避免 SET 重复指定)
    const entries = Object.entries(mapped)
      .filter(([col]) => !col.startsWith('__') && !['外部数据ID', '外部单据号', '外部指纹'].includes(col))
      .map(([col, val]) => [`[${col}]`, val]);
    const setPairs = entries.map(([col], i) => `${col}=@p${i}`).join(', ');
    const base = entries.length;
    entries.push(['@__cancel', mapped.__cancel || 'N'], ['@__ctime', mapped.__创建时间], ['@__extid', mapped.外部数据ID],
      ['@__no', mapped.外部单据号], ['@__fp', fp], ['@__now', nowLocal()]);
    const { names } = paramify(r, mssql, entries);
    await r.query(`
      UPDATE ${doc.table} SET
        ${setPairs},
        asp_user1=N'jdy-sync', asp_time1=COALESCE(@p${base + 1}, asp_time1), asp_cancel=@p${base},
        外部数据ID=@p${base + 2}, 外部单据号=@p${base + 3}, 外部指纹=@p${base + 4}
      WHERE 外部数据ID=@p${base + 2} OR (外部数据ID IS NULL AND [${doc.codeCol}]=@p${base + 3});
      IF @@ROWCOUNT = 0
        INSERT INTO ${doc.table} (${entries.slice(0, base).map(([col]) => col).join(', ')}, asp_user1, asp_time1, asp_cancel, 外部数据ID, 外部单据号, 外部指纹)
        VALUES (${names.slice(0, base).join(', ')}, N'jdy-sync', COALESCE(@p${base + 1}, @p${base + 5}), @p${base}, @p${base + 2}, @p${base + 3}, @p${base + 4});`);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// ---------- 主流程 ----------
export async function runCore({ mode, configPath, dryRun = false, probe = false, assumeYes = false }) {
  configPath = configPath || join(HERE, 'config.json');
  if (!existsSync(configPath)) {
    console.error(`✗ 未找到配置文件 ${configPath}\n  请复制 config.example.json 为 config.json 并填入凭证/数据库信息`);
    process.exit(1);
  }
  const cfg = JSON.parse(readText(configPath));
  const s = cfg.sync || {};
  const opt = {
    billStatus: (mode === 'incremental' ? s.billStatus : s.initBillStatus) ?? 'C',
    windowDays: s.windowDays || 31,
    endBiasMinutes: s.endBiasMinutes === undefined ? 180 : s.endBiasMinutes,
    pageSize: s.pageSize || 100,
    maxPages: s.maxPages || 60,
    types: Array.isArray(s.types) && s.types.length ? s.types : DOCS.map((d) => d.code),
    confirmThreshold: s.confirmThreshold === undefined ? 200 : s.confirmThreshold,
    confirmTimeoutSeconds: s.confirmTimeoutSeconds === undefined ? 5 : s.confirmTimeoutSeconds,
    logRetentionDays: s.logRetentionDays || 365,
    backupRetentionDays: s.backupRetentionDays || 365,
  };
  logger = makeLogger({ baseDir: HERE, retentionDays: opt.logRetentionDays });
  const docs = DOCS.filter((d) => opt.types.includes(d.code));
  const statePath = join(HERE, 'state.json');
  const state = existsSync(statePath) ? JSON.parse(readText(statePath)) : {};
  const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  // 跨进程互斥(初始化长跑期间,计划任务的增量自动让行)
  if (!probe && !acquireLock()) return;

  // app-token(缓存约23小时)
  let token = state.appToken;
  if (!(token && state.appTokenExpireAt && Date.now() < state.appTokenExpireAt)) {
    const { token: t, domain } = await fetchAppToken(cfg.kingdee);
    if (domain && domain !== cfg.kingdee.domain) {
      log(`授权信息返回了新的 IDC 域名 ${domain},后续请求已采用`);
      cfg.kingdee.domain = domain;
    }
    state.appToken = token = t;
    state.appTokenExpireAt = Date.now() + 23 * 3600 * 1000;
    saveState();
    log(`app-token 已刷新(缓存至 ${new Date(state.appTokenExpireAt).toLocaleString()})`);
  }
  const modeLabel = mode === 'incremental' ? '增量' : '初始化/复核';
  log(`app-token 就绪(${token.slice(0, 6)}...) [${modeLabel}]`);

  // probe:逐类型验证全链路
  const ctx = {}; // 档案跨条目共享上下文(分类 id→名称/编码 映射)
  if (probe) {
    for (const doc of docs) {
      const q = doc.archive ? { page: '1', page_size: '1' } : { bill_status: opt.billStatus, page: '1', page_size: '1' };
      const data = await kingdeeGet(cfg.kingdee, token, doc.listPath, q);
      log(`probe ${doc.label}:列表 ${data.count} 条(认证正常)`);
      if ((data.rows || []).length) {
        if (doc.afterList) doc.afterList(data.rows, ctx);
        const d = doc.detailPath ? await kingdeeGet(cfg.kingdee, token, doc.detailPath, { id: data.rows[0].id }) : data.rows[0];
        if (doc.archive) console.log(JSON.stringify({ [doc.label]: doc.mapArchive(d, ctx) }, null, 2));
        else console.log(JSON.stringify({ [doc.label]: { 头: doc.mapHead(d), 行: doc.mapLines(d).slice(0, 2) } }, null, 2));
      }
    }
    log('probe 完成:认证、列表、详情、字段映射全链路正常');
    return;
  }

  let mssql = null, pool = null;
  if (!dryRun) {
    mssql = (await import('mssql')).default;
    pool = new mssql.ConnectionPool({
      server: cfg.database.server, port: cfg.database.port || 1433,
      database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
      options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
    });
    await pool.connect();
  }

  let totalIn = 0, totalUp = 0, totalFail = 0;
  try {
    for (const doc of docs) {
      // 列表:订单=已审核+时间窗(端点前移规避实测的边界漏单);档案=无过滤全量+指纹跳过(指引 §四.3)
      const listParams = doc.archive
        ? { page: '1', page_size: String(opt.pageSize) }
        : { bill_status: opt.billStatus, page: '1', page_size: String(opt.pageSize) };
      if (!doc.archive && mode === 'incremental') {
        const now = Date.now();
        listParams.modify_start_time = String(now - opt.windowDays * 86400000);
        listParams.modify_end_time = String(now + opt.endBiasMinutes * 60000);
      }
      const rows = [];
      for (let page = 1; page <= opt.maxPages; page++) {
        const data = await kingdeeGet(cfg.kingdee, token, doc.listPath, { ...listParams, page: String(page) });
        for (const r of data.rows || []) rows.push(r);
        const totalPage = Number(data.total_page || 1);
        if (page === 1) log(`【${doc.label}】列表第 1/${totalPage} 页,共 ${data.count} 条${doc.archive ? '(档案全量)' : mode === 'incremental' ? `(近${opt.windowDays}天修改/新增)` : '(全量)'}`);
        if (page >= totalPage) break;
      }
      if (!rows.length) { log(`【${doc.label}】无符合条件${doc.archive ? '档案' : '单据'}`); continue; }
      if (doc.afterList) doc.afterList(rows, ctx); // 登记分类映射(供后续条目解析 id→名称/编码)

      // 指纹比对先行:算出真正要写的单(新增/有变化)——提示、备份、写入都只针对它们
      let knownFps = new Map();
      if (!dryRun) {
        const fpTable = doc.archive ? doc.table : doc.headTable;
        const rs = await new mssql.Request(pool).query(
          `SELECT 外部数据ID AS id, 外部指纹 AS fp FROM ${fpTable} WHERE 外部数据ID IS NOT NULL`);
        for (const row of rs.recordset) knownFps.set(String(row.id).trim(), row.fp ? String(row.fp).trim() : '');
      }
      const changedRows = rows.filter((row) => {
        const id = String(row.id).trim();
        return !(knownFps.has(id) && knownFps.get(id) === doc.fingerprintOf(row));
      });
      const skipped = rows.length - changedRows.length;
      log(`【${doc.label}】共 ${rows.length} 条,待写入 ${changedRows.length} 条${skipped ? `,无变化跳过 ${skipped}` : ''}`);
      if (!changedRows.length) continue;

      // 规范:批量写入前按"实际写入量"提示(超阈值),并只备份将被影响的单据前像;未确认则整类跳过。
      // 注:备份范围=待写单(增量)或全量前像(初始化);无变化时不产生备份文件。
      if (!dryRun) {
        const ok = await confirmBatch({
          log, label: `【${doc.label}】`, planned: changedRows.length,
          threshold: opt.confirmThreshold, assumeYes,
          timeoutMs: (opt.confirmTimeoutSeconds === undefined ? 5 : opt.confirmTimeoutSeconds) * 1000,
        });
        if (!ok) continue;
        await backupBeforeWrite({
          mssql, pool, baseDir: HERE, panel: doc.code,
          headTable: doc.archive ? doc.table : doc.headTable,
          lineTable: doc.archive ? null : doc.lineTable,
          keyCol: doc.archive ? '外部数据ID' : '单据编号', // 档案以外部锚点定位受影响行
          docNos: mode === 'init' ? null : (doc.archive ? changedRows.map((r) => String(r.id)) : changedRows.map((r) => r.bill_no).filter(Boolean)),
          retentionDays: opt.backupRetentionDays, log,
        });
      }

      let inserted = 0, updated = 0, failed = 0, dup = 0, done = 0;
      for (const row of changedRows) {
        done++;
        if (changedRows.length > 200 && done % 500 === 0) log(`【${doc.label}】进度 ${done}/${changedRows.length}(新增${inserted} 更新${updated})`);
        const fp = doc.fingerprintOf(row);
        const known = knownFps.has(String(row.id).trim());
        try {
          const d = doc.detailPath ? await kingdeeGet(cfg.kingdee, token, doc.detailPath, { id: row.id }) : row; // 仅列表接口的档案直接用列表行
          if (doc.archive) {
            const mapped = {
              ...doc.mapArchive(d, ctx),
              外部数据ID: str(d.id), 外部单据号: str(d.number),
              __创建时间: str(d.create_time),
            };
            if (dryRun) {
              console.log(`—— 【${doc.label}】${d.number || ''} ${d.name || ''}${mapped.__cancel === 'Y' ? '(停用)' : ''}`);
              continue;
            }
            await upsertArchive(doc, mssql, pool, mapped, fp);
            knownFps.set(String(row.id).trim(), fp);
            known ? updated++ : inserted++;
            if (inserted + updated <= 10 || (inserted + updated) % 100 === 0) {
              log(`【${doc.label}】${known ? '更新' : '新增'} ${d.number || d.id} ${d.name || ''}`);
            }
          } else {
            const head = {
              ...doc.mapHead(d),
              外部数据ID: str(d.id),
              __创建时间: str(d.create_time),
              __已关闭: d.bill_close_state === 'S' || d.bill_close_state === 'H',
            };
            const lines = doc.mapLines(d);
            if (dryRun) {
              console.log(`—— 【${doc.label}】${head.单据编号}(${head[doc.code === 'PU_ORDER' ? '供应商' : '客户']}) 状态=${head.单据状态} 行数=${lines.length}`);
              continue;
            }
            await upsertDoc(doc, mssql, pool, head, lines, fp);
            knownFps.set(String(row.id).trim(), fp); // 本轮内去重(列表偶有重复行)
            known ? updated++ : inserted++;
            if (inserted + updated <= 10 || (inserted + updated) % 100 === 0) {
              log(`【${doc.label}】${known ? '更新' : '新增'} ${head.单据编号}(${lines.length} 行)`);
            }
          }
          await sleep(doc.detailPath ? 120 : 20); // 详情调用节流;仅列表档案可更密
        } catch (e) {
          if (/duplicate key|2627|2601/i.test(String(e.message))) {
            dup++; // 并发实例已写入(唯一索引兜底),视为让行
            continue;
          }
          failed++;
          log(`✗ 【${doc.label}】单据 ${row.bill_no || row.id} 处理失败: ${e.message}`);
        }
      }
      log(`【${doc.label}】完成:新增 ${inserted},更新 ${updated},失败 ${failed}${dup ? `,并发让行 ${dup}` : ''}`);
      totalIn += inserted; totalUp += updated; totalFail += failed;
    }
  } finally {
    if (pool) await pool.close();
    releaseLock();
  }

  if (!dryRun) {
    state.lastSyncMs = Date.now();
    saveState();
  }
  log(`全部完成:新增 ${totalIn},更新 ${totalUp},失败 ${totalFail}${dryRun ? '(dry-run 未写库)' : ''}`);
  if (totalFail > 0) process.exitCode = 2;
}
