<!-- ColumnSettingsDialog.vue — 通用「列设置」弹窗(2026-10-29)

     背景:代码规范 C4/D2 要求「列调整」只允许有一套通用实现;此前 `useReportColumns`
     已经管着列显隐/排序/后端持久化,但**列设置弹窗从未落地**(报表面板只用了排序与筛选),
     各业务页因此各自画勾选列表。本组件补上这块通用 UI。

     契约(无状态,显隐草稿由调用方的 `useReportColumns` 持有):
       · props.columns = [{ prop, label, visible }]  ← buildReportColumnSettings 的产物
       · emit('toggle', { prop, visible })            ← 勾/取消勾某一列(父组件改草稿)
       · emit('reset')                                ← 恢复默认(父组件 resetDraft)
       · emit('save')                                 ← 保存(父组件 saveDialog → /px/reportColumnSettings)
       · emit('update:modelValue', false)             ← 取消/关闭
     行序即草稿顺序(报表面板的列顺序由 yj_field.seq 决定,这里不做拖拽排序)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('列设置')" width="460px" append-to-body
             class="csd-dialog" @update:model-value="(v) => emit('update:modelValue', v)">
    <div class="csd-bar">
      <el-button link type="primary" size="small" @click="setAll(true)">{{ tt('全选') }}</el-button>
      <el-button link type="primary" size="small" @click="setAll(false)">{{ tt('全不选') }}</el-button>
      <el-button link type="primary" size="small" @click="emit('reset')">{{ tt('恢复默认') }}</el-button>
      <span class="csd-count">{{ tt('显示') }} {{ checkedCount }}/{{ columns.length }}</span>
    </div>
    <el-input v-model="kw" size="small" clearable :placeholder="tt('搜索')" class="csd-search" />
    <div class="csd-list">
      <label v-for="c in filtered" :key="c.prop" class="csd-item">
        <el-checkbox :model-value="!!c.visible" @change="(v) => emit('toggle', { prop: c.prop, visible: !!v })" />
        <span class="csd-label" :title="c.prop">{{ tt(c.label || c.prop) }}</span>
      </label>
      <span v-if="!filtered.length" class="csd-empty">{{ tt('无数据') }}</span>
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
  /** 列草稿:[{ prop, label, visible }](来自 useReportColumns.columnDraft) */
  columns: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'toggle', 'reset', 'save'])

/** 列名过滤(列多时找得快;空=全部) */
const kw = ref('')
const checkedCount = computed(() => props.columns.filter((c) => c.visible).length)
const filtered = computed(() => {
  const q = kw.value.trim()
  if (!q) return props.columns
  return props.columns.filter((c) => String(c.label || c.prop).includes(q) || String(c.prop).includes(q))
})

/** 全选/全不选:逐列发 toggle,草稿由父组件统一改(保持单向数据流) */
function setAll(visible) {
  for (const c of props.columns) if (!!c.visible !== visible) emit('toggle', { prop: c.prop, visible })
}
</script>

<style scoped>
.csd-bar { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.csd-count { margin-left: auto; color: #909399; font-size: 12px; }
.csd-search { margin-bottom: 6px; }
.csd-list { max-height: 340px; overflow: auto; display: flex; flex-wrap: wrap; gap: 2px 14px; }
.csd-item { display: inline-flex; align-items: center; min-width: 180px; cursor: pointer; }
.csd-label { font-size: 13px; color: #303133; }
.csd-empty { color: #909399; font-size: 13px; padding: 8px 0; }
</style>
