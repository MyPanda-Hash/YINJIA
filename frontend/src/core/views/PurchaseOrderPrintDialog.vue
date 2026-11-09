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
          <el-radio-group v-model="fmt" size="small" @change="onFormatChange">
            <el-radio-button value="amount">{{ tt('有金额') }}</el-radio-button>
            <el-radio-button value="noamount">{{ tt('无金额') }}</el-radio-button>
          </el-radio-group>
        </span>
      </div>
      <!-- 这句话是口径本身,别删:用户最容易误解的就是"是不是改了订单数量" -->
      <div class="pup-tip">{{ tt('勾选要打印的明细行，并填写本次打印数量；只影响这张报表，不改动订单数据') }}</div>
      <!-- 超送上限(2026-11-09 用户口径:和材料码一样,已送/已打印/剩余可打都要有) -->
      <div class="pup-quota-tip">
        {{ tt('打印上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回 − 已打印（超送量按计量单位取整）') }}
        <span v-if="overRatioPct != null" class="pup-ratio">{{ tt('超送比例') }} {{ overRatioPct }}%</span>
      </div>

      <!-- 明细表:2026-11-09 用户口径「这个不能收缩,要全列出来」—— 不用固定 height(会截行/出内滚动条),
           改成 max-height:行少时全展开、行多才滚动 -->
      <el-table ref="tableRef" :data="rows" row-key="__key" border size="small" max-height="420"
        @selection-change="onPicked">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="行号" :label="tt('行号')" width="64" />
        <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="110" show-overflow-tooltip />
        <el-table-column prop="单位" :label="tt('单位')" width="56" />
        <el-table-column prop="数量" :label="tt('订单数量')" width="90" align="right" />
        <!-- 2026-11-09 用户口径「和材料码一样,这些都要有」:已送/已打印/剩余可打三列与材料码弹窗同口径 -->
        <el-table-column :label="tt('已送')" width="76" align="right">
          <template #default="{ row }">{{ rowText(row, '已送数量') }}</template>
        </el-table-column>
        <el-table-column :label="tt('已打印')" width="80" align="right">
          <template #default="{ row }">{{ rowText(row, '已打印数量') }}</template>
        </el-table-column>
        <el-table-column :label="tt('剩余可打')" width="96" align="right">
          <template #default="{ row }">{{ rowText(row, '剩余可打') }}</template>
        </el-table-column>
        <el-table-column :label="tt('本次打印数量')" width="132">
          <template #default="{ row }">
            <el-input-number v-model="qtyOf[row.__key]" :min="0" :max="capOf(row) ?? undefined"
              :precision="precisionOf(row)" :controls="false" style="width: 112px" @change="onQtyChange(row)" />
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
           2026-11-09 用户口径「这一行我想要点击可以看到明细」⇒ 点整行打开记录明细;
           同日再收紧(用户口径):**两个版式不要混在一起、独立开来** ——
             上框 = 对方版式已打印(可"打印成"本版式;打过后显示"已打印成…",不能再打);
             下框 = 本版式已打印(可重打/作废;作废后对方那张又能重新"打印成"本版式)。 -->
      <div class="pup-rec">
        <div class="pup-rec-title">
          {{ tt('已打印记录（本订单）') }}
          <span class="pup-tip">{{ tt('两个版式各自一块、各自登记：已打印只统计本版式，重打只累加次数，作废只作废这张纸') }}</span>
          <span class="pup-tip">{{ tt('点击记录行可查看明细') }}</span>
        </div>
        <!-- 下面两块**可以收缩**(2026-11-09 用户口径:上面明细不能收缩要全列出来,下面两个可以设置收缩) -->
        <el-collapse v-model="openRecPanels" class="pup-rec-collapse">
          <!-- ① 对方版式已打印 → 可打印成本版式(打完置灰,不能重复) -->
          <el-collapse-item name="other">
            <template #title>
              <span class="pup-rec-boxtitle">
                <span>{{ tt('其它版式已打印') }}（{{ tt(otherFmt) }}）</span>
                <span class="pup-rec-count">{{ otherRows.length }}</span>
                <span class="pup-rec-cur">{{ tt('可打印成') }}{{ tt(fmtLabel()) }}</span>
              </span>
            </template>
            <el-table :data="otherRows" border size="small" max-height="220" @row-click="openRecordDetail">
              <el-table-column prop="单据编号" :label="tt('打印单号')" min-width="132" />
              <el-table-column prop="对应单号" :label="tt('对应单号')" min-width="132" />
              <el-table-column :label="tt('金额合计')" width="88" align="right">
                <template #default="{ row }">{{ row['金额合计'] == null ? '' : moneyText(row['金额合计']) }}</template>
              </el-table-column>
              <el-table-column prop="数量合计" :label="tt('数量合计')" width="84" align="right" />
              <el-table-column prop="打印时间" :label="tt('打印时间')" width="140" />
              <el-table-column :label="tt('操作')" width="170" align="center">
                <template #default="{ row }">
                  <!-- 已经对应打印成本版式 → 置灰,不能再打;作废本版式那张后会自动恢复可点 -->
                  <el-button link type="primary" :disabled="busy || row.__converted" @click.stop="doTwin(row)">
                    {{ row.__converted ? `${tt('已打印成')}${tt(fmtLabel())}` : `${tt('打印成')}${tt(fmtLabel())}` }}
                  </el-button>
                </template>
              </el-table-column>
              <template #empty>{{ tt('该版式还没有打印记录') }}</template>
            </el-table>
          </el-collapse-item>

          <!-- ② 本版式已打印 → 重打 / 作废 -->
          <el-collapse-item name="own" class="pup-rec-own">
            <template #title>
              <span class="pup-rec-boxtitle">
                <span>{{ tt('本版式已打印') }}（{{ tt(fmtLabel()) }}）</span>
                <span class="pup-rec-count">{{ ownRows.length }}</span>
                <span class="pup-rec-cur">{{ tt('当前版式') }}</span>
              </span>
            </template>
            <el-table :data="ownRows" border size="small" max-height="220" @row-click="openRecordDetail">
              <el-table-column prop="单据编号" :label="tt('打印单号')" min-width="132" />
              <el-table-column prop="对应单号" :label="tt('对应单号')" min-width="132" />
              <el-table-column :label="tt('金额合计')" width="88" align="right">
                <template #default="{ row }">{{ row['金额合计'] == null ? '' : moneyText(row['金额合计']) }}</template>
              </el-table-column>
              <el-table-column prop="数量合计" :label="tt('数量合计')" width="84" align="right" />
              <el-table-column prop="打印时间" :label="tt('打印时间')" width="140" />
              <el-table-column :label="tt('操作')" width="140" align="center">
                <template #default="{ row }">
                  <!-- 重打 = 同一张记录原样再打一遍(纸卡了/打歪了):只累加打印次数,不新增记录 -->
                  <el-button link type="primary" :disabled="busy" @click.stop="doReprint(row)">{{ tt('重打') }}</el-button>
                  <!-- 作废 = 这张纸作废;对方那张的「对应单号」会被清掉 ⇒ 对方又能打印成本版式 -->
                  <el-button link type="danger" :disabled="busy" @click.stop="doVoid(row)">{{ tt('作废') }}</el-button>
                </template>
              </el-table-column>
              <template #empty>{{ tt('该版式还没有打印记录') }}</template>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
    <template #footer>
      <el-button @click="fillOrderQty">{{ tt('按剩余可打填充') }}</el-button>
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
/** 宽表(带金额 13 列,含 已送/已打印/剩余可打)按 1460px 排;小屏退回 96vw */
const dlgWidth = 'min(1460px, 96vw)'
const tableRef = ref(null)
const picked = ref([])
/** 下面两个「已打印记录」框的展开状态(可收缩;默认只展开本版式那块) */
const openRecPanels = ref(['own'])
/** 行键 → 本次打印数量(键由 keyOf 生成) */
const qtyOf = reactive({})
/** 采购订单行id → { 可打印上限, 小数位数 }(2026-11-09:打印数量按超送+单位精度封顶) */
const quotaOf = ref({})
/** 超送比例(百分数,来自系统参数 receive_over_ratio;取不到时 null) */
const overRatioPct = ref(null)
/** 本订单的打印记录(服务端落库快照;弹窗底部两个独立框) */
const records = ref([])
/**
 * 记录区(2026-11-09 用户口径):
 *   「有金额的,下面有一个框可以显示无金额的已打印,然后可以对这个无金额的已打印,打印成有金额的,
 *     然后就显示已经对应打印成有金额的,不能再打印了;再下面有一个框显示有金额的,可以重打或者作废,
 *     作废后可以重新打印已经记录的无金额的;有金额和无金额不要混在一起,独立开来」
 * ⇒ 上框 = 对方版式已打印(可打印成本版式),下框 = 本版式已打印(重打/作废)。
 */
const otherFmt = computed(() => (showAmount.value ? '无金额' : '有金额'))
/** 存活记录单号集合:判断"对方那张是否已经打印成本版式" */
const liveNos = computed(() => new Set(records.value.map((r) => String(r['单据编号']))))
const otherRows = computed(() => records.value
  .filter((r) => String(r['打印版式']) === otherFmt.value)
  .map((r) => ({ ...r, __converted: !!r['对应单号'] && liveNos.value.has(String(r['对应单号'])) })))
const ownRows = computed(() => records.value.filter((r) => String(r['打印版式']) === fmtLabel()))

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
/** 当前打印版式(服务端口径:有金额/无金额) */
const fmtLabel = () => (showAmount.value ? '有金额' : '无金额')
/** 该行的「剩余可打」(服务端已按单位精度取整:订单×(1+比例)−已送+已退回−已打印);没取到 → null */
function capOf(row) {
  const q = quotaOf.value[String(row?.id)]
  return q ? Number(q['剩余可打']) : null
}
/** 额度列文字(已送/已打印/剩余可打):按服务端给的数显示,取不到留空 */
function rowText(row, field) {
  const q = quotaOf.value[String(row?.id)]
  if (!q || q[field] === undefined || q[field] === null) return ''
  return qtyText(q[field])
}
/** 该行数量输入精度 = 单位小数位数(个/卷=0、kg/米=3) */
function precisionOf(row) {
  const q = quotaOf.value[String(row?.id)]
  const n = Number(q?.['小数位数'])
  return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.trunc(n))) : 2
}
/** 数量改完:按单位精度向下取整,再夹到可打印上限(与服务端同一方向) */
function onQtyChange(row) {
  const key = row?.__key
  const v = Number(qtyOf[key])
  if (!Number.isFinite(v)) return
  const nd = precisionOf(row)
  const p = Math.pow(10, nd)
  let f = Math.floor(v * p + 1e-9) / p
  const cap = capOf(row)
  if (cap != null && f > cap) f = cap
  if (f !== v) qtyOf[key] = f
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
  quotaOf.value = {}
  overRatioPct.value = null
  Object.keys(qtyOf).forEach((k) => delete qtyOf[k])
  try {
    // 额度与单据**并发**取,但额度先落地再渲染明细:
    // el-input-number 的 precision 只在首渲染时定形,若先渲染(精度缺省 2)再改 prop,
    // 计件单位会一直显示 3000.00(实测)。
    const [res, quota] = await Promise.all([
      engine.getFormDescriptor({ panelCode: props.panelCode, code: props.docNo }),
      engine.puPrintQuotas(props.docNo, fmtLabel()).catch((e) => {
        console.warn('[pu-print] 打印额度加载失败:', e?.message || e)
        return null
      }),
    ])
    if (quota) {
      const m = {}
      for (const r of quota['lines'] || []) m[String(r['采购订单行id'])] = r
      quotaOf.value = m
      const pct = Number(quota['超送比例'])
      overRatioPct.value = Number.isFinite(pct) ? Math.round(pct * 100) : null
    }
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
      // 2026-11-09 用户口径「和材料码一样」:默认填「剩余可打」(订单×(1+超送)−已送+已退回−已打印),
      // 取不到额度时退回订单数量,不让弹窗空着。
      const remain = quotaOf.value[String(l.id)]?.['剩余可打']
      const v = remain != null ? Number(remain) : Number(l['数量'])
      qtyOf[keyOf(l, i)] = Number.isFinite(v) ? v : undefined
    })
    // 打印额度已在上面的 Promise.all 里取到并先行落地(见注释:precision 要赶在首渲染前)
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

/**
 * 切换打印版式(2026-11-09 用户口径「有金额和无金额切换打印同一个不一样,不要有版本限制」):
 * 两个版式是两张不同的纸,额度**各打各的** —— 切过去重取该版式的剩余可打,并把本次打印数量复位成它,
 * 这样同一张订单可以先打有金额、再打无金额,互不吃额度。
 */
async function onFormatChange() {
  if (!props.docNo) return
  try {
    const q = await engine.puPrintQuotas(props.docNo, fmtLabel())
    const m = {}
    for (const r of q?.['lines'] || []) m[String(r['采购订单行id'])] = r
    quotaOf.value = m
    const pct = Number(q?.['超送比例'])
    if (Number.isFinite(pct)) overRatioPct.value = Math.round(pct * 100)
    for (const r of rows.value) {
      const remain = m[String(r.id)]?.['剩余可打']
      const v = remain != null ? Number(remain) : Number(r['数量'])
      qtyOf[r.__key] = Number.isFinite(v) ? v : undefined
    }
  } catch (e) {
    console.warn('[pu-print] 切换版式后额度加载失败:', e?.message || e)
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
/** 数量回填成「剩余可打」**并全选**(复位动作;取不到额度时退回订单数量) */
function fillOrderQty() {
  for (const r of rows.value) {
    const remain = quotaOf.value[String(r.id)]?.['剩余可打']
    const v = remain != null ? Number(remain) : Number(r['数量'])
    qtyOf[r.__key] = Number.isFinite(v) ? v : undefined
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
  // 超送上限(2026-11-09):本次打印数量 ≤ 订单数量 ×(1+超送比例);后端会再校验一遍
  const over = picked.value.filter((r) => {
    const cap = capOf(r)
    return cap != null && Number(qtyOf[r.__key]) > cap + 1e-9
  })
  if (over.length) {
    const r = over[0]
    const cap = capOf(r)
    return ElMessage.warning(`${tt('本次打印数量超出可打印上限')} ${qtyText(cap)}（${tt('订单数量 ×（1 + 超送比例）')}）`
      + ` · ${tt('行号')} ${r['行号'] ?? ''}`)
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

/**
 * 对着另一版式打印(2026-11-09 用户口径「可以相互对着打印」):
 * 按这张记录的行/数量,让服务端用**另一个版式**落一张新记录(额度按目标版式自己的剩余可打校验),
 * 两张纸的「对应单号」互相写上;这里负责把返回的纸打出来。
 */
async function doTwin(row) {
  busy.value = true
  try {
    const res = await engine.puPrintTwin(row['单据编号'])
    if (!res || !res['单据编号']) throw new Error(tt('打印记录不存在或已作废'))
    const printRows = res['lines'] || []
    const printFn = res['打印版式'] === '无金额' ? engine.printPuOrderNoAmount : engine.printPuOrder
    let afterPrint = null
    let printDone = false
    const ok = printFn(doc.value, printRows, {
      onDone: () => { printDone = true; if (afterPrint) afterPrint() },
    })
    if (!ok) {
      try { await engine.puPrintVoid(res['单据编号']) } catch { /* 撤销失败不改主流程提示 */ }
      ElMessage.error(tt('打印失败'))
      return
    }
    ElMessage.success(`${tt('已对着打印')} ${res['单据编号']}（${tt(res['打印版式'])}）`)
    afterPrint = () => { loadRecords(); onFormatChange() }
    if (printDone || !document.getElementById('yj-print-host')) afterPrint()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('对着打印失败'))
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
.pup-quota-tip { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #8a6d3b; background: #fdf6e3; border: 1px dashed #f5e3b3; border-radius: 4px; padding: 3px 8px; }
.pup-ratio { color: #1f6f4a; font-weight: 600; }
.pup-foot { display: flex; justify-content: flex-end; align-items: center; font-size: 12.5px; color: #46586e; }
/* 已打印记录:与上方勾选表隔一道浅线,说明用途 */
.pup-rec { margin-top: 4px; padding-top: 6px; border-top: 1px dashed #dde5ee; display: flex; flex-direction: column; gap: 4px; }
/* 两个版式上下两块、可收缩(2026-11-09):上=对方版式(可打成本版式),下=本版式(重打/作废) */
.pup-rec-collapse { border-top: none; border-bottom: none; }
.pup-rec-collapse :deep(.el-collapse-item__header) { height: 34px; line-height: 34px; padding-left: 6px; border-bottom: 1px solid #e3e9f0; }
.pup-rec-collapse :deep(.el-collapse-item__content) { padding: 6px 0 8px; }
.pup-rec-collapse .pup-rec-own :deep(.el-collapse-item__header) { color: #1f6f4a; font-weight: 600; }
.pup-rec-boxtitle { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: inherit; }
.pup-rec-count { min-width: 18px; padding: 0 5px; border-radius: 9px; background: #eef3f8; color: #5b6b7f; font-size: 11.5px; line-height: 18px; text-align: center; }
.pup-rec-cur { color: #1f6f4a; font-size: 11.5px; font-weight: 600; }
.pup-rec-collapse :deep(.el-table__row) { cursor: pointer; }
.pup-rec-collapse :deep(.el-table__row:hover > td) { background: #eef6ff !important; }
.pup-rec-title { font-size: 12.5px; color: #46586e; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.pup-rec-title .pup-tip { background: none; border: none; padding: 0; }
/* 记录行可点击看明细:鼠标手型 + 悬停高亮提示(行内的重打/作废按钮已 @click.stop) */
.pup-rec-table :deep(.el-table__row) { cursor: pointer; }
.pup-rec-table :deep(.el-table__row:hover > td) { background: #eef6ff !important; }
/* 记录明细弹窗 */
.pup-detail { display: flex; flex-direction: column; gap: 8px; }
</style>
