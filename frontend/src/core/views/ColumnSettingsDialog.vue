<!-- ColumnSettingsDialog.vue — 通用「列设置」弹窗(2026-10-29;同日补「调整列顺序」)

     背景:代码规范 C4/D2 要求「列调整」只允许有一套通用实现;`useReportColumns`
     已经管着列显隐/排序/后端持久化,但**列设置弹窗从未落地**(报表面板只用了排序与筛选),
     各业务页因此各自画勾选列表。本组件补上这块通用 UI。

     契约(无状态,显隐/顺序草稿由调用方的 `useReportColumns` 持有):
       · props.columns = [{ prop, label, visible }]  ← buildReportColumnSettings 的产物;**数组顺序即列顺序**
       · emit('toggle', { prop, visible })            ← 勾/取消勾某一列(父组件改草稿)
       · emit('move',  { prop, delta })               ← ▲/▼ 调整列顺序(delta=-1 上移/靠左,+1 下移/靠右)
       · emit('reset')                                ← 恢复默认(父组件 resetDraft:全部可见 + 默认顺序)
       · emit('save')                                 ← 保存(父组件 saveDialog → /px/reportColumnSettings)
       · emit('update:modelValue', false)             ← 取消/关闭(父组件据此回滚草稿)
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
    <div class="csd-tip">{{ tt('勾选决定显示哪几列;▲▼ 调整列顺序(上移=靠左)') }}</div>
    <div class="csd-list">
      <div v-for="(c, i) in columns" v-show="match(c)" :key="c.prop" class="csd-item">
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
const emit = defineEmits(['update:modelValue', 'toggle', 'move', 'reset', 'save'])

/** 列名过滤(列多时找得快;只影响显示,不影响 ▲▼ 的真实下标) */
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
</script>

<style scoped>
.csd-bar { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.csd-count { margin-left: auto; color: #909399; font-size: 12px; }
.csd-search { margin-bottom: 4px; }
.csd-tip { color: #909399; font-size: 12px; margin-bottom: 6px; }
.csd-list { max-height: 360px; overflow: auto; }
.csd-item { display: flex; align-items: center; gap: 6px; padding: 2px 4px; border-radius: 4px; }
.csd-item:hover { background: #f5f7fa; }
.csd-label { flex: 1; font-size: 13px; color: #303133; }
.csd-arrows { display: inline-flex; align-items: center; }
.csd-arrows :deep(.el-button) { padding: 2px 4px; font-size: 12px; color: #606266; }
.csd-empty { color: #909399; font-size: 13px; padding: 8px 0; }
</style>
