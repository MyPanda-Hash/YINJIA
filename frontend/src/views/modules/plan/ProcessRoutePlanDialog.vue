<!-- ProcessRoutePlanDialog.vue — 工序路线排线(2026-10-07 用户口径)
     在快速排产里对**当前工单**一次把整条工艺路线的线选好:每道工序各选一条生产线(与顶部选线同款),
     计划数量按工艺路线换算率算好(**只读**),计划完工日期可改。
     提交 = 排产(首道线写 plang.scx/plang_pc)+ 预排台账 wo_process_line;前道报工完工后自动转序到下一道。
     已排产的工单(=改线):首道线锁定为当前排产线,只能改后续各道(换线请先撤销排产)。
     2026-10-16(**排产数量回来了**,用户口径「实现排产数」):顶部「排产数量」可填/可改 ——
     参考库口径 pl_sl 是**排产确认量**:默认=需求数量、由排产员人工给定、可小于需求(部分排产);
     它同时是**各道计划数量的基数**(计划数量 = 排产数量 × 该工序换算率,改数量即时重算)。 -->
<template>
  <el-dialog v-model="visible" :title="tt('工序路线排线')" width="900px" append-to-body destroy-on-close>
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
        <el-table-column :label="tt('生产车间')" prop="生产车间" width="100" />
        <el-table-column :label="tt('生产线')" min-width="290">
          <template #default="{ row, $index }">
            <el-select v-model="row.生产线" filterable size="small" style="width: 100%"
                       :disabled="locked && $index === 0" :placeholder="tt('请选择生产线')">
              <el-option v-for="l in optionsOf(row)" :key="l.生产线" :value="l.生产线"
                         :label="`${l.生产线} · ${tt('负荷')}${num(l['今日负荷'])}/${tt('日产能')}${num(l['日产能'])}${l['提示'] === '超载' ? ' ⚠' + tt('超载') : ''}`" />
            </el-select>
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
        <el-table-column :label="tt('计划完工日期')" width="160">
          <template #default="{ row }">
            <el-date-picker v-model="row.计划完工日期" type="date" value-format="YYYY-MM-DD" size="small" style="width: 100%" />
          </template>
        </el-table-column>
      </el-table>
      <div v-if="rows.length" class="prp-dim">
        {{ tt('说明') }}：{{ tt('首道工序的线 = 该工单的排产线(报工闸门按它判已排产);其余各道为预排线,前道报工完工审核后自动转序到下一道的线') }}。
        {{ tt('计划数量 = 本工单行排产数量 × 该工序自己的换算率(各道分开算,不累乘)') }}。
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
/** 该道工序的候选线:启用线里车间匹配的(与顶部选线同口径) */
function optionsOf(row) {
  const shop = String(row['生产车间'] || '')
  const list = lines.value.filter((l) => !shop || String(l['生产车间'] || '') === shop)
  return list.length ? list : lines.value
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
        // 换算率(2026-10-07:此前映射里漏带该字段 ⇒ 列里恒显示 0)
        换算率: rate > 0 ? rate : 1,
        计划完工日期: (had && had['计划完工日期']) || s['计划完工日期'] || '',
        生产线: (had && (had['状态'] === '已落实' ? (had['实际生产线'] || had['计划生产线']) : had['计划生产线'])) || '',
      }
    })
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
      步骤: rows.value.map((r) => ({ 工序: r.工序, 生产线: r.生产线, 计划完工日期: r['计划完工日期'] || undefined })),
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
.prp-lock { font-size: 12px; color: #e6a23c; margin-top: 2px; }
</style>
