<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料检验要求(QC_INSP_REQ,档案式)——品质资料 7 张检验要求表一面板 7 页签
       页签条=规格书式 rsp-pages;每页=Excel 一比一复刻(大标题行+两行分组表头+原列宽数据行)。
       非翻页单据:整表一张虚拟单(head.detail.items 全量行),行按 [物料类别]=页签 key 分流;
       保存走父级 saveInlineDraft(saveArchive 整表 upsert,缺席行=删除)。
       行操作(2026-09-22 按用户口径):默认**整表只读**,点某行「修改」该行才转输入框(防随意改),
       改完点「完成」收起;「删除」先弹确认;新增走表尾「＋ 新增数据记录行」(新行自动进入可编辑)。
       查询(2026-09-22 晚定稿):统一走第二行工具钮「🔍 模糊搜索」——字段+内容多条件 AND、跨页签,
       点结果跳到该页签并高亮该行;原先表头那个「关键字过滤本页」的输入框与其「其他页签命中」提示已删。
       「🕘 修改记录」看本表每次保存的留痕(后端 ButtonService.archiveChangeHistory)。
       注意:档案明细行被 markArchListRaw 预打 raw 标记(无响应式),本组件用 rows 镜像数组
       驱动界面,行对象与 detail.items 同引用——镜像增删同步双写,保存数据不失真。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qc-insp-sheet">
    <!-- 迷你工具栏:刷新/保存(通用工具栏与单据卡片对本面板整体不渲染) -->
    <div class="qc-bar">
      <span class="qc-bar-btn" :title="tt('重新加载数据')" @click="reload">↻ {{ tt('刷新') }}</span>
      <span class="qc-bar-btn primary" :title="tt('保存整表(缺席行视为删除)')" @click="emit('save')">{{ tt('保存') }}</span>
    </div>
    <!-- 第二行(2026-09-22):与立项申请同义的「模糊搜索」+ 本表「修改记录」(每次保存留痕) -->
    <div class="qc-bar qc-bar2">
      <span class="qc-bar-btn" :title="tt('按字段+内容多条件查找(可跨页签,点结果跳到该行)')" @click="toggleFuzzy">🔍 {{ tt('模糊搜索') }}</span>
      <span class="qc-bar-btn" :title="tt('查看本表的修改记录(每次保存留痕,近 3 次)')" @click="openModifyLog">🕘 {{ tt('修改记录') }}</span>
    </div>

    <!-- 模糊搜索态:字段+内容条件行 → 查找 → 结果清单(点行跳到对应页签并高亮) -->
    <div v-if="fuzzyOpen" class="fuzzy-panel">
      <div class="fuzzy-head">
        <span>{{ tt('模糊搜索') }}</span>
        <span class="fuzzy-back" :title="tt('返回')" @click="closeFuzzy">↩</span>
      </div>
      <div v-for="(row, fi) in fuzzyRows" :key="'fz' + fi" class="fuzzy-row">
        <el-select v-model="row.field" size="small" filterable class="fuzzy-field" :placeholder="tt('字段')">
          <el-option value="" :label="tt('全部字段')" />
          <el-option-group v-for="g in fuzzyFieldGroups" :key="g.label" :label="g.label">
            <el-option v-for="o in g.options" :key="o.value" :label="o.label" :value="o.value" />
          </el-option-group>
        </el-select>
        <el-input
          v-model="row.value"
          size="small"
          class="fuzzy-value"
          :placeholder="tt('内容')"
          @keyup.enter="runFuzzySearch"
        />
        <span class="fuzzy-del" :title="tt('删除该条件')" @click="removeFuzzyRow(fi)">×</span>
      </div>
      <div class="fuzzy-btns">
        <span class="qc-bar-btn" @click="addFuzzyRow">{{ tt('添加条件') }}</span>
        <span class="qc-bar-btn primary" @click="runFuzzySearch">{{ tt('查找') }}</span>
      </div>
      <div v-if="fuzzySearched" class="fuzzy-result">
        <div class="fuzzy-result-head">
          {{ tt('结果') }}：{{ fuzzyResults.length }} {{ tt('行') }}
          <span v-if="fuzzyResults.length > FUZZY_SHOW">{{ tt('（清单仅显示前 {m} 行）').replace('{m}', String(FUZZY_SHOW)) }}</span>
        </div>
        <div
          v-for="(r, ri) in fuzzyResults.slice(0, FUZZY_SHOW)"
          :key="'fr' + ri"
          class="fuzzy-result-row"
          @click="openFuzzyResult(r)"
        >
          <span class="fz-no">{{ tt(r.tabKey) }} · {{ r.no }}</span>
          <span class="fz-meta">{{ r.hit }}</span>
        </div>
        <div v-if="!fuzzyResults.length" class="fuzzy-empty">{{ tt('未找到匹配行') }}</div>
      </div>
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
          <!-- 数据行:值列全部文本(±公差/区间是文本),物料类别由页签隐式携带不显示。
               只读态=纯文本;仅「修改」过的那一行(或刚新增的行)渲染输入框 -->
          <tr
            v-for="(row, i) in rowsOf(tab)"
            :key="row.id ?? ('new' + i)"
            :class="{ 'qc-flash': isFlash(row) }"
            :data-edit="isEditing(row) ? '1' : null"
          >
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
            <td :colspan="tab.cols.length" class="rs-empty">{{ tt('暂无数据') }}</td>
            <td v-if="editable" class="rsp-op-pad"></td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="rs-add" :style="{ width: gridW(tab) + 'px' }" @click="addRow(tab)">＋ {{ tt('新增数据记录行') }}</div>
    </div>

    <!-- 修改记录(2026-09-22):每次保存留痕——操作人/时间 + 行变化摘要 + 字段级 原值→新值(近 3 次) -->
    <el-dialog v-model="modLogVisible" :title="tt('修改记录') + (modLogNo ? ' · ' + modLogNo : '')" width="760px" append-to-body>
      <div v-if="modLogLoading" class="mod-log-empty">{{ tt('查询中…') }}</div>
      <div v-else-if="!modLogRecords.length" class="mod-log-empty">{{ tt('暂无修改记录') }}</div>
      <div v-else class="mod-log-list">
        <div v-for="(r, ri) in modLogRecords" :key="'ml' + ri" class="mod-log-card">
          <div class="mod-log-head">
            <span class="mod-log-seq">{{ tt('第') }} {{ modLogRecords.length - ri }} {{ tt('次保存') }}</span>
            <span>{{ tt('操作人') }}：{{ r.applyBy || '-' }} {{ r.applyAt || '' }}</span>
          </div>
          <table v-if="(r.changes || []).length" class="mod-log-table">
            <thead>
              <tr>
                <th style="width: 70px">{{ tt('类型') }}</th>
                <th style="width: 260px">{{ tt('字段') }}</th>
                <th>{{ tt('原内容') }}</th>
                <th>{{ tt('新内容') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c, ci) in r.changes" :key="ci">
                <td><span class="mod-kind" :class="String(c.kind)">{{ tt(String(c.kind)) }}</span></td>
                <td>{{ c.label }}</td>
                <td class="mod-old">{{ c.old || '—' }}</td>
                <td class="mod-new">{{ c.new || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="mod-log-nodata">{{ tt('本次保存未变更字段值') }}</div>
          <div v-if="r.changeMeta && (r.changeMeta.addedRows || r.changeMeta.removedRows || r.changeMeta.changedRows)" class="mod-log-meta">
            {{ tt('行变化') }}：{{ tt('新增') }} {{ r.changeMeta.addedRows || 0 }} {{ tt('行') }} / {{ tt('删除') }} {{ r.changeMeta.removedRows || 0 }} {{ tt('行') }} / {{ tt('修改') }} {{ r.changeMeta.changedRows || 0 }} {{ tt('行') }}
            <span v-if="(r.changeMeta.addedSamples || []).length">（{{ tt('新增') }}：{{ r.changeMeta.addedSamples.join('、') }}）</span>
            <span v-if="(r.changeMeta.removedSamples || []).length">（{{ tt('删除') }}：{{ r.changeMeta.removedSamples.join('、') }}）</span>
            <span v-if="r.changeMeta.truncated">（{{ tt('字段变化过多，仅显示前 80 条') }}）</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import { tt } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { callButton, errMsg } from '@/business/engine'
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
/** 当前处于编辑态的行(按对象引用比):默认 null=整表只读,防止随手改到数据 */
const editRow = ref(null)
function sourceItems() {
  if (!props.head?.detail) props.head.detail = {}
  if (!Array.isArray(props.head.detail.items)) props.head.detail.items = []
  return props.head.detail.items
}
// 镜像同步(2026-09-23 修):本 watch 只在 detail.items **引用变化**时触发 —— 即载入/切单/刷新,
// 以及 addRow 里 sourceItems() 首次创建 detail.items 的那一次。原实现无条件清 editRow,于是
// 「＋新增数据记录行」加出来的那一行(排在表格最下面)刚进入可填状态就被清成只读文本
// (填写时看不见),再点「修改」也会被同一批重置冲掉(还是不肯修改)。
// 故:编辑进行中**保留编辑态与脏标记**(只同步镜像,新行不丢);
//     非编辑态(载入/切单/保存后刷新)照旧重置镜像并清脏标记。
watch(
  () => props.head?.detail?.items,
  (arr) => {
    const next = Array.isArray(arr) ? arr : []
    if (editRow.value !== null) {
      if (next.length !== rows.value.length || next.some((r, i) => toRaw(r) !== toRaw(rows.value[i]))) {
        rows.value = [...next]
      }
      return
    }
    rows.value = [...next]
    dirty.value = false
  },
  { immediate: true },
)
/** 两侧都取 raw 再比:ref 里的对象读出来是 reactive 代理,模板里的行也是代理,代理≠原对象 */
function isEditing(row) {
  return editRow.value !== null && toRaw(row) === toRaw(editRow.value)
}
function startEdit(row) {
  editRow.value = toRaw(row)
  scrollEditIntoView()
}
/** 把「正在编辑/刚新增」的那一行滚进视野(2026-09-23)。
 *  缘由:折叠棉等页签行数多(实测 26 行),新增行按 id 排到**表格最下面**、
 *  落在视口之外 —— 输入框其实已渲染且能打字(实测 123×22、visible、无裁剪),
 *  但用户看不到,表现就是"新增时填写看不见""点修改也不可编辑"(其实状态已切换)。
 *  用 block:'nearest' 只做最小滚动,不把整页跳走。 */
function scrollEditIntoView() {
  nextTick(() => {
    const el = document.querySelector('.qc-paper tr[data-edit="1"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}
function endEdit() {
  editRow.value = null
}
/** 模糊搜索跳转后的高亮行(同样两侧取 raw 比) */
const flashRow = ref(null)
function isFlash(row) {
  return flashRow.value !== null && toRaw(row) === toRaw(flashRow.value)
}
/** 页签行集:按物料类别过滤;id 升序对齐 Excel 原序(服务端返回 id 倒序),新行殿后 */
function tabRows(t) {
  return rows.value
    .filter((r) => String(r['物料类别'] || '') === t.key)
    .slice()
    .sort((a, b) => (a.id ?? 1e15) - (b.id ?? 1e15))
}
/** 当前页签的行集(2026-09-22:原来的表头关键字过滤框已删,查找统一走「模糊搜索」) */
function rowsOf(t) {
  return tabRows(t)
}

function addRow(t) {
  const row = { '物料类别': t.key }
  sourceItems().push(row) // 原数组(保存取数)
  rows.value.push(row) // 镜像(界面响应)
  editRow.value = row // 新行直接可填
  touchDirty()
  scrollEditIntoView() // 新行在表格最下面,滚进视野(否则"填写时看不见")
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
  // 镜像 watch 在"编辑进行中"会保留编辑态,刷新属于真·重载,先把编辑态清掉再取数
  editRow.value = null
  emit('refresh')
}

// ── 模糊搜索(同立项申请那套:字段+内容多条件 AND,可跨页签)→ 点结果跳到该行并高亮 ──
const FUZZY_SHOW = 50
const fuzzyOpen = ref(false)
const fuzzySearched = ref(false)
const fuzzyRows = ref([{ field: '', value: '' }])
/** 条件字段下拉:按页签分组列全部叶子列(同一列出现在多个页签时各自成项,匹配跨页签生效) */
const fuzzyFieldGroups = computed(() => tabs.map((t) => ({
  label: t.key,
  options: t.cols.map((c) => ({ value: c.key, label: c.key })),
})))
function toggleFuzzy() {
  fuzzyOpen.value = !fuzzyOpen.value
  if (!fuzzyOpen.value) fuzzySearched.value = false
}
function closeFuzzy() {
  fuzzyOpen.value = false
  fuzzySearched.value = false
}
function addFuzzyRow() {
  fuzzyRows.value.push({ field: '', value: '' })
}
function removeFuzzyRow(i) {
  fuzzyRows.value.splice(i, 1)
  if (!fuzzyRows.value.length) addFuzzyRow()
}
/** 查找=置标记,结果由 fuzzyResults 计算属性即时算(与立项申请同款:改条件要重新点查找) */
function runFuzzySearch() {
  fuzzySearched.value = true
}
/** 结果行集:每个条件都要命中(字段空=该页签任意列),命中列与值一并带出便于核对 */
const fuzzyResults = computed(() => {
  if (!fuzzySearched.value) return []
  const conds = fuzzyRows.value.map((r) => ({ field: r.field || '', value: String(r.value || '').trim().toLowerCase() })).filter((c) => c.value)
  if (!conds.length) return []
  const out = []
  tabs.forEach((t, ti) => {
    for (const row of tabRows(t)) {
      const hits = []
      let ok = true
      for (const c of conds) {
        const cols = c.field ? [c.field] : t.cols.map((x) => x.key)
        const hitCol = cols.find((k) => String(row[k] ?? '').toLowerCase().includes(c.value))
        if (!hitCol) { ok = false; break }
        hits.push(`${hitCol}=${String(row[hitCol] ?? '').trim()}`)
      }
      if (ok) out.push({ tabIndex: ti, tabKey: t.key, row, no: row[t.cols[0].key] || row['物料编号'] || '#' + (row.id ?? ''), hit: hits.join('；') })
    }
  })
  return out
})
function openFuzzyResult(r) {
  activeTab.value = r.tabIndex
  flashRow.value = toRaw(r.row)
  nextTick(() => {
    const el = document.querySelector('.qc-insp-sheet .qc-flash')
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
  setTimeout(() => { flashRow.value = null }, 2600)
}

// ── 修改记录(本表每次保存留痕:操作人/时间 + 行变化摘要 + 字段级变化) ──
const modLogVisible = ref(false)
const modLogLoading = ref(false)
const modLogRecords = ref([])
const modLogNo = ref('')
async function openModifyLog() {
  const no = props.head?.['编号'] || props.head?.['单据编号'] || ''
  modLogVisible.value = true
  modLogLoading.value = true
  try {
    const res = await callButton({ panelCode: props.panelCode, buttonName: '修改记录', formData: { 编号: no }, buttonParam: {} })
    modLogNo.value = res?.编号 || no
    modLogRecords.value = (res?.records || []).map((r) => ({
      ...r,
      changes: typeof r.changes === 'string' ? (safeParseJson(r.changes) || []) : (r.changes || []),
      changeMeta: typeof r.changeMeta === 'string' ? (safeParseJson(r.changeMeta) || {}) : (r.changeMeta || {}),
    }))
  } catch (e) {
    modLogRecords.value = []
    ElMessage.error(errMsg(e) || tt('查询失败'))
  } finally {
    modLogLoading.value = false
  }
}
function safeParseJson(s) {
  try { return JSON.parse(s) } catch { return null }
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

/* ── 第二行工具钮(模糊搜索/修改记录),与第一行同款按钮 ── */
.qc-bar2 {
  justify-content: flex-end;
  padding-bottom: 6px;
}

/* ── 模糊搜索(同 PanelxList 立项申请那套版式) ── */
.fuzzy-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  margin: 0 0 8px;
  border: 1px solid #dbe6f3;
  border-radius: 6px;
  background: #f8fbff;
}
.fuzzy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  padding: 0 2px 2px;
}
.fuzzy-back {
  cursor: pointer;
  color: #909399;
  font-size: 13px;
}
.fuzzy-back:hover {
  color: #409eff;
}
.fuzzy-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.fuzzy-field {
  width: 130px;
  flex: none;
}
.fuzzy-value {
  flex: 1;
  min-width: 0;
}
.fuzzy-del {
  flex: none;
  width: 16px;
  text-align: center;
  cursor: pointer;
  color: #c0c4cc;
  font-size: 14px;
  line-height: 1;
}
.fuzzy-del:hover {
  color: #f56c6c;
}
.fuzzy-btns {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.fuzzy-result {
  margin-top: 4px;
  border-top: 1px dashed #e4e7ed;
  padding-top: 6px;
  max-height: 320px;
  overflow: auto;
}
.fuzzy-result-head {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}
.fuzzy-result-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}
.fuzzy-result-row:hover {
  background: #eef6ff;
}
.fz-no {
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fz-meta {
  color: #909399;
  font-size: 11px;
  white-space: nowrap;
}
.fuzzy-empty {
  font-size: 12px;
  color: #909399;
  padding: 4px;
}
/* 模糊搜索结果跳过来的那一行:短暂高亮(2.6s 后自动褪去) */
.qc-flash > td {
  background: #fff8dc !important;
  transition: background 0.6s ease;
}

/* ── 修改记录弹窗(同 PanelxList 版式) ── */
.mod-log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow: auto;
}
.mod-log-card {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
}
.mod-log-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}
.mod-log-seq {
  font-weight: 600;
  color: #374151;
}
.mod-log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.mod-log-table th,
.mod-log-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
  word-break: break-all;
}
.mod-log-table th {
  background: #f3f4f6;
  font-weight: 500;
}
.mod-old {
  color: #9ca3af;
}
.mod-new {
  color: #111827;
}
.mod-kind {
  display: inline-block;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
}
.mod-kind.变化 {
  color: #1d4ed8;
  background: #eff6ff;
}
.mod-kind.补充 {
  color: #047857;
  background: #ecfdf5;
}
.mod-kind.清空 {
  color: #b45309;
  background: #fffbeb;
}
.mod-log-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.mod-log-empty,
.mod-log-nodata {
  font-size: 12.5px;
  color: #9ca3af;
  padding: 6px 0;
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
