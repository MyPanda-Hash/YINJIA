<!-- ShareFileCenter.vue — 研发管理·共享文件库(全公司共享资料:标准/测试报告/认证报告)
     左=分类树(可增减,有文件或子分类时禁删) 右=文件列表(分页);
     上传/改/删限指定人(yj_role_panel add|edit|delete,后端强制),其余仅查阅;不走审批流。
     文件本体复用 yj_attachment(预览/下载走 /api/attachment/{id}/download blob)。 -->
<template>
  <div class="sf-page">
    <div class="sf-head">
      <div class="sf-title">{{ tt('共享文件库') }}</div>
      <div class="sf-sub">{{ tt('标准、测试报告、认证报告，指定人上传维护，其余仅查阅') }}</div>
    </div>
    <div class="sf-body">
      <!-- ═══ 左:分类树 ═══ -->
      <div class="sf-tree">
        <div class="sf-tree-hd">
          <span>{{ tt('分类') }}</span>
          <span v-if="perm.canMaintain" class="sf-tree-ops">
            <span :title="tt('新增分类')" @click="openCatDialog('add')">＋</span>
            <span :title="tt('编辑分类')" :class="{ dim: !selCat }" @click="openCatDialog('edit')">✎</span>
            <span :title="tt('删除')" :class="{ dim: !selCat }" @click="onDeleteCat">✕</span>
          </span>
        </div>
        <div class="sf-tree-body">
          <div class="sf-tree-node" :class="{ on: !catId }" @click="pickCat(null)">
            <span class="sf-tree-name">{{ tt('全部文件') }}</span>
            <span class="sf-tree-cnt">{{ totalAll }}</span>
          </div>
          <el-tree
            :data="catTree"
            node-key="id"
            :expand-on-click-node="false"
            default-expand-all
            :highlight-current="true"
            :current-node-key="catId || undefined"
            @current-change="(d) => d && pickCat(d.id)"
          >
            <template #default="{ data }">
              <div class="sf-tree-node" :class="{ on: data.id === catId }">
                <span class="sf-tree-name" :title="data.label">{{ data.label }}</span>
                <span class="sf-tree-cnt">{{ data.count }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>

      <!-- ═══ 右:工具栏 + 文件表 ═══ -->
      <div class="sf-main">
        <div class="sf-bar">
          <el-button v-if="perm.canUpload" type="primary" size="small" :icon="UploadFilled" @click="openFileDialog()">{{ tt('上传') }}</el-button>
          <el-input
            v-model="keyword" size="small" clearable style="width: 260px"
            :placeholder="tt('搜索：名称/关键词/备注')"
            @keyup.enter="reload" @clear="reload"
          />
          <el-button size="small" :icon="Search" @click="reload">{{ tt('搜索') }}</el-button>
          <span class="sf-total">{{ tt('共') }} {{ total }} {{ tt('份文件') }}</span>
        </div>
        <el-table :data="rows" v-loading="loading" border size="small" :empty-text="tt('暂无文件')">
          <el-table-column prop="name" :label="tt('文件名称')" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.attachmentId" class="sf-file-link" :title="tt('预览')" @click="openFile(row)">{{ row.name }}</span>
              <span v-else>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="catPath" :label="tt('分类')" min-width="140" show-overflow-tooltip />
          <el-table-column prop="version" :label="tt('版本号')" width="90" align="center" />
          <el-table-column prop="effectiveDate" :label="tt('生效日期')" width="100" align="center" />
          <el-table-column prop="expiryDate" :label="tt('失效日期')" width="100" align="center" />
          <el-table-column :label="tt('大小')" width="90" align="right">
            <template #default="{ row }">{{ fmtSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column prop="uploader" :label="tt('上传人')" width="80" align="center" />
          <el-table-column prop="uploadTime" :label="tt('上传时间')" width="140" align="center" />
          <el-table-column :label="tt('操作')" width="170" align="center" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.attachmentId" link type="primary" size="small" @click="openFile(row)">{{ tt('预览') }}</el-button>
              <el-button v-if="row.attachmentId" link type="primary" size="small" @click="downloadFile(row)">{{ tt('下载') }}</el-button>
              <el-button v-if="perm.canUpload" link type="primary" size="small" @click="openFileDialog(row)">{{ tt('编辑') }}</el-button>
              <el-button v-if="perm.canDelete" link type="danger" size="small" @click="onDeleteFile(row)">{{ tt('删除') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="sf-pager">
          <el-pagination
            small background layout="total, sizes, prev, pager, next, jumper"
            :total="total" v-model:current-page="pageNo" v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100]" @size-change="reload" @current-change="load"
          />
        </div>
      </div>
    </div>

    <!-- ═══ 分类维护弹窗 ═══ -->
    <el-dialog v-model="catVisible" :title="catMode === 'add' ? tt('新增分类') : tt('编辑分类')" width="420px" append-to-body :close-on-click-modal="false">
      <el-form label-width="90px" size="small">
        <el-form-item :label="tt('上级分类')">
          <el-tree-select
            v-model="catForm.parentId" :data="catParentOptions" check-strictly
            :render-after-expand="false" style="width: 100%" :placeholder="tt('一级分类')" clearable
          />
        </el-form-item>
        <el-form-item :label="tt('分类名称')" required>
          <el-input v-model="catForm.name" :placeholder="tt('请输入分类名称')" maxlength="100" />
        </el-form-item>
        <el-form-item :label="tt('排序')">
          <el-input-number v-model="catForm.seq" :controls="false" style="width: 140px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveCat">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 上传/编辑弹窗 ═══ -->
    <el-dialog v-model="fileVisible" :title="fileForm.id ? tt('编辑') : tt('上传')" width="520px" append-to-body :close-on-click-modal="false">
      <el-form label-width="90px" size="small">
        <el-form-item :label="tt('分类')" required>
          <el-tree-select
            v-model="fileForm.catId" :data="catPickOptions" check-strictly
            :render-after-expand="false" style="width: 100%" :placeholder="tt('请选择分类')"
          />
        </el-form-item>
        <el-form-item :label="tt('文件名称')" required>
          <el-input v-model="fileForm.name" :placeholder="tt('请输入文件名称')" maxlength="200" />
        </el-form-item>
        <el-form-item :label="tt('版本号')">
          <el-input v-model="fileForm.version" :placeholder="tt('如 2024版或V2.1')" maxlength="50" style="width: 200px" />
        </el-form-item>
        <el-form-item :label="tt('生效日期')">
          <el-date-picker v-model="fileForm.effectiveDate" type="date" value-format="YYYY-MM-DD" style="width: 160px" />
          <span class="sf-date-sep">{{ tt('失效日期') }}</span>
          <el-date-picker v-model="fileForm.expiryDate" type="date" value-format="YYYY-MM-DD" style="width: 160px" />
        </el-form-item>
        <el-form-item :label="tt('关键词')">
          <el-input v-model="fileForm.keywords" :placeholder="tt('检索用，空格分隔多词')" maxlength="200" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="fileForm.remark" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item :label="fileForm.id ? tt('替换文件') : tt('文件')" :required="!fileForm.id">
          <input ref="fileInput" type="file" hidden @change="onPickFile" />
          <el-button size="small" @click="fileInput?.click()">{{ fileForm.id ? tt('选择文件') : tt('请选择文件') }}</el-button>
          <span v-if="pickedName" class="sf-picked" :title="pickedName">{{ pickedName }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fileVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveFile">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
    <!-- ═══ 预览:同「导出报表→打印预览」机制——同步先开窗口占位,拿到文件再指向 ═══ -->
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { UploadFilled, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/core/request'
import { tt } from '@/i18n'

const perm = reactive({ canUpload: false, canMaintain: false, canDelete: false })
const cats = ref([])
const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const total = ref(0)
const totalAll = ref(0)
const catId = ref(null)
const selCat = ref(null)
const keyword = ref('')
const pageNo = ref(1)
const pageSize = ref(20)

const catVisible = ref(false)
const catMode = ref('add')
const catForm = reactive({ id: null, parentId: null, name: '', seq: 0 })

const fileVisible = ref(false)
const fileForm = reactive({ id: null, catId: null, name: '', version: '', effectiveDate: '', expiryDate: '', keywords: '', remark: '' })
const pickedFile = ref(null)
const pickedName = ref('')
const fileInput = ref(null)

/** 平铺分类 → 树(count 已含子孙;顺序=SQL 的 seq,id,不做二次排序) */
const catTree = computed(() => {
  const byId = new Map()
  const roots = []
  for (const c of cats.value) byId.set(c.id, { value: c.id, id: c.id, label: c.name, count: c.count, children: [] })
  for (const c of cats.value) {
    const node = byId.get(c.id)
    const parent = c.parentId != null ? byId.get(c.parentId) : null
    ;(parent ? parent.children : roots).push(node)
  }
  return roots
})
/** 分类选择(文件用):任一级可选,含路径名 */
const catPickOptions = computed(() => withPath(catTree.value, ''))
function withPath(list, prefix) {
  return list.map((n) => {
    const label = prefix ? `${prefix} / ${n.label}` : n.label
    return { value: n.value, label, children: withPath(n.children || [], label) }
  })
}
/** 上级分类选择:编辑时排除自己及子孙 */
const catParentOptions = computed(() => {
  const stripDisabled = (list, hideSelf) => list
    .filter((n) => !hideSelf || n.id !== catForm.id)
    .map((n) => ({ value: n.value, label: n.label, children: stripDisabled(n.children || [], hideSelf || n.id === catForm.id) }))
  return stripDisabled(catTree.value, catMode.value === 'edit')
})

async function loadPerm() {
  try {
    const res = await request.get('/share-file/perm')
    Object.assign(perm, res?.data || {})
  } catch { /* 权限加载失败按只读处理 */ }
}

async function loadCats() {
  try {
    const res = await request.get('/share-file/categories')
    cats.value = res?.data || []
    // 全部文件数 = 一级分类含子孙数之和(根级 count 已含子孙)
    totalAll.value = cats.value.filter((c) => c.parentId == null).reduce((s, c) => s + (c.count || 0), 0)
  } catch (e) {
    fail(e, '加载分类失败')
  }
}

async function load() {
  loading.value = true
  try {
    const res = await request.get('/share-file/list', {
      params: { catId: catId.value || undefined, keyword: keyword.value || undefined, pageNo: pageNo.value, pageSize: pageSize.value },
    })
    if (res?.code === 200) {
      rows.value = res.data.rows || []
      total.value = res.data.total || 0
    } else fail(res, '加载文件失败')
  } catch (e) {
    fail(e, '加载文件失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  pageNo.value = 1
  load()
}

function pickCat(id) {
  catId.value = id
  selCat.value = id == null ? null : cats.value.find((c) => c.id === id) || null
  reload()
}

// ══════════ 分类维护 ══════════

function openCatDialog(mode) {
  catMode.value = mode
  if (mode === 'add') {
    catForm.id = null
    catForm.parentId = catId.value // 默认在当前选中分类下新增
    catForm.name = ''
    catForm.seq = 0
  } else if (selCat.value) {
    catForm.id = selCat.value.id
    catForm.parentId = selCat.value.parentId
    catForm.name = selCat.value.name
    catForm.seq = selCat.value.seq
  } else return
  catVisible.value = true
}

async function saveCat() {
  if (!catForm.name.trim()) return ElMessage.warning(tt('请输入分类名称'))
  saving.value = true
  try {
    const body = { parentId: catForm.parentId ?? null, name: catForm.name.trim(), seq: catForm.seq || 0 }
    const res = catMode.value === 'add'
      ? await request.post('/share-file/categories', body)
      : await request.post(`/share-file/categories/${catForm.id}/update`, body)
    if (res?.code === 200) {
      ElMessage.success(tt('保存成功'))
      catVisible.value = false
      await loadCats()
    } else fail(res, '保存失败')
  } catch (e) {
    fail(e, '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDeleteCat() {
  if (!selCat.value) return
  try {
    await ElMessageBox.confirm(tt('确认删除该分类？'), tt('删除确认'), { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.delete(`/share-file/categories/${selCat.value.id}`)
    if (res?.code === 200) {
      ElMessage.success(tt('删除成功'))
      if (catId.value === selCat.value.id) pickCat(null)
      await loadCats()
    } else fail(res, '删除失败')
  } catch (e) {
    fail(e, '删除失败')
  }
}

// ══════════ 文件 ══════════

function openFileDialog(row) {
  pickedFile.value = null
  pickedName.value = ''
  if (row) {
    Object.assign(fileForm, {
      id: row.id, catId: row.catId, name: row.name, version: row.version || '',
      effectiveDate: row.effectiveDate || '', expiryDate: row.expiryDate || '',
      keywords: row.keywords || '', remark: row.remark || '',
    })
    pickedName.value = row.fileName || ''
  } else {
    Object.assign(fileForm, {
      id: null, catId: catId.value, name: '', version: '',
      effectiveDate: '', expiryDate: '', keywords: '', remark: '',
    })
  }
  fileVisible.value = true
}

function onPickFile(e) {
  const f = e.target.files?.[0] || null
  pickedFile.value = f
  pickedName.value = f ? f.name : ''
  if (f && !fileForm.id && !fileForm.name) {
    const dot = f.name.lastIndexOf('.')
    fileForm.name = dot > 0 ? f.name.slice(0, dot) : f.name
  }
}

async function saveFile() {
  if (!fileForm.catId) return ElMessage.warning(tt('请选择分类'))
  if (!fileForm.name.trim()) return ElMessage.warning(tt('请输入文件名称'))
  if (!fileForm.id && !pickedFile.value) return ElMessage.warning(tt('请选择文件'))
  saving.value = true
  try {
    if (fileForm.id) {
      const res = await request.post(`/share-file/${fileForm.id}/update`, {
        catId: fileForm.catId, name: fileForm.name.trim(), version: fileForm.version.trim(),
        effectiveDate: fileForm.effectiveDate, expiryDate: fileForm.expiryDate,
        keywords: fileForm.keywords.trim(), remark: fileForm.remark.trim(),
      })
      if (res?.code !== 200) return fail(res, '保存失败')
      if (pickedFile.value) {
        const fd = new FormData()
        fd.append('file', pickedFile.value)
        const r2 = await request.post(`/share-file/${fileForm.id}/replace-file`, fd, { timeout: 120000 })
        if (r2?.code !== 200) return fail(r2, '上传失败')
      }
      ElMessage.success(tt('保存成功'))
    } else {
      const fd = new FormData()
      fd.append('file', pickedFile.value)
      fd.append('catId', fileForm.catId)
      fd.append('name', fileForm.name.trim())
      if (fileForm.version.trim()) fd.append('version', fileForm.version.trim())
      if (fileForm.effectiveDate) fd.append('effectiveDate', fileForm.effectiveDate)
      if (fileForm.expiryDate) fd.append('expiryDate', fileForm.expiryDate)
      if (fileForm.keywords.trim()) fd.append('keywords', fileForm.keywords.trim())
      if (fileForm.remark.trim()) fd.append('remark', fileForm.remark.trim())
      const res = await request.post('/share-file/upload', fd, { timeout: 120000 })
      if (res?.code !== 200) return fail(res, '上传失败')
      ElMessage.success(tt('上传成功'))
    }
    fileVisible.value = false
    await Promise.all([loadCats(), load()])
  } catch (e) {
    fail(e, '上传失败')
  } finally {
    saving.value = false
  }
}

async function onDeleteFile(row) {
  try {
    await ElMessageBox.confirm(`${tt('确认删除该文件？')}（${row.no} ${row.name}）`, tt('删除确认'), { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.delete(`/share-file/${row.id}`)
    if (res?.code === 200) {
      ElMessage.success(tt('删除成功'))
      await Promise.all([loadCats(), load()])
    } else fail(res, '删除失败')
  } catch (e) {
    fail(e, '删除失败')
  }
}

/** 预览:同「导出报表→打印预览」(previewServerReport) 机制——点击时同步开窗口占位
 *  (用户手势内,弹窗拦截器不拦),await 拿到文件后再呈现:
 *  图片/PDF/文本=blob 直指(浏览器原生渲染);docx=docx-preview 按需加载渲染成 HTML 写入占位窗;
 *  其余类型(含老 .doc)转下载。 */
async function openFile(row) {
  if (!row.attachmentId) return
  const type = row.contentType || ''
  const inlineable = type.startsWith('image/') || type.startsWith('text/')
    || type === 'application/pdf' || type === 'application/json'
  const docx = isDocx(row)
  if (!inlineable && !docx) {
    await downloadFile(row)
    ElMessage.info(tt('已开始下载'))
    return
  }
  const win = window.open('', '_blank')
  const loading = ElMessage({ message: tt('正在打开预览…'), duration: 0 })
  try {
    const blob = await request.get(`/attachment/${row.attachmentId}/download`, { responseType: 'blob', timeout: 120000 })
    if (docx) {
      if (!win) {
        triggerDownload(URL.createObjectURL(blob), row.fileName || row.name)
        ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'))
        return
      }
      try {
        await renderDocxToWindow(blob, row, win)
      } catch {
        // 渲染失败(老格式伪装 docx/文件损坏/极端排版)优雅降级为下载
        if (win) win.close()
        triggerDownload(URL.createObjectURL(blob), row.fileName || row.name)
        ElMessage.info(tt('该文件无法在线预览，已转为下载'))
      }
    } else {
      const url = URL.createObjectURL(blob)
      if (win) win.location.href = url
      else {
        triggerDownload(url, row.fileName || row.name)
        ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'))
      }
    }
  } catch {
    if (win) win.close()
    ElMessage.error(tt('附件下载失败'))
  } finally {
    loading.close()
  }
}

/** .docx 识别:content_type(wordprocessingml)优先,扩展名兜底(历史行 content_type 可能缺失) */
function isDocx(row) {
  const type = row.contentType || ''
  if (type.includes('wordprocessingml')) return true
  return /\.docx$/i.test(String(row.fileName || row.name || ''))
}

/** docx → HTML 渲染进占位窗口:docx-preview 按需动态加载(不预览 Word 不下载这段代码);
 *  先在主文档隐藏容器渲染再序列化写入,避免第三方库跨 window 建 DOM 的兼容性问题。
 *  useBase64URL 把内嵌图片转 data URI,弹窗 HTML 自包含。 */
async function renderDocxToWindow(blob, row, win) {
  const { renderAsync } = await import('docx-preview')
  const buf = await blob.arrayBuffer()
  const bodyHost = document.createElement('div')
  const styleHost = document.createElement('div')
  bodyHost.style.display = 'none'
  styleHost.style.display = 'none'
  document.body.appendChild(bodyHost)
  document.body.appendChild(styleHost)
  try {
    await renderAsync(buf, bodyHost, styleHost, { inWrapper: true, useBase64URL: true })
    if (!bodyHost.innerHTML) throw new Error('docx 渲染结果为空')
    const title = row.fileName || row.name || ''
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    win.document.open()
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>'
      + '<style>body{margin:0;background:#525659;}</style>'
      + styleHost.innerHTML
      + '</head><body>' + bodyHost.innerHTML + '</body></html>'
    )
    win.document.close()
  } finally {
    bodyHost.remove()
    styleHost.remove()
  }
}

async function downloadFile(row) {
  if (!row.attachmentId) return
  try {
    const blob = await request.get(`/attachment/${row.attachmentId}/download`, { responseType: 'blob', timeout: 120000 })
    triggerDownload(URL.createObjectURL(blob), row.fileName || row.name)
  } catch {
    ElMessage.error(tt('附件下载失败'))
  }
}

function triggerDownload(url, name) {
  const el = document.createElement('a')
  el.href = url
  el.download = name
  el.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function fmtSize(n) {
  if (n == null) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

function fail(e, fallback) {
  const msg = e?.data?.message || e?.response?.data?.message || (typeof e?.message === 'string' && !e?.response ? e.message : '') || fallback
  ElMessage.error(msg)
}

onMounted(async () => {
  await loadPerm()
  await Promise.all([loadCats(), load()])
})
</script>

<style scoped>
.sf-page { display: flex; flex-direction: column; height: 100%; background: #f5f7fa; }
.sf-head { padding: 10px 14px 6px; }
.sf-title { font-size: 16px; font-weight: 600; color: #303133; }
.sf-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.sf-body { flex: 1; display: flex; gap: 10px; padding: 6px 14px 14px; min-height: 0; }
.sf-tree { width: 230px; flex: none; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; display: flex; flex-direction: column; min-height: 0; }
.sf-tree-hd { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #ebeef5; font-size: 13px; font-weight: 600; color: #303133; }
.sf-tree-ops { display: flex; gap: 8px; font-weight: 400; }
.sf-tree-ops span { cursor: pointer; color: #409eff; font-size: 13px; }
.sf-tree-ops span:hover { color: #1d6fd1; }
.sf-tree-ops span.dim { color: #c0c4cc; pointer-events: none; }
.sf-tree-body { flex: 1; overflow: auto; padding: 4px 0; }
.sf-tree-node { display: flex; justify-content: space-between; align-items: center; padding: 3px 10px; width: 100%; box-sizing: border-box; cursor: pointer; }
.sf-tree-node:hover { background: #f5f7fa; }
.sf-tree-node.on { background: #ecf5ff; color: #409eff; }
.sf-tree-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.sf-tree-cnt { flex: none; font-size: 12px; color: #909399; margin-left: 6px; }
.sf-tree-node.on .sf-tree-cnt { color: #409eff; }
.sf-main { flex: 1; display: flex; flex-direction: column; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 10px; min-width: 0; min-height: 0; }
.sf-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sf-total { margin-left: auto; font-size: 12.5px; color: #909399; }
.sf-file-link { color: #1d6fd1; cursor: pointer; }
.sf-file-link:hover { text-decoration: underline; }
.sf-pager { display: flex; justify-content: flex-end; padding-top: 8px; }
.sf-date-sep { margin: 0 6px 0 10px; color: #909399; font-size: 12.5px; }
.sf-picked { margin-left: 8px; font-size: 12.5px; color: #606266; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
