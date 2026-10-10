<template>
  <!-- 打印材料码(2026-10-04 用户口径「在打印材料的时候弹出一个弹窗,可以填写打印的批次号(按之前的格式预填)
       与勾选需要打印的行号和他的数量」):
        批次号默认 = 供应商编码去掉 YJ- 前缀 + - + 当天 yyyyMMdd(服务端算,与生单同一公式),**可改**;
        勾行 + 填本次打印数量(上限 = 该行头寸 − 其它打印记录已预约的量);
        ⚠ **一次只打一行**(追加口径「打印需要是每次一行,不能多行否则作废就全部作废了」):
        选行用**单选**、一次一张打印单 ⇒ 作废只影响这一行;要打第二行就再打开一次弹窗。
        确定后**先落库登记**再出纸 —— 这张纸上的批次号从此成为该订单上批次号的权威值,
        生单对话框里它会是**独立的一行**（数量已从原行切走），勾它即按这个号生单。
       底部「已打印记录」是反查入口(用户不要新加面板,故放在这张弹窗里),可就地**作废**或**重打**。 -->
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

      <!-- 一次可以勾**多行**,但服务端会**每行各出一张打印单**(用户口径「作废不希望连坐」+
           追加「一次是可以打印多行的」)—— 多行并进一张单会让作废连坐,所以粒度落在单上,不在弹窗上 -->
      <div class="mlq-oneline">{{ tt('可一次勾选多行；每行各自出一张打印单（作废只影响对应那一行）') }}</div>

      <el-table ref="tableRef" :data="rows" row-key="id" border size="small" height="330" @selection-change="onPicked">
        <el-table-column type="selection" width="42" :selectable="rowSelectable" />
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
        <span>{{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b>
          <span v-if="picked.length > 1" class="mlq-tip">（{{ tt('将生成') }} {{ picked.length }} {{ tt('张打印单') }}）</span>
        </span>
      </div>

      <!-- 下层:**已生单可补打**(2026-10-04 用户口径「还有已经生单的数据也应该可以打印」)——
           货已经收了(暂收单都有号了)才想起来打码、或者先送了一批没打码后来补打。
           这类打印**不预约、不产生隔离行**(量早就送过了,生单弹窗里不会多出一行),
           批次号**取该行已生单单据上的号**(印在标签上必须与实物/单据同号,故这里只读)。 -->
      <div v-if="suppRows.length" class="mlq-supp">
        <div class="mlq-supp-title">
          {{ tt('已生单可补打（已经收了的量还没打码）') }}
          <span class="mlq-tip">{{ tt('补打只为留痕：不占用余量、不会在生单弹窗里多出一行；批次号取该批货单据上的号，不可改') }}</span>
        </div>
        <el-table ref="suppRef" :data="suppRows" row-key="suppKey" border size="small" max-height="200"
          @selection-change="onSuppPicked">
          <el-table-column type="selection" width="42" :selectable="suppSelectable" />
          <el-table-column prop="批次号" :label="tt('批次号')" min-width="150" show-overflow-tooltip />
          <el-table-column prop="行号" :label="tt('行号')" width="60" />
          <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="120" show-overflow-tooltip />
          <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="120" show-overflow-tooltip />
          <el-table-column prop="去向单据" :label="tt('去向单据')" min-width="140" show-overflow-tooltip />
          <el-table-column prop="已收数量" :label="tt('已收')" width="85" align="right" />
          <el-table-column prop="已补登数量" :label="tt('已补打')" width="85" align="right" />
          <el-table-column prop="可补登数量" :label="tt('可补打')" width="90" align="right" />
          <el-table-column :label="tt('本次打印数量')" width="150">
            <template #default="{ row }">
              <el-input-number v-model="suppQty[row.suppKey]" :min="0" :max="Number(row['可补登数量'] || 0)"
                :controls="false" :disabled="!(Number(row['可补登数量'] || 0) > 0)" :precision="2" style="width: 130px" />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="mlq-records">
        <div class="mlq-rec-title">{{ tt('已打印记录（本订单）') }}</div>
        <el-table :data="data.records || []" border size="small" max-height="200">
          <el-table-column prop="批次号" :label="tt('批次号')" min-width="160" />
          <el-table-column prop="单据编号" :label="tt('打印单号')" min-width="150" />
          <el-table-column :label="tt('用途')" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row['补登'] ? 'info' : 'success'" size="small">
                {{ tt(row['补登'] ? '已生单补登' : '待生单') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="打印量合计" :label="tt('打印量')" width="90" align="right" />
          <el-table-column prop="已生单合计" :label="tt('已生单')" width="90" align="right" />
          <el-table-column prop="未生单合计" :label="tt('未生单')" width="90" align="right" />
          <el-table-column prop="行数" :label="tt('行数')" width="70" align="right" />
          <el-table-column prop="打印时间" :label="tt('打印时间')" width="150" />
          <el-table-column prop="打印次数" :label="tt('打印次数')" width="85" align="right" />
          <el-table-column :label="tt('操作')" width="130" align="center">
            <template #default="{ row }">
              <!-- 重打 = 同一张单原样再打一遍(纸卡了/打歪了):只累加 打印次数,**不新增预约**
                   (用同一行再打一次会被当成新打印而重复占量,所以"再打一遍"必须走这里) -->
              <el-button link type="primary" :disabled="busy" @click="doReprint(row)">{{ tt('重打') }}</el-button>
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
 * 生单对话框里它是**独立的一行**（数量已从原行切走），勾它即按这个号生单,不再按公式重算。
 *
 * ⚠ **一次可以勾多行,但每行各自出一张打印单**(用户口径:先「不能多行否则作废就全部作废了」,
 * 再追加「一次是可以打印多行的」⇒ 粒度落在**单**上而不是弹窗上):
 * 勾 3 行 ⇒ 落 3 张 bd_pu_label(同一个批次号、3 个单号),作废其中一张只影响它自己那一行。
 * 方案:docs/plans/2026-10-04-采购订单材料码批次号方案.md
 *
 * 出纸复用 printProductCards(75×100mm 产品标识卡),这次把「批次」传真值 ——
 * 纸面不再留横线,二维码也随之带上批号段(公司代码@物料编码@批次号,与采购入库单标识卡同口径)。
 */
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'

const engine = usePanelRuntime()
/** 纸质单据打印(与其让本组件直接依赖 atom print-formats,不如统一<｜hy_place▁holder▁no▁813｜>面板 runtime 下发) */
const printProductCards = (rows) => engine.printProductCards(rows)

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
/** **多选**:本次要打的行(勾选是权威;服务端会按**每行一张单**落库) */
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
/** 有可打量才让勾(打满的行不给勾) */
function rowSelectable(row) {
  return capOf(row) > 0
}

/* ── 下层「已生单可补打」:已收但还没打码的量(按 订单行 × 已生单批次号 一行) ── */
const suppRef = ref(null)
const suppPicked = ref([])
const suppQty = reactive({})
/** 补登行的唯一键(行id + 批次号;批次号里可能有特殊字符,故用 \u0001 拼) */
const suppKeyOf = (row) => `${row['采购订单行id']}\u0001${row['批次号']}`
const suppRows = computed(() => (data.value['补登行'] || []).map((r) => ({ ...r, suppKey: suppKeyOf(r) })))
function suppSelectable(row) {
  return Number(row['可补登数量'] || 0) > 0
}
function onSuppPicked(list) {
  suppPicked.value = list || []
  for (const r of suppPicked.value) {
    if (!(Number(suppQty[r.suppKey] || 0) > 0)) suppQty[r.suppKey] = Number(r['可补登数量'] || 0)
  }
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
    // 下层补登:数量与勾选每次都清空(默认不勾 —— 补登是"事后补打",必须显式选)
    Object.keys(suppQty).forEach((k) => delete suppQty[k])
    suppPicked.value = []
    for (const r of suppRows.value) suppQty[r.suppKey] = 0
    // 默认勾上**所有有可打量**的行(与分批送料对话框同款便利,勾选仍是权威)
    await Promise.resolve()
    syncPick(rows.value.filter((r) => capOf(r) > 0).map((r) => r.id))
    await nextTick()
    suppRef.value?.clearSelection()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('材料码数据加载失败'))
  } finally {
    loading.value = false
  }
}

/** 勾选集合 → 表格勾选态(并同步 picked,避免依赖 selection-change 的时序) */
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
/** 新勾上的行按剩余可打量预填(已填过的不覆盖:取消勾选不吞已填数量,重勾还能用) */
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

/** 出纸:纸上的号 = 库里的号(先落库再打印) */
function cardsOf(res) {
  return (res?.lines || []).map((l) => ({
    编码: l['物料编码'],
    规格: l['规格型号'] || '',
    数量: l['打印数量'],
    批次: res['批次号'],
    订单编号: props.orderNo,
    供应商名称: head.value['供应商'] || '',
    生产日期: '',
  }))
}

async function confirm() {
  const lines = rows.value
    .filter((r) => pickedKeys.value.has(r.id) && Number(qtyOf[r.id] || 0) > 0)
    .map((r) => ({ 采购订单行id: r.id, 打印数量: Number(qtyOf[r.id]) }))
  // 下层补登行:各自带自己的批次号(该批货单据上的号),标记 补登=true
  const supLines = suppPicked.value
    .filter((r) => Number(suppQty[r.suppKey] || 0) > 0)
    .map((r) => ({
      采购订单行id: r['采购订单行id'], 打印数量: Number(suppQty[r.suppKey]),
      批次号: String(r['批次号'] || ''), 补登: true,
    }))
  const all = [...lines, ...supLines]
  if (!all.length) { ElMessage.warning(tt('请至少勾选一行并填写本次打印数量')); return }
  // 上层走顶部批次号(未生单的码,公式号/人工号);只勾下层补登行时不需要顶部号
  if (lines.length && isEmpty(batchNo.value)) { ElMessage.warning(tt('请填写批次号')); return }
  busy.value = true
  try {
    // 可以一次勾多行:服务端**每行各出一张打印单**(作废因此只影响对应那一行)
    const res = await engine.puLabelPrint({
      orderNo: props.orderNo, batchNo: String(batchNo.value).trim(), lines: all,
    })
    await printProductCards(cardsOf(res))
    const docs = res['单据编号列表'] || [res['单据编号']]
    ElMessage.success(docs.length > 1
      ? `${tt('已登记并打印 {n} 张打印单').replace('{n}', docs.length)}${docs.join('、')}（${tt('批次号')} ${res['批次号']}）`
      : `${tt('已登记并打印')} ${res['单据编号']}（${tt('批次号')} ${res['批次号']}）`)
    emit('printed', {
      orderNo: props.orderNo, docNo: res['单据编号'], batchNo: res['批次号'], count: docs.length,
    })
    await load()          // 刷新"剩余可打"与"已打印记录"
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印登记失败'))
  } finally {
    busy.value = false
  }
}

/** 重打:同一张打印单原样再打一遍(只累加打印次数,不新增预约) */
async function doReprint(row) {
  busy.value = true
  try {
    const res = await engine.puLabelReprint(row['单据编号'])
    await printProductCards(cardsOf(res))
    ElMessage.success(`${tt('已重打（第 {n} 次）').replace('{n}', res['打印次数'])} ${res['单据编号']}`)
    await load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('重打失败'))
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
/* 多行提示条(浅黄底,说明"每行各出一张打印单;作废只影响对应那一行") */
.mlq-oneline { font-size: 12.5px; color: #8a6d3b; background: #fdf6e3; border: 1px solid #f5e3b3; border-radius: 4px; padding: 3px 8px; }
.mlq-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #46586e; }
.mlq-records { margin-top: 4px; }
.mlq-rec-title { font-size: 12.5px; color: #46586e; margin-bottom: 4px; }
/* 下层「已生单可补打」:与上层隔一道浅线,说明它不是"待生单的预约" */
.mlq-supp { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #dde5ee; display: flex; flex-direction: column; gap: 4px; }
.mlq-supp-title { font-size: 12.5px; color: #46586e; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
</style>
