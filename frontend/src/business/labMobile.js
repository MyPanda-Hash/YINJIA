/**
 * labMobile.js — 「手机扫码 · 实验室记录手机登记」的**纯逻辑**(2026-11-09)
 *
 * 【用户口径 2026-11-09】
 *   「研发图片上的 3 个面版也要对应的做手机端,在手机扫码下面,叫实验室记录手机登记。
 *     手机端只需要实现,可以拍照上传和可以填写对应字段的内容就可以。再要一个模糊查询。
 *     还有数据要可以对应回填各自的面版,还有原来每个面版要增加一个字段,
 *     来保存手机拍照上传的文件。」
 *
 * 【本文件只放不碰网络的规则】接口封装在 `business/labMobileApi.js`,页面在
 *   `views/mobile/MobileLabRecord.vue` —— 这样"表单怎么从行模型长出来、保存载荷怎么拼、
 *   列表标题取哪一格"能被 `node --test` 钉死(照 business/mobilePick.js 的既有分层)。
 *
 * 【回填口径 —— 必须记住】手机端**不是另建一套表**:
 *   · 三个面板就是研发管理里那三张 PC 面板本身,手机页 100% 走通用引擎接口(取元数据/取单/保存);
 *   · 保存用 buttonName='保存为草稿'(add/modify 词),状态=草稿 ⇒ 电脑端面板里立刻看到这张单,
 *     审核/归档照电脑端原流程走(手机端不替用户送审);
 *   · 照片走既有附件服务,锚点 = 面板码 + 单据编号 + 字段「手机照片」,
 *     服务端把原文件名串同步回 head 表[手机照片]列(列由 migrate-lab-mobile-20261109.sql 建)。
 *
 * 【键名一律中文】字段键 = yj_field.label(ADR-0001:数据键永不翻译),只有显示层走 tt()。
 */

/** 三个面板(顺序即菜单顺序;path 与 router/index.js 的三条静态路由一一对应) */
export const LAB_PANELS = Object.freeze([
  {
    code: 'RD_SPIKE_WATER',
    title: '加标水配置记录表',
    icon: 'Coin',
    path: '/panelx/list/MOBILE_LAB_SPIKE_WATER',
    /** 列表主标题取哪一格(表头里最能说明"这张单是什么"的字段) */
    titleField: '测试项目',
  },
  {
    code: 'RD_EQUIP_USE',
    title: '设备使用登记表',
    icon: 'Monitor',
    path: '/panelx/list/MOBILE_LAB_EQUIP_USE',
    titleField: '设备名称',
  },
  {
    code: 'RD_INSTR_USE',
    title: '仪器使用记录表',
    icon: 'Odometer',
    path: '/panelx/list/MOBILE_LAB_INSTR_USE',
    titleField: '仪器名称/型号',
  },
])

/** 手机拍照上传落在哪个字段(与迁移脚本的 head 列 / yj_field 行同名) */
export const PHOTO_FIELD = '手机照片'

/** 保存时**不进载荷**的表头键:单据标识与状态由引擎维护,照片列归附件服务维护 */
const SAVE_SKIP_HEADERS = Object.freeze(['单据编号', '单据状态', '编号', '创建时间', '更新时间', PHOTO_FIELD])

/** 面板配置(按码取;未知码返回 null,页面据此提示"面板编号无效") */
export function labPanelOf(panelCode) {
  const code = String(panelCode ?? '').trim()
  if (!code) return null
  return LAB_PANELS.find((p) => p.code === code) || null
}

/** 字段键:面板引擎下发的**表头**字段用 `code`,**明细**字段用 `dataName`(两处键名不同是既有契约) */
export function fieldKeyOf(field) {
  return String(field?.code || field?.dataName || '')
}

/** 存进 form / 明细行的键(同上;两者都取不到就退 label/name) */
export function keyOf(field) {
  return fieldKeyOf(field) || String(field?.label || field?.name || '')
}

/** 今天 yyyy-MM-dd(本地时区;日期字段的默认值) */
export function today(now) {
  const d = now instanceof Date ? now : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 新建时的空表头:服务端默认值优先(单据日期/单据编号预览),日期字段兜底今天,其余空串。
 * @param {any[]} headerFields `/px/getNewFormPermMatrix` 的 meta
 * @param {Record<string, any>} [defaults] 服务端下发的 data
 */
export function emptyHeader(headerFields, defaults) {
  const out = {}
  for (const f of Array.isArray(headerFields) ? headerFields : []) {
    const k = keyOf(f)
    if (!k) continue
    const fromServer = defaults && defaults[k] != null ? defaults[k] : null
    if (fromServer != null) out[k] = fromServer
    else if (String(f.dataType || '') === '日期') out[k] = today()
    else out[k] = ''
  }
  return out
}

/** 新建时的空明细行:每个明细字段都给空串(与 PC newDetailRow() 同款,保证键齐全) */
export function emptyDetailRow(detailFields) {
  const row = {}
  for (const f of Array.isArray(detailFields) ? detailFields : []) {
    const k = keyOf(f)
    if (k) row[k] = ''
  }
  return row
}

/** 已有单据 → 表头表单对象(只取本面板登记过的表头字段,其它键不进模型) */
export function headerValuesOf(headerFields, data) {
  const out = {}
  for (const f of Array.isArray(headerFields) ? headerFields : []) {
    const k = keyOf(f)
    if (!k) continue
    out[k] = data && data[k] != null ? data[k] : ''
  }
  return out
}

/**
 * 已有单据 → 明细行数组。
 * ⚠ 原样保留 `id`:改单时后端按 id 更新行,丢了 id 就变成"追加新行",一改就翻倍。
 */
export function detailRowsOf(detailData, tabKey = 'items') {
  const map = detailData && typeof detailData === 'object' ? detailData : {}
  const list = map[tabKey]
  if (!Array.isArray(list)) return []
  return list.map((r) => ({ ...(r || {}) }))
}

/** 这一行有没有填过东西(全空的行不提交,免得电脑端多出一条空明细) */
export function rowHasValue(row, detailFields) {
  const keys = Array.isArray(detailFields) && detailFields.length
    ? detailFields.map((f) => keyOf(f)).filter(Boolean)
    : Object.keys(row || {})
  return keys.some((k) => String(row?.[k] ?? '').trim() !== '')
}

/**
 * 拼「保存为草稿」的载荷(纯函数,单测钉死)。
 *
 * 契约(与 PanelxList 提交同源,后端 ButtonService.save):
 *   · 表头 = 键为 yj_field.label 的对象;
 *   · 「编号」= 单据标识(改单必传;新单**不传**,由后端 formNoService 发号);
 *   · 明细 = `detail.items`,行键同样是 label。
 * @returns {{payload: object, skippedRows: number}}
 */
export function buildSavePayload({ headerFields, form, rows, detailFields, editingNo }) {
  const payload = {}
  for (const f of Array.isArray(headerFields) ? headerFields : []) {
    const k = keyOf(f)
    if (!k || SAVE_SKIP_HEADERS.includes(k)) continue
    const v = form ? form[k] : ''
    payload[k] = v == null ? '' : v
  }
  const no = String(editingNo || '').trim()
  if (no) payload['编号'] = no
  const all = Array.isArray(rows) ? rows : []
  const kept = all.filter((r) => rowHasValue(r, detailFields))
  payload.detail = { items: kept.map((r) => ({ ...r })) }
  return { payload, skippedRows: all.length - kept.length }
}

/** 列表主标题:优先面板指定的 titleField,取不到退回单据编号 */
export function rowTitleOf(panel, row) {
  const key = String(panel?.titleField || '').trim()
  const hit = key ? String(row?.[key] ?? '').trim() : ''
  if (hit) return hit
  return String(row?.['单据编号'] ?? '').trim()
}

/** 列表副标题:编号 · 日期 · 状态 */
export function rowMetaOf(row) {
  const parts = []
  const no = String(row?.['单据编号'] ?? '').trim()
  const date = String(row?.['单据日期'] ?? '').trim()
  const status = String(row?.['单据状态'] ?? '').trim()
  if (no) parts.push(no)
  if (date) parts.push(date)
  if (status) parts.push(status)
  return parts.join(' · ')
}

/** 这一行有几张照片(附件名串按「、」分隔;空值 = 0) */
export function photoCountOf(row) {
  const raw = String(row?.[PHOTO_FIELD] ?? '').trim()
  if (!raw) return 0
  return raw.split('、').filter((s) => s.trim()).length
}

/** 图片类型判定(缩略图只对图片渲染 <img>,其它给文件名) */
export function isImageName(name) {
  const ext = String(name || '').toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'].includes(ext)
}

/** 文件名(去掉本地路径,Android 相机有时给完整路径) */
export function baseNameOf(name) {
  const s = String(name || '').replace(/\\/g, '/')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}
