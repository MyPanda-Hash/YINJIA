/**
 * 生单对话框的「仓库 / 仓位」预填 —— 纯函数 + 一处取数(2026-11-13 用户口径)。
 *
 * 【用户原话】
 *   「从采购订单生单的时候就开始预填仓库仓位」;
 *   「生单可以选仓库和仓位,可以每行不一样,也可以所有行带入第一个填入的仓库和仓位」。
 *
 * 【为什么放在这里】
 *   两个生单对话框(GenerateLinesDialog 统一生单 / BatchSendDialog 分批送料)**都要**这几件事:
 *     ① 取仓库档案(WH)与仓位档案(WHLOC);
 *     ② 按行的仓库算仓位候选(仓位档案的「仓库」是仓库名称,与单据「仓库」同口径);
 *     ③ 组「仓库 + 仓位」提交键(后端 PushGenerateHandler.WHBIN_KEYS 一一对应)。
 *   复制两份迟早会漂(代码规范 D),故抽成这一份,组件只负责渲染。
 *
 * ⚠ 数据键永远是中文(ADR-0001):这里的键名就是 yj_field 的 label,不随语言变化。
 */

/** 提交给后端的键(与后端 PushGenerateHandler.WHBIN_KEYS 同口径) */
export const WHBIN_KEYS = ['仓库', '仓库编码', '仓库id', '仓库启用仓位管理', '仓位', '仓位id', '仓位名称']

/** 仓库档案 / 仓位档案的面板码(档案面板,queryFormDataList 按档案模式全量返回) */
export const WH_PANEL = 'WH'
export const WHLOC_PANEL = 'WHLOC'

/** 取字符串(空值/空白统一成 '') */
function s(v) {
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * 取仓库档案与仓位档案的候选(生单对话框打开时拉一次)。
 *
 * @returns {{ warehouses: Array<{name:string, code:string, binManaged:boolean}>,
 *             bins: Array<{wh:string, whCode:string, code:string, name:string, isDefault:boolean}> }}
 *   失败不抛:`warehouses`/`bins` 退化成空数组 —— 生单本身不该因为"档案读不到"就不能做
 *   (那时 仓库/仓位 留空,由下游单自己填,与改造前一致)。
 */
export async function loadWhBinSources(engine) {
  const out = { warehouses: [], bins: [] }
  const read = async (panelCode, pageSize) => {
    try {
      const res = await engine.queryFormDataList({ panelCode, condition: {}, pageNo: 1, pageSize })
      return flattenRows(Array.isArray(res?.list) ? res.list : [])
    } catch (e) {
      return []
    }
  }
  const [whRows, binRows] = await Promise.all([read(WH_PANEL, 500), read(WHLOC_PANEL, 5000)])
  out.warehouses = (whRows || [])
    .filter((r) => s(r['仓库名称']) !== '' || s(r['仓库编码']) !== '')
    .filter((r) => !isCancelled(r))
    .map((r) => ({
      name: s(r['仓库名称']) || s(r['仓库编码']),
      code: s(r['仓库编码']),
      // 「启用仓位管理」是 bit/0-1:只为真时才在界面上提示"该仓要填仓位"
      binManaged: r['启用仓位管理'] === true || s(r['启用仓位管理']) === '1' || s(r['启用仓位管理']) === 'True',
    }))
  out.bins = (binRows || [])
    .filter((r) => s(r['仓位编码']) !== '')
    .filter((r) => !isCancelled(r))
    .map((r) => ({
      wh: s(r['仓库']),
      whCode: s(r['仓库编码']),
      code: s(r['仓位编码']),
      name: s(r['仓位名称']) || s(r['仓位编码']),
      isDefault: r['是否默认'] === true || s(r['是否默认']) === '1' || s(r['是否默认']) === 'True',
    }))
  return out
}

/** 档案行是否已停用/作废(两种列名都见过:停用 / asp_cancel) */
function isCancelled(r) {
  const off = r['停用']
  if (off === true || s(off) === '1' || s(off).toLowerCase() === 'true') return true
  return s(r['asp_cancel']).toUpperCase() === 'Y'
}

/**
 * 把接口返回的行摊平。
 *
 * ⚠ 仓库档案(WH)与仓位档案(WHLOC)在元数据里是**单单据/档案带明细**形态:
 *   `queryFormDataList` 回的是 `[{ 编号, 状态, 单据状态, detail: { wh: [...] } }]`(WH)
 *   与 `detail: { locations: [...] }`(WHLOC)—— 真正的仓库/仓位行在 detail 的数组里。
 *   直接按 r['仓库名称'] 读会**全是 undefined**(实测:下拉一个候选都没有),故这里统一摊平。
 * 已经是平表的行原样保留(将来档案改成 flat 也不用改这里)。
 */
function flattenRows(list = []) {
  const out = []
  for (const r of list || []) {
    if (!r || typeof r !== 'object') continue
    const detail = r.detail && typeof r.detail === 'object' ? r.detail : null
    const arr = detail ? Object.values(detail).find((v) => Array.isArray(v)) : null
    if (Array.isArray(arr) && arr.length) out.push(...arr)
    else out.push(r)
  }
  return out
}

/**
 * 某仓库下可选的仓位(按仓库**名称**匹配,名称缺失时退回仓库编码)。
 * 仓位档案的「仓库」存的是仓库名称快照(见 ButtonService.presetBinFor 同款注释)。
 */
export function binsOfWarehouse(bins, whName) {
  const wh = s(whName)
  if (!wh) return []
  return (bins || []).filter((b) => b.wh === wh || (b.whCode && b.whCode === wh))
}

/** 某仓库的默认仓位(仓位档案「是否默认」;多个取编码最小者,与 presetBinFor 同口径) */
export function defaultBinOf(bins, whName) {
  const list = binsOfWarehouse(bins, whName).filter((b) => b.isDefault)
  if (!list.length) return ''
  return [...list].sort((a, b) => String(a.code).localeCompare(String(b.code)))[0].code
}

/**
 * 组装某一行要提交的「仓库 / 仓位」键值。
 *
 * @param {object} opts
 * @param {Array}  opts.warehouses 仓库档案行
 * @param {Array}  opts.bins       仓位档案行
 * @param {string} opts.warehouse  本行选的仓库名(空 = 没选,整组不提交)
 * @param {string} opts.bin        本行选的仓位编码(空 = 没选)
 * @returns {object} 空对象 = 本行没有预填(后端按原口径走映射/预设)
 */
export function whBinPayload({ warehouses = [], bins = [], warehouse = '', bin = '' } = {}) {
  const wh = s(warehouse)
  if (!wh) return {}
  const whRow = (warehouses || []).find((w) => w.name === wh || w.code === wh) || null
  const out = { 仓库: wh }
  if (whRow?.code) out['仓库编码'] = whRow.code
  if (whRow) out['仓库启用仓位管理'] = whRow.binManaged ? '1' : '0'
  const binCode = s(bin)
  if (binCode) {
    out['仓位'] = binCode
    const binRow = binsOfWarehouse(bins, wh).find((b) => b.code === binCode) || null
    if (binRow?.name) out['仓位名称'] = binRow.name
  }
  return out
}
