<template>
  <!-- StagePanel — 项目实施计划·阶段进度面板(与文书面板并列,结构化渲染10阶段) -->
  <div class="stage-panel">
    <div class="sp-header">
      <span class="sp-title">{{ tt('阶段进度管理') }}</span>
      <span class="sp-tip">{{ tt('填写各阶段计划信息；审核后可点击「完成」标记实际完成时间') }}</span>
    </div>
    <table class="sp-table">
      <thead>
        <tr>
          <th class="sp-th-num">{{ tt('阶段') }}</th>
          <th class="sp-th-content">{{ tt('计划内容') }}</th>
          <th class="sp-th-date">{{ tt('计划开始') }}</th>
          <th class="sp-th-date">{{ tt('计划完成') }}</th>
          <th class="sp-th-date">{{ tt('实际完成') }}</th>
          <th class="sp-th-person">{{ tt('责任人') }}</th>
          <th class="sp-th-op">{{ tt('操作') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="n in 10" :key="n" :class="{ 'sp-done': head['阶段'+n+'_实际完成'], 'sp-empty': !head['阶段'+n+'_计划内容'] }">
          <td class="sp-td-num">{{ n }}</td>
          <td class="sp-td-content">
            <el-input v-if="editable" v-model="head['阶段'+n+'_计划内容']" type="textarea" :autosize="{minRows:1,maxRows:3}" size="small" class="sp-input" maxlength="500" @input="emit('dirty')" />
            <span v-else class="sp-text">{{ head['阶段'+n+'_计划内容'] || '' }}</span>
          </td>
          <td class="sp-td-date">
            <el-date-picker
              v-if="editable"
              v-model="head['阶段'+n+'_计划开始']"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              size="small"
              class="sp-input sp-date"
              placeholder="YYYY-MM-DD"
              @change="onPlanStart(n, $event)"
            />
            <span v-else class="sp-text">{{ head['阶段'+n+'_计划开始'] || '' }}</span>
          </td>
          <td class="sp-td-date">
            <el-date-picker
              v-if="editable"
              v-model="head['阶段'+n+'_计划完成']"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              size="small"
              class="sp-input sp-date"
              placeholder="YYYY-MM-DD"
              @change="onPlanDone(n, $event)"
            />
            <span v-else class="sp-text">{{ head['阶段'+n+'_计划完成'] || '' }}</span>
          </td>
          <td class="sp-td-date">
            <span class="sp-text sp-actual" :class="{ 'sp-actual-done': head['阶段'+n+'_实际完成'] }">{{ head['阶段'+n+'_实际完成'] || '' }}</span>
          </td>
          <td class="sp-td-person">
            <el-input v-if="editable" v-model="head['阶段'+n+'_责任人']" size="small" class="sp-input sp-person" maxlength="50" @input="emit('dirty')" />
            <span v-else class="sp-text">{{ head['阶段'+n+'_责任人'] || '' }}</span>
          </td>
          <td class="sp-td-op">
            <el-button
              v-if="canOperate && head['阶段'+n+'_计划内容'] && !head['阶段'+n+'_实际完成']"
              type="success" size="small" :loading="loadingStage === n"
              @click="completeStage(n)"
            >{{ tt('完成') }}</el-button>
            <el-tag v-else-if="head['阶段'+n+'_实际完成']" type="success" size="small">{{ tt('已完成') }}</el-tag>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
/**
 * StagePanel — 项目实施计划·阶段进度面板
 * 与 DocSheet(纸面版式) 并列渲染:DocSheet 展示原有版式,本面板展示结构化阶段表格。
 * 数据直接读写 head 对象上的 阶段N_XXX 字段,与引擎保存机制天然对接。
 * 阶段完成按钮:调后端 callButton('RD_PLAN','阶段完成',{编号,阶段序号}) → 填写实际完成时间。
 *
 * 计划开始/计划完成用日期弹窗填写(2026-09-10 由纯文本输入框改为 el-date-picker):
 * 值一律以 YYYY-MM-DD 字符串存回表头(库里这两列是文本),与存量数据格式一致。
 * 填完某阶段「计划完成」后,若下一阶段「计划开始」为空则自动接上次日
 * (见 core/progress/stageProgress.js 的 chainNextStageStart,已单测),
 * 免得 10 个阶段的日期逐个手敲。
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { chainNextStageStart } from '@core/progress/stageProgress'

const props = defineProps({
  head: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  /** 单据是否已审核(阶段完成按钮仅在审核后可用) */
  audited: { type: Boolean, default: false },
  panelCode: { type: String, default: 'RD_PLAN' },
})
const emit = defineEmits(['dirty'])
const engine = usePanelRuntime()
const loadingStage = ref(0)

const canOperate = computed(() => props.audited && !props.editable)

/** 计划开始变更:归一空值为 ''(清空时 el-date-picker 给的是 null,别把 null 存进库) */
function onPlanStart(n, v) {
  props.head[`阶段${n}_计划开始`] = v || ''
  emit('dirty')
}

/** 计划完成变更:同上归一,并把下一阶段的「计划开始」接上次日(仅当其为空) */
function onPlanDone(n, v) {
  props.head[`阶段${n}_计划完成`] = v || ''
  chainNextStageStart(props.head, n)
  emit('dirty')
}

async function completeStage(n) {
  loadingStage.value = n
  try {
    const no = props.head['单据编号'] || props.head['编号'] || ''
    const res = await engine.callButton({
      panelCode: props.panelCode,
      buttonName: '阶段完成',
      formData: { 编号: no, 阶段序号: String(n) },
      buttonParam: {},
    })
    if (res?.['实际完成']) {
      props.head[`阶段${n}_实际完成`] = res['实际完成']
      ElMessage.success(`阶段${n} 已完成 (${res['实际完成']})`)
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || `阶段${n} 完成失败`)
  } finally {
    loadingStage.value = 0
  }
}
</script>

<style scoped>
.stage-panel { border: 1px solid #d4e4f1; border-radius: 6px; background: #fff; margin-top: 12px; overflow: hidden; }
.sp-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f0f7ff; border-bottom: 1px solid #d4e4f1; }
.sp-title { font-weight: 600; font-size: 14px; color: #1e5a8a; }
.sp-tip { font-size: 12px; color: #8ba6bd; }
.sp-table { width: 100%; border-collapse: collapse; }
.sp-th-num, .sp-td-num { width: 40px; text-align: center; }
.sp-th-content, .sp-td-content { min-width: 200px; }
.sp-th-date, .sp-td-date { width: 132px; text-align: center; }
.sp-th-person, .sp-td-person { width: 90px; }
.sp-th-op, .sp-td-op { width: 80px; text-align: center; }
.sp-table th { background: #e8f2fc; color: #3a6b95; font-size: 12px; font-weight: 600; padding: 6px 8px; border: 1px solid #d4e4f1; }
.sp-table td { padding: 4px 6px; border: 1px solid #e4edf5; font-size: 13px; vertical-align: middle; }
.sp-table tr.sp-done { background: #f0faf0; }
.sp-table tr.sp-done .sp-td-num { color: #52c41a; font-weight: 700; }
.sp-table tr.sp-empty td { opacity: 0.55; }
.sp-input { width: 100%; }
.sp-date { text-align: center; }
.sp-text { display: block; padding: 2px 4px; min-height: 22px; line-height: 22px; word-break: break-all; }
.sp-actual { text-align: center; color: #999; }
.sp-actual-done { color: #52c41a; font-weight: 600; }
</style>
