<!--
  MobileReturnList.vue — 手机扫码 · **生产退料(列表页)**(2026-11-18 第四轮重写)

  【用户口径(原话)】
  「生产退料也要扫码到明细行再扫物料码退料,要和(扫码混料一样)对齐生产领料。」

  ⇒ 本页 = 「生产领料」列表页(`MobilePickList.vue`)/「扫码混料」列表页(`MobileMixScan.vue`)
    的**同一套结构**:
    ① 查询:关键词(领料单号 / 工单号 / 产品名)查「可退单据」组(可展开收起);
    ② 扫码定位:扫领料单纸面码(带 @A/@M)直接打开那张单;扫工单码 → 弹窗选组装/混料;
    ③ 点一行 → **跳转到单据明细页**(`MobileReturnDoc.vue`)里扫物料码退料。

  【为什么不再是"弹窗里作业"】
  上一版(2026-11-18 第二轮)点单弹一个对话框,里面另开一份"本次退料"清单;
  用户要求与生产领料/扫码混料对齐 ⇒ 作业全部搬到**单据明细页**:扫物料码**解锁对应的明细行**、
  数量记在那一行上、底栏提交。两页的分工与本页只看单、明细页只作业,和生产领料完全一致。
-->
<template>
  <div class="mr">
    <div class="mr-top">
      <div class="mr-head">
        <span class="mr-title">{{ tt('生产退料') }}</span>
        <span v-if="baseUrl" class="mr-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mr-sub">{{ tt('查询单据 → 进单据明细 → 扫物料码退料 → 提交') }}</span>
      <el-button class="mr-refresh" size="small" :loading="loading" @click="refreshAll">{{ tt('刷新') }}</el-button>
    </div>

    <div v-if="errText" class="mr-err mr-topline">{{ errText }}</div>
    <div v-if="okText" class="mr-ok mr-topline">{{ okText }}</div>

    <!-- ① 查询单据(与「生产领料」同一套:关键词查询 + 扫码定位) -->
    <section class="mr-card">
      <div class="mr-sec">{{ tt('查询单据') }}</div>
      <div class="mr-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('领料单号 / 工单号 / 产品名称')"
          size="large"
          clearable
          @keyup.enter="load"
        />
        <el-button type="primary" size="large" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
      </div>
      <div class="mr-row mr-row-gap">
        <el-input
          ref="locateInput"
          v-model="locateText"
          :placeholder="tt('扫领料单码 / 工单号,或输入后点打开')"
          size="large"
          clearable
          @keyup.enter="openByCode(locateText)"
        />
        <el-button size="large" :loading="locateLoading" @click="openByCode(locateText)">{{ tt('打开单据') }}</el-button>
        <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>
      <div class="mr-hint">
        {{ tt('扫领料单纸面二维码 → 直接打开对应那张(混料/组装);扫工单码 → 弹窗选混料还是组装;') }}
        {{ tt('只列已领料且材料出库单已审核的单据,点一行进单据明细里扫物料码退料') }}
      </div>
    </section>

    <!-- ② 可退单据(分组可展开/收起,与生产领料的未完成/已完成同一套) -->
    <section class="mr-card">
      <div class="mr-grp-head" @click="openOpen = !openOpen">
        <span class="mr-grp-title">{{ tt('可退单据') }}</span>
        <span class="mr-grp-num">{{ list.length }}</span>
        <i v-if="canTotal > 0" class="mr-grp-sum">{{ tt('可退合计') }} {{ fmtQty(canTotal) }}</i>
        <span class="mr-grp-arrow" :class="{ open: openOpen }">›</span>
      </div>

      <template v-if="openOpen">
        <div v-if="!list.length" class="mr-empty">{{ tt('没有可退的领料单（需要先领料、且材料出库单被仓管审核）') }}</div>
        <div
          v-for="d in list"
          :key="d.id"
          class="mr-doc"
          @click="openDoc(d.id)"
        >
          <div class="mr-doc-l1">
            <span class="mr-doc-no mono">{{ d.领料单号 }}</span>
            <span class="mr-tag">{{ tt(d.领料类型 || '组装') }}</span>
            <span class="mr-doc-can num">{{ tt('可退') }} {{ fmtQty(d.可退数量) }}</span>
          </div>
          <div class="mr-doc-l2">
            <span>{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mr-doc-prog">{{ tt('可退项数') }} {{ d.可退项数 || 0 }}</span>
          </div>
          <div class="mr-doc-l3">
            <span class="mr-doc-p">{{ d.产品名称 || d.产品编号 || '—' }}</span>
            <span class="mr-doc-t">{{ tt('已领') }} {{ fmtQty(d.已领数量) }} · {{ tt('已退') }} {{ fmtQty(d.已退数量) }}</span>
          </div>
        </div>
      </template>
    </section>

    <!-- 扫工单码(分不出组装/混料)时的选择框;扫领料单纸面二维码不会走到这里 -->
    <PickKindDialog v-model="kindVisible" :docs="kindDocs" @pick="(d) => openDoc(d.id)" />
  </div>
</template>

<script setup>
/**
 * 生产退料 · 列表页(2026-11-18 第四轮)。
 *
 * 与 {@code MobilePickList.vue}(生产领料)、{@code MobileMixScan.vue}(扫码混料)刻意同构:
 * 同一套顶栏、同一块「查询 + 扫码定位」、同样可展开收起的分组、同样的卡片三行结构。
 * 本页**不发任何写请求**:点一行进 {@code MobileReturnDoc.vue},退料都在那一页做。
 *
 * 数据:GET /px/mobilePick/returnables(只列已完成 + 材料出库单已审核的领料单)。
 */
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tt } from '@/i18n'
import request from '@core/request'
import { fmtQty, locateQueryOf } from '@/business/mobilePick'
import { focusScanNow } from '@/business/scanFocus'
import PickKindDialog from './PickKindDialog.vue'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const errText = ref('')
const okText = ref('')
const keyword = ref('')
const list = ref([])
const canTotal = ref(0)
/** 扫码定位框(与「生产领料」一致:扫领料单码/工单号直接打开) */
const locateInput = ref(null)
const locateText = ref('')
const locateLoading = ref(false)
/** 工单码分不出组装/混料 ⇒ 弹窗选 */
const kindVisible = ref(false)
const kindDocs = ref([])
/** 分组展开/收起 */
const openOpen = ref(true)

const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

const errMsgOf = (e) => e?.response?.data?.message || e?.message || ''
function clearMsg() { errText.value = ''; okText.value = '' }

/** 红字提示 —— 同时把人拽回页面顶部(与生产领料同一个理由:现场在中间的扫码框上操作) */
function showErr(msg) {
  errText.value = msg
  okText.value = ''
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* 老 WebView 没有 options */ }
}

/** 可退单据(已完成 + 材料出库单已审核) */
async function load() {
  loading.value = true
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/returnables', { params: { keyword: String(keyword.value || '').trim() } })
    const d = res.data?.data || res.data || {}
    list.value = Array.isArray(d.list) ? d.list : []
    canTotal.value = Number(d.可退合计数) || 0
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询可退单据失败')
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await load()
  okText.value = tt('已刷新')
}

// ══════════════ 扫码定位(扫领料单码/工单号 → 直接进明细)══════════════

/**
 * 按扫到/输入的码打开单。
 *
 * 口径(用户原话):「如果领料退料扫的是工单码,就要弹窗选择是混料还是组装。如果是领料单上的
 * 二维码就直接跳转」—— 领料单纸面二维码第 4 段是 @A/@M,解析出来当 kind 传给后端,
 * 后端只回那一张;工单码没有标记 ⇒ 回两张 ⇒ 弹窗让人选。
 */
async function openByCode(raw) {
  const q = locateQueryOf(raw)
  clearMsg()
  if (!q.wo) { showErr(tt('请先扫描或输入工单号')); return }
  locateLoading.value = true
  try {
    const params = { woNo: q.wo }
    if (q.line > 0) params.line = q.line
    if (q.kind) params.kind = q.kind
    const res = await request.get('/px/mobilePick/locate', { params })
    const d = res.data?.data || res.data || {}
    // ⚠ 先看「单据[]」再判 found:命中整组时 found=true 且带 2 张单(组装在前)
    const docs = Array.isArray(d.单据) ? d.单据 : []
    if (docs.length > 1) {
      kindDocs.value = docs
      kindVisible.value = true
      return
    }
    if (d.found) { openDoc(d.id); return }
    if (d.hint === 'voided') { showErr(tt('这张单据已作废,不能再打开') + ' (' + q.wo + ')'); return }
    showErr(tt('没有找到这个工单/单据') + ' (' + q.wo + ')')
  } catch (e) {
    showErr(errMsgOf(e) || tt('查询失败'))
  } finally {
    locateLoading.value = false
    focusScanNow(() => locateInput.value, { delay: 150 })
  }
}

/** 进单据明细页(退料作业都在那里;能不能退由那一页与后端判) */
function openDoc(id) {
  if (!id) return
  router.push({ path: '/panelx/list/MOBILE_RETURN/doc', query: { id: String(id) } })
}

/** 相机扫码:码交给 openByCode */
function applyScan(code) {
  const text = String(code || '').trim()
  if (!text) return
  locateText.value = text
  openByCode(text)
}

let scanPending = false
let scanTimer = null

function scanInto() {
  if (!(window.YjNative && typeof window.YjNative.scan === 'function')) {
    showErr(tt('调不起相机,请改用输入框扫码枪或手工输入'))
    return
  }
  // ⚠ 壳里同一时刻只能有一个扫码会话:连点两下只认最后一次
  if (scanPending) return
  scanPending = true
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => { scanPending = false }, 30000)
  try { window.YjNative.scan() } catch { scanPending = false; showErr(tt('调不起相机,请改用输入框扫码枪或手工输入')) }
}

function onScanResult(code, ok) {
  scanPending = false
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  if (!ok || !String(code || '').trim()) {
    showErr(tt('没有识别到二维码,请重试;也可以直接用扫码枪扫进下面的输入框'))
    return
  }
  applyScan(code)
}

function bindScan() {
  if (typeof window !== 'undefined') window.__yjScanResult = onScanResult
}

onMounted(async () => {
  bindScan()
  // 从「生产领料」的已完成单点「去生产退料」会带 ?no=领料单号 ⇒ 直接翻到那张单的明细页
  const no = String(route.query.no || '').trim()
  if (no) {
    router.replace({ path: '/panelx/list/MOBILE_RETURN/doc', query: { no } })
    return
  }
  await load()
  // PDA 连扫(2026-11-16):进页面先落「扫码定位」框
  focusScanNow(() => locateInput.value, { delay: 350 })
})

/** keep-alive 回来:重挂扫码桥 + 重拉列表(退过料的那张可退量变了) */
let activatedOnce = false
onActivated(() => {
  bindScan()
  if (!activatedOnce) { activatedOnce = true; return }
  load()
  focusScanNow(() => locateInput.value, { delay: 250 })
})

onDeactivated(() => {
  if (typeof window !== 'undefined' && window.__yjScanResult === onScanResult) window.__yjScanResult = null
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  scanPending = false
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && window.__yjScanResult === onScanResult) window.__yjScanResult = null
})
</script>

<style scoped>
/* 版面口径与「生产领料」列表页一致:48px 顶栏 + 灰底 + 卡片 + 两行查询块 + 可收起分组。 */
.mr {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 0 16px;
  background: var(--el-bg-color-page);
  min-height: calc(100vh - 130px);
}
.mr * { box-sizing: border-box; }

.mr-top {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  height: 48px; padding: 0 12px;
  background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-lighter);
}
.mr-head { display: flex; flex-direction: column; min-width: 0; }
.mr-title { font-size: 16px; font-weight: 600; }
.mr-base {
  max-width: 42vw; font-size: 11px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mr-sub {
  flex: 1; min-width: 0; margin-left: 4px; font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mr-refresh { flex: none; }

.mr-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mr-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mr-row { display: flex; align-items: center; gap: 8px; }
.mr-row-gap { margin-top: 8px; }
.mr-row :deep(.el-input) { flex: 1; min-width: 0; }
.mr-row :deep(.el-input__wrapper) { min-height: 44px; }
.mr-row :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */
.mr-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mr-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

/* 分组头 = 展开/收起开关(与生产领料的未完成/已完成同一套观感) */
.mr-grp-head { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; user-select: none; }
.mr-grp-title { font-size: 14px; font-weight: 600; }
.mr-grp-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px;
}
.mr-grp-sum { font-style: normal; font-size: 11px; color: var(--el-color-warning); }
.mr-grp-arrow {
  margin-left: auto; font-size: 18px; line-height: 1;
  color: var(--el-text-color-secondary); transform: rotate(90deg); transition: transform .15s ease;
}
.mr-grp-arrow.open { transform: rotate(-90deg); }

.mr-doc { padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter); cursor: pointer; }
.mr-doc:active { background: var(--el-fill-color-lighter); }
.mr-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mr-doc-no { font-size: 14px; font-weight: 600; }
.mr-tag { padding: 0 6px; border-radius: 8px; font-size: 11px; background: var(--el-fill-color); color: var(--el-text-color-regular); }
.mr-doc-can { margin-left: auto; font-size: 13px; color: var(--el-color-warning); font-variant-numeric: tabular-nums; }
.mr-doc-l2 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mr-doc-l2 i { font-style: normal; color: var(--el-text-color-secondary); }
.mr-doc-prog { margin-left: auto; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mr-doc-l3 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 11px; }
.mr-doc-p {
  flex: 1; min-width: 0; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mr-doc-t { flex: none; color: var(--el-text-color-placeholder); font-variant-numeric: tabular-nums; }

.mr-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mono { font-variant-numeric: tabular-nums; }

.mr-err, .mr-ok {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
}
.mr-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mr-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

/* 电脑端与生产领料列表页同一套两列(左:查询,右:可退单据) */
@media (min-width: 900px) {
  .mr { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mr-top, .mr-err, .mr-ok { grid-column: 1 / -1; }
  .mr-card { margin: 0 0 12px; }
}
@media (max-width: 480px) {
  .mr-row :deep(.el-button) { min-width: 56px; padding: 8px 10px; }
}
</style>
