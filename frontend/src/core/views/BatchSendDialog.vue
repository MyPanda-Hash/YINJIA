<template>
  <!-- 分批送料对话框(2026-09-20 P0):采购订单 →「生成送料暂收单」不再整单一次性生成,
       而是**勾选要送的行** + 逐行填「本次送料数量」(勾选时默认=剩余量),可多次分批;
       超送受系统比例约束。
       勾选口径(2026-09-21 修复):**勾选是权威** —— 只生成"已勾选 且 本次送料数量 > 0"的行
       (此前只按数量过滤、勾选形同虚设 → 只勾一行也会全部生单)。
       批次号(2026-10-04 口径):**生单这一刻就定号** —— 供应商编码去掉 YJ- 前缀 + `-` + 当天 yyyyMMdd
       (如 YJ-TX ⇒ TX-20260910),随后沿 暂收 → 检验 → 入库 逐站继承,不再有"入库审核取号回填";
       服务端 batchFlowLines 已按同一公式预告本批号(nextBatchNo),这里**预填并允许当场修改**
       (用户口径「在生单时批次号就可以修改」),确定后按输入框里的号落库。 -->
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
        <!-- 批次号(2026-10-04 用户口径「在生单时批次号就可以修改」):按「供应商编码去掉 YJ- 前缀 + - + 当天」
             预填(服务端 batchFlowLines 的 nextBatchNo,与生单同源),**这里就能改**,确定后按此号落库;
             清空则后端按公式重新取号;「恢复默认」把人工值退回预填值。 -->
        <span class="bsd-chip bsd-batch">
          {{ tt('批次号') }}:
          <el-input
            v-model="batchNo"
            size="small"
            class="bsd-batch-inp"
            :disabled="batchLocked"
            :placeholder="tt('生单时按供应商编码与当天日期生成')"
            maxlength="100"
            clearable
          />
          <el-button
            v-if="!batchLocked && batchNo !== nextBatchNo"
            link type="primary" size="small" class="bsd-batch-reset"
            @click="batchNo = nextBatchNo"
          >{{ tt('恢复默认') }}</el-button>
          <span v-if="batchLocked" class="bsd-batch-lock">{{ tt('已按材料码批次号锁定') }}</span>
        </span>
        <span class="bsd-chip bsd-ratio">
          {{ tt('超送比例') }}:
          <el-input-number v-model="overRatioPct" :min="0" :max="50" :step="1" :precision="0" size="small"
            :controls="false" style="width: 62px" @change="recompute" />
          %<span class="bsd-ratio-tip">{{ tt('（0 = 不允许；最高 50%，额度按订单数量算）') }}</span>
        </span>
        <span v-if="(batches || []).length" class="bsd-chip">{{
          tt('已有批次') }}: {{ batches.map((b) => b.batchNo || tt('待编号')).join('、') }}</span>
      </div>
      <el-table ref="tableRef" :data="rows" row-key="lineKey" border size="small" height="380" @selection-change="onPicked">
        <el-table-column type="selection" width="42" :selectable="rowSelectable" />
        <el-table-column prop="行号" :label="tt('行号')" width="55" />
        <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="100" show-overflow-tooltip />
        <!-- 批次号:已打印的隔离行有自己的号(材料码上的号);原行由顶部输入框决定,留空 -->
        <el-table-column :label="tt('批次号')" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.rowKind === 'printed'" class="bsd-rowbatch">{{ row['批次号'] }}</span>
            <span v-else class="bsd-dim">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.rowKind === 'printed'" :type="row.已生单 ? 'info' : 'warning'" size="small">
              {{ tt(row.已生单 ? '已生单' : '已打印') }}
            </el-tag>
            <span v-else class="bsd-dim">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="数量" :label="tt('数量')" width="90" align="right">
          <template #default="{ row }">
            <span :title="row.rowKind === 'order'
              ? `${tt('订单数量')} ${row['订单数量']} − ${tt('已打印')} ${row['已打印数量']}`
              : `${tt('已打印')}`">{{ row['数量'] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="已送数量" :label="tt('已送')" width="80" align="right" />
        <el-table-column prop="已退回数量" :label="tt('已退回')" width="80" align="right" />
        <el-table-column prop="剩余数量" :label="tt('剩余')" width="80" align="right" />
        <el-table-column :label="tt('可送上限')" width="95" align="right">
          <template #default="{ row }">{{ capOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('本次送料数量')" width="150">
          <template #default="{ row }">
            <el-input-number v-model="qtyOf[row.lineKey]" :min="0" :max="capOf(row)" :controls="false"
              :disabled="!(capOf(row) > 0)" :precision="2" style="width: 130px" />
          </template>
        </el-table-column>
        <el-table-column prop="计量单位" :label="tt('计量单位')" width="85" />
      </el-table>
      <div class="bsd-foot">
        <span>{{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b></span>
        <span class="bsd-tip">{{ tt('只生成已勾选的行；可送上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回（超送最高 50%）') }}</span>
      </div>
      <!-- 已打印待生单(2026-10-04 用户口径「打印后的那一行是已经从原来数量隔离出来的」):
           已打印的量已从原行**切走**,在本表里作为**独立一行**出现(行号/物料相同,批次号=材料码上的号,
           数量=打印数量,已送=已生单量,剩余=未生单量);用它生单后该行标「已生单」且不可再勾。
           勾到多个批次号时前端按号分组、逐组各出一张单(一张暂收单只有一个单头号)。 -->
      <div class="bsd-foot">
        <span>{{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b></span>
        <span class="bsd-tip">{{ tt('只生成已勾选的行；可送上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回（超送最高 50%）') }}</span>
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
// 生单行构造:勾选是权威(未勾选的行不生成)—— 纯函数,见 core/selection/batchSendLines.js
// 可送上限同源纯函数 overAllowance(2026-09-22 口径:按订单全部数量算,超送最高 50%)
import { buildBatchSendLines, defaultPickKeys, sumPickedQty, overAllowance } from '@core/selection/batchSendLines'

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
/** 本批批次号:服务端按「供应商编码去 YJ- 前缀 + 当天」预填(与生单同源),**可人工改** */
const nextBatchNo = ref('')
const batchNo = ref('')
const qtyOf = reactive({})

/* ── 已打印隔离行(2026-10-04 材料码):行来自服务端,与原行并列在同一张明细表里 ──
   用户口径「打印后的那一行是已经从原来数量隔离出来的,没有作废之前不会与生单有关联」:
   原行的「数量」已扣掉打印量,已打印的量是**自己那一行**,只能显式勾它才能生单;
   用它生单后该行标「已生单」(剩余=0)且不可再勾。 */
/** 勾选的隔离行涉及的批次号(1 个 ⇒ 顶部批次号锁死为该号;>1 个 ⇒ 按号分组各出一张单) */
const printedBatches = computed(() => [...new Set(
  picked.value.filter((r) => r.rowKind === 'printed' && r['批次号']).map((r) => r['批次号']),
)])
const batchLocked = computed(() => printedBatches.value.length === 1)
// 勾了已打印行 ⇒ 批次号以材料码为准(标签已印在实物上,系统只能服从)
watch(printedBatches, (bs) => { if (bs.length === 1) batchNo.value = bs[0] })
/** 隔离行已生单(剩余=0)不允许再勾;其余行照旧 */
function rowSelectable(row) {
  return capOf(row) > 0
}

const pickedKeys = computed(() => new Set(picked.value.map((r) => r.lineKey)))
/** 本次合计:只算**已勾选**的行(未勾选行即使填了量也不送,合计必须与生单结果一致) */
const totalQty = computed(() => sumPickedQty(rows.value, pickedKeys.value, qtyOf))
/** 本次生效超送比例(0~1;**最高 50%** —— 2026-09-22 用户口径,超出按 50 算) */
const ratio = computed(() => Math.max(0, Math.min(50, Number(overRatioPct.value) || 0)) / 100)
/** 行的可送上限 = 订单数量×(1+本次比例)−已送+已退回(按**全部数量**算;比例一改即时重算,后端同口径再校验) */
/**
 * 该行「本次送料数量」的上限。
 * · **隔离行**(rowKind='printed'):数量就是**印在标签实物上的定量**,不参与超送 ⇒ 直接用服务端给的
 *   可送上限(= 未生单量)。用本地 overAllowance 会算出 数量×(1+超送比例),比真实上限大,
 *   用户按它填就会被后端拒(实测 50 会显示成 52.5)。
 * · **原行**:数量已由服务端扣掉打印量,本地同公式 overAllowance 与后端逐字一致,
 *   保留本地算法是为了"超送比例输入框一改就即时重算"的预览体验。
 */
function capOf(row) {
  if (row?.rowKind === 'printed') return Math.max(0, Number(row.可送上限 || 0))
  return overAllowance(row.数量, row.已送数量, row.已退回数量, overRatioPct.value)
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
    nextBatchNo.value = String(res?.nextBatchNo || '')
    batchNo.value = nextBatchNo.value      // 预填 = 公式算出来的号;用户可在对话框里改
    Object.keys(qtyOf).forEach((k) => delete qtyOf[k])
    for (const r of rows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
    // 默认勾选"还有剩余"的行(保留"打开即可全送"的便利);勾选仍是权威:取消勾选即不送
    await nextTick()
    syncPick(defaultSendKeys())
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

/**
 * 默认勾选的行:**只勾原行**(有剩余的),不勾隔离行。
 * 用户口径「打印后的那一行…没有作废之前是不会与生单有关联的」⇒ 隔离行必须由用户**显式勾选**才会被生单,
 * 不能因为"打开对话框默认全选"就把已打印批次顺手送掉。
 */
function defaultSendKeys() {
  return defaultPickKeys(rows.value.filter((r) => r.rowKind !== 'printed'))
}

/** 全送:勾选所有有剩余的**原行** + 数量按剩余量填满(隔离行仍需单独勾) */
function fillRemaining() {
  for (const r of rows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
  syncPick(defaultSendKeys())
}
/** 全不送:取消全部勾选 + 数量清零 */
function clearAll() {
  for (const r of rows.value) qtyOf[r.lineKey] = 0
  syncPick([])
}

async function confirm() {
  // 只有"已勾选 且 数量 > 0"的行才生单(2026-09-21 修复:此前只按数量过滤、勾选形同虚设)
  // 勾选行 → 生单条目:行键自带身份(`...#行id@打印行id` 就是隔离行),批次号由后端按行自取,
  // 前端**不需要**逐行传 batchNo —— 少一处口径就少一处能对不上的地方。
  const lines = buildBatchSendLines(rows.value, pickedKeys.value, qtyOf)
  if (!lines.length) { ElMessage.warning(tt('请至少勾选一行并填写本次送料数量')); return }
  const rowOf = (lineKey) => rows.value.find((r) => r.lineKey === lineKey) || {}
  const isPrinted = (l) => rowOf(l.lineKey).rowKind === 'printed'
  const resvKeys = [...new Set(lines.filter(isPrinted).map((l) => String(rowOf(l.lineKey)['批次号'] || '')).filter(Boolean))]
  if (resvKeys.length > 1 && lines.some((l) => !isPrinted(l))) {
    ElMessage.warning(tt('勾选了多个已打印批次号时不能同时送未打印量：请先按已打印行生单，或把未打印量分开操作'))
    return
  }
  if (resvKeys.length > 1) {
    try {
      await ElMessageBox.confirm(
        `${tt('已打印隔离行涉及多个批次号，将按批次号分成多张单据生成：')}\n${resvKeys.join('、')}`,
        tt('分批生单'), { type: 'info' })
    } catch { return }
  }
  // 目标批次号分组:隔离行取**它自己的号**;原行取顶部输入框的号 ——
  // 勾了隔离行时顶部已被锁定为该号,于是"未打印量"自然并进同一张单(整单同一个号)。
  const byBatch = new Map()
  for (const l of lines) {
    const target = (isPrinted(l) ? String(rowOf(l.lineKey)['批次号'] || '') : '') || String(batchNo.value || '').trim()
    if (!byBatch.has(target)) byBatch.set(target, [])
    byBatch.get(target).push(l)
  }
  saving.value = true
  try {
    const post = (payload) => engine.batchFlowGenerate({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo,
      overRatio: ratio.value, ...payload,
    })
    const made = []
    for (const [target, g] of byBatch) {
      made.push(await post({ lines: g, batchNo: target }))
    }
    // 批次号已在生单这一刻定稿 —— 提示里回显**真号**(res['批次号']),不再是"以后再取"
    if (made.length === 1) {
      const res = made[0]
      const no = String(res?.['批次号'] || batchNo.value || nextBatchNo.value || '')
      ElMessage.success(no
        ? `${tt('已生成')} ${res['编号']}（${tt('批次号')} ${no}）`
        : `${tt('已生成')} ${res['编号']}`)
    } else {
      ElMessage.success(`${tt('已按批次号生成')} ${made.length} ${tt('张单据')}：`
        + made.map((r) => `${r['编号']}(${r['批次号']})`).join('、'))
    }
    const first = made[0] || {}
    emit('generated', {
      panel: first.gotoPanel || props.targetPanel,
      no: first['编号'],
      batchNo: String(first['批次号'] || ''),
      count: made.length,
      silent: true,      // 本对话框已把"生成了几张"说清了,列表页不用再说一遍
    })
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
/* 批次号(可在生单时改):输入框与 chip 同高,宽 190 够放 「KBL-20261003」 这类号 */
.bsd-batch { display: inline-flex; align-items: center; gap: 4px; }
.bsd-batch-inp { width: 190px; }
.bsd-batch-reset { padding: 0 2px; }
/* 勾了已打印行 ⇒ 批次号以材料码为准(输入框禁用 + 说明) */
.bsd-batch-lock { color: #b88230; }
/* 隔离行(已打印)的批次号与原行的占位符 */
.bsd-rowbatch { color: #b88230; font-weight: 600; }
.bsd-dim { color: #b6c0cc; }
.bsd-ratio { display: inline-flex; align-items: center; gap: 4px; }
.bsd-ratio-tip { color: #8b9893; }
.bsd-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #46586e; }
.bsd-tip { color: #8b9893; }
</style>
