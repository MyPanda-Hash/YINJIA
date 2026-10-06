<!-- WorkOrderDetailDrawer.vue — 工单详情抽屉(2026-10-05,用户口径「点开一张单就看到它处在哪个阶段」)
     纯只读:表头 + 工序时间轴(混料→成型→切炭→组装→装箱的进度与派工产线)+ 汇总。
     数据源 /px/processTask/detail(表头来自 plang+v_wo_process_progress,工序行来自 wo_progress)。
     可撤回说明:本组件不写任何数据,删除组件 + 移除引用即完全回滚。 -->
<template>
  <el-drawer v-model="visible" :title="tt('工单详情')" size="720px" append-to-body destroy-on-close>
    <div v-loading="loading" class="wod">
      <div class="wod-head">
        <div class="wod-title">
          {{ head['工单号'] || code }}
          <el-tag v-if="curOp" size="small" type="warning" effect="dark">{{ tt('当前工序') }}：{{ tt(curOp) }}</el-tag>
          <el-tag v-else size="small" type="info">{{ tt('未开工') }}</el-tag>
        </div>
        <div class="wod-sub">
          {{ head['产品编码'] }} {{ head['产品名称'] }} {{ head['规格型号'] }}
          <span v-if="head['客户']">｜{{ tt('客户') }}：{{ head['客户'] }}</span>
        </div>
      </div>

      <el-descriptions :column="3" size="small" border class="wod-desc">
        <el-descriptions-item :label="tt('计划数量')">{{ num(head['计划数量']) }}</el-descriptions-item>
        <el-descriptions-item :label="tt('交期')">{{ head['交期'] || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="tt('排产产线')">{{ head['排产产线'] || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="tt('批次号')">{{ head['批次号'] || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="tt('工单行数')">{{ head['工单行数'] || 1 }}</el-descriptions-item>
        <el-descriptions-item :label="tt('完工合计')">{{ num(sum['完工合计']) }} / {{ num(sum['计划合计']) }}</el-descriptions-item>
      </el-descriptions>

      <div class="wod-sec">{{ tt('工序进度') }}（{{ tt('按工序序列') }}）</div>
      <el-table :data="tasks" size="small" border empty-text="">
        <el-table-column :label="tt('序')" prop="工序序" width="50" align="right" />
        <el-table-column :label="tt('工序')" width="90">
          <template #default="{ row }">
            <span :class="{ 'wod-cur': row['工序'] === curOp }">{{ tt(row['工序']) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row['状态'] === '已完工' ? 'success' : (row['状态'] === '在加工' ? 'warning' : 'info')">
              {{ tt(row['状态']) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('计划数量')" prop="计划数量" width="95" align="right" />
        <el-table-column :label="tt('完成数量')" prop="完成数量" width="95" align="right" />
        <el-table-column :label="tt('未完成')" prop="未完成量" width="90" align="right" />
        <el-table-column :label="tt('生产线')" width="110">
          <template #default="{ row }">{{ row['生产线'] || '-' }}</template>
        </el-table-column>
        <el-table-column :label="tt('优先级')" width="80">
          <template #default="{ row }">
            <span :class="{ 'wod-urgent': row['优先级'] === '急单' }">{{ tt(row['优先级']) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('计划完工日期')" prop="计划完工日期" width="115" />
      </el-table>
      <div v-if="!tasks.length" class="wod-tip">{{ tt('该工单还没有工序任务(转工单时按工艺路线自动生成,可在工序任务页补生成)') }}</div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({ modelValue: { type: Boolean, default: false }, code: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const loading = ref(false)
const head = ref({})
const tasks = ref([])
const sum = ref({})
const curOp = computed(() => sum.value['当前工序'] || head.value['当前工序'] || '')
const num = (v) => { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }

async function load() {
  if (!props.code) return
  loading.value = true
  try {
    const res = await request.post('/px/processTask/detail', { 工单号: props.code })
    const d = res.data || {}
    head.value = d['表头'] || {}
    tasks.value = d['工序任务'] || []
    sum.value = d
  } catch { head.value = {}; tasks.value = [] } finally { loading.value = false }
}
watch(() => [props.modelValue, props.code], ([v]) => { if (v) load() })
</script>

<style scoped>
.wod { display: flex; flex-direction: column; gap: 10px; }
.wod-head { border-bottom: 1px solid #eee; padding-bottom: 8px; }
.wod-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.wod-sub { font-size: 13px; color: #606266; margin-top: 4px; }
.wod-sec { font-size: 13px; font-weight: 600; color: #116a5b; margin-top: 4px; }
.wod-cur { color: #e6a23c; font-weight: 700; }
.wod-urgent { color: #f56c6c; font-weight: 700; }
.wod-tip { font-size: 12px; color: #909399; }
</style>
