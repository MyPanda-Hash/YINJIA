<template>
  <!-- 分批送料对话框(2026-09-20 P0):采购订单 →「生成送料暂收单」不再整单一次性生成,
       而是逐行填「本次送料数量」(默认=剩余量),可多次分批;
       批次号由后端自动取号(采购订单号-3位序号),超送受系统比例约束。 -->
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
        <span class="bsd-chip">{{ tt('批次号') }}: <b>{{ nextBatchNo || '-' }}</b></span>
        <span class="bsd-chip">{{ tt('超送比例') }}: {{ Math.round((overRatio || 0) * 100) }}%</span>
        <span v-if="(batches || []).length" class="bsd-chip">{{
          tt('已有批次') }}: {{ batches.map((b) => b.batchNo).join('、') }}</span>
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
        <el-table-column prop="可送上限" :label="tt('可送上限')" width="100" align="right" />
        <el-table-column :label="tt('本次送料数量')" width="150">
          <template #default="{ row }">
            <el-input-number v-model="qtyOf[row.lineKey]" :min="0" :max="row.可送上限" :controls="false"
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
const nextBatchNo = ref('')
const overRatio = ref(0)
const batches = ref([])
const qtyOf = reactive({})

const totalQty = computed(() => rows.value.reduce((s, r) => s + Number(qtyOf[r.lineKey] || 0), 0))

async function load() {
  if (!props.sourceNo) return
  loading.value = true
  try {
    const res = await engine.batchFlowLines({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo,
    })
    rows.value = res?.lines || []
    nextBatchNo.value = res?.nextBatchNo || ''
    overRatio.value = res?.overRatio || 0
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
    })
    ElMessage.success(`${tt('已生成')} ${res['编号']}（${tt('批次号')} ${res['批次号']}）`)
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
.bsd-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #46586e; }
.bsd-tip { color: #8b9893; }
</style>
