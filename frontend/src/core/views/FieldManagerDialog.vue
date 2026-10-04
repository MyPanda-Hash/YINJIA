<script setup>
// 字段管理(动态字段/备用列池):仅管理员;列表/表单/查询/导出由元数据引擎自动获得新字段。
// 规格见 docs/design/动态字段扩展-备用列池-V1.0.md §10;入口由 PanelxList「更多 ▼」注入。
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { extFieldOverview, extFieldAdd, extFieldRetire } from '@/business/engine'

// 2026-09-28 修「点关闭无反应」:本组件此前声明 visible prop + emit('update:visible'),
// 而父组件(PanelxList)用 v-model(即 modelValue / update:modelValue)⇒ 页脚「关闭」按钮
// 发出的 update:visible 没人监听(× 能关是 el-dialog 的 update:modelValue 经透传 attr 落回父级)。
// 统一为 Vue 标准 v-model 契约:modelValue + update:modelValue。
const props = defineProps({
  modelValue: Boolean,
  panelCode: String,
  /** 分页签面板(来料检验要求)才传:该面板的页签清单 [{value,label}] —— 自定义列必须指明住哪张表 */
  tabs: { type: Array, default: () => [] },
  /** 打开时默认选中的页签(一般是当前正在看的那张表) */
  defaultTab: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'done'])
const loading = ref(false)
const saving = ref(false)
const data = ref({ capacity: 20, fields: [], linePool: [] })
const form = ref({ label: '', labelEn: '', dataType: '文本', dictOptions: '', place: 'detail', inQuery: false, width: 120, required: false, confirmDirty: false, tab: '' })
/** 需要指定「所属页签」的面板:传了 tabs 就是 */
const needTab = () => Array.isArray(props.tabs) && props.tabs.length > 0
const blankForm = () => ({ label: '', labelEn: '', dataType: '文本', dictOptions: '', place: 'detail', inQuery: false, width: 120, required: false, confirmDirty: false, tab: needTab() ? (props.defaultTab || props.tabs[0].value) : '' })

watch(() => props.modelValue, (v) => { if (v) { form.value = blankForm(); load() } })

async function load() {
  loading.value = true
  try {
    data.value = await extFieldOverview(props.panelCode)
  } catch (e) {
    ElMessage.error(String(e?.message || e))
    emit('update:modelValue', false)
  } finally { loading.value = false }
}

function usedOf(pool) { return (pool || []).filter((p) => p.bound).length }

async function submit() {
  saving.value = true
  try {
    const payload = { ...form.value, panel: props.panelCode }
    const res = await extFieldAdd(payload)
    ElMessage.success(tt('字段已添加') + ':' + res.colName)
    form.value = blankForm()
    await load()
    emit('done')
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || String(e)
    if (String(msg).includes('历史数据') && !form.value.confirmDirty) {
      try {
        await ElMessageBox.confirm(msg + tt('。确认绑定该列?(数据将保留,与新字段同显)'), tt('占用列含历史数据'), { type: 'warning' })
        form.value.confirmDirty = true
        return submit()
      } catch { return }
    }
    ElMessage.error(msg)
  } finally { saving.value = false }
}

async function retire(f) {
  try {
    await ElMessageBox.confirm(tt('停用字段「') + f.label + tt('」?已录入数据将保留,重新绑定同名标签即可恢复显示。'), tt('停用字段'), { type: 'warning' })
  } catch { return }
  try {
    await extFieldRetire({ panel: props.panelCode, fieldId: f.id })
    ElMessage.success(tt('已停用'))
    await load()
    emit('done')
  } catch (e) { ElMessage.error(e?.response?.data?.message || String(e)) }
}
</script>

<template>
  <el-dialog :model-value="modelValue" :title="tt('字段管理')" width="640px" append-to-body :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading">
      <div class="fm-summary">
        {{ tt('动态字段') }} {{ data.fields.length }} / {{ data.capacity }}
        <template v-if="data.headPool"> · {{ tt('表头池') }} {{ usedOf(data.headPool) }}/{{ (data.headPool || []).length }} · {{ tt('明细池') }} {{ usedOf(data.linePool) }}/{{ (data.linePool || []).length }}</template>
        <template v-else> · {{ tt('池') }} {{ usedOf(data.linePool) }}/{{ (data.linePool || []).length }}</template>
      </div>
      <el-table :data="data.fields" size="small" max-height="200">
        <el-table-column prop="label" :label="tt('字段名')" min-width="140" />
        <el-table-column v-if="needTab()" prop="tab" :label="tt('所属页签')" width="130" />
        <el-table-column prop="col" :label="tt('承载列')" width="90" />
        <el-table-column prop="dataType" :label="tt('类型')" width="80" />
        <el-table-column prop="place" :label="tt('位置')" width="120" />
        <el-table-column :label="tt('操作')" width="80">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="retire(row)">{{ tt('停用') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-divider content-position="left">{{ tt('新增字段') }}</el-divider>
      <el-form :model="form" label-width="90px" size="small" @submit.prevent>
        <!-- 分页签面板:自定义列必须指明住哪张表(默认=当前页签) -->
        <el-form-item v-if="needTab()" :label="tt('所属页签')">
          <el-select v-model="form.tab" style="width: 220px">
            <el-option v-for="t in tabs" :key="t.value" :label="tt(t.label)" :value="t.value" />
          </el-select>
          <el-tooltip :content="tt('该列只出现在这张表里;检验数据记录带入时也按这张表的列走')" placement="top"><span class="fm-help">?</span></el-tooltip>
        </el-form-item>
        <el-form-item :label="tt('字段名')"><el-input v-model="form.label" :placeholder="tt('中文,禁 . % / ( ) 空格')" maxlength="60" /></el-form-item>
        <el-form-item :label="tt('英文名')"><el-input v-model="form.labelEn" maxlength="60" /></el-form-item>
        <el-form-item :label="tt('类型')">
          <el-select v-model="form.dataType" style="width: 160px">
            <el-option label="文本" value="文本" /><el-option label="下拉框" value="下拉框" /><el-option label="日期" value="日期" /><el-option label="是否" value="是否" />
          </el-select>
          <el-tooltip :content="tt('日期按 ISO 文本存储,排序正确;数值型请走正式迁移(需合计/排序精度)')" placement="top"><span class="fm-help">?</span></el-tooltip>
        </el-form-item>
        <el-form-item v-if="form.dataType === '下拉框'" :label="tt('词表')"><el-input v-model="form.dictOptions" :placeholder="tt('逗号分隔,如: 是,否,待定')" /></el-form-item>
        <el-form-item v-if="data.headPool" :label="tt('位置')">
          <el-radio-group v-model="form.place">
            <el-radio value="detail">{{ tt('明细行') }}</el-radio><el-radio value="header">{{ tt('表头') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="tt('进查询区')"><el-switch v-model="form.inQuery" /></el-form-item>
        <el-form-item :label="tt('必填')"><el-switch v-model="form.required" /></el-form-item>
        <el-form-item :label="tt('列宽')"><el-input-number v-model="form.width" :min="60" :max="400" /></el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('关闭') }}</el-button>
      <el-button type="primary" :loading="saving" @click="submit">{{ tt('添加') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.fm-summary { margin-bottom: 8px; font-size: 13px; color: #606266; }
.fm-help { margin-left: 6px; color: #909399; cursor: help; }
</style>
