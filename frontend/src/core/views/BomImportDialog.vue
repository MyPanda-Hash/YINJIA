<!-- BomImportDialog.vue — 物料清单(WLBOM)Excel 批量导入:一个产品一张单(2026-10-21) -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('物料清单(BOM)批量导入')"
    width="860px"
    append-to-body
    @update:model-value="close"
  >
    <div class="bom-tip">
      {{ tt('Excel 每行 = 一个「产品 + 子件」组合;同一个产品的多行写同一个物料编码,导入后自动合成一张单。') }}
      <br />
      {{ tt('必填列:物料编码 / 子件代码 / 标准用量。') }}
    </div>

    <div class="bom-actions">
      <el-button :icon="Download" @click="downloadTemplate">{{ tt('下载模板') }}</el-button>
      <input ref="fileRef" type="file" accept=".xlsx,.xls" style="display: none" @change="onFile" />
      <el-button type="primary" :icon="Upload" @click="pick">{{ tt('选择 Excel 文件') }}</el-button>
      <span v-if="fileName" class="bom-file">{{ fileName }}</span>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="bom-alert" />

    <div v-if="groups.length" class="bom-result">
      <div class="bom-summary">
        {{ tt('解析结果:') }}
        <b>{{ groups.length }}</b> {{ tt('个产品 /') }}
        <b>{{ totalItems }}</b> {{ tt('行用料') }}
        <span v-if="warnings.length" class="bom-warn">
          · {{ warnings.length }} {{ tt('条提醒') }}
        </span>
      </div>
      <el-alert
        v-for="(w, i) in warnings"
        :key="'w' + i"
        :title="w"
        type="warning"
        :closable="false"
        show-icon
        class="bom-alert"
      />
      <el-table :data="preview" size="small" border max-height="340">
        <el-table-column prop="product" :label="tt('物料编码')" width="130" show-overflow-tooltip />
        <el-table-column prop="productName" :label="tt('物料名称')" min-width="150" show-overflow-tooltip />
        <el-table-column :label="tt('子件数')" width="80" align="right">
          <template #default="{ row }">{{ row.items.length }}</template>
        </el-table-column>
        <el-table-column :label="tt('子件明细')" min-width="280">
          <template #default="{ row }">
            <span class="bom-items">
              <span v-for="(it, i) in row.items.slice(0, 4)" :key="i" class="bom-chip">
                {{ it.子件代码 }} ×{{ it.标准用量 }}
              </span>
              <span v-if="row.items.length > 4" class="bom-more">+{{ row.items.length - 4 }}</span>
            </span>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="errors.length" class="bom-errors">
        <div class="bom-errors-title">{{ tt('以下行有问题,已跳过(其余行可正常导入):') }}</div>
        <div v-for="(e, i) in errors.slice(0, 20)" :key="'e' + i" class="bom-error-line">{{ e }}</div>
        <div v-if="errors.length > 20" class="bom-error-line">…{{ tt('还有') }} {{ errors.length - 20 }} {{ tt('条') }}</div>
      </div>
    </div>

    <template #footer>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button
        type="primary"
        :loading="importing"
        :disabled="!groups.length || importing"
        @click="doImport"
      >
        {{ importing ? tt('导入中…') : tt('导入') + ' ' + groups.length + ' ' + tt('个产品') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Upload } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { callButton } from '@/business/engine'
import {
  templateRows,
  templateNotes,
  parseBomSheet,
  groupByProduct,
  buildWlbomForm,
  checkDuplicates,
} from '@/business/bomImport'

const props = defineProps({
  modelValue: Boolean,
})
const emit = defineEmits(['update:modelValue', 'done'])

const fileRef = ref(null)
const fileName = ref('')
const error = ref('')
const errors = ref([])
const groups = ref([])
const warnings = ref([])
const importing = ref(false)
/** 已导入成功的产品数(失败重试时不清零,便于用户知道进度) */
const doneCount = ref(0)

const totalItems = computed(() => groups.value.reduce((s, g) => s + g.items.length, 0))
const preview = computed(() => groups.value.slice(0, 50))

watch(() => props.modelValue, (v) => {
  if (v) reset()
})

function reset() {
  fileName.value = ''
  error.value = ''
  errors.value = []
  groups.value = []
  warnings.value = []
  importing.value = false
  doneCount.value = 0
}

function close() {
  emit('update:modelValue', false)
}

function pick() {
  fileRef.value && fileRef.value.click()
}

/** 下载模板:sheet1 填数据、sheet2 写说明(避免反复问「必填哪些」) */
async function downloadTemplate() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(templateRows())
    // 列宽:编码类给宽一点,用量窄
    ws['!cols'] = [
      { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, tt('物料清单').slice(0, 28))
    const ws2 = XLSX.utils.aoa_to_sheet(templateNotes())
    ws2['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 70 }]
    XLSX.utils.book_append_sheet(wb, ws2, tt('填写说明').slice(0, 28))
    XLSX.writeFile(wb, `${tt('物料清单BOM导入模板')}.xlsx`)
  } catch (e) {
    ElMessage.error((e && e.message) || tt('模板生成失败'))
  }
}

function onFile(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  fileName.value = file.name
  error.value = ''
  errors.value = []
  groups.value = []
  warnings.value = []
  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) throw new Error(tt('Excel 无工作表'))
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const r = parseBomSheet(aoa)
      errors.value = r.errors || []
      if (!r.rows.length) {
        error.value = (r.errors && r.errors[0]) || tt('没有可导入的数据行')
        return
      }
      groups.value = groupByProduct(r.rows)
      warnings.value = checkDuplicates(groups.value)
      ElMessage.success(
        tt('已解析') + ' ' + groups.value.length + ' ' + tt('个产品 /') + ' ' + r.rows.length + ' ' + tt('行用料'),
      )
    } catch (err) {
      error.value = (err && err.message) || tt('文件解析失败')
      groups.value = []
    }
  }
  reader.readAsArrayBuffer(file)
}

/**
 * 逐产品建单:一个产品一张物料清单单。
 *
 * ⚠ 逐张独立提交、失败不中断(沿用 WorkOrderPickingService 的教训):
 * 外层事务与 buttonService.save 自带事务嵌套时,某一张失败会把共享事务标 rollback-only,
 * 导致「其余产品明明成功却被一起回滚」。故这里串行逐张调用、各自独立事务,
 * 失败的产品留在列表里供重试。
 */
async function doImport() {
  if (!groups.value.length) return
  importing.value = true
  const failed = []
  let ok = 0
  const today = new Date().toISOString().slice(0, 10)
  const queue = [...groups.value]
  for (let i = 0; i < queue.length; i++) {
    const g = queue[i]
    try {
      const form = buildWlbomForm(g, { date: today })
      await callButton({ panelCode: 'WLBOM', buttonName: '保存', formData: form, buttonParam: {} })
      ok++
      doneCount.value++
    } catch (e) {
      const msg = (e && (e.response?.data?.message || e.message)) || String(e)
      failed.push(`${g.product}:${msg}`)
    }
  }
  importing.value = false
  if (failed.length) {
    // 只保留失败的产品,方便用户直接重试
    groups.value = groups.value.filter((g) => failed.some((f) => f.startsWith(g.product + ':')))
    error.value = tt('部分产品导入失败:') + ' ' + failed.slice(0, 5).join('; ')
    ElMessage.warning(tt('成功') + ' ' + ok + ' ' + tt('个,失败') + ' ' + failed.length + ' ' + tt('个'))
    emit('done', { ok, failed })
    return
  }
  ElMessage.success(tt('已导入') + ' ' + ok + ' ' + tt('个产品的物料清单'))
  emit('done', { ok, failed: [] })
  close()
}
</script>

<style scoped>
.bom-tip {
  font-size: 12px;
  color: #666;
  line-height: 1.7;
  margin-bottom: 12px;
}
.bom-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.bom-file {
  font-size: 13px;
  color: #1c4f8a;
}
.bom-alert {
  margin-bottom: 8px;
}
.bom-summary {
  font-size: 13px;
  margin-bottom: 8px;
  color: #333;
}
.bom-warn {
  color: #d97706;
}
.bom-items {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.bom-chip {
  display: inline-block;
  padding: 0 6px;
  font-size: 12px;
  line-height: 18px;
  border: 1px solid #d9ecff;
  background: #f0f7ff;
  border-radius: 3px;
  color: #1c4f8a;
}
.bom-more {
  font-size: 12px;
  color: #999;
  line-height: 18px;
}
.bom-errors {
  margin-top: 10px;
  padding: 8px 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
}
.bom-errors-title {
  font-size: 12px;
  color: #b91c1c;
  font-weight: 600;
  margin-bottom: 4px;
}
.bom-error-line {
  font-size: 12px;
  color: #7f1d1d;
  line-height: 1.7;
}
</style>
