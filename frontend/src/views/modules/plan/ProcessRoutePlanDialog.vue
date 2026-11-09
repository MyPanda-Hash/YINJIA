<!-- ProcessRoutePlanDialog.vue — 工序路线排线(2026-10-07 用户口径)
     在快速排产里对**当前工单**一次把整条工艺路线的线选好:每道工序各选一条生产线(与顶部选线同款),
     计划数量按工艺路线换算率算好(**只读**),计划完工日期可改。
     提交 = 排产(首道线写 plang.scx/plang_pc)+ 预排台账 wo_process_line;前道报工完工后自动转序到下一道。
     已排产的工单(=改线):首道线锁定为当前排产线,只能改后续各道(换线请先撤销排产)。
     2026-10-16(**排产数量回来了**,用户口径「实现排产数」):顶部「排产数量」可填/可改 ——
     参考库口径 pl_sl 是**排产确认量**:默认=需求数量、由排产员人工给定、可小于需求(部分排产);
     它同时是**各道计划数量的基数**(计划数量 = 排产数量 × 该工序换算率,改数量即时重算)。 -->
<template>
  <el-dialog v-model="visible" :title="tt('工序路线排线')" width="1180px" append-to-body destroy-on-close>
    <div v-loading="loading" class="prp-body">
      <div class="prp-head">
        <b>{{ tt('工单') }}：{{ no }}</b>
        <span v-if="lineNo">{{ tt('工单行号') }} {{ lineNo }}</span>
        <span v-if="batch">{{ tt('批次号') }} {{ batch }}</span>
        <span v-if="head['产品编码']">{{ head['产品编码'] }} / {{ head['产品名称'] }} {{ head['规格型号'] }}</span>
        <span v-if="head['工艺路线']" class="prp-route">{{ tt('工艺路线') }}：{{ head['工艺路线'] }}</span>
        <span v-if="head['交期']">{{ tt('交期') }}：{{ head['交期'] }}</span>
        <!-- 排产数量(2026-10-16):排产员人工给定 —— 默认=本行需求数量,可改小(部分排产);不得超需求 -->
        <span class="prp-qty">{{ tt('排产数量') }}
          <el-input-number v-model="qty" :min="0" :max="demand > 0 ? demand : undefined" :step="1"
                           :controls="false" size="small" style="width: 110px" />
          <span class="prp-demand">/ {{ tt('需求数量') }} {{ num(demand) }}</span>
        </span>
        <!-- 排产班组(2026-10-07:随顶部参数条移除而移入弹窗;写 plang.lb / plang_pc.lb) -->
        <span class="prp-team">{{ tt('排产班组') }}
          <el-select v-model="team" clearable filterable size="small" style="width: 130px">
            <el-option v-for="t in teams" :key="t" :label="t" :value="t" />
          </el-select>
        </span>
      </div>
      <el-alert v-if="!rows.length && !loading" type="warning" :closable="false" show-icon
                :title="tt('该工单未绑定工艺路线(或路线无工序明细),不能排线 —— 请先在订单结转/工单上选择工艺路线')" />
      <el-table v-else :data="rows" size="small" border max-height="380" empty-text="">
        <el-table-column type="index" :label="tt('序')" width="52" />
        <el-table-column :label="tt('工序')" prop="工序" width="110" />
        <el-table-column :label="tt('生产车间')" width="120">
          <template #default="{ row }">
            <span>{{ row['生产车间'] || '-' }}</span>
            <!-- 2026-10-28:不限定车间的行 ⇒ 下拉是全部启用线,给个标记免得以为筛选坏了 -->
            <el-tag v-if="!row['限定车间']" size="small" type="info" class="prp-open-tag">{{ tt('全部产线') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('生产线')" min-width="290">
          <template #default="{ row, $index }">
            <el-select v-model="row.生产线" filterable size="small" style="width: 100%"
                       :disabled="locked && $index === 0" :placeholder="tt('请选择生产线')">
              <el-option v-for="l in optionsOf(row)" :key="l.生产线" :value="l.生产线"
                         :label="`${l.生产线} · ${tt('负荷')}${num(l['今日负荷'])}/${tt('日产能')}${num(l['日产能'])}${l['提示'] === '超载' ? ' ⚠' + tt('超载') : ''}`" />
            </el-select>
            <!-- 条7(2026-10-25):按同物料上次排产带出的行,行内加来源小字(可逐行改,不锁死) -->
            <div v-if="row.线来源 === 'last'" class="prp-lock">{{ tt('按同物料上次排产带出，可改') }}</div>
            <!-- 2026-10-28:存量台账里的跨车间脏线(实测 GD-2026-10-0202 行6「装箱→2号车间」)——
                 这个值不在下拉里,照原样提交必被服务端拒(「与工序应进的X车间不一致」),
                 所以先标红让人知道要重选,而不是让他"选了但存不进去" -->
            <div v-if="lineNotInOptions(row)" class="prp-bad">{{ tt('原预排线与该工序车间不一致,请重新选择') }}</div>
            <div v-if="locked && $index === 0" class="prp-lock">{{ tt('首道线 = 当前排产线;换线请先撤销排产') }}</div>
          </template>
        </el-table-column>
        <!-- 换算率(2026-10-07):计划数量 = **排产数量** × **本工序自己的**换算率(各道分开算,不累乘)
             2026-10-16:基数改成顶部那个**本次排产数量** ⇒ 改数量时这一列即时重算 -->
        <el-table-column :label="tt('换算率')" width="80" align="right">
          <template #default="{ row }">{{ num(row.换算率) }}</template>
        </el-table-column>
        <el-table-column :label="tt('计划数量')" width="110" align="right">
          <template #default="{ row }">{{ num(planOf(row)) }}</template>
        </el-table-column>
        <!-- 计划开工日期(2026-10-29):上一道的「计划完工日期」= 下一道的「计划开工日期」。
             2026-10-30:按用户口径删除了「保存时自动把计划数量均摊成每日计划」——
             日排产只由用户在「生产工单 / 工单排产」的日期列里手工填。 -->
        <el-table-column :label="tt('计划开工日期')" width="160">
          <template #default="{ row, $index }">
            <el-date-picker v-model="row.计划开工日期" type="date" value-format="YYYY-MM-DD" size="small"
                            style="width: 100%" @change="(v) => onStartChange($index, v)" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('计划完工日期')" width="160">
          <template #default="{ row, $index }">
            <el-date-picker v-model="row.计划完工日期" type="date" value-format="YYYY-MM-DD" size="small"
                            style="width: 100%" @change="(v) => onDueChange($index, v)" />
          </template>
        </el-table-column>
        <!-- 实际开工/实际完工(只读):实际开工 = 该道**已审核报工的最早时间**(没报工就显示「-」);
             实际完工 = 该道已审报工的最大完工时间。计划与实际本来就不一致,分开展示。
             ⚠ 2026-10-30 用户报障「未进行排产就已经有实际开工日期」:原口径取台账「落实时间」,
               而 落实时间 曾被「订单结转建台账 / 排产」顺手写成当时时刻 ⇒ 没开工也显示开工。
               现在改按报工事实取最早时间,假时间自然消失(无需改库)。 -->
        <el-table-column :label="tt('实际开工')" width="140">
          <template #default="{ row }">
            <span class="prp-actual">{{ row['实际开工'] || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('实际完工')" width="140">
          <template #default="{ row }">
            <span class="prp-actual">{{ row['实际完工'] || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="rows.length" class="prp-dim">
        {{ tt('说明') }}：{{ tt('首道工序的线 = 该工单的排产线(报工闸门按它判已排产);其余各道为预排线,前道报工完工审核后自动转序到下一道的线') }}。
        {{ tt('计划数量 = 本工单行排产数量 × 该工序自己的换算率(各道分开算,不累乘)') }}。
        {{ tt('上一道的计划完工日期 = 下一道的计划开工日期') }}。
        {{ tt('日排产请到「生产工单 / 工单排产」的日期列里逐格填写后保存') }}。
        <!-- 2026-10-28:新工序/未建线车间的行,下拉是**全部启用产线** —— 说明一句,免得以为筛选坏了 -->
        <span v-if="hasOpenLineRow" class="prp-open">
          {{ tt('有工序没有固定车间(或该车间还没有产线),这些行的「生产线」已列出全部启用产线,可任选一条') }}。
        </span>
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" :disabled="!rows.length" @click="submit">
        {{ locked ? tt('保存预排线') : tt('排产') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { applyLineDefaults, lineOptions } from '@/business/routeDefaults'
import { cascadeDue, cascadeStart, invertedPlanRows, normalizePlanChain } from '@/business/planChain'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  加工单号: { type: String, default: '' },
  行id: { type: [Number, String], default: null },
  工单行号: { type: [Number, String], default: '' },
  批次号: { type: String, default: '' },
  /** 已排产的工单 = 改线模式:首道线锁定 */
  已排产: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'changed'])

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const loading = ref(false)
const saving = ref(false)
const head = ref({})
const rows = ref([])
const lines = ref([])
const teams = ref([])
const team = ref('')
/** 本次排产数量(2026-10-16 用户口径「实现排产数」):默认=本行现状(已排产→当前排产数量;未排产→需求数量) */
const qty = ref(0)
const locked = computed(() => props.已排产)
const no = computed(() => props.加工单号 || '')
const lineNo = computed(() => props.工单行号 || head.value['工单行号'] || '')
const batch = computed(() => props.批次号 || head.value['批次号'] || '')
/** 本行需求数量(排产数量的上限;后端同口径校验) */
const demand = computed(() => Number(head.value['需求数量'] || 0))

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
/** 该道工序的换算后计划数量 = **本次排产数量** × 该工序自己的换算率(改数量即时重算,与后端 preplanManual 同式) */
function planOf(row) { return Number(qty.value || 0) * Number(row?.['换算率'] || 1) }
/** 该道工序的候选线(2026-10-28 改调 business lineOptions 单一口径,与服务端 requiredShop 一一对应):
 *  · 后端说「限定车间」(工序登记过固定车间且该车间确有启用线)⇒ 只出该车间启用线(装箱→组装);
 *  · 否则(工序没登记固定车间 / 该车间还没建线 / 用户以后新建的工序)⇒ **全部启用线**,
 *    让人任何工序都排得进去 —— 这是用户口径「没有对应产线类型就显示全部产线」。 */
function optionsOf(row) {
  return lineOptions(row, lines.value).lines
}
/** 当前值不在下拉候选里(存量台账的跨车间/停用/脏线名)—— 提交必被拒,行内标红提示重选 */
function lineNotInOptions(row) {
  const cur = String(row?.['生产线'] || '').trim()
  if (!cur) return false
  return !optionsOf(row).some((l) => String(l['生产线'] || '').trim() === cur)
}
/** 有没有「不限定车间」的行 —— 有就在表格下方提示一句,别让人以为筛选坏了 */
const hasOpenLineRow = computed(() => rows.value.some((r) => !lineOptions(r, lines.value).limited))

/** 计划完工日变化 → 本道开工不得晚于完工,下一道的计划开工日跟着变,并沿链一路往下传(2026-10-29 用户口径;
 *  日期链纯逻辑在 business/planChain.js,与批量排产弹窗共用同一份) */
function onDueChange(index, v) {
  const fixedStart = cascadeDue(rows.value, index, v)
  // 2026-11-09 校验:原来改完工日早于本道开工日会留下「开工 11-09 / 完工 11-03」的倒挂,现在自动调平并明说
  // (整句走语言包,`{d}` 换成本次被调平的日期)
  if (fixedStart) ElMessage.warning(tt('计划开工日期不能晚于计划完工日期，已把开工日期调为 {d}').replace('{d}', fixedStart))
}
/** 计划开工日晚于计划完工日时,把完工日拉到开工日(避免提交被后端拒),并继续向后传链 */
function onStartChange(index, v) {
  const pushedDue = cascadeStart(rows.value, index, v)
  if (pushedDue) ElMessage.warning(tt('计划开工日期不能晚于计划完工日期，已把完工日期调为 {d}').replace('{d}', pushedDue))
}

async function load() {
  if (!no.value) return
  loading.value = true
  try {
    const [r1, r2] = await Promise.all([
      request.post('/px/scheduleBoard/routeSteps', { 加工单号: no.value, 行id: props.行id ?? undefined }),
      request.post('/px/scheduleBoard/stats', {}),
    ])
    lines.value = (r2.data || {})['产线'] || []
    teams.value = (r2.data || {})['班组'] || []
    const d = r1.data || {}
    head.value = d['表头'] || {}
    // 排产数量默认值:已排产的行显示**当前排产数量**(改数量),未排产的行默认**全排**(=需求数量)
    const cur = Number(head.value['排产数量'] || 0)
    qty.value = cur > 0 ? cur : Number(head.value['需求数量'] || 0)
    const planned = d['已排台账'] || []
    rows.value = (d['工序步骤'] || []).map((s) => {
      const had = planned.find((p) => String(p['工序'] || '').trim() === String(s['工序'] || '').trim())
      const rate = Number(s['换算率'] || 0)
      return {
        工序: s['工序'], 生产车间: s['生产车间'], 工序序: s['工序序'],
        // 2026-10-28:这道工序是否**只允许本车间产线**(后端 requiredShop 的口径)。
        // false = 工序没登记固定车间 / 该车间还没建线 ⇒ 下拉列全部启用产线(见 optionsOf)
        限定车间: s['限定车间'] === true,
        // 换算率(2026-10-07:此前映射里漏带该字段 ⇒ 列里恒显示 0)
        换算率: rate > 0 ? rate : 1,
        // 计划开工/完工(2026-10-29):台账已有值优先;没有则用后端给的计划链默认值
        // (首道=今天,后续=上一道计划完工日)
        计划开工日期: (had && had['计划开工日期']) || s['计划开工日期'] || '',
        计划完工日期: (had && had['计划完工日期']) || s['计划完工日期'] || '',
        // 实际开工/实际完工(只读,2026-10-30):实际开工 = 该道**已审核报工的最早时间**(没报工为「-」);
        // 实际完工 = 该道报工最大完工时间。都由后端按 scjl 报工事实算,前端只显示。
        实际开工: (had && had['实际开工']) || '',
        实际完工: s['实际完工'] || '',
        生产线: (had && (had['状态'] === '已落实' ? (had['实际生产线'] || had['计划生产线']) : had['计划生产线'])) || '',
      }
    })
    // 条7「排产带上次产线」(2026-10-25 定稿方案 v2):对「生产线」为空的行预填 ——
    // **仅填空行**(已排台账回填优先不动)、工序名两边 trim 后精确匹配、首道可用「上次首道」兜底、
    // 只预填归口车间(ProcessShop 口径)的启用线 —— 候选校验不通过(跨车间/停用/脏名)留空,绝不锁死。
    // 改线模式(locked)首道本就锁定,lockedFirst 双保险不覆盖。
    const lastFirst = d['上次首道'] && Object.keys(d['上次首道']).length ? d['上次首道'] : null
    applyLineDefaults(rows.value, d['上次产线'] || [], lastFirst, lines.value, { lockedFirst: locked.value })
    // 计划链规整:台账里的历史日期各排各的(实测 成型 10-29~10-31、切炭 10-08~10-15、
    // 装箱 10-30~10-29),打开时统一按「上一道完工日 = 下一道开工日」收口,避免出现开工晚于完工
    normalizePlanChain(rows.value)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('读取工艺路线失败'))
    rows.value = []
  } finally { loading.value = false }
}

async function submit() {
  const miss = rows.value.filter((r) => !r['生产线'])
  if (miss.length) {
    ElMessage.warning(`${tt('还有工序未选生产线')}：${miss.map((r) => r['工序']).join('、')}`)
    return
  }
  // 计划日期硬校验(2026-11-09 用户口径「开工日期不得大于完工日期」):改日期时已自动调平,这里再兜一道
  const badDates = invertedPlanRows(rows.value)
  if (badDates.length) {
    ElMessage.warning(`${tt('计划开工日期不能晚于计划完工日期')}: ${badDates
      .map((b) => `${b.row['工序'] || ''} ${b.row['计划开工日期']} → ${b.row['计划完工日期']}`.trim())
      .join('; ')}`)
    return
  }
  // 排产数量:前端只做"非空"这一层便利挡(上限由 el-input-number 的 :max 收口),
  // 范围/超需求/改小到低于已报工等**业务守卫一律由后端**给话术(避免同一句提示两处维护)
  const q = Number(qty.value || 0)
  if (!(q > 0)) { ElMessage.warning(`${tt('排产数量')} > 0`); return }
  saving.value = true
  try {
    const res = await request.post('/px/scheduleBoard/preplan', {
      加工单号: no.value,
      行id: props.行id ?? undefined,
      排产班组: team.value || undefined,
      排产数量: q,                                  // 2026-10-16:人工给定的排产数量(写 plang.pl_sl + plang_pc 镜像)
      步骤: rows.value.map((r) => ({
        工序: r.工序,
        生产线: r.生产线,
        // 计划时间(2026-10-29):上一道计划完工日 = 下一道计划开工日
        计划开工日期: r['计划开工日期'] || undefined,
        计划完工日期: r['计划完工日期'] || undefined,
      })),
    })
    const d = res.data || {}
    const plan = (d['计划线'] || []).join(' → ')
    ElMessage.success(`${tt('已排产')}${d['排产产线'] ? `「${d['排产产线']}」` : ''}${d['排产数量'] ? ` ${tt('排产数量')} ${num(d['排产数量'])}` : ''}；${tt('预排')}${d['预排道数'] || 0}${tt('道')}：${plan}`)
    emit('changed')
    visible.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('排线失败'))
  } finally { saving.value = false }
}

watch(() => props.modelValue, (v) => { if (v) load() })
</script>

<style scoped>
.prp-body { min-height: 120px; }
.prp-head { display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: #303133; margin-bottom: 8px; }
.prp-route { color: #116a5b; font-weight: 600; }
.prp-qty { display: inline-flex; align-items: center; gap: 4px; }
.prp-demand { color: #909399; font-size: 12px; }
.prp-team { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.prp-dim { margin-top: 8px; font-size: 12px; color: #909399; line-height: 1.6; }
.prp-actual { font-size: 12px; color: #909399; }
.prp-lock { font-size: 12px; color: #e6a23c; margin-top: 2px; }
/* 2026-10-28:不限定车间的行(全部产线可选)的标记与提示 */
.prp-open-tag { margin-left: 4px; }
.prp-open { color: #e6a23c; }
.prp-bad { font-size: 12px; color: #f56c6c; margin-top: 2px; }
</style>
