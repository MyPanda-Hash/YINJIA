<!-- ColumnSettingsDialog.vue — 通用「列设置」弹窗(2026-10-29;同日补「调整列顺序」→ 2026-10-30 补「拖动排序」)

     背景:代码规范 C4/D2 要求「列调整」只允许有一套通用实现;`useReportColumns`
     已经管着列显隐/排序/后端持久化,但**列设置弹窗从未落地**(报表面板只用了排序与筛选),
     各业务页因此各自画勾选列表。本组件补上这块通用 UI。

     排序两种操作(2026-10-30 用户口径「让这个能拖动吧,现在操作太死板了,实现这个模式即可」):
       · **拖动行/手柄 ⠿** 直接换位(HTML5 原生拖拽,零依赖;拖起行半透明、落点行高亮);
       · **▲/▼** 保留作为微调与不支持拖拽的环境(触屏/键盘)的兜底。
       两者都只改调用方的草稿,点「保存」才落库。

     契约(无状态,显隐/顺序草稿由调用方的 `useReportColumns` 持有):
       · props.columns = [{ prop, label, visible }]  ← buildReportColumnSettings 的产物;**数组顺序即列顺序**
       · emit('toggle',  { prop, visible })           ← 勾/取消勾某一列(父组件改草稿)
       · emit('move',    { prop, delta })              ← ▲/▼ 微调(delta=-1 上移/靠左,+1 下移/靠右)
       · emit('reorder', { from, to })                 ← 拖动换位(下标均基于 props.columns 全量数组)
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
    <div class="csd-list">
      <div v-for="(c, i) in columns" v-show="match(c)" :key="c.prop"
           class="csd-item" draggable="true"
           :class="{ 'is-dragging': dragIdx === i, 'is-drop': overIdx === i && dragIdx !== i }"
           @dragstart="onDragStart(i, $event)" @dragover.prevent="onDragOver(i, $event)"
           @drop.prevent="onDrop(i)" @dragend="onDragEnd">
        <span class="csd-drag" :title="tt('拖动调整列顺序')">⠿</span>
        <el-checkbox :model-value="!!c.visible" @change="(v) => emit('toggle', { prop: c.prop, visible: !!v })" />
        <span class="csd-label" :title="c.prop">{{ tt(c.label || c.prop) }}</span>
        <span class="csd-arrows">
          <el-button link size="small" :disabled="i === 0" :title="tt('上移')"
                     @click="emit('move', { prop: c.prop, delta: -1 })">▲</el-button>
          <el-button link size="small" :disabled="i === columns.length - 1" :title="tt('下移')"
                     @click="emit('move', { prop: c.prop, delta: 1 })">▼</el-button>
        </span>
      </div>
      <span v-if="!matchedAny" class="csd-empty">{{ tt('无数据') }}</span>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" @click="emit('save')">{{ tt('保存') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
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

/* ── 拖动排序(HTML5 原生 DnD;下标一律用 props.columns 的全量下标,过滤时也准) ── */
const dragIdx = ref(-1)   // 正在拖的行
const overIdx = ref(-1)   // 悬停到的目标行(高亮提示落点)

function onDragStart(i, e) {
  dragIdx.value = i
  overIdx.value = -1
  try {
    // Firefox 必须 setData 才真正开始拖拽;Chromium 也用它携带纯文本兜底
    e.dataTransfer.setData('text/plain', String(i))
    e.dataTransfer.effectAllowed = 'move'
  } catch { /* 合成事件/极老浏览器没有 dataTransfer:拖动仍可用(仅换位靠 emit) */ }
}
function onDragOver(i, e) {
  overIdx.value = i
  try { e.dataTransfer.dropEffect = 'move' } catch { /* 同上 */ }
}
function onDrop(i) {
  const from = dragIdx.value
  onDragEnd()
  if (from < 0 || from === i) return
  emit('reorder', { from, to: i })
}
function onDragEnd() {
  dragIdx.value = -1
  overIdx.value = -1
}
</script>

<style scoped>
.csd-bar { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.csd-count { margin-left: auto; color: #909399; font-size: 12px; }
.csd-search { margin-bottom: 4px; }
.csd-tip { color: #909399; font-size: 12px; margin-bottom: 6px; }
.csd-list { max-height: 360px; overflow: auto; }
.csd-item { display: flex; align-items: center; gap: 6px; padding: 2px 4px; border-radius: 4px; }
.csd-item:hover { background: #f5f7fa; }
/* 拖动排序:手柄可抓;拖起行半透明,目标行画一条落点线 */
.csd-drag { cursor: grab; color: #a8abb2; font-size: 13px; user-select: none; letter-spacing: -1px; }
.csd-drag:active { cursor: grabbing; }
.csd-item.is-dragging { opacity: .45; background: #ecf5ff; }
.csd-item.is-drop { box-shadow: inset 0 2px 0 #409eff; }
.csd-label { flex: 1; font-size: 13px; color: #303133; }
.csd-arrows { display: inline-flex; align-items: center; }
.csd-arrows :deep(.el-button) { padding: 2px 4px; font-size: 12px; color: #606266; }
.csd-empty { color: #909399; font-size: 13px; padding: 8px 0; }
</style>
