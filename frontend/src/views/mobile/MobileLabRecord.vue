<template>
  <div class="labm">
    <div class="labm-top">
      <div class="labm-head">
        <span class="labm-title">{{ panel ? tt(panel.title) : tt('实验室记录手机登记') }}</span>
        <span class="labm-tagline">{{ tt('手机扫码 · 实验室记录手机登记') }}</span>
      </div>
      <span class="labm-sub">{{ tt('拍照 + 填字段 → 存草稿;数据直接回填到电脑端同一个面板') }}</span>
    </div>

    <div v-if="errText" class="labm-err">{{ errText }}</div>

    <div class="labm-body">
      <!-- ① 检索 + 记录列表 -->
      <section class="labm-card">
        <div class="labm-sec">
          <span>{{ tt('记录列表') }}</span>
          <span class="labm-sec-num">{{ total }}</span>
          <span class="labm-sec-gap"></span>
          <el-button text size="small" @click="startNew">{{ tt('新增记录') }}</el-button>
        </div>

        <div class="labm-row">
          <el-input
            v-model="keyword"
            size="large"
            clearable
            :placeholder="tt('模糊查询:单号 / 项目 / 设备 / 内容片段')"
            @keyup.enter="search()"
            @clear="search()"
          />
          <el-button size="large" :loading="listLoading" @click="search()">{{ tt('查询') }}</el-button>
        </div>

        <div v-if="listLoading" class="labm-empty">{{ tt('加载中…') }}</div>
        <div v-else-if="!rows.length" class="labm-empty">
          {{ keyword ? tt('没有匹配的记录:换个关键字,或点「新增记录」') : tt('还没有记录:点「新增记录」开始登记') }}
        </div>
        <div v-else class="labm-lines">
          <div
            v-for="(r, i) in rows"
            :key="r.编号 || r.单据编号 || i"
            class="labm-line"
            :class="{ on: isCurrent(r) }"
            @click="openRecord(r)"
          >
            <div class="labm-line-main">
              <div class="labm-line-title">{{ rowTitleOf(panel, r) || tt('(未填)') }}</div>
              <div class="labm-line-meta">{{ rowMetaOf(r) }}</div>
            </div>
            <span v-if="photoCountOf(r)" class="labm-badge">📷 {{ photoCountOf(r) }}</span>
          </div>
        </div>
      </section>

      <!-- ② 表单(表头 + 明细 + 照片) -->
      <section class="labm-card">
        <div class="labm-sec">
          <span>{{ editingNo ? tt('编辑记录') : tt('新增记录') }}</span>
          <span v-if="editingNo" class="labm-doc">{{ editingNo }}</span>
          <span v-else class="labm-unsaved">{{ tt('未保存') }}</span>
        </div>

        <div v-if="metaLoading" class="labm-empty">{{ tt('加载中…') }}</div>
        <template v-else>
          <!-- 表头字段(单据编号只读) -->
          <div v-for="f in headerFields" :key="'h-' + f.code" class="labm-field">
            <label>
              {{ labelOf(f) }}<span v-if="f.isNotNull && !isDocNo(f)" class="req">*</span>
            </label>
            <el-input v-if="isDocNo(f)" :model-value="form[f.code]" disabled />

            <el-date-picker
              v-else-if="isDate(f)"
              v-model="form[f.code]"
              type="date"
              value-format="YYYY-MM-DD"
              :placeholder="tt('选择日期')"
              style="width: 100%"
            />

            <el-select
              v-else-if="optionList(f).length"
              v-model="form[f.code]"
              filterable
              allow-create
              clearable
              :placeholder="tt('选择或输入')"
              style="width: 100%"
            >
              <el-option v-for="o in optionList(f)" :key="o" :label="o" :value="o" />
            </el-select>

            <el-input v-else v-model="form[f.code]" :placeholder="labelOf(f)" />
          </div>

          <!-- 明细 -->
          <div class="labm-sec labm-sec2">
            <span>{{ tt('明细') }}</span>
            <span class="labm-sec-num">{{ detailRows.length }}</span>
            <span class="labm-sec-gap"></span>
            <el-button text size="small" @click="addRow">{{ tt('加一行') }}</el-button>
          </div>

          <div v-for="(row, idx) in detailRows" :key="'d-' + idx" class="labm-drow">
            <div class="labm-drow-head">
              <span class="labm-drow-no">{{ tt('第') }} {{ idx + 1 }} {{ tt('行') }}</span>
              <el-button text size="small" @click="removeRow(idx)">{{ tt('删除行') }}</el-button>
            </div>
            <div v-for="f in detailFields" :key="'d-' + idx + '-' + f.dataName" class="labm-field">
              <label>{{ labelOf(f) }}</label>
              <el-date-picker
                v-if="isDate(f)"
                v-model="row[f.dataName]"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="tt('选择日期')"
                style="width: 100%"
              />
              <el-input v-else v-model="row[f.dataName]" :placeholder="labelOf(f)" />
            </div>
          </div>

          <!-- 照片:有单号立即上传;新单先挂着,保存拿到单号后自动上传 -->
          <div class="labm-sec labm-sec2">
            <span>{{ tt('手机照片') }}</span>
            <span class="labm-sec-num">{{ photos.length + pending.length }}</span>
          </div>
          <div class="labm-photos">
            <div v-for="p in photos" :key="'ph-' + p.id" class="labm-photo">
              <img v-if="thumbOf(p)" :src="thumbOf(p)" :alt="p.fileName" @click="preview(p)" />
              <div v-else class="labm-photo-name" @click="preview(p)">{{ p.fileName }}</div>
              <span class="labm-photo-del" :title="tt('删除照片')" @click.stop="removePhoto(p)">✕</span>
            </div>
            <div v-for="(c, i) in pending" :key="'pd-' + i" class="labm-photo is-pending">
              <img :src="c.url" :alt="c.name" />
              <span class="labm-photo-del" :title="tt('取消这张')" @click.stop="dropPending(i)">✕</span>
              <span class="labm-photo-wait">{{ tt('待上传') }}</span>
            </div>
            <div class="labm-photo-add" @click="pickPhoto">
              <span class="labm-photo-plus">＋</span>
              <span>{{ tt('拍照/选图') }}</span>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            @change="onFilesPicked"
          />

          <div class="labm-actions">
            <el-button type="primary" size="large" :loading="saving" :disabled="!panel" @click="save()">
              {{ tt('保存草稿') }}
            </el-button>
            <el-button size="large" :disabled="saving" @click="startNew">{{ tt('清空重填') }}</el-button>
          </div>
          <div class="labm-hint">
            {{ tt('保存后单据状态=草稿;审核/归档在电脑端该面板照原流程进行。拍的照会写进「手机照片」字段,电脑端点开即可看。') }}
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * MobileLabRecord.vue — 「手机扫码 · 实验室记录手机登记」(2026-11-09)
 *
 * 【用户口径】「研发图片上的 3 个面版也要对应的做手机端,在手机扫码下面,叫实验室记录手机登记。
 *   手机端只需要实现,可以拍照上传和可以填写对应字段的内容就可以。再要一个模糊查询。
 *   还有数据要可以对应回填各自的面版,还有原来每个面版要增加一个字段,来保存手机拍照上传的文件。」
 *
 * 【回填口径 —— 一张单,两处看】
 *   本页**不新建业务表**:三张面板(RD_SPIKE_WATER / RD_EQUIP_USE / RD_INSTR_USE)就是研发管理里
 *   那三张 PC 面板,取元数据 / 取单 / 保存全走通用引擎接口(`/px/getNewFormPermMatrix`、
 *   `/px/getFormDescriptor`、`/px/callButton` 的「保存为草稿」)⇒ 手机存下的单,电脑端面板
 *   里就是同一张单(状态=草稿),审核/归档照电脑端原流程。
 *   照片走既有附件服务(锚点=面板码+单据编号+「手机照片」),服务端把文件名串同步回 head 表的
 *   [手机照片] 列(迁移 migrate-lab-mobile-20261109.sql),电脑端点开即预览。
 *
 * 【字段从哪来】全部元数据驱动,前端零硬编码字段名:
 *   表头 = getNewFormPermMatrix.meta(引擎已按 yj_field 造好:code/name/dataType/isNotNull/options);
 *   明细 = getNewFormPermMatrix.detail.tabs[0].fields(dataName/dataType)。
 *   所以「测试项目」这类标准库字段自动带 options(可下拉可手输),日期字段自动用日期选择器。
 *
 * 【为什么新单先挂"待上传"】
 *   附件锚点必须有单据编号,而新单的号是**保存时后端发号**的(不能用预测号)。
 *   故:已有单号 → 选完即传;新单 → 先本地预览排着,保存拿到号后自动补传,失败会明确报错。
 *
 * 【权限】菜单与路由按面板码过滤(与 PC 面板同一批权限行),保存由后端 requireButton
 *   (add|modify 词)兜底;前端不绕过任何权限。
 */
import { computed, ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { openAttachmentPreview } from '@core/panel/attachmentPreview'
import {
  PHOTO_FIELD, labPanelOf, rowTitleOf, rowMetaOf, photoCountOf, isImageName, baseNameOf,
  emptyHeader, emptyDetailRow, headerValuesOf, detailRowsOf, buildSavePayload,
} from '@/business/labMobile'
import {
  PHOTO_MAX_MB, loadPanelMeta, loadPanelDoc, queryDocs, saveDraft,
  uploadPhoto, listPhotos, deletePhoto, loadAttachmentBlob,
} from '@/business/labMobileApi'

const route = useRoute()

/** 面板码:优先路由 props/meta(三条静态路由各绑一张面板) */
const panelCode = String(route.meta?.panelCode || route.params?.panelCode || '').trim()
const panel = labPanelOf(panelCode)

const errText = ref('')
const metaLoading = ref(false)
const listLoading = ref(false)
const saving = ref(false)

const total = ref(0)
const keyword = ref('')
const rows = ref([])

const headerFields = ref([])
const detailFields = ref([])
const defaults = ref({})
const form = reactive({})
const detailRows = ref([])
const editingNo = ref('')

const photos = ref([])
const thumbs = reactive({})
const pending = ref([])       // [{file, name, url}]
const fileInput = ref(null)

/** 明细页签键(单据面板 = items;兜底取第一个页签) */
const tabKey = ref('items')

const isCurrent = (r) => !!editingNo.value && String(r?.单据编号 || '') === editingNo.value

/** 字段显示名:label 里带 "\n"(yj_field 手写换行)时按空格展示,键本身不动 */
function labelOf(f) {
  const raw = String(f?.name || f?.code || f?.dataName || '')
  return raw.replace(/\\n|\r?\n/g, ' ').trim()
}

const isDocNo = (f) => String(f?.code || f?.dataName || '') === '单据编号'
const isDate = (f) => String(f?.dataType || '') === '日期'
const optionList = (f) => (Array.isArray(f?.options) ? f.options : [])

/* ───────────── 取数 ───────────── */

function applyMeta(res) {
  const meta = Array.isArray(res?.meta) ? res.meta : []
  // 单据状态由引擎维护、手机照片走下面的照片区 —— 都不做成输入框
  headerFields.value = meta.filter((f) => {
    const k = String(f?.code || '')
    if (!k || f.hidden) return false
    return k !== '单据状态' && k !== PHOTO_FIELD
  })
  const tabs = Array.isArray(res?.detail?.tabs) ? res.detail.tabs : []
  const tab = tabs[0] || { key: 'items', fields: [] }
  tabKey.value = String(tab.key || 'items')
  detailFields.value = (Array.isArray(tab.fields) ? tab.fields : []).filter((f) => f?.dataName)
  defaults.value = res?.data && typeof res.data === 'object' ? res.data : {}
}

async function loadMeta() {
  if (!panel) {
    errText.value = tt('面板编号无效,请从左侧菜单进入「实验室记录手机登记」')
    return
  }
  metaLoading.value = true
  errText.value = ''
  try {
    applyMeta(await loadPanelMeta(panelCode))
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('加载面板配置失败')
  } finally {
    metaLoading.value = false
  }
}

async function loadList() {
  if (!panel) return
  listLoading.value = true
  try {
    const res = await queryDocs(panelCode, keyword.value, 1, 30)
    rows.value = Array.isArray(res?.list) ? res.list : []
    total.value = Number(res?.totalSize || rows.value.length || 0)
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('查询记录失败')
    rows.value = []
    total.value = 0
  } finally {
    listLoading.value = false
  }
}

function search() {
  errText.value = ''
  loadList()
}

/* ───────────── 表单 ───────────── */

function resetForm() {
  const next = emptyHeader(headerFields.value, defaults.value)
  for (const k of Object.keys(form)) delete form[k]
  Object.assign(form, next)
  // 新单:先给一行空明细(全空行保存时会被丢掉,不会在电脑端留空行)
  detailRows.value = detailFields.value.length ? [emptyDetailRow(detailFields.value)] : []
}

function startNew() {
  errText.value = ''
  editingNo.value = ''
  clearPhotos()
  clearPending()
  resetForm()
}

async function openRecord(row) {
  const no = String(row?.单据编号 || '').trim()
  if (!no) return
  errText.value = ''
  editingNo.value = no
  clearPhotos()
  clearPending()
  try {
    const res = await loadPanelDoc(panelCode, no)
    const data = res?.data && typeof res.data === 'object' ? res.data : row
    const next = headerValuesOf(headerFields.value, data)
    for (const k of Object.keys(form)) delete form[k]
    Object.assign(form, next)
    let list = detailRowsOf(res?.detailData, tabKey.value)
    if (!list.length) list = detailRowsOf(row?.detail, tabKey.value)
    detailRows.value = list.length ? list : [emptyDetailRow(detailFields.value)]
    await loadPhotos()
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('打开记录失败')
  }
}

function addRow() {
  detailRows.value.push(emptyDetailRow(detailFields.value))
}

function removeRow(idx) {
  detailRows.value.splice(idx, 1)
  if (!detailRows.value.length) addRow()
}

/* ───────────── 照片 ───────────── */

function clearPending() {
  for (const p of pending.value) {
    try { URL.revokeObjectURL(p.url) } catch (e) { /* ignore */ }
  }
  pending.value = []
}

function clearPhotos() {
  for (const k of Object.keys(thumbs)) {
    try { URL.revokeObjectURL(thumbs[k]) } catch (e) { /* ignore */ }
    delete thumbs[k]
  }
  photos.value = []
}

function thumbOf(p) {
  return isImageName(p?.fileName) ? thumbs[p.id] || '' : ''
}

async function loadPhotos() {
  const no = String(editingNo.value || '').trim()
  if (!no) { photos.value = []; return }
  try {
    photos.value = await listPhotos(panelCode, no)
    for (const p of photos.value) {
      if (!isImageName(p?.fileName) || thumbs[p.id]) continue
      try {
        const blob = await loadAttachmentBlob(p.id)
        thumbs[p.id] = URL.createObjectURL(blob)
      } catch (e) { /* 缩略图失败不影响其余 */ }
    }
  } catch (e) {
    photos.value = []
  }
}

function pickPhoto() {
  fileInput.value?.click?.()
}

async function onFilesPicked(ev) {
  const files = Array.from(ev?.target?.files || [])
  if (ev?.target) ev.target.value = ''
  if (!files.length) return
  errText.value = ''
  const bad = []
  const good = []
  for (const f of files) {
    if (f.size > PHOTO_MAX_MB * 1024 * 1024) { bad.push(baseNameOf(f.name)); continue }
    good.push(f)
  }
  if (bad.length) ElMessage.warning(`${tt('以下照片超过')} ${PHOTO_MAX_MB}MB:${bad.join('、')}`)
  if (!good.length) return

  // 已有单号 → 立刻上传;新单 → 先挂着,保存拿到号后补传
  if (!String(editingNo.value || '').trim()) {
    for (const f of good) {
      pending.value.push({ file: f, name: baseNameOf(f.name), url: URL.createObjectURL(f) })
    }
    ElMessage.info(tt('照片已选好:点「保存草稿」后自动上传'))
    return
  }
  await uploadFiles(good)
}

async function uploadFiles(files) {
  const no = String(editingNo.value || '').trim()
  if (!no || !files.length) return true
  saving.value = true
  let ok = 0
  try {
    for (const f of files) {
      await uploadPhoto({ panelCode, docNo: no, file: f })
      ok += 1
    }
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('照片上传失败')
  } finally {
    saving.value = false
  }
  await loadPhotos()
  await loadList()
  if (ok === files.length) ElMessage.success(`${tt('已上传')} ${ok} ${tt('张照片')}`)
  return ok === files.length
}

function dropPending(i) {
  const hit = pending.value[i]
  if (hit?.url) { try { URL.revokeObjectURL(hit.url) } catch (e) { /* ignore */ } }
  pending.value.splice(i, 1)
}

async function removePhoto(p) {
  try {
    await ElMessageBox.confirm(`${tt('删除照片')}:${p.fileName}?`, tt('确认'), { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    await deletePhoto(p.id)
    if (thumbs[p.id]) {
      try { URL.revokeObjectURL(thumbs[p.id]) } catch (e) { /* ignore */ }
      delete thumbs[p.id]
    }
    await loadPhotos()
    await loadList()
    ElMessage.success(tt('已删除'))
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('删除失败')
  }
}

function preview(p) {
  openAttachmentPreview(
    { id: p.id, fileName: p.fileName, contentType: p.contentType },
    {
      loadBlob: () => loadAttachmentBlob(p.id),
      onInfo: (m) => ElMessage.info(m),
      onError: (m) => ElMessage.error(m),
    },
  )
}

/* ───────────── 保存 ───────────── */

/** 前端必填提示(后端 ensureRequiredFilled 只对「保存」生效,草稿口子靠这层把关) */
function validate() {
  const missing = []
  for (const f of headerFields.value) {
    if (!f.isNotNull || isDocNo(f)) continue
    const v = String(form[String(f.code)] ?? '').trim()
    if (!v) missing.push(labelOf(f))
  }
  return missing
}

async function save() {
  if (!panel || saving.value) return
  errText.value = ''
  const missing = validate()
  if (missing.length) {
    errText.value = `${missing.join('、')} ${tt('不能为空')}`
    return
  }
  const { payload, skippedRows } = buildSavePayload({
    headerFields: headerFields.value,
    form,
    rows: detailRows.value,
    detailFields: detailFields.value,
    editingNo: editingNo.value,
  })
  if (skippedRows > 0) ElMessage.info(`${tt('已忽略')} ${skippedRows} ${tt('行空明细')}`)

  saving.value = true
  try {
    const res = await saveDraft(panelCode, payload)
    const no = String(res?.编号 || editingNo.value || '').trim()
    if (no) {
      editingNo.value = no
      if (!form['单据编号']) form['单据编号'] = no
    }
    ElMessage.success(`${tt('已保存草稿')}${no ? ':' + no : ''}`)
    const files = pending.value.map((p) => p.file)
    clearPending()
    if (no && files.length) await uploadFiles(files)
    if (no) await loadPhotos()
    await loadList()
    if (no) {
      try {
        const doc = await loadPanelDoc(panelCode, no)
        const next = headerValuesOf(headerFields.value, doc?.data || {})
        for (const k of Object.keys(form)) delete form[k]
        Object.assign(form, next)
        const list = detailRowsOf(doc?.detailData, tabKey.value)
        detailRows.value = list.length ? list : [emptyDetailRow(detailFields.value)]
      } catch (e) { /* 回读失败不影响"已保存"这个事实 */ }
    }
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('保存失败')
  } finally {
    saving.value = false
  }
}

/* ───────────── 生命周期 ───────────── */

onMounted(async () => {
  await loadMeta()
  resetForm()
  await loadList()
})

onBeforeUnmount(() => {
  clearPending()
  clearPhotos()
})

/** 供模板/调试引用(面板码与面板配置) */
defineExpose({ panelCode, panel })
</script>

<style scoped>
/* 手机 375 宽为基准:不横向滚动;命中区 ≥44px;数字等宽。≥900px 双栏(电脑端同一份组件)。 */
.labm {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--el-bg-color-page);
}
.labm-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 12px 14px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.labm-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.labm-title { font-size: 16px; font-weight: 600; }
.labm-tagline {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 11px;
}
.labm-sub { font-size: 12px; color: var(--el-text-color-secondary); }

.labm-err {
  margin: 10px 14px 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
}

.labm-body { display: flex; flex-direction: column; gap: 10px; padding: 10px 14px 20px; }
.labm-card {
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.labm-sec {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}
.labm-sec2 { margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--el-border-color-lighter); }
.labm-sec-num {
  padding: 0 6px;
  border-radius: 9px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 500;
}
.labm-sec-gap { flex: 1; }

.labm-row { display: flex; align-items: center; gap: 8px; }
.labm-row .el-input { flex: 1; min-width: 0; }
.labm-row :deep(.el-button) { flex: none; margin-left: 0; }

.labm-empty { padding: 16px 0; text-align: center; font-size: 13px; color: var(--el-text-color-placeholder); }

.labm-lines { max-height: 46vh; overflow-y: auto; }
.labm-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
}
.labm-line:first-child { border-top: 0; }
.labm-line.on { background: var(--el-color-primary-light-9); }
.labm-line-main { flex: 1; min-width: 0; }
.labm-line-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.labm-line-meta { margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }
.labm-badge { flex: none; font-size: 12px; color: var(--el-color-primary); }

.labm-doc { font-size: 12px; font-weight: 400; color: var(--el-text-color-secondary); word-break: break-all; }
.labm-unsaved {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
  font-size: 11px;
  font-weight: 500;
}

.labm-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.labm-field > label { font-size: 12px; color: var(--el-text-color-secondary); }
.labm-field .req { margin-left: 2px; color: var(--el-color-danger); }

.labm-drow {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.labm-drow-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.labm-drow-no { font-size: 12px; font-weight: 600; color: var(--el-text-color-regular); }

.labm-photos { display: flex; flex-wrap: wrap; gap: 8px; }
.labm-photo {
  position: relative;
  width: 84px;
  height: 84px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-lighter);
}
.labm-photo img { width: 100%; height: 100%; object-fit: cover; cursor: pointer; }
.labm-photo-name {
  padding: 6px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--el-text-color-regular);
  word-break: break-all;
  cursor: pointer;
}
.labm-photo-del {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.labm-photo-wait {
  position: absolute;
  left: 0;
  bottom: 0;
  right: 0;
  padding: 2px 0;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 10px;
}
.labm-photo.is-pending { border-style: dashed; border-color: var(--el-color-primary-light-5); }
.labm-photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 84px;
  height: 84px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  cursor: pointer;
}
.labm-photo-plus { font-size: 20px; line-height: 1; }

.labm-actions { display: flex; gap: 8px; margin-top: 14px; }
.labm-actions :deep(.el-button) { flex: 1; margin-left: 0; }
.labm-hint { margin-top: 8px; font-size: 11px; line-height: 1.5; color: var(--el-text-color-secondary); }

@media (min-width: 900px) {
  .labm-body { flex-direction: row; align-items: flex-start; }
  .labm-body > .labm-card { flex: 1; min-width: 0; }
}
</style>
