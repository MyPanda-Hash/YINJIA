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
    width="1120px"
    top="4vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="load"
  >
    <div v-loading="loading" class="gl">
      <div class="gl-bar">
        <span class="gl-chip">{{ tt('目标单据') }}: {{ meta.targetName ? tt(meta.targetName) : '-' }}</span>
        <span class="gl-chip">{{ tt('来源单据') }}: {{ docs.length }} {{ tt('张') }}</span>
        <span v-if="meta.batchFlow" class="gl-ratio">
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
            <span class="gl-picked">{{ tt('已选') }} {{ (pickedByDoc[doc.sourceNo] || []).length }} {{ tt('行') }}</span>
          </span>
        </div>
        <el-table :data="doc.lines" row-key="lineKey" border size="small" max-height="260"
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
      <el-button type="primary" :loading="saving" :disabled="!count" @click="confirm">{{ tt('确定生单') }}</el-button>
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

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 来源面板编码 */
  sourcePanel: { type: String, default: '' },
  /** 生单动作(如 生成送料暂收单),后端据此找目标面板与行过滤 */
  action: { type: String, default: '' },
  /** 勾选的来源单据号(1 张 = 原「生单」;多张 = 「批量生单」) */
  sourceNos: { type: Array, default: () => [] },
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

/** 标题里也带目标面板名 → 同样过 tt()(面板名走 yj_translation scope=panel,英文界面不掉回中文) */
const title = computed(() => `${tt('生单')} → ${meta.targetName ? tt(meta.targetName) : tt('目标单据')}`)
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
    // 超送比例**只对分批送料链路有效**(收料允许超送);普通链路(销售出库/生产工单/加工单)
    // 没有超送额度 —— 上限就是剩余量。这里必须置 0,否则「可生单」会显示成 数量×1.2,
    // 用户照着填 60 再被后端按 50 拒掉(2026-10-31 实测到)。
    ratioPct.value = meta.batchFlow ? Math.round(meta.overRatio * 100) : 0
    for (const k of Object.keys(qtyOf)) delete qtyOf[k]
    for (const k of Object.keys(pickedByDoc)) delete pickedByDoc[k]
    for (const k of Object.keys(batchNoOf)) delete batchNoOf[k]
    docs.value = (res?.docs || []).map((d) => ({ ...d, lines: d.lines || [] }))
    for (const doc of docs.value) {
      batchNoOf[doc.sourceNo] = String(doc.nextBatchNo || '')
      for (const row of doc.lines) {
        qtyOf[row.lineKey] = Number(row.剩余数量) > 0 ? Number(row.剩余数量) : 0
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
  saving.value = true
  failed.value = []
  try {
    const res = await engine.pushFlowGenerate({
      panelCode: props.sourcePanel, action: props.action, docs: payloadDocs,
      overRatio: meta.batchFlow ? ratioPct.value / 100 : undefined,
    })
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
.gl { display: flex; flex-direction: column; gap: 10px; max-height: 68vh; overflow: auto; }
.gl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 12.5px; color: #46586e; }
.gl-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
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
