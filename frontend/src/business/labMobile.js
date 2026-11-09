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

/** 手机拍照上传落在哪个字段(与迁移脚本的明细列 / yj_field 行同名)。
 *  2026-11-09 第二轮:照片**按明细行**存(每一行都可能要拍照),见 rowPhotoKey。 */
export const PHOTO_FIELD = '手机照片'

/** 保存时**不进载荷**的表头键:单据标识与状态由引擎维护,照片值归明细行/附件服务维护 */
const SAVE_SKIP_HEADERS = Object.freeze(['单据编号', '单据状态', '编号', '创建时间', '更新时间', PHOTO_FIELD])

/**
 * 某一明细行的照片**附件锚点**:`手机照片-<行 id>`。
 *
 * 用户口径(2026-11-09 第二轮)「附件…加在明细字段内,就是表格里面,每一行都有可能要拍照保存」⇒
 * 附件不能再按"整单一组"挂,必须按行挂;行 id 是行身份的稳定凭据(后端 AttachmentService 据此只更新那一行)。
 * 新行在保存前没有 id ⇒ 返回空串,页面据此先把照片排队、保存拿到 id 再补传。
 * @param {{id?: number|string}|null|undefined} row
 * @returns {string} 例 '手机照片-12';无 id 返回 ''
 */
export function rowPhotoKey(row) {
  const id = row?.id
  if (id === null || id === undefined || String(id).trim() === '') return ''
  return `${PHOTO_FIELD}-${String(id).trim()}`
}

/**
 * 保存后把服务端给的**行 id 回填**到本地行模型(照片上传靠它)。
 *
 * 为什么要这一步:手机端允许"先拍照、后保存"。新行在保存前没有 id ⇒ 照片先按行排队;
 * 保存成功后必须知道"刚才是哪一行换来了哪个 id",才谈得上把排队照片传到那一行。
 * 规则(与后端 upsert 行为对齐):**带 id 的行按 id 对齐;不带 id 的行按出现顺序占用剩下的 id**。
 * ⚠ 原地改本地行对象(保留 `__k` 等本地字段),不返回新数组 —— 页面里的排队照片是按 `__k` 索引的。
 * @param {any[]} localRows 页面当前行(可能含 __k / 已上传照片)
 * @param {any[]} serverRows 保存后重新拉到的明细行(带 id)
 * @returns {{rows: any[], assigned: number}} assigned = 本次补上 id 的行数
 */
export function mergeRowIds(localRows, serverRows) {
  const local = Array.isArray(localRows) ? localRows : []
  const server = (Array.isArray(serverRows) ? serverRows : []).filter((r) => r && r.id != null)
  const usedIds = new Set(local.filter((r) => r && r.id != null).map((r) => String(r.id)))
  let assigned = 0
  for (const row of local) {
    if (!row || row.id != null) continue
    const hit = server.find((s) => !usedIds.has(String(s.id)))
    if (!hit) break
    row.id = hit.id
    usedIds.add(String(hit.id))
    assigned += 1
  }
  return { rows: local, assigned }
}

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

/* ───────────── 加标水:「测试项目」决定明细列(2026-11-09 第五轮) ───────────── */

/**
 * 加标水配置记录表的「明细列」跟着**测试项目**变(用户口径 2026-11-09):
 *   「加标水配置记录表这个面版的字段是根据测试项目变化的,而且可以新增模板自己进行配置字段。
 *     所以手机端要实现能够对应测试项目,明细有所变化」
 *
 * 电脑端的口径(见 core/panel/spikeWaterLayout.js):一个标准库条目 = 一套表格样式,
 * 列定义存在 `yj_std_lib.content` 的 JSON 里;选了哪个条目就取哪套列。手机端要跟它一致,
 * 所以这里只放**纯函数**:选项怎么来、选中条目怎么找到、列怎么映射成字段 —— 渲染与取数在页面里。
 */
export const SPIKE_WATER_CODE = 'RD_SPIKE_WATER'

/** 决定明细列结构的那条标准库字段(panel=RD_SPIKE_WATER 的表头字段) */
export const TEMPLATE_FIELD = '测试项目'

/** 加标水「测试项目」的标准库编码(yj_field.dict_sql) */
export const TEMPLATE_LIB = 'lab.test_item'

const isDisabledLibRow = (r) => String(r?.enabled ?? '1') === '0' || r?.enabled === false
const rowContentOf = (r) => String(r?.content ?? '').trim()
const rowCodeOf = (r) => String(r?.item_code ?? r?.item ?? '').trim()

/**
 * 标准库条目 → 下拉选项名。
 *
 * 口径与电脑端「测试项目」下拉一致:**老式条目**(早期手工建的,`item_code` 全是「默认」、
 * 真正的名字写在 content 里,如 `NSF 42-余氯`)用 content 当选项名;新式条目(content 是列结构 JSON)
 * 用 item_code。停用条目不进候选(`enabled=0`),同名去重。
 *
 * @param {Array} rows `/stdlib/list` 返回的条目
 * @returns {string[]}
 */
export function stdLibOptions(rows) {
  const out = []
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r == null || isDisabledLibRow(r)) continue
    const content = rowContentOf(r)
    const code = rowCodeOf(r)
    const label = content.startsWith('{') ? code : (content || code)
    if (!label || out.includes(label)) continue
    out.push(label)
  }
  return out
}

/**
 * 选中项 → 该条目的 content(找不到返回空串)。
 * 先按"新式条目"匹配 item_code,再按"老式条目"匹配 content —— 与电脑端 loadSpikeWaterLayout 同序。
 */
export function stdLibContentOf(rows, picked) {
  const want = String(picked ?? '').trim()
  if (!want) return ''
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && !isDisabledLibRow(r))
  const asJson = list.find((r) => rowContentOf(r).startsWith('{') && rowCodeOf(r) === want)
  if (asJson) return rowContentOf(asJson)
  const hit = list.find((r) => rowCodeOf(r) === want || rowContentOf(r) === want)
  return hit ? rowContentOf(hit) : ''
}

/** 字段名归一(去掉表头里的字面量 `\n`/换行/空白),用于"模版列 ↔ 面板元数据字段"对号 */
const normFieldName = (s) => String(s ?? '').replace(/\\n|\r?\n/g, '').replace(/\s+/g, '').trim()

/**
 * 模版列 → 明细字段(页面按 `dataName` 取值,与面板元数据字段同一副形状,渲染路径不用分叉)。
 *
 * ⚠ **类型要从面板元数据继承**:列结构只描述"有哪些列、叫什么、多宽、怎么分格",不含 dataType;
 *   手机端要按类型决定控件(日期 → 日期选择器)。这里原先一律写死「文本」,
 *   结果加标水的「测试日期」在手机上只能手打、没有日期选择器(用户 2026-11-09 报障:
 *   「手机端的测试日期没有时间选择器」)。所以按列名去面板元数据里找同名字段,继承 dataType/options。
 *
 * @param {Array<{key:string,label?:string,w?:number,group?:string}>} cols parseLayout 的 cols
 * @param {Array} [metaFields] 面板明细元数据字段(用于继承类型)
 * @returns {Array<{dataName:string,name:string,dataType:string,width:number,group?:string}>}
 */
export function templateDetailFields(cols, metaFields = []) {
  const meta = Array.isArray(metaFields) ? metaFields : []
  const srcOf = (key, label) => {
    const k = normFieldName(key)
    const l = normFieldName(label)
    return meta.find((f) => normFieldName(f?.dataName) === k)
      || meta.find((f) => normFieldName(f?.dataName) === l)
      || meta.find((f) => normFieldName(f?.name) === k)
      || meta.find((f) => normFieldName(f?.name) === l)
      || null
  }
  return (Array.isArray(cols) ? cols : [])
    .filter((c) => c && String(c.key || '').trim())
    .map((c) => {
      const key = String(c.key).trim()
      const label = String(c.label || key).trim() || key
      const src = srcOf(key, label)
      const f = {
        dataName: key,
        name: label,
        dataType: String(src?.dataType || '文本').trim() || '文本',
        width: Number(c.w) > 0 ? Number(c.w) : 90,
        fromTemplate: true,
      }
      if (Array.isArray(src?.options) && src.options.length) f.options = src.options.slice()
      if (src?.isNotNull) f.isNotNull = src.isNotNull
      if (c.group) f.group = String(c.group)
      return f
    })
}

/**
 * 手机端这一屏到底渲染哪些明细字段。
 *
 *  · 加标水(有模版) ⇒ **模版列** + 元数据里那个附件列(手机照片);模版解析失败时
 *    `layout.cols` 已是内置兜底列集(parseLayout 保证),渲染不报错;
 *  · 其它面板(或还没选测试项目)⇒ 原样用面板明细元数据,行为一字不变。
 *
 * @param {{isTemplate:boolean, layout:{cols?:Array}|null, metaFields:Array}} p
 */
export function visibleDetailFields({ isTemplate, layout, metaFields }) {
  const meta = Array.isArray(metaFields) ? metaFields : []
  const cols = layout && Array.isArray(layout.cols) ? layout.cols : null
  if (!isTemplate || !cols || !cols.length) return meta
  const attach = meta.filter((f) => String(f?.dataType || '') === '附件')
  return [...templateDetailFields(cols, meta), ...attach]
}