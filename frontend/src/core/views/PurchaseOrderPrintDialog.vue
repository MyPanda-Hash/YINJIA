<template>
  <!-- 采购订单打印弹窗(2026-11-07)—— 用户口径:
       「采购订单的打印(两个报表一个有金额,一个没有金额),需要能够在打印报表的时候编辑
        (像打印材料码的编辑一样),要可以勾选打印和填写数量」。

       与「打印材料码」弹窗同一套交互语言:上面一排单据信息、中间勾选表格、每行填本次数量、
       下面合计 + 确定并打印。区别只有一点:**这里不落库** —— 材料码要登记批次号/预约数量,
       而采购订单报表只是把订单打出来,勾选与数量只作用于**这一张纸**,不改动订单数据。
       (所以没有"已打印记录/作废/重打",订单本身才是权威数据。)

       版式二选一:有金额(printPuOrder)/ 无金额(printPuOrderNoAmount)—— 两个报表同一张弹窗,
       从哪个菜单进来默认就是哪个版式,也可以在弹窗里随时切。 -->
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="dlgWidth"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="load"
  >
    <div v-loading="loading" class="pup">
      <div class="pup-bar">
        <span class="pup-chip">{{ tt('供应商') }}：{{ head['供应商'] || head['供应商编码'] || '—' }}</span>
        <span class="pup-chip">{{ tt('单据日期') }}：{{ head['单据日期'] || '—' }}</span>
        <span class="pup-chip pup-fmt">
          {{ tt('打印版式') }}：
          <el-radio-group v-model="fmt" size="small">
            <el-radio-button value="amount">{{ tt('有金额') }}</el-radio-button>
            <el-radio-button value="noamount">{{ tt('无金额') }}</el-radio-button>
          </el-radio-group>
        </span>
      </div>
      <!-- 这句话是口径本身,别删:用户最容易误解的就是"是不是改了订单数量" -->
      <div class="pup-tip">{{ tt('勾选要打印的明细行，并填写本次打印数量；只影响这张报表，不改动订单数据') }}</div>

      <el-table ref="tableRef" :data="rows" row-key="__key" border size="small" height="360"
        @selection-change="onPicked">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="行号" :label="tt('行号')" width="64" />
        <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="110" show-overflow-tooltip />
        <el-table-column prop="单位" :label="tt('单位')" width="64" />
        <el-table-column prop="数量" :label="tt('订单数量')" width="96" align="right" />
        <el-table-column :label="tt('本次打印数量')" width="132">
          <template #default="{ row }">
            <el-input-number v-model="qtyOf[row.__key]" :min="0" :controls="false" style="width: 112px" />
          </template>
        </el-table-column>
        <!-- 单价/小计只属于"有金额"版式:无金额版纸面本来就没这两列,弹窗跟着收起,避免看成两张报表 -->
        <el-table-column v-if="showAmount" prop="单价" :label="tt('单价')" width="92" align="right" />
        <el-table-column v-if="showAmount" :label="tt('小计')" width="104" align="right">
          <template #default="{ row }">{{ amountText(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('交期要求')" width="104">
          <template #default="{ row }">{{ row['预计到货日期'] || head['交货日期'] || '' }}</template>
        </el-table-column>
        <template #empty>{{ tt('当前单据没有可打印的明细行') }}</template>
      </el-table>

      <div class="pup-foot">
        <span>
          {{ tt('已选') }} <b>{{ picked.length }}</b> / {{ rows.length }} {{ tt('行') }} ·
          {{ tt('数量合计') }}：<b>{{ qtyText(totalQty) }}</b>
          <span v-if="showAmount"> · {{ tt('金额合计') }}：<b>{{ moneyText(totalAmount) }}</b></span>
        </span>
      </div>
    </div>
    <template #footer>
      <el-button @click="fillOrderQty">{{ tt('按订单数量填充') }}</el-button>
      <el-button @click="selectAll">{{ tt('全选') }}</el-button>
      <el-button @click="clearAll">{{ tt('清空') }}</el-button>
      <el-button type="primary" :loading="busy" @click="confirm">{{ tt('确定并打印') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * PurchaseOrderPrintDialog — 采购订单「打印时编辑」弹窗(2026-11-07)
 *
 * 需求(用户原话):「采购订单的打印(两个报表一个有金额,一个没有金额),需要能够在打印报表的时候编辑
 * (像打印材料码的编辑一样),要可以勾选打印和填写数量」。
 *
 * 与 MaterialLabelDialog(打印材料码)的分工:
 *   · 材料码:打印即**落库**(批次号权威登记 + 预约该行数量),所以有「已打印记录/作废/重打」;
 *   · 本弹窗:**只出纸**。勾选决定哪些明细行落纸、每行的「本次打印数量」覆盖纸面数量,
 *     关掉弹窗即丢,订单一个字段都不动(采购订单本身有保存/审核链路,不该被一次打印改写)。
 *
 * 取数同「打印采购订单」的既有口径:`engine.getFormDescriptor`(已保存的最新行,不读编辑中的草稿)。
 * 落纸行由 core 层纯函数 `puOrderPrintRows` 生成(单测钉住"没勾的不打/改数量才重算小计"),
 * 出纸复用 business/print-formats 的两个版式,经面板 runtime 下发(core 不直接 import business)。
 */
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { sumKeepScale } from '@core/panel/sumTotals'
import { puOrderPrintRows, puOrderLineAmount } from '@core/panel/puPrintRows'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 面板编码:采购订单 PU_ORDER / 供应商采购打印 SUPPLIER_PU_ORDER(同一张单、同一份取数) */
  panelCode: { type: String, default: 'PU_ORDER' },
  /** 单据编号 */
  docNo: { type: String, default: '' },
  /** 打开时默认的版式:true=有金额(打印采购订单),false=无金额(打印订单无金额) */
  withAmount: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue', 'printed'])

const loading = ref(false)
const busy = ref(false)
const doc = ref({})
const head = computed(() => doc.value || {})
/** 明细行(原始数据;勾选/数量只存在本弹窗的局部状态里) */
const lines = ref([])
/** 版式:amount=有金额,noamount=无金额(两个报表同一张弹窗) */
const fmt = ref('amount')
const showAmount = computed(() => fmt.value === 'amount')
/** 宽表(带金额 10 列)按 1150px 排;小屏退回 96vw,不出横向滚动条 */
const dlgWidth = 'min(1150px, 96vw)'
const tableRef = ref(null)
const picked = ref([])
/** 行键 → 本次打印数量(键由 keyOf 生成,与 puOrderPrintRows 同源) */
const qtyOf = reactive({})

/** 行键:优先数据库 id,其次行号,最后下标(与 core/panel/puPrintRows 的默认 keyOf 完全一致) */
const keyOf = (row, i) => String(row?.id ?? row?.['行号'] ?? i)
/** 表格行:原始行 + 稳定行键(__key),不改原始字段 */
const rows = computed(() => lines.value.map((l, i) => ({ ...l, __key: keyOf(l, i) })))
const pickedKeys = computed(() => new Set(picked.value.map((r) => r.__key)))
const title = computed(() => {
  const base = showAmount.value ? tt('打印采购订单') : tt('打印订单无金额')
  return props.docNo ? `${base} · ${props.docNo}` : base
})

const qtyText = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return String(Math.round(n * 10000) / 10000)
}
const moneyText = (v) => {
  const n = Number(v)
  if (v == null || v === '' || Number.isNaN(n)) return ''
  return String(Math.round(n * 10000) / 10000)
}
/** 纸面小计(与落纸口径同一个纯函数:没改数量就是原金额,改了才 单价×数量) */
function amountOf(row) {
  return puOrderLineAmount(row, qtyOf[row.__key])
}
function amountText(row) {
  return moneyText(amountOf(row))
}
const totalQty = computed(() => {
  const vals = []
  for (const r of rows.value) if (pickedKeys.value.has(r.__key)) vals.push(qtyOf[r.__key])
  return sumKeepScale(vals) ?? 0
})
const totalAmount = computed(() => {
  const vals = []
  for (const r of rows.value) if (pickedKeys.value.has(r.__key)) vals.push(amountOf(r))
  return sumKeepScale(vals) ?? 0
})

async function load() {
  if (!props.docNo) return
  loading.value = true
  fmt.value = props.withAmount ? 'amount' : 'noamount'
  picked.value = []
  // 每次开窗先清空:上一次的单据/明细不能残留(取数失败时宁可空表,也不要让人以为打的是新单)
  doc.value = {}
  lines.value = []
  Object.keys(qtyOf).forEach((k) => delete qtyOf[k])
  try {
    const res = await engine.getFormDescriptor({ panelCode: props.panelCode, code: props.docNo })
    doc.value = res?.data || {}
    if (!doc.value['单据编号'] && !doc.value['单号'] && !doc.value['编号']) {
      ElMessage.warning(tt('未取到单据数据'))
      return
    }
    // 明细 = 首页签(与"打印采购订单"既有取数完全一致)
    lines.value = (Object.values(res?.detailData || {})[0] || [])
      .filter((l) => l && (l['物料编码'] || l['物料名称']))
    if (!lines.value.length) return ElMessage.warning(tt('当前单据没有可打印的明细行'))
    lines.value.forEach((l, i) => {
      const q = Number(l['数量'])
      qtyOf[keyOf(l, i)] = Number.isFinite(q) ? q : undefined
    })
    // 默认全选(与材料码弹窗同款便利):大部分打印就是整单打,勾选仍是权威
    await nextTick()
    selectAll()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印失败'))
  } finally {
    loading.value = false
  }
}

function syncPick(keys) {
  const set = new Set(keys)
  tableRef.value?.clearSelection()
  picked.value = []
  for (const r of rows.value) if (set.has(r.__key)) tableRef.value?.toggleRowSelection(r, true)
  picked.value = rows.value.filter((r) => set.has(r.__key))
}
function onPicked(list) {
  picked.value = list || []
}
function selectAll() {
  syncPick(rows.value.map((r) => r.__key))
}
function clearAll() {
  syncPick([])
}
/** 数量回填成订单数量**并全选**(用户要重打整单时的复位动作) */
function fillOrderQty() {
  for (const r of rows.value) {
    const q = Number(r['数量'])
    qtyOf[r.__key] = Number.isFinite(q) ? q : undefined
  }
  selectAll()
}

function confirm() {
  if (!picked.value.length) return ElMessage.warning(tt('请至少勾选一行明细'))
  const bad = picked.value.filter((r) => !(Number(qtyOf[r.__key]) > 0))
  if (bad.length) {
    return ElMessage.warning(tt('本次打印数量必须大于 0（不打印的行请取消勾选）'))
  }
  const picks = {}
  for (const r of picked.value) picks[r.__key] = Number(qtyOf[r.__key])
  const printRows = puOrderPrintRows(lines.value, picks, keyOf)
  if (!printRows.length) return ElMessage.warning(tt('请至少勾选一行明细'))
  busy.value = true
  try {
    // 两个版式共用同一份落纸行;出纸走页面内打印层(print-formats,经 runtime 下发)
    const ok = showAmount.value
      ? engine.printPuOrder(doc.value, printRows)
      : engine.printPuOrderNoAmount(doc.value, printRows)
    // true = 已交给打印层 ⇒ 关窗(browser 打印对话框照常弹出);false = 已被提示,留在窗里重试
    if (ok) {
      emit('printed', { docNo: props.docNo, format: fmt.value, lines: printRows.length })
      emit('update:modelValue', false)
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印失败'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.pup { display: flex; flex-direction: column; gap: 8px; }
.pup-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 12.5px; color: #46586e; }
.pup-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.pup-fmt { display: inline-flex; align-items: center; gap: 6px; }
.pup-tip { font-size: 12.5px; color: #8a6d3b; background: #fdf6e3; border: 1px solid #f5e3b3; border-radius: 4px; padding: 3px 8px; }
.pup-foot { display: flex; justify-content: flex-end; align-items: center; font-size: 12.5px; color: #46586e; }
</style>
