/**
 * scanPick.js — 条码扫码领料的纯逻辑(2026-10-18)
 *
 * 为什么单独一个模块:码解析与「可领量」判定都是纯函数,能直接被 `node --test` 钉住边界;
 * 页面组件(views/scm/ScanPick.vue)只负责交互与请求。
 *
 * 业务背景:
 *   · 条码管理三个面板的码内容固定为 `存货编码|批号`(见 v_barcode_material 视图);
 *   · 用户在「材料出库单」里选商品会看到「没有库存」—— 那是库存状况表按(物料,仓库)
 *     聚合、且此前只回填前 500 行的毛病(已另修 fillCurrentStock);仓库作业真正要的是
 *     **批号级可用量**,对应视图 `v_stock_pick`(kucun 三键: 物料/仓库/批号,只出有货的行)。
 *   · 所以扫码领料必须按「码里带出来的批号」查可用量,而不是按商品合计。
 */

/**
 * 解析条码标签的码内容。
 *
 * 码内容格式固定 `存货编码|批号`。批号可能为空(不分批物料),但不允许出现第三段
 * —— 那通常说明扫到了别的码(比如箱码/托盘码还没实现),必须当场拦下而不是猜。
 *
 * @param {string} raw 扫码枪或手工输入的原串
 * @returns {{ ok: boolean, code: string, batch: string, reason?: 'empty'|'no-code'|'too-many' }}
 */
export function parseBarcode(raw) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return { ok: false, code: '', batch: '', reason: 'empty' }
  const parts = text.split('|')
  const code = (parts[0] || '').trim()
  const batch = (parts[1] || '').trim()
  if (!code) return { ok: false, code: '', batch: '', reason: 'no-code' }
  if (parts.length > 2) return { ok: false, code, batch, reason: 'too-many' }
  return { ok: true, code, batch }
}

/**
 * 从 `STOCK_PICK`(v_stock_pick)的行里挑出与扫码结果匹配的那些。
 *
 * 匹配口径:存货编码全等(trim 后),批号全等(trim 后;两边都空也算相等)。
 * 不做模糊匹配 —— 存货编码里存在 `M-001` 与 `XM-001` 这种前缀包含关系(见 invCarry 的教训),
 * 模糊匹配会领错料。
 *
 * @param {any[]} rows STOCK_PICK 的行
 * @param {{ code: string, batch: string }} parsed parseBarcode 的结果
 * @returns {any[]} 匹配到的行(编码相同的全部;同批号的排前面)
 */
export function matchPickRows(rows, parsed) {
  const code = String(parsed?.code || '').trim()
  const batch = String(parsed?.batch || '').trim()
  if (!code) return []
  // ⚠ 实测修正(2026-10-18):**不能按批号过滤**。条码视图的批号是采购入库时派生的
  //   (`日期码+流水`,如 20261014001),而 kucun 里实际批号是 SX-20261007 这类、还有 210 行批号为空 ⇒
  //   849 个材料条码按「编码+批号」全等匹配 v_stock_pick 命中 0;忽略批号只按编码匹配则 849/849 全中。
  //   所以批号只用于**排序优先**(同批号先出,顺带按先进先出),不作为过滤条件。
  const hits = (Array.isArray(rows) ? rows : []).filter((row) => (
    row && String(row['存货编码'] || '').trim() === code
  ))
  if (!batch || hits.length < 2) return hits
  return hits
    .map((row, i) => ({ row, i, same: String(row['批号'] || '').trim() === batch ? 0 : 1 }))
    .sort((a, b) => a.same - b.same || a.i - b.i)   // 稳定:同批号优先,其余保持原序
    .map((x) => x.row)
}

/**
 * 判定一次领料动作是否可提交。
 *
 * @param {{ qty: number, available: number }} p qty=本次领用, available=该(物料,仓库,批号)的现存量
 * @returns {{ ok: boolean, reason?: 'no-qty'|'exceed'|'no-stock' }}
 */
export function checkPickQty({ qty, available }) {
  const n = Number(qty)
  const stock = Number(available)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: 'no-qty' }
  if (!Number.isFinite(stock) || stock <= 0) return { ok: false, reason: 'no-stock' }
  // 允许小数(kg/米),按 4 位比较,避免 0.1+0.2 的浮点尾差误判
  if (Math.round(n * 10000) > Math.round(stock * 10000)) return { ok: false, reason: 'exceed' }
  return { ok: true }
}

/**
 * 把已经扫码确认的行拼成「材料出库单」的 formData(交给 /px/callButton 保存成草稿)。
 *
 * 明细必填列来自 yj_field(MATERIAL_OUT):材料编码 / 材料名称 / 计量单位 / 数量。
 * 头必填:单据日期 / 单据编号 / 业务类型 —— 单据编号留空由后端 FormNoService 生成,
 * 业务类型默认「生产领料」。
 *
 * @param {any[]} lines 已确认的领料行
 * @param {{ date?: string, warehouse?: string }} [head]
 * @returns {object} formData
 */
export function buildMaterialOutForm(lines, head = {}) {
  const today = head.date || new Date().toISOString().slice(0, 10)
  const items = (Array.isArray(lines) ? lines : []).map((l, i) => ({
    行号: String(i + 1),
    材料编码: String(l.code || '').trim(),
    材料名称: String(l.name || '').trim(),
    计量单位: String(l.uom || '').trim(),
    批次号: String(l.batch || '').trim(),
    仓库: String(l.warehouse || head.warehouse || '').trim(),
    数量: Number(l.qty),
    单价: Number(l.price) || 0,
    金额: Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 10000) / 10000,
    明细备注: '扫码领料',
  }))
  return {
    单据日期: today,
    单据编号: '',            // 后端生成
    业务类型: '生产领料',
    仓库: String(head.warehouse || '').trim(),
    单据状态: '草稿',
    备注: '条码扫码领料',
    detail: { items },
  }
}
