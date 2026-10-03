<template>
  <!-- 打印材料码(2026-10-04 用户口径「在打印材料的时候弹出一个弹窗,可以填写打印的批次号(按之前的格式预填)
       与勾选需要打印的行号和他的数量」):
        批次号默认 = 供应商编码去掉 YJ- 前缀 + - + 当天 yyyyMMdd(服务端算,与生单同一公式),**可改**;
        勾行 + 填本次打印数量(上限 = 该行头寸 − 其它打印记录已预约的量);
        确定后**先落库登记**再出纸 —— 这张纸上的批次号从此成为该订单上批次号的权威值,
        生单对话框会按「已打印待生单」把它带进去消费。
       底部「已打印记录」是反查入口(用户不要新加面板,故放在这张弹窗里),可就地作废释放预约。 -->
  <el-dialog
    :model-value="modelValue"
    :title="tt('打印材料码') + (orderNo ? ' · ' + orderNo : '')"
    width="1000px"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="load"
  >
    <div v-loading="loading" class="mlq">
      <div class="mlq-bar">
        <span class="mlq-chip">{{ tt('供应商') }}: {{ head['供应商'] || head['供应商编码'] || '—' }}</span>
        <span class="mlq-chip mlq-batch">
          {{ tt('批次号') }}:
          <el-input v-model="batchNo" size="small" class="mlq-batch-inp" maxlength="100" clearable
            :placeholder="tt('生单时按供应商编码与当天日期生成')" />
          <el-button v-if="batchNo !== data.prefBatchNo" link type="primary" size="small"
            @click="batchNo = data.prefBatchNo">{{ tt('恢复默认') }}</el-button>
        </span>
        <span class="mlq-chip mlq-tip">{{ tt('打印上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回 − 已打印未生单') }}</span>
      </div>

      <el-table ref="tableRef" :data="rows" row-key="id" border size="small" height="330" @selection-change="onPicked">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="行号" :label="tt('行号')" width="70" />
        <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="130" show-overflow-tooltip />
        <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="130" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="110" show-overflow-tooltip />
        <el-table-column prop="数量" :label="tt('订单数量')" width="95" align="right" />
        <el-table-column prop="已送数量" :label="tt('已送')" width="80" align="right" />
        <el-table-column prop="已打印数量" :label="tt('已打印')" width="85" align="right" />
        <el-table-column prop="剩余可打" :label="tt('剩余可打')" width="90" align="right" />
        <el-table-column :label="tt('本次打印数量')" width="150">
          <template #default="{ row }">
            <el-input-number v-model="qtyOf[row.id]" :min="0" :max="capOf(row)" :controls="false"
              :disabled="!(capOf(row) > 0)" :precision="2" style="width: 130px" />
          </template>
        </el-table-column>
        <el-table-column prop="计量单位" :label="tt('计量单位')" width="85" />
      </el-table>

      <div class="mlq-foot">
        <span>{{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b></span>
      </div>

      <div class="mlq-records">
        <div class="mlq-rec-title">{{ tt('已打印记录（本订单）') }}</div>
        <el-table :data="data.records || []" border size="small" max-height="200">
          <el-table-column prop="批次号" :label="tt('批次号')" min-width="160" />
          <el-table-column prop="单据编号" :label="tt('打印单号')" min-width="150" />
          <el-table-column prop="打印量合计" :label="tt('打印量')" width="90" align="right" />
          <el-table-column prop="已生单合计" :label="tt('已生单')" width="90" align="right" />
          <el-table-column prop="未生单合计" :label="tt('未生单')" width="90" align="right" />
          <el-table-column prop="行数" :label="tt('行数')" width="70" align="right" />
          <el-table-column prop="打印时间" :label="tt('打印时间')" width="150" />
          <el-table-column prop="打印次数" :label="tt('打印次数')" width="85" align="right" />
          <el-table-column :label="tt('操作')" width="80" align="center">
            <template #default="{ row }">
              <el-button link type="danger" :disabled="busy" @click="doVoid(row)">{{ tt('作废') }}</el-button>
            </template>
          </el-table-column>
          <template #empty>{{ tt('该订单还没有打印过材料码') }}</template>
        </el-table>
      </div>
    </div>
    <template #footer>
      <el-button @click="fillRemaining">{{ tt('按剩余量填充') }}</el-button>
      <el-button @click="clearAll">{{ tt('清空') }}</el-button>
      <el-button type="primary" :loading="busy" @click="confirm">{{ tt('确定并打印') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * MaterialLabelDialog — 采购订单「打印材料码」弹窗(2026-10-04)
 *
 * 为什么有这个弹窗:供应商自己打码时,标签上必须印批次号,而批次号原本要到**生单那一刻**才有。
 * 本弹窗把批次号前移:打印时按公式预填、可人工改,确认后**先落库**(bd_pu_label/bl_pu_label)再出纸。
 * 打印记录即该订单上批次号的权威登记处,并**预约**该行数量(未生单的预约量从余量里扣减);
 * 生单对话框按「已打印待生单」消费它,不再按公式重算。
 * 方案:docs/plans/2026-10-04-采购订单材料码批次号方案.md
 *
 * 出纸复用 printProductCards(75×100mm 产品标识卡),这次把「批次」传真值 ——
 * 纸面不再留横线,二维码也随之带上批号段(公司代码@物料编码@批次号,与采购入库单标识卡同口径)。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { printProductCards } from '@/business/print-formats'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 采购订单号(当前单据) */
  orderNo: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'printed'])

const loading = ref(false)
const busy = ref(false)
const data = ref({})
const head = computed(() => data.value || {})
const rows = computed(() => data.value.lines || [])
const batchNo = ref('')
const tableRef = ref(null)
const picked = ref([])
const qtyOf = reactive({})

const pickedKeys = computed(() => new Set(picked.value.map((r) => r.id)))
const totalQty = computed(() => {
  let s = 0
  for (const r of rows.value) if (pickedKeys.value.has(r.id)) s += Number(qtyOf[r.id] || 0) || 0
  return Math.round(s * 100) / 100
})
/** 该行本次最多能打多少(服务端算好的「剩余可打」;前端只做即时约束,后端还会重算一遍) */
function capOf(row) {
  return Math.max(0, Number(row?.剩余可打 || 0))
}
const isEmpty = (v) => v === undefined || v === null || String(v).trim() === ''

async function load() {
  if (!props.orderNo) return
  loading.value = true
  try {
    data.value = await engine.puLabelDialog(props.orderNo)
    batchNo.value = String(data.value?.prefBatchNo || '')
    Object.keys(qtyOf).forEach((k) => delete qtyOf[k])
    for (const r of rows.value) qtyOf[r.id] = capOf(r) > 0 ? capOf(r) : 0
    // 默认全选有可打量的行(与分批送料对话框同款便利),勾选仍是权威
    await Promise.resolve()
    syncPick(rows.value.filter((r) => capOf(r) > 0).map((r) => r.id))
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('材料码数据加载失败'))
  } finally {
    loading.value = false
  }
}

function syncPick(ids) {
  const set = new Set(ids)
  tableRef.value?.clearSelection()
  picked.value = []
  for (const r of rows.value) if (set.has(r.id)) tableRef.value?.toggleRowSelection(r, true)
  picked.value = rows.value.filter((r) => set.has(r.id))
  prefill()
}
function onPicked(list) {
  picked.value = list || []
  prefill()
}
function prefill() {
  for (const r of picked.value) if (!(Number(qtyOf[r.id] || 0) > 0)) qtyOf[r.id] = capOf(r)
}
function fillRemaining() {
  for (const r of rows.value) qtyOf[r.id] = capOf(r)
  syncPick(rows.value.filter((r) => capOf(r) > 0).map((r) => r.id))
}
function clearAll() {
  for (const r of rows.value) qtyOf[r.id] = 0
  syncPick([])
}

async function confirm() {
  const lines = rows.value
    .filter((r) => pickedKeys.value.has(r.id) && Number(qtyOf[r.id] || 0) > 0)
    .map((r) => ({ 采购订单行id: r.id, 打印数量: Number(qtyOf[r.id]) }))
  if (!lines.length) { ElMessage.warning(tt('请至少勾选一行并填写本次打印数量')); return }
  if (isEmpty(batchNo.value)) { ElMessage.warning(tt('请填写批次号')); return }
  busy.value = true
  try {
    const res = await engine.puLabelPrint({
      orderNo: props.orderNo, batchNo: String(batchNo.value).trim(), lines,
    })
    // 先落库再出纸:纸上的号 = 库里的号
    const cards = (res?.lines || []).map((l) => ({
      编码: l['物料编码'],
      规格: l['规格型号'] || '',
      数量: l['打印数量'],
      批次: res['批次号'],
      订单编号: props.orderNo,
      供应商名称: head.value['供应商'] || '',
      生产日期: '',
    }))
    await printProductCards(cards)
    ElMessage.success(`${tt('已登记并打印')} ${res['单据编号']}（${tt('批次号')} ${res['批次号']}）`)
    emit('printed', { orderNo: props.orderNo, docNo: res['单据编号'], batchNo: res['批次号'], count: cards.length })
    await load()          // 刷新"剩余可打"与"已打印记录"
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印登记失败'))
  } finally {
    busy.value = false
  }
}

async function doVoid(row) {
  try {
    await ElMessageBox.confirm(
      `${tt('作废后该批次的预约量立即释放回余量（已打印的纸仍在供应商手里，请自行作废）。')}\n${tt('打印单号')} ${row['单据编号']} / ${tt('批次号')} ${row['批次号']}`,
      tt('作废打印记录'), { type: 'warning' })
  } catch { return }
  busy.value = true
  try {
    await engine.puLabelVoid(row['单据编号'])
    ElMessage.success(tt('已作废，预约量已释放'))
    await load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('作废失败'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.mlq { display: flex; flex-direction: column; gap: 8px; }
.mlq-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 12.5px; color: #46586e; }
.mlq-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.mlq-batch { display: inline-flex; align-items: center; gap: 4px; }
.mlq-batch-inp { width: 190px; }
.mlq-tip { color: #8b9893; }
.mlq-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #46586e; }
.mlq-records { margin-top: 4px; }
.mlq-rec-title { font-size: 12.5px; color: #46586e; margin-bottom: 4px; }
</style>
