<!-- DayPlanSplitDialog.vue — 按完工日期均摊(2026-10-29)
     生产工单 / 工单排产 两页共用:把该工单行「剩余数量」均摊到 起点~完工日 的每一天,
     确认后由父组件写进表格的日期列,再点「保存日排产」落库。纯前端计算(逻辑在 business/dayPlan.js)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('按完工日期均摊')" width="440px" append-to-body
             @update:model-value="(v) => emit('update:modelValue', v)" @open="reset">
    <div class="dps-row"><span>{{ tt('工单') }}</span><b>{{ 工单号 }}<template v-if="工单行号 != null"> #{{ 工单行号 }}</template></b></div>
    <div class="dps-row"><span>{{ tt('当前工序') }}</span><span>{{ 工序 || '-' }}</span></div>
    <div class="dps-row"><span>{{ tt('剩余') }}</span><span>{{ qtyText(剩余) }}</span></div>
    <div class="dps-row"><span>{{ tt('起点日期') }}</span>
      <el-date-picker v-model="start" type="date" value-format="YYYY-MM-DD" size="small" style="width: 150px" />
    </div>
    <div class="dps-row"><span>{{ tt('完工日期') }}</span>
      <el-date-picker v-model="due" type="date" value-format="YYYY-MM-DD" size="small" style="width: 150px" />
    </div>
    <div class="dps-row"><span>{{ tt('数量') }}</span>
      <el-input-number v-model="qty" :min="0" :controls="false" size="small" style="width: 150px" />
    </div>
    <div v-if="preview.days" class="dps-tip">
      {{ tt('将均摊到') }} {{ preview.days }} {{ tt('天') }}：{{ preview.text }}
    </div>
    <div v-else class="dps-tip dps-warn">{{ tt('起点/完工日期不正确或数量为 0') }}</div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!preview.days" @click="apply">{{ tt('填充') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { buildSplit, qtyText } from '@/business/dayPlan'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  工单号: { type: String, default: '' },
  工单行号: { type: [Number, String], default: null },
  工序: { type: String, default: '' },
  剩余: { type: Number, default: 0 },
  完工日期: { type: String, default: '' },
  起点日期: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'apply'])

const start = ref('')
const due = ref('')
const qty = ref(0)

function reset() {
  start.value = props.起点日期 || today()
  due.value = props.完工日期 || addDays(today(), 6)
  qty.value = Number(props.剩余 || 0)
}

const split = computed(() => buildSplit(qty.value, start.value, due.value))
const preview = computed(() => {
  const days = Object.keys(split.value)
  if (!days.length) return { days: 0, text: '' }
  const vals = days.map((d) => split.value[d])
  const first = vals[0]
  const last = vals[vals.length - 1]
  return {
    days: days.length,
    text: first === last ? `${tt('每天')} ${qtyText(first)}` : `${tt('每天')} ${qtyText(first)}，${tt('最后一天')} ${qtyText(last)}`,
  }
})

function apply() {
  const map = { ...split.value }
  if (!Object.keys(map).length) { ElMessage.warning(tt('起点/完工日期不正确或数量为 0')); return }
  emit('apply', { map, start: start.value, due: due.value, qty: qty.value })
  emit('update:modelValue', false)
}

function today() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function addDays(text, n) {
  const [y, m, d] = String(text).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.dps-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 13px; color: #606266; }
.dps-row > span:first-child { width: 80px; color: #909399; }
.dps-tip { margin-top: 10px; padding: 8px 10px; background: #f0f9eb; border-radius: 4px; font-size: 12px; color: #529b2e; }
.dps-warn { background: #fef0f0; color: #f56c6c; }
</style>
