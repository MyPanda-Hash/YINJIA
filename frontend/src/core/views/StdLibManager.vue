<template>
  <div class="slm" v-loading="busy">
    <div class="slm-tip">
      {{ tt('下拉即可从标准库选择；勾选条目后可「编辑 / 停用 / 恢复启用」。编辑只改标准库条目本身，已录入单据里的内容不会被改动。') }}
    </div>
    <div v-if="showAdd" class="slm-add">
      <el-input v-model="newText" size="small" :placeholder="tt('新增条目')" @keyup.enter="add" />
      <el-button size="small" type="primary" @click="add">{{ tt('加入标准库') }}</el-button>
    </div>
    <div class="slm-actions">
      <el-button size="small" :disabled="checked.length !== 1" @click="startEdit">{{ tt('编辑') }}</el-button>
      <el-button size="small" :disabled="!checkedEnabled.length" @click="switchEnabled(0)">{{ tt('停用') }}</el-button>
      <el-button size="small" :disabled="!checkedDisabled.length" @click="switchEnabled(1)">{{ tt('恢复启用') }}</el-button>
      <el-button v-if="pickable" size="small" type="primary" plain :disabled="checked.length !== 1" @click="pick">{{ tt('填入') }}</el-button>
    </div>
    <el-table :data="rows" size="small" border max-height="360" row-key="id" @selection-change="(s) => (checked = s)">
      <el-table-column type="selection" width="42" />
      <el-table-column :label="tt('条目内容')" min-width="260">
        <template #default="{ row }">
          <el-input v-if="editingId === row.id && multiline" v-model="editText" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" @keyup.ctrl.enter="saveEdit" />
          <el-input v-else-if="editingId === row.id" v-model="editText" size="small" @keyup.enter="saveEdit" />
          <span v-else class="slm-text" :class="{ 'slm-off': !isOn(row) }" @dblclick="startEditRow(row)">{{ row.content }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('状态')" width="82" align="center">
        <template #default="{ row }">
          <span :class="isOn(row) ? 'slm-on' : 'slm-off'">{{ isOn(row) ? tt('已启用') : tt('已停用') }}</span>
        </template>
      </el-table-column>
      <el-table-column v-if="editingId" :label="tt('操作')" width="128" align="center">
        <template #default>
          <el-button size="small" type="primary" @click="saveEdit">{{ tt('确定') }}</el-button>
          <el-button size="small" @click="cancelEdit">{{ tt('取消') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!busy && !rows.length" class="slm-empty">{{ tt('暂无条目,请在上方新增') }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/core/request'
import { tt } from '@/i18n'

/**
 * 标准库维护(共用组件)
 * 数据源 yj_std_lib,按 lib(+item) 分组;条目正文可能是纯文本,也可能是 JSON(spec.test/insp.plan
 * 存结构化 JSON)——本组件只把它当字符串原样编辑/往返,不解析,避免改坏结构化条目。
 *
 * 不污染已录入数据:面板勾选录入时存的是**文本内容**,单据列不存条目 id,所以这里改条目
 * 只影响以后的勾选候选,历史单据原样不动(探针 tools/_probe-stdlib-edit.cjs 钉这条)。
 */
const props = defineProps({
  lib: { type: String, required: true },
  item: { type: String, default: '' },
  /** 新增条目的 item_code(实验室库统一 '默认';规格书章节库=章节名) */
  addItem: { type: String, default: '默认' },
  /** 是否提供「填入」动作(章节库要把它填到当前字段上) */
  pickable: { type: Boolean, default: false },
  /** 是否自带「新增条目」输入行(章节库正文是多行,用调用方自己的文本框) */
  showAdd: { type: Boolean, default: true },
})
const emit = defineEmits(['pick', 'changed'])

const rows = ref([])
const checked = ref([])
const busy = ref(false)
const newText = ref('')
const editingId = ref(null)
const editText = ref('')

const isOn = (r) => Number(r.enabled) !== 0
const checkedEnabled = computed(() => checked.value.filter(isOn))
const checkedDisabled = computed(() => checked.value.filter((r) => !isOn(r)))
const multiline = computed(() => String(editText.value || '').includes('\n'))

async function load() {
  if (!props.lib) return
  busy.value = true
  try {
    // all=1:维护界面要看得见已停用条目(灰显),业务下拉用的是默认列表(enabled=1)
    const res = await request.get('/stdlib/list', { params: { lib: props.lib, item: props.item || undefined, all: 1 } })
    rows.value = (res?.data || []).map((r) => ({ id: r.id, content: r.content, enabled: r.enabled, item: r.item }))
  } catch (e) {
    rows.value = []
  } finally {
    busy.value = false
  }
}
/** 外部拿到组件实例后刷新用 */
defineExpose({ load })

watch(() => [props.lib, props.item], () => { cancelEdit(); load() }, { immediate: true })

async function add() {
  const v = String(newText.value || '').trim()
  if (!v) return ElMessage.warning(tt('内容不能为空'))
  try {
    await request.post('/stdlib/add', { lib: props.lib, item: props.item || props.addItem, content: v })
    ElMessage.success(tt('已加入标准库'))
    newText.value = ''
    await load()
    emit('changed')
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}

function startEdit() {
  const row = checked.value[0]
  if (!row) return ElMessage.warning(tt('请先勾选一行'))
  startEditRow(row)
}
function startEditRow(row) {
  editingId.value = row.id
  editText.value = String(row.content ?? '')
}
function cancelEdit() {
  editingId.value = null
  editText.value = ''
}
async function saveEdit() {
  const id = editingId.value
  if (!id) return
  const v = String(editText.value ?? '')
  if (!v.trim()) return ElMessage.warning(tt('内容不能为空'))
  try {
    await request.post('/stdlib/update', { id, content: v })
    ElMessage.success(tt('已保存'))
    cancelEdit()
    await load()
    emit('changed')
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}

async function switchEnabled(enabled) {
  const list = enabled ? checkedDisabled.value : checkedEnabled.value
  if (!list.length) return
  try {
    for (const r of list) {
      await request.post(enabled ? '/stdlib/enable' : '/stdlib/remove', { id: r.id })
    }
    ElMessage.success(enabled ? tt('已恢复启用') : tt('已停用该条目'))
    await load()
    emit('changed')
  } catch (e) {
    ElMessage.error(tt('操作失败'))
  }
}

function pick() {
  const row = checked.value[0]
  if (!row) return ElMessage.warning(tt('请先勾选一行'))
  emit('pick', String(row.content ?? ''))
}
</script>

<style scoped>
.slm-tip { font-size: 12px; color: #8ba6bd; margin-bottom: 8px; line-height: 1.6; }
.slm-add { display: flex; gap: 8px; margin-bottom: 8px; }
.slm-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.slm-count { font-size: 12px; color: var(--t-text-3); }
.slm-text { word-break: break-all; white-space: pre-wrap; }
.slm-on { color: #16a34a; font-size: 12px; }
.slm-off { color: #a8b6c4; font-size: 12px; }
.slm-text.slm-off { color: #a8b6c4; text-decoration: line-through; }
.slm-empty { padding: 14px; text-align: center; color: #a8b6c4; font-size: 13px; }
</style>
