<template>
  <!-- ═══ 单据头字段附件格(yj_attachment):上传(原文件名保留)/点击查看/删除 ═══
       通用组件:锚点=panelCode+docNo+fieldKey,由 recordSheetConfigs 的 type:'file' 字段启用;
       打印(.no-print)只留文件名——纸张/导出 PDF 仅显示原文件名,与需求一致 -->
  <div class="fac-cell">
    <div v-if="!files.length && legacyText" class="fac-legacy">{{ legacyText }}</div>
    <div class="fac-list">
      <span
        v-for="a in files"
        :key="a.id"
        class="fac-chip"
        :title="chipTitle(a)"
        @click="openFile(a)"
      >
        <span class="fac-name">{{ a.fileName }}</span>
        <span v-if="!busy" class="fac-del no-print" :title="tt('删除')" @click.stop="removeFile(a)">✕</span>
      </span>
      <span v-if="!files.length && !legacyText" class="fac-empty">{{ tt('暂无附件') }}</span>
    </div>
    <div class="fac-actions no-print">
      <span class="fac-upload-btn" @click="pickFile">⬆ {{ tt('上传附件') }}</span>
      <input ref="fileInput" type="file" multiple hidden @change="onFiles" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/core/request'

const props = defineProps({
  panelCode: { type: String, required: true },
  /** 单据编号=附件锚点;新建未保存(无编号)不可上传,点上传时提示先保存 */
  docNo: { type: String, default: '' },
  fieldKey: { type: String, required: true },
  /** 头字段当前值(文件名串;无附件时可能为历史遗留文本,只读展示) */
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const files = ref([])
const busy = ref(false)
const fileInput = ref(null)

const legacyText = computed(() => (files.value.length ? '' : String(props.modelValue || '').trim()))

function fmtSize(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}
function chipTitle(a) {
  return [tt('文件大小') + ' ' + fmtSize(a.fileSize), tt('上传人') + ' ' + (a.uploader || ''),
    tt('上传时间') + ' ' + (a.uploadTime || '')].join('\n')
}

async function load(emitNames) {
  if (!props.docNo) {
    files.value = []
    return
  }
  try {
    const res = await request.get('/attachment/list', { params: { panelCode: props.panelCode, docNo: props.docNo, field: props.fieldKey } })
    files.value = res?.data || []
    // 服务端已同步头字段列;前端头模型跟随,列表/翻页/打印一致(不触发 dirty,真源在库)
    if (emitNames && files.value.length)
      emit('update:modelValue', files.value.map((f) => f.fileName).join('、'))
  } catch { /* 列表加载失败不阻塞表单 */ }
}
watch(() => [props.panelCode, props.docNo, props.fieldKey], () => load(true), { immediate: true })

function pickFile() {
  if (!props.docNo) {
    ElMessage.warning(tt('请先保存单据再上传附件'))
    return
  }
  fileInput.value?.click()
}

async function onFiles(e) {
  const list = [...(e.target.files || [])]
  e.target.value = ''
  if (!list.length) return
  busy.value = true
  try {
    for (const f of list) {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('panelCode', props.panelCode)
      fd.append('docNo', props.docNo)
      fd.append('field', props.fieldKey)
      try {
        const res = await request.post('/attachment/upload', fd, { timeout: 120000 })
        files.value = res?.data?.files || files.value
        if (res?.data?.names !== undefined) emit('update:modelValue', res.data.names)
      } catch (err) {
        ElMessage.error(tt('附件上传失败') + (err?.response?.data?.message ? '：' + err.response.data.message : ''))
      }
    }
  } finally {
    busy.value = false
  }
}

async function removeFile(a) {
  try {
    await ElMessageBox.confirm(tt('确认删除该附件？'), tt('删除确认'), { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
  } catch { return /* 取消 */ }
  try {
    const res = await request.post('/attachment/delete', { id: a.id })
    files.value = res?.data?.files || []
    if (res?.data?.names !== undefined) emit('update:modelValue', res.data.names)
    ElMessage.success(tt('附件已删除'))
  } catch (err) {
    ElMessage.error(tt('附件删除失败') + (err?.response?.data?.message ? '：' + err.response.data.message : ''))
  }
}

/** 点击文件名=查看:图片/PDF/文本新标签页打开,其余浏览器下载(均保留原文件名) */
async function openFile(a) {
  try {
    const blob = await request.get(`/attachment/${a.id}/download`, { responseType: 'blob', timeout: 120000 })
    const type = a.contentType || blob?.type || ''
    const url = URL.createObjectURL(blob)
    if (type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf') {
      window.open(url, '_blank')
    } else {
      const el = document.createElement('a')
      el.href = url
      el.download = a.fileName
      el.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    ElMessage.error(tt('附件下载失败'))
  }
}
</script>

<style scoped>
.fac-cell { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.fac-legacy { color: #606266; font-size: 12.5px; white-space: pre-wrap; word-break: break-all; }
.fac-list { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.fac-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 8px; border: 1px solid #b3d8ff; border-radius: 3px;
  background: #f0f7ff; color: #1d6fd1; font-size: 12.5px;
  cursor: pointer; max-width: 100%; line-height: 20px;
}
.fac-chip:hover { border-color: #409eff; color: #0a58ca; }
.fac-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fac-del { color: #909399; font-size: 11px; padding: 0 2px; }
.fac-del:hover { color: #f56c6c; }
.fac-empty { color: #b0b3b8; font-size: 12px; }
.fac-actions { margin-top: 2px; }
.fac-upload-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: #409eff; border: 1px dashed #b3d8ff;
  border-radius: 3px; padding: 1px 8px; cursor: pointer; line-height: 20px;
}
.fac-upload-btn:hover { border-color: #409eff; background: #f0f7ff; }
/* 打印/导出 PDF:只留文件名,隐藏上传入口与删除标记 */
@media print { .no-print { display: none !important; } }
</style>
