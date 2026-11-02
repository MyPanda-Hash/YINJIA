<!--
  MobilePickList.vue — 手机扫码 · 生产领料(列表页 + 生单入口,2026-10-30 重写)

  【为什么是这一页】(用户 2026-10-30 口径原文)
  「现在是先做一个『生成工单领料/退料单』,先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的
    组织bom表。对应生成一条生产领料单和生产退料单的数据。
    然后进入『生产领料』的界面,这个界面上面是查询框和查询按钮。下面是列着每个单据的表头数据。
    如果点进去对应单据里面可以看到对应的领料单明细。并且中间还可以扫描工单号(直接查看对应的领料单据)。
    ……并且将已完成的单据,在生产领料的界面放到下面的已完成区(并且已完成和未完成都可以展开和收缩)。」

  ⇒ 一页两个动作:
    ① 生成:扫工单(顶部的生成区)→ 建一对领料/退料单 → 自动打印一次工单二维码;
    ② 查单:顶部查询框 + 查询按钮;中间扫码框扫工单号**直接打开**那张单;
       下面两组(未完成 / 已完成)各自可展开收起,点行进单据详情。

  【规范】(照 MobilePick.vue 的既有约定,别另起一套)
  · 375 宽不横向滚动;命中区 ≥44px;数量右对齐等宽数字;
  · 文案全部走 tt(),译名进 src/i18n/locales/*.js;
  · 安静密集:无装饰动画,空态/失败用中性业务文案;
  · 手机上也要留顶栏 + 页签(2026-10-21 用户口径),故本页**不是**沉浸页。

  【与旧版 MobilePick.vue 的关系】
  旧版是"扫工单 → 逐件扫料 → 直接生成材料出库单草稿"一步到底;
  新版拆成「生单 → 单据里逐项核销 → 全部领完提交」,旧组件保留在仓库里但不再挂菜单/路由。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <div class="mp-head">
        <span class="mp-title">{{ tt('生产领料') }}</span>
        <span v-if="baseUrl" class="mp-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mp-sub">{{ tt('查询单据 → 扫码定位 → 扫码核销 → 全部领完提交') }}</span>
      <!-- 刷新(2026-11-01):keep-alive 会保留旧实例,别处改了状态后本页要靠它拉最新 -->
      <el-button class="mp-refresh" size="small" :loading="listLoading" @click="refreshAll">
        {{ tt('刷新') }}
      </el-button>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- 查询 + 扫码定位(2026-10-30 第三轮:本面板**只看单据**)
         用户口径:「生成工单领料/退料单和生产领料功能都重叠了,给我区分开来」+
         确认「彻底切干净:生单只看工单、领料只看单据」。
         ⇒ 原来那块「去生成领料/退料单」的跳转入口**整个删掉**:生单是另一个面板的事,
           本页只做"查单 + 领料 + 退料",一个按钮都不留(菜单上两个面板各进各的)。 -->
    <section class="mp-card">
      <div class="mp-sec">{{ tt('查询单据') }}</div>
      <div class="mp-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('工单号 / 领料单号 / 产品名称')"
          size="large"
          clearable
          @keyup.enter="loadList"
        />
        <el-button type="primary" size="large" :loading="listLoading" @click="loadList">{{ tt('查询') }}</el-button>
      </div>
      <div class="mp-row mp-row-gap">
        <el-input
          v-model="locateText"
          :placeholder="tt('扫工单号/领料单号,或直接输入后点打开')"
          size="large"
          clearable
          @keyup.enter="locate"
        />
        <el-button size="large" :loading="locateLoading" @click="locate">{{ tt('打开单据') }}</el-button>
        <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>
      <div class="mp-hint">{{ tt('已完成和未完成的单据都能打开;括号里带上工单行号(如 0@GD-…@1001)可精确定位') }}</div>
    </section>

    <!-- ③ 未完成 -->
    <section class="mp-card">
      <div class="mp-grp-head" @click="openOpen = !openOpen">
        <span class="mp-grp-title">{{ tt('未完成') }}</span>
        <span class="mp-grp-num">{{ list.open.length }}<i v-if="list.openTotal > list.open.length"> / {{ list.openTotal }}</i></span>
        <span class="mp-grp-arrow" :class="{ open: openOpen }">›</span>
      </div>
      <template v-if="openOpen">
        <div v-if="!list.open.length" class="mp-empty">{{ tt('没有未完成的单据') }}</div>
        <div
          v-for="d in list.open"
          :key="d.id"
          class="mp-doc"
          @click="openDoc(d.id)"
        >
          <div class="mp-doc-l1">
            <span class="mp-doc-no mono">{{ d.领料单号 || tt('未生成') }}</span>
            <span class="mp-doc-state">{{ d.状态 }}</span>
          </div>
          <div class="mp-doc-l2">
            <span class="mp-doc-wo">{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mp-doc-prog">{{ tt('已领') }} {{ d.已领项数 || 0 }}/{{ d.物料项数 || 0 }}</span>
          </div>
          <div class="mp-doc-l3">
            <span class="mp-doc-p">{{ d.产品名称 || d.产品编号 || '—' }}</span>
            <span class="mp-doc-t">{{ d.创建人 || '' }} {{ d.创建时间 || '' }}</span>
          </div>
        </div>
      </template>
    </section>

    <!-- ④ 已完成 -->
    <section class="mp-card">
      <div class="mp-grp-head" @click="openDone = !openDone">
        <span class="mp-grp-title">{{ tt('已完成') }}</span>
        <span class="mp-grp-num">{{ list.done.length }}<i v-if="list.doneTotal > list.done.length"> / {{ list.doneTotal }}</i></span>
        <span class="mp-grp-arrow" :class="{ open: openDone }">›</span>
      </div>
      <template v-if="openDone">
        <div v-if="!list.done.length" class="mp-empty">{{ tt('还没有已完成的单据') }}</div>
        <div
          v-for="d in list.done"
          :key="d.id"
          class="mp-doc is-done"
          @click="openDoc(d.id)"
        >
          <div class="mp-doc-l1">
            <span class="mp-doc-no mono">{{ d.领料单号 || '—' }}</span>
            <!-- 退料标志(2026-10-30 第三轮):退过料的单在列表里就能认出来 -->
            <span v-if="hasReturn(d)" class="mp-flag" :title="d.退料单号">{{ tt('含退料') }}</span>
            <span class="mp-doc-state is-done">{{ d.状态 }}</span>
          </div>
          <div class="mp-doc-l2">
            <span class="mp-doc-wo">{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mp-doc-prog">{{ tt('已领') }} {{ d.已领项数 || 0 }}/{{ d.物料项数 || 0 }}</span>
          </div>
          <div class="mp-doc-l3">
            <span class="mp-doc-p">{{ d.产品名称 || d.产品编号 || '—' }}</span>
            <span class="mp-doc-t">{{ d.提交人 || '' }} {{ d.提交时间 || '' }}</span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '@core/request'
import { tt } from '@/i18n'
import { parseWorkOrderCode } from '@/business/scanCode'

const router = useRouter()

const keyword = ref('')
const listLoading = ref(false)
const locateText = ref('')
const locateLoading = ref(false)
const errText = ref('')
const okText = ref('')
/** 点了「扫码」后是否还在等壳回调 —— 用来兜底提示"没收到扫码结果"(2026-11-01) */
let scanPending = false
let scanTimer = null
const openOpen = ref(true)
const openDone = ref(false)

const list = reactive({ open: [], done: [], openTotal: 0, doneTotal: 0 })

/** 扫码桥:两个安卓壳都注入 window.YjNative(自研 ZXing),网页版没有 */
const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

/** 本页只有一种扫码目标:**定位单据**(生单已移到独立面板) */
function scanInto() {
  if (!(window.YjNative && typeof window.YjNative.scan === 'function')) {
    showErr(tt('调不起相机,请改用输入框扫码枪或手工输入'))
    return
  }
  try {
    window.YjNative.scan()
  } catch {
    showErr(tt('调不起相机,请改用输入框扫码枪或手工输入'))
    return
  }
  // ── 兜底:壳里回调可能根本不来(相机权限被拒、原生扫码页崩了、WebView 被回收…)
  //    那时页面就是"点了扫码,什么也没发生"。等 10 秒还没回调,主动告诉人一声。
  scanPending = true
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    if (!scanPending) return
    scanPending = false
    showErr(tt('没有收到扫码结果:请确认相机权限已允许;也可以直接用扫码枪扫进输入框'))
  }, 10000)
}

/**
 * 扫到工单码 `0@GD-2026-10-0221@1001` → 工单号 + 行号(1000+行号)→ **定位并打开那张单**。
 *
 * <p>本页**不生成**任何东西:用户口径「中间还可以扫描工单号(直接查看对应的领料单据)」;
 * 生单在独立面板「生成工单领料/退料单」里做。
 */
function applyScan(code) {
  const text = String(code || '').trim()
  if (!text) return
  const p = parseWorkOrderCode(text)
  if (!p.ok) { showErr(tt('这个码里没有工单号') + ':' + text); return }
  locateText.value = p.wo
  locate(p.line)
}

/**
 * 顶部的红字提示 —— 同时**把页面滚到顶部**。
 *
 * 用户 2026-11-01 报障「扫码后没反应」:提示本来写在页面顶部的 `mp-err` 里,
 * 但现场人是在**中间那条扫码框**上操作,手机屏小、提示常常在视野之外,
 * 于是"其实提示了、他看不见" ⇒ 看起来就是没反应。
 * 所以这里除了写提示,还要把人拽回顶部;手机壳里再补一声 toast(更显眼)。
 */
function showErr(msg) {
  errText.value = msg
  clearOk()
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* 老 WebView 没有 options */ }
  try {
    if (window.YjNative && typeof window.YjNative.toast === 'function') window.YjNative.toast(msg)
  } catch { /* 壳里没有 toast 也不影响 */ }
}

function clearOk() { okText.value = '' }

/**
 * 刷新按钮:重拉列表 + 清掉旧提示。
 *
 * <p>为什么要一个按钮而不只靠 onActivated:现场常遇到"人不在页面上、状态被别处改了"
 * (另一台手机提交了、仓管刚审批了),回到页面时数据是旧的。给一个明确的手动刷新,
 * 比让人怀疑"系统是不是没保存"要好。
 */
async function refreshAll() {
  clearMsg()
  await loadList()
  okText.value = tt('已刷新')
}

onMounted(() => {
  bindScan()
  loadList()
})

/**
 * 本页的扫码回调(具名,便于 onDeactivated 按引用撤销)。
 *
 * ⚠ `ok=false` 分支**不能静默 return**(2026-11-01):相机取消、码没识别出来、
 * 权限被拒,many 种情况都会走到这里,静默就是"点了扫码啥也没发生"。
 */
function onScanResult(code, ok) {
  scanPending = false
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  if (!ok || !String(code || '').trim()) {
    showErr(tt('没有识别到二维码,请重试;也可以直接用扫码枪扫进下面的输入框'))
    return
  }
  applyScan(code)
}

/** 把本页的回调挂到壳上 */
function bindScan() {
  if (typeof window !== 'undefined') window.__yjScanResult = onScanResult
}

/**
 * 🔴 keep-alive 下**必须**自己判断"是不是又被激活"。
 *
 * <p>PortalLayout 用 `<component :is>` + keep-alive 缓存页面实例(按 route.path 做 key),
 * 所以从单据明细点「返回」回到本页时,**实例是旧的、onMounted 不会重跑** ——
 * 列表还停着你离开那一刻的数据(刚提交完的单还显示在"未完成"里)。
 * 用户 2026-11-01 口径:「手机端应该有一个刷新按钮,不然会出现旧缓存没跟新状态问题」。
 *
 * <p>首次挂载时 mounted 已经加载过一次,这里跳过,避免开页面就发两次请求。
 *
 * <p>🔴 2026-11-02 用户报障「扫一次之后再扫就显示找不到那个编码的单据,关掉 App 重进又好了」:
 * 根因就是**这个全局回调只有一个槽,三个手机页都在 onMounted 里无条件覆盖它**。
 * 列表 → 明细(明细页把回调换成"按物料找") → 返回列表(keep-alive,列表的 mounted 不重跑)
 * ⇒ 回调还停在明细页的,拿着工单码去按物料找,自然"找不到";重启 App 列表页重新 mounted 才对。
 * 故:**每次被激活都重新绑定自己的回调**,离开时按引用撤销(撤销要判引用,别把别人的删掉)。
 */
let activatedOnce = false
onActivated(() => {
  bindScan()
  if (!activatedOnce) { activatedOnce = true; return }
  loadList()
})

onDeactivated(() => {
  try { if (window.__yjScanResult === onScanResult) delete window.__yjScanResult } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  try { if (window.__yjScanResult === onScanResult) delete window.__yjScanResult } catch { /* ignore */ }
})

function clearMsg() {
  errText.value = ''
  okText.value = ''
}

function errMsgOf(e) {
  return e?.response?.data?.message || e?.message || ''
}

/**
 * 这张单是否含退料(2026-10-30 第三轮;同日修正)。
 *
 * <p>判据两道:① 台账上的「退料单号」非空(退过料才会被 appendReturnNo 写上);
 * ② **必须已完成** —— 退料只能在已提交过账之后做,未完成的单不可能退过料。
 * 只看①会把第一版遗留的空退料单(如 OI-2026-10-0005)误当成"含退料",
 * 用户 2026-10-30 截图报障「未完成为什么又含退料」即此。
 */
function hasReturn(d) {
  return !!(d && String(d.状态 || '') === '已完成'
    && d.退料单号 && String(d.退料单号).trim())
}

async function loadList() {
  listLoading.value = true
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/list', {
      params: { keyword: String(keyword.value || '').trim() || undefined },
    })
    const d = res.data?.data || res.data || {}
    list.open = Array.isArray(d.open) ? d.open : []
    list.done = Array.isArray(d.done) ? d.done : []
    list.openTotal = Number(d.openTotal) || list.open.length
    list.doneTotal = Number(d.doneTotal) || list.done.length
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询失败')
  } finally {
    listLoading.value = false
  }
}

/**
 * 扫工单号 → 直接打开对应的领料单据。
 *
 * <p>本页**只定位不生成**(生单已独立成面板「生成工单领料/退料单」,2026-10-30 第二轮)。
 */
async function locate(line) {
  const kw = String(locateText.value || '').trim()
  clearMsg()
  if (!kw) { showErr(tt('请先扫描或输入工单号')); return }
  locateLoading.value = true
  try {
    const res = await request.get('/px/mobilePick/locate', {
      params: { woNo: kw, line: Number(line) || undefined },
    })
    const d = res.data?.data || res.data || {}
    if (d.found) {
      openDoc(d.id)
      return
    }
    if (d.hint === 'multi-line' && Array.isArray(d.candidates) && d.candidates.length) {
      // 工单号下有多行,且都开过单 ⇒ 让用户选一行(不替他猜)
      showErr(`${tt('该工单有多个工单行已开单,请点下面任意一行打开')}`)
      list.open = d.candidates.map((c) => ({
        id: c.id, 工单号: kw, 工单行号: c.工单行号, 领料单号: '', 状态: tt('未完成'),
        已领项数: 0, 物料项数: 0, 产品名称: '', 创建人: '', 创建时间: '',
      }))
      openOpen.value = true
      return
    }
    // 分情况说清楚(2026-11-01):现场最容易混淆的是"单据不存在"和"单据已作废"
    if (d.hint === 'voided') {
      showErr(tt('这张单据已作废,不能再打开') + ' (' + kw + ')')
      return
    }
    showErr(tt('没有找到这个工单/单据') + ' (' + kw + '):' +
      tt('工单要先生成领料单;已完成、未完成的单据都可以直接打开'))
  } catch (e) {
    showErr(errMsgOf(e) || tt('查询失败'))
  } finally {
    locateLoading.value = false
  }
}

function openDoc(id) {
  if (!id) return
  router.push({ path: '/panelx/list/MOBILE_PICK/doc', query: { id: String(id) } })
}
</script>

<style scoped>
/* 手机 375 宽为基准:不横向滚动;命中区 ≥44px;数量右对齐(等宽数字);无装饰动画。
   与 MobilePick.vue 的视觉语言保持一致(同一组卡片/标题/提示条样式)。 */
.mp {
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
.mp * { box-sizing: border-box; }

.mp-top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 12px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.mp-title { font-size: 16px; font-weight: 600; }
.mp-head { display: flex; flex-direction: column; min-width: 0; }
.mp-base {
  max-width: 42vw; font-size: 11px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mp-sub { flex: 1; min-width: 0; margin-left: 4px; font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 刷新按钮:右上角固定,不参与挤压 */
.mp-refresh { flex: none; }

.mp-card {
  margin: 10px 12px 0;
  padding: 12px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mp-sec-note { font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row-gap { margin-top: 8px; }
.mp-row :deep(.el-input) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */

/* 开单入口样式已删除(2026-10-30 第三轮:本面板只看单据,不再有"去生成"跳转) */
.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

/* 分组头 = 展开/收起开关(用户口径「已完成和未完成都可以展开和收缩」) */
.mp-grp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  cursor: pointer;
  user-select: none;
}
.mp-grp-title { font-size: 14px; font-weight: 600; }
.mp-grp-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px;
}
.mp-grp-num i { font-style: normal; color: var(--el-text-color-placeholder); }
.mp-grp-arrow {
  margin-left: auto;
  font-size: 18px;
  line-height: 1;
  color: var(--el-text-color-secondary);
  transform: rotate(90deg);
  transition: transform .15s ease;
}
.mp-grp-arrow.open { transform: rotate(-90deg); }

.mp-doc {
  padding: 8px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}
.mp-doc:active { background: var(--el-fill-color-lighter); }
.mp-doc.is-done { opacity: .82; }
.mp-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mp-doc-no { font-size: 14px; font-weight: 600; }
/* 退料标志(2026-10-30 第三轮):含退料的单在列表里一眼可辨 */
.mp-flag {
  padding: 0 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mp-doc-state {
  margin-left: auto; padding: 0 6px; border-radius: 4px; font-size: 11px;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mp-doc-state.is-done { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.mp-doc-l2 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mp-doc-wo { color: var(--el-text-color-regular); }
.mp-doc-wo i { font-style: normal; color: var(--el-text-color-secondary); }
.mp-doc-prog { margin-left: auto; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mp-doc-l3 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mp-doc-p { flex: 1; min-width: 0; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-doc-t { flex: none; color: var(--el-text-color-placeholder); font-size: 11px; }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }

.mp-err,
.mp-ok {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
}
.mp-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mp-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

.mp-foot {
  display: flex; gap: 10px; margin: 12px 12px 0; padding: 10px 12px;
  margin-top: auto;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { flex: 1; height: 46px; margin: 0; }

/* ── 电脑端:窄屏单列;≥900px 两列(左:生单+查询,右:两组单据) ── */
@media (min-width: 900px) {
  .mp { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mp-top, .mp-err, .mp-ok, .mp-foot { grid-column: 1 / -1; }
  .mp-card { margin: 0 0 12px; }
  .mp-top { margin-bottom: 0; }
}
</style>


