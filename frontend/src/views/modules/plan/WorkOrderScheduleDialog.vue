<!-- WorkOrderScheduleDialog.vue — 单工单排产弹窗(2026-10-05,用户口径)
     用户口径:「为当前生产工单增加排产功能,实现方式就用当前弹窗的形式,弹出经过唯一工单号的**快速排产**页面,
     只显示当前工单,而不是全部未排产工单」。
     做法:复用快速排产的同一套后端口径 —— 候选产线取 /px/processTask/nextProcess(按该工单**下一道工序**的功能收敛),
     提交走 /px/scheduleBoard/assign(与快速排产同一入口、同一守卫);区别只是**只带这一张工单**。
     可撤回:排产后如需改线,在快速排产里「撤销排产」即可(本弹窗不写额外数据)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('工单排产')" width="560px" append-to-body
             @update:model-value="(v) => emit('update:modelValue', v)">
    <div class="wsd">
      <div class="wsd-head">
        <b>{{ row['工单号'] }}</b><span v-if="row['工单行号']">#{{ row['工单行号'] }}</span>
        <el-tag v-if="row['生产线']" size="small" type="warning">已排产：{{ row['生产线'] }}</el-tag>
        <el-tag v-else size="small" type="info">{{ tt('未排产') }}</el-tag>
      </div>
      <el-descriptions :column="2" size="small" border>
        <el-descriptions-item :label="tt('产品')">{{ row['产品名称'] || row['物料编码'] }}</el-descriptions-item>
        <el-descriptions-item :label="tt('规格型号')">{{ row['规格型号'] || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="tt('需求数量')">{{ num(row['需求数量']) }}</el-descriptions-item>
        <el-descriptions-item :label="tt('交期')">{{ row['交货日期'] || row['计划完工日'] || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="tt('工艺路线')">{{ next['工艺路线'] || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="tt('下一道工序')">{{ next['下一道工序'] ? tt(next['下一道工序']) : '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-form label-width="90px" size="small" class="wsd-form">
        <el-form-item :label="tt('生产线')">
          <el-select v-model="form.line" filterable style="width: 100%" :placeholder="tt('选择生产线')">
            <el-option v-for="l in lines" :key="l" :label="l" :value="l" />
          </el-select>
          <div v-if="next['生产车间']" class="wsd-tip">
            {{ tt('只列') }}「{{ tt(next['生产车间']) }}」{{ tt('的产线') }}<span v-if="next['下一道工序']">（{{ tt('按下一道工序') }}：{{ tt(next['下一道工序']) }}）</span>
          </div>
        </el-form-item>
        <el-form-item :label="tt('排产数量')">
          <el-input-number v-model="form.qty" :min="1" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item :label="tt('排产班组')">
          <el-input v-model="form.team" :placeholder="tt('可空')" />
        </el-form-item>
        <el-form-item :label="tt('预开工日')">
          <el-date-picker v-model="form.start" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item :label="tt('预完工日')">
          <el-date-picker v-model="form.due" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item :label="tt('每箱数量')">
          <el-input-number v-model="form.perBox" :min="0" :controls="false" style="width: 100%" />
        </el-form-item>
      </el-form>
      <div v-if="row['生产线']" class="wsd-warn">
        {{ tt('该工单已排产,不能重复排入;换线请先在「快速排产」撤销排产,再重新排入') }}
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="loading" :disabled="!!row['生产线']" @click="submit">{{ tt('确认排产') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'done'])
const loading = ref(false)
const next = ref({})
const form = reactive({ line: '', qty: 0, team: '', start: '', due: '', perBox: 0 })
const num = (v) => Number(v || 0)
/** 候选产线:来自该工单「下一道工序」的功能(与快速排产同一口径) */
const lines = computed(() => next.value['候选产线'] || [])

async function loadNext() {
  const no = props.row?.['工单号']
  if (!no) return
  try {
    const res = await request.post('/px/processTask/nextProcess', { 工单号列表: [no] })
    const list = res.data || []
    next.value = list.find((x) => x['加工单号'] === no || x['工单号'] === no) || list[0] || {}
  } catch { next.value = {} }
  if (!lines.value.length && props.row?.['生产线']) next.value['候选产线'] = [props.row['生产线']]
}

watch(() => [props.modelValue, props.row?.['工单号']], ([v]) => {
  if (!v) return
  const today = new Date().toISOString().slice(0, 10)
  form.line = props.row?.['生产线'] || ''
  form.qty = num(props.row?.['需求数量']) || num(props.row?.['排产数量']) || 0
  form.team = ''
  form.start = today
  form.due = props.row?.['交货日期'] || props.row?.['计划完工日'] || ''
  form.perBox = 0
  loadNext()
})

async function submit() {
  if (props.row?.['生产线']) { ElMessage.warning(tt('该工单已排产,不能重复排入')); return }
  if (!form.line) { ElMessage.warning(tt('请选择生产线')); return }
  if (!(num(form.qty) > 0)) { ElMessage.warning(tt('请输入排产数量')); return }
  loading.value = true
  try {
    const res = await request.post('/px/scheduleBoard/assign', {
      rows: [{
        加工单号: props.row['工单号'], 行id: props.row['行id'],
        生产线: form.line, 排产数量: num(form.qty),
        排产班组: form.team || undefined, 预开工日: form.start || undefined,
        预完工日: form.due || undefined, 每箱数量: num(form.perBox) || undefined,
      }],
    })
    const d = res.data || {}
    const failed = d['失败行'] || []
    if (failed.length) { ElMessage.error(failed[0]); return }
    ElMessage.success(`${tt('已排产')} ${props.row['工单号']} → ${form.line}`)
    emit('update:modelValue', false)
    emit('done')
  } catch (e) { ElMessage.error(e?.response?.data?.message || tt('排产失败')) } finally { loading.value = false }
}
</script>

<style scoped>
.wsd { display: flex; flex-direction: column; gap: 10px; }
.wsd-head { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.wsd-form { margin-top: 4px; }
.wsd-tip { font-size: 12px; color: #909399; line-height: 1.4; }
.wsd-warn { font-size: 12px; color: #e6a23c; background: #fdf6ec; border: 1px solid #f5dab1; border-radius: 4px; padding: 6px 8px; }
</style>
