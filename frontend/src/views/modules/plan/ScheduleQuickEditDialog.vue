<template>
  <!-- 排产快速调整(2026-10-31):双击日期格里的数量弹出,一个页面里集中改
       ①当天数量(人工指定/恢复自动) ②计划开工日/预定完成日 ③调线(仅工单排产页)。
       分块保存:只提交改动过的那块,哪块没权限就置灰。 -->
  <el-dialog v-model="visible" :title="tt('排产快速调整')" width="600px" append-to-body @open="onOpen">
    <!-- 只读头 -->
    <div class="sq-head">
      <div class="sq-no">
        {{ head.工单号 || head.加工单号 || '-' }}
        <span v-if="head.工单行号 != null" class="sq-sub">/ {{ tt('行') }} {{ head.工单行号 }}</span>
      </div>
      <div class="sq-meta">
        <span v-if="head.客户">{{ head.客户 }}</span>
        <span v-if="head.产品名称">{{ head.产品名称 }}</span>
        <span v-if="head.规格型号">{{ head.规格型号 }}</span>
      </div>
      <div class="sq-meta">
        <span>{{ tt('当前工序') }}:{{ opText }}</span>
        <span>{{ tt('生产线') }}:{{ line || '-' }}</span>
        <span>{{ tt('排产数量') }}:{{ num(head.排产数量) }}</span>
        <span>{{ tt('工序计划量') }}:{{ num(head.工序计划量) }}</span>
        <span v-if="over > 0" class="sq-over">{{ tt('超分配') }} {{ num(over) }}</span>
      </div>
    </div>

    <!-- ① 当天数量 -->
    <div class="sq-block">
      <div class="sq-title">{{ date }} · {{ tt('计划数量') }}</div>
      <div class="sq-row">
        <el-input-number v-model="qty" :min="0" :controls="false" class="sq-num" :disabled="!canDayPlan" />
        <el-button size="small" plain :disabled="!canDayPlan" @click="restoreAuto">{{ tt('恢复自动') }}</el-button>
        <span class="sq-hint" :class="{ manual: manualAtDay != null }">
          {{ manualAtDay != null ? tt('当前为人工指定') : tt('当前为系统自动摊') }}
        </span>
      </div>
      <div class="sq-note">{{ tt('改完其余天按剩余量自动重摊(合计不变);清空/恢复自动 = 交回系统摊') }}</div>
    </div>

    <!-- ② 排产日期 -->
    <div class="sq-block">
      <div class="sq-title">{{ tt('排产日期') }}</div>
      <div class="sq-row">
        <span class="sq-label">{{ tt('计划开工日期') }}</span>
        <el-date-picker v-model="st" type="date" value-format="YYYY-MM-DD" :clearable="false"
                        class="sq-date" :disabled="!canDayPlan" />
      </div>
      <div class="sq-row">
        <span class="sq-label">{{ tt('预定完成日期') }}</span>
        <el-date-picker v-model="cp" type="date" value-format="YYYY-MM-DD" :clearable="false"
                        class="sq-date" :disabled="!canDayPlan" />
      </div>
      <div class="sq-note">{{ tt('保存后同步工单/排产镜像/当前工序台账,日计划随之重算') }}</div>
    </div>

    <!-- ③ 调线(仅工单排产页:需要「调拨」权) -->
    <div v-if="supportTransfer" class="sq-block">
      <div class="sq-title">{{ tt('调线') }}</div>
      <div class="sq-row">
        <span class="sq-label">{{ tt('目标车间') }}</span>
        <el-select v-model="shop" clearable filterable class="sq-ctl" :disabled="!canTransfer || !shops.length"
                   @change="line2 = ''">
          <el-option v-for="x in shops" :key="x" :label="x" :value="x" />
        </el-select>
      </div>
      <div class="sq-row">
        <span class="sq-label">{{ tt('目标生产线') }}</span>
        <el-select v-model="line2" filterable class="sq-ctl" :disabled="!canTransfer || !lines.length"
                   :placeholder="tt('请选择目标生产线')">
          <el-option v-for="x in lines" :key="x.生产线"
                     :label="x.生产线 + (x.生产车间 ? '·' + x.生产车间 : '')" :value="x.生产线" />
        </el-select>
      </div>
      <div class="sq-row">
        <span class="sq-label">{{ tt('原因') }}</span>
        <el-input v-model="reason" class="sq-ctl" :placeholder="tt('选填')" :disabled="!canTransfer" />
      </div>
      <div v-if="tip" class="sq-tip">{{ tip }}</div>
      <div class="sq-note">{{ tt('调线走调拨轨迹(工单追溯可见),可用「撤回调拨」调回原线') }}</div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ tt('保存') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 排产快速调整弹窗(2026-10-31)——工单排产 / 生产工单 两页共用。
 *
 * 用户口径:「排产就那几个动作……双击那个数量弹出来,他可以在那儿修改:
 * 开工日期、预定完成日期、还有可以调线,当前的数量也要能够修改」。
 *
 * 分块保存(各自独立接口、各自权限):
 *   ① 数量 → /dayPlan/save(>0 = 人工指定该天;0 = 恢复自动),其余天由后端按剩余量重摊(守恒);
 *   ② 日期 → /rowDates(写 plang + 镜像 plang_pc + 同步当前工序台账区间);
 *   ③ 调线 → /transfer(复用调拨:写轨迹、可撤回、只能调当前工序的线)。
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@core/request'
import { saveDayPlan, saveRowDates } from '@/business/dayPlanApi'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 当前行(两页字段名略有差异:生产工单 计划开工日期 / 工单排产 开工日期) */
  row: { type: Object, default: () => ({}) },
  /** 双击进来的那一天(yyyy-MM-dd) */
  date: { type: String, default: '' },
  /** 当前产线(生产工单页取 row.生产线) */
  line: { type: String, default: '' },
  /** 是否出「调线」块(只有工单排产页接调拨权限) */
  supportTransfer: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const head = computed(() => props.row || {})
const opText = computed(() => head.value.工序日 || head.value.当前工序 || head.value.工序 || '-')
const over = computed(() => Number(head.value.超分配 || 0))
const manualAtDay = computed(() => {
  const m = head.value.人工指定 || {}
  return m[props.date] ?? null
})

const qty = ref(0)
const st = ref('')
const cp = ref('')
const origQty = ref(0)
const origSt = ref('')
const origCp = ref('')
const saving = ref(false)
/** 「恢复自动」= 数量按 0 提交(后端软删人工指定) */
const restore = ref(false)

// ── 调线(候选来自服务端 /transferTargets,与 /transfer 守卫同一口径)──
const shop = ref('')
const line2 = ref('')
const reason = ref('')
const shops = ref([])
const linesAll = ref([])
const canTransfer = ref(false)
const tip = ref('')
const lines = computed(() => linesAll.value.filter((l) => !shop.value || l.生产车间 === shop.value))

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }

async function onOpen() {
  const r = head.value || {}
  origQty.value = Number((r.日计划 || {})[props.date] || 0)
  qty.value = origQty.value || undefined
  restore.value = false
  origSt.value = String(r.计划开工日期 ?? r.开工日期 ?? '')
  origCp.value = String(r.计划完工日期 ?? r.交期 ?? '')
  st.value = origSt.value
  cp.value = origCp.value
  shop.value = ''; line2.value = ''; reason.value = ''
  shops.value = []; linesAll.value = []; canTransfer.value = false; tip.value = ''
  if (!props.supportTransfer) return
  try {
    const res = await request.post('/px/scheduleBoard/transferTargets', {
      rows: [{ 工单号: r.工单号 || r.加工单号, 行id: r.行id, 工单行号: r.工单行号 || r.行号, 批次号: r.批次号 }],
    })
    const d = res.data || {}
    shops.value = d['车间'] || []
    linesAll.value = d['产线'] || []
    canTransfer.value = d['可调拨'] !== false && linesAll.value.length > 0
    tip.value = d['提示'] || ''
    if (shops.value.length === 1) shop.value = shops.value[0]
  } catch (e) {
    canTransfer.value = false
    tip.value = e?.response?.data?.message || tt('调拨候选加载失败')
  }
}

function restoreAuto() { qty.value = undefined; restore.value = true }

async function save() {
  const r = head.value || {}
  const q = restore.value ? 0 : Number(qty.value || 0)
  const qtyChanged = q !== origQty.value || (restore.value && manualAtDay.value != null)
  const stChanged = String(st.value || '') !== origSt.value
  const cpChanged = String(cp.value || '') !== origCp.value
  const transfer = canTransfer.value && !!line2.value && line2.value !== (props.line || '')
  if (!qtyChanged && !stChanged && !cpChanged && !transfer) { ElMessage.info(tt('没有需要保存的改动')); return }
  saving.value = true
  try {
    // ① 数量(单格)
    if (qtyChanged) {
      const d = await saveDayPlan([{ 工单行id: r.行id, 工序: opText.value === '-' ? '' : opText.value,
        生产线: props.line || r.生产线 || '', 计划日期: props.date, 计划数量: q }])
      const o = (d['超分配'] || [])[0]
      if (o) ElMessage.warning(`${tt('人工指定已超出工序计划量')}: ${num(o['超出'])}${tt('(只提示,不拦保存)')}`)
    }
    // ② 日期(只有改动才提交,避免无谓同步)
    if (stChanged || cpChanged) {
      const d = await saveRowDates({ 行id: r.行id, 计划开工日期: st.value || undefined, 交期: cp.value || undefined })
      ElMessage.success(`${tt('排产日期已保存')}(${tt('同步工序')} ${d['同步工序行数'] ?? 0})`)
    }
    // ③ 调线(复用调拨:带轨迹、可撤回)
    if (transfer) {
      await ElMessageBox.confirm(`${tt('确认调拨')} → ${line2.value}？`, tt('调线'),
        { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
      const d = (await request.post('/px/scheduleBoard/transfer', {
        rows: [{ 工单号: r.工单号 || r.加工单号, 行id: r.行id, 工单行号: r.工单行号 || r.行号, 批次号: r.批次号 }],
        目标生产线: line2.value, 目标车间: shop.value || undefined, 原因: reason.value || undefined,
      })).data || {}
      const failed = d['失败行'] || []
      ElMessage.success(`${tt('已调拨')} ${d['调拨张数']} ${tt('张')} → ${d['目标'] || line2.value}`
        + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
    }
    visible.value = false
    emit('saved')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.response?.data?.message || tt('保存失败'))
  } finally { saving.value = false }
}
</script>

<style scoped>
.sq-head { padding-bottom: 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px; }
.sq-no { font-size: 16px; font-weight: 700; color: #1e6fb8; }
.sq-sub { font-size: 12px; font-weight: 400; color: #909399; }
.sq-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: #606266; margin-top: 6px; }
.sq-over { color: #f56c6c; font-weight: 700; }
.sq-block { padding: 10px 0; border-bottom: 1px dashed #ebeef5; }
.sq-block:last-of-type { border-bottom: none; }
.sq-title { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.sq-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.sq-label { font-size: 12px; color: #909399; min-width: 76px; text-align: right; }
.sq-num { width: 130px; }
.sq-date { width: 150px; }
.sq-ctl { width: 150px; }
.sq-hint { font-size: 12px; color: #909399; }
.sq-hint.manual { color: #e6a23c; font-weight: 600; }
.sq-note { font-size: 12px; color: #909399; line-height: 1.5; }
.sq-tip { font-size: 12px; color: #f56c6c; font-weight: 600; margin-top: 4px; }
</style>
