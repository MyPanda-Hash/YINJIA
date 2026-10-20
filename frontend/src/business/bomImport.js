/**
 * bomImport.js — 物料清单(WLBOM)Excel 批量导入的纯逻辑(2026-10-21)
 *
 * 为什么单独一个模块:模板生成、Excel 解析、按产品分组、校验全是纯函数,能直接被
 * `node --test` 钉住边界;页面组件(BomImportDialog.vue)只负责选文件与调接口。
 *
 * 业务背景(2026-10-21 实测):
 *   · 扫码领料要按 BOM 展开「工单该领哪些料」,但三条料源全断 ——
 *     金蝶 /jdy/v2/bd/bom 真实账套 count=0(3878 个商品一个 BOM 都没建)、
 *     MES 自建 bs_bom + v_wo_kit 已于 2026-10-04 下架、遗留 mate 只剩 T382 一个产品;
 *   · 用户拍板「在 MES 里维护 BOM」⇒ 需要一次录几百个产品的批量入口。
 *
 * 数据落点:WLBOM 面板 = `mate` 表,一行 = 一个「产品 + 子件」组合。
 *   - 表头(一张单一次):物料编码(m_no,必填) / 单据日期 / 物料名称
 *   - 明细(一张单多行):子件代码(wzdm2,必填) / 子件名称 / 规格型号 / 子件单位 /
 *     标准用量(bzl) / 损耗量(sl2) / 单价 / 备注
 *   ⇒ Excel 是**扁平**的(每行都写产品编码),导入时按产品编码**分组**,一个产品一张单。
 */

/** 模板列定义:label 必须与 WLBOM 面板字段名**完全一致**(前端 ImportDialog/引擎按 label 匹配)。 */
export const TEMPLATE_COLUMNS = [
  { key: '物料编码', required: true, note: '成品/半成品编码,如 C-95-13(同一产品的多行写同一个编码)' },
  { key: '物料名称', required: false, note: '成品名称,可留空(系统会按编码带出)' },
  { key: '子件代码', required: true, note: '用料编码,如 YJ-SX-001-2' },
  { key: '子件名称', required: false, note: '用料名称,可留空' },
  { key: '规格型号', required: false, note: '' },
  { key: '子件单位', required: false, note: '如 支 / kg / 米' },
  { key: '标准用量', required: true, note: '生产 1 个单位成品所需的子件数量(数字)' },
  { key: '损耗量', required: false, note: '备损耗量,可留空' },
  { key: '单价', required: false, note: '可留空' },
  { key: '备注', required: false, note: '' },
];

/** 模板表头行(给 Excel 用) */
export function templateHeader() {
  return TEMPLATE_COLUMNS.map((c) => c.key);
}

/**
 * 生成模板的二维数组(表头 + 2 行示例)。
 * 示例行用库里真实存在的数据(T382 → 炭棒/炭纤维),让填表人一眼看懂格式。
 */
export function templateRows() {
  return [
    templateHeader(),
    ['T382', '除重金属炭棒滤芯', 'M-001', '炭棒', '', '支', 1, '', '', '示例行,导入前请删除'],
    ['T382', '除重金属炭棒滤芯', 'M-003', '炭纤维', '', '支', 1, '', '', '示例行,导入前请删除'],
  ];
}

/** 模板说明页(第二个 sheet):写清必填项与分组规则,避免反复问。 */
export function templateNotes() {
  return [
    ['物料清单(BOM)导入说明'],
    [''],
    ['1. 本模板用于批量录入「产品 → 用料」关系,导入后每个产品生成一张物料清单单。'],
    ['2. 必填列:物料编码 / 子件代码 / 标准用量;其余可留空。'],
    ['3. 同一个产品的多行,**物料编码写同一个值**,系统自动合成一张单的多个明细行。'],
    ['4. 标准用量 = 生产 1 个单位成品所需的子件数量,必须是数字。'],
    ['5. 第一行必须是表头(不要改列名、不要插空行),第二行起的示例行请先删除。'],
    ['6. 编码必须与商品档案里的一致,否则导入后领料扫不到对应物料。'],
    [''],
    ['列说明:'],
    ...TEMPLATE_COLUMNS.map((c) => [`  ${c.key}`, c.required ? '必填' : '选填', c.note]),
  ];
}

/**
 * 把 Excel 解析出的二维数组(aoa)转成结构化行。
 *
 * @param {any[][]} aoa sheet_to_json(header:1) 的结果
 * @returns {{ ok: boolean, rows: object[], errors: string[], header: string[] }}
 */
export function parseBomSheet(aoa) {
  if (!Array.isArray(aoa) || !aoa.length) {
    return { ok: false, rows: [], errors: ['Excel 为空'], header: [] };
  }
  const header = (aoa[0] || []).map((h) => String(h == null ? '' : h).trim());
  // 列名 → 列号
  const colOf = {};
  header.forEach((h, i) => { if (h) colOf[h] = i; });

  const missing = TEMPLATE_COLUMNS.filter((c) => c.required && colOf[c.key] === undefined).map((c) => c.key);
  if (missing.length) {
    return { ok: false, rows: [], errors: [`缺少必填列:${missing.join('、')}`], header };
  }

  const rows = [];
  const errors = [];
  for (let ri = 1; ri < aoa.length; ri++) {
    const r = aoa[ri] || [];
    // 整行空 → 跳过(Excel 常带空尾行)
    if (r.every((v) => v === '' || v === null || v === undefined)) continue;

    const pick = (k) => {
      const i = colOf[k];
      if (i === undefined) return '';
      const v = r[i];
      return v === undefined || v === null ? '' : String(v).trim();
    };

    const product = pick('物料编码');
    const item = pick('子件代码');
    const qtyRaw = pick('标准用量');
    const lineNo = ri + 1; // Excel 行号(1-based,含表头)

    if (!product) { errors.push(`第 ${lineNo} 行:物料编码为空`); continue; }
    if (!item) { errors.push(`第 ${lineNo} 行:子件代码为空`); continue; }

    const qty = Number(qtyRaw);
    if (qtyRaw === '' || !Number.isFinite(qty) || qty <= 0) {
      errors.push(`第 ${lineNo} 行:标准用量「${qtyRaw}」不是大于 0 的数字`);
      continue;
    }

    const lossRaw = pick('损耗量');
    const loss = lossRaw === '' ? 0 : Number(lossRaw);

    rows.push({
      物料编码: product,
      物料名称: pick('物料名称'),
      子件代码: item,
      子件名称: pick('子件名称'),
      规格型号: pick('规格型号'),
      子件单位: pick('子件单位'),
      标准用量: qty,
      损耗量: Number.isFinite(loss) ? loss : 0,
      单价: Number(pick('单价')) || 0,
      备注: pick('备注'),
      _line: lineNo,
    });
  }

  if (!rows.length && !errors.length) errors.push('没有可导入的数据行');
  return { ok: errors.length === 0 && rows.length > 0, rows, errors, header };
}

/**
 * 按「物料编码」把扁平行分组成「一个产品一张单」。
 *
 * 组内保持 Excel 原顺序(行序即明细顺序);组间按产品编码首次出现顺序,
 * 让导入结果与填表顺序一致、便于核对。
 *
 * @param {object[]} rows parseBomSheet 的 rows
 * @returns {{ product: string, productName: string, items: object[] }[]}
 */
export function groupByProduct(rows) {
  const order = [];
  const map = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const p = String(r.物料编码 || '').trim();
    if (!p) continue;
    if (!map.has(p)) {
      map.set(p, { product: p, productName: String(r.物料名称 || '').trim(), items: [] });
      order.push(p);
    }
    const g = map.get(p);
    if (!g.productName && r.物料名称) g.productName = String(r.物料名称).trim();
    g.items.push({
      行序: String(g.items.length + 1),
      子件代码: String(r.子件代码 || '').trim(),
      子件名称: String(r.子件名称 || '').trim(),
      规格型号: String(r.规格型号 || '').trim(),
      子件单位: String(r.子件单位 || '').trim(),
      标准用量: Number(r.标准用量) || 0,
      损耗量: Number(r.损耗量) || 0,
      单价: Number(r.单价) || 0,
      备注: String(r.备注 || '').trim(),
    });
  }
  return order.map((p) => map.get(p));
}

/**
 * 把一组拼成 WLBOM 的保存表单(交给 /px/callButton 的「保存」)。
 *
 * 表头必填只有 物料编码(yj_field required=1),单据日期给今天;
 * 单据编号留空由后端 FormNoService 生成。
 *
 * @param {{ product: string, productName: string, items: object[] }} g groupByProduct 的一项
 * @param {{ date?: string }} [opt]
 */
export function buildWlbomForm(g, opt = {}) {
  const today = opt.date || new Date().toISOString().slice(0, 10);
  return {
    物料编码: String(g.product || '').trim(),
    物料名称: String(g.productName || '').trim(),
    单据日期: today,
    detail: { items: Array.isArray(g.items) ? g.items : [] },
  };
}

/**
 * 导入前的一致性体检(纯提示,不阻断):同一产品里子件重复时提示,便于发现复制粘贴错误。
 *
 * @param {{ product: string, items: object[] }[]} groups
 * @returns {string[]} 警告文案
 */
export function checkDuplicates(groups) {
  const out = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    const seen = new Set();
    const dup = new Set();
    for (const it of g.items || []) {
      const c = String(it.子件代码 || '').trim();
      if (!c) continue;
      if (seen.has(c)) dup.add(c);
      seen.add(c);
    }
    if (dup.size) out.push(`${g.product}:子件重复 ${[...dup].join('、')}`);
  }
  return out;
}
