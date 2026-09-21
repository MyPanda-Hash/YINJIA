<template>
  <!-- 分批送料对话框(2026-09-20 P0):采购订单 →「生成送料暂收单」不再整单一次性生成,
       而是逐行填「本次送料数量」(默认=剩余量),可多次分批;
       超送受系统比例约束。
       批次号(2026-09-21 口径变更):**采购入库单审核时才取号**(yyyyMMdd+两位序号),
       本对话框不再预告批次号 —— 此时只登记一行"待编号"批次台账。 -->
  <el-dialog
    :model-value="modelValue"
    :title="tt('分批送料') + ' · ' + sourceNo"
    width="900px"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="load"
  >
    <div v-loading="loading" class="bsd">
      <div class="bsd-bar">
        <span class="bsd-chip">{{ tt('采购订单') }}: {{ sourceNo }}</span>
        <span class="bsd-chip">{{ tt('批次号') }}: <b>{{ tt('待采购入库单审核时生成') }}</b></span>
        <span class="bsd-chip bsd-ratio">
          {{ tt('超送比例') }}:
          <el-input-number v-model="overRatioPct" :min="0" :max="100" :step="1" :precision="0" size="small"
            :controls="false" style="width: 62px" @change="recompute" />
          %<span class="bsd-ratio-tip">{{ tt('（0 = 不允许超送；本次生效）') }}</span>
        </span>
        <span v-if="(batches || []).length" class="bsd-chip">{{
          tt('已有批次') }}: {{ batches.map((b) => b.batchNo || tt('待编号')).join('、') }}</span>
      </div>
      <el-table :data="rows" border size="small" height="380" @selection-change="(r) => (picked = r)">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="行号" :label="tt('行号')" width="60" />
        <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="130" show-overflow-tooltip />
        <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="130" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="110" show-overflow-tooltip />
        <el-table-column prop="数量" :label="tt('订单数量')" width="100" align="right" />
        <el-table-column prop="已送数量" :label="tt('已送')" width="90" align="right" />
        <el-table-column prop="已退回数量" :label="tt('已退回')" width="90" align="right" />
        <el-table-column prop="剩余数量" :label="tt('剩余')" width="90" align="right" />
        <el-table-column :label="tt('可送上限')" width="100" align="right">
          <template #default="{ row }">{{ capOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('本次送料数量')" width="150">
          <template #default="{ row }">
            <el-input-number v-model="qtyOf[row.lineKey]" :min="0" :max="capOf(row)" :controls="false"
              :disabled="!row.剩余数量" :precision="2" style="width: 130px" />
          </template>
        </el-table-column>
        <el-table-column prop="计量单位" :label="tt('计量单位')" width="90" />
      </el-table>
      <div class="bsd-foot">
        <span>{{ tt('本次合计') }}: <b>{{ totalQty }}</b></span>
        <span class="bsd-tip">{{ tt('每行留空或 0 = 本次不送;不超过「可送上限」(剩余 ×（1+超送比例）)') }}</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="fillRemaining">{{ tt('按剩余量填充') }}</el-button>
      <el-button @click="clearAll">{{ tt('清空') }}</el-button>
      <el-button type="primary" :loading="saving" @click="confirm">{{ tt('确定生单') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  sourcePanel: { type: String, default: '' },
  targetPanel: { type: String, default: '' },
  sourceNo: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'generated'])

const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const picked = ref([])
const overRatio = ref(0)       // 系统默认比例(0~1)
const overRatioPct = ref(5)    // 本次生效比例(%):可调,生单时随请求带给后端
const batches = ref([])
const qtyOf = reactive({})

const totalQty = computed(() => rows.value.reduce((s, r) => s + Number(qtyOf[r.lineKey] || 0), 0))
/** 本次生效超送比例(0~1) */
const ratio = computed(() => Math.max(0, Math.min(100, Number(overRatioPct.value) || 0)) / 100)
/** 行的可送上限 = 剩余 ×(1+本次比例);比例一改即时重算(后端同口径再校验一次) */
function capOf(row) {
  return Math.round(Number(row.剩余数量 || 0) * (1 + ratio.value) * 100) / 100
}
function recompute() {
  // 比例调小后可能低于已填数量 → 收敛到新上限,避免提交时被后端拒
  for (const r of rows.value) {
    const cap = capOf(r)
    if (Number(qtyOf[r.lineKey] || 0) > cap) qtyOf[r.lineKey] = cap
  }
}

async function load() {
  if (!props.sourceNo) return
  loading.value = true
  try {
    const res = await engine.batchFlowLines({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo,
    })
    rows.value = res?.lines || []
    overRatio.value = Number(res?.overRatio || 0)
    overRatioPct.value = Math.round(overRatio.value * 100)
    batches.value = res?.batches || []
    Object.keys(qtyOf).forEach((k) => delete qtyOf[k])
    for (const r of rows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('分批送料数据加载失败'))
  } finally {
    loading.value = false
  }
}

function fillRemaining() {
  for (const r of rows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
}
function clearAll() {
  for (const r of rows.value) qtyOf[r.lineKey] = 0
}

async function confirm() {
  const lines = rows.value
    .filter((r) => Number(qtyOf[r.lineKey] || 0) > 0)
    .map((r) => ({ lineKey: r.lineKey, qty: Number(qtyOf[r.lineKey]) }))
  if (!lines.length) { ElMessage.warning(tt('请至少填写一行的本次送料数量')); return }
  saving.value = true
  try {
    const res = await engine.batchFlowGenerate({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo, lines,
      overRatio: ratio.value,
    })
    ElMessage.success(`${tt('已生成')} ${res['编号']}（${tt('批次号')} ${tt('待采购入库单审核时生成')}）`)
    emit('generated', { panel: res.gotoPanel || props.targetPanel, no: res['编号'], batchNo: res['批次号'] })
    emit('update:modelValue', false)
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('生单失败'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bsd { display: flex; flex-direction: column; gap: 8px; }
.bsd-bar { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; color: #46586e; }
.bsd-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.bsd-ratio { display: inline-flex; align-items: center; gap: 4px; }
.bsd-ratio-tip { color: #8b9893; }
.bsd-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #46586e; }
.bsd-tip { color: #8b9893; }
</style>
