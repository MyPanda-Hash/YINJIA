<!-- GenerateLinesDialog.vue — 统一生单对话框(勾选明细行 + 本次数量,2026-10-31 用户口径)
     定位:把「生单」从"整单一把梭"改成"挑行 + 填量",并支持**批量生单**——
     在左侧单据选择栏勾多张来源单 → 打开本对话框 → 一次列出这些单据的明细行 → 挑行/填量 → 逐张转单。

     两条链路共用一套界面(后端 /px/push/lines 下发同一份行契约):
       · 分批链路(目标面板配了表头「批次号」,如 采购订单→送料暂收单):行 = 订单行(数量已切走已打印量)
         + 已打印隔离行(自带批次号,必须显式勾);顶部可按单改批次号,勾到多个已打印批次号时按号拆单;
       · 普通推式生单(销售订单→销售出库单 / 生产工单→产成品入库单):剩余量 = 数量 − 行级已生单量,
         于是"先送一部分、剩下的以后再生"成立 —— 这就是"可以勾选和选择数量"的落点。

     口径(与 core/selection/pushGenerateLines.js 的纯函数 + 单测同源):
       · **勾选是权威**:未勾选 / 数量填 0 的行不提交(2026-09-21 事故:只勾一行却全送);
       · 默认勾「有剩余的订单行」,已打印隔离行必须显式勾(用户口径:打印后的那一行在作废之前
         不会与生单有关联);
       · 可生单上限:订单行 = 数量×(1+超送比例)−已送+已退回;隔离行 = 服务端上限(印在标签上的量不可超)。-->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="96vw"
    top="1vh"
    class="gl-dialog"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="load"
  >
    <div v-loading="loading" class="gl">
      <div class="gl-bar">
        <span class="gl-chip">{{ tt('目标单据') }}: {{ meta.targetName ? tt(meta.targetName) : '-' }}</span>
        <span class="gl-chip">{{ tt('来源单据') }}: {{ docs.length }} {{ tt('张') }}</span>
        <!-- 合单模式(2026-11-13):N 张来源单 → 一张目标单;必须同一供应商 -->
        <span v-if="merge" class="gl-chip gl-merge">{{ tt('合单生单：这些行会合成一张单据（行级「采购单号」保留合单前的订单号）') }}</span>
        <!-- 选单入口(2026-11-24 用户口径「在合单生单页面多一个选择单据的按钮」):
             金蝶式选单 —— 点开 → 勾采购订单 → 明细加进来;已经在页面上的明细只补没有的行 -->
        <el-button v-if="merge" type="primary" size="small" @click="pickVisible = true">
          {{ tt('选择单据') }}
        </el-button>
        <span v-if="merge" class="gl-tip">{{ tt('选单加入合单：已加入的明细只补还没进来的行，不会重复') }}</span>
        <!-- 超送比例**只有采购订单这一跳有**(用户口径 2026-10-31:「除了采购订单,别的生单没有超送比例」)——
             送料暂收→检验/入库、销售订单→销售出库单 等一律不显示,上限就是剩余量 -->
        <span v-if="showOverRatio" class="gl-ratio">
          {{ tt('超送比例') }}:
          <el-input-number v-model="ratioPct" :min="0" :max="50" :step="1" :precision="0" :controls="false"
                           size="small" style="width: 62px" />
          %<span class="gl-tip">{{ tt('（本次生效；最高 50%，额度按来源行数量算）') }}</span>
        </span>
        <span class="gl-tip">{{ tt('勾选要生单的明细行并填写本次数量；未勾选的行不会进入新单据') }} · {{ tt('未勾选的明细行置灰、不能填写') }}</span>
        <!-- 金蝶未入库 vs 剩余 的口径提示(2026-11-27 客户口径:他们主要看金蝶那个) -->
        <span v-if="hasKingdee" class="gl-tip gl-jd-tip">
          {{ tt('「金蝶未入库」= 金蝶还欠的货（含别人在金蝶手工收的）；「剩余」= 本系统还能送多少 —— 两者不一样时以金蝶为准') }}
        </span>
      </div>

      <div v-for="doc in docs" :key="doc.sourceNo" class="gl-doc">
        <div class="gl-doc-head">
          <span class="gl-doc-no">{{ doc.sourceNo }}</span>
          <el-tag v-if="doc.status" size="small" :type="doc.status === '已审核' ? 'success' : 'info'">{{ tt(doc.status) }}</el-tag>
          <span class="gl-doc-sum">{{ docSummary(doc.header) }}</span>
          <span v-if="doc.batchFlow" class="gl-batch">
            {{ tt('批次号') }}:
            <el-input v-model="batchNoOf[doc.sourceNo]" size="small" style="width: 150px" maxlength="100"
                      :disabled="doc.batchInherited"
                      :title="doc.batchInherited ? tt('批次号随来源单继承，不能在这里改') : tt('生单时按当天日期生成，可改')" />
            <span v-if="doc.batchInherited" class="gl-lock">{{ tt('继承来源单') }}</span>
          </span>
          <span class="gl-doc-pick">
            <!-- 「全选 / 取消全选」这对文字链已由**表头那颗全选框**取代(2026-11-18 用户口径:
                 「全选按钮在行号前面的格子上就行」)—— 同一块里留两份全选是噪声,这里不再挂 -->
            <!-- 2026-11-13 用户口径「也可以所有行带入第一个填入的仓库和仓位」 -->
            <el-button v-if="showWhBin" link type="primary" size="small"
                       :title="tt('把本单第一行填好的仓库与仓位套用到本单所有行')"
                       @click="applyWhBinToAll(doc)">{{ tt('仓库仓位应用到所有行') }}</el-button>
            <span class="gl-picked">{{ tt('已选') }} {{ (pickedByDoc[doc.sourceNo] || []).length }} {{ tt('行') }}</span>
          </span>
        </div>
        <!-- 2026-11-13 用户口径「不要滚动，一次显示全部」:表不再限高(max-height 会出内层滚动条),
             全部行一次铺开;弹窗本身放到 96vw 宽,列宽收窄以免横向滚动。 -->
        <!-- 未勾选的行置灰 + 行内不可填(2026-11-17 客户口径「没有勾选为灰色而且不能有输入」):
             灰类见 core/selection/pickRowStyle.js,样式在 styles/index.css;每张来源单各按自己的勾选集合判 -->
        <el-table :data="doc.lines" row-key="lineKey" border size="small"
                  :row-class-name="rowClassOfDoc(doc)"
                  :empty-text="tt('该单据没有可生单的明细行')">
          <!-- 勾选列的表头 = **本单全选**(2026-11-18 用户口径「全选按钮在行号前面的格子上就行,
               和生单保持一致」):三态勾选框(全勾 ✓ / 部分勾 ▬ / 全空),口径复用下面的 selectAll ——
               只勾可选行(非已审核单据、已打印隔离行、可生单 = 0 的行都不会被顺手带进来)。 -->
          <el-table-column width="42" align="center">
            <template #header>
              <el-checkbox :model-value="docStats(doc).all" :indeterminate="docStats(doc).some"
                           :disabled="!docStats(doc).total"
                           :title="tt('全选本单的全部明细行')"
                           @change="(v) => (v ? selectAll(doc) : selectNone(doc))" />
            </template>
            <template #default="{ row }">
              <el-checkbox :model-value="isPicked(doc, row)" :disabled="!selectable(doc, row)"
                           @change="(v) => togglePick(doc, row, v)" />
            </template>
          </el-table-column>
          <!-- 删行 = 行首一个「叉」,点一下就把这一行从本次合单里移除(2026-11-24 用户口径:
               「直接在明细中加入一个叉点击后删除」)。
               · 放在勾选列右边第一格:96vw 宽表横向滚动时它也在视野里,不用滚到最后一列才找得到;
               · **唯一的删除入口**(不再另挂「删除本单 / 操作列」,免得两个删除分不清);
               · 只挂合单模式 —— 批量生单是"逐张各出一张单",删行没有语义。
               删光某张单的行,该单自动撤掉(见 removeLine)。 -->
          <el-table-column v-if="merge" width="34" align="center">
            <template #default="{ row }">
              <span class="gl-x" :title="tt('删除这一行')" @click.stop="removeLine(doc, row)">✕</span>
            </template>
          </el-table-column>
          <el-table-column prop="行号" :label="tt('行号')" width="55" />
          <el-table-column prop="物料编码" :label="tt('物料编码')" min-width="120" show-overflow-tooltip />
          <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="130" show-overflow-tooltip />
          <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="90" show-overflow-tooltip />
          <el-table-column prop="计量单位" :label="tt('单位')" width="64" />
          <el-table-column v-if="meta.batchFlow" prop="批次号" :label="tt('批次号')" min-width="110" show-overflow-tooltip />
          <el-table-column prop="数量" :label="tt('数量')" width="90" align="right" />
          <el-table-column prop="已送数量" :label="tt('已生单')" width="85" align="right" />
          <el-table-column prop="剩余数量" :label="tt('剩余')" width="85" align="right" />
          <!-- 金蝶行级执行量(2026-11-27 客户口径:「生单界面要加入金蝶的未入库数量,我主要看这个,
               不然它和金蝶不同步」):
                 · 「剩余」= 本系统还能送多少(已生单占用量);
                 · 「金蝶未入库」= 金蝶还欠的货(已审核采购入库量之外);
               别人在金蝶里手工收过货(批号 PC0000)时,两者会差 —— 差的时候照「剩余」生单会超收,
               故这里并排显示,并把"剩余 > 金蝶未入库"的行标黄提示。
               源面板没有这两个字段(销售订单/工单等链路)时整列不出现。 -->
          <el-table-column v-if="hasKingdee" :label="tt('金蝶已入库')" width="100" align="right">
            <template #default="{ row }">{{ jdNum(row['金蝶已入库数量']) }}</template>
          </el-table-column>
          <el-table-column v-if="hasKingdee" :label="tt('金蝶未入库')" width="100" align="right">
            <template #default="{ row }">
              <span :class="{ 'gl-jd-short': jdShort(row) }"
                    :title="jdShort(row) ? tt('照「剩余」生单会超过金蝶未入库量（多出来的会超收）') : ''">
                {{ jdNum(row['金蝶未入库数量']) }}
              </span>
            </template>
          </el-table-column>
          <!-- 仓库 / 仓位(2026-11-13 用户口径「从采购订单生单的时候就开始预填仓库仓位」):
               采购订单这一跳按行选,可以每行不一样;点行头「仓库仓位应用到所有行」把第一个填好的
               仓库+仓位铺满本单所有行。选完随生单提交,沿 暂收 → 检验 → 采购入库 一路带下去。 -->
          <el-table-column v-if="showWhBin" :label="tt('仓库')" width="130">
            <template #default="{ row }">
              <el-select v-model="whOf[row.lineKey]" size="small" filterable clearable
                         :disabled="pickRowLocked(picksOfDoc(doc), row.lineKey)"
                         :placeholder="tt('选择仓库')" style="width: 120px" @change="onWhChange(row)">
                <el-option v-for="w in whSrc.warehouses" :key="w.code || w.name" :label="w.name" :value="w.name" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column v-if="showWhBin" :label="tt('仓位')" width="130">
            <template #default="{ row }">
              <el-select v-model="binOf[row.lineKey]" size="small" filterable clearable
                         :disabled="!whOf[row.lineKey] || pickRowLocked(picksOfDoc(doc), row.lineKey)"
                         :placeholder="whOf[row.lineKey] ? tt('选择仓位') : tt('先选仓库')"
                         style="width: 120px">
                <el-option v-for="b in binsOfLine(row)" :key="b.code" :label="b.code" :value="b.code" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column :label="tt('可生单')" width="90" align="right">
            <template #default="{ row }">{{ capOf(row, ratioPct) }}</template>
          </el-table-column>
          <el-table-column :label="tt('本次数量')" width="140">
            <template #default="{ row }">
              <el-input-number v-model="qtyOf[row.lineKey]" :min="0" :max="capOf(row, ratioPct)" :controls="false"
                               :precision="2"
                               :disabled="!selectable(doc, row) || pickRowLocked(picksOfDoc(doc), row.lineKey)"
                               style="width: 120px" />
            </template>
          </el-table-column>
          <el-table-column v-if="meta.batchFlow" :label="tt('状态')" width="86" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="isPrintedRow(row) ? (row['已生单'] ? 'info' : 'warning') : 'success'">
                {{ tt(isPrintedRow(row) ? (row['已生单'] ? '已生单' : '已打印') : '未打印') }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="!docs.length && !loading" :description="tt('没有可生单的明细行')" />
    </div>
    <template #footer>
      <span class="gl-foot">
        {{ tt('已选') }} <b>{{ count }}</b> {{ tt('行') }} · {{ tt('本次合计') }}: <b>{{ totalQty }}</b>
        <span v-if="failed.length" class="gl-fail">{{ tt('失败') }} {{ failed.length }}</span>
      </span>
      <el-button @click="fillRemaining">{{ tt('按剩余量填充') }}</el-button>
      <el-button @click="clearAll">{{ tt('清空') }}</el-button>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" :disabled="!count" @click="confirm">
        {{ merge ? tt('确定合单生单') : tt('确定生单') }}
      </el-button>
    </template>

    <!-- 选单弹窗(2026-11-24):合单页面里"再加几张订单"用;已经加入的明细只补没有的行 -->
    <MergePickDocsDialog
      v-model="pickVisible"
      :source-panel="sourcePanel"
      :target-panel="meta.targetPanel"
      :source-name="meta.sourceName"
      :added-nos="addedNos"
      :added-line-keys="addedLineKeys"
      :supplier="mergeSupplier"
      @confirm="onDocsPicked"
    />
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import {
  buildDocsPayload, capOf, defaultPickKeys, docSummary, hasKingdeeQty, isPrintedRow,
  kingdeeShort, kingdeeUnrecvOf, mixedBatchBlocked, picksOf, sumPicked,
} from '@core/selection/pushGenerateLines'
// 生单时的「仓库 / 仓位」预填(2026-11-13 用户口径):取数、级联候选、提交键都在这一份纯函数里
import { binsOfWarehouse, defaultBinOf, loadWhBinSources, whBinPayload } from '@core/selection/genWhBin'
// 未勾选的行置灰 + 不可填(2026-11-17 客户口径;四个打印/生单弹窗共用同一份,见该模块头注释)
import { pickRowClass, pickRowLocked } from '@core/selection/pickRowStyle'
// 合单的「选单」弹窗(2026-11-24 用户口径:合单生单不再靠左栏勾选,改成金蝶式选单窗口)
import MergePickDocsDialog from './MergePickDocsDialog.vue'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 来源面板编码 */
  sourcePanel: { type: String, default: '' },
  /** 生单动作(如 生成送料暂收单),后端据此找目标面板与行过滤 */
  action: { type: String, default: '' },
  /** 勾选的来源单据号(1 张 = 原「生单」;多张 = 「批量生单」) */
  sourceNos: { type: Array, default: () => [] },
  /**
   * **合单模式**(2026-11-13 用户口径「采购订单新增一个合单生单…合成一张送料暂收单」):
   * true ⇒ N 张来源单的行并进**同一张**目标单(共用单据号/批次号),
   * 行级「采购单号」逐行记住合单前的订单号;false ⇒ 原行为(逐张各出一张)。
   */
  merge: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'generated'])

const loading = ref(false)
const saving = ref(false)
const meta = reactive({ targetPanel: '', targetName: '', sourceName: '', batchFlow: false, overRatio: 0 })
/** 服务端候选:每条 = 一张来源单(头 + 行 + 批次预告) */
const docs = ref([])
/** 本次超送比例(百分数;改了只影响本次上限,不写系统参数 —— 写系统参数在分批送料对话框里) */
const ratioPct = ref(0)
/** 每张来源单的批次号输入(分批链路) */
const batchNoOf = reactive({})
/** 勾选:{ sourceNo: [lineKey] } —— 用数组而不是 Set,赋值即触发更新,少一类响应式坑 */
const pickedByDoc = reactive({})
/** 本次数量:{ lineKey: number }(行键全库唯一:`...#{行id}` / `...#{行id}@{打印行id}`) */
const qtyOf = reactive({})
/** 上一次提交的失败清单(留在底部提示,重试前看得见原因) */
const failed = ref([])

/* ── 选单(2026-11-24 用户口径「在合单生单页面多一个选择单据的按钮,选择后单据明细会添加进来,
      已经有的明细就只补没有的就行」)────────────────────────────────
   选单弹窗只回"单据号",明细仍由 /px/push/lines 取(与首次打开时同一份行契约),
   于是"补进来的行"与"本来就在的行"字段、上限、仓库仓位默认值完全同源。 */
const pickVisible = ref(false)
/** 已在页面上的单据号:选单弹窗据此把这几张标「已添加」 */
const addedNos = computed(() => docs.value.map((d) => d.sourceNo))
/**
 * 已在页面上的**明细行键**(2026-11-28):选单弹窗按它把状态分成
 * 「可加入 / 部分已添加 / 已添加」,并把已进去的那几行灰显 —— 用户一眼看出"这张单我只补哪几行"。
 * 行键与来源侧同一套约定(`单号#行id`,隔离行另有 `@打印行id`),选单接口下发的 `_lineKey` 同源。
 */
const addedLineKeys = computed(() => docs.value.flatMap((d) => (d.lines || []).map((r) => r.lineKey)))
/** 合单锁定的供应商(取第一张单据):换一家=不能合,弹窗只列这一家的订单 */
const mergeSupplier = computed(() => String((docs.value[0]?.header || {})['供应商'] || '').trim())

/* ── 仓库 / 仓位按行预填(2026-11-13 用户口径)─────────────────────────
   只在**采购链头一跳**(采购订单 → 送料暂收单)出这两列:
   · 其它链路的仓库/仓位来自来源单(映射带下来),不需要在这里选;
   · 采购订单行的仓库列线上基本是空的(5080 行里只有 47 行),所以必须给"当场选"的入口,
     否则用户只能等下游入库单逐行补,正是用户要解决的那件事。 */
const showWhBin = computed(() => String(props.sourcePanel) === 'PU_ORDER')
/** 档案候选(仓库 WH / 仓位 WHLOC);取不到就退化成空,生单照旧可做 */
const whSrc = reactive({ warehouses: [], bins: [] })
/** 每行选中的仓库(仓库名称)/ 仓位(仓位编码) */
const whOf = reactive({})
const binOf = reactive({})

/** 某行可选的仓位(按本行仓库级联) */
function binsOfLine(row) {
  return binsOfWarehouse(whSrc.bins, whOf[row?.lineKey])
}

/** 换仓库:仓位候选随之收窄 —— 已选仓位不在新仓里就清掉,空则按该仓默认仓位预填 */
function onWhChange(row) {
  const list = binsOfLine(row)
  const cur = String(binOf[row.lineKey] || '')
  if (cur && !list.some((b) => b.code === cur)) binOf[row.lineKey] = ''
  if (!binOf[row.lineKey]) binOf[row.lineKey] = defaultBinOf(whSrc.bins, whOf[row.lineKey])
}

/** 「所有行带入第一行填好的仓库与仓位」(用户口径原话) */
function applyWhBinToAll(doc) {
  const lines = doc?.lines || []
  const first = lines.find((r) => String(whOf[r.lineKey] || '').trim() !== '')
  if (!first) {
    ElMessage.warning(tt('请先在任意一行选好仓库，再套用到所有行'))
    return
  }
  const wh = whOf[first.lineKey]
  const bin = binOf[first.lineKey] || defaultBinOf(whSrc.bins, wh)
  for (const r of lines) {
    whOf[r.lineKey] = wh
    binOf[r.lineKey] = bin
  }
}

/** 标题里也带目标面板名 → 同样过 tt()(面板名走 yj_translation scope=panel,英文界面不掉回中文) */
const title = computed(() => `${tt(props.merge ? '合单生单' : '生单')} → ${meta.targetName ? tt(meta.targetName) : tt('目标单据')}`)
/** 合单模式(2026-11-13):N 张来源单 → 一张目标单 */
const merge = computed(() => !!props.merge)
/**
 * 收料超送额度**只属于采购订单这一跳**(2026-10-31 用户口径:「除了采购订单,别的生单没有超送比例」)。
 * 供应商采购打印(SUPPLIER_PU_ORDER)是采购订单的副本面板,同一张订单、同一套口径,一并放行。
 */
const OVER_RATIO_PANELS = new Set(['PU_ORDER', 'SUPPLIER_PU_ORDER'])
const showOverRatio = computed(() => meta.batchFlow && OVER_RATIO_PANELS.has(String(props.sourcePanel)))
const totalQty = computed(() => sumPicked(docs.value, pickedByDoc, qtyOf))

const hasKingdee = computed(() => docs.value.some((d) => (d.lines || []).some((r) => hasKingdeeQty(r))))
/** 单元格显示:空值给「-」,别显示 0 冒充"还欠 0" */
const jdNum = (v) => (v === null || v === undefined || v === '' ? '-' : v)
/** 「剩余」比「金蝶未入库」还大 ⇒ 照剩余生单一定超收(标黄 + 悬浮提示) */
const jdShort = (row) => kingdeeShort(row)

const count = computed(() => {
  let n = 0
  for (const d of docs.value) n += (pickedByDoc[d.sourceNo] || []).length
  return n
})

/* ── 表头全选框(2026-11-18 用户口径)──────────────────────────────
   「全选按钮在行号前面的格子上就行,和生单保持一致」—— 全选放进每张来源单表格
   勾选列的表头格子里(标准表头全选的位置),三态由本节派生:
   · total  = 本单**可勾**行数(非已审核 / 可生单 = 0 的行不算,已打印隔离行也算可勾但要显式勾);
   · picked = 本单已勾且**仍然可选**的行数(超送比例调小后,原来勾上的行可能不再可选);
   · all    = 可勾的都勾了;some = 部分勾(中间态 ▬);一个都没勾 → 两个都 false(空格子)。
   读的都是响应式数据(pickedByDoc / ratioPct),所以表头勾选框随行内勾选实时变。 */
function docStats(doc) {
  const set = picksOfDoc(doc)
  let total = 0
  let picked = 0
  for (const row of doc?.lines || []) {
    if (!selectable(doc, row)) continue
    total++
    if (set.has(row.lineKey)) picked++
  }
  return { total, picked, all: total > 0 && picked >= total, some: picked > 0 && picked < total }
}

/** 统一取勾选集合(组件里存数组,纯函数既收 Set 也收数组) */
const picksOfDoc = (doc) => picksOf(pickedByDoc[doc.sourceNo])
/** 未勾选的行置灰(2026-11-17 客户口径):每张来源单一张表,各按自己的勾选集合判;禁填见模板 pickRowLocked */
const rowClassOfDoc = (doc) => pickRowClass(picksOfDoc(doc))

function isPicked(doc, row) { return picksOfDoc(doc).has(row.lineKey) }
/** 只读单据(非已审核)整张不可勾;没有可生单量的行也不可勾 */
function selectable(doc, row) {
  if (doc.status && doc.status !== '已审核') return false
  return capOf(row, ratioPct.value) > 0.000001
}

function togglePick(doc, row, on) {
  const cur = [...(pickedByDoc[doc.sourceNo] || [])].filter((k) => k !== row.lineKey)
  if (on) {
    cur.push(row.lineKey)
    // 勾上时若数量还是 0 → 按剩余量预填(与原分批对话框一致:勾了就默认全送)
    if (!(Number(qtyOf[row.lineKey] || 0) > 0)) qtyOf[row.lineKey] = Number(row.剩余数量) || 0
  }
  pickedByDoc[doc.sourceNo] = cur
}

function selectAll(doc) {
  const keys = []
  for (const row of doc.lines || []) {
    if (!selectable(doc, row)) continue
    keys.push(row.lineKey)
    if (!(Number(qtyOf[row.lineKey] || 0) > 0)) qtyOf[row.lineKey] = Number(row.剩余数量) || 0
  }
  pickedByDoc[doc.sourceNo] = keys
}
function selectNone(doc) { pickedByDoc[doc.sourceNo] = [] }

/** 全送:每张单按剩余量填满并勾上(隔离行同样只在可送上限内,用户仍可取消) */
function fillRemaining() {
  for (const doc of docs.value) selectAll(doc)
}
function clearAll() {
  for (const doc of docs.value) pickedByDoc[doc.sourceNo] = []
  for (const key of Object.keys(qtyOf)) qtyOf[key] = 0
}

/**
 * 一行来源明细的默认值(数量/仓库/仓位)—— **首次打开**与**选单补进来**共用这一份,
 * 否则"补进来的行"会缺仓库仓位默认值,生单时落到别处。
 */
function initLineRow(row) {
  qtyOf[row.lineKey] = Number(row.剩余数量) > 0 ? Number(row.剩余数量) : 0
  if (!showWhBin.value) return
  // 来源行本身带了仓库/仓位就继承(采购订单行可以手工填过),否则留空由用户选;
  // 有仓库没仓位时按该仓默认仓位预填(与后端 presetBinFor 同一口径)。
  const wh = String(row['仓库'] || row['仓库编码'] || '').trim()
  if (wh) whOf[row.lineKey] = wh
  const bin = String(row['仓位'] || row['仓位编码'] || '').trim()
  binOf[row.lineKey] = bin || (wh ? defaultBinOf(whSrc.bins, wh) : '')
}

/** 把一条来源单整段纳入本对话框(新单据:行 + 批次号 + 默认勾选) */
function adoptDoc(src) {
  for (const row of src.lines || []) initLineRow(row)
  docs.value.push(src)
  batchNoOf[src.sourceNo] = String(src.nextBatchNo || '')
  // 默认勾选:只勾有剩余的**订单行**;已打印隔离行必须显式勾(用户口径)
  pickedByDoc[src.sourceNo] = defaultPickKeys(src.lines || [])
}

async function load() {
  if (!props.sourcePanel || !props.action || !props.sourceNos?.length) return
  loading.value = true
  failed.value = []
  docs.value = []
  try {
    const res = await engine.pushFlowLines({
      panelCode: props.sourcePanel, action: props.action, sourceNos: props.sourceNos,
    })
    meta.targetPanel = res?.targetPanel || ''
    meta.targetName = res?.targetName || ''
    meta.sourceName = res?.sourceName || ''
    meta.batchFlow = !!res?.batchFlow
    meta.overRatio = Number(res?.overRatio || 0)
    // 超送比例只对**采购订单这一跳**生效;其余链路(暂收→检验/入库、销售订单→销售出库单)
    // 没有超送额度 —— 上限就是剩余量。置 0,否则「可生单」会显示成 数量×1.2,
    // 用户照着填 60 再被后端按 50 拒掉(2026-10-31 实测到)。
    ratioPct.value = showOverRatio.value ? Math.round(meta.overRatio * 100) : 0
    for (const k of Object.keys(qtyOf)) delete qtyOf[k]
    for (const k of Object.keys(pickedByDoc)) delete pickedByDoc[k]
    for (const k of Object.keys(batchNoOf)) delete batchNoOf[k]
    for (const k of Object.keys(whOf)) delete whOf[k]
    for (const k of Object.keys(binOf)) delete binOf[k]
    docs.value = []
    // 仓库/仓位档案(只在采购订单这一跳需要):取一次,失败也不阻断生单
    if (showWhBin.value) {
      const src = await loadWhBinSources(engine)
      whSrc.warehouses = src.warehouses
      whSrc.bins = src.bins
    }
    for (const d of res?.docs || []) adoptDoc({ ...d, lines: d.lines || [] })
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('生单数据加载失败'))
  } finally {
    loading.value = false
  }
}

/* ── 选单补单 / 删除(2026-11-24 用户口径)──────────────────────────── */

/**
 * 选单确定:把勾选单据的明细**只补没有的**行加进来。
 *
 * 口径(用户原话「已经有的明细就只补没有的就行」):
 *   · 已在页面上的单据 → 按 lineKey 去重,只追加还没加入的行(删掉过的行可以靠它补回来);
 *   · 新单据 → 整段纳入(数量/仓库仓位/默认勾选走 adoptDoc,与首次打开同源);
 *   · 供应商不一致 → 拦下并点名(后端 generateMerged 同口径再校验一次)。
 */
async function onDocsPicked({ nos }) {
  const want = (nos || []).filter(Boolean)
  if (!want.length) return
  loading.value = true
  try {
    const res = await engine.pushFlowLines({
      panelCode: props.sourcePanel, action: props.action, sourceNos: want,
    })
    let newDocs = 0
    let newLines = 0
    for (const d of res?.docs || []) {
      const src = { ...d, lines: d.lines || [] }
      if (!src.sourceNo) continue
      const sup = String((src.header || {})['供应商'] || '').trim()
      if (mergeSupplier.value && sup && sup !== mergeSupplier.value) {
        ElMessage.warning(`${tt('合单生单只能选同一供应商的采购订单，当前勾了')}：${mergeSupplier.value}、${sup}`)
        continue
      }
      const exist = docs.value.find((x) => x.sourceNo === src.sourceNo)
      if (!exist) {
        adoptDoc(src)
        newDocs++
        newLines += src.lines.length
        continue
      }
      // 同一张单再选一次:只补"页面上还没有"的行(行键 = 单号#行id,稳定)
      const have = new Set(exist.lines.map((r) => r.lineKey))
      for (const row of src.lines) {
        if (have.has(row.lineKey)) continue
        initLineRow(row)
        exist.lines.push(row)
        // 补进来的行与"首次打开时默认勾选"同一口径:有剩余的订单行自动勾上
        // (已打印隔离行仍要用户显式勾,见 defaultPickKeys)
        if (defaultPickKeys([row]).length) {
          pickedByDoc[src.sourceNo] = [...(pickedByDoc[src.sourceNo] || []), row.lineKey]
        }
        newLines++
      }
    }
    if (!newDocs && !newLines) {
      ElMessage.info(tt('该单据的明细已全部在合单页面中，无需重复添加'))
    } else {
      ElMessage.success(`${tt('已加入')} ${newDocs} ${tt('张单据')} · ${tt('新增明细')} ${newLines} ${tt('行')}`)
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('选单明细加载失败'))
  } finally {
    loading.value = false
  }
}

/** 清掉某张单据在对话框里的全部临时状态(勾选/数量/仓库/批次号) */
function dropDocState(no) {
  for (const key of Object.keys(qtyOf)) if (String(key).startsWith(`${no}#`)) delete qtyOf[key]
  for (const key of Object.keys(whOf)) if (String(key).startsWith(`${no}#`)) delete whOf[key]
  for (const key of Object.keys(binOf)) if (String(key).startsWith(`${no}#`)) delete binOf[key]
  delete pickedByDoc[no]
  delete batchNoOf[no]
}

/** 删除整单(用户口径「可以删除掉不需要单据的明细」)—— 点错可再点「选择单据」把它选回来 */
function removeDoc(doc) {
  const i = docs.value.findIndex((d) => d.sourceNo === doc.sourceNo)
  if (i < 0) return
  dropDocState(doc.sourceNo)
  docs.value.splice(i, 1)
}

/** 删除一行;该单删空了就连单据一起撤掉(否则会留一段没有行的空表) */
function removeLine(doc, row) {
  const i = (doc?.lines || []).findIndex((r) => r.lineKey === row.lineKey)
  if (i < 0) return
  doc.lines.splice(i, 1)
  delete qtyOf[row.lineKey]
  delete whOf[row.lineKey]
  delete binOf[row.lineKey]
  pickedByDoc[doc.sourceNo] = (pickedByDoc[doc.sourceNo] || []).filter((k) => k !== row.lineKey)
  if (!doc.lines.length) removeDoc(doc)
}

async function confirm() {
  // 合单至少要两张单(后端 generateMerged 同口径):删到只剩一张时先说清,别让用户填完才被拒
  if (props.merge && docs.value.length < 2) {
    ElMessage.warning(`${tt('合单生单至少要两张采购订单，当前只有')} ${docs.value.length} ${tt('张单据')}`)
    return
  }
  // 超送比例调小后可能低于已填数量 → 收敛到新上限,避免提交被后端拒
  for (const doc of docs.value) {
    for (const row of doc.lines || []) {
      const cap = capOf(row, ratioPct.value)
      if (Number(qtyOf[row.lineKey] || 0) > cap) qtyOf[row.lineKey] = cap
    }
  }
  const blocked = mixedBatchBlocked(docs.value, pickedByDoc, qtyOf)
  if (blocked) { ElMessage.warning(tt(blocked)); return }
  const payloadDocs = buildDocsPayload(docs.value, pickedByDoc, qtyOf)
  if (!payloadDocs.length) { ElMessage.warning(tt('请至少勾选一行并填写本次生单数量')); return }
  // 仓库 / 仓位随行提交(2026-11-13):空值不写键 —— 后端据此判"没选",走来源映射/默认仓位那套
  if (showWhBin.value) {
    for (const d of payloadDocs) {
      for (const l of d.lines || []) {
        const extra = whBinPayload({
          warehouses: whSrc.warehouses, bins: whSrc.bins,
          warehouse: whOf[l.lineKey] || '', bin: binOf[l.lineKey] || '',
        })
        Object.assign(l, extra)
      }
    }
  }
  saving.value = true
  failed.value = []
  try {
    // 合单生单(2026-11-13):N 张来源单的行 → **一张**目标单(后端 /px/push/merge)。
    // 批次号取第一张来源单预告的那个号(同一批货一个号;后端仍可现场覆盖)。
    const res = props.merge
      ? await engine.pushFlowMerge({
        panelCode: props.sourcePanel, action: props.action, docs: payloadDocs,
        batchNo: String(batchNoOf[docs.value[0]?.sourceNo] || ''),
      })
      : await engine.pushFlowGenerate({
        panelCode: props.sourcePanel, action: props.action, docs: payloadDocs,
        // 分批链路才带比例;非采购订单恒 0(= 不许超送),后端 generateBatch 按 0 校验
        overRatio: meta.batchFlow ? ratioPct.value / 100 : undefined,
      })
    if (props.merge) {
      // 合单:后端只回一张单(编号/批次号),没有"生成清单/失败清单"
      const no = String(res?.['编号'] || '')
      const batch = String(res?.['批次号'] || '')
      ElMessage.success(`${tt('已合单生成')} ${no}${batch ? `（${tt('批次号')} ${batch}）` : ''}`
        + `：${(res?.['合单来源'] || []).length || docs.value.length} ${tt('张采购订单合成一张')}`)
      emit('generated', {
        panel: res?.gotoPanel || meta.targetPanel,
        no,
        count: 1,
        docs: [{ 编号: no, 面板: res?.gotoPanel || meta.targetPanel, 批次号: batch }],
        failed: [],
        sourceCount: props.sourceNos.length,
      })
      emit('update:modelValue', false)
      return
    }
    const made = res?.['生成'] || []
    failed.value = res?.['失败'] || []
    // 一条动作两个去向(暂收单 → 来料检验单 + 采购入库单)时,后端把这两张放在该来源单的
    // 「生成清单」里 —— 这里摊平后再数张数/回显单号,否则界面上只报一张,用户会以为另一张没出。
    const created = made.flatMap((m) => (Array.isArray(m['生成清单']) && m['生成清单'].length
      ? m['生成清单'].map((x) => ({ 编号: x['编号'], 面板: x['面板'], 批次号: x['批次号'], 面板名称: x['面板名称'] }))
      : [{ 编号: m['编号'], 面板: m['面板'], 批次号: m['批次号'] }]))
    const missing = made.flatMap((m) => (Array.isArray(m['未登记商品']) ? m['未登记商品'] : []))
    if (created.length) {
      const list = created.map((m) => (m['批次号'] ? `${m['编号']}(${m['批次号']})` : m['编号'])).join('、')
      ElMessage.success(`${tt('已生成')} ${created.length} ${tt('张单据')}：${list}`
        + (failed.value.length ? `（${tt('失败')} ${failed.value.length}）` : ''))
      if (missing.length) {
        ElMessage.warning(`${tt('商品档案未登记的商品按免检（否）处理')}：${[...new Set(missing)].join('、')}`)
      }
    }
    if (failed.value.length && !created.length) {
      ElMessage.error(failed.value[0]['原因'] || tt('生单失败'))
    }
    if (!created.length) return
    emit('generated', {
      panel: created[0]?.['面板'] || res?.targetPanel || meta.targetPanel,
      no: created[0]?.['编号'] || '',
      count: created.length,
      docs: created,
      failed: failed.value,
      sourceCount: props.sourceNos.length,
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
.gl { display: flex; flex-direction: column; gap: 10px; }
.gl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 12.5px; color: #46586e; }
.gl-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
/* 合单生单:提示条用主色描边,一眼看出"这次不是逐张出单" */
.gl-merge { background: #eef6ff; border-color: #b9d7f5; color: #1e6fb8; }
.gl-ratio { display: inline-flex; align-items: center; gap: 4px; }
.gl-tip { color: #8b9893; }
/* 金蝶未入库列(2026-11-27):口径提示与"会超收"的黄色标记 —— 同一套颜色在 BatchSendDialog 复用 */
.gl-jd-tip { flex-basis: 100%; color: #b26a00; }
.gl-jd-short { color: #d46b08; font-weight: 600; border-bottom: 1px dashed #f0a020; cursor: help; }
.gl-doc { border: 1px solid #e4e9ef; border-radius: 4px; padding: 6px 8px 8px; background: #fff; }
.gl-doc-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.gl-doc-no { font-weight: 600; color: #1e6fb8; }
.gl-doc-sum { color: #5d6c67; font-size: 12.5px; }
.gl-batch { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: #46586e; }
.gl-lock { color: #b88230; font-size: 12px; }
.gl-doc-pick { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
/* 表头全选框(本单全选):宽度只有 42px 的格子里居中 —— el-checkbox 默认 margin-right:30px,
   不清掉会把勾选框顶到格子外面(行内那颗在正文格子里没这个问题,故只针对表头) */
.gl-doc :deep(th .el-checkbox) { margin-right: 0; }
.gl-picked { color: #5d6c67; font-size: 12.5px; }
/* 行首那个「叉」:平时淡灰、够得着,悬停变红底白叉 —— 一眼知道能点,也不抢明细的注意力 */
.gl-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  color: #98a5b0;
  cursor: pointer;
  user-select: none;
}
.gl-x:hover { color: #fff; background: #f56c6c; }
.gl-empty { color: #909399; }
.gl-foot { margin-right: auto; font-size: 12.5px; color: #46586e; }
.gl-fail { color: #f56c6c; margin-left: 10px; }
</style>
