<template>
  <!-- 分批送料对话框(2026-09-20 P0):采购订单 →「生成送料暂收单」不再整单一次性生成,
       而是**勾选要送的行** + 逐行填「本次送料数量」(勾选时默认=剩余量),可多次分批;
       超送受系统比例约束。
       勾选口径(2026-09-21 修复):**勾选是权威** —— 只生成"已勾选 且 本次送料数量 > 0"的行
       (此前只按数量过滤、勾选形同虚设 → 只勾一行也会全部生单)。
       批次号(2026-09-21 二次口径):暂收单**不带**批次号,只登记一行"待编号"批次台账;
       批次号 = **采购入库单「单据日期」**(纯 yyyyMMdd,同一日期同一批次),入库单填单时预设、可人工改,
       审核时以表头值为准回填全链 —— 详见 tools/migrate-batch-no-date-only.sql。 -->
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
        <span class="bsd-chip">{{ tt('批次号') }}: <b>{{ tt('采购入库单填单时按入库日期预设,可修改') }}</b></span>
        <span class="bsd-chip bsd-ratio">
          {{ tt('超送比例') }}:
          <el-input-number v-model="overRatioPct" :min="0" :max="100" :step="1" :precision="0" size="small"
            :controls="false" style="width: 62px" @change="recompute" />
          %<span class="bsd-ratio-tip">{{ tt('（0 = 不允许超送；本次生效）') }}</span>
        </span>
        <span v-if="(batches || []).length" class="bsd-chip">{{
          tt('已有批次') }}: {{ batches.map((b) => b.batchNo || tt('待编号')).join('、') }}</span>
      </div>
      <el-table ref="tableRef" :data="rows" row-key="lineKey" border size="small" height="380" @selection-change="onPicked">
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
        <span>{{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b></span>
        <span class="bsd-tip">{{ tt('只生成已勾选的行(数量为 0 的行不送),且不超过「可送上限」') }}</span>
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
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
// 生单行构造:勾选是权威(未勾选的行不生成)—— 纯函数,见 core/selection/batchSendLines.js
import { buildBatchSendLines, defaultPickKeys, sumPickedQty } from '@core/selection/batchSendLines'

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
const tableRef = ref(null)
const picked = ref([])         // el-table 当前勾选的行(生单只认它 —— 2026-09-21 修复"只勾一行却全送")
const overRatio = ref(0)       // 系统默认比例(0~1)
const overRatioPct = ref(5)    // 本次生效比例(%):可调,生单时随请求带给后端
const batches = ref([])
const qtyOf = reactive({})

const pickedKeys = computed(() => new Set(picked.value.map((r) => r.lineKey)))
/** 本次合计:只算**已勾选**的行(未勾选行即使填了量也不送,合计必须与生单结果一致) */
const totalQty = computed(() => sumPickedQty(rows.value, pickedKeys.value, qtyOf))
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
    // 默认勾选"还有剩余"的行(保留"打开即可全送"的便利);勾选仍是权威:取消勾选即不送
    await nextTick()
    syncPick(defaultPickKeys(rows.value))
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('分批送料数据加载失败'))
  } finally {
    loading.value = false
  }
}

/** 勾选集合 → 表格勾选态(并同步 picked,避免依赖 selection-change 的时序) */
function syncPick(keys) {
  const set = new Set(keys)
  tableRef.value?.clearSelection()
  picked.value = []
  for (const r of rows.value) {
    if (!set.has(r.lineKey)) continue
    tableRef.value?.toggleRowSelection(r, true)
  }
  picked.value = rows.value.filter((r) => set.has(r.lineKey))
  prefillNewlyPicked()
}

/** 勾选变化:新勾上而"本次送料数量"还是 0 的行按剩余量预填;取消勾选**不吞**已填数量(重勾还能用) */
function onPicked(list) {
  picked.value = list || []
  prefillNewlyPicked()
}
function prefillNewlyPicked() {
  for (const r of picked.value) {
    if (Number(qtyOf[r.lineKey] || 0) > 0) continue
    qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
  }
}

/** 全送:勾选所有有剩余的行 + 数量按剩余量填满 */
function fillRemaining() {
  for (const r of rows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
  syncPick(defaultPickKeys(rows.value))
}
/** 全不送:取消全部勾选 + 数量清零 */
function clearAll() {
  for (const r of rows.value) qtyOf[r.lineKey] = 0
  syncPick([])
}

async function confirm() {
  // 只有"已勾选 且 数量 > 0"的行才生单(2026-09-21 修复:此前只按数量过滤、勾选形同虚设)
  const lines = buildBatchSendLines(rows.value, pickedKeys.value, qtyOf)
  if (!lines.length) { ElMessage.warning(tt('请至少勾选一行并填写本次送料数量')); return }
  saving.value = true
  try {
    const res = await engine.batchFlowGenerate({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo, lines,
      overRatio: ratio.value,
    })
    ElMessage.success(`${tt('已生成')} ${res['编号']}（${tt('批次号')} ${tt('采购入库单填单时按入库日期预设,可修改')}）`)
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
