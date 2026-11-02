<!--
  procFlowCardPhotos.vue — 工序照片墙(2026-10-29,工序流程追踪卡专用)

  【口径】docs/design/工序流程追踪卡-V1.0.md §2.3 / §5:
    · 照片挂 yj_attachment(panel_code=PROC_FLOW_CARD,doc_no=卡号,field=工序照片-<工序序>),
      复用既有上传/删除/下载接口,**不新建表**;
    · 电脑「选择文件」+ 手机直接拍照:同一个 `<input type=file accept="image/*" capture="environment" multiple>`。
      capture 只有手机浏览器认,桌面会退化成普通选择文件 —— 一份代码两端都能用;
    · 缩略图点击 → 统一预览(core 的 openAttachmentPreview),不再"先下载再看"。
  
  【为什么是独立组件】同一堵照片墙在**卡面(可编辑)**、**卡片详情抽屉(只读)**、
  **批次追溯抽屉(只读)** 三处出现 ⇒ 按代码规范 D1 抽成一处,不复制三份。

  【缩略图为什么要绕一层 blob】/attachment/{id}/download 需要 Bearer token,
  `<img src="/api/attachment/1/download">` 带不上 token(会 401/403)⇒ 用 axios 取 blob 再
  createObjectURL;离开时统一 revoke,避免内存泄漏。
-->
<template>
  <div class="pfp">
    <div class="pfp-grid" :class="{ 'is-readonly': !canEdit }">
      <div
        v-for="p in photos"
        :key="p.id"
        class="pfp-item"
        :title="`${p.fileName || ''}${p.uploader ? ' · ' + p.uploader : ''}`"
        @click="preview(p)"
      >
        <img v-if="urls[p.id]" class="pfp-img" :src="urls[p.id]" :alt="p.fileName || ''" loading="lazy" />
        <div v-else class="pfp-ph">{{ tt('照片') }}</div>
        <span class="pfp-name">{{ p.fileName || tt('照片') }}</span>
        <span v-if="canEdit" class="pfp-del no-print" :title="tt('删除照片')" @click.stop="remove(p)">✕</span>
      </div>
      <div v-if="!photos.length" class="pfp-empty">{{ tt('暂无照片') }}</div>
    </div>

    <div v-if="canEdit" class="pfp-bar no-print">
      <button type="button" class="pfp-btn" :disabled="busy || !cardNo" @click="pick">
        {{ busy ? tt('上传中…') : tt('上传照片') }}
      </button>
      <span class="pfp-hint">{{ tt('可拍照或从相册选择,支持多张') }}</span>
      <input ref="fileEl" type="file" accept="image/*" capture="environment" multiple hidden @change="onFiles" />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { openAttachmentPreview } from '@core/panel/attachmentPreview'
import {
  PHOTO_MAX_MB, PHOTO_SOFT_MAX, deletePhoto, errText, guessImageType, loadAttachmentBlob, uploadPhoto,
} from './procFlowCardApi'

const props = defineProps({
  /** 卡号(附件锚点;空 = 还没建卡,不允许上传) */
  cardNo: { type: String, default: '' },
  /** 该道工序的工序序(附件列位 = 工序照片-<工序序>) */
  seq: { type: [Number, String], default: 0 },
  /** 该道工序的照片行 [{id,fileName,fileSize,uploadTime,uploader}] */
  photos: { type: Array, default: () => [] },
  /** 能不能传/删;只读抽屉传 false(只留预览) */
  canEdit: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])

const fileEl = ref(null)
const busy = ref(false)
/** 照片 id → 缩略图 blob URL(取不到时保持空,显示占位块) */
const urls = reactive({})
/** 已发起加载的 id,避免重复请求 */
const loading = new Set()

function pick() {
  if (!props.cardNo) {
    ElMessage.warning(tt('请先创建流程卡再上传照片'))
    return
  }
  fileEl.value?.click()
}

/** 取缩略图(逐张,失败静默 —— 一张图坏了不该让整堵墙报错) */
async function ensureThumb(p) {
  const id = p?.id
  if (id == null || urls[id] || loading.has(id)) return
  loading.add(id)
  try {
    const blob = await loadAttachmentBlob(id)
    if (blob) urls[id] = URL.createObjectURL(blob)
  } catch {
    /* 缩略图失败只影响该格,预览点击时会再试一次 */
  } finally {
    loading.delete(id)
  }
}

watch(
  () => props.photos,
  (list) => {
    const alive = new Set((list || []).map((p) => String(p.id)))
    // 已被删掉的照片:释放 blob
    for (const key of Object.keys(urls)) {
      if (!alive.has(String(key))) {
        try { URL.revokeObjectURL(urls[key]) } catch { /* ignore */ }
        delete urls[key]
      }
    }
    for (const p of list || []) ensureThumb(p)
  },
  { immediate: true, deep: false },
)

onBeforeUnmount(() => {
  for (const key of Object.keys(urls)) {
    try { URL.revokeObjectURL(urls[key]) } catch { /* ignore */ }
    delete urls[key]
  }
})

/** 点击缩略图 → 统一预览(图片浏览器直开;被拦窗时工具自己降级下载) */
async function preview(p) {
  await openAttachmentPreview(
    { id: p.id, fileName: p.fileName, contentType: guessImageType(p.fileName) },
    {
      loadBlob: () => loadAttachmentBlob(p.id),
      onInfo: (m) => ElMessage.info(tt(m)),
      onError: (m) => ElMessage.error(tt(m)),
    },
  )
}

async function onFiles(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  if (!files.length) return
  // 前端两道软校验:单张 ≤20MB(image/* 之外由后端 content-type 兜底)
  const tooBig = files.filter((f) => f.size > PHOTO_MAX_MB * 1024 * 1024)
  if (tooBig.length) {
    ElMessage.warning(`${tt('以下照片超过单张上限')} ${PHOTO_MAX_MB}MB:${tooBig.map((f) => f.name).join('、')}`)
    return
  }
  const will = (props.photos || []).length + files.length
  if (will > PHOTO_SOFT_MAX) {
    ElMessage.info(`${tt('该道工序照片较多,建议不超过')} ${PHOTO_SOFT_MAX} ${tt('张照片')}`)
  }
  busy.value = true
  let ok = 0
  try {
    for (const f of files) {
      try {
        await uploadPhoto({ cardNo: props.cardNo, seq: props.seq, file: f })
        ok++
      } catch (err) {
        ElMessage.error(`${tt('照片上传失败')}:${f.name}(${errText(err, '上传失败')})`)
      }
    }
  } finally {
    busy.value = false
  }
  if (ok > 0) {
    ElMessage.success(`${tt('已上传')} ${ok} ${tt('张照片')}`)
    emit('changed')
  }
}

async function remove(p) {
  try {
    await ElMessageBox.confirm(tt('确认删除这张照片？'), tt('删除确认'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
  } catch { return /* 取消 */ }
  try {
    await deletePhoto(p.id)
    ElMessage.success(tt('照片已删除'))
    emit('changed')
  } catch (err) {
    ElMessage.error(`${tt('照片删除失败')}:${errText(err, '删除失败')}`)
  }
}
</script>

<style scoped>
.pfp { width: 100%; }
/* 照片墙网格:手机 3 列、桌面 4 列(契约 §5「照片墙网格 3~4 列」) */
.pfp-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
@media (min-width: 900px) {
  .pfp-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.pfp-item {
  position: relative;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
}
.pfp-item:hover { border-color: var(--el-color-primary); }
.pfp-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pfp-ph {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
  font-size: 12px; color: var(--el-text-color-placeholder);
}
.pfp-name {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 2px 4px;
  font-size: 10px; line-height: 1.3; color: #fff;
  background: rgba(0, 0, 0, 0.45);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pfp-del {
  position: absolute; top: 2px; right: 2px;
  width: 20px; height: 20px; line-height: 18px; text-align: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45); color: #fff; font-size: 12px;
}
.pfp-del:hover { background: var(--el-color-danger); }
.pfp-empty {
  grid-column: 1 / -1;
  padding: 12px 0; text-align: center;
  font-size: 12px; color: var(--el-text-color-secondary);
  border: 1px dashed var(--el-border-color-lighter); border-radius: 6px;
}
.pfp-bar { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
/* 按钮高度:手机 ≥40px(契约 §5「按钮高度 ≥40px」),桌面回到紧凑尺寸 */
.pfp-btn {
  height: 40px; padding: 0 14px;
  border: 1px dashed var(--el-color-primary); border-radius: 6px;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary);
  font-size: 13px; cursor: pointer;
}
@media (min-width: 900px) { .pfp-btn { height: 30px; padding: 0 10px; font-size: 12px; } }
.pfp-btn:disabled { opacity: .6; cursor: not-allowed; }
.pfp-hint { font-size: 11px; color: var(--el-text-color-secondary); }
@media print { .no-print { display: none !important; } }
</style>
