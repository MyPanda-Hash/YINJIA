<!-- ColumnSettingsDialog.vue — 通用「列设置」弹窗(2026-10-29;同日补「调整列顺序」→ 2026-10-30 拖动排序)

     背景:代码规范 C4/D2 要求「列调整」只允许有一套通用实现;`useReportColumns`
     已经管着列显隐/排序/后端持久化,但**列设置弹窗从未落地**(报表面板只用了排序与筛选),
     各业务页因此各自画勾选列表。本组件补上这块通用 UI。

     排序两种操作(2026-10-30 用户口径「让这个能拖动吧」→ 当日二次修「拖了但列位置没变」):
       · **拖动 ⠿ 手柄**换位:用 **Pointer Events(pointerdown/move/up)** 自己算落点,
         不用 HTML5 原生 DnD —— 原生 DnD 在弹窗里表现不稳定(要 dropEffect 恰好被接受、
         Firefox 还要 setData,实机出现过"能拖但松手不换位"),且触屏完全不支持;
         指针方案鼠标/触屏/手写笔一致,拖起行半透明 + **行间蓝色插入线**标出落点;
       · **▲/▼** 保留作微调与键盘/无障碍兜底。
       两者都只改调用方的草稿,点「保存」才落库。

     契约(无状态,显隐/顺序草稿由调用方的 `useReportColumns` 持有):
       · props.columns = [{ prop, label, visible }]  ← buildReportColumnSettings 的产物;**数组顺序即列顺序**
       · emit('toggle',  { prop, visible })           ← 勾/取消勾某一列(父组件改草稿)
       · emit('move',    { prop, delta })              ← ▲/▼ 微调(delta=-1 上移/靠左,+1 下移/靠右)
       · emit('reorder', { from, to })                 ← 拖动换位(下标基于 props.columns 全量数组;to=拖动后的目标下标)
       · emit('reset')                                 ← 恢复默认(父组件 resetDraft:全部可见 + 默认顺序)
       · emit('save')                                  ← 保存(父组件 saveDialog → /px/reportColumnSettings)
       · emit('update:modelValue', false)              ← 取消/关闭(父组件据此回滚草稿)
     锁定常显的列由调用方**不传进来**(弹窗只管可调整列)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('列设置')" width="480px" append-to-body
             class="csd-dialog" @update:model-value="(v) => emit('update:modelValue', v)">
    <div class="csd-bar">
      <el-button link type="primary" size="small" @click="setAll(true)">{{ tt('全选') }}</el-button>
      <el-button link type="primary" size="small" @click="setAll(false)">{{ tt('全不选') }}</el-button>
      <el-button link type="primary" size="small" @click="emit('reset')">{{ tt('恢复默认') }}</el-button>
      <span class="csd-count">{{ tt('显示') }} {{ checkedCount }}/{{ columns.length }}</span>
    </div>
    <el-input v-model="kw" size="small" clearable :placeholder="tt('搜索')" class="csd-search" />
    <div class="csd-tip">{{ tt('勾选决定显示哪几列;拖动 ⠿ 或点 ▲▼ 调整列顺序(上移=靠左)') }}</div>
    <div ref="listRef" class="csd-list" :class="{ 'is-dragging': dragging }">
      <template v-for="(c, i) in columns" :key="c.prop">
        <!-- 落点插入线:画在目标行之前(拖动时才出现) -->
        <div v-if="dragging && insertAt === i" class="csd-insert"></div>
        <div v-show="match(c)" class="csd-item" :data-idx="i" :class="{ 'is-dragged': dragging && dragFrom === i }">
          <span class="csd-drag" :title="tt('拖动调整列顺序')" @pointerdown.prevent="startDrag(i, $event)">⠿</span>
          <el-checkbox :model-value="!!c.visible" @change="(v) => emit('toggle', { prop: c.prop, visible: !!v })" />
          <span class="csd-label" :title="c.prop">{{ tt(c.label || c.prop) }}</span>
          <span class="csd-arrows">
            <el-button link size="small" :disabled="i === 0" :title="tt('上移')"
                       @click="emit('move', { prop: c.prop, delta: -1 })">▲</el-button>
            <el-button link size="small" :disabled="i === columns.length - 1" :title="tt('下移')"
                       @click="emit('move', { prop: c.prop, delta: 1 })">▼</el-button>
          </span>
        </div>
      </template>
      <!-- 拖到列表末尾(最后一行之后)的落点线 -->
      <div v-if="dragging && insertAt >= columns.length" class="csd-insert"></div>
      <span v-if="!matchedAny" class="csd-empty">{{ tt('无数据') }}</span>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" @click="emit('save')">{{ tt('保存') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 列草稿(数组顺序=列顺序):[{ prop, label, visible }](来自 useReportColumns.columnDraft) */
  columns: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'toggle', 'move', 'reorder', 'reset', 'save'])

/** 列名过滤(列多时找得快;只影响显示,不影响拖拽/▲▼ 的真实下标) */
const kw = ref('')
const checkedCount = computed(() => props.columns.filter((c) => c.visible).length)
function match(c) {
  const q = kw.value.trim()
  return !q || String(c.label || c.prop).includes(q) || String(c.prop).includes(q)
}
const matchedAny = computed(() => props.columns.some((c) => match(c)))

/** 全选/全不选:逐列发 toggle,草稿由父组件统一改(保持单向数据流) */
function setAll(visible) {
  for (const c of props.columns) if (!!c.visible !== visible) emit('toggle', { prop: c.prop, visible })
}

/* ── 拖动排序:Pointer Events 自算落点(不用 HTML5 DnD,见文件头注释) ──
   下标一律用 props.columns 的**全量下标**(行上 data-idx),搜索过滤时也准。 */
const listRef = ref(null)
const dragging = ref(false)   // 是否正在拖动(控制插入线/拖起行样式)
const dragFrom = ref(-1)      // 被拖行的全量下标
const insertAt = ref(-1)      // 落点:插到该全量下标之前(== columns.length 表示插到末尾)
let startY = 0
let movedEnough = false

function startDrag(i, e) {
  if (e.button !== undefined && e.button !== 0) return   // 只认左键(触屏 button=0)
  dragFrom.value = i
  insertAt.value = i
  dragging.value = true
  startY = e.clientY
  movedEnough = false
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

/** 指针移动:算落点 + 靠近上下边缘时自动滚动 */
function onPointerMove(e) {
  if (!dragging.value) return
  if (Math.abs(e.clientY - startY) > 3) movedEnough = true
  autoScroll(e.clientY)
  insertAt.value = calcInsertAt(e.clientY)
  if (e.cancelable) e.preventDefault()
}

/** 落点 = 光标中心线落在哪一行之前;超过最后一行中心 ⇒ 末尾 */
function calcInsertAt(clientY) {
  const el = listRef.value
  if (!el) return dragFrom.value
  const rows = [...el.querySelectorAll('.csd-item')].filter((r) => r.offsetParent !== null)
  if (!rows.length) return 0
  for (const row of rows) {
    const r = row.getBoundingClientRect()
    if (clientY < r.top + r.height / 2) return Number(row.dataset.idx)
  }
  return Number(rows[rows.length - 1].dataset.idx) + 1
}

/** 列表超出可视高度时,拖到上下 24px 内自动滚动 */
function autoScroll(clientY) {
  const el = listRef.value
  if (!el || el.scrollHeight <= el.clientHeight) return
  const r = el.getBoundingClientRect()
  if (clientY < r.top + 24) el.scrollTop = Math.max(0, el.scrollTop - 12)
  else if (clientY > r.bottom - 24) el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + 12)
}

function onPointerUp() {
  const from = dragFrom.value
  const ins = insertAt.value
  const moved = movedEnough && ins >= 0 && ins !== from && ins !== from + 1
  stopDrag()
  if (!moved) return   // 没真的移动(单击手柄)或落回原位 ⇒ 不换位
  // 插入位置 → 移除后的目标下标:插到 from 之后时整体前移一位
  const to = ins > from ? ins - 1 : ins
  emit('reorder', { from, to })
}

function stopDrag() {
  dragging.value = false
  dragFrom.value = -1
  insertAt.value = -1
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}
onBeforeUnmount(stopDrag)
</script>

<style scoped>
.csd-bar { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.csd-count { margin-left: auto; color: #909399; font-size: 12px; }
.csd-search { margin-bottom: 4px; }
.csd-tip { color: #909399; font-size: 12px; margin-bottom: 6px; }
.csd-list { max-height: 360px; overflow: auto; }
.csd-list.is-dragging { user-select: none; cursor: grabbing; }
.csd-item { display: flex; align-items: center; gap: 6px; padding: 2px 4px; border-radius: 4px; }
.csd-item:hover { background: #f5f7fa; }
/* 拖动排序:手柄可抓(触屏要吃掉默认手势);拖起行半透明;落点画蓝色插入线 */
.csd-drag { cursor: grab; color: #a8abb2; font-size: 13px; user-select: none; letter-spacing: -1px; touch-action: none; }
.csd-drag:active { cursor: grabbing; }
.csd-item.is-dragged { opacity: .45; background: #ecf5ff; }
.csd-insert { height: 2px; margin: 1px 4px; background: #409eff; border-radius: 1px; }
.csd-label { flex: 1; font-size: 13px; color: #303133; }
.csd-arrows { display: inline-flex; align-items: center; }
.csd-arrows :deep(.el-button) { padding: 2px 4px; font-size: 12px; color: #606266; }
.csd-empty { color: #909399; font-size: 13px; padding: 8px 0; }
</style>
