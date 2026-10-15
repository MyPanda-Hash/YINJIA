<template>
  <el-dialog :model-value="modelValue" :title="tt('完工明细')" width="94%" top="5vh" append-to-body
             destroy-on-close @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading" class="completion-detail">
      <div class="completion-head">
        <b>{{ code }}</b>
        <span>{{ tt('工单行号') }}: {{ data.头?.工单行号 ?? '-' }}</span>
        <span>{{ tt('批次号') }}: {{ data.头?.批次号 || '-' }}</span>
        <span>{{ data.头?.产品名称 }} {{ data.头?.规格型号 }}</span>
        <el-button size="small" :disabled="loading" @click="load">{{ tt('刷新') }}</el-button>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <p class="completion-tip">{{ tt('仅显示本工单行已审核的完工记录；各工序数量分别统计，不跨工序累计。') }}</p>
      <h4>{{ tt('按工序汇总') }}</h4>
      <el-table :data="data.工序汇总 || []" border size="small" max-height="180" :empty-text="tt('暂无完工记录')">
        <el-table-column :label="tt('工序')" prop="工序" min-width="150">
          <template #default="{ row }">{{ tt(row.工序) }}</template>
        </el-table-column>
        <el-table-column :label="tt('完成数量')" prop="完成数量" align="right" min-width="120" />
        <el-table-column :label="tt('记录数')" prop="记录数" align="right" min-width="100" />
      </el-table>
      <h4>{{ tt('完工记录') }}</h4>
      <el-table :data="data.明细 || []" row-key="id" border size="small" max-height="420" :empty-text="tt('暂无完工记录')">
        <el-table-column v-for="col in columns" :key="col.key" :prop="col.key" :label="tt(col.key)"
                         :width="col.width" :min-width="col.width || 130" :align="col.numeric ? 'right' : 'left'"
                         show-overflow-tooltip>
          <template #default="{ row }">{{ col.translate ? tt(row[col.key] || '-') : (row[col.key] ?? '-') }}</template>
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({ modelValue: Boolean, code: { type: String, default: '' }, rowId: [Number, String] })
const emit = defineEmits(['update:modelValue'])
const data = ref({})
const loading = ref(false)
const error = ref('')
let sequence = 0
const columns = [
  { key: '报工单号', width: 165 }, { key: '工单行号', width: 95 },
  { key: '工序', width: 100, translate: true }, { key: '完成数量', width: 110, numeric: true },
  { key: '单位', width: 75, translate: true }, { key: '生产线', width: 140 },
  { key: '批次号', width: 120 }, { key: '产品编码', width: 140 }, { key: '产品名称', width: 170 },
  { key: '规格型号', width: 150 }, { key: '报工人', width: 110 }, { key: '报工时间', width: 165 },
  { key: '完工时间', width: 165 }, { key: '产成品流水号', width: 210 }, { key: '入库单号', width: 165 },
  { key: '收敛口径', width: 130, translate: true },
]
async function load() {
  const current = ++sequence
  data.value = {}
  error.value = ''
  if (!props.modelValue || !props.code || !props.rowId) { loading.value = false; return }
  loading.value = true
  try {
    const result = await request.post('/px/workOrderList/completionDetails', { 工单号: props.code, 行id: props.rowId })
    if (current === sequence) data.value = result.data || {}
  } catch (e) {
    if (current === sequence) error.value = e?.response?.data?.message || tt('完工明细查询失败')
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(() => [props.modelValue, props.code, props.rowId], load, { immediate: true })
</script>

<style scoped>
.completion-detail { min-height: 180px; }
.completion-head { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.completion-head .el-button { margin-left: auto; }
.completion-tip { color: var(--el-text-color-secondary); font-size: 13px; }
h4 { margin: 16px 0 8px; }
</style>
