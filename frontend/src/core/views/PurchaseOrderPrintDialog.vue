<template>
  <!-- 采购订单打印弹窗(2026-11-07)—— 用户口径:
       「采购订单的打印(两个报表一个有金额,一个没有金额),需要能够在打印报表的时候编辑
        (像打印材料码的编辑一样),要可以勾选打印和填写数量」+「弹窗有对已经打印的做记录吗」
       ⇒ 选「像材料码那样」:每次打印落一份快照,弹窗底部列「已打印记录」,可重打 / 作废。

       与「打印材料码」弹窗同一套交互语言:上面单据信息、中间勾选表格、下面合计 + 已打印记录。
       差别:报表打印**不占用订单量**(没有预约),所以作废只作废这张纸,不释放任何余量。 -->
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="dlgWidth"
    :top="'5vh'"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
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

      <el-table ref="tableRef" :data="rows" row-key="__key" border size="small" height="330"
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

      <!-- 已打印记录(2026-11-07 用户口径「像材料码那样」):每次打印一份快照,可重打/作废;
           2026-11-09 用户口径「这一行我想要点击可以看到明细」⇒ 点整行打开记录明细 -->
      <div class="pup-rec">
        <div class="pup-rec-title">
          {{ tt('已打印记录（本订单）') }}
          <span class="pup-tip">{{ tt('每次打印都会留一份记录；重打只累加次数，作废只作废这张纸') }}</span>
          <span class="pup-tip">{{ tt('点击记录行可查看明细') }}</span>
        </div>
        <el-table :data="records" border size="small" max-height="220" class="pup-rec-table"
          @row-click="openRecordDetail">
          <el-table-column prop="单据编号" :label="tt('打印单号')" min-width="150" />
          <el-table-column :label="tt('打印版式')" width="96" align="center">
            <template #default="{ row }">{{ tt(row['打印版式']) }}</template>
          </el-table-column>
          <el-table-column prop="行数" :label="tt('行数')" width="64" align="right" />
          <el-table-column prop="数量合计" :label="tt('数量合计')" width="96" align="right" />
          <el-table-column :label="tt('金额合计')" width="104" align="right">
            <template #default="{ row }">{{ row['金额合计'] == null ? '' : moneyText(row['金额合计']) }}</template>
          </el-table-column>
          <el-table-column prop="打印人" :label="tt('打印人')" width="96" show-overflow-tooltip />
          <el-table-column prop="打印时间" :label="tt('打印时间')" width="150" />
          <el-table-column prop="打印次数" :label="tt('打印次数')" width="78" align="right" />
          <el-table-column :label="tt('操作')" width="118" align="center">
            <template #default="{ row }">
              <!-- 重打 = 同一张记录原样再打一遍(纸卡了/打歪了):只累加打印次数,不新增记录。
                   两颗按钮都必须 @click.stop,否则会连带触发"点整行看明细" -->
              <el-button link type="primary" :disabled="busy" @click.stop="doReprint(row)">{{ tt('重打') }}</el-button>
              <el-button link type="danger" :disabled="busy" @click.stop="doVoid(row)">{{ tt('作废') }}</el-button>
            </template>
          </el-table-column>
          <template #empty>{{ tt('该订单还没有打印记录') }}</template>
        </el-table>
      </div>
    </div>
    <template #footer>
      <el-button @click="fillOrderQty">{{ tt('按订单数量填充') }}</el-button>
      <el-button @click="selectAll">{{ tt('全选') }}</el-button>
      <el-button @click="clearAll">{{ tt('清空') }}</el-button>
      <el-button type="primary" :loading="busy" @click="confirm">{{ tt('确定并打印') }}</el-button>
    </template>
  </el-dialog>

  <!-- 打印记录明细(2026-11-09 用户口径「这一行我想要点击可以看到明细」):
       点「已打印记录」任一行打开,看这次打印具体打了哪几行、每行多少;只读,不改打印次数 -->
  <el-dialog v-model="recDetailVisible" :title="detailTitle" :width="'min(1150px, 96vw)'" :top="'6vh'" append-to-body>
    <div v-loading="recDetailLoading" class="pup-detail">
      <div class="pup-bar">
        <span class="pup-chip">{{ tt('采购订单号') }}：{{ recDetail['采购订单号'] || '—' }}</span>
        <span class="pup-chip">{{ tt('打印版式') }}：{{ recDetail['打印版式'] ? tt(recDetail['打印版式']) : '—' }}</span>
        <span class="pup-chip">{{ tt('打印人') }}：{{ recDetail['打印人'] || '—' }}</span>
        <span class="pup-chip">{{ tt('打印时间') }}：{{ recDetail['打印时间'] || '—' }}</span>
        <span class="pup-chip">{{ tt('打印次数') }}：{{ recDetail['打印次数'] ?? 0 }}</span>
        <span class="pup-chip">{{ tt('行数') }}：{{ recDetail['行数'] ?? 0 }}</span>
        <span class="pup-chip">{{ tt('数量合计') }}：{{ qtyText(recDetail['数量合计']) }}</span>
        <span v-if="recDetail['金额合计'] != null" class="pup-chip">
          {{ tt('金额合计') }}：{{ moneyText(recDetail['金额合计']) }}
        </span>
      </div>
      <el-table :data="recDetail.lines || []" border size="small" max-height="400">
        <el-table-column prop="行号" :label="tt('行号')" width="64" />
        <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="110" show-overflow-tooltip />
        <el-table-column prop="单位" :label="tt('单位')" width="64" />
        <el-table-column prop="订单数量" :label="tt('订单数量')" width="96" align="right" />
        <el-table-column :label="tt('打印数量')" width="96" align="right">
          <template #default="{ row }">{{ qtyText(row['数量']) }}</template>
        </el-table-column>
        <el-table-column v-if="detailHasAmount" prop="单价" :label="tt('单价')" width="92" align="right" />
        <el-table-column v-if="detailHasAmount" :label="tt('小计')" width="104" align="right">
          <template #default="{ row }">{{ row['金额'] == null ? '' : moneyText(row['金额']) }}</template>
        </el-table-column>
        <el-table-column :label="tt('交期要求')" width="104">
          <template #default="{ row }">{{ row['预计到货日期'] || '' }}</template>
        </el-table-column>
        <el-table-column prop="备注" :label="tt('备注')" min-width="100" show-overflow-tooltip />
        <template #empty>{{ tt('该记录没有明细行') }}</template>
      </el-table>
    </div>
    <template #footer>
      <el-button @click="recDetailVisible = false">{{ tt('关闭') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * PurchaseOrderPrintDialog — 采购订单「打印时编辑 + 打印记录」弹窗(2026-11-07)
 *
 * 需求(用户原话):「采购订单的打印(两个报表一个有金额,一个没有金额),需要能够在打印报表的时候编辑
 * (像打印材料码的编辑一样),要可以勾选打印和填写数量」;追问「弹窗有对已经打印的做记录吗」后
 * 选「像材料码那样」⇒ 本弹窗增加「已打印记录」:每次打印落一份快照,可重打 / 作废。
 *
 * 口径:
 *   · **先落库、再出纸**:纸面内容 = 服务端返回的落纸行(数量/小计/交期由服务端按订单行重算),
 *     保证「记录 = 纸」永远同源;打印层挂不上时把刚落的记录作废掉,不留"有记录没纸";
 *   · 勾选决定哪些行落纸;每行「本次打印数量」默认=订单数量,改过的行小计=单价×数量,
 *     没改的行沿用订单原金额(折扣/分摊不会被打印抹掉);
 *   · 重打只累加打印次数、不新增记录;作废只软删这张记录(报表打印不占用订单量,没有余量要释放);
 *   · 与材料码弹窗的区别:材料码打印会**预约**订单余量,报表打印不会。
 *
 * 取数同「打印采购订单」既有口径:`engine.getFormDescriptor`(已保存的最新行,不读编辑中的草稿)。
 * 出纸复用 business/print-formats 的两个版式,经面板 runtime 下发(core 不直接 import business)。
 */
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { sumKeepScale } from '@core/panel/sumTotals'
import { puOrderLineAmount } from '@core/panel/puPrintAmount'

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
/** 行键 → 本次打印数量(键由 keyOf 生成) */
const qtyOf = reactive({})
/** 本订单的打印记录(服务端落库快照;弹窗底部表格) */
const records = ref([])

/** 打印记录明细(2026-11-09 用户口径「这一行我想要点击可以看到明细」):点记录行打开,只读 */
const recDetailVisible = ref(false)
const recDetailLoading = ref(false)
const recDetail = ref({})
const detailHasAmount = computed(() => recDetail.value['打印版式'] !== '无金额')
const detailTitle = computed(() => {
  const no = recDetail.value['单据编号']
  return no ? `${tt('打印记录明细')} · ${no}` : tt('打印记录明细')
})

/** 行键:优先数据库 id,其次行号,最后下标 */
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
/** 纸面小计(与落库口径同一个纯函数:没改数量就是原金额,改了才 单价×数量) */
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

/** 开窗:版式回到「入口动作」的默认值,再取数 */
async function onOpen() {
  fmt.value = props.withAmount ? 'amount' : 'noamount'
  await load()
}

async function load() {
  if (!props.docNo) return
  loading.value = true
  picked.value = []
  // 每次开窗先清空:上一次的单据/明细/记录不能残留(取数失败时宁可空表)
  doc.value = {}
  lines.value = []
  records.value = []
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
    await loadRecords()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印失败'))
  } finally {
    loading.value = false
  }
}

/** 只刷新「已打印记录」(不动勾选/数量);失败不挡住打印主体 */
async function loadRecords() {
  if (!props.docNo) return
  try {
    records.value = (await engine.puPrintRecords(props.docNo)) || []
  } catch (e) {
    records.value = []
    console.warn('[pu-print] 打印记录加载失败:', e?.message || e)
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

/**
 * 确定并打印 = **先落库、再出纸**:
 *   ① 服务端按订单行重算并落一份快照,返回落纸行;
 *   ② 用返回行出纸(纸面与记录同源);
 *   ③ 打印层挂不上(浏览器拒绝)⇒ 把刚落的记录作废,避免"有记录没纸";
 *   ④ 打印结束(afterprint)后再刷新记录,不在打印对话框开着时重绘(2026-10-29 卡顿口径)。
 */
async function confirm() {
  if (!picked.value.length) return ElMessage.warning(tt('请至少勾选一行明细'))
  const bad = picked.value.filter((r) => !(Number(qtyOf[r.__key]) > 0))
  if (bad.length) {
    return ElMessage.warning(tt('本次打印数量必须大于 0（不打印的行请取消勾选）'))
  }
  const picks = picked.value.map((r) => ({
    采购订单行id: Number(r.id),
    打印数量: Number(qtyOf[r.__key]),
  }))
  busy.value = true
  try {
    const res = await engine.puPrintSave({
      orderNo: props.docNo,
      format: showAmount.value ? '有金额' : '无金额',
      lines: picks,
    })
    const printRows = res?.['lines'] || []
    if (!res?.['单据编号'] || !printRows.length) throw new Error('打印记录未返回落纸行')
    const printFn = res['打印版式'] === '无金额' ? engine.printPuOrderNoAmount : engine.printPuOrder
    let afterPrint = null
    let printDone = false   // onDone 可能比下面的赋值先到(打印被拒/层摘得快)
    const ok = printFn(doc.value, printRows, {
      onDone: () => { printDone = true; if (afterPrint) afterPrint() },
    })
    if (!ok) {
      // 打印层没挂上:撤掉刚落的记录(否则"记录说打过、纸上什么都没有")
      try { await engine.puPrintVoid(res['单据编号']) } catch { /* 撤销失败也不改主流程提示 */ }
      ElMessage.error(tt('打印失败'))
      return
    }
    ElMessage.success(`${tt('已登记打印记录')} ${res['单据编号']}`)
    emit('printed', { docNo: props.docNo, printNo: res['单据编号'], format: res['打印版式'] })
    afterPrint = () => { load() }
    if (printDone || !document.getElementById('yj-print-host')) afterPrint()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印登记失败'))
  } finally {
    busy.value = false
  }
}

/**
 * 点「已打印记录」一行 → 看这次打印的明细(2026-11-09 用户口径)。
 * 只读:取该记录的快照行,不改打印次数(重打是单独一颗按钮)。
 */
async function openRecordDetail(row) {
  const no = row?.['单据编号']
  if (!no) return
  // 先拿列表里的汇总填满(弹窗立刻有内容),再拉明细行
  recDetail.value = { ...row, lines: [] }
  recDetailVisible.value = true
  recDetailLoading.value = true
  try {
    const res = await engine.puPrintDetail(no)
    if (res) recDetail.value = res
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印记录明细加载失败'))
  } finally {
    recDetailLoading.value = false
  }
}

/** 重打:同一张记录原样再打一遍(只累加打印次数,不新增记录) */
async function doReprint(row) {
  busy.value = true
  try {
    const res = await engine.puPrintReprint(row['单据编号'])
    if (!res || !res['单据编号']) throw new Error(tt('打印记录不存在或已作废'))
    const printRows = res['lines'] || []
    const printFn = res['打印版式'] === '无金额' ? engine.printPuOrderNoAmount : engine.printPuOrder
    let afterPrint = null
    let printDone = false
    await printFn(doc.value, printRows, {
      onDone: () => { printDone = true; if (afterPrint) afterPrint() },
    })
    ElMessage.success(`${tt('已重打（第 {n} 次）').replace('{n}', res['打印次数'] ?? '')} ${res['单据编号']}`)
    afterPrint = () => { loadRecords() }
    if (printDone || !document.getElementById('yj-print-host')) afterPrint()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('重打失败'))
  } finally {
    busy.value = false
  }
}

/** 作废打印记录(只作废这张纸;报表打印不占用订单量,没有余量要释放) */
async function doVoid(row) {
  try {
    await ElMessageBox.confirm(
      `${tt('作废后这张打印记录不再显示（报表打印不占用订单量，没有余量要释放），确定继续吗？')}\n${tt('打印单号')} ${row['单据编号']} / ${tt('打印次数')} ${row['打印次数'] ?? 0}`,
      tt('作废打印记录'), { type: 'warning' })
  } catch { return }
  busy.value = true
  try {
    await engine.puPrintVoid(row['单据编号'])
    ElMessage.success(tt('已作废打印记录'))
    await loadRecords()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('作废失败'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
/* 弹窗内容(勾选表 + 已打印记录)比原来高:矮屏(768/1080 笔记本)上会把底部按钮顶出视口。
   让**内容区自己滚动**、标题与底部按钮固定可见(2026-11-09 实测 707px 高时按钮被挡在视口外)。 */
.pup { display: flex; flex-direction: column; gap: 8px; max-height: 66vh; overflow-y: auto; padding-right: 4px; }
.pup-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 12.5px; color: #46586e; }
.pup-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.pup-fmt { display: inline-flex; align-items: center; gap: 6px; }
.pup-tip { font-size: 12.5px; color: #8a6d3b; background: #fdf6e3; border: 1px solid #f5e3b3; border-radius: 4px; padding: 3px 8px; }
.pup-foot { display: flex; justify-content: flex-end; align-items: center; font-size: 12.5px; color: #46586e; }
/* 已打印记录:与上方勾选表隔一道浅线,说明用途 */
.pup-rec { margin-top: 4px; padding-top: 6px; border-top: 1px dashed #dde5ee; display: flex; flex-direction: column; gap: 4px; }
.pup-rec-title { font-size: 12.5px; color: #46586e; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.pup-rec-title .pup-tip { background: none; border: none; padding: 0; }
/* 记录行可点击看明细:鼠标手型 + 悬停高亮提示(行内的重打/作废按钮已 @click.stop) */
.pup-rec-table :deep(.el-table__row) { cursor: pointer; }
.pup-rec-table :deep(.el-table__row:hover > td) { background: #eef6ff !important; }
/* 记录明细弹窗 */
.pup-detail { display: flex; flex-direction: column; gap: 8px; }
</style>
