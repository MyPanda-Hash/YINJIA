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
        <!-- 超送比例**只有采购订单这一跳有**(用户口径 2026-10-31:「除了采购订单,别的生单没有超送比例」)——
             送料暂收→检验/入库、销售订单→销售出库单 等一律不显示,上限就是剩余量 -->
        <span v-if="showOverRatio" class="gl-ratio">
          {{ tt('超送比例') }}:
          <el-input-number v-model="ratioPct" :min="0" :max="50" :step="1" :precision="0" :controls="false"
                           size="small" style="width: 62px" />
          %<span class="gl-tip">{{ tt('（本次生效；最高 50%，额度按来源行数量算）') }}</span>
        </span>
        <span class="gl-tip">{{ tt('勾选要生单的明细行并填写本次数量；未勾选的行不会进入新单据') }}</span>
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
            <el-button link type="primary" size="small" @click="selectAll(doc)">{{ tt('全选') }}</el-button>
            <el-button link size="small" @click="selectNone(doc)">{{ tt('取消全选') }}</el-button>
            <!-- 2026-11-13 用户口径「也可以所有行带入第一个填入的仓库和仓位」 -->
            <el-button v-if="showWhBin" link type="primary" size="small"
                       :title="tt('把本单第一行填好的仓库与仓位套用到本单所有行')"
                       @click="applyWhBinToAll(doc)">{{ tt('仓库仓位应用到所有行') }}</el-button>
            <span class="gl-picked">{{ tt('已选') }} {{ (pickedByDoc[doc.sourceNo] || []).length }} {{ tt('行') }}</span>
          </span>
        </div>
        <!-- 2026-11-13 用户口径「不要滚动，一次显示全部」:表不再限高(max-height 会出内层滚动条),
             全部行一次铺开;弹窗本身放到 96vw 宽,列宽收窄以免横向滚动。 -->
        <el-table :data="doc.lines" row-key="lineKey" border size="small"
                  :empty-text="tt('该单据没有可生单的明细行')">
          <el-table-column width="42" align="center">
            <template #default="{ row }">
              <el-checkbox :model-value="isPicked(doc, row)" :disabled="!selectable(doc, row)"
                           @change="(v) => togglePick(doc, row, v)" />
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
          <!-- 仓库 / 仓位(2026-11-13 用户口径「从采购订单生单的时候就开始预填仓库仓位」):
               采购订单这一跳按行选,可以每行不一样;点行头「仓库仓位应用到所有行」把第一个填好的
               仓库+仓位铺满本单所有行。选完随生单提交,沿 暂收 → 检验 → 采购入库 一路带下去。 -->
          <el-table-column v-if="showWhBin" :label="tt('仓库')" width="130">
            <template #default="{ row }">
              <el-select v-model="whOf[row.lineKey]" size="small" filterable clearable
                         :placeholder="tt('选择仓库')" style="width: 120px" @change="onWhChange(row)">
                <el-option v-for="w in whSrc.warehouses" :key="w.code || w.name" :label="w.name" :value="w.name" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column v-if="showWhBin" :label="tt('仓位')" width="130">
            <template #default="{ row }">
              <el-select v-model="binOf[row.lineKey]" size="small" filterable clearable
                         :disabled="!whOf[row.lineKey]" :placeholder="whOf[row.lineKey] ? tt('选择仓位') : tt('先选仓库')"
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
                               :precision="2" :disabled="!selectable(doc, row)" style="width: 120px" />
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
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import {
  buildDocsPayload, capOf, defaultPickKeys, docSummary, isPrintedRow,
  mixedBatchBlocked, picksOf, sumPicked,
} from '@core/selection/pushGenerateLines'
// 生单时的「仓库 / 仓位」预填(2026-11-13 用户口径):取数、级联候选、提交键都在这一份纯函数里
import { binsOfWarehouse, defaultBinOf, loadWhBinSources, whBinPayload } from '@core/selection/genWhBin'

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
const meta = reactive({ targetPanel: '', targetName: '', batchFlow: false, overRatio: 0 })
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
const count = computed(() => {
  let n = 0
  for (const d of docs.value) n += (pickedByDoc[d.sourceNo] || []).length
  return n
})

/** 统一取勾选集合(组件里存数组,纯函数既收 Set 也收数组) */
const picksOfDoc = (doc) => picksOf(pickedByDoc[doc.sourceNo])

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
    docs.value = (res?.docs || []).map((d) => ({ ...d, lines: d.lines || [] }))
    // 仓库/仓位档案(只在采购订单这一跳需要):取一次,失败也不阻断生单
    if (showWhBin.value) {
      const src = await loadWhBinSources(engine)
      whSrc.warehouses = src.warehouses
      whSrc.bins = src.bins
    }
    for (const doc of docs.value) {
      batchNoOf[doc.sourceNo] = String(doc.nextBatchNo || '')
      for (const row of doc.lines) {
        qtyOf[row.lineKey] = Number(row.剩余数量) > 0 ? Number(row.剩余数量) : 0
        if (!showWhBin.value) continue
        // 来源行本身带了仓库/仓位就继承(采购订单行可以手工填过),否则留空由用户选;
        // 有仓库没仓位时按该仓默认仓位预填(与后端 presetBinFor 同一口径)。
        const wh = String(row['仓库'] || row['仓库编码'] || '').trim()
        if (wh) whOf[row.lineKey] = wh
        const bin = String(row['仓位'] || row['仓位编码'] || '').trim()
        binOf[row.lineKey] = bin || (wh ? defaultBinOf(whSrc.bins, wh) : '')
      }
      // 默认勾选:只勾有剩余的**订单行**;已打印隔离行必须显式勾(用户口径)
      pickedByDoc[doc.sourceNo] = defaultPickKeys(doc.lines)
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('生单数据加载失败'))
  } finally {
    loading.value = false
  }
}

async function confirm() {
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
.gl-doc { border: 1px solid #e4e9ef; border-radius: 4px; padding: 6px 8px 8px; background: #fff; }
.gl-doc-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.gl-doc-no { font-weight: 600; color: #1e6fb8; }
.gl-doc-sum { color: #5d6c67; font-size: 12.5px; }
.gl-batch { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: #46586e; }
.gl-lock { color: #b88230; font-size: 12px; }
.gl-doc-pick { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.gl-picked { color: #5d6c67; font-size: 12.5px; }
.gl-empty { color: #909399; }
.gl-foot { margin-right: auto; font-size: 12.5px; color: #46586e; }
.gl-fail { color: #f56c6c; margin-left: 10px; }
</style>
