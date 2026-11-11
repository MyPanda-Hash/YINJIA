<template>
  <!-- 打印材料码(2026-10-04 用户口径「在打印材料的时候弹出一个弹窗,可以填写打印的批次号(按之前的格式预填)
       与勾选需要打印的行号和他的数量」):
        批次号默认 = **当天日期 yyyyMMdd**(服务端算,与生单同一公式;2026-10-19 用户口径:
        改回纯日期,不再拼供应商编码),**可改**;
        勾行 + 填本次打印数量(上限 = 该行头寸 − 其它打印记录已预约的量);
        ⚠ **一次只打一行**(追加口径「打印需要是每次一行,不能多行否则作废就全部作废了」):
        选行用**单选**、一次一张打印单 ⇒ 作废只影响这一行;要打第二行就再打开一次弹窗。
        确定后**先落库登记**再出纸 —— 这张纸上的批次号从此成为该订单上批次号的权威值,
        生单对话框里它会是**独立的一行**（数量已从原行切走），勾它即按这个号生单。
       底部「已打印记录」是反查入口(用户不要新加面板,故放在这张弹窗里),可就地**作废**或**重打**。 -->
  <el-dialog
    :model-value="modelValue"
    :title="tt('打印材料码') + (orderNo ? ' · ' + orderNo : '')"
    :width="dlgWidth"
    top="3vh"
    class="mlq-dlg"
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
            :placeholder="tt('生单时按当天日期生成')" />
          <el-button v-if="batchNo !== (data.prefBatchNo || '')" link type="primary" size="small"
            @click="batchNo = data.prefBatchNo">{{ tt('恢复默认') }}</el-button>
        </span>
        <!-- 生产日期(2026-10-23 用户口径「在批次号后面加个生产日期,进行填写,填写后可以打印的材料码会加上生产日期」):
             紧跟在批次号右边;填了就会登记到这张打印单上,出纸时印到材料码「生产日期」栏(不填则该栏留空白手填) -->
        <span class="mlq-chip mlq-batch">
          {{ tt('生产日期') }}:
          <el-date-picker v-model="prodDate" type="date" size="small" class="mlq-prod-inp" clearable
            value-format="YYYY-MM-DD" :placeholder="tt('选择日期')" />
        </span>
        <span class="mlq-chip mlq-tip">{{ tt('打印上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回 − 已打印未生单（超送量按计量单位取整）') }}</span>
      </div>

      <!-- 一次可以勾**多行**,但服务端会**每行各出一张打印单**(用户口径「作废不希望连坐」+
           追加「一次是可以打印多行的」)—— 多行并进一张单会让作废连坐,所以粒度落在单上,不在弹窗上 -->
      <div class="mlq-oneline">{{ tt('可一次勾选多行；每行各自出一张打印单（作废只影响对应那一行）') }}</div>
      <!-- 每箱数量(2026-11-11 用户口径「材料码多加一个每箱数量打印,每箱数量才等于标识卡上的数量」):
           标识卡卡面「数量」印的是**每箱数量**(一箱一张卡);本次打印数量仍按整批记账;
           打几张卡在打印预览里设份数 —— 故这里只提示口径,不自动拆成 N 张 -->
      <div class="mlq-oneline">{{ tt('标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数') }}</div>
      <!-- 按采购订单打印记录带入后:数量/行锁定,只能改批次号与生产日期(2026-11-09 用户口径);
           「取消带入」放在记录表的操作列(用户口径:取消按钮直接在操作那里) -->
      <div v-if="lockedBySource" class="mlq-lock">
        {{ tt('已按采购订单打印记录带入：数量和行已锁定，只能修改上面的批次号和生产日期') }}
        <span class="mlq-lock-no">{{ sourcePrintNo }}</span>
      </div>

      <el-table ref="tableRef" :data="rows" row-key="id" border size="small" :height="tableHeight" @selection-change="onPicked">
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
              :disabled="lockedBySource || !(capOf(row) > 0)" :precision="precisionOf(row)" style="width: 130px" />
          </template>
        </el-table-column>
        <!-- 每箱数量(2026-11-11):卡面「数量」印它;不填(0)=按本次打印数量印(旧行为) -->
        <el-table-column :label="tt('每箱数量')" width="150">
          <template #default="{ row }">
            <el-input-number v-model="boxOf[row.id]" :min="0" :max="Number(qtyOf[row.id] || 0)" :controls="false"
              :disabled="lockedBySource || !(Number(qtyOf[row.id] || 0) > 0)" :precision="precisionOf(row)"
              :placeholder="tt('不填按本次打印数量')" style="width: 130px" />
          </template>
        </el-table-column>
        <el-table-column prop="计量单位" :label="tt('计量单位')" width="85" />
      </el-table>

      <div class="mlq-foot">
        <span>{{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b>
          <span v-if="picked.length > 1" class="mlq-tip">（{{ tt('将生成') }} {{ picked.length }} {{ tt('张打印单') }}）</span>
        </span>
      </div>

      <!-- 整箱 / 零头箱提示(2026-11-11 用户口径「按每箱数量打印,并且给他提示零头箱数量不足每箱,
           可以单独打印零头箱相关数量」):只提示,不拦打印 —— 卡面仍按每箱数量出,零头由用户自己再打一张 -->
      <div v-if="boxHints.length" class="mlq-box-hint">
        <span v-for="(h, i) in boxHints" :key="i" class="mlq-box-line">{{ h }}</span>
      </div>

      <!-- 下层三块(2026-11-09 用户口径「下方会出现 3 个框,要求这 3 个框可以收缩,不要太冗杂」):
           ① 已生单可补打 ② 材料码已打印记录 ③ 采购订单打印记录(可据此打材料码)。
           默认全部收起,标题带条数,点开才展开;表格都留在 DOM 里(选行/ref 不受收缩影响)。 -->
      <el-collapse v-model="openPanels" class="mlq-collapse">
        <el-collapse-item v-if="suppRows.length" name="supp">
          <template #title>
            <span class="mlq-coll-title">{{ tt('已生单可补打（已经收了的量还没打码）') }}</span>
            <span class="mlq-coll-count">{{ suppRows.length }}</span>
          </template>
          <div class="mlq-tip mlq-coll-tip">
            {{ tt('补打只为留痕：不占用余量、不会在生单弹窗里多出一行；批次号取该批货单据上的号，不可改') }}
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
                  :controls="false" :disabled="lockedBySource || !(Number(row['可补登数量'] || 0) > 0)"
                  :precision="precisionOf(row)" style="width: 130px" />
              </template>
            </el-table-column>
            <!-- 补登行同样要印卡(2026-11-11):卡面数量也按每箱数量 -->
            <el-table-column :label="tt('每箱数量')" width="150">
              <template #default="{ row }">
                <el-input-number v-model="suppBox[row.suppKey]" :min="0" :max="Number(suppQty[row.suppKey] || 0)"
                  :controls="false" :disabled="lockedBySource || !(Number(suppQty[row.suppKey] || 0) > 0)"
                  :precision="precisionOf(row)" :placeholder="tt('不填按本次打印数量')" style="width: 130px" />
              </template>
            </el-table-column>
          </el-table>
        </el-collapse-item>

        <el-collapse-item name="records">
          <template #title>
            <span class="mlq-coll-title">{{ tt('已打印记录（本订单）') }}</span>
            <span class="mlq-coll-count">{{ (data.records || []).length }}</span>
          </template>
          <el-table :data="data.records || []" border size="small" max-height="200">
            <el-table-column prop="批次号" :label="tt('批次号')" min-width="160" />
            <el-table-column prop="生产日期" :label="tt('生产日期')" width="110" />
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
                <el-button link type="primary" :disabled="busy" @click="doReprint(row)">{{ tt('重打') }}</el-button>
                <el-button link type="danger" :disabled="busy" @click="doVoid(row)">{{ tt('作废') }}</el-button>
              </template>
            </el-table-column>
            <template #empty>{{ tt('该订单还没有打印过材料码') }}</template>
          </el-table>
        </el-collapse-item>

        <!-- 2026-11-09 用户口径「在打印材料码那里要可以看见对相关打印采购订单,也可以针对已经打印的采购订单打印材料码」 -->
        <el-collapse-item name="poPrints">
          <template #title>
            <span class="mlq-coll-title">{{ tt('打印采购订单记录（可据此打材料码）') }}</span>
            <span class="mlq-coll-count">{{ poPrints.length }}</span>
          </template>
          <div class="mlq-tip mlq-coll-tip">
            {{ tt('点「按这次打印打码」把这次采购订单纸上的数量带入上面各行的本次打印数量（取该版式的剩余可打封顶）') }}
          </div>
          <el-table :data="poPrints" border size="small" max-height="200" row-key="单据编号">
            <el-table-column prop="单据编号" :label="tt('打印单号')" min-width="150" />
            <el-table-column :label="tt('打印版式')" width="96" align="center">
              <template #default="{ row }">{{ tt(row['打印版式']) }}</template>
            </el-table-column>
            <el-table-column prop="行数" :label="tt('行数')" width="70" align="right" />
            <el-table-column prop="数量合计" :label="tt('数量合计')" width="96" align="right" />
            <el-table-column prop="金额合计" :label="tt('金额合计')" width="96" align="right" />
            <el-table-column prop="打印人" :label="tt('打印人')" width="96" />
            <el-table-column prop="打印时间" :label="tt('打印时间')" width="150" />
            <el-table-column prop="打印次数" :label="tt('打印次数')" width="85" align="right" />
            <el-table-column :label="tt('操作')" width="150" align="center">
              <template #default="{ row }">
                <!-- 已带入的那张记录:操作列直接变「取消带入」(2026-11-09 用户口径:取消按钮直接在操作那里) -->
                <el-button v-if="sourcePrintNo === String(row['单据编号'])" link type="danger" :disabled="busy"
                  @click="cancelSource">{{ tt('取消带入') }}</el-button>
                <!-- 2026-11-09 用户口径:按这张记录打过一次后按钮置灰,不能重复打 -->
                <el-button v-else link type="primary" :disabled="busy || lockedBySource || isUsedSrc(row['单据编号'])"
                  @click="applyPoPrint(row)">
                  {{ isUsedSrc(row['单据编号']) ? tt('已打码') : tt('按这次打印打码') }}
                </el-button>
              </template>
            </el-table-column>
            <template #empty>{{ tt('该订单还没有打印过采购订单') }}</template>
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </div>
    <template #footer>
      <el-button :disabled="lockedBySource" @click="fillRemaining">{{ tt('按剩余量填充') }}</el-button>
      <el-button :disabled="lockedBySource" @click="clearAll">{{ tt('清空') }}</el-button>
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
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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

/**
 * 弹窗尺寸(2026-11-11 用户口径「弹窗需要尽量大,减少左右横拉」):
 * 原来写死 1000px,而这张表已经有 11 列(加「每箱数量」后 12 列)⇒ 首屏就出横向滚动条。
 * 改成**跟屏幕走**:宽度 min(1560px, 96vw),表格高度随窗口高算(减去弹窗头/工具栏/提示/页脚),
 * 大屏一次看全,小屏也留得住纵向滚动,不再左右横拉。
 */
const dlgWidth = 'min(1560px, 96vw)'
/**
 * 明细表高度:① 窗口高 − 弹窗占位(3vh 顶距 + 标题 + 工具栏 2 行 + 表头 + 合计/提示 + 折叠标题 + 页脚);
 * ② 再按行数收口 —— 只有 1 行时不要留一大片空白(与采购订单打印弹窗同款自适应)。
 */
const winH = ref(typeof window !== 'undefined' ? window.innerHeight : 900)
const tableHeight = computed(() => {
  const capacity = Math.max(220, Math.min(620, (winH.value || 900) - 380))
  const needed = 42 + rows.value.length * 42
  return Math.max(120, Math.min(capacity, needed))
})
const onWinResize = () => { winH.value = window.innerHeight || 900 }
onMounted(() => {
  onWinResize()
  window.addEventListener('resize', onWinResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onWinResize))

const loading = ref(false)
const busy = ref(false)
const data = ref({})
const head = computed(() => data.value || {})
const rows = computed(() => data.value.lines || [])
const batchNo = ref('')
/** 生产日期(2026-10-23):批次号旁边填,`YYYY-MM-DD`(**不是** Date 对象,el-date-picker 用 value-format 直接给串);
 *  默认空 —— 生产日期是事实,系统不猜;空则卡面该栏留空白手填线(与原行为一致) */
const prodDate = ref('')
const tableRef = ref(null)
/** **多选**:本次要打的行(勾选是权威;服务端会按**每行一张单**落库) */
const picked = ref([])
const qtyOf = reactive({})
/**
 * 行键 → 每箱数量(2026-11-11 用户口径「每箱数量才等于标识卡上的数量」)。
 * 0 / 空 = 未填 ⇒ 卡面「数量」回退印本次打印数量(与旧版一致,历史行也会落在这一支)。
 */
const boxOf = reactive({})
/** 下层三块(已生单可补打 / 材料码已打印记录 / 打印采购订单记录)默认全收起 —— 2026-11-09 用户口径「可收缩,不要太冗杂」 */
const openPanels = ref([])
/** 本订单的「打印采购订单」记录(2026-11-09:可看见、并能据此打材料码) */
const poPrints = ref([])
/** 本次是从哪张「有金额」采购订单打印记录带出来的(空=不是按记录打) */
const sourcePrintNo = ref('')
/** 已打过材料码的打印记录(服务端下发;界面据此置灰,不能重复打) */
const usedSrcSet = computed(() => new Set((data.value['已打码打印单'] || []).map(String)))
/**
 * 本窗口里刚打完的来源记录(2026-11-09「只可以对应打印一次」):服务端已落库,
 * 但重载是异步的 —— 先在本地算已用,按钮立刻置灰,不给"连点两次"的窗口。
 */
const usedLocal = ref([])
const isUsedSrc = (no) => usedSrcSet.value.has(String(no)) || usedLocal.value.includes(String(no))
/**
 * 是否已按「采购订单打印记录」带入(2026-11-09 用户口径:
 * 点击按这次打印打码后,不能改变数量和行号,只可以写上面的批次号和生产日期) ⇒ 锁定表格。
 */
const lockedBySource = computed(() => !!sourcePrintNo.value)
/** 取消带入:解除锁定(数量/行恢复可改),来源清空,已勾选与数量保持当前值由用户自行调整 */
function cancelSource() {
  sourcePrintNo.value = ''
}

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
/** 行号(给零头箱提示定位用;补登行也按采购订单行id 反查同一张表的行号) */
function lineNoOf(lineId) {
  const hit = rows.value.find((r) => Number(r.id) === Number(lineId))
  return hit ? hit['行号'] : ''
}
/** 整箱数 = ⌊本次打印 ÷ 每箱⌋(**向下**取整:不满一箱的算零头,不四舍五入) */
function fullBoxes(qty, box) {
  if (!(box > 0)) return 0
  return Math.floor(qty / box + 1e-9)
}
/** 零头箱里的数量(不足一箱的余数;0 = 正好整箱) */
function remainderQty(qty, box) {
  const b = fullBoxes(qty, box)
  return Math.round((qty - b * box) * 10000) / 10000
}
/**
 * 整箱/零头箱提示文案(2026-11-11 用户口径「按每箱数量打印,并且给他提示零头箱数量不足每箱,
 * 可以单独打印零头箱相关数量」)。只提示,不拦打印。
 */
function boxHintText(lineNo, qty, box) {
  const boxes = fullBoxes(qty, box)
  const rem = remainderQty(qty, box)
  const head = `${tt('行号')} ${lineNo ?? ''}：${tt('每箱')} ${box} ⇒ `
  return rem > 0
    ? `${head}${tt('整箱')} ${boxes} × ${box}，${tt('零头箱')} ${rem} ${tt('不足每箱（可单独打印零头箱）')}`
    : `${head}${tt('整箱')} ${boxes} × ${box}`
}
/** 当前勾选行的整箱/零头提示(没填每箱数量的行不提示) */
const boxHints = computed(() => {
  const out = []
  for (const r of rows.value) {
    if (!pickedKeys.value.has(r.id)) continue
    const qty = Number(qtyOf[r.id] || 0) || 0
    const box = Number(boxOf[r.id] || 0) || 0
    if (qty > 0 && box > 0) out.push(boxHintText(r['行号'], qty, box))
  }
  for (const r of suppPicked.value) {
    const qty = Number(suppQty[r.suppKey] || 0) || 0
    const box = Number(suppBox[r.suppKey] || 0) || 0
    if (qty > 0 && box > 0) out.push(boxHintText(r['行号'], qty, box))
  }
  return out
})
/** 该行输入框精度 = 单位小数位数(2026-11-09:计件单位 0 位、kg/米 3 位;服务端逐行下发) */
function precisionOf(row) {
  const n = Number(row?.小数位数)
  return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.trunc(n))) : 2
}
/** 有可打量才让勾(打满的行不给勾);按打印记录带入后**行锁定**,一律不许改勾选 */
function rowSelectable(row) {
  return !lockedBySource.value && capOf(row) > 0
}

/* ── 下层「已生单可补打」:已收但还没打码的量(按 订单行 × 已生单批次号 一行) ── */
const suppRef = ref(null)
const suppPicked = ref([])
const suppQty = reactive({})
/** 补登行的每箱数量(键同上):补登也要印卡,卡面数量同样取每箱数量 */
const suppBox = reactive({})
/** 补登行的唯一键(行id + 批次号;批次号里可能有特殊字符,故用 \u0001 拼) */
const suppKeyOf = (row) => `${row['采购订单行id']}\u0001${row['批次号']}`
const suppRows = computed(() => (data.value['补登行'] || []).map((r) => ({ ...r, suppKey: suppKeyOf(r) })))
function suppSelectable(row) {
  // 按打印记录带入后,补登行也不许再勾(数量/行都锁定)
  return !lockedBySource.value && Number(row['可补登数量'] || 0) > 0
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
    // 服务端已回「已打码打印单」⇒ 本地临时标记清空(作废后可重新用,以服务端为准)
    usedLocal.value = []
    batchNo.value = String(data.value?.prefBatchNo || '')
    // 生产日期:取服务端回的可选预填(目前恒空,不猜),每次开窗重置,避免沿用上次的值
    prodDate.value = String(data.value?.['生产日期'] || '')
    Object.keys(qtyOf).forEach((k) => delete qtyOf[k])
    Object.keys(boxOf).forEach((k) => delete boxOf[k])
    for (const r of rows.value) {
      qtyOf[r.id] = capOf(r) > 0 ? capOf(r) : 0
      // 每箱数量:服务端回的是"该行最近一次打印填过的值"(0=从没填过 ⇒ 留空(null 才显示占位词),
      // 出纸回退本次打印数量)
      boxOf[r.id] = Number(r['每箱数量'] || 0) > 0 ? Number(r['每箱数量']) : null
    }
    // 下层补登:数量与勾选每次都清空(默认不勾 —— 补登是"事后补打",必须显式选)
    Object.keys(suppQty).forEach((k) => delete suppQty[k])
    Object.keys(suppBox).forEach((k) => delete suppBox[k])
    suppPicked.value = []
    for (const r of suppRows.value) {
      suppQty[r.suppKey] = 0
      suppBox[r.suppKey] = Number(r['每箱数量'] || 0) > 0 ? Number(r['每箱数量']) : null
    }
    // 默认勾上**所有有可打量**的行(与分批送料对话框同款便利,勾选仍是权威)
    await Promise.resolve()
    syncPick(rows.value.filter((r) => capOf(r) > 0).map((r) => r.id))
    await nextTick()
    suppRef.value?.clearSelection()
    // 采购订单打印记录(2026-11-09):失败不影响打码主体,只是少一块参考
    engine.puPrintRecords(props.orderNo)
      .then((list) => {
        // 只要「有金额」的记录(用户口径:而且只要记录有金额);无金额版不参与带出材料码
        poPrints.value = (list || []).filter((r) => String(r['打印版式']) === '有金额')
        sourcePrintNo.value = ''
      })
      .catch(() => { poPrints.value = [] })
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
  // 清空数量时「每箱数量」一并归零(否则 max=0 的输入框会留着上次的残值,看着像没清干净)
  for (const r of rows.value) {
    qtyOf[r.id] = 0
    boxOf[r.id] = null
  }
  syncPick([])
}

/**
 * 按某次「打印采购订单」记录打材料码(2026-11-09 用户口径):
 * 把那次纸上的每行打印数量带入上面各行的「本次打印数量」并勾上,封顶仍取该行剩余可打。
 */
async function applyPoPrint(row) {
  const no = row?.['单据编号']
  if (!no) return
  busy.value = true
  try {
    const res = await engine.puPrintDetail(no)
    const byLine = new Map()
    for (const l of res?.lines || []) {
      const id = Number(l['采购订单行id'])
      // 打印记录明细里这一列叫「数量」(= 打印数量,见服务端 detail());兼容旧键
      if (id) byLine.set(id, Number(l['数量'] ?? l['打印数量']) || 0)
    }
    const ids = []
    for (const r of rows.value) {
      const q = byLine.get(Number(r.id))
      if (q == null) continue
      const cap = capOf(r)
      const v = cap > 0 ? Math.min(q, cap) : 0
      qtyOf[r.id] = v
      if (v > 0) ids.push(r.id)
    }
    if (!ids.length) {
      ElMessage.warning(tt('这次打印的明细在这张订单里没有可打的量'))
      return
    }
    syncPick(ids)
    sourcePrintNo.value = no     // 记下来源:打印时带给服务端,打过一次就不能再用这张记录
    // 带入后数量/行锁定(2026-11-09):补登区一并清空并锁住,只留批次号/生产日期可改
    suppPicked.value = []
    for (const k of Object.keys(suppQty)) suppQty[k] = 0
    suppRef.value?.clearSelection()
    const clamped = rows.value.some((r) => {
      const q = byLine.get(Number(r.id))
      return q != null && q > capOf(r)
    })
    ElMessage.success(`${tt('已按')} ${no} ${tt('带入打印数量')}${clamped ? tt('（超出剩余可打的已按上限收口）') : ''}`)
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印记录明细加载失败'))
  } finally {
    busy.value = false
  }
}

/** 出纸:纸上的号 = 库里的号(先落库再打印);生产日期取**服务端回读的单头值**(不取输入框 ——
 *  人工填了又没落库的话,纸上印的就是"系统里没有的日期",返查对不上)
 *
 *  **卡面「数量」= 每箱数量**(2026-11-11 用户口径「每箱数量才等于标识卡上的数量」):
 *  一箱一张卡,贴到箱子上那个数必须是这一箱装的量,而不是整批的本次打印数量;
 *  没填每箱数量(0/NULL,含本需求之前的历史单)才回退印本次打印数量,与旧版纸一致。 */
function cardsOf(res) {
  const date = res['生产日期'] || ''
  return (res?.lines || []).map((l) => {
    const box = Number(l['每箱数量'] || 0) || 0
    return {
      编码: l['物料编码'],
      规格: l['规格型号'] || '',
      数量: box > 0 ? box : l['打印数量'],
      批次: res['批次号'],
      订单编号: props.orderNo,
      供应商名称: head.value['供应商'] || '',
      生产日期: date,
    }
  })
}

async function confirm() {
  const lines = rows.value
    .filter((r) => pickedKeys.value.has(r.id) && Number(qtyOf[r.id] || 0) > 0)
    .map((r) => {
      const box = Number(boxOf[r.id] || 0) || 0
      // 每箱数量:> 0 才带(0/空 = 不按箱,卡面回退本次打印数量);服务端会再校验它 ≤ 本次打印数量
      return { 采购订单行id: r.id, 打印数量: Number(qtyOf[r.id]), ...(box > 0 ? { 每箱数量: box } : {}) }
    })
  // 下层补登行:各自带自己的批次号(该批货单据上的号),标记 补登=true
  const supLines = suppPicked.value
    .filter((r) => Number(suppQty[r.suppKey] || 0) > 0)
    .map((r) => {
      const box = Number(suppBox[r.suppKey] || 0) || 0
      return {
        采购订单行id: r['采购订单行id'], 打印数量: Number(suppQty[r.suppKey]),
        批次号: String(r['批次号'] || ''), 补登: true,
        ...(box > 0 ? { 每箱数量: box } : {}),
      }
    })
  const all = [...lines, ...supLines]
  if (!all.length) { ElMessage.warning(tt('请至少勾选一行并填写本次打印数量')); return }
  // 上层走顶部批次号(未生单的码,公式号/人工号);只勾下层补登行时不需要顶部号
  if (lines.length && isEmpty(batchNo.value)) { ElMessage.warning(tt('请填写批次号')); return }
  // 零头箱提醒(2026-11-11 用户口径「给他提示零头箱数量不足每箱,可以单独打印零头箱相关数量」):
  // **只提示不拦** —— 整箱照常打,零头另打一张;提示完继续走打印
  const odd = all
    .map((l) => ({ lineNo: lineNoOf(l['采购订单行id']), qty: Number(l['打印数量']) || 0, box: Number(l['每箱数量']) || 0 }))
    .filter((x) => x.box > 0 && remainderQty(x.qty, x.box) > 0)
  if (odd.length) {
    ElMessage({
      type: 'warning',
      duration: 6000,
      message: `${tt('有零头箱：整批不是每箱数量的整数倍，零头箱数量不足每箱，可单独打印零头箱数量')} —— `
        + odd.map((x) => `${tt('行号')} ${x.lineNo}：${tt('零头箱')} ${remainderQty(x.qty, x.box)}`).join('；'),
    })
  }
  busy.value = true
  try {
    // 可以一次勾多行:服务端**每行各出一张打印单**(作废因此只影响对应那一行)
    const res = await engine.puLabelPrint({
      orderNo: props.orderNo, batchNo: String(batchNo.value).trim(),
      // 生产日期(2026-10-23):与批次号一起登记在单头,出纸时印到卡面「生产日期」栏;空串 = 不登记
      prodDate: String(prodDate.value || '').trim(), lines: all,
      // 来源打印记录(2026-11-09):按「有金额」采购订单打印记录打码时带上,服务端防重复 + 界面置灰
      ...(sourcePrintNo.value ? { sourcePrintNo: sourcePrintNo.value } : {}),
    })
    // ⚠ 打印层挂上后 window.print() 是**异步**返回的(打印对话框还开着)。
    //   原来这里紧接着 load() 刷新弹窗 ⇒ 打印对话框期间又发请求又重绘,界面像卡死(2026-10-29)。
    //   现在把刷新放到 onDone(打印层摘掉 / afterprint)之后。
    let afterPrint = null
    let printDone = false      // onDone 可能比下面的赋值先到(打印被浏览器拒/层摘得快)
    let refreshed = false      // 只刷新一次(onDone 与兜底定时器都可能触发)
    const refreshOnce = () => { if (refreshed) return; refreshed = true; load() }
    await printProductCards(cardsOf(res), { onDone: () => { printDone = true; if (afterPrint) afterPrint() } })
    const docs = res['单据编号列表'] || [res['单据编号']]
    const tail = `（${tt('批次号')} ${res['批次号']}${res['生产日期'] ? ` · ${tt('生产日期')} ${res['生产日期']}` : ''}）`
    ElMessage.success(docs.length > 1
      ? `${tt('已登记并打印 {n} 张打印单').replace('{n}', docs.length)}${docs.join('、')}${tail}`
      : `${tt('已登记并打印')} ${res['单据编号']}${tail}`)
    emit('printed', {
      orderNo: props.orderNo, docNo: res['单据编号'], batchNo: res['批次号'], count: docs.length,
    })
    // 本地立刻标记来源已用(按钮马上置灰,不等异步重载),再按 1.5s 兜底刷新
    if (sourcePrintNo.value && !usedLocal.value.includes(sourcePrintNo.value)) {
      usedLocal.value = [...usedLocal.value, sourcePrintNo.value]
    }
    // 刷新"剩余可打/已打印/已打码状态":打印对话框可能还开着 → 先挂起,onDone 里再执行。
    // 2026-11-09 用户反馈「要重新进入才会更新已打印状态」⇒ 加 1.5s 兜底定时器:
    // 浏览器不派发 afterprint / 打印层被系统摘掉时,也能自己刷新,不必关窗重进。
    afterPrint = refreshOnce
    setTimeout(refreshOnce, 1500)
    // onDone 已来过 / 打印层已摘(打印被浏览器拒)⇒ 立即刷新,别傻等
    if (printDone || !document.getElementById('yj-print-host')) afterPrint()
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
    // res 可能是"未抛错但没数据"(老实现回 undefined)⇒ 明确报错,别再弹「第 undefined 次」
    if (!res || !res['单据编号']) throw new Error('重打未返回打印单数据(权限或服务异常)')
    // 与「确认打印」同一口径:刷新放到打印层摘掉之后(2026-10-29 卡顿修复)
    let afterPrint = null
    let printDone = false
    await printProductCards(cardsOf(res), { onDone: () => { printDone = true; if (afterPrint) afterPrint() } })
    ElMessage.success(`${tt('已重打（第 {n} 次）').replace('{n}', res['打印次数'] ?? '')} ${res['单据编号']}`)
    afterPrint = () => { load() }
    if (printDone || !document.getElementById('yj-print-host')) afterPrint()
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
/* 生产日期日期框:与批次号框同高同宽,保证两枚 chip 并排不跳行 */
.mlq-prod-inp { width: 150px; }
.mlq-tip { color: #8b9893; }
/* 多行提示条(浅黄底,说明"每行各出一张打印单;作废只影响对应那一行") */
.mlq-oneline { font-size: 12.5px; color: #8a6d3b; background: #fdf6e3; border: 1px solid #f5e3b3; border-radius: 4px; padding: 3px 8px; }
/* 按打印记录带入后的锁定提示(数量/行锁定,只能改批次号与生产日期) */
.mlq-lock { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #1f6f4a; background: #eef7f1; border: 1px dashed #9fd3b6; border-radius: 4px; padding: 3px 8px; }
.mlq-lock-no { font-weight: 600; }
.mlq-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #46586e; }
.mlq-records { margin-top: 4px; }
.mlq-rec-title { font-size: 12.5px; color: #46586e; margin-bottom: 4px; }
/* 下层「已生单可补打」:与上层隔一道浅线,说明它不是"待生单的预约" */
.mlq-supp { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #dde5ee; display: flex; flex-direction: column; gap: 4px; }
.mlq-supp-title { font-size: 12.5px; color: #46586e; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
/* 下层三块可收缩(2026-11-09):默认收起,标题给条数,展开才看到表格 */
.mlq-collapse { margin-top: 6px; border-top: 1px dashed #dde5ee; }
.mlq-collapse :deep(.el-collapse-item__header) { height: 34px; line-height: 34px; font-size: 12.5px; color: #46586e; }
.mlq-collapse :deep(.el-collapse-item__content) { padding-bottom: 8px; }
.mlq-coll-title { margin-right: 8px; }
.mlq-coll-count { display: inline-block; min-width: 18px; padding: 0 5px; border-radius: 9px; background: #eef3f8; color: #5b6b7f; font-size: 11.5px; line-height: 18px; text-align: center; }
.mlq-coll-tip { margin-bottom: 6px; font-size: 12px; }
/* 整箱/零头箱提示(2026-11-11):琥珀底色、逐行列出;只提示不拦打印 */
.mlq-box-hint { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: #8a6d3b;
  background: #fdf6e3; border: 1px solid #f5e3b3; border-radius: 4px; padding: 4px 8px; }
.mlq-box-line { white-space: normal; }
</style>

<style>
/* 弹窗放大(2026-11-11 用户口径「弹窗需要尽量大,减少左右横拉」):
   宽度由 :width="min(1560px, 96vw)" 给,这里只兜住**纵向** —— 内容超过视口时在弹窗内部滚动,
   不把整页顶出滚动条;页脚按钮始终可见。 */
.mlq-dlg.el-dialog { max-height: 94vh; display: flex; flex-direction: column; }
.mlq-dlg .el-dialog__body { overflow: auto; }
</style>
