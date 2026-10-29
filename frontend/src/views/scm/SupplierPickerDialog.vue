<!-- ============================================================================
     SupplierPickerDialog.vue — 供应商勾选弹窗(2026-10-25)
     ----------------------------------------------------------------------------
     用户口径:「供应商权限配置的不要下来框,要是可以勾选的弹窗。单据的关联供应商基础资料是一样的。」
             「每次勾选,账号密码都要对应变化」→ 实际只要账号(=供应商编码),密码/姓名不动。

     数据源 = 账套内**供应商档案**(`dm_gf`,面板 GFDA)——与单据里「关联供应商」参照弹窗同一份资料,
     所以列也照它来:编码 / 名称 / 联系人 / 电话 / 地址。

     交互照参照弹窗(ref-pick):顶部关键字 + 查询、表格单选(radio)、双击/确定回填。
     与 RefPickDialog 的区别:那是**通用参照**(要面板引擎 + 字段定义 + 查询权限),
     本页是独立 Vue 页面,用门户自己的 /supplier/portal/suppliers(内部同样读 dm_gf),互不影响。
     ============================================================================ -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('选择供应商')" width="880px" append-to-body destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)" @open="onOpen">
    <div class="spd">
      <div class="spd-toolbar">
        <el-input v-model="keyword" clearable size="small" class="spd-kw"
          :placeholder="tt('输入关键字过滤(编码/名称/联系人/电话)')"
          @keyup.enter="load" @clear="load">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" type="primary" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
        <span class="spd-tip">{{ tt('共') }} {{ rows.length }} {{ tt('条') }}</span>
      </div>
      <el-table :data="rows" v-loading="loading" size="small" border height="360" highlight-current-row
        :empty-text="loading ? tt('加载中…') : tt('没有符合条件的供应商')"
        :row-class-name="rowClass" @row-click="pick" @row-dblclick="(row) => { pick(row); confirm() }">
        <!-- 勾选列:纯展示(pointer-events:none),真正的选中靠整行点击 ——
             不依赖 el-radio 在表格里的内部行为,点哪都能选,双击直接确定。 -->
        <el-table-column width="46" align="center">
          <template #default="{ row }">
            <span class="spd-radio" :class="{ on: row.code === currentCode }"></span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('供应商编码')" prop="code" width="140" show-overflow-tooltip />
        <el-table-column :label="tt('供应商名称')" prop="name" min-width="240" show-overflow-tooltip />
        <el-table-column :label="tt('联系人')" prop="contact" width="110" show-overflow-tooltip />
        <el-table-column :label="tt('电话')" prop="tel" width="150" show-overflow-tooltip />
        <el-table-column :label="tt('地址')" prop="addr" min-width="220" show-overflow-tooltip />
      </el-table>
    </div>
    <template #footer>
      <span class="spd-selected">{{ currentLabel }}</span>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!currentCode" @click="confirm">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 当前已绑定的供应商编码(打开时高亮/预选) */
  value: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'picked'])

const keyword = ref('')
const rows = ref([])
const loading = ref(false)
const currentCode = ref('')

const currentLabel = computed(() => {
  const hit = (rows.value || []).find((r) => r.code === currentCode.value)
  if (!hit) return currentCode.value ? String(currentCode.value) : ''
  return `${hit.code} ${hit.name || ''}`
})

function onOpen() {
  keyword.value = ''
  currentCode.value = props.value || ''
  load()
}

async function load() {
  loading.value = true
  try {
    const r = await request.get('/supplier/portal/suppliers', { params: { keyword: keyword.value || '' } })
    if (r?.code && r.code !== 200) throw new Error(r.message || tt('没有该面板的权限'))
    rows.value = r?.data || []
    // 过滤后原选中项可能不在列表里:仍保留编码(回填不丢),但列表里看不到高亮而已
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载供应商档案失败'))
  } finally {
    loading.value = false
  }
}

function rowClass({ row }) {
  return row && row.code === currentCode.value ? 'spd-row-on' : ''
}

function pick(row) {
  if (!row) return
  currentCode.value = row.code
}

function confirm() {
  if (!currentCode.value) { ElMessage.warning(tt('请选择一个供应商')); return }
  const hit = (rows.value || []).find((r) => r.code === currentCode.value)
  // 回传整行:调用方要用「编码 → 账号」的映射,顺带可展示名称
  emit('picked', hit || { code: currentCode.value, name: '' })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.spd-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.spd-kw { width: 300px; }
.spd-tip { font-size: 12px; color: #909399; margin-left: 4px; }
.spd-selected { margin-right: auto; font-size: 12px; color: #1c4f8a; }
/* 勾选圆点:纯展示,选中填色(整行点击负责选中,见模板注释) */
.spd-radio {
  display: inline-block; width: 14px; height: 14px; border-radius: 50%;
  border: 1px solid #c0c4cc; background: #fff; vertical-align: middle;
  pointer-events: none; position: relative;
}
.spd-radio.on { border-color: #1c4f8a; background: #fff; }
.spd-radio.on::after {
  content: ''; position: absolute; inset: 3px; border-radius: 50%; background: #1c4f8a;
}
:deep(.spd-row-on) { background: #eef4fc !important; cursor: pointer; }
:deep(.el-table__row) { cursor: pointer; }
</style>
