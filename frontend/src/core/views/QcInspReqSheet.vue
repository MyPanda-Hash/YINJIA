<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料检验要求(QC_INSP_REQ,档案式)——品质资料 7 张检验要求表一面板 7 页签
       页签条=规格书式 rsp-pages;每页=Excel 一比一复刻(大标题行+两行分组表头+原列宽数据行)。
       非翻页单据:整表一张虚拟单(head.detail.items 全量行),行按 [物料类别]=页签 key 分流;
       保存走父级 saveInlineDraft(saveArchive 整表 upsert,缺席行=删除)。
       注意:档案明细行被 markArchListRaw 预打 raw 标记(无响应式),本组件用 rows 镜像数组
       驱动界面,行对象与 detail.items 同引用——镜像增删同步双写,保存数据不失真。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qc-insp-sheet">
    <!-- 迷你工具栏:刷新/放弃/保存(通用工具栏与单据卡片对本面板整体不渲染) -->
    <div class="qc-bar">
      <span class="qc-bar-btn" :title="tt('重新加载数据')" @click="emit('refresh')">↻ {{ tt('刷新') }}</span>
      <span class="qc-bar-btn" :title="tt('放弃未保存的修改')" @click="revert">✕ {{ tt('放弃') }}</span>
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
          <!-- 数据行:值列全部文本(±公差/区间是文本),物料类别由页签隐式携带不显示 -->
          <tr v-for="(row, i) in rowsOf(tab)" :key="row.id ?? ('new' + i)">
            <td v-for="c in tab.cols" :key="c.key" class="rs-td">
              <el-input v-if="editable" v-model="row[c.key]" size="small" class="rs-c-in" @input="touchDirty()" />
              <span v-else class="rs-txt">{{ row[c.key] || '' }}</span>
            </td>
            <td v-if="editable" class="rs-td-op"><span class="rs-op-add" @click="addRow(tab)">＋</span><span class="rs-op-del" @click="removeRow(row)">×</span></td>
          </tr>
          <tr v-if="!rowsOf(tab).length">
            <td :colspan="tab.cols.length" class="rs-empty">{{ tt('暂无数据') }}</td>
            <td v-if="editable" class="rsp-op-pad"></td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="rs-add" :style="{ width: gridW(tab) + 'px' }" @click="addRow(tab)">＋ {{ tt('新增数据记录行') }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
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

// ── 行数据:与 head.detail.items 同引用的工作镜像(raw 数组无响应式,镜像驱动界面) ──
const rows = ref([])
const dirty = ref(false)
function sourceItems() {
  if (!props.head?.detail) props.head.detail = {}
  if (!Array.isArray(props.head.detail.items)) props.head.detail.items = []
  return props.head.detail.items
}
watch(
  () => props.head?.detail?.items,
  (arr) => { rows.value = Array.isArray(arr) ? [...arr] : []; dirty.value = false },
  { immediate: true },
)
/** 页签行集:按物料类别过滤;id 升序对齐 Excel 原序(服务端返回 id 倒序),新行殿后 */
function rowsOf(t) {
  return rows.value
    .filter((r) => String(r['物料类别'] || '') === t.key)
    .slice()
    .sort((a, b) => (a.id ?? 1e15) - (b.id ?? 1e15))
}
function addRow(t) {
  const row = { '物料类别': t.key }
  sourceItems().push(row) // 原数组(保存取数)
  rows.value.push(row) // 镜像(界面响应)
  touchDirty()
}
function removeRow(row) {
  const src = sourceItems()
  const i = src.indexOf(row)
  if (i >= 0) src.splice(i, 1)
  const j = rows.value.indexOf(row)
  if (j >= 0) rows.value.splice(j, 1)
  touchDirty()
}
function touchDirty() {
  dirty.value = true
  emit('dirty')
}
async function revert() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(tt('放弃后未保存的修改将丢失,确定放弃?'), tt('提示'), { type: 'warning' })
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
/* ── 迷你工具栏(面板自带:通用工具栏对本面板不渲染) ── */
.qc-insp-sheet {
  padding: 12px 0 30px;
}
.qc-bar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 4px 10px;
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
/* 操作列无边框浮动:＋/× 悬浮于网格右缘之外,不占表格边框 */
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
  text-align: center;
  white-space: nowrap;
  overflow: visible;
}
.rs-op-add,
.rs-op-del {
  display: inline-block;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  margin: 0 3px;
}
.rs-op-add {
  color: #0d5bd3;
}
.rs-op-del {
  color: #c0392b;
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
