<!-- BOM 物料清单:主列表=父件(可新增),「编辑子件关系」弹窗维护该父件的子件;正/反向查询只读。 -->
<template>
  <div class="bom-md">
    <div class="bom-md-sec">
      <div class="bom-md-head">
        <div>
          <span class="bom-md-title">{{ reverse ? tt('子件(物料/原材料)') : tt('父件(产成品/物料)') }}</span>
          <span class="bom-md-count">{{ tt('共') }} {{ masters.length }} {{ tt('项') }}</span>
        </div>
        <el-button v-if="editable && !reverse" type="primary" size="small" :icon="Plus" @click="openAdd">
          {{ tt('新增父件') }}
        </el-button>
      </div>
      <el-table
        :data="masters"
        border
        size="small"
        height="280"
        highlight-current-row
        :row-class-name="masterRowCls"
        v-loading="loading"
        @row-click="onMasterClick"
      >
        <el-table-column type="index" :label="tt('序号')" width="60" align="center" :index="(index) => index + 1" />
        <template v-if="!reverse">
          <el-table-column prop="父件编码" :label="tt('父件编码')" min-width="130">
            <template #default="{ row }">{{ row['父件编码'] || '' }}</template>
          </el-table-column>
          <el-table-column prop="父件名称" :label="tt('父件名称')" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ row['父件名称'] || '' }}</template>
          </el-table-column>
          <el-table-column prop="版本号" :label="tt('版本号')" width="100">
            <template #default="{ row }">{{ row['版本号'] || '' }}</template>
          </el-table-column>
          <el-table-column prop="默认BOM" :label="tt('默认BOM')" width="90" align="center">
            <template #default="{ row }">{{ fmtBool(row['默认BOM']) }}</template>
          </el-table-column>
          <el-table-column prop="计量单位" :label="tt('计量单位')" width="100">
            <template #default="{ row }">{{ row['计量单位'] || '' }}</template>
          </el-table-column>
          <el-table-column prop="生产数量" :label="tt('生产数量')" width="100" align="right">
            <template #default="{ row }">{{ row['生产数量'] ?? '' }}</template>
          </el-table-column>
          <el-table-column prop="生产车间" :label="tt('生产车间')" min-width="120">
            <template #default="{ row }">{{ row['生产车间'] || '' }}</template>
          </el-table-column>
          <el-table-column prop="虚拟件" :label="tt('虚拟件')" width="80" align="center">
            <template #default="{ row }">{{ fmtBool(row['虚拟件']) }}</template>
          </el-table-column>
          <el-table-column prop="childCount" :label="tt('子件数')" width="80" align="center" />
          <el-table-column v-if="editable" :label="tt('操作')" width="130" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="openEdit(row)">
                {{ tt('编辑子件关系') }}
              </el-button>
            </template>
          </el-table-column>
        </template>
        <template v-else>
          <el-table-column prop="子件编码" :label="tt('子件编码')" min-width="110" show-overflow-tooltip />
          <el-table-column prop="子件名称" :label="tt('子件名称')" min-width="150" show-overflow-tooltip />
          <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="120" show-overflow-tooltip />
          <el-table-column prop="子件计量单位" :label="tt('单位')" width="90" />
        </template>
      </el-table>
    </div>

    <!-- 预览区:点击父件行后显示该父件的子件(只读;编辑请用「编辑子件关系」) -->
    <div class="bom-md-sec" v-if="!reverse">
      <div class="bom-md-head">
        <div>
          <span class="bom-md-title">{{ tt('子件') }}:{{ curMasterLabel }}</span>
          <span class="bom-md-count">{{ tt('共') }} {{ curRows.length }} {{ tt('项') }}</span>
        </div>
        <span v-if="editable" class="bom-md-tip">{{ tt('编辑请使用「编辑子件关系」') }}</span>
      </div>
      <el-table :data="curRows" border size="small" height="240">
        <el-table-column type="index" :label="tt('序号')" width="60" align="center" :index="(index) => index + 1" />
        <el-table-column prop="子件编码" :label="tt('子件编码')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="子件名称" :label="tt('子件名称')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="物料种类" :label="tt('物料种类')" width="100" />
        <el-table-column prop="物料规格" :label="tt('物料规格(外径/内径/长度)')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="外观要求" :label="tt('外观要求')" min-width="160" show-overflow-tooltip />
        <el-table-column prop="子件计量单位" :label="tt('单位')" width="90" />
        <el-table-column prop="定额数量" :label="tt('定额数量')" width="100" align="right" />
        <el-table-column prop="备注" :label="tt('备注')" min-width="130" show-overflow-tooltip />
      </el-table>
      <div v-if="!curRows.length" class="bom-md-empty">{{ tt('请选择上方父件查看对应子件') }}</div>
    </div>

    <!-- 反向查询:点子件行展示被用于的父件列表(只读,保持原交互) -->
    <div class="bom-md-sec" v-if="reverse">
      <div class="bom-md-head">
        <div>
          <span class="bom-md-title">{{ tt('父件(该子件被用于)') }}:{{ curMasterLabel }}</span>
          <span class="bom-md-count">{{ tt('共') }} {{ curRows.length }} {{ tt('项') }}</span>
        </div>
      </div>
      <el-table :data="curRows" border size="small" height="260">
        <el-table-column type="index" :label="tt('序号')" width="60" align="center" :index="(index) => index + 1" />
        <el-table-column prop="父件编码" :label="tt('父件编码')" min-width="110" show-overflow-tooltip />
        <el-table-column prop="父件名称" :label="tt('父件名称')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="版本号" :label="tt('版本号')" width="100" />
        <el-table-column prop="默认BOM" :label="tt('默认BOM')" width="90" align="center">
          <template #default="{ row }">{{ fmtBool(row['默认BOM']) }}</template>
        </el-table-column>
        <el-table-column prop="计量单位" :label="tt('计量单位')" width="90" />
        <el-table-column prop="生产数量" :label="tt('生产数量')" width="90" align="right" />
      </el-table>
      <div v-if="!curRows.length" class="bom-md-empty">{{ tt('请选择上方子件查看被用于的父件') }}</div>
    </div>

    <!-- 编辑子件关系弹窗:父件头(手输)+ 子件编辑表;保存=该父件行集全量重写 -->
    <el-dialog
      v-model="dlgVisible"
      :title="dlgMode === 'add' ? tt('新增父件') : tt('编辑子件关系')"
      width="980px"
      :close-on-click-modal="false"
      append-to-body
    >
      <div class="bom-dlg-head">
        <div class="bom-dlg-form">
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('父件编码') }}</span>
            <el-input v-model="dlgParent['父件编码']" :placeholder="tt('手输编码,如 T382')" :disabled="dlgMode !== 'add'" />
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('父件名称') }}</span>
            <el-input v-model="dlgParent['父件名称']" :placeholder="tt('如 除重金属炭棒滤芯')" />
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('版本号') }}</span>
            <el-input v-model="dlgParent['版本号']" />
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('默认BOM') }}</span>
            <el-switch v-model="dlgParent['默认BOM']" />
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('计量单位') }}</span>
            <el-select v-model="dlgParent['计量单位']" filterable allow-create clearable>
              <el-option v-for="option in optionsOf('计量单位')" :key="option" :label="option" :value="option" />
            </el-select>
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('生产数量') }}</span>
            <el-input-number v-model="dlgParent['生产数量']" :controls="false" :min="0" />
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('生产车间') }}</span>
            <el-select v-model="dlgParent['生产车间']" filterable allow-create clearable>
              <el-option v-for="option in optionsOf('生产车间')" :key="option" :label="option" :value="option" />
            </el-select>
          </div>
          <div class="bom-dlg-field">
            <span class="bom-dlg-label">{{ tt('虚拟件') }}</span>
            <el-switch v-model="dlgParent['虚拟件']" />
          </div>
        </div>
        <div class="bom-dlg-tip">{{ tt('父件编码与名称为该 BOM 的标识;子件关系在下方维护,保存后整单生效。') }}</div>
      </div>

      <div class="bom-dlg-child-head">
        <span class="bom-md-title">{{ tt('子件') }}</span>
        <span class="bom-md-count">{{ tt('共') }} {{ dlgChildren.length }} {{ tt('项') }}</span>
        <el-button type="primary" size="small" :icon="Plus" @click="addChild">{{ tt('新增子件') }}</el-button>
      </div>
      <el-table :data="dlgChildren" :row-key="childRowKey" border size="small" max-height="320">
        <el-table-column type="index" :label="tt('序号')" width="55" align="center" :index="(index) => index + 1" />
        <el-table-column prop="子件编码" :label="tt('子件编码')" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row['子件编码']" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="子件名称" :label="tt('子件名称')" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row['子件名称']" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row['规格型号']" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="物料种类" :label="tt('物料种类')" width="110">
          <template #default="{ row }">
            <el-select v-model="row['物料种类']" filterable allow-create clearable @change="emitRows">
              <el-option v-for="o in materialTypes" :key="o" :label="o" :value="o" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="物料规格" :label="tt('物料规格(外径/内径/长度)')" min-width="150">
          <template #default="{ row }">
            <el-input v-model="row['物料规格']" placeholder="外径: mm 内径: mm 长度: mm" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="外观要求" :label="tt('外观要求')" min-width="150">
          <template #default="{ row }">
            <el-input v-model="row['外观要求']" placeholder="无脏污、破损等" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="子件计量单位" :label="tt('单位')" width="100">
          <template #default="{ row }">
            <el-select v-model="row['子件计量单位']" filterable allow-create @change="emitRows">
              <el-option v-for="option in optionsOf('子件计量单位')" :key="option" :label="option" :value="option" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="定额数量" :label="tt('定额数量')" width="110" align="right">
          <template #default="{ row }">
            <el-input-number v-model="row['定额数量']" :controls="false" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="损耗率%" :label="tt('损耗率%')" width="100" align="right">
          <template #default="{ row }">
            <el-input-number v-model="row['损耗率%']" :controls="false" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="需用数量" :label="tt('需用数量')" width="110" align="right">
          <template #default="{ row }">
            <el-input-number v-model="row['需用数量']" :controls="false" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column prop="备注" :label="tt('备注')" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row['备注']" @change="emitRows" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="60" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="danger" :icon="Delete" :title="tt('删除子件')" @click="removeChild(row)" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="dlgVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveDialog">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <RefPickDialog v-model="refVisible" :field="refPick?.field" mode="header" @confirm="onRefConfirm" />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import RefPickDialog from './RefPickDialog.vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  fields: { type: Array, default: () => [] },
  documentNo: { type: String, default: '' },
  reverse: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:rows'])

/** 物料种类(来自产品文件·成型配方/组装BOM) */
const materialTypes = ['炭粉', '胶粉', '折算物料', '包装材料', '辅助材料']
const PARENT_KEYS = [
  '物料清单编码', '父件编码', '父件名称', '版本号', '默认BOM',
  '计量单位', '生产数量', '生产车间', '虚拟件', '预入仓库',
]
const localRows = ref([])
const activeKey = ref('')
const rowIds = new WeakMap()
let rowSeq = 0
const saving = ref(false)

function fieldOf(name) {
  return props.fields.find((field) => field.dataName === name) || { dataName: name, dataType: '文本' }
}

function defaultValue(name) {
  const field = fieldOf(name)
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.dataType === '是否') return false
  if (field.dataType === '小数' || field.dataType === '整数') return 0
  return ''
}

function optionsOf(name) {
  return fieldOf(name).options || []
}

/** 锚点行:子件编码为空的行,仅用于让"暂无子件的父件"存在于平表 */
function isAnchor(row) {
  return !String(row['子件编码'] ?? '').trim()
}

function resetFromProps() {
  localRows.value = (props.rows || []).map((row) => ({ ...row }))
  if (!activeKey.value || !localRows.value.some((row) => row['父件编码'] === activeKey.value)) {
    activeKey.value = localRows.value[0]?.['父件编码'] || ''
  }
}

watch(() => [props.rows, props.documentNo, props.editable], resetFromProps, { immediate: true })

/** 主表=父件口径:按 父件编码 分组,父件字段取组内首行 */
const masters = computed(() => {
  if (props.reverse) {
    const seen = new Map()
    for (const row of localRows.value) {
      const key = row['子件编码']
      if (!key || seen.has(key)) continue
      seen.set(key, row)
    }
    return [...seen.values()]
  }
  const seen = new Map()
  for (const row of localRows.value) {
    const key = String(row['父件编码'] || '').trim()
    if (!key || !seen.has(key)) {
      seen.set(key, { ...row, childCount: 0 })
    }
    if (seen.has(key) && !isAnchor(row)) seen.get(key).childCount++
  }
  return [...seen.values()]
})

watch(
  masters,
  (list) => {
    if (props.reverse) {
      if (!list.some((master) => master['子件编码'] === activeKey.value)) {
        activeKey.value = list[0]?.['子件编码'] || ''
      }
      return
    }
    if (!list.some((master) => master['父件编码'] === activeKey.value)) {
      activeKey.value = list[0]?.['父件编码'] || ''
    }
  },
  { immediate: true }
)

const curMasterLabel = computed(() => {
  if (props.reverse) {
    const master = masters.value.find((m) => m['子件编码'] === activeKey.value)
    return master ? `${master['子件编码'] || ''} ${master['子件名称'] || ''}`.trim() : '-'
  }
  const master = masters.value.find((m) => m['父件编码'] === activeKey.value)
  return master ? `${master['父件编码'] || ''} ${master['父件名称'] || ''}`.trim() : '-'
})

const curRows = computed(() => {
  if (!activeKey.value) return []
  const key = activeKey.value
  if (props.reverse) return localRows.value.filter((row) => row['子件编码'] === key)
  return localRows.value.filter((row) => row['父件编码'] === key && !isAnchor(row))
})

function onMasterClick(row) {
  activeKey.value = props.reverse ? row['子件编码'] : row['父件编码']
}

function masterRowCls({ row }) {
  const key = props.reverse ? row['子件编码'] : row['父件编码']
  return key === activeKey.value ? 'row-cur' : ''
}

function fmtBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1' ? tt('是') : ''
}

function emitRows() {
  emit('update:rows', localRows.value.map((row) => ({ ...row })))
}

// ============ 编辑子件关系弹窗 ============
const dlgVisible = ref(false)
const dlgMode = ref('edit') // add | edit
const dlgParent = reactive({})
const dlgChildren = ref([])
const dlgOldCode = ref('')

function blankParent() {
  const out = {}
  for (const key of PARENT_KEYS) out[key] = defaultValue(key)
  return out
}

function nextListCode() {
  let max = 0
  for (const row of localRows.value) {
    const m = /^WL-(\d+)$/.exec(String(row['物料清单编码'] || ''))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return 'WL-' + String(max + 1).padStart(3, '0')
}

function openAdd() {
  if (!props.editable) return
  dlgMode.value = 'add'
  Object.assign(dlgParent, blankParent(), { 默认BOM: true })
  dlgChildren.value = []
  dlgOldCode.value = ''
  dlgVisible.value = true
}

function openEdit(row) {
  if (!props.editable) return
  dlgMode.value = 'edit'
  dlgOldCode.value = String(row['父件编码'] || '')
  const head = {}
  for (const key of PARENT_KEYS) head[key] = row[key] ?? defaultValue(key)
  head['父件编码'] = dlgOldCode.value
  Object.assign(dlgParent, head)
  dlgChildren.value = localRows.value
    .filter((r) => String(r['父件编码'] || '') === dlgOldCode.value && !isAnchor(r))
    .map((r) => ({ ...r }))
  dlgVisible.value = true
}

function addChild() {
  const row = {}
  for (const field of props.fields) row[field.dataName] = defaultValue(field.dataName)
  for (const key of PARENT_KEYS) row[key] = dlgParent[key]
  row['物料清单编码'] = nextListCode()
  dlgChildren.value.push(row)
}

function removeChild(row) {
  const index = dlgChildren.value.indexOf(row)
  if (index >= 0) dlgChildren.value.splice(index, 1)
}

/** 弹窗保存:校验 → 重写该父件行集(含改名迁移/锚点行) → 提交全量行集 */
function saveDialog() {
  const code = String(dlgParent['父件编码'] || '').trim()
  const name = String(dlgParent['父件名称'] || '').trim()
  if (!code) return ElMessage.warning(tt('父件编码不能为空'))
  if (!name) return ElMessage.warning(tt('父件名称不能为空'))
  const conflict = masters.value.some((m) => m['父件编码'] === code && m['父件编码'] !== dlgOldCode.value)
  if (conflict) return ElMessage.warning(tt('父件编码已存在:') + code)
  for (let i = 0; i < dlgChildren.value.length; i++) {
    const child = dlgChildren.value[i]
    if (!String(child['子件编码'] || '').trim()) return ElMessage.warning(tt('子件第 {n} 行子件编码不能为空').replace('{n}', i + 1))
    if (String(child['子件编码']) === code) return ElMessage.warning(tt('子件第 {n} 行不能与父件相同').replace('{n}', i + 1))
  }
  saving.value = true
  try {
    // 移除旧父件的全部行(含锚点行;若父件编码被改名,旧码行整体迁移)
    const kept = localRows.value.filter((r) => String(r['父件编码'] || '') !== dlgOldCode.value)
    const head = {}
    for (const key of PARENT_KEYS) head[key] = dlgParent[key]
    head['父件编码'] = code
    head['父件名称'] = name
    if (dlgChildren.value.length) {
      for (const child of dlgChildren.value) {
        const row = { ...child }
        for (const key of PARENT_KEYS) row[key] = head[key]
        kept.push(row)
      }
    } else {
      // 无子件:保留一条锚点行,让父件本尊存在于档案
      const anchor = {}
      for (const field of props.fields) anchor[field.dataName] = defaultValue(field.dataName)
      for (const key of PARENT_KEYS) anchor[key] = head[key]
      anchor['子件编码'] = ''
      anchor['物料清单编码'] = nextListCode()
      kept.push(anchor)
    }
    localRows.value = kept
    activeKey.value = code
    emitRows()
    dlgVisible.value = false
    ElMessage.success(tt('已更新子件关系,请点击「保存」落库'))
  } finally {
    saving.value = false
  }
}

// ============ 校验(PanelxList 保存前调用) ============
function validate() {
  if (!props.editable || props.reverse) return ''
  for (const row of localRows.value) {
    if (!String(row['父件编码'] || '').trim()) return tt('父件编码不能为空')
  }
  return ''
}

// 保留参照弹窗能力(父件/子件参照选择,供后续扩展;当前弹窗内为手输)
const refVisible = ref(false)
const refPick = ref(null)
function onRefConfirm() {
  refVisible.value = false
  refPick.value = null
}

function childRowKey(row) {
  if (!rowIds.has(row)) rowIds.set(row, `bom-child-${++rowSeq}`)
  return rowIds.get(row)
}

defineExpose({ validate })
</script>

<style scoped>
.bom-md {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
  min-height: 100%;
  box-sizing: border-box;
}
.bom-md-sec {
  border: 1px solid var(--t-border, #e4e7ed);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.bom-md-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 5px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid var(--t-border, #e4e7ed);
}
.bom-md-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.bom-md-count {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}
.bom-md-tip {
  font-size: 12px;
  color: #909399;
}
.bom-md-empty {
  padding: 14px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
.bom-dlg-head {
  margin-bottom: 8px;
}
.bom-dlg-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 14px;
}
.bom-dlg-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bom-dlg-label {
  font-size: 12px;
  color: #606266;
}
.bom-dlg-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.bom-dlg-child-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0 6px;
}
.bom-dlg-child-head .el-button {
  margin-left: auto;
}
:deep(.row-cur td) {
  background: #ecf5ff !important;
}
:deep(.el-input-number),
:deep(.el-select) {
  width: 100%;
}
</style>
