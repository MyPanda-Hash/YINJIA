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
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- ① 开单入口(2026-10-30 第二轮:生单已独立成面板「生成工单领料/退料单」)
         用户口径:「还有少了一个『生成工单领料/退料单』这个面版,这个面版的功能和生成领料是有区别的
         (不是一个面版)」+ 确认「生成面板只管生单,生完跳转/引导到生产领料面板去领」。
         ⇒ 本页**不再直接生单**,只保留一个跳转入口,避免两个面板职责重叠。 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('生成工单领料/退料单') }}</span>
        <span class="mp-sec-note">{{ tt('按组装BOM表展开用料') }}</span>
      </div>
      <div class="mp-go">
        <span class="mp-go-text">{{ tt('生单在独立的工作台里做:可连续扫多张工单批量生成') }}</span>
        <el-button type="primary" size="large" @click="goCreate">{{ tt('去生成领料/退料单') }}</el-button>
      </div>
    </section>

    <!-- ② 查询 + 扫码定位 -->
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
          :placeholder="tt('扫工单号直接打开对应单据')"
          size="large"
          clearable
          @keyup.enter="locate"
        />
        <el-button size="large" :loading="locateLoading" @click="locate">{{ tt('打开单据') }}</el-button>
        <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>
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
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
    errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    return
  }
  try {
    window.YjNative.scan()
  } catch {
    errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
  }
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
  if (!p.ok) { errText.value = tt('这个码里没有工单号'); return }
  locateText.value = p.wo
  locate(p.line)
}

onMounted(() => {
  window.__yjScanResult = (code, ok) => {
    if (!ok || !code) return
    applyScan(code)
  }
  loadList()
})

onBeforeUnmount(() => {
  try { delete window.__yjScanResult } catch { /* ignore */ }
})

function clearMsg() {
  errText.value = ''
  okText.value = ''
}

function errMsgOf(e) {
  return e?.response?.data?.message || e?.message || ''
}

/** 去开单工作台(生单在那里做) */
function goCreate() {
  router.push('/panelx/list/MOBILE_PICK_CREATE')
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
  if (!kw) { errText.value = tt('请先扫描或输入工单号'); return }
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
      errText.value = `${tt('该工单有多个工单行已开单,请点下面任意一行打开')}`
      list.open = d.candidates.map((c) => ({
        id: c.id, 工单号: kw, 工单行号: c.工单行号, 领料单号: '', 状态: tt('未完成'),
        已领项数: 0, 物料项数: 0, 产品名称: '', 创建人: '', 创建时间: '',
      }))
      openOpen.value = true
      return
    }
    errText.value = tt('该工单行还没有开过领料单:请在上面「生成工单领料/退料单」里扫一次工单')
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询失败')
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
.mp-sub { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }

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

/* 开单入口(2026-10-30 第二轮:生单独立成面板后,本页只留跳转) */
.mp-go { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mp-go-text { flex: 1 1 200px; min-width: 0; font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.5; }
.mp-go :deep(.el-button) { flex: 0 0 auto; height: 44px; }
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


