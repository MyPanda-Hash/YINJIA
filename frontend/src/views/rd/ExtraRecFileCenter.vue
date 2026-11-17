<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       特殊数据记录表（RD_EXTRA_REC_FILE）——「数据记录表」下的上传类面板

       【用户口径 2026-11-17】
         「在数据记录表列下边使用设计库新设计一个面板，可以上传一些比较特殊的数据记录表进行保存，
           也可以点击预览这些文件，删除需要管理员审批，这个文件上传面板的形式由你来想，
           所有人只要能看这个面板就可以查看这些上传的数据记录表」。
         追问确认：全员可传 / 删除走**单独的「待审批删除」列表** / 面板名「特殊数据记录表」。

       【设计依据 · antd 6.6.8 设计库】
         · 骨架 = 列表页模板（页头 → 筛选 → 内容），与 ProjectFlow/ProductFlow 同一套版式语言；
         · 卡片 0 层：白底 + 1px 边框，**不加阴影**；层级靠边框与留白；
         · 8pt 网格（8/16/24）；控件高 32；圆角 6；正文 14/22；
         · 数字列（大小/序号）右对齐 + tabular-nums；
         · 一个操作区最多一个主按钮（「上传数据记录表」是 primary，其余默认/文字按钮）；
         · 空态必须给下一步动作（空状态规范：明确原因 + 提供邀请），不写裸的「暂无数据」；
         · 危险操作只用 danger 语义，不用红色实心。

       【两个页签】
         · 全部文件 —— 所有人可见（能看面板就能看文件）；
         · 待审批删除 —— **仅审批人可见**（管理员或该面板 can_approve + del）。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="xrf-page">
    <header class="xrf-head">
      <div class="xrf-head-main">
        <h1 class="xrf-title">{{ tt('特殊数据记录表') }}</h1>
        <p class="xrf-sub">
          {{ tt('上传并归档特殊形式的数据记录表：图片、PDF、Excel、Word 都能存；能看本面板的人都能查看') }}
        </p>
      </div>
      <div class="xrf-head-act">
        <el-button v-if="perm.canUpload" type="primary" @click="openUpload">
          {{ tt('上传数据记录表') }}
        </el-button>
      </div>
    </header>

    <!-- 筛选区：搜索 + 页签 -->
    <div class="xrf-bar">
      <el-input
        v-model="keyword"
        class="xrf-search"
        clearable
        :placeholder="tt('搜索文件名称 / 分类 / 关键词 / 备注 / 上传人')"
        @keyup.enter="reload"
        @clear="reload"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button :loading="loading" @click="reload">{{ tt('查询') }}</el-button>
      <span class="xrf-tip">{{ tt('共') }} <b class="xrf-num">{{ total }}</b> {{ tt('个文件') }}</span>
    </div>

    <section class="xrf-card">
      <div class="xrf-card-head">
        <el-radio-group v-model="tab" size="default" @change="reload">
          <el-radio-button value="all">{{ tt('全部文件') }}</el-radio-button>
          <el-radio-button v-if="perm.canApproveDelete" value="pending">
            {{ tt('待审批删除') }}<template v-if="pendingCount">（{{ pendingCount }}）</template>
          </el-radio-button>
        </el-radio-group>
        <span class="xrf-card-hint">{{ tt('双击一行可直接预览') }}</span>
      </div>

      <el-table
        v-if="rows.length"
        :data="rows"
        row-key="id"
        size="small"
        border
        class="xrf-table"
        @row-dblclick="onRowDblclick"
      >
        <el-table-column :label="tt('序号')" width="64" align="right">
          <template #default="{ $index }">
            <span class="xrf-num">{{ (pageNo - 1) * pageSize + $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('文件名称')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="xrf-name">{{ row.name || row.fileName || '—' }}</span>
            <span v-if="row.category" class="xrf-cat">{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('文件编号')" width="120">
          <template #default="{ row }"><span class="xrf-num">{{ row.no || '—' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('大小')" width="100" align="right">
          <template #default="{ row }"><span class="xrf-num">{{ sizeText(row) }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('上传人')" width="110">
          <template #default="{ row }">{{ row.uploader || '—' }}</template>
        </el-table-column>
        <el-table-column :label="tt('上传时间')" width="160">
          <template #default="{ row }"><span class="xrf-num">{{ row.uploadTime || '—' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="130">
          <template #default="{ row }">
            <span class="xrf-chip" :class="'is-' + delStateOf(row)">{{ tt(delStateLabel(row)) }}</span>
          </template>
        </el-table-column>
        <!-- 操作列表头写死、按钮逐个 v-if（与共享文件库 ShareFileCenter 同一写法）。
             ⚠ 2026-11-17 踩过：这里用 <template v-if> 套分支时，el-table 整列不渲染
               （表头在、tbody 少一个 td、一个按钮都没有）。逐个 v-if 是稳的。 -->
        <!-- ⚠ 2026-11-17 踩坑记录（别再退回）：
             本列插槽里**不能**出现 `:disabled="delAction(row).disabled"` 这种「在模板里调返回对象的函数、
             再连取两层属性」的写法 —— 实测 el-table 会整列不渲染（表头在、tbody 少一个 td、按钮全空），
             且 console 没有任何报错，极难查。
             现在：形态判定拆成**三个布尔/字符串计算函数**（canCancelDelete / isDeleteWaiting / deleteBtnType），
             template 只做单层取值，稳定渲染。 -->
        <el-table-column :label="tt('操作')" width="220" align="center">
          <!-- ⚠ 2026-11-17 踩坑记录（别再退回）：
               本列插槽里条件节点超过 3 个（v-if 链 / 重复分支 / :disabled 绑函数返回对象的属性）时，
               Element Plus 2.14.4 的 el-table 会**整列静默不渲染** —— 表头在、tbody 少一个 td、
               按钮全空、console 一个错都没有。下面这段是实测稳定的最小形态：
               4 个独立 v-if、每个条件只比一个 tab、文案用函数但只返回字符串。 -->
          <template #default="{ row }">
            <el-button v-if="tab !== 'pending'" link type="primary" size="small" @click="doPreview(row)">{{ tt('预览') }}</el-button>
            <el-button v-if="tab !== 'pending'" link type="primary" size="small" @click="download(row)">{{ tt('下载') }}</el-button>
            <el-button v-if="tab !== 'pending'" link type="danger" size="small" @click="onDeleteClick(row)">{{ tt('删除') }}</el-button>
            <el-button v-if="tab === 'pending'" link type="success" size="small" @click="decide(row, true)">{{ tt('通过') }}</el-button>
            <el-button v-if="tab === 'pending'" link type="danger" size="small" @click="decide(row, false)">{{ tt('驳回') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空态：说明原因 + 给下一步动作（空状态规范） -->
      <div v-else-if="!loading" class="xrf-empty">
        <p class="xrf-empty-t">
          {{ tab === 'pending' ? tt('没有待审批的删除申请') : tt('还没有上传过特殊数据记录表') }}
        </p>
        <p class="xrf-empty-d">
          {{ tab === 'pending'
            ? tt('有人申请删除文件时会出现在这里，通过后文件被永久删除')
            : tt('把它当作「其它形式的数据记录表」归档处：拍照记录、扫描件、外部机构的报告都可以传') }}
        </p>
        <el-button v-if="tab !== 'pending' && perm.canUpload" type="primary" @click="openUpload">
          {{ tt('上传第一份') }}
        </el-button>
        <el-button v-else-if="keyword" @click="clearKeyword">{{ tt('清空搜索') }}</el-button>
      </div>

      <div v-if="total > pageSize" class="xrf-pager">
        <el-pagination
          v-model:current-page="pageNo"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next, total"
          background
          @current-change="load"
        />
      </div>
    </section>

    <!-- 上传弹窗（表单在抽屉里，符合「录入」类任务不打断上下文的做法） -->
    <el-dialog v-model="uploadVisible" :title="tt('上传数据记录表')" width="520px" append-to-body>
      <el-form :model="form" label-width="88px" class="xrf-form">
        <el-form-item :label="tt('选择文件')" required>
          <el-upload
            class="xrf-upload"
            :auto-upload="false"
            :limit="1"
            :on-change="onFileChange"
            :on-remove="() => (form.file = null)"
            drag
          >
            <div class="xrf-drop">
              <p class="xrf-drop-t">{{ tt('把文件拖到这里，或点击选择') }}</p>
              <p class="xrf-drop-d">{{ tt('支持图片 / PDF / Excel / Word / 文本，单个文件不超过 50MB') }}</p>
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item :label="tt('文件名称')">
          <el-input v-model="form.name" :placeholder="tt('留空则用文件名（不含扩展名）')" maxlength="200" />
        </el-form-item>
        <el-form-item :label="tt('分类')">
          <el-select v-model="form.category" clearable filterable allow-create :placeholder="tt('可不填，或输入新分类')" style="width: 100%">
            <el-option v-for="c in CATEGORIES" :key="c" :label="tt(c)" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('关键词')">
          <el-input v-model="form.keywords" :placeholder="tt('方便以后搜到它，用逗号分隔')" maxlength="200" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="form.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">{{ tt('上传') }}</el-button>
      </template>
    </el-dialog>

    <!-- 预览浮层：图片/PDF/文本在浏览器里直接看；其它类型提示下载 -->
    <el-dialog
      v-model="previewVisible"
      :title="previewTitle"
      width="86%"
      top="4vh"
      append-to-body
      class="xrf-preview-dlg"
    >
      <div v-if="previewUrl" class="xrf-preview-body">
        <img v-if="previewKind === 'image'" :src="previewUrl" class="xrf-preview-img" alt="" />
        <iframe v-else-if="previewKind === 'frame'" :src="previewUrl" class="xrf-preview-frame" />
        <pre v-else class="xrf-preview-text">{{ previewText }}</pre>
      </div>
      <div v-else class="xrf-preview-fallback">
        <p>{{ tt('这种格式浏览器里看不了，请下载后查看') }}</p>
        <el-button type="primary" @click="download(previewRow)">{{ tt('下载文件') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import request from '@/core/request'
import { useAppContext } from '@core/panel-runtime'
import { canPreviewInline, delStateLabel, delStateOf, deleteActionOf, formatSize } from '@/core/prod/extraRecFile'

const { user } = useAppContext()
const userName = computed(() => String(user?.userName || '').trim())

/** 常用分类（allow-create ⇒ 用户可现场输入新的，不必先维护字典） */
const CATEGORIES = ['测试记录', '检验报告', '外部机构报告', '客户资料', '其它']

const rows = ref([])
const loading = ref(false)
const keyword = ref('')
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)
/** 'all' = 全部文件（人人可见）；'pending' = 待审批删除（仅审批人） */
const tab = ref('all')
const perm = ref({ canUpload: false, canApproveDelete: false, pendingCount: 0 })
const pendingCount = computed(() => Number(perm.value.pendingCount || 0))
const uploadVisible = ref(false)
const uploading = ref(false)
const form = ref({ file: null, name: '', category: '', keywords: '', remark: '' })

const previewVisible = ref(false)
const previewRow = ref(null)
const previewUrl = ref('')
const previewKind = ref('frame')
const previewText = ref('')
const previewTitle = computed(() => String(previewRow.value?.name || previewRow.value?.fileName || tt('预览')))

function sizeText(row) {
  return formatSize(row?.fileSize)
}

/**
 * 删除按钮的三个取值 —— **拆成单层函数**，模板里不做二次属性访问。
 *
 * <p>⚠ 2026-11-17 实测：模板写 `:disabled="delAction(row).disabled"`（函数返回对象再取属性）会让
 * el-table 整列不渲染，且 console 无任何报错。拆成下面三个只返回**标量**的函数后稳定正常。</p>
 */
function isDeleteWaiting(row) {
  return delActionOf(row, { canApprove: perm.value.canApproveDelete, user: userName.value }).action === 'wait'
}
function canCancelDelete(row) {
  return delActionOf(row, { canApprove: perm.value.canApproveDelete, user: userName.value }).action === 'cancel'
}
function deleteBtnType(row) {
  return canCancelDelete(row) ? 'primary' : 'danger'
}

/** 删除按钮文案：申请删除 / 撤回申请 / 等待审批（同样只返回字符串，不返回对象） */
function deleteLabel(row) {
  if (canCancelDelete(row)) return tt('撤回')
  return isDeleteWaiting(row) ? tt('审批中') : tt('删除')
}

async function loadPerm() {
  try {
    const res = await request.get('/extra-rec-file/perm')
    perm.value = res?.data || {}
  } catch {
    // 没权限看这个面板时后端已拦；这里保持默认（全 false），页面显示空态而不是报错
  }
}

async function load() {
  loading.value = true
  try {
    const res = await request.get('/extra-rec-file/list', {
      params: { keyword: keyword.value.trim(), pending: tab.value === 'pending', pageNo: pageNo.value, pageSize: pageSize.value },
    })
    const data = res?.data || {}
    rows.value = data.rows || []
    total.value = data.total || 0
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || tt('加载失败'))
  } finally {
    loading.value = false
  }
}

async function reload() {
  pageNo.value = 1
  await Promise.all([loadPerm(), load()])
}

function clearKeyword() {
  keyword.value = ''
  reload()
}

function openUpload() {
  form.value = { file: null, name: '', category: '', keywords: '', remark: '' }
  uploadVisible.value = true
}

/** el-upload 的 file 对象里 .raw 才是真正的 File */
function onFileChange(file) {
  form.value.file = file?.raw || null
  if (!form.value.name && file?.name) {
    form.value.name = String(file.name).replace(/\.[^.]+$/, '')
  }
}

async function submitUpload() {
  if (!form.value.file) {
    ElMessage.warning(tt('请先选择要上传的文件'))
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', form.value.file)
    if (form.value.name) fd.append('name', form.value.name)
    if (form.value.category) fd.append('category', form.value.category)
    if (form.value.keywords) fd.append('keywords', form.value.keywords)
    if (form.value.remark) fd.append('remark', form.value.remark)
    await request.post('/extra-rec-file/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    ElMessage.success(tt('上传成功'))
    uploadVisible.value = false
    await reload()
  } catch (e) {
    ElMessage.error(e?.message || tt('上传失败'))
  } finally {
    uploading.value = false
  }
}

/** 附件下载地址（按附件 id；后端按面板查看权把关，与「能看面板就能看文件」一致） */
function fileUrl(row) {
  const id = row?.attachmentId
  return id ? '/api/attachment/' + id + '/download' : ''
}

function doPreview(row) {
  previewRow.value = row
  const url = fileUrl(row)
  if (!url) {
    ElMessage.warning(tt('这条记录没有附件文件'))
    return
  }
  const ct = String(row?.contentType || '')
  if (ct.startsWith('image/')) {
    previewKind.value = 'image'
    previewUrl.value = url
  } else if (canPreviewInline(ct, row?.fileName)) {
    previewKind.value = 'frame'
    previewUrl.value = url
  } else {
    previewKind.value = 'none'
    previewUrl.value = ''
  }
  previewVisible.value = true
}

function onRowDblclick(row) {
  if (delStateOf(row) === 'pending') return
  doPreview(row)
}

function download(row) {
  const url = fileUrl(row)
  if (!url) {
    ElMessage.warning(tt('这条记录没有附件文件'))
    return
  }
  window.open(url, '_blank')
}

/** 删除按钮：正常 ⇒ 提交申请；待删且我可处理 ⇒ 撤回 */
async function onDeleteClick(row) {
  const a = delActionOf(row, { canApprove: perm.value.canApproveDelete, user: userName.value })
  if (a.disabled) return
  try {
    if (a.action === 'cancel') {
      await ElMessageBox.confirm(tt('撤回这条删除申请？撤回后文件恢复正常'), tt('撤回删除申请'), {
        confirmButtonText: tt('撤回'), cancelButtonText: tt('取消'),
      })
      await request.post('/extra-rec-file/cancelDelete', { id: row.id })
      ElMessage.success(tt('已撤回'))
    } else {
      const { value } = await ElMessageBox.prompt(
        tt('删除需要管理员审批。可以写一句理由，方便审批人判断'),
        tt('申请删除'),
        { confirmButtonText: tt('提交申请'), cancelButtonText: tt('取消'), inputPlaceholder: tt('选填') },
      )
      await request.post('/extra-rec-file/requestDelete', { id: row.id, note: value || '' })
      ElMessage.success(tt('已提交删除申请，等待管理员审批'))
    }
    await reload()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || tt('操作失败'))
  }
}

/** 审批删除：通过 ⇒ 物理删除；驳回 ⇒ 回到正常 */
async function decide(row, approve) {
  try {
    await ElMessageBox.confirm(
      approve
        ? tt('通过后文件将被永久删除，无法恢复。确定通过吗？')
        : tt('驳回后该文件恢复正常，删除申请关闭。确定驳回吗？'),
      approve ? tt('通过删除') : tt('驳回删除'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: approve ? 'warning' : 'info' },
    )
    await request.post('/extra-rec-file/decideDelete', { id: row.id, approve })
    ElMessage.success(approve ? tt('已删除') : tt('已驳回'))
    await reload()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || tt('操作失败'))
  }
}

onMounted(async () => {
  await loadPerm()
  await load()
})
</script>


<style scoped>
/* ═══ 特殊数据记录表 ═══
   数值取自 antd 6.6.8 设计库：
     padding 24 / 16 / 8、controlHeight 32、borderRadius 6、fontSize 14 / lineHeight 22、
     colorBorderSecondary #f0f0f0、colorFillQuaternary rgba(0,0,0,.02)、colorText 88% / 45% / 25%。
   卡片 0 层 ⇒ 白底 + 1px 边框，**不加阴影**。 */
.xrf-page {
  padding: 16px 24px 24px;
  min-width: 0;
  color: rgba(0, 0, 0, 0.88);
  box-sizing: border-box;
}

/* 页头：标题 + 说明在左，「上传」主按钮在右（一个操作区最多一个主按钮） */
.xrf-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16px;
}
.xrf-head-main { min-width: 0; }
.xrf-title { margin: 0; font-size: 17px; line-height: 24px; font-weight: 700; }
.xrf-sub { margin: 4px 0 0; font-size: 12px; line-height: 20px; color: rgba(0, 0, 0, 0.45); }
.xrf-head-act { flex: none; }
.xrf-head-act :deep(.el-button) { min-height: 32px; }

/* 筛选条 */
.xrf-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-bottom: 12px;
}
.xrf-search { width: 340px; max-width: 100%; }
.xrf-tip { font-size: 12px; color: rgba(0, 0, 0, 0.45); }
.xrf-num { font-variant-numeric: tabular-nums; }
.xrf-tip b { color: rgba(0, 0, 0, 0.88); }

/* 内容卡片（0 层：边框，无阴影） */
.xrf-card {
  min-width: 0;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px 16px 16px;
  box-sizing: border-box;
}
.xrf-card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.xrf-card-hint { font-size: 12px; color: rgba(0, 0, 0, 0.45); }

/* 表格：文件名为主信息，分类做弱化标签跟在后面 */
.xrf-name { font-weight: 600; }
.xrf-cat {
  margin-left: 8px;
  padding: 0 6px;
  line-height: 18px;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid #f0f0f0;
}

/* 状态胶囊：正常=灰 / 待审批删除=橙（警示但不用红色实心） */
.xrf-chip {
  display: inline-block;
  padding: 0 8px;
  line-height: 22px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid transparent;
}
.xrf-chip.is-normal { color: #389e0d; background: #f6ffed; border-color: #b7eb8f; }
.xrf-chip.is-pending { color: #d46b08; background: #fff7e6; border-color: #ffd591; }
/* 「等待审批」灰字：替代置灰按钮（模板条件一多 el-table 会整列不渲染，见上方注释） */
.xrf-waiting { font-size: 12px; color: rgba(0, 0, 0, 0.25); }

/* 空态：说明原因 + 提供下一步（空状态规范） */
.xrf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 56px 24px;
  border: 1px dashed #f0f0f0;
  border-radius: 6px;
  text-align: center;
}
.xrf-empty-t { margin: 0; font-size: 14px; line-height: 22px; font-weight: 600; }
.xrf-empty-d { margin: 0 0 8px; font-size: 13px; line-height: 20px; color: rgba(0, 0, 0, 0.45); max-width: 480px; }

.xrf-pager { display: flex; justify-content: flex-end; margin-top: 12px; }

/* 上传弹窗内的拖拽区 */
.xrf-upload { width: 100%; }
.xrf-upload :deep(.el-upload) { width: 100%; }
.xrf-upload :deep(.el-upload-dragger) { width: 100%; padding: 24px; box-sizing: border-box; }
.xrf-drop { text-align: center; }
.xrf-drop-t { margin: 0; font-size: 14px; line-height: 22px; }
.xrf-drop-d { margin: 4px 0 0; font-size: 12px; line-height: 20px; color: rgba(0, 0, 0, 0.45); }
.xrf-form :deep(.el-form-item) { margin-bottom: 16px; }

/* 预览浮层 */
.xrf-preview-body { display: flex; align-items: center; justify-content: center; max-height: 74vh; overflow: auto; }
.xrf-preview-img { max-width: 100%; max-height: 74vh; object-fit: contain; }
.xrf-preview-frame { width: 100%; height: 74vh; border: none; }
.xrf-preview-text {
  width: 100%;
  max-height: 74vh;
  overflow: auto;
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 20px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
}
.xrf-preview-fallback { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 24px; }
.xrf-preview-fallback p { margin: 0; font-size: 14px; color: rgba(0, 0, 0, 0.45); }

/* 响应式三档：1440 / 768 / 375 */
@media (max-width: 768px) {
  .xrf-page { padding: 12px 16px 16px; }
  .xrf-search { width: 100%; }
  .xrf-head { flex-direction: column; align-items: flex-start; }
  .xrf-preview-frame { height: 60vh; }
}
</style>
