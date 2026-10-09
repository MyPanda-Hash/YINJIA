<!-- ProcessRoutePlanDialog.vue — 工序路线排线(2026-10-07 用户口径)
     在快速排产里对**当前工单**一次把整条工艺路线的线选好:每道工序各选一条生产线(与顶部选线同款),
     计划数量按工艺路线换算率算好(**只读**),计划完工日期可改。
     提交 = 排产(首道线写 plang.scx/plang_pc)+ 预排台账 wo_process_line;前道报工完工后自动转序到下一道。
     已排产的工单(=改线):首道线锁定为当前排产线,只能改后续各道(换线请先撤销排产)。 -->
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
        <!-- 换算率(2026-10-07):计划数量 = 工单行排产数量 × **本工序自己的**换算率(各道分开算,不累乘) -->
        <el-table-column :label="tt('换算率')" width="80" align="right">
          <template #default="{ row }">{{ num(row.换算率) }}</template>
        </el-table-column>
        <el-table-column :label="tt('计划数量')" width="110" align="right">
          <template #default="{ row }">{{ num(row.计划数量) }}</template>
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
const locked = computed(() => props.已排产)
const no = computed(() => props.加工单号 || '')
const lineNo = computed(() => props.工单行号 || head.value['工单行号'] || '')
const batch = computed(() => props.批次号 || head.value['批次号'] || '')

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
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
    const planned = d['已排台账'] || []
    rows.value = (d['工序步骤'] || []).map((s) => {
      const had = planned.find((p) => String(p['工序'] || '').trim() === String(s['工序'] || '').trim())
      const rate = Number(s['换算率'] || 0)
      return {
        工序: s['工序'], 生产车间: s['生产车间'], 工序序: s['工序序'],
        // 换算率(2026-10-07:此前映射里漏带该字段 ⇒ 列里恒显示 0)
        换算率: rate > 0 ? rate : 1,
        计划数量: s['计划数量'],
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
  saving.value = true
  try {
    const res = await request.post('/px/scheduleBoard/preplan', {
      加工单号: no.value,
      行id: props.行id ?? undefined,
      排产班组: team.value || undefined,
      步骤: rows.value.map((r) => ({ 工序: r.工序, 生产线: r.生产线, 计划完工日期: r['计划完工日期'] || undefined })),
    })
    const d = res.data || {}
    const plan = (d['计划线'] || []).join(' → ')
    ElMessage.success(`${tt('已排产')}${d['排产产线'] ? `「${d['排产产线']}」` : ''}；${tt('预排')}${d['预排道数'] || 0}${tt('道')}：${plan}`)
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
.prp-team { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.prp-dim { margin-top: 8px; font-size: 12px; color: #909399; line-height: 1.6; }
.prp-lock { font-size: 12px; color: #e6a23c; margin-top: 2px; }
</style>
