/**
 * qcInspReqApi.js — 两个「来料检验要求」面板的取数唯一入口。
 *
 * 面板(2026-10-04 拆分,表太多不再挤在一个面板里):
 *   · QC_INSP_REQ        7 张**固定**表(Excel 一比一)+ 每表可加自定义列
 *   · QC_INSP_REQ_SERIES 10 张**全自定义**表(阻垢系列…原料来料)
 * 检验数据记录不关心要求维护在哪张表上 ⇒ fetchReqRows 一次取**两个面板**并合并,
 * 「检验要求」弹窗与报告带入都走它(同一口径,不会出现"弹窗看得到、报告带不进来")。
 *
 * 档案式面板:整表一张虚拟单,服务端按 condition 收窄,前端再按 物料编号 精确过滤(见 qcInspReqLookup)。
 */
import request from '@/core/request'
import { detailRowsOf } from '@core/panel/detailRows'
import { QC_INSP_REQ_PANEL, QC_INSP_REQ_SERIES_PANEL, QC_INSP_REQ_PANELS } from '@core/views/qcInspReqConfig'
import { normCode } from './qcInspReqLookup.js'

/** 面板码再导出:调用方(报告/弹窗)从取数入口一处拿到面板常量,不用再多 import 一个模块 */
export { QC_INSP_REQ_PANEL, QC_INSP_REQ_SERIES_PANEL, QC_INSP_REQ_PANELS }

/**
 * 取某物料在**一个**来料检验要求面板里的全部行(未过滤;分组/匹配交给 qcInspReqLookup)。
 * @param {string} panelCode 面板码(QC_INSP_REQ / QC_INSP_REQ_SERIES)
 * @param {string} materialCode 物料编码/编号(两侧 trim 后精确匹配)
 * @returns {Promise<Array<object>>} 要求行(空编码或没命中给空数组)
 */
export async function fetchReqRowsOfPanel(panelCode, materialCode) {
  const code = normCode(materialCode)
  if (!code) return []
  const res = await request.post('/px/queryFormDataList', {
    panelCode,
    condition: { 物料编号: code },
    pageNo: 1,
    pageSize: 1,
  })
  const doc = res?.data?.list?.[0]
  // ⚠ 明细键 = yj_panel.detail_key(LOWER(panel_code)),**不是** items ——
  //   照 detail.items 取会恒空,报表现象就是「该物料未维护来料检验要求」(见 detailRows.js 说明)
  return detailRowsOf(doc, String(panelCode).toLowerCase())
}

/**
 * 取某物料在**两个**来料检验要求面板里的全部行(合并;调用方按 物料类别 分组)。
 * 单面板取数失败按空算,不让一个面板挂掉整条带入链。
 * @returns {Promise<Array<object>>} 合并后的行
 */
export async function fetchReqRows(materialCode) {
  const code = normCode(materialCode)
  if (!code) return []
  const results = await Promise.all(QC_INSP_REQ_PANELS.map((p) => fetchReqRowsOfPanel(p, code).catch(() => [])))
  return results.flat()
}

/* ── 动态字段(每张表各自的自定义列) ──
 * 检验要求表自己的字段清单:QcInspReqSheet(渲染)与检验报告(带入)都要它 ——
 * 同一份数据两处各拉一次是浪费,更怕两处口径不一致,故在此统一取,并做短缓存。
 * /px/extFields 任何登录用户可读(写操作服务端 requireAdmin)。 */
const extCache = new Map()   // panelCode -> {at, data}
const EXT_TTL_MS = 30_000
const EMPTY_OVERVIEW = { fields: [], tabs: [], tabPools: {}, capacity: 20 }

/**
 * 取该面板的动态字段总览。
 * @returns {Promise<{fields:Array, tabs:string[], tabPools:object, capacity:number}>}
 *   fields = [{id,label,col,dataType,place,tab,parent}];tabs = 页签集(顺序=扩展池分段序);
 *   tabPools = {页签: {capacity,used,free,from,to}}
 */
export async function fetchExtOverview(panelCode = QC_INSP_REQ_PANEL, { force = false } = {}) {
  const key = String(panelCode)
  const hit = extCache.get(key)
  const now = Date.now()
  if (!force && hit && now - hit.at < EXT_TTL_MS) return hit.data
  try {
    const res = await request.get('/px/extFields', { params: { panel: key } })
    const data = res?.data || {}
    const out = {
      fields: Array.isArray(data.fields) ? data.fields : [],
      tabs: Array.isArray(data.tabs) ? data.tabs : [],
      tabPools: data.tabPools || {},
      capacity: data.capacity ?? 20,
    }
    extCache.set(key, { at: now, data: out })
    return out
  } catch {
    return hit?.data || EMPTY_OVERVIEW
  }
}

/** 只要字段清单(兼容按字段调用的地方) */
export async function fetchExtFields(panelCode = QC_INSP_REQ_PANEL, opts) {
  return (await fetchExtOverview(panelCode, opts)).fields
}

/** 让缓存失效(管理员加/停列之后调,避免 30s 内还按旧字段表渲染);不传面板=全清 */
export function invalidateExtFields(panelCode) {
  if (panelCode) extCache.delete(String(panelCode))
  else extCache.clear()
}
