<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表 · **纵向表版**(一行一个检验项目)

       用户口径(2026-10-17 第六轮):
         「好的当前制程检验形式错误了,这个内容进行修改实现,当前这个修改一下内容实现,不需要那些外观什么的」
         「等下,表头内容可以不进行修改,当前针对检验结果处的格式进行修改即可」
       ⇒ 抬头(单据要素)与结论区**照旧不动**;只把「检验结果」那块从"表区分组横表(外观/尺寸/出货重量)"
         改成《生产相关品质检验.xlsx》制程检验页签第二块的**纵向表**:
           表头1:客户名称 | 产品编码 | 型号（mm） | 批号 | 检验人员：<值>(跨下面两列) | 产线常规功能性结果 | 结果判断
           表头2:以下检验要求自动填充出货检验计划表 | 以下检验方法自动填充出货检验计划表
           表体 :一行一个检验项目 —— 检验要求 | 检验方法 | 产线常规功能性结果 | 结果判断
         ⇒ 「表区」不再进纸面(数据里仍保留该列,由「带入检验项目」按检验类型写入);
           同批撤掉格数/测量值那套"一项一列"的渲染(字段仍在库里,列表页/报表照旧)。

       ⚠ 左四列(客户名称/产品编码/型号（mm）/批号)是**单据级**值(头字段),纵向合并铺满整个表体;
         其余四列是**明细级**值,一行一值。字段键与 yj_field 登记一致(型号→规格型号、批号→批次号)。
       ⚠ 检验要求/检验方法 = 多行域,`autosize{minRows:3,maxRows:12}`(**一打开就 3 行高**,随内容继续长高);
         2026-10-17 口径「当前超出当前行的内容框体要边长才行」+「将当前一开始的框体就变大一点」。
       ⚠ 手工新增的行:检验要求 填了内容而 检验项目 还空着时,顺手把同一段文字写进 检验项目
         (行的身份键,列表页按它显示;带入的行两者都有,不受影响)。
       ⚠ 2026-11-06(承接用户口径「制程检验单接入两级审批」)本纸同批改动:
          · **两级审批**:检验人=编制(提交审批时后端自动写提交人、空值兜底)/ 审核=一级审批人 /
            批准=超级管理员(二级审批通过才落值) ⇒ 表尾补「批准」格(head['审批人'],恒只读);
          · **工序已隐去**(yj_field hidden=1,后端元数据过滤,前端无需特判);
          · **检验方案默认值「出货控制计划执行」、可修改**(2026-11-06 同日第二轮口径「默认为这个的情况下
            也能进行修改」:后端只在空值兜底写默认值,不覆盖人工改值 ⇒ 字段 editable=1,本纸渲染成输入框);
          · **明细「结果判断」改下拉**(合格/不合格,值取自 yj_field.dataType=下拉框 的 options,
            选项是**存储数据键**,不翻译、不 tt();没有 options 时退回文本输入);
          · 单据编号/工单行号/审核人/审核时间/审批人/审批时间 一律按元数据只读
            (后端契约:yj_field.editable=0 下发的是 `readonly:true`,见 isLockedKey)。
       ⚠ Excel 导出:版式在 `core/qc/qcProcInspExport.js`(纯函数 + 单测),本组件只做 aoa_to_sheet + writeFile,
         入口 = 面板右侧「文档输出 → 导出」→「导出 Excel（.xlsx）」(PanelxList 按面板码路由到 exportProcInspExcel)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
    </div>

    <!-- ② 抬头:一行 2 组「标签|值」(照旧不动) -->
    <table class="qr-head-table">
      <tbody>
        <tr v-for="(row, ri) in headRows" :key="'h' + ri">
          <template v-for="k in row" :key="k">
            <th class="qr-label">{{ tt(k) }}</th>
            <td class="qr-value">
              <el-date-picker
                v-if="editable && isDateKey(k)"
                v-model="head[k]"
                type="date"
                size="small"
                value-format="YYYY-MM-DD"
                class="qr-cell-input"
                :placeholder="tt('选择日期')"
                @change="emit('dirty')"
              />
              <el-input
                v-else-if="editable && !isLockedKey(k)"
                v-model="head[k]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ head[k] || '' }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 分区带「检验结果」+ 两个动作(新增检验项 / 带入检验项目) -->
    <div class="qr-band">
      <span class="qr-band-title">{{ tt('检验结果') }}</span>
      <span v-if="editable" class="qr-band-acts no-print">
        <span class="qr-band-act2" @click="addItem()">＋ {{ tt('新增检验项') }}</span>
        <span class="qr-band-act2" @click="emit('open-items')">⧉ {{ tt('带入检验项目') }}</span>
      </span>
    </div>

    <!-- ④ 纵向表:一行一个检验项目(左四列单据级、纵向合并) -->
    <table class="qr-grid">
      <colgroup>
        <col style="width: 118px" />
        <col style="width: 118px" />
        <col style="width: 104px" />
        <col style="width: 104px" />
        <col />
        <col />
        <col style="width: 150px" />
        <col style="width: 96px" />
        <col v-if="editable" style="width: 34px" />
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2" class="c-fixed">{{ tt('客户名称') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('产品编码') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('型号（mm）') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('批号') }}</th>
          <th colspan="2" class="c-inspector">
            <span class="qr-insp-label">{{ tt('检验人员') }}：</span>
            <el-input
              v-if="editable && !isLockedKey('检验员')"
              v-model="head['检验员']"
              size="small"
              class="qr-cell-input qr-insp-input"
              maxlength="50"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['检验员'] || '' }}</span>
          </th>
          <th rowspan="2" class="c-fixed">{{ tt('产线常规功能性结果') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('结果判断') }}</th>
          <th v-if="editable" rowspan="2" class="c-op no-print"></th>
        </tr>
        <tr>
          <!-- 表头第二行 = 两个字段名(用户 2026-10-17 口径「把当前这两个框分别修改为检验要求和检验方法」);
               原来那两句"以下…自动填充出货检验计划表"挪进 tooltip,信息不丢、表头不啰嗦 -->
          <th class="c-sub" :title="tt('以下检验要求自动填充出货检验计划表')">{{ tt('检验要求') }}</th>
          <th class="c-sub" :title="tt('以下检验方法自动填充出货检验计划表')">{{ tt('检验方法') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in rowsForRender" :key="row ? uidOf(row) : 'empty'" :class="{ 'row-blank': !row }">
          <template v-if="ri === 0">
            <td v-for="c in headCols" :key="'f' + c.k" class="c-fixed" :rowspan="Math.max(items.length, 1)">
              <el-input
                v-if="editable && !isLockedKey(c.key)"
                v-model="head[c.key]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ head[c.key] || '' }}</span>
            </td>
          </template>
          <template v-if="row">
            <td v-for="c in cellCols" :key="c.k" :class="c.cls">
              <!-- 2026-11-06:字段元数据 dataType='下拉框' 且有 options 的列(「结果判断」合格/不合格)
                   渲染成 el-select;选项值 = 存储数据键(合格/不合格),**不做 tt() 翻译** -->
              <el-select
                v-if="editable && optionsOf(c.k).length"
                :model-value="cellText(row, c.k)"
                size="small"
                clearable
                class="qr-cell-input"
                @change="(v) => setCell(row, c.k, v ?? '')"
              >
                <el-option v-for="o in optionsOf(c.k)" :key="o" :label="o" :value="o" />
              </el-select>
              <el-input
                v-else-if="editable"
                :model-value="cellText(row, c.k)"
                size="small"
                class="qr-cell-input qr-cell-wrap"
                :type="c.multiline ? 'textarea' : undefined"
                :autosize="c.multiline ? { minRows: c.minRows || 1, maxRows: 12 } : undefined"
                :maxlength="c.max || 200"
                @input="setCell(row, c.k, $event)"
              />
              <span v-else class="qr-cell-text">{{ cellText(row, c.k) }}</span>
            </td>
            <td v-if="editable" class="c-op no-print">
              <span class="qr-row-del" :title="tt('删除本行')" @click="removeItem(row)">×</span>
            </td>
          </template>
          <template v-else>
            <td :colspan="emptyColspan" class="c-empty">
              {{ editable ? tt('暂无检验项，点右上「⧉带入检验项目」或「＋新增检验项」开始') : tt('暂无检验项') }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ 结论区(2026-11-06 由 4 列改 6 列:结论/处理意见各跨 5 列;末行 检验人|审核人|批准 三对)
         ⚠ 两级审批口径:检验人 = 编制(可填,提交审批时后端自动写提交人、空值兜底);
           审核人 = 一级审批人(yj_doc_status.shr 虚拟字段,只读);批准 = 超级管理员
           (head['审批人'],二级审批通过才落值,只读)。 -->
    <table class="qr-foot-table">
      <colgroup>
        <col style="width: 96px" />
        <col />
        <col style="width: 96px" />
        <col />
        <col style="width: 96px" />
        <col />
      </colgroup>
      <tbody>
        <tr>
          <th class="qr-label">{{ tt('检验结论') }}</th>
          <td class="qr-value" colspan="5">
            <el-input
              v-if="editable"
              v-model="head['总结论']"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              class="qr-cell-input"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['总结论'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <th class="qr-label">{{ tt('处理意见') }}</th>
          <td class="qr-value" colspan="5">
            <el-input
              v-if="editable"
              v-model="head['处理方式']"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              class="qr-cell-input"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['处理方式'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <th class="qr-label">{{ tt('检验人') }}</th>
          <td class="qr-value">
            <el-input
              v-if="editable && !isLockedKey('检验员')"
              v-model="head['检验员']"
              size="small"
              class="qr-cell-input"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['检验员'] || '' }}</span>
          </td>
          <th class="qr-label">{{ tt('审核人') }}</th>
          <td class="qr-value"><span class="qr-cell-text">{{ head['审核人'] || '' }}</span></td>
          <th class="qr-label">{{ tt('批准') }}</th>
          <td class="qr-value"><span class="qr-cell-text">{{ head['审批人'] || '' }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
import { ElMessageBox } from 'element-plus'
import { PROC_INSP_COLS, PROC_INSP_FOOT, buildProcInspExport } from '@/core/qc/qcProcInspExport.js'

const props = defineProps({
  head: { type: Object, required: true },
  /** 表头字段元数据(yj_field 下发,已过滤 hidden) */
  fields: { type: Array, default: () => [] },
  /** 明细字段元数据(yj_field 下发;纸面只消费「下拉框」的 options,如「结果判断」合格/不合格) */
  detailFields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-items'])

/** 明细里的「测量值1..10」= 上一版"一项一列 + 格数"留下的结构化格,纸面已不再渲染(值照存) */
const MEASURE = [
  '测量值1', '测量值2', '测量值3', '测量值4', '测量值5',
  '测量值6', '测量值7', '测量值8', '测量值9', '测量值10',
]

/** 左侧四列(单据级,纵向合并):纸面表头 → 头字段键(型号→规格型号、批号→批次号,与 yj_field 一致) */
const headCols = [
  { k: '客户名称', key: '客户名称' },
  { k: '产品编码', key: '产品编码' },
  { k: '型号（mm）', key: '规格型号' },
  { k: '批号', key: '批次号' },
]
/** 右侧四列(明细级,一行一值):照截图列序 —— 检验要求 | 检验方法 | 产线常规功能性结果 | 结果判断
 *  ⚠ multiline = 长文本格(自动长高的多行域,免得内容被单行框截断 —— 用户 2026-10-17 口径
 *    「当前超出当前行的内容框体要边长才行」);**minRows = 一打开就有几行高**(口径「将当前一开始的
 *    框体就变大一点」:长文本列默认 3 行,短结果列仍是单行);max = 物理列长度(检验要求 500 /
 *    检验方法 1000 / 产线常规功能性结果 200 / 结果判断 20),别写大了让用户填进库里存不下。 */
const cellCols = [
  { k: '检验要求', cls: 'c-req', multiline: true, minRows: 3, max: 500 },
  { k: '检验方法', cls: 'c-mtd', multiline: true, minRows: 3, max: 1000 },
  { k: '产线常规功能性结果', cls: 'c-func', max: 200 },
  { k: '结果判断', cls: 'c-verdict', max: 20 },
]

/** 本地版本号:明细数组/行可能被面板做了 raw 处理(非响应式),
 *  push/splice 后不会触发重渲染 —— 用它在组件内**强制刷新**(不依赖面板内部机制)。 */
const bump = ref(0)

/** 检验项明细行(一行一个检验项目) */
const items = computed(() => {
  bump.value // ← 建立依赖:变更后强制重算并触发重渲染
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

/** 取(必要时创建)明细数组 —— 新建单据 head.detail 可能是 {} 或 {tabs:[…]} 而**没有 items**。 */
function ensureItems() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}

/** 渲染行:没有明细时铺一行"空表"(左四列照旧显示单据级值 + 一格提示) */
const rowsForRender = computed(() => (items.value.length ? items.value : [null]))
/** 空表提示行要跨的列数(右四列 + 操作列) */
const emptyColspan = computed(() => 4 + (props.editable ? 1 : 0))

/** 稳定的行键(v-for key 用)。**用 WeakMap 记,不往行对象上挂字段**:
 *  原实现 `row.__uid = 'q'+n` 是**可枚举**属性 ⇒ ① 被 JSON.stringify 带进"未保存修改"快照,
 *  一打开制程检验单就被判脏(切单/翻页/左目录点行每次都弹「未保存提示」,2026-10-21 接入左栏时暴露);
 *  ② 保存时这个键还会跟着明细一起提交给后端。WeakMap 不污染行、天然随行对象回收。 */
const uidMap = new WeakMap()
let uidSeq = 0
function uidOf(row) {
  let v = uidMap.get(row)
  if (!v) { v = 'q' + (++uidSeq); uidMap.set(row, v) }
  return v
}

const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))
const detailFieldMap = computed(() => new Map((props.detailFields || []).map((f) => [f.dataName, f])))
/** 抬头排除:左侧四列已在本表显示 + 已在表头格显示(检验员) + 已在结论区显示 + 系统/明细列
 *  ⚠ 2026-11-06:审批人/审批时间 放在纸张表尾(index 末行)/属系统字段,不进抬头区
 *    (它们 hidden=1,后端下发时已过滤;这里再兜一层,免得将来放开 hidden 后又漏进抬头)。 */
const HEAD_SKIP = new Set([
  ...headCols.map((c) => c.key),
  '单据状态', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', ...MEASURE, '单项判定',
  '不合格应对措施', '不良数量', '产线常规功能性结果',
  '结果判断', '备注2', '备注', '总结论', '检验员', '审核人', '审核时间',
  '审批人', '审批时间',
  '格数', '格数上限', '列数',
])
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2))
  return rows
})

/** 单元格显示值(文本列原样;空值显示空串) */
function cellText(row, k) {
  const v = row?.[k]
  return v === undefined || v === null ? '' : String(v)
}

/** 单元格录入(行是 raw 对象:直写 + bump 强制刷新) */
function setCell(row, k, v) {
  const val = String(v ?? '')
  row[k] = val
  // 手工新增的行:检验要求 填了、检验项目 还空着 ⇒ 顺手写进 检验项目(行的身份键,列表页按它显示)
  if (k === '检验要求' && !String(row['检验项目'] ?? '').trim() && val.trim()) row['检验项目'] = val
  bump.value++
  emit('dirty')
}

/** 下一个行号(新行排在末尾;列表页也按 行号 排) */
function nextRowNo() {
  return items.value.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0) + 1
}

/** 新增一行检验项目(纸面"一行一个检验项目";要哪些项也可以走「带入检验项目」) */
function addItem() {
  if (!props.editable) return
  ensureItems().push({
    表区: '',
    行号: nextRowNo(),
    检验项目: '',
    检验要求: '',
    检验方法: '',
    产线常规功能性结果: '',
    结果判断: '',
  })
  bump.value++
  emit('dirty')
}

/** 这一行填过东西没有(删行要不要弹确认看它) */
function rowHasContent(row) {
  if (!row) return false
  for (const k of ['检验要求', '检验方法', '产线常规功能性结果', '结果判断', '检验项目']) {
    if (String(row[k] ?? '').trim()) return true
  }
  return false
}

/** 删掉一行;填过内容的先弹确认(删了就没了) */
async function removeItem(row) {
  if (!props.editable || !row) return
  if (rowHasContent(row)) {
    try {
      await ElMessageBox.confirm(
        tt('删除本行将清空已填内容，确定删除吗？'), tt('删除本行'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      )
    } catch { return /* 取消 */ }
  }
  const arr = ensureItems()
  const i = arr.indexOf(row)
  if (i >= 0) { arr.splice(i, 1); bump.value++; emit('dirty') }
}

function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
/** 只读判定:后端契约 —— yj_field.editable=0 在 dataSchema 里下发的是 **`readonly:true`**
 *  (不是 editable:false;PanelConfigService.fieldSpec:`if (!f.editable()) m.put("readonly", true)`)。
 *  ⚠ 2026-11-06 修:此前只判 editable===false/0 ⇒ 恒为 false(死代码),
 *    单据编号/工单行号/审核人/审核时间/审批人/审批时间 全成了可填框。
 *    未登记 ≠ 锁定(与其它纸张同口径);检验员(yj_field.editable=1)保持可填;
 *    「检验方案」2026-11-06 同日第二轮改为**默认值可修改**(editable=1)⇒ 这里也不锁。 */
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !!f && (f.readonly === true || f.editable === false || f.editable === 0)
}

/** 明细列的可选值:字段元数据 dataType='下拉框' 时后端下发 options(字符串数组)。
 *  options 是**存储数据键**(如 合格/不合格),渲染时不做 tt() 翻译、也不做大小写/别名映射。
 *  明细字段走 detailFields(props.detailFields;表头 fields 里没有 detail 级字段)。 */
function optionsOf(key) {
  const f = detailFieldMap.value.get(key) || fieldMap.value.get(key)
  if (!f || f.dataType !== '下拉框' || !Array.isArray(f.options)) return []
  return f.options
}

/**
 * 导出 Excel(.xlsx)—— 导出的是**当前这张纸**(制程检验记录表),不是列表页那套数据导出。
 * 版式(标题/抬头/表头两行/左侧四列合并/结论区)由 core/qc/qcProcInspExport.js 给(纯函数 + 单测),
 * 这里只做 xlsx 的 aoa_to_sheet + 样式 + writeFile(照 QcCatalogSheet 的写法)。
 * 入口:面板右侧「文档输出 → 导出 Excel」(PanelxList.exportSheetExcel 按面板码路由到本函数)。
 */
async function exportProcInspExcel() {
  const XLSX = await import('xlsx')
  const name = String(props.head?.['单据编号'] || props.head?.['编号'] || '制程检验记录表')
  const pairs = headRows.value.map((row) => row.map((k) => ({ label: tt(k), value: String(props.head?.[k] ?? '') })))
  const { aoa, cols, merges, headerRow1, headerRow2 } = buildProcInspExport({
    title: tt('制程检验记录表'),
    subtitle: `惠州市银嘉环保科技有限公司　　${tt('单据编号')}：${name}　　${tt('单据状态')}：${tt(String(props.head?.['单据状态'] || ''))}`,
    headPairs: pairs,
    head: props.head || {},
    rows: items.value,
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = cols
  ws['!merges'] = merges
  const style = (r, c, s) => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.s = s }
  // ⚠ 下面这些 `.s` 样式**落不进 .xlsx**(社区版 xlsx 0.18.5 不写单元格样式,见 qcProcInspExport.js 头部取证):
  //   留着是为了将来换 xlsx-js-style 时直接可用,别指望现在导出的文件带框线/底色/自动换行。
  const headFill = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: 'DCE9F5' } } }
  const labelFill = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'DCE9F5' } } }
  const wrap = { alignment: { vertical: 'top', wrapText: true } }
  style(0, 0, { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })
  style(1, 0, { font: { sz: 10 }, alignment: { horizontal: 'left' } })
  // 抬头标签/值
  for (let r = 3; r < headerRow1 - 1; r++) {
    if (!aoa[r] || !aoa[r].length) continue
    style(r, 0, labelFill); style(r, 4, labelFill)
    style(r, 1, { alignment: { horizontal: 'left' } }); style(r, 5, { alignment: { horizontal: 'left' } })
  }
  // 表头两行 + 左侧四列(纵向合并:样式落在合并区左上角)
  for (let c = 0; c < PROC_INSP_COLS.length; c++) {
    style(headerRow2, c, headFill)
    if (c !== 4 && c !== 5) style(headerRow1, c, headFill)
  }
  style(headerRow1, 4, { ...headFill, alignment: { horizontal: 'left', vertical: 'center' } })
  // 数据区:长文本自动换行
  for (let r = headerRow2 + 1; r < headerRow2 + 1 + Math.max(items.value.length, 1); r++) {
    for (const c of [4, 5]) style(r, c, wrap)
  }
  // 结论区(2026-11-06 最后一行三对:检验人 0 / 审核人 3 / 批准 6)
  for (let r = aoa.length - PROC_INSP_FOOT.length; r < aoa.length; r++) {
    const f = PROC_INSP_FOOT[r - (aoa.length - PROC_INSP_FOOT.length)]
    style(r, 0, labelFill)
    if (f?.secondLabel) style(r, 3, labelFill)
    if (f?.thirdLabel) style(r, 6, labelFill)
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, tt('制程检验记录表').slice(0, 28))
  XLSX.writeFile(wb, `${tt('制程检验记录表')}-${name}.xlsx`)
}

defineExpose({ exportProcInspExcel })
</script>

<style scoped>
.qr-sheet {
  background: #fff;
  border: 1px solid #d7dce5;
  padding: 10px 12px 14px;
  margin: 0 6px 8px;
}
.qr-titlerow {
  text-align: center;
  margin-bottom: 10px;
}
.qr-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #1f4e79;
}
/* 抬头 / 结论区 */
.qr-head-table,
.qr-foot-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  table-layout: fixed;
}
.qr-label {
  border: 1px solid #b8cfe6;
  background: #dce9f5;
  font-weight: 600;
  color: #1f4e79;
  text-align: center;
  padding: 3px 6px;
  width: 96px;
  white-space: nowrap;
}
.qr-value {
  border: 1px solid #b8cfe6;
  padding: 1px 4px;
  text-align: left;
  background: #fff;
}
/* 分区带 */
.qr-band {
  position: relative;
  margin-top: -1px;
  border: 1px solid #b8cfe6;
  background: #cfe0f2;
  text-align: center;
  padding: 3px 6px;
  font-size: 13px;
  font-weight: 700;
  color: #1f4e79;
}
.qr-band-acts {
  position: absolute;
  right: 8px;
  top: 3px;
}
.qr-band-act2 {
  margin-left: 12px;
  font-size: 12px;
  font-weight: 400;
  color: #2b6cb0;
  cursor: pointer;
}
.qr-band-act2:hover {
  text-decoration: underline;
}
/* 纵向表 */
.qr-grid {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
  margin-top: -1px;
}
.qr-grid th,
.qr-grid td {
  border: 1px solid #b8cfe6;
  padding: 3px 4px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-grid thead th {
  background: #dce9f5;
  color: #1f4e79;
  font-weight: 600;
}
.qr-grid th.c-fixed {
  background: #dce9f5;
}
.qr-grid td.c-fixed {
  background: #fbfdff;
  font-weight: 500;
}
/* 表头第二行:两句"自动填充"说明 */
.qr-grid th.c-sub {
  background: #e8f1fa;
  font-weight: 400;
  color: #1f4e79;
}
/* 检验人员格(跨 检验要求 + 检验方法 两列) */
.qr-grid th.c-inspector {
  text-align: left;
  padding: 2px 6px;
}
.qr-insp-label {
  color: #1f4e79;
}
.qr-insp-input {
  width: 60%;
  min-width: 120px;
}
/* 明细四列:要求/方法左对齐(文字长),两个结果列居中 */
.qr-grid td.c-req,
.qr-grid td.c-mtd {
  text-align: left;
  vertical-align: top;
  line-height: 17px;
}
.qr-grid td.c-func,
.qr-grid td.c-verdict {
  text-align: center;
}
.c-op {
  width: 34px;
}
.qr-row-del {
  font-weight: 700;
  color: #f56c6c;
  cursor: pointer;
  padding: 0 2px;
}
.row-blank td.c-empty {
  color: #8a94a0;
  padding: 12px 0;
  text-align: center;
}
/* 输入控件:方角、贴合单元格(以格子边框为唯一框) */
.qr-cell-input :deep(.el-input__wrapper),
.qr-cell-input :deep(.el-textarea__inner) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}
.qr-cell-input :deep(.el-input__wrapper) {
  padding: 0 2px;
}
.qr-cell-input :deep(.el-input__wrapper:hover),
.qr-cell-input :deep(.el-input__wrapper.is-focus),
.qr-cell-input :deep(.el-textarea__inner:hover),
.qr-cell-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
  background: #f2f8ff;
}
.qr-cell-input :deep(.el-input__inner) {
  height: 20px;
  line-height: 20px;
}
/* 明细「下拉框」列(2026-11-06:结果判断 合格/不合格):控件观感与同格输入框一致 ——
   无边框、贴合格线;选中值按格子的 text-align 居中/居左 */
.qr-cell-input :deep(.el-select__wrapper) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0 2px;
  min-height: 20px;
}
.qr-cell-input :deep(.el-select__wrapper:hover),
.qr-cell-input :deep(.el-select__wrapper.is-focused) {
  background: #f2f8ff;
  box-shadow: none;
}
.qr-cell-input :deep(.el-select__selected-item),
.qr-cell-input :deep(.el-select__placeholder) {
  font-size: 12px;
  line-height: 20px;
}
/* 单选的显示值/占位词在 .el-select__placeholder 上(EP 2.14);按格子的 text-align 居中 */
.qr-grid td.c-verdict .qr-cell-input :deep(.el-select__placeholder),
.qr-grid td.c-func .qr-cell-input :deep(.el-select__placeholder) {
  text-align: center;
}
.qr-grid td.c-req .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-mtd .qr-cell-input :deep(.el-input__inner) {
  text-align: left;
}
.qr-grid td.c-func .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-verdict .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-fixed .qr-cell-input :deep(.el-input__inner) {
  text-align: center;
}
.qr-cell-wrap :deep(.el-textarea__inner) {
  text-align: left;
  padding: 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
}
</style>

<!-- ══════════════════════════════════════════════════════════════════════════
     打印整张:只保留纸张(与首件检验单 / 检验数据记录表 / 检验目录 同口径)
     ══════════════════════════════════════════════════════════════════════════
     🔴 2026-10-21 修 —— 此前本组件**没有**这段,点「打印」出来是**空白页**:
        公共打印样式(DocSheet.vue 的非 scoped 块)把 `body.approval-printing .portal` 整体
        `visibility: hidden`,再逐个 whitelist 纸张根类名 —— 名单里只有 `.approval-sheet`
        / `.progress-sheet` / `.catalog-sheet` / `.qc-rec-sheet` / `.rsp-sheet`,
        外加首件检验单自己补的 `.fi-sheet`,**唯独漏了制程检验单的 `.qr-sheet`**
        ⇒ print 媒体下 `.qr-sheet` 的 computed visibility = hidden(实测),
        用 Page.printToPDF 出纸只有 1.9KB / 3 页空白,而首件那张是 380KB / 2 页正常。
      ⚠ 与首件同一套写法(visibility 白名单 + 定位到左上 + 收窄表格 + 打印字号),
        但**不抄它的具名页**:制程检验单是纵向表、列少,用横向 A4 会把字缩得极小,
        这里用竖向 A4(纸面本身也是竖的)。
     ⚠ 别用 `display:none` 去藏 .portal 里的别的纸:同页可能同时挂着别的面板(keep-alive),
        只藏 `.approval-side` 这类操作栏即可,纸张由 visibility 白名单挑。 -->
<style>
@media print {
  body.approval-printing .portal {
    visibility: hidden;
  }
  body.approval-printing .topbar,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .tools,
  body.approval-printing .doc-select-rail {
    display: none !important;
  }
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    padding-right: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .qr-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .qr-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 纸面缩到一页(与首件/检验目录同一套口径):12px→9px、内边距压到 1px、允许换行。
     🔴 2026-10-21 修「检验要求/检验方法被压成竖排文字」:
        `.qr-grid` 是 table-layout:fixed,`<colgroup>` 把前四列定死 118/118/104/104(=444px),
        后两列(检验要求/检验方法)是**弹性列**。A4 纵向内容宽 ≈ 733px,再减右两列 150+96+操作列 34
        ⇒ 弹性列各只剩 **0px**,于是每个汉字单独占一行(实测 cols = 118,118,104,104,0,0,150,96,34)。
        修法:打印时**重排列宽** —— 前四列按纸宽比例收窄、把宽度让给两个文本列。
        ⚠ 必须用 `table-layout:fixed` + `<col>` 之外的 `td:first-child…` 无法覆盖 colgroup,
          所以这里改用「按列序给 th/td 定宽」的 !important 规则(colgroup 的 width 优先级更低)。 */
  body.approval-printing .qr-grid {
    table-layout: fixed !important;
    width: 100% !important;
    font-size: 9px !important;
  }
  body.approval-printing .qr-grid col {
    width: auto !important;
  }
  /* 列宽(合计 100%):客户名称 11% | 产品编码 11% | 型号 9% | 批号 9%
     | 检验要求 26% | 检验方法 24% | 产线结果 7% | 结果判断 7%(操作列打印时隐藏) */
  body.approval-printing .qr-grid thead th:nth-child(1),
  body.approval-printing .qr-grid tbody td:nth-child(1) { width: 11% !important; }
  body.approval-printing .qr-grid thead th:nth-child(2),
  body.approval-printing .qr-grid tbody td:nth-child(2) { width: 11% !important; }
  body.approval-printing .qr-grid thead th:nth-child(3),
  body.approval-printing .qr-grid tbody td:nth-child(3) { width: 9% !important; }
  body.approval-printing .qr-grid thead th:nth-child(4),
  body.approval-printing .qr-grid tbody td:nth-child(4) { width: 9% !important; }
  body.approval-printing .qr-grid thead th:nth-child(5),
  body.approval-printing .qr-grid tbody td:nth-child(5) { width: 26% !important; }
  body.approval-printing .qr-grid thead th:nth-child(6),
  body.approval-printing .qr-grid tbody td:nth-child(6) { width: 24% !important; }
  body.approval-printing .qr-grid thead th:nth-child(7),
  body.approval-printing .qr-grid tbody td:nth-child(7) { width: 7% !important; }
  body.approval-printing .qr-grid thead th:nth-child(8),
  body.approval-printing .qr-grid tbody td:nth-child(8) { width: 7% !important; }
  /* 文字列按正常横排断行(不再是「一字一行」):允许在词内换行,但不要 word-break:break-all 那种
     按字符硬断;中文本身逐字可断,关键是**列要有宽度** */
  body.approval-printing .qr-grid td.c-req,
  body.approval-printing .qr-grid td.c-mtd,
  body.approval-printing .qr-grid th.c-sub {
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: anywhere !important;
    writing-mode: horizontal-tb !important;
  }
  body.approval-printing .qr-grid td.c-req .qr-cell-wrap,
  body.approval-printing .qr-grid td.c-mtd .qr-cell-wrap,
  body.approval-printing .qr-grid td.c-req .el-textarea__inner,
  body.approval-printing .qr-grid td.c-mtd .el-textarea__inner {
    writing-mode: horizontal-tb !important;
    white-space: pre-wrap !important;
    word-break: normal !important;
    overflow-wrap: anywhere !important;
    width: 100% !important;
  }
  body.approval-printing .qr-head-table,
  body.approval-printing .qr-foot-table {
    font-size: 9px !important;
  }
  body.approval-printing .qr-grid th,
  body.approval-printing .qr-grid td,
  body.approval-printing .qr-head-table th,
  body.approval-printing .qr-head-table td,
  body.approval-printing .qr-foot-table th,
  body.approval-printing .qr-foot-table td {
    font-size: 9px !important;
    padding: 1px 2px !important;
    height: auto !important;
    line-height: 1.25 !important;
  }
  body.approval-printing .qr-title {
    font-size: 17px !important;
    letter-spacing: 2px !important;
  }
  body.approval-printing .qr-band {
    font-size: 10px !important;
  }
  /* 录入框在纸上要像"印好的格子":去边框/底色,文字同正文 */
  body.approval-printing .qr-sheet .el-input__inner,
  body.approval-printing .qr-sheet .el-textarea__inner {
    font-size: 9px !important;
    height: auto !important;
    line-height: 1.25 !important;
  }
  body.approval-printing .qr-sheet .el-input__wrapper,
  body.approval-printing .qr-sheet .el-textarea__inner {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
  }
  /* 明细下拉(2026-11-06「结果判断」合格/不合格):纸上只印选中的值,不印下拉箭头/边框 */
  body.approval-printing .qr-sheet .el-select__wrapper {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
    min-height: 0 !important;
  }
  body.approval-printing .qr-sheet .el-select__caret,
  body.approval-printing .qr-sheet .el-select__suffix {
    display: none !important;
  }
  /* 占位提示词「请选择」不该印在纸上(EP 2.14:空值时 .el-select__placeholder.is-transparent);
     选中值那个 placeholder **没有** is-transparent,只藏占位、别把真值一起藏了 */
  body.approval-printing .qr-sheet .el-select__placeholder.is-transparent {
    visibility: hidden !important;
  }
  body.approval-printing .qr-sheet .el-select__selected-item,
  body.approval-printing .qr-sheet .el-select__placeholder {
    font-size: 9px !important;
    line-height: 1.25 !important;
  }
  /* 编辑态才有的东西(新增项/删除列/拖动把手)不进纸 */
  body.approval-printing .qr-sheet .no-print,
  body.approval-printing .qr-sheet .c-op {
    display: none !important;
  }
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
}
</style>
