/**
 * mobileReturn.js — 手机扫码 · **生产退料**的纯逻辑(2026-11-18 第四轮:改成与「生产领料/扫码混料」同构的明细页)
 *
 * <h3>用户口径(原话)</h3>
 * 「生产退料也要扫码到明细行再扫物料码退料,要和(扫码混料一样)对齐生产领料。」
 *
 * ⇒ 页面结构与作业方式与「生产领料单」(`MobilePickDoc.vue`)/「混料单明细」(`MobileMixDoc.vue`)一致:
 *   列表页查单 → 进**单据明细页** → 扫物料码**解锁对应的明细行** → 填退料数量 → 「确认」记下
 *   (记在该行上,不再另开一张"本次退料"清单)→ 底栏「提交退料」一次性生成生产退料单。
 *
 * <h3>为什么"确认"只记在行上、不逐笔落库</h3>
 * 退料的落库单位是**一整张生产退料单**(`bl_material_ret` 头 + 明细,`wo_pick_return` 台账),
 * 后端没有"退料草稿行"这张表(领料有 `wo_pick_line` 可以逐行写入,退料没有)。
 * 所以逐项「确认」在页面上累加,「提交」时才一次交给 `POST /px/mobilePick/submitReturn` ——
 * 这与领料侧"逐行写库"是不同层的东西,不是漏做;提交流程本身完全一致。
 *
 * <h3>数量口径(后端同一真源)</h3>
 * 可退 = 已领 − 已退(累计,可分批退);判据与 `MobilePickController.returnScan/submitReturn`
 * 完全一致,页面只是把服务端给的数摆出来,不自己造规则。
 */

/** 四位小数取整(与后端 decimal 口径一致,消掉浮点尾差) */
export function round4(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10000) / 10000
}

/**
 * 领料单明细 → 退料页的行模型。
 *
 * @param {any[]} lines `GET /px/mobilePick/doc` 的 `领料明细`(带 已退数量)
 * @returns {any[]} 每行 { 行号, 编码, 名称, 规格, 单位, 批号, 已领, 已退, 可退, 本次退 }
 */
export function toReturnRows(lines) {
  return (Array.isArray(lines) ? lines : []).map((l, i) => {
    const picked = round4(l?.数量)
    const returned = round4(l?.已退数量)
    const can = round4(Math.max(0, picked - returned))
    return {
      // 行号是**行标识**:2026-11-24 起同一物料可能有多行(不同 仓库/批号),不能再用物料编码当键
      行号: String(l?.行号 ?? i + 1),
      编码: String(l?.编码 ?? '').trim(),
      名称: String(l?.名称 ?? '').trim(),
      规格: String(l?.规格 ?? '').trim(),
      单位: String(l?.单位 ?? '').trim(),
      仓库: String(l?.仓库 ?? '').trim(),
      仓库编码: String(l?.仓库编码 ?? '').trim(),
      批号: String(l?.批号 ?? '').trim(),
      已领: picked,
      已退: returned,
      可退: can,
      // 本次要退多少(扫到料解锁后填,「确认」写进来)
      本次退: 0,
    }
  })
}

/**
 * 确认一项:把数量写进该物料的明细行(覆盖,不是累加)。
 *
 * <p>与「生产领料」的写入、「混料」的确认同一语义:同一物料再确认一次以最后一次输入为准。
 * 数量必须 0 < qty ≤ 可退,超了不猜、直接拒(后端提交时也会再校一次)。
 *
 * <p>🔴 2026-11-24 用户口径「出库单和入库单要做到不同批次号和仓库是分开记录明细的」:
 * 领料单明细拆行后,**同一物料可能有多行**(每行一个 仓库+批号)。这里按行序(批号先进先出)
 * 把数量分摊到各行上 —— 与后端 {@code submitReturn} 的分摊顺序一致,所以页面上看到
 * "哪一批退多少"就是提交后真落库的那些行。扫到的码带批号时,那一批排最前。
 *
 * @param {any[]} rows {@link toReturnRows} 的结果(就地更新 本次退)
 * @param {{ code: string, qty: number, batch?: string, warehouse?: string }} p
 * @returns {{ ok: boolean, reason?: 'miss'|'no-qty'|'over', row?: any, index?: number }}
 */
export function applyReturn(rows, p) {
  const code = String(p?.code || '').trim()
  const qty = round4(p?.qty)
  if (!code) return { ok: false, reason: 'miss' }
  if (!(qty > 0)) return { ok: false, reason: 'no-qty' }
  const list = Array.isArray(rows) ? rows : []
  // 该物料的全部明细行(可能有多批)
  const targets = list.filter((r) => String(r?.编码 || '').trim() === code)
  if (!targets.length) return { ok: false, reason: 'miss' }
  const canAll = round4(targets.reduce((s, r) => s + round4(r.可退), 0))
  if (qty > round4(canAll)) return { ok: false, reason: 'over', row: targets[0], index: list.indexOf(targets[0]) }

  // 扫到的码带批号/仓库 ⇒ 那一行排最前(其余保持先进先出)
  const batch = String(p?.batch || '').trim()
  const warehouse = String(p?.warehouse || '').trim()
  const order = targets.slice()
  if (batch || warehouse) {
    const rank = (r) => ((!batch || r.批号 === batch) && (!warehouse || r.仓库 === warehouse) ? 0 : 1)
    order.sort((a, b) => rank(a) - rank(b))
  }

  for (const r of targets) r.本次退 = 0
  let left = qty
  for (const r of order) {
    if (left <= 0) break
    const take = round4(Math.min(left, round4(r.可退)))
    r.本次退 = take
    left = round4(left - take)
  }
  return { ok: true, row: order[0], index: list.indexOf(order[0]) }
}

/** 清空本次退料(全部行归 0) */
export function clearReturnQty(rows) {
  for (const r of Array.isArray(rows) ? rows : []) r.本次退 = 0
}

/**
 * 本次退料汇总 / 提交闸门判据。
 *
 * <p>与领料的「每行都有数量」**不同**:退料是**部分退**,没人规定每个料都要退。
 * 判据只有一条 —— 至少有一行填了数量(合计 > 0),否则提交一张空退料单毫无意义。
 *
 * @param {any[]} rows {@link toReturnRows} 的结果
 * @returns {{ total: number, done: number, totalQty: number, canTotal: number, ok: boolean, items: {code:string,qty:number}[] }}
 */
export function returnProgress(rows) {
  const arr = Array.isArray(rows) ? rows : []
  // 同一物料可能有多行(不同 仓库/批号)⇒ 提交项按**物料编码聚合**,数量为各批之和
  // (后端 submitReturn 再按出库行先进先出分摊,顺序与本页 applyReturn 一致)
  const byCode = new Map()
  for (const r of arr) {
    const q = round4(r.本次退)
    if (q <= 0) continue
    const code = String(r.编码 || '').trim()
    byCode.set(code, round4((byCode.get(code) || 0) + q))
  }
  const items = [...byCode].map(([code, qty]) => ({ code, qty }))
  const totalQty = round4(items.reduce((s, x) => s + x.qty, 0))
  const canTotal = round4(arr.reduce((s, r) => s + round4(r.可退), 0))
  return {
    total: arr.length,
    done: items.length,
    totalQty,
    canTotal,
    ok: items.length > 0 && totalQty > 0,
    items,
  }
}
