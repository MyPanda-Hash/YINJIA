<!-- ScheduleBatchDialog.vue — 生产工单「批量排产」弹窗(2026-10-30 用户口径)
     入口:生产工单页勾 N 行 → 内嵌快速排产页(复用原页面)→「批量排产」。
     口径(用户确认):
       · 批量排产 = 把多个工单行排入**同一组产线**:每道工序选一条线,整批共用;
       · 排产数量**逐行、各行按各行算**(默认 = 该行当前排产数量>0 否则需求;可改小,≤ 该行需求);
       · 计划量 = 本行排产数量 × 本行该道换算率(各道分开算、不累乘);同链不同率的行各自换算、互不影响;
       · 工序链(工序名称+顺序)不同的行**点名排除**,只排同一组(用户口径「提示这个工单号不是同一个工序」);
       · 计划开工/完工日期(2026-10-30 用户口径「也要和单个实现一样有开工日期之类的实现」):
         与单行排线弹窗同一套日期链 —— 上一道的计划完工 = 下一道的计划开工;
         日期链纯逻辑在 business/planChain.js(单行/批量共用一份),实际开工/完工只读展示;
       · 提交 = 逐行调既有 /px/scheduleBoard/preplan(与单行排产同一套守卫/换算),部分失败点名、可重试。
     纯逻辑在 business/scheduleBatch.js(带 node --test 单测),本组件只负责请求与渲染;
     单行排产仍走原 ProcessRoutePlanDialog,本组件不参与、不修改它的行为。 -->
<template>
  <el-dialog v-model="visible" :title="tt('批量排产')" width="1180px" top="4vh" append-to-body destroy-on-close>
    <div v-loading="loading" class="sbd-body">
      <!-- 工序组:多个组时可选(默认行数最多的一组),其余组在下方点名排除 -->
      <div v-if="groups.length > 1" class="sbd-line">
        <span class="sbd-lb">{{ tt('本批工序') }}</span>
        <el-radio-group v-model="chosenChain" size="small">
          <el-radio-button v-for="g in groups" :key="g.chain" :value="g.chain">
            {{ g.chain }}（{{ g.count }}）
          </el-radio-button>
        </el-radio-group>
        <span class="sbd-dim">{{ tt('只排所选这一组;其余组在下方点名排除') }}</span>
      </div>
      <div v-else-if="chosenChain" class="sbd-line">
        <span class="sbd-lb">{{ tt('本批工序') }}</span><b class="sbd-chain">{{ chosenChain }}</b>
      </div>

      <el-alert v-if="excluded.length" type="warning" :closable="false" show-icon class="sbd-alert">
        <template #title>{{ tt('以下工单行工序不同或未绑路线，已排除，不参与本批') }}</template>
        <div v-for="x in excluded" :key="rowKeyOf(x.row)" class="sbd-ex">
          {{ rowKeyOf(x.row) }} ——
          {{ x.reason === 'noroute' ? tt('未绑定工艺路线') : tt('工序不同') + '（' + x.chain + '）' }}
        </div>
      </el-alert>

      <el-alert v-if="hasRateDiff" type="warning" :closable="false" show-icon class="sbd-alert">
        <template #title>{{ tt('本批各行换算率不同：计划量按各行自己的工艺路线分别换算，互不影响') }}</template>
        <div>{{ rateDiffText }}</div>
      </el-alert>

      <div class="sbd-line sbd-head">
        <span class="sbd-lb">{{ tt('每道工序的生产线（整批共用）') }}</span>
        <span class="sbd-team">{{ tt('排产班组') }}
          <el-select v-model="team" clearable filterable size="small" style="width: 130px">
            <el-option v-for="t in teams" :key="t" :label="t" :value="t" />
          </el-select>
        </span>
        <span class="sbd-dim">{{ tt('计划开工/完工按「上一道完工 = 下一道开工」自动带出，可逐道改') }}</span>
      </div>

      <el-table :data="steps" size="small" border max-height="260" empty-text="">
        <el-table-column type="index" :label="tt('序')" width="50" />
        <el-table-column :label="tt('工序')" prop="工序" width="100" />
        <el-table-column :label="tt('生产车间')" width="120">
          <template #default="{ row }">
            <span>{{ row['生产车间'] || '-' }}</span>
            <el-tag v-if="!row['限定车间']" size="small" type="info" class="sbd-tag">{{ tt('全部产线') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('生产线')" min-width="280">
          <template #default="{ row }">
            <el-select v-model="row.生产线" filterable size="small" style="width: 100%" :placeholder="tt('请选择生产线')">
              <el-option v-for="l in optionsOf(row).lines" :key="l.生产线" :value="l.生产线"
                         :label="`${l.生产线} · ${tt('负荷')}${num(l['今日负荷'])}/${tt('日产能')}${num(l['日产能'])}${l['提示'] === '超载' ? ' ⚠' + tt('超载') : ''}`" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="tt('换算率')" width="130" align="right">
          <template #default="{ $index }">{{ ratesText($index) }}</template>
        </el-table-column>
        <el-table-column :label="tt('本批计划量')" width="110" align="right">
          <template #default="{ $index }">{{ num(stepTotal(included, $index)) }}</template>
        </el-table-column>
        <!-- 计划开工/完工(2026-10-30 与单行排线弹窗同口径):上一道的计划完工 = 下一道的计划开工;
             日期链逻辑在 business/planChain.js(单行/批量共用),改任一日期沿链下传 -->
        <el-table-column :label="tt('计划开工日期')" width="155">
          <template #default="{ row, $index }">
            <el-date-picker v-model="row['计划开工日期']" type="date" value-format="YYYY-MM-DD" size="small"
                            style="width: 100%" @change="(v) => onStartChange($index, v)" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('计划完工日期')" width="155">
          <template #default="{ row, $index }">
            <el-date-picker v-model="row['计划完工日期']" type="date" value-format="YYYY-MM-DD" size="small"
                            style="width: 100%" @change="(v) => onDueChange($index, v)" />
          </template>
        </el-table-column>
        <!-- 实际开工/实际完工(只读):批量只收未排产的行,通常还是「-」;列保留与单行排线弹窗一致 -->
        <el-table-column :label="tt('实际开工')" width="140">
          <template #default="{ row }"><span class="sbd-actual">{{ row['实际开工'] || '-' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('实际完工')" width="140">
          <template #default="{ row }"><span class="sbd-actual">{{ row['实际完工'] || '-' }}</span></template>
        </el-table-column>
      </el-table>

      <div class="sbd-line sbd-head">
        <span class="sbd-lb">{{ tt('本批工单行（排产数量按各行自己算）') }}</span>
        <span class="sbd-dim">{{ tt('可逐行改小；不得超过该行需求数量') }}</span>
      </div>
      <el-table :data="included" size="small" border max-height="260" empty-text="">
        <el-table-column :label="tt('工单号#行号')" width="170">
          <template #default="{ row }">{{ rowKeyOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('产品 / 品名')" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            {{ (row['表头'] || {})['产品编码'] || row['产品编号'] || '-' }} / {{ (row['表头'] || {})['产品名称'] || row['品名'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="tt('需求数量')" width="90" align="right">
          <template #default="{ row }">{{ num(row['需求数量']) }}</template>
        </el-table-column>
        <el-table-column :label="tt('排产数量')" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.排产数量" :min="0" :max="row['需求数量'] > 0 ? row['需求数量'] : undefined"
                             :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('换算率')" width="110" align="right">
          <template #default="{ row }">{{ rateChainText(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('本行计划量')" width="150" align="right">
          <template #default="{ row }">{{ planChainText(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('提示')" width="130">
          <template #default="{ row }">
            <el-tag v-if="isRateDiff(row)" size="small" type="warning">{{ tt('换算率与首行不同') }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div class="sbd-note">
        {{ tt('说明') }}：{{ tt('上一道的计划完工日期 = 下一道的计划开工日期') }}。
        {{ tt('日排产请到「生产工单 / 工单排产」的日期列里逐格填写后保存') }}。
      </div>

      <div class="sbd-total">
        {{ tt('合计') }}：{{ tt('排产数量') }} {{ num(totalQty) }}
        <template v-for="(s, i) in steps" :key="s['工序'] + i">
          　{{ s['工序'] }} {{ tt('计划量') }} {{ num(stepTotal(included, i)) }}
        </template>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" :disabled="!included.length" @click="submit">
        {{ tt('排产') }} {{ included.length }} {{ tt('行') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { applyLineDefaults, lineOptions } from '@/business/routeDefaults'
import { cascadeDue, cascadeStart, normalizePlanChain } from '@/business/planChain'
import {
  num, groupByChain, splitBatch, planChainOf, stepTotal, ratesOf,
  rateChainOf, rateDiffFromFirst, rowKeyOf, validateQty,
} from '@/business/scheduleBatch'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 勾选的工单行(①待排产池的行:加工单号/行id/工单行号/需求数量/排产数量/产品…) */
  rows: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'changed'])

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

const loading = ref(false)
const saving = ref(false)
/** 每行补上 routeSteps 的表头/工序步骤/上次产线,并带一个可编辑的排产数量 */
const dataRows = ref([])
const lines = ref([])
const teams = ref([])
const team = ref('')
const chosenChain = ref('')
/** 本批共用的工序行(每道一条线) */
const steps = ref([])

const groups = computed(() => groupByChain(dataRows.value).groups)
const split = computed(() => splitBatch(dataRows.value, chosenChain.value))
const included = computed(() => split.value.included)
const excluded = computed(() => split.value.excluded)
const totalQty = computed(() => included.value.reduce((a, r) => a + num(r['排产数量']), 0))
const hasRateDiff = computed(() => included.value.length > 1 && steps.value.some((_, i) => ratesOf(included.value, i) !== null))
const rateDiffText = computed(() => steps.value
  .map((s, i) => {
    const r = ratesOf(included.value, i)
    return r ? `${s['工序']}：${r.join(' / ')}` : ''
  })
  .filter(Boolean)
  .join('；'))

/** 该道工序的候选线(与单行排线弹窗同一口径:限定车间才按车间筛,否则列全部启用线) */
function optionsOf(row) { return lineOptions(row, lines.value) }
/** 换算率列:各行一致显示统一率;不一致显示「各行不同(2/3)」 */
function ratesText(i) {
  const r = ratesOf(included.value, i)
  if (r) return `${tt('各行不同')}（${r.join('/')}）`
  return String(num(steps.value[i] && steps.value[i]['换算率']))
}
function rateChainText(row) { return rateChainOf(row).map((v) => num(v)).join('·') }
function planChainText(row) { return planChainOf(row).map((v) => num(v)).join('·') }
function isRateDiff(row) { return included.value.length > 1 && rateDiffFromFirst(included.value, row) }

/** 本批共用的工序行:取分组第一行的工序步骤;「上次产线」按同一套规则预填(仅填空行,不锁死) */
function syncSteps() {
  const first = included.value[0]
  if (!first) { steps.value = []; return }
  steps.value = (first['工序步骤'] || []).map((s) => {
    const rate = num(s['换算率'])
    return {
      工序: s['工序'],
      生产车间: s['生产车间'],
      限定车间: s['限定车间'] === true,
      换算率: rate > 0 ? rate : 1,
      工序序: s['工序序'],
      生产线: '',
      // 计划开工/完工 + 实际开工/完工(2026-10-30 与单行排线弹窗同口径):
      //   计划日期优先用 routeSteps 给的链默认(首道=今天、后续=上一道完工),打开后统一规整成一条链;
      //   实际开工/完工只读 —— 批量只收未排产的行,通常为空,显示「-」。
      计划开工日期: s['计划开工日期'] || '',
      计划完工日期: s['计划完工日期'] || '',
      实际开工: s['实际开工'] || '',
      实际完工: s['实际完工'] || '',
    }
  })
  applyLineDefaults(steps.value, first['上次产线'] || [], first['上次首道'] || {}, lines.value, {})
  // 计划链规整(与单行排线弹窗同一份纯逻辑 business/planChain.js):第 2 道起开工=上一道完工、保留原时长
  normalizePlanChain(steps.value)
}
/** 计划完工日变化 → 下一道开工日跟着变,并沿链下传(与单行排线弹窗同一份 planChain 逻辑) */
function onDueChange(index, v) { cascadeDue(steps.value, index, v) }
/** 计划开工日晚于本道完工 ⇒ 完工拉到开工日,并继续沿链下传 */
function onStartChange(index, v) { cascadeStart(steps.value, index, v) }
watch(chosenChain, () => syncSteps())

async function load() {
  dataRows.value = []
  steps.value = []
  chosenChain.value = ''
  team.value = ''
  const rows = (props.rows || []).filter(Boolean)
  if (!rows.length) { visible.value = false; return }
  loading.value = true
  try {
    const reqs = rows.map((r) => request.post('/px/scheduleBoard/routeSteps', {
      加工单号: r['加工单号'],
      行id: r['行id'] ?? undefined,
    }))
    const [statsRes, ...stepRes] = await Promise.all([request.post('/px/scheduleBoard/stats', {}), ...reqs])
    lines.value = (statsRes.data || {})['产线'] || []
    teams.value = (statsRes.data || {})['班组'] || []
    dataRows.value = rows.map((r, i) => {
      const d = (stepRes[i] && stepRes[i].data) || {}
      const head = d['表头'] || {}
      const demand = num(head['需求数量'] ?? r['需求数量'])
      const cur = num(head['排产数量'] ?? r['排产数量'])
      return {
        ...r,
        表头: head,
        工序步骤: d['工序步骤'] || [],
        上次产线: d['上次产线'] || [],
        上次首道: d['上次首道'] || {},
        需求数量: demand,
        // 默认与单行弹窗同口径:当前排产数量>0 用它,否则取需求数量
        排产数量: cur > 0 ? cur : demand,
      }
    })
    const gs = groups.value
    chosenChain.value = gs.length ? gs[0].chain : ''
    syncSteps()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('读取工艺路线失败'))
    dataRows.value = []
  } finally {
    loading.value = false
  }
}

async function submit() {
  const miss = steps.value.filter((s) => !s['生产线'])
  if (miss.length) {
    ElMessage.warning(`${tt('还有工序未选生产线')}：${miss.map((s) => s['工序']).join('、')}`)
    return
  }
  const bad = validateQty(included.value)
  if (bad.length) {
    const q = bad.filter((b) => b.reason === 'qty').map((b) => rowKeyOf(b.row))
    const o = bad.filter((b) => b.reason === 'over').map((b) => rowKeyOf(b.row))
    const msg = []
    if (q.length) msg.push(`${tt('排产数量必须大于 0')}：${q.join('、')}`)
    if (o.length) msg.push(`${tt('排产数量超过需求数量')}：${o.join('、')}`)
    ElMessage.warning(msg.join('；'))
    return
  }
  saving.value = true
  const ok = []
  const fail = []
  const bodySteps = steps.value.map((s) => ({
    工序: s['工序'],
    生产线: s['生产线'],
    // 计划时间(2026-10-30):与单行排产同一口径 —— 上一道计划完工日 = 下一道计划开工日
    计划开工日期: s['计划开工日期'] || undefined,
    计划完工日期: s['计划完工日期'] || undefined,
  }))
  for (const row of included.value.slice()) {
    try {
      await request.post('/px/scheduleBoard/preplan', {
        加工单号: row['加工单号'],
        行id: row['行id'] ?? undefined,
        排产班组: team.value || undefined,
        排产数量: num(row['排产数量']),
        步骤: bodySteps,
      })
      ok.push(rowKeyOf(row))
    } catch (e) {
      fail.push(`${rowKeyOf(row)}：${e?.response?.data?.message || tt('排线失败')}`)
    }
  }
  saving.value = false
  emit('changed')
  if (!fail.length) {
    ElMessage.success(`${tt('已排产')} ${ok.length} ${tt('行')}`)
    visible.value = false
    return
  }
  ElMessageBox.alert(
    `${tt('成功')} ${ok.length} ${tt('行')}，${tt('失败')} ${fail.length} ${tt('行')}：\n${fail.join('\n')}`,
    tt('批量排产结果'),
    { type: 'warning', confirmButtonText: tt('知道了') },
  ).catch(() => {})
  // 全失败:留在弹窗里改完再试(成功的已落库、会从待排产池消失,不会重复排)
  if (ok.length) visible.value = false
}

watch(() => props.modelValue, (v) => { if (v) load() })
</script>

<style scoped>
.sbd-body { min-height: 160px; }
.sbd-line { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; color: #303133; }
.sbd-head { margin-top: 10px; }
.sbd-lb { font-weight: 600; color: #303133; }
.sbd-chain { color: #116a5b; }
.sbd-team { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
.sbd-dim { font-size: 12px; color: #909399; }
.sbd-alert { margin-bottom: 8px; }
.sbd-ex { font-size: 12px; line-height: 1.7; }
.sbd-tag { margin-left: 4px; }
.sbd-actual { font-size: 12px; color: #909399; }
.sbd-note { margin-top: 8px; font-size: 12px; color: #909399; line-height: 1.6; }
.sbd-total { margin-top: 8px; font-size: 12px; color: #606266; }
</style>
