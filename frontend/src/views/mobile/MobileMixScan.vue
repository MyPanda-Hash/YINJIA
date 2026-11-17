<!--
  MobileMixScan.vue — 手机扫码 · **扫码混料(列表页)**(2026-11-18 第四轮重写)

  【用户口径(原话)】
  「扫码混料,应该和生产领料一样也是跳转到单据的明细里面再开始扫物料码,解锁对应的物料码,
   然后根据连接电子秤的取数,点击确认。再扫其他的物料解锁,根据电子秤再确认。
   全部物料确认完毕后,才可以提交。设计要和生产领料一致。不要独立的去设计。」

  ⇒ 本页 = 「生产领料」列表页(MobilePickList.vue)的**同一套结构与交互**:
    ① 查询:关键字(工单号 / 混料单号 / 产品名)查未完成与已完成两组单据;
    ② 扫码定位:扫工单码 → 直接进该工单行的混料单**明细**;输入/扫混料单号(PL…) → 进已保存单据;
    ③ 两组列表(未完成 / 已完成)都可展开收起,点一行进明细。

  【两台页面的分工(上一版是单页,什么都在一页里)】
  · 本页只做「找单 / 进单」——不扫物料、不取秤、不提交;
  · 扫物料码解锁、电子秤取数、确认、提交全在明细页(MobileMixDoc.vue)。

  【为什么「未完成」按工单行而不是单号】
  混料单号要等**提交**才生成(见 MixScanService#saveDoc),没提交的作业身份就是
  「工单号 + 工单行号」——与「生产领料」未完成组里那些"未生成"的单同一写法。
-->
<template>
  <div class="mm">
    <div class="mm-top">
      <div class="mm-head">
        <span class="mm-title">{{ tt('扫码混料') }}</span>
        <span v-if="baseUrl" class="mm-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mm-sub">{{ tt('查询单据 → 扫工单码进明细 → 扫物料取秤确认 → 全部确认提交') }}</span>
      <el-button class="mm-refresh" size="small" :loading="listLoading" @click="refreshAll">
        {{ tt('刷新') }}
      </el-button>
    </div>

    <div v-if="errText" class="mm-err mm-topline">{{ errText }}</div>
    <div v-if="okText" class="mm-ok mm-topline">{{ okText }}</div>

    <!-- 查询 + 扫码定位(与生产领料列表页同一块两行) -->
    <section class="mm-card">
      <div class="mm-sec">{{ tt('查询单据') }}</div>
      <div class="mm-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('工单号 / 混料单号 / 产品名称')"
          size="large"
          clearable
          @keyup.enter="loadList"
        />
        <el-button type="primary" size="large" :loading="listLoading" @click="loadList">{{ tt('查询') }}</el-button>
      </div>
      <div class="mm-row mm-row-gap">
        <el-input
          ref="scanInput"
          v-model="locateText"
          :placeholder="tt('扫工单码 / 输入工单号或混料单号')"
          size="large"
          clearable
          @keyup.enter="openByCode(locateText)"
        />
        <el-button size="large" :loading="locateLoading" @click="openByCode(locateText)">{{ tt('打开单据') }}</el-button>
        <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>
      <div class="mm-hint">
        {{ tt('扫工单码 → 进该工单行的混料单明细;扫/输入混料单号(PL…)→ 打开已保存的单据(可补打印)') }}
        {{ tt('工单有多行时会列出候选让你选,不替你先猜一行') }}
      </div>
    </section>

    <!-- 工单有多行(且没给行号)时的候选:点哪行开哪行 -->
    <section v-if="candidates.length" class="mm-card">
      <div class="mm-sec">
        <span>{{ tt('选择工单行') }}</span>
        <span class="mm-sec-num">{{ candidates.length }}</span>
      </div>
      <div
        v-for="(c, i) in candidates"
        :key="`${c.orderNo}#${c.lineNo}-${i}`"
        class="mm-cand"
        @click="pickCandidate(c)"
      >
        <span class="mm-cand-no">{{ c.orderNo }}<i>#{{ c.lineNo }}</i></span>
        <span class="mm-cand-p">{{ c.productCode }} · {{ c.productName }}</span>
        <span class="mm-cand-qty" :class="{ warn: !(c.planQty > 0) }">
          {{ c.planQty > 0 ? fmtQty(c.planQty) : tt('未排产') }}
        </span>
      </div>
    </section>

    <!-- 未完成:已确认过料、还没提交的工单行 -->
    <section class="mm-card">
      <div class="mm-grp-head" @click="openOpen = !openOpen">
        <span class="mm-grp-title">{{ tt('未完成') }}</span>
        <span class="mm-grp-num">{{ list.open.length }}</span>
        <span class="mm-grp-arrow" :class="{ open: openOpen }">›</span>
      </div>
      <template v-if="openOpen">
        <div v-if="!list.open.length" class="mm-empty">{{ tt('没有未完成的单据') }}</div>
        <div
          v-for="d in list.open"
          :key="`${d.工单号}#${d.工单行号}`"
          class="mm-doc"
          @click="openDoc(d.工单号, d.工单行号)"
        >
          <div class="mm-doc-l1">
            <span class="mm-doc-no mono">{{ d.单据编号 || tt('未生成') }}</span>
            <span class="mm-doc-state">{{ tt('未完成') }}</span>
          </div>
          <div class="mm-doc-l2">
            <span class="mm-doc-wo">{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mm-doc-prog">{{ tt('已确认') }} {{ d.已确认项数 || 0 }}/{{ d.明细数 || 0 }}</span>
          </div>
          <div class="mm-doc-l3">
            <span class="mm-doc-p">{{ d.产品名称 || d.产品编码 || '—' }}</span>
            <span class="mm-doc-t">{{ d.操作人 || '' }} {{ d.更新时间 || '' }}</span>
          </div>
          <!-- 与生产领料/开单工作台同一口径:卡片上直接给 物料编码 / 规格型号 / 计量单位 -->
          <div class="mm-doc-l4">
            <span><i>{{ tt('物料编码') }}</i>{{ d.产品编码 || '—' }}</span>
            <span><i>{{ tt('生产线') }}</i>{{ d.生产线 || '—' }}</span>
            <span><i>{{ tt('实投合计') }}</i>{{ fmtQty(d.实投合计) }}</span>
          </div>
        </div>
      </template>
    </section>

    <!-- 已完成:已保存的混料单(点进去只读 + 补打印) -->
    <section class="mm-card">
      <div class="mm-grp-head" @click="openDone = !openDone">
        <span class="mm-grp-title">{{ tt('已完成') }}</span>
        <span class="mm-grp-num">{{ list.done.length }}</span>
        <span class="mm-grp-arrow" :class="{ open: openDone }">›</span>
      </div>
      <template v-if="openDone">
        <div v-if="!list.done.length" class="mm-empty">{{ tt('还没有已完成的单据') }}</div>
        <div
          v-for="d in list.done"
          :key="d.单据编号"
          class="mm-doc is-done"
          @click="openSaved(d.单据编号)"
        >
          <div class="mm-doc-l1">
            <span class="mm-doc-no mono">{{ d.单据编号 }}</span>
            <span class="mm-doc-state is-done">{{ tt('已完成') }}</span>
          </div>
          <div class="mm-doc-l2">
            <span class="mm-doc-wo">{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mm-doc-prog">{{ tt('行数') }} {{ d.行数 || 0 }}</span>
          </div>
          <div class="mm-doc-l3">
            <span class="mm-doc-p">{{ d.产品名称 || d.产品编码 || '—' }}</span>
            <span class="mm-doc-t">{{ d.操作人 || '' }} {{ d.保存时间 || '' }}</span>
          </div>
          <div class="mm-doc-l4">
            <span><i>{{ tt('物料编码') }}</i>{{ d.产品编码 || '—' }}</span>
            <span><i>{{ tt('实投合计') }}</i>{{ fmtQty(d.实际用量合计) }}</span>
            <span><i>{{ tt('打印次数') }}</i>{{ d.打印次数 || 0 }}</span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
/**
 * 扫码混料列表页(2026-11-18 第四轮)。
 *
 * 与 {@code MobilePickList.vue}(生产领料)刻意同构:同一套顶部条、同一块「查询 + 扫码定位」、
 * 同样两组可展开收起、同样的卡片四行结构。**改版面时请对齐那一页**。
 *
 * 本页不发任何写请求:找单 → 明细页(MobileMixDoc.vue)才是作业现场。
 */
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '@core/request'
import { tt } from '@/i18n'
import { errMsg } from '@/business/engine'
import { parseWorkOrderQr } from '@/business/mixScan'
import { scanOnce, hasNativeScan } from '@/business/nativeScan'
import { focusScanNow } from '@/business/scanFocus'

const router = useRouter()

const keyword = ref('')
const listLoading = ref(false)
const locateText = ref('')
const locateLoading = ref(false)
const scanInput = ref(null)
const errText = ref('')
const okText = ref('')
const openOpen = ref(true)
const openDone = ref(false)
/** 整单码扫进来时的工单行候选 */
const candidates = ref([])

const list = reactive({ open: [], done: [] })

const nativeScan = hasNativeScan()
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

function fmtQty(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return errMsg(e) || e?.response?.data?.message || e?.message || '' }

/**
 * 红字提示 —— 同时把人**拽回页面顶部**(与生产领料同一个理由:现场操作在中间那条扫码框上,
 * 手机屏小,提示写在顶部常常在视野之外,看起来就像"点了没反应")。
 */
function showErr(msg) {
  errText.value = msg
  okText.value = ''
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* 老 WebView 没有 options */ }
}

async function refreshAll() {
  clearMsg()
  await loadList()
  okText.value = tt('已刷新')
}

onMounted(() => {
  loadList()
  focusScanNow(() => scanInput.value, { delay: 350 })
})

/**
 * keep-alive 下从明细页返回时实例是旧的(与生产领料同一个坑):再激活时重拉两组列表 ——
 * 刚提交的单要从未完成组挪到已完成组。
 */
let activatedOnce = false
onActivated(() => {
  if (!activatedOnce) { activatedOnce = true; return }
  loadList()
  focusScanNow(() => scanInput.value, { delay: 250 })
})

/**
 * 列表 = 两个接口并发拉:
 * · `/px/mix/open`  未完成(已确认过料、还没提交的工单行)
 * · `/px/mix/docs`  已完成(已保存的混料单)
 */
async function loadList() {
  listLoading.value = true
  clearMsg()
  const kw = String(keyword.value || '').trim()
  try {
    const [openRes, doneRes] = await Promise.all([
      request.get('/px/mix/open', { params: { keyword: kw || undefined } }),
      request.get('/px/mix/docs', { params: { keyword: kw || undefined } }),
    ])
    list.open = (openRes && (openRes.data?.list || openRes.list)) || []
    list.done = (doneRes && (doneRes.data?.list || doneRes.list)) || []
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询失败')
  } finally {
    listLoading.value = false
  }
}

/** 调起原生相机扫码(网页版没有壳就不显示这颗按钮) */
async function scanInto() {
  const r = await scanOnce({ formats: ['QR_CODE', 'CODE_128', 'CODE_39'] })
  if (!r.ok) {
    if (r.reason !== 'cancelled') showErr(tt('没有识别到二维码,请重试;也可以直接用扫码枪扫进输入框'))
    return
  }
  locateText.value = r.text
  await openByCode(r.text)
}

/**
 * 扫码/输入 → 打开单据。
 *
 * 三种输入,三种走法(与生产领料列表页的分流同一个思路):
 * ① 工单码(`公司@工单号@(1000+行号)`)→ 解析后按工单行打开明细;
 * ② 混料单号(`PL…`)→ 直接打开已保存的单据(只读 + 补打印);
 * ③ 纯工单号 → 按工单号取行;多行时列候选让人选(**绝不默认第一行**——料会记到别的产品上)。
 */
async function openByCode(raw) {
  const text = String(raw || '').trim()
  clearMsg()
  candidates.value = []
  if (!text) { showErr(tt('请先扫描或输入工单号')); return }

  // ② 混料单号
  if (/^PL\d/i.test(text)) { openSaved(text); return }

  let orderNo = text
  let lineNo = 0
  if (text.includes('@')) {
    const q = parseWorkOrderQr(text)
    if (!q.ok) {
      showErr(q.reason === 'bad-line'
        ? tt('工单码里的行号不是数字')
        : tt('这个不是工单码（工单码格式：公司代码@工单号@行号）'))
      return
    }
    orderNo = q.orderNo
    lineNo = q.lineNo
  }
  locateLoading.value = true
  try {
    const params = { orderNo }
    if (lineNo > 0) params.lineNo = lineNo
    const res = await request.get('/px/mix/lines', { params })
    const rows = (res && (res.data?.list || res.list)) || []
    if (!rows.length) {
      showErr(tt('没有找到这张工单') + ` (${orderNo})` + (lineNo > 0 ? ` #${lineNo}` : ''))
      return
    }
    if (rows.length === 1) {
      openDoc(String(rows[0]['工单号'] || orderNo), Number(rows[0]['工单行号']) || 0)
      return
    }
    candidates.value = rows.map((r) => ({
      orderNo: String(r['工单号'] || orderNo).trim(),
      lineNo: Number(r['工单行号']) || 0,
      productCode: String(r['产品编码'] || '').trim(),
      productName: String(r['产品名称'] || '').trim(),
      planQty: Number(r['排产数量']) || 0,
    }))
    okText.value = tt('这张工单有多行,请点下面任意一行打开')
  } catch (e) {
    showErr(errMsgOf(e) || tt('查询失败'))
  } finally {
    locateLoading.value = false
    focusScanNow(() => scanInput.value, { delay: 150 })
  }
}

function pickCandidate(c) {
  candidates.value = []
  openDoc(c.orderNo, c.lineNo)
}

/** 打开某一工单行的混料单明细(未完成作业) */
function openDoc(woNo, lineNo) {
  const wo = String(woNo || '').trim()
  if (!wo) return
  router.push({ path: '/panelx/list/MOBILE_MIX_SCAN/doc', query: { wo, line: String(Number(lineNo) || 0) } })
}

/** 打开已保存的混料单(只读 + 补打印) */
function openSaved(docNo) {
  const no = String(docNo || '').trim()
  if (!no) return
  router.push({ path: '/panelx/list/MOBILE_MIX_SCAN/doc', query: { docNo: no } })
}
</script>

<style scoped>
/* 与「生产领料」列表页同一套视觉语言(灰底 + 48px 顶栏 + 卡片 + 两行查询块 + 两组列表)。 */
.mm {
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
.mm * { box-sizing: border-box; }

.mm-top {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  height: 48px; padding: 0 12px;
  background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-lighter);
}
.mm-head { display: flex; flex-direction: column; min-width: 0; }
.mm-title { font-size: 16px; font-weight: 600; }
.mm-base {
  max-width: 42vw; font-size: 11px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mm-sub {
  flex: 1; min-width: 0; margin-left: 4px; font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mm-refresh { flex: none; }

.mm-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mm-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mm-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}
.mm-row { display: flex; align-items: center; gap: 8px; }
.mm-row-gap { margin-top: 8px; }
.mm-row :deep(.el-input) { flex: 1; min-width: 0; }
.mm-row :deep(.el-input__wrapper) { min-height: 44px; }
.mm-row :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */
.mm-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mm-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

/* 工单行候选(整单码扫进来时) */
.mm-cand {
  display: flex; align-items: baseline; gap: 8px; min-height: 44px; padding: 8px 2px;
  border-top: 1px dashed var(--el-border-color-lighter); cursor: pointer;
}
.mm-cand:active { background: var(--el-color-primary-light-9); }
.mm-cand-no { font-size: 13px; font-weight: 600; white-space: nowrap; }
.mm-cand-no i { font-style: normal; font-weight: 400; color: var(--el-color-primary); margin-left: 2px; }
.mm-cand-p {
  flex: 1; min-width: 0; font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mm-cand-qty { font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mm-cand-qty.warn { color: var(--el-color-warning); }

/* 分组头 = 展开/收起开关 */
.mm-grp-head {
  display: flex; align-items: center; gap: 8px; min-height: 44px;
  cursor: pointer; user-select: none;
}
.mm-grp-title { font-size: 14px; font-weight: 600; }
.mm-grp-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px;
}
.mm-grp-arrow {
  margin-left: auto; font-size: 18px; line-height: 1;
  color: var(--el-text-color-secondary); transform: rotate(90deg); transition: transform .15s ease;
}
.mm-grp-arrow.open { transform: rotate(-90deg); }

.mm-doc { padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter); cursor: pointer; }
.mm-doc:active { background: var(--el-fill-color-lighter); }
.mm-doc.is-done { opacity: .82; }
.mm-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mm-doc-no { font-size: 14px; font-weight: 600; }
.mm-doc-state {
  margin-left: auto; padding: 0 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mm-doc-state.is-done { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.mm-doc-l2 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mm-doc-wo { color: var(--el-text-color-regular); }
.mm-doc-wo i { font-style: normal; color: var(--el-text-color-secondary); }
.mm-doc-prog { margin-left: auto; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mm-doc-l3 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mm-doc-p {
  flex: 1; min-width: 0; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mm-doc-t { flex: none; color: var(--el-text-color-placeholder); font-size: 11px; }
.mm-doc-l4 { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 3px; font-size: 11px; color: var(--el-text-color-secondary); }
.mm-doc-l4 > span { display: inline-flex; align-items: baseline; gap: 3px; min-width: 0; max-width: 100%; }
.mm-doc-l4 > span > i { font-style: normal; flex: none; color: var(--el-text-color-placeholder); }

.mm-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }

.mm-err, .mm-ok {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
}
.mm-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mm-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

/* ── 电脑端:与生产领料列表页同一套两列(左:查询,右:两组单据) ── */
@media (min-width: 900px) {
  .mm { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mm-top, .mm-err, .mm-ok { grid-column: 1 / -1; }
  .mm-card { margin: 0 0 12px; }
}
@media (max-width: 480px) {
  .mm-row :deep(.el-button) { min-width: 56px; padding: 8px 10px; }
}
</style>
