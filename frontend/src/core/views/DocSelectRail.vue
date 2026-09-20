<template>
  <!-- 左侧「单据选择」栏(对齐 PANDA 暂收入库单选择):部门下拉+关键字查找+小表格(列按单据配置:
       首列单号/次列日期/末列审核状态标签,中间列由挂载方挑重要字段),
       点行切换右侧当前单据(数据=当前页单据列表镜像,过滤纯前端)。
       表格 width:100% + min-width:max-content(拖宽跟随/拖窄出横向滚动条),全格 nowrap 无交叉。 -->
  <div v-if="!collapsed" ref="railEl" class="doc-select-rail" :style="{ width: width + 'px' }">
    <div class="dsr-head">
      <span class="dsr-title" :title="title">{{ title }}</span>
      <span class="dsr-coll" :title="tt('收起')" @click="$emit('toggle')">«</span>
    </div>
    <div class="dsr-filters">
      <el-select v-model="dept" clearable filterable size="small" :placeholder="tt('部门')" class="dsr-dept" @change="apply">
        <el-option v-for="d in depts" :key="d" :label="d" :value="d" />
      </el-select>
      <div class="dsr-kw">
        <el-input v-model="kw" size="small" clearable :placeholder="tt('输入搜索')" @keyup.enter="apply" @clear="apply" />
        <el-button size="small" type="primary" plain @click="apply">{{ tt('查找') }}</el-button>
      </div>
      <div class="dsr-count">{{ tt('共有数据') }}: {{ total }} {{ tt('条') }}<span v-if="filtered.length !== rows.length" class="dsr-count-sub">（{{ tt('本页筛出') }} {{ filtered.length }}）</span></div>
    </div>
    <!-- 顶层翻页条:整页翻(50 条/页),与左栏内容同一数据源(后端分页页号) -->
    <DocRailPager
      :page-no="pageNo" :page-count="pageCount" :from="rangeFrom" :to="rangeTo" :total="total"
      @go="(p) => $emit('page', p)"
    />
    <div class="dsr-grid">
      <table ref="tableEl">
        <thead>
          <tr>
            <th v-for="c in cols" :key="c.label" :class="c.align === 'center' ? 'a-center' : 'a-left'">{{ tt(c.label) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in filtered"
            :key="r.key"
            :class="{ active: r.no === currentNo }"
            @click="$emit('select', r.idx)"
          >
            <td
              v-for="(c, ci) in cols"
              :key="c.label"
              :class="[c.align === 'center' ? 'a-center' : 'a-left', { 'dsr-no': c.no }]"
              :title="r.cells[ci]"
            >
              <span v-if="c.tag && r.cells[ci]" class="dsr-tag" :class="tagClass(r.cells[ci])">{{ tt(r.cells[ci]) }}</span>
              <template v-else>{{ r.cells[ci] }}</template>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td :colspan="cols.length" class="dsr-empty">{{ tt('暂无数据') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- 底层翻页条(与顶层同源同款):长列表滚到底部也能直接翻页 -->
    <DocRailPager
      :page-no="pageNo" :page-count="pageCount" :from="rangeFrom" :to="rangeTo" :total="total"
      @go="(p) => $emit('page', p)"
    />
    <div class="dsr-resizer" :title="tt('拖动调整宽度')" @mousedown.prevent="startDrag"></div>
  </div>
  <div v-else class="doc-select-rail coll" :title="title" @click="$emit('toggle')">»</div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { tt } from '@/i18n'
import DocRailPager from './DocRailPager.vue'

const props = defineProps({
  title: { type: String, default: '' },
  /** 当前页单据列表(PanelxList list,行键=中文标签) */
  rows: { type: Array, default: () => [] },
  /** 当前单据编号(高亮) */
  currentNo: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
  /** 单据总张数(后端 totalSize,全量而非本页)——「共有数据」与页码都按它算 */
  total: { type: Number, default: 0 },
  /** 当前页号(1 基,= 后端 pageNo) */
  pageNo: { type: Number, default: 1 },
  /** 每页条数(整页翻的步长,当前 50) */
  pageSize: { type: Number, default: 50 },
  /** 列配置(按单据定制):[{label, keys(候选行键,取首个非空), align, tag(状态标签), no(单号样式)}];
   *  约定首列=单号、次列=日期、末列=审核状态(tag),中间列由挂载方按单据挑重要字段 */
  columns: { type: Array, default: null },
})
defineEmits(['select', 'toggle', 'page'])

/** 总页数:按总张数与每页条数算,至少 1 页 */
const pageCount = computed(() => Math.max(1, Math.ceil((props.total || 0) / Math.max(1, props.pageSize))))
/** 本页首/末条的全局序号(展示「1-50 / 59」) */
const rangeFrom = computed(() => (props.rows.length ? (props.pageNo - 1) * props.pageSize + 1 : 0))
const rangeTo = computed(() => (props.rows.length ? rangeFrom.value + props.rows.length - 1 : 0))

const noOf = (row) => String(row['编号'] || row['单据编号'] || row['单号'] || '')

/** 兜底列(未传 columns 时):与送料暂收单原五列一致 */
const DEFAULT_COLUMNS = [
  { label: '单号', keys: ['编号', '单据编号', '单号'], align: 'left', no: true },
  { label: '日期', keys: ['日期', '单据日期'], align: 'left' },
  { label: '供应商', keys: ['供应商'], align: 'left' },
  { label: '部门', keys: ['部门'], align: 'center' },
  { label: '审核状态', keys: ['单据状态'], align: 'center', tag: true },
]
const cols = computed(() => (props.columns && props.columns.length ? props.columns : DEFAULT_COLUMNS))
const colValue = (row, c) => {
  // derive 列:值由挂载方函数从行派生(如转ERP状态:行上无现成字段,由 ERP单号/是否已转ERP 推出)
  if (typeof c.derive === 'function') return c.derive(row) ?? ''
  for (const k of c.keys || [c.label]) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return ''
}

const dept = ref('')
const kw = ref('')
const appliedDept = ref('')
const appliedKw = ref('')
const apply = () => { appliedDept.value = dept.value || ''; appliedKw.value = (kw.value || '').trim().toLowerCase() }

const depts = computed(() => [...new Set(props.rows.map((r) => r['部门']).filter(Boolean))])
const filtered = computed(() => {
  const out = []
  props.rows.forEach((row, idx) => {
    const no = noOf(row)
    if (appliedDept.value && String(row['部门'] ?? '') !== appliedDept.value) return
    const cells = cols.value.map((c) => colValue(row, c))
    if (appliedKw.value && !cells.some((v) => String(v ?? '').toLowerCase().includes(appliedKw.value))) return
    out.push({ key: no + '#' + idx, idx, no, cells })
  })
  return out
})

/** 状态标签色彩(沿用系统制造绿体系:主色=已审核,青蓝=已完成(与已审核区分),
 *  中性灰=草稿,琥珀=流转中,红=作废/驳回) */
const TAG_OK = ['已审核', '已归档', '生产中', '已完工', '已关闭', '已审批', '已通过', '已转']
/** 已完成(金蝶自动关单):与「已审核」同为正常终态,但语义是"做完了",用青蓝一眼区分 */
const TAG_DONE = ['已完成']
const TAG_PENDING = ['审批中', '修改中', '删除申请中', '修改申请中', '提交审批']
const TAG_DANGER = ['已作废', '已中止', '已终止', '审批驳回', '驳回']
function tagClass(status) {
  const s = String(status || '')
  if (TAG_DONE.includes(s)) return 'done'
  if (TAG_OK.includes(s)) return 'ok'
  if (TAG_DANGER.includes(s)) return 'danger'
  if (TAG_PENDING.includes(s)) return 'pending'
  return 'draft'
}

// ---- 拖拽调宽:只改本栏外层宽度;表格 width:100% + min-width:max-content ——
// 面板拖宽时表格跟随一起变宽(列同步伸展),拖窄到自然宽以下时容器出横向滚动条。
// 宽度不做任何持久化(不写 localStorage):每次进页面按内容量一次即可。
const MIN_W = 200
const MAX_W = 560
const DEFAULT_W = 320 // 量出自然宽之前的兜底值
const width = ref(DEFAULT_W)
const railEl = ref(null)
const tableEl = ref(null)

/** 进入面板时量表格自然宽,把栏宽定到刚好完整展示;用户一旦拖拽即停止自动拟合(不持久化)。
 *  量法:临时切 max-content 取真实自然宽——表格常态跟随容器,直接量只会量到容器宽。
 *  只增不减:首帧数据未到时量到的是空表头宽,数据到达后会被真实值纠正。 */
let autoFit = true
let fittedW = 0
function fitOnce() {
  if (!autoFit) return
  const el = tableEl.value
  if (!el) return
  const prev = el.style.width
  el.style.width = 'max-content'
  const natural = Math.ceil(el.getBoundingClientRect().width || el.scrollWidth || 0)
  el.style.width = prev
  if (!natural) return
  const target = Math.min(MAX_W, Math.max(MIN_W, natural + 1))
  if (shrinkNext) { shrinkNext = false; fittedW = target; width.value = target; return }
  if (target > fittedW) { fittedW = target; width.value = target }
}
const refit = () => { autoFit = true; fittedW = 0; nextTick(fitOnce) }
// 切面板:旧面板的拟合值已无意义,清零后允许首轮拟合直接收缩到新面板的自然宽
const refitShrink = () => { autoFit = true; fittedW = 0; shrinkNext = true; nextTick(fitOnce) }
let shrinkNext = false
onMounted(() => nextTick(fitOnce))
watch(() => props.title, refitShrink)
watch(() => props.rows.length, (n) => { if (!n) refitShrink(); else nextTick(fitOnce) })
watch(() => props.collapsed, (c) => { if (!c) refit() })
let dragging = false
function onDragMove(e) {
  if (!dragging) return
  const left = railEl.value?.getBoundingClientRect().left ?? 0
  width.value = Math.min(MAX_W, Math.max(MIN_W, Math.round(e.clientX - left)))
}
function detachDrag() {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}
function onDragEnd() {
  if (!dragging) return
  dragging = false
  detachDrag()
}
function startDrag() {
  dragging = true
  autoFit = false // 用户开始拖拽:停止自动拟合,栏宽此后完全由拖拽决定
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}
// 卸载只解绑监听
onBeforeUnmount(detachDrag)
</script>

<style scoped>
.doc-select-rail {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--t-border, #dce4e1);
  background: #fafbfd;
  min-height: 0;
}
.dsr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  font-weight: 600;
  color: var(--t-text-1, #1e2b27);
  border-bottom: 1px solid var(--t-border-light, #edf1ef);
  background: var(--t-card-bg, #fff);
}
.dsr-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.dsr-coll {
  cursor: pointer;
  padding: 0 6px;
  color: var(--t-text-3, #8b9893);
  user-select: none;
}
.dsr-coll:hover { color: var(--t-primary, #116a5b); }
.dsr-filters { padding: 8px 10px; border-bottom: 1px solid var(--t-border-light, #edf1ef); }
.dsr-dept { width: 100%; }
.dsr-kw { display: flex; gap: 6px; margin-top: 8px; }
.dsr-count { margin-top: 8px; font-size: 12px; color: var(--t-text-2, #5d6c67); }
.dsr-count-sub { margin-left: 6px; color: var(--t-text-3, #8b9893); }

/* 表格外层:宽度跟随侧栏(100%);表格超宽即出横向滚动条(常显),绝不溢出侧栏。
   max-height 钉在视口内(约减去 工具栏+单号行+栏头/筛选 的高度):行数多时列表在侧栏内部
   纵向滚动(独立的滚动条),不再把整个布局撑高、逼整页滚动;行数少时不生效,行为不变 */
.dsr-grid {
  flex: 1;
  width: 100%;
  min-height: 0;
  max-height: calc(100vh - 230px);
  overflow-x: auto;
  overflow-y: auto;
}
/* 滚动条极窄(4px)+平时隐藏:滑块与轨道默认全透明,悬停侧栏时滑块才显色
   (悬停=将要使用;离开即隐)。轨道不画底色,4px 占位视觉上无感 */
.dsr-grid::-webkit-scrollbar { width: 4px; height: 4px; }
.dsr-grid::-webkit-scrollbar-track { background: transparent; }
.dsr-grid::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}
.dsr-grid:hover::-webkit-scrollbar-thumb { background: var(--el-color-primary-light-7, #b8d3ce); }
.dsr-grid:hover::-webkit-scrollbar-thumb:hover { background: var(--el-color-primary-light-5, #88b4ac); }
/* 表格:width:100% 跟随侧栏(拖宽即同步变宽,列一起伸展);
   min-width:max-content 保证不被压缩到内容自然宽以下(拖窄时由外层出横向滚动条) */
.dsr-grid table {
  width: 100%;
  min-width: max-content;
  border-collapse: collapse;
  font-size: 11px;
}
.dsr-grid th,
.dsr-grid td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--t-border-light, #edf1ef);
  white-space: nowrap; /* 强制单行:杜绝折行/竖排/交叉 */
  line-height: 1.2;
  vertical-align: middle;
}
.dsr-grid th {
  position: sticky;
  top: 0;
  /* 表头浅主色变体(系统制造绿 light-9) */
  background: var(--el-color-primary-light-9, #e8f1ef);
  color: var(--t-primary-dark, #0d584c);
  font-weight: 600;
  z-index: 1;
  border-bottom: 1px solid var(--el-color-primary-light-7, #b8d3ce);
}
.dsr-grid tbody tr { cursor: pointer; }
.dsr-grid tbody tr:hover { background: var(--t-hover-bg, #e9f3f0); }
.dsr-grid tbody tr.active { background: var(--el-color-primary-light-9, #e8f1ef); }
.dsr-grid tbody tr.active:hover { background: var(--el-color-primary-light-8, #cfe1de); }
.a-left { text-align: left; }
.a-center { text-align: center; }
.dsr-no { color: var(--t-primary, #116a5b); }
.dsr-empty { text-align: center; color: var(--t-text-3, #8b9893); padding: 16px 0; cursor: default; }

/* 状态标签:圆角 + 细边框 + 略小字号(紧凑) */
.dsr-tag {
  display: inline-block;
  padding: 0 5px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 10px;
  line-height: 14px;
  white-space: nowrap;
}
.dsr-tag.ok {
  color: var(--t-primary-dark, #0d584c);
  border-color: var(--el-color-primary-light-5, #88b4ac);
  background: var(--el-color-primary-light-9, #e8f1ef);
}
/* 已完成:青蓝(与「已审核」的绿明确区分——语义是"下游全部执行完、系统自动关单") */
.dsr-tag.done {
  color: #4338ca;
  border-color: #c7d2fe;
  background: #eef2ff;
}
.dsr-tag.draft {
  color: var(--t-text-2, #5d6c67);
  border-color: var(--t-border, #dce4e1);
  background: var(--t-content-bg, #f2f5f4);
}
.dsr-tag.pending { color: #8a6d1f; border-color: #e6d3a3; background: #fbf5e6; }
.dsr-tag.danger { color: #a83b2f; border-color: #eec3bc; background: #fdf1ef; }

/* 右缘拖拽手柄:仅改变栏宽 */
.dsr-resizer {
  position: absolute;
  top: 0;
  right: -2px;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 2;
}
.dsr-resizer:hover { background: var(--el-color-primary-light-7, #b8d3ce); }

.doc-select-rail.coll {
  width: 22px;
  align-items: center;
  justify-content: flex-start;
  padding-top: 8px;
  color: var(--t-text-3, #8b9893);
  cursor: pointer;
  font-weight: 600;
  user-select: none;
}
.doc-select-rail.coll:hover { color: var(--t-primary, #116a5b); background: var(--t-hover-bg, #e9f3f0); }
</style>
