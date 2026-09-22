<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料检验要求(QC_INSP_REQ,档案式)——品质资料 7 张检验要求表一面板 7 页签
       页签条=规格书式 rsp-pages;每页=Excel 一比一复刻(大标题行+两行分组表头+原列宽数据行)。
       非翻页单据:整表一张虚拟单(head.detail.items 全量行),行按 [物料类别]=页签 key 分流;
       保存走父级 saveInlineDraft(saveArchive 整表 upsert,缺席行=删除)。
       行操作(2026-09-22 按用户口径):默认**整表只读**,点某行「修改」该行才转输入框(防随意改),
       改完点「完成」收起;「删除」先弹确认;新增走表尾「＋ 新增数据记录行」(新行自动进入可编辑)。
       查询=工具栏关键字框,按当前页签各列模糊过滤,并提示其他页签的命中条数(可点跳过去)。
       注意:档案明细行被 markArchListRaw 预打 raw 标记(无响应式),本组件用 rows 镜像数组
       驱动界面,行对象与 detail.items 同引用——镜像增删同步双写,保存数据不失真。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qc-insp-sheet">
    <!-- 迷你工具栏:关键字查询 + 刷新/保存(通用工具栏与单据卡片对本面板整体不渲染) -->
    <div class="qc-bar">
      <el-input
        v-model="keyword"
        class="qc-search"
        size="small"
        clearable
        :placeholder="tt('输入关键字过滤本页数据')"
      />
      <span class="qc-bar-btn" :title="tt('重新加载数据')" @click="reload">↻ {{ tt('刷新') }}</span>
      <span class="qc-bar-btn primary" :title="tt('保存整表(缺席行视为删除)')" @click="emit('save')">{{ tt('保存') }}</span>
    </div>

    <!-- 页签条(规格书式) -->
    <div class="rsp-pages">
      <div
        v-for="(t, ti) in tabs"
        :key="'qt' + ti"
        class="rsp-page-tab"
        :class="{ active: activeTab === ti }"
        @click="activeTab = ti"
      >{{ tt(t.key) }}</div>
    </div>

    <!-- 关键字命中其他页签时给一行提示(点击切过去) -->
    <div v-if="otherHits.length" class="qc-hits">
      <span class="qc-hits-label">{{ tt('其他页签命中') }}：</span>
      <span v-for="h in otherHits" :key="'hit' + h.i" class="qc-hit" @click="activeTab = h.i">{{ tt(h.key) }} {{ h.n }} {{ tt('条') }}</span>
    </div>

    <!-- 当前页签的 Excel 复刻表 -->
    <div class="qc-paper" :style="{ width: gridW(tab) + 'px' }">
      <table class="rs-t" :style="{ width: gridW(tab) + 'px' }">
        <colgroup>
          <col v-for="(c, ci) in tab.cols" :key="'qc' + ci" :style="{ width: c.w + 'px' }" />
          <col v-if="editable" class="qc-op-col" />
        </colgroup>
        <tbody>
          <!-- 大标题行(Excel 第 1 行) -->
          <tr><td :colspan="tab.cols.length" class="qc-title">{{ tt(tab.sheetTitle) }}</td></tr>
          <!-- 两行分组表头:独立列纵向合并(rowspan=2),分组列上=组名下=子列 -->
          <tr class="rs-grp">
            <template v-for="(g, gi) in headerRow1(tab)" :key="'qh1' + gi">
              <th v-if="g.kind === 'plain'" class="rs-th" rowspan="2">{{ tt(g.key) }}</th>
              <th v-else class="rs-th" :colspan="g.span">{{ tt(g.label) }}</th>
            </template>
            <th v-if="editable" class="rs-th-op"></th>
          </tr>
          <tr class="rs-grp2">
            <th v-for="c in groupCols(tab)" :key="'qh2' + c.key" class="rs-th">{{ tt(c.key) }}</th>
          </tr>
          <!-- 数据行:值列全部文本(±公差/区间是文本),物料类别由页签隐式携带不显示。
               只读态=纯文本;仅「修改」过的那一行(或刚新增的行)渲染输入框 -->
          <tr v-for="(row, i) in rowsOf(tab)" :key="row.id ?? ('new' + i)">
            <td v-for="c in tab.cols" :key="c.key" class="rs-td">
              <el-input
                v-if="editable && isEditing(row)"
                v-model="row[c.key]"
                size="small"
                class="rs-c-in"
                @input="touchDirty()"
              />
              <span v-else class="rs-txt">{{ row[c.key] || '' }}</span>
            </td>
            <td v-if="editable" class="rs-td-op">
              <span v-if="!isEditing(row)" class="rs-op-btn rs-op-edit" @click="startEdit(row)">{{ tt('修改') }}</span>
              <span v-else class="rs-op-btn rs-op-done" @click="endEdit()">{{ tt('完成') }}</span>
              <span class="rs-op-btn rs-op-del" @click="removeRow(row)">{{ tt('删除') }}</span>
            </td>
          </tr>
          <tr v-if="!rowsOf(tab).length">
            <td :colspan="tab.cols.length" class="rs-empty">{{ keyword.trim() ? tt('本页无匹配行') : tt('暂无数据') }}</td>
            <td v-if="editable" class="rsp-op-pad"></td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="rs-add" :style="{ width: gridW(tab) + 'px' }" @click="addRow(tab)">＋ {{ tt('新增数据记录行') }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, toRaw, watch } from 'vue'
import { tt } from '@/i18n'
import { ElMessageBox } from 'element-plus'
import { qcInspReqTabs } from './qcInspReqConfig'

const props = defineProps({
  head: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
})
const emit = defineEmits(['dirty', 'save', 'refresh'])

const tabs = qcInspReqTabs
const activeTab = ref(0)
const tab = computed(() => tabs[activeTab.value] || tabs[0])
/** 表内查询关键字:按当前页签各列模糊过滤(空=不过滤) */
const keyword = ref('')

// ── 行数据:与 head.detail.items 同引用的工作镜像(raw 数组无响应式,镜像驱动界面) ──
const rows = ref([])
const dirty = ref(false)
/** 当前处于编辑态的行(按对象引用比):默认 null=整表只读,防止随手改到数据 */
const editRow = ref(null)
function sourceItems() {
  if (!props.head?.detail) props.head.detail = {}
  if (!Array.isArray(props.head.detail.items)) props.head.detail.items = []
  return props.head.detail.items
}
watch(
  () => props.head?.detail?.items,
  (arr) => { rows.value = Array.isArray(arr) ? [...arr] : []; dirty.value = false; editRow.value = null },
  { immediate: true },
)
/** 两侧都取 raw 再比:ref 里的对象读出来是 reactive 代理,模板里的行也是代理,代理≠原对象 */
function isEditing(row) {
  return editRow.value !== null && toRaw(row) === toRaw(editRow.value)
}
function startEdit(row) {
  editRow.value = toRaw(row)
}
function endEdit() {
  editRow.value = null
}
/** 页签行集:按物料类别过滤;id 升序对齐 Excel 原序(服务端返回 id 倒序),新行殿后 */
function tabRows(t) {
  return rows.value
    .filter((r) => String(r['物料类别'] || '') === t.key)
    .slice()
    .sort((a, b) => (a.id ?? 1e15) - (b.id ?? 1e15))
}
/** 关键字:整行各列任一命中(大小写不敏感) */
function hitRow(r, t) {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return true
  return t.cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(k))
}
function rowsOf(t) {
  return tabRows(t).filter((r) => hitRow(r, t))
}
/** 关键字在「别的页签」里的命中条数(提示可点跳转) */
const otherHits = computed(() => {
  if (!keyword.value.trim()) return []
  const out = []
  tabs.forEach((t, i) => {
    if (i === activeTab.value) return
    const n = tabRows(t).filter((r) => hitRow(r, t)).length
    if (n) out.push({ i, key: t.key, n })
  })
  return out
})

function addRow(t) {
  const row = { '物料类别': t.key }
  sourceItems().push(row) // 原数组(保存取数)
  rows.value.push(row) // 镜像(界面响应)
  editRow.value = row // 新行直接可填
  touchDirty()
}
async function removeRow(row) {
  try {
    await ElMessageBox.confirm(tt('删除该行后点「保存」才会落库,确定删除?'), tt('删除该行'), { type: 'warning' })
  } catch { return }
  const raw = toRaw(row)
  const src = sourceItems()
  // 原数组里存的是 raw 行(新增行可能已被 Vue 代理),两个引用都试一遍,避免删不掉
  const i = src.indexOf(raw) >= 0 ? src.indexOf(raw) : src.indexOf(row)
  if (i >= 0) src.splice(i, 1)
  const j = rows.value.indexOf(row)
  if (j >= 0) rows.value.splice(j, 1)
  if (editRow.value !== null && raw === toRaw(editRow.value)) editRow.value = null
  touchDirty()
}
function touchDirty() {
  dirty.value = true
  emit('dirty')
}
/** 刷新=整表从后端重取,故先拦一道(未保存的修改会丢) */
async function reload() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(tt('未保存的修改将丢失,确定重新加载?'), tt('提示'), { type: 'warning' })
    } catch { return }
  }
  emit('refresh')
}

// ── 表头(同 RecordSheetPanels 两行分组表头算法,配置源=页签 cols) ──
function groupCols(t) {
  return t.cols.filter((c) => c.group)
}
function headerRow1(t) {
  const out = []
  for (const c of t.cols) {
    if (!c.group) {
      out.push({ kind: 'plain', key: c.key, span: 1 })
    } else if (!out.length || out[out.length - 1].kind !== 'group' || out[out.length - 1].label !== c.group) {
      out.push({ kind: 'group', label: c.group, span: 1 })
    } else {
      out[out.length - 1].span += 1
    }
  }
  return out
}
function gridW(t) {
  return t.cols.reduce((s, c) => s + c.w, 0)
}
</script>

<style scoped>
/* ── 迷你工具栏(面板自带:通用工具栏对本面板不渲染) ──
   右侧留出 84px:行操作按钮是浮在网格右缘之外的,不留白会被裁掉 */
.qc-insp-sheet {
  padding: 12px 84px 30px 0;
}
.qc-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 4px 10px;
}
.qc-search {
  width: 260px;
  margin-right: auto;
}
.qc-bar-btn {
  padding: 4px 14px;
  border: 1px solid #b7c9dd;
  border-radius: 4px;
  background: #f4f8fd;
  color: #33517a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.qc-bar-btn:hover {
  background: #e8f1fa;
}
.qc-bar-btn.primary {
  background: #1c4f8a;
  border-color: #1c4f8a;
  color: #fff;
  font-weight: 600;
}
.qc-bar-btn.primary:hover {
  background: #2a63a5;
}

/* ── 页签条(规格书式,同 RecordSheetPanels rsp-pages) ── */
.rsp-pages {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  justify-content: center;
}
.rsp-page-tab {
  padding: 5px 18px;
  border: 1px solid #b7c9dd;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: #e8eef5;
  color: #33517a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.rsp-page-tab:hover {
  background: #dde8f2;
}
.rsp-page-tab.active {
  background: #fff;
  color: #1c4f8a;
  font-weight: 700;
  border-color: #8fb4e0;
}

/* ── 关键字命中其他页签的提示 ── */
.qc-hits {
  text-align: center;
  margin: 0 0 8px;
  font-size: 12.5px;
  color: #6b7c93;
}
.qc-hits-label {
  margin-right: 2px;
}
.qc-hit {
  display: inline-block;
  margin: 0 3px;
  padding: 1px 8px;
  border: 1px dashed #8fb4e0;
  border-radius: 10px;
  background: #f4f9ff;
  color: #1c4f8a;
  cursor: pointer;
}
.qc-hit:hover {
  background: #e8f2ff;
  border-style: solid;
}

/* ── Excel 复刻网格(同 RecordSheetPanels rs-* 版式) ── */
.qc-paper {
  margin: 0 auto;
  background: #fff;
  font-size: 14px;
  color: #222;
}
.rs-t {
  border-collapse: collapse;
  table-layout: fixed;
}
.rs-t :deep(.el-input__wrapper),
.rs-t :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0;
}
.rs-t :deep(.el-input__inner) {
  font-size: 13.5px;
  line-height: 1.6;
  padding: 0;
}
.qc-title {
  border: 1px solid #7f7f7f;
  padding: 10px 8px;
  background: #fff;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
  text-align: center;
}
.rs-th {
  border: 1px solid #7f7f7f;
  background: #9c9c9c;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  padding: 6px 4px;
  vertical-align: middle;
  line-height: 1.35;
  word-break: break-all;
  white-space: pre-line;
}
.rs-td {
  border: 1px solid #7f7f7f;
  padding: 4px 8px;
  vertical-align: middle;
  background: #fff;
}
.rs-txt {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.7;
}
.rs-c-in {
  width: 100%;
}
/* 操作列无边框浮动:修改/删除 悬浮于网格右缘之外,不占表格边框 */
.rs-th-op {
  width: 0;
  min-width: 0;
  overflow: visible;
}
.rs-th-op,
.rs-td-op,
.rsp-op-pad {
  border: none !important;
  background: transparent !important;
  padding: 4px 2px;
}
.rs-td-op {
  text-align: left;
  white-space: nowrap;
  overflow: visible;
}
.rs-op-btn {
  display: inline-block;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  line-height: 1.5;
  margin: 0 2px;
  padding: 1px 6px;
  border: 1px solid #b7c9dd;
  border-radius: 3px;
  background: #f4f8fd;
  color: #33517a;
}
.rs-op-btn:hover {
  background: #e8f1fa;
}
/* 编辑中:该行值列浅蓝底,一眼看出哪行能改 */
.rs-op-done {
  border-color: #1c4f8a;
  background: #1c4f8a;
  color: #fff;
}
.rs-op-done:hover {
  background: #2a63a5;
}
.rs-op-del {
  border-color: #e0bcbc;
  background: #fdf6f6;
  color: #c0392b;
}
.rs-op-del:hover {
  background: #fbeaea;
}
.rs-empty {
  text-align: center;
  color: #98a4b3;
  padding: 14px 0 !important;
}
.rs-add {
  margin: 8px 0 2px;
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.rs-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
</style>
