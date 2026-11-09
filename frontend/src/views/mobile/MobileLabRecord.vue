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
          <!-- 大按钮(2026-11-09 用户口径「框中的按钮要放大」):现场戴手套点得中 -->
          <el-button size="large" type="primary" plain @click="startNew">{{ tt('新增记录') }}</el-button>
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
            <!-- 大按钮(2026-11-09 用户口径「框中的按钮要放大」) -->
            <el-button size="large" type="primary" plain @click="addRow">{{ tt('加一行') }}</el-button>
          </div>

          <!-- 明细行 = 可折叠卡片(2026-11-09 用户口径「明细可以收缩,默认是收缩的」):
               收起时只露「第N行 + 摘要 + 附件数 + 删除行」,展开才显示字段与附件。
               删除行保持小号按钮(用户口径「删除按钮不用放大」),且**只有草稿**能删(见 isDraft)。 -->
          <div v-for="(row, idx) in detailRows" :key="'d-' + rowKeyOf(row)" class="labm-drow">
            <div class="labm-drow-head" @click="toggleRow(row)">
              <span class="labm-drow-caret">{{ isRowOpen(row) ? '▾' : '▸' }}</span>
              <span class="labm-drow-no">{{ tt('第') }} {{ idx + 1 }} {{ tt('行') }}</span>
              <span v-if="!isRowOpen(row)" class="labm-drow-sum">{{ rowSummary(row) }}</span>
              <span v-if="rowAttachCount(row)" class="labm-drow-badge">📎 {{ rowAttachCount(row) }}</span>
              <span class="labm-sec-gap"></span>
              <el-button text size="small" :disabled="!isDraft" :title="isDraft ? '' : tt('只有草稿才能删除行')" @click.stop="removeRow(idx)">{{ tt('删除行') }}</el-button>
            </div>

            <div v-show="isRowOpen(row)" class="labm-drow-body">
              <div v-for="f in rowFields" :key="'d-' + idx + '-' + f.dataName" class="labm-field">
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

              <!-- 本行附件(2026-11-09 第三轮):按**明细行**存,显示成**附件列表**(不是图片预览),
                   点名字=下载原图(用户口径「附件可以下载,不支持预览」)。
                   有行 id(已保存/既有单的行)→ 选完即传,锚点 `手机照片-<行id>`;
                   新行还没 id → 先排队(标「待上传」),保存拿到 id 后自动补传。 -->
              <div class="labm-rowphoto">
                <div class="labm-rowphoto-head">
                  <span class="labm-rowphoto-title">{{ tt('本行附件') }}</span>
                  <span v-if="!rowPhotoKey(row)" class="labm-rowphoto-hint">{{ tt('保存后自动上传') }}</span>
                  <span class="labm-sec-gap"></span>
                  <el-button size="small" type="primary" plain @click.stop="pickRowPhoto(idx)">📷 {{ tt('拍照/上传附件') }}</el-button>
                </div>
                <div v-if="!photosOfRow(row).length && !pendingOfRow(row).length" class="labm-rowphoto-empty">
                  {{ tt('这一行还没有附件') }}
                </div>
                <div v-for="p in photosOfRow(row)" :key="'a-' + p.id" class="labm-att">
                  <span class="labm-att-name" :title="tt('点击下载')" @click="downloadPhoto(p)">📎 {{ p.fileName }}</span>
                  <span class="labm-att-size">{{ fmtSize(p.fileSize) }}</span>
                  <span class="labm-att-del" :title="tt('删除附件')" @click.stop="removeRowPhoto(row, p)">✕</span>
                </div>
                <div v-for="(c, i) in pendingOfRow(row)" :key="'ap-' + i" class="labm-att is-pending">
                  <span class="labm-att-name">📎 {{ c.name }}</span>
                  <span class="labm-att-wait">{{ tt('待上传') }}</span>
                  <span class="labm-att-del" :title="tt('取消这个附件')" @click.stop="dropRowPending(row, i)">✕</span>
                </div>
              </div>
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
            <el-button size="large" :disabled="saving || !isDraft" :title="isDraft ? '' : tt('只有草稿才能清空重填')" @click="startNew">{{ tt('清空重填') }}</el-button>
          </div>
          <div class="labm-hint">
            {{ tt('保存后单据状态=草稿;审核/归档在电脑端该面板照原流程进行。附件按行存进表格里的「手机照片」列,电脑端该行可下载。') }}
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
 *   照片走既有附件服务,**按明细行**挂(锚点 = 面板码 + 单据编号 + `手机照片-<行 id>`),
 *   服务端把文件名串同步回该行所在的明细表 `[手机照片]` 列
 *   (迁移 migrate-lab-mobile-row-photo-20261109.sql),电脑端纸面表格里那行点开即可看。
 *
 * 【两种录入入口(用户口径 2026-11-09 第二轮:「手机端要能够实现在原来的单据中增加记录,
 *   也可以新建单据增加记录」)】
 *   · 在既有单据里加一行:记录列表点开那张单 → 「加一行」→ 保存(载荷带「编号」,后端按行 upsert);
 *   · 新建单据:点「新增记录」→ 填 → 保存(不带「编号」,后端 formNoService 发号)。
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
import {
  PHOTO_FIELD, labPanelOf, rowTitleOf, rowMetaOf, photoCountOf, baseNameOf,
  emptyHeader, emptyDetailRow, headerValuesOf, detailRowsOf, buildSavePayload,
  rowPhotoKey, mergeRowIds,
} from '@/business/labMobile'
import {
  PHOTO_MAX_MB, loadPanelMeta, loadPanelDoc, queryDocs, saveDraft,
  uploadPhoto, listPhotos, deletePhoto, loadAttachmentBlob, errText as apiErr,
} from '@/business/labMobileApi'
// APK 壳里的原生拍照(2026-11-09 第四轮):壳内走原生相机,网页/浏览器自动退化为 file input
import { hasNativeCamera, takeNativePhoto } from '@/business/nativeCamera'

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

/** 明细页签键(单据面板 = items;兜底取第一个页签) */
const tabKey = ref('items')

const isCurrent = (r) => !!editingNo.value && String(r?.单据编号 || '') === editingNo.value

/** 字段显示名:label 里带 "\n"(yj_field 手写换行)时按空格展示,键本身不动 */
function labelOf(f) {
  const raw = String(f?.name || f?.code || f?.dataName || '')
  return raw.replace(/\\n|\r?\n/g, ' ').trim()
}

const isDocNo = (f) => String(f?.code || f?.dataName || '') === '单据编号'
/** 当前单据状态(草稿/审批中/已审核/已归档…)。用户口径(2026-11-09 第三轮):
 *  「删除按钮和清空只能删除草稿」⇒ 只有草稿才放开「删除行」与「清空重填」。 */
const docStatus = ref('草稿')
const isDraft = computed(() => String(docStatus.value || '').trim() === '草稿')

/** 明细行展开状态(用户口径「明细可以收缩,默认是收缩的」):key = 行 __k,true = 展开。
 *  打开单据/换单时清空 ⇒ 全部收起;新加的那一行自动展开(要填)。 */
const openRows = reactive({})
function isRowOpen(row) { return !!openRows[rowKeyOf(row)] }
function toggleRow(row) {
  const k = rowKeyOf(row)
  openRows[k] = !openRows[k]
}
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
  docStatus.value = String(defaults.value['单据状态'] || '草稿').trim() || '草稿'
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
    errText.value = apiErr(e, tt('加载面板配置失败'))
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
    errText.value = apiErr(e, tt('查询记录失败'))
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

/** 每行的本地键(给 Vue :key 用,同时是"排队照片"的索引 —— 保存后行会换到后端 id,__k 不变) */
let rowSeq = 0
function ensureRowKey(row) {
  if (row && !row.__k) row.__k = `r${++rowSeq}`
  return row
}
function rowKeyOf(row) {
  return ensureRowKey(row).__k
}
/** 明细行里要渲染成输入框的字段:附件字段走行内照片区(不重复给输入框) */
const rowFields = computed(() => (detailFields.value || []).filter((f) => String(f?.dataType || '') !== '附件'))

/** 收起时的行摘要:取前两个**非空**的普通字段值(附件字段不算),空行显示「(未填)」 */
function rowSummary(row) {
  const parts = []
  for (const f of rowFields.value) {
    const v = String(row?.[f.dataName] ?? '').trim()
    if (v) parts.push(v)
    if (parts.length >= 2) break
  }
  return parts.length ? parts.join(' · ') : tt('(未填)')
}
/** 这一行有几份附件(已上传 + 待上传),给收起的卡片显示角标 */
function rowAttachCount(row) {
  return photosOfRow(row).length + pendingOfRow(row).length
}
/** 附件大小显示(与 FileAttachCell 同一口径) */
function fmtSize(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return ''
  if (v < 1024) return v + ' B'
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB'
  return (v / 1024 / 1024).toFixed(2) + ' MB'
}

function resetForm() {
  const next = emptyHeader(headerFields.value, defaults.value)
  for (const k of Object.keys(form)) delete form[k]
  Object.assign(form, next)
  // 新单:先给一行空明细(全空行保存时会被丢掉,不会在电脑端留空行)
  detailRows.value = detailFields.value.length
    ? [ensureRowKey(emptyDetailRow(detailFields.value))]
    : []
}

function startNew() {
  errText.value = ''
  editingNo.value = ''
  docStatus.value = '草稿'
  clearPhotos()
  clearPending()
  resetForm()
  // 新单默认只有一行,且这一行展开(要填);其余折叠状态清零
  for (const k of Object.keys(openRows)) delete openRows[k]
  for (const r of detailRows.value) openRows[rowKeyOf(r)] = true
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
    detailRows.value = list.length
      ? list.map((r) => ensureRowKey(r))
      : [ensureRowKey(emptyDetailRow(detailFields.value))]
    // 用户口径「明细默认收缩」:打开一张单时全部收起,只露行摘要
    for (const k of Object.keys(openRows)) delete openRows[k]
    docStatus.value = String(data['单据状态'] || row['单据状态'] || '草稿').trim() || '草稿'
    await loadPhotos()
  } catch (e) {
    errText.value = apiErr(e, tt('打开记录失败'))
  }
}

function addRow() {
  const row = ensureRowKey(emptyDetailRow(detailFields.value))
  detailRows.value.push(row)
  openRows[rowKeyOf(row)] = true   // 新加的行默认展开(等着填),已有行仍保持收缩
}

function removeRow(idx) {
  if (!isDraft.value) { ElMessage.warning(tt('只有草稿才能删除行')); return }
  const gone = detailRows.value[idx]
  if (gone) {
    dropRowPendingAll(gone)
    delete openRows[rowKeyOf(gone)]
  }
  detailRows.value.splice(idx, 1)
  if (!detailRows.value.length) addRow()
}

/* ───────────── 照片(按明细行) ───────────── */

/** 已上传照片:key = 行 id(字符串),value = 附件行数组 */
const photosByRow = reactive({})
/** 排队待上传:key = 行 __k,value = [{file,name,url}] */
const pendingByRow = reactive({})
const fileInput = ref(null)
/** 这一次「拍照/选图」是给哪一行的(隐藏 input 只有一个) */
const photoTargetIdx = ref(-1)

function clearPending() {
  for (const k of Object.keys(pendingByRow)) {
    for (const p of pendingByRow[k] || []) {
      try { URL.revokeObjectURL(p.url) } catch (e) { /* ignore */ }
    }
    delete pendingByRow[k]
  }
}

function clearPhotos() {
  for (const k of Object.keys(photosByRow)) delete photosByRow[k]
}

function photosOfRow(row) {
  const id = row?.id
  if (id === null || id === undefined) return []
  return photosByRow[String(id)] || []
}

function pendingOfRow(row) {
  return pendingByRow[rowKeyOf(row)] || []
}

/** 取某行的照片列表(按行锚点 `手机照片-<行id>`) */
async function loadRowPhotos(row) {
  const no = String(editingNo.value || '').trim()
  const field = rowPhotoKey(row)
  if (!no || !field) return []
  const list = await listPhotos(panelCode, no, field)
  photosByRow[String(row.id)] = list
  return list
}

async function loadPhotos() {
  const rows = (detailRows.value || []).filter((r) => r && r.id != null)
  for (const r of rows) {
    try { await loadRowPhotos(r) } catch (e) { photosByRow[String(r.id)] = [] }
  }
}

/**
 * 「拍照/上传附件」(2026-11-09 第四轮)。
 *
 * 用户口径:「点击拍照上传附件,并没有调用摄像机,摄像机就同一沿用之前的就行。」
 * ⇒ 在 APK 壳里:**走原生相机**(`YjNative.takePhoto()` → 复用扫码页那台相机,拍完回 dataURL);
 *    在手机浏览器/电脑上:**保持原来的 file input**(`accept=image/* capture`,手机会拉相机)。
 * 两条路最后都汇到 `addRowFiles(row, [file])`,上传/排队逻辑只有一份。
 */
async function pickRowPhoto(idx) {
  const row = detailRows.value[idx]
  if (!row) return
  if (hasNativeCamera()) {
    try {
      const f = await takeNativePhoto()
      if (f) await addRowFiles(row, [f])
    } catch (e) {
      errText.value = String(e?.message || tt('拍照失败'))
    }
    return
  }
  photoTargetIdx.value = idx
  fileInput.value?.click?.()
}

async function onFilesPicked(ev) {
  const files = Array.from(ev?.target?.files || [])
  if (ev?.target) ev.target.value = ''
  const idx = photoTargetIdx.value
  photoTargetIdx.value = -1
  const row = detailRows.value[idx]
  if (!files.length || !row) return
  await addRowFiles(row, files)
}

/** 收到某一行的一组文件(来自原生相机或 file input):校验大小 → 立刻上传 或 先排队 */
async function addRowFiles(row, files) {
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

  // 这一行已经有行 id(= 已保存/既有单的行)→ 立刻上传;新行 → 先排队,保存拿到 id 后补传
  if (!rowPhotoKey(row)) {
    const k = rowKeyOf(row)
    const box = pendingByRow[k] || (pendingByRow[k] = [])
    for (const f of good) box.push({ file: f, name: baseNameOf(f.name), url: URL.createObjectURL(f) })
    ElMessage.info(tt('照片已选好:点「保存草稿」后自动上传到这一行'))
    return
  }
  await uploadRowFiles(row, good)
}

/** 把文件传到某一行的锚点上,并把这行这一列的"文件名串"更新成本次服务端返回的名字 */
async function uploadRowFiles(row, files) {
  const no = String(editingNo.value || '').trim()
  const field = rowPhotoKey(row)
  if (!no || !field || !files.length) return true
  saving.value = true
  let ok = 0
  let names = String(row[PHOTO_FIELD] || '')
  try {
    for (const f of files) {
      const res = await uploadPhoto({ panelCode, docNo: no, fieldKey: field, file: f })
      if (res && typeof res.names === 'string') names = res.names
      ok += 1
    }
  } catch (e) {
    errText.value = apiErr(e, tt('照片上传失败'))
  } finally {
    saving.value = false
  }
  row[PHOTO_FIELD] = names
  await loadRowPhotos(row)
  await loadList()
  if (ok === files.length) ElMessage.success(`${tt('已上传')} ${ok} ${tt('张照片')}`)
  return ok === files.length
}

/** 保存成功后:把各新行的排队照片传到它们刚拿到的 id 上 */
async function uploadRowPending() {
  for (const row of detailRows.value || []) {
    if (!row || !rowPhotoKey(row)) continue
    const k = rowKeyOf(row)
    const box = pendingByRow[k]
    if (!box || !box.length) continue
    const files = box.map((p) => p.file)
    for (const p of box) { try { URL.revokeObjectURL(p.url) } catch (e) { /* ignore */ } }
    delete pendingByRow[k]
    await uploadRowFiles(row, files)
  }
}

function dropRowPending(row, i) {
  const box = pendingOfRow(row)
  const hit = box[i]
  if (hit?.url) { try { URL.revokeObjectURL(hit.url) } catch (e) { /* ignore */ } }
  box.splice(i, 1)
}

function dropRowPendingAll(row) {
  const k = rowKeyOf(row)
  for (const p of pendingByRow[k] || []) {
    try { URL.revokeObjectURL(p.url) } catch (e) { /* ignore */ }
  }
  delete pendingByRow[k]
}

async function removeRowPhoto(row, p) {
  try {
    await ElMessageBox.confirm(`${tt('删除附件')}:${p.fileName}?`, tt('确认'), { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    const res = await deletePhoto(p.id)
    if (res && typeof res.names === 'string') row[PHOTO_FIELD] = res.names
    await loadRowPhotos(row)
    await loadList()
    ElMessage.success(tt('已删除'))
  } catch (e) {
    errText.value = apiErr(e, tt('删除失败'))
  }
}

/**
 * 下载一份附件(2026-11-09 用户口径「附件可以下载,不支持预览」)。
 * 走 blob + 触发下载:附件下载端点要 Bearer 令牌,直接 <a href> 打开会被 403。
 */
async function downloadPhoto(p) {
  try {
    const blob = await loadAttachmentBlob(p.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = String(p.fileName || 'attachment')
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    errText.value = apiErr(e, tt('附件下载失败'))
  }
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

/**
 * 保存(草稿)。
 *
 * 【两种入口,同一个按钮】
 *   · 在**既有单据**里追加记录:记录列表点开一张 → 「加一行」→ 保存(载荷带「编号」,后端按行 upsert);
 *   · 新建单据加记录:点「新增记录」→ 填 → 保存(不带「编号」,后端发号)。
 * 用户口径(2026-11-09 第二轮)「手机端要能够实现在原来的单据中增加记录,也可以新建单据增加记录」。
 *
 * 【逐行照片的顺序】保存 → mergeRowIds 把后端 id 回填到本地行(保留 __k) → 再按行上传排队照片。
 * 这样"先拍照后保存"也能落到正确的行上(新行保存前没有 id,锚点必须等保存后才有)。
 */
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
    if (no) {
      // 回读明细 → 把行 id 回填给本地行(照片锚点靠它),再补传排队照片
      try {
        const doc = await loadPanelDoc(panelCode, no)
        const next = headerValuesOf(headerFields.value, doc?.data || {})
        for (const k of Object.keys(form)) delete form[k]
        Object.assign(form, next)
        mergeRowIds(detailRows.value, detailRowsOf(doc?.detailData, tabKey.value))
      } catch (e) { /* 回读失败不影响"已保存"这个事实 */ }
      await uploadRowPending()
      await loadPhotos()
    }
    await loadList()
  } catch (e) {
    errText.value = apiErr(e, tt('保存失败'))
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
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
/* 行头 = 折叠开关(用户口径「明细可以收缩,默认是收缩的」):整行可点,收起时露摘要与附件数 */
.labm-drow-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  user-select: none;
}
.labm-drow-head:hover { background: var(--el-fill-color-light); }
.labm-drow-caret { flex: none; width: 12px; font-size: 12px; color: var(--el-text-color-secondary); }
.labm-drow-no { flex: none; font-size: 13px; font-weight: 600; color: var(--el-text-color-regular); }
.labm-drow-sum {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.labm-drow-badge { flex: none; font-size: 12px; color: var(--el-color-primary); }
.labm-drow-body { padding: 10px 12px 12px; }

/* 本行附件(2026-11-09 第三轮):显示成**附件列表**(文件形式),点名字=下载,不做图片预览 */
.labm-rowphoto {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.labm-rowphoto-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.labm-rowphoto-title { font-size: 12px; font-weight: 600; color: var(--el-text-color-regular); }
.labm-rowphoto-hint { font-size: 11px; color: var(--el-color-warning); }
.labm-rowphoto-empty {
  padding: 6px 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.labm-att {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  font-size: 13px;
}
.labm-att-name {
  flex: 1;
  min-width: 0;
  color: var(--el-color-primary);
  word-break: break-all;
  cursor: pointer;
}
.labm-att-name:hover { text-decoration: underline; }
.labm-att-size { flex: none; font-size: 11px; color: var(--el-text-color-secondary); }
.labm-att-wait { flex: none; font-size: 11px; color: var(--el-color-warning); }
.labm-att-del {
  flex: none;
  padding: 0 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.labm-att-del:hover { color: var(--el-color-danger); }
.labm-att.is-pending { border-style: dashed; border-color: var(--el-color-primary-light-5); }
.labm-actions { display: flex; gap: 8px; margin-top: 14px; }
.labm-actions :deep(.el-button) { flex: 1; margin-left: 0; }
.labm-hint { margin-top: 8px; font-size: 11px; line-height: 1.5; color: var(--el-text-color-secondary); }

@media (min-width: 900px) {
  .labm-body { flex-direction: row; align-items: flex-start; }
  .labm-body > .labm-card { flex: 1; min-width: 0; }
}
</style>
