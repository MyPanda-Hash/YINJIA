<!-- WorkOrderDetailDrawer.vue — 工单详情抽屉(2026-10-05 第三版,用户口径修正)
     点开一张单**只看它走到哪一步**:表头(工单级,计划量 = Σ 计划量)+ **工序步骤条**(依据报工)。
     数据源 /px/processTask/detail(表头取 plang 汇总;步骤取 scjl 已审核报工)。纯只读,删组件即回滚。
     注:工序任务(路线驱动那套)已按用户口径撤下,本页不再依赖它。 -->
<template>
  <el-drawer v-model="visible" :title="tt('工单详情')" size="640px" append-to-body destroy-on-close>
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
        <el-descriptions-item :label="tt('产出')">{{ num(sum['产出']) }}（{{ num(head['进度']) }}%）</el-descriptions-item>
      </el-descriptions>

      <!-- 工序步骤条:混料→成型→切炭→组装→装箱,已完工的打勾,当前步高亮 -->
      <div class="wod-sec">{{ tt('工序进度') }}</div>
      <el-steps :active="active" align-center finish-status="success" class="wod-steps">
        <el-step v-for="s in steps" :key="s.工序" :title="tt(s.工序)"
                 :description="num(s['完工量']) + (s['报工单数'] ? `（${s['报工单数']}${tt('单')}）` : '')" />
      </el-steps>

      <el-table :data="steps" size="small" border empty-text="" class="wod-tb">
        <el-table-column :label="tt('序')" prop="序" width="50" align="right" />
        <el-table-column :label="tt('工序')" width="100">
          <template #default="{ row }">
            <span :class="{ 'wod-cur': row['当前'] }">{{ tt(row['工序']) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row['当前'] ? 'warning' : (num(row['完工量']) > 0 ? 'success' : 'info')">
              {{ row['当前'] ? tt('进行中') : tt(row['状态']) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('完工量')" prop="完工量" width="100" align="right" />
        <el-table-column :label="tt('报工单数')" prop="报工单数" width="90" align="right" />
      </el-table>
      <div class="wod-tip">{{ tt('工序进度按已审核报工统计(报工单审核后自动推进)') }}</div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({ modelValue: { type: Boolean, default: false }, code: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const loading = ref(false)
const head = ref({})
const steps = ref([])
const sum = ref({})
const curOp = computed(() => sum.value['当前工序'] || '')
/** el-steps 的 active:当前工序序号(1..5);未开工 = 0 */
const active = computed(() => Number(sum.value['当前工序序'] || 0))
const num = (v) => { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }

async function load() {
  if (!props.code) return
  loading.value = true
  try {
    const res = await request.post('/px/processTask/detail', { 工单号: props.code })
    const d = res.data || {}
    head.value = d['表头'] || {}
    steps.value = d['工序步骤'] || []
    sum.value = d
  } catch { head.value = {}; steps.value = [] } finally { loading.value = false }
}
watch(() => [props.modelValue, props.code], ([v]) => { if (v) load() })
</script>

<style scoped>
.wod { display: flex; flex-direction: column; gap: 12px; }
.wod-head { border-bottom: 1px solid #eee; padding-bottom: 8px; }
.wod-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.wod-sub { font-size: 13px; color: #606266; margin-top: 4px; }
.wod-sec { font-size: 13px; font-weight: 600; color: #116a5b; }
.wod-steps { margin: 6px 0 4px; }
.wod-cur { color: #e6a23c; font-weight: 700; }
.wod-tip { font-size: 12px; color: #909399; }
</style>
