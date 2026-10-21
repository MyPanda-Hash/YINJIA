<!--
  MobilePick.vue — 移动端扫码领料(2026-10-20)

  【为什么单独一页】
  小程序扫码领料是**直连数据库写 outh**,绕开了单据链(没有材料出库单 ⇒ 金蝶推不上去、
  工单追溯看不到、ll_no2 回写不亮)。改由 MES 自己的手机网页领料,走
  「扫工单 → 扫物料 → 填数量 → 生成材料出库单草稿 → 审核 → 写流水」这一条唯一过账入口,
  库存才会正常变化。

  【规范(按 docs/design/补充设计-V2.0.md §4.4 与 docs/frontend/前端面板设计.md §10)】
  · 独立移动端入口 `/m/pick`,不套桌面 PortalLayout(tab 栏/侧栏在手机上只是干扰);
  · 375 宽下**不横向滚动**;输入与按钮命中区 ≥44px;数量右对齐(等宽数字);
  · 文案全部走 tt(),译名进 src/i18n/locales/en.js;
  · 安静、密集、可扫描:无装饰动画、无卡通文案,空态与失败用中性业务文案。

  【本期范围(用户 2026-10-20 口径)】
  · 先做**手动输入**(扫码枪/键盘),摄像头扫码等 HTTPS 域名上线后再接 —— 输入框已按
    「回车即提交」设计,接扫码枪不用改任何逻辑;
  · 批号按**批号日期先进先出**预分配,一批不够就扣下一日期批次,**生成多条明细**;
  · 可用量只看 **物料 + 仓库**(不看批号);同批号**不互斥/不预占**,
    真正拦截在审核(`StockLedgerService.applyOut` 现存量不足直接抛错);
  · 仓位按**仓库的默认仓位**带出(库存账只有 物料+仓库+批号 三级,没有仓位 —— 仓位仅单据留痕)。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <!-- 沉浸页(App 或窄屏)没有桌面壳的页签/侧栏 ⇒ 必须给一条回工作台的路,
           否则进了生产领料就出不去(2026-10-21 用户反馈「这个界面上面的导航就不见了」) -->
      <span v-if="showBack" class="mp-back" @click="goHome">‹</span>
      <div class="mp-head">
        <span class="mp-title">{{ tt('生产领料') }}</span>
        <!-- 安卓 App 里显示当前接口号(服务器地址),网页版不显示 -->
        <span v-if="baseUrl" class="mp-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mp-sub">{{ tt('扫工单 → 扫物料 → 先进先出拆批') }}</span>
    </div>

    <!-- 提示条置顶(2026-10-20):原先错误信息落在右栏底部,手机上根本看不见 ⇒
         「未排产扫进来后按钮是灰的、也没提示」。现在任何拦截原因都在顶部一眼可见。 -->
    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>

    <div class="mp-body">
      <div class="mp-left">
    <!-- ① 工单 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('生产工单') }}</span>
        <span v-if="wo && !woBlocked" class="mp-sec-ok">{{ tt('已选') }}</span>
        <span v-if="wo && woBlocked" class="mp-sec-warn">{{ tt('未排产') }}</span>
      </div>
      <div class="mp-row">
        <el-input
          ref="woInput"
          v-model="woText"
          :placeholder="tt('扫工单码或输入工单号')"
          size="large"
          clearable
          @keyup.enter="loadWo"
        />
        <el-button size="large" :loading="woLoading" @click="loadWo">{{ tt('查询') }}</el-button>
        <!-- 安卓 App 里才有原生相机(桥见 android/app/src/.../MainActivity.java);网页版不显示 -->
        <el-button v-if="nativeScan" size="large" @click="scanInto('wo')">{{ tt('扫码') }}</el-button>
      </div>

      <div v-if="woCandidates.length" class="mp-cand">
        <div class="mp-cand-tip">{{ tt('匹配到多行,请选择工单行') }}</div>
        <div
          v-for="(c, i) in woCandidates"
          :key="i"
          class="mp-cand-row"
          @click="pickWo(c)"
        >
          <span class="mp-cand-no">{{ c.工单号 }}<i>#{{ c.工单行号 }}</i></span>
          <span class="mp-cand-p">{{ c.物料编码 }} · {{ c.产品名称 }}</span>
          <span class="mp-cand-qty" :class="{ warn: Number(c.排产数量) <= 0 }">
            {{ Number(c.排产数量) > 0 ? fmt(c.排产数量) : tt('未排产') }}
          </span>
        </div>
      </div>

      <div v-if="wo" class="mp-wo">
        <div class="mp-wo-no">
          {{ wo.工单号 }}<span class="mp-tag">#{{ woLine || wo.工单行号 }}</span>
          <span v-if="woBlocked" class="mp-tag mp-tag-warn">{{ tt('未排产') }}</span>
        </div>
        <div v-if="woLineHint" class="mp-warn">{{ woLineHint }}</div>
        <div class="mp-kv"><span>{{ tt('物料编码') }}</span><b class="mono">{{ wo.物料编码 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ wo.产品名称 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('规格') }}</span><b>{{ wo.规格型号 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ wo.生产线 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('排产数量') }}</span><b class="num" :class="{ warn: woBlocked }">{{ fmt(wo.排产数量) }}</b></div>
        <div class="mp-kv"><span>{{ tt('已开领料单') }}</span><b>{{ wo.领料单号 || tt('无') }}</b></div>
      </div>
      <div v-if="!wo" class="mp-hint">{{ tt('先扫工单码:领料会挂到该工单行上,审核后回写领料单号') }}</div>
    </section>

    <!-- ② 物料 -->
    <section class="mp-card" :class="{ dim: !wo || woBlocked }">
      <div class="mp-sec">{{ tt('领用物料') }}</div>
      <div class="mp-row">
        <el-input
          ref="matInput"
          v-model="matText"
          :placeholder="tt('扫物料码或输入物料编码')"
          size="large"
          clearable
          :disabled="!wo || woBlocked"
          @keyup.enter="probeMaterial"
        />
        <el-button size="large" :loading="matLoading" :disabled="!wo || woBlocked" @click="probeMaterial">
          {{ tt('查询') }}
        </el-button>
        <el-button v-if="nativeScan" size="large" :disabled="!wo || woBlocked" @click="scanInto('mat')">
          {{ tt('扫码') }}
        </el-button>
      </div>

      <div v-if="mat" class="mp-mat">
        <div class="mp-mat-main">
          <div class="mp-mat-name">{{ mat.name || mat.code }}</div>
          <div class="mp-mat-meta">{{ mat.code }} · {{ mat.spec || '—' }} · {{ mat.uom || '—' }}</div>
        </div>
        <div class="mp-mat-stock">
          <b class="num">{{ fmt(mat.total) }}</b>
          <span>{{ tt('可用量') }}</span>
        </div>
      </div>

      <template v-if="mat">
        <!-- 批次勾选(2026-10-21):扫完物料码直接列出该物料**全部批次 + 数量**,
             默认按先进先出勾好;用户可按数量勾选。日期在前的排在前面。
             扫到的码里带批次的,那一行标黄底(见 .is-scanned)。
             2026-10-21 追加:整张表**可展开/收起** —— 批次多的物料(实测 22~30 个批次)
             会把"领用数量/加入"顶到屏幕外,收起后只留一行摘要。 -->
        <div class="mp-batches">
          <div class="mp-batches-toggle" role="button" @click="batchOpen = !batchOpen">
            <span class="mp-bt-title">{{ tt('批次') }} · {{ batchRows.length }}</span>
            <span class="mp-bt-sum">
              <template v-if="selected.length">
                {{ tt('已选') }} <b class="num">{{ fmt(selectedQty) }}</b> {{ mat.uom }}
                <span class="mp-bt-lots">{{ selected.map((b) => b.lot || tt('无批次')).join('、') }}</span>
              </template>
              <template v-else>{{ tt('未选批次') }}</template>
            </span>
            <span class="mp-bt-arrow" :class="{ open: batchOpen }" :title="batchOpen ? tt('收起') : tt('展开')">›</span>
          </div>

          <template v-if="batchOpen">
            <div class="mp-batches-head">
              <span class="mp-bh-lot">{{ tt('批号') }}</span>
              <span class="mp-bh-wh">{{ tt('仓库') }}</span>
              <span class="mp-bh-avail">{{ tt('可用') }}</span>
              <span class="mp-bh-qty">{{ tt('本次') }}</span>
            </div>
            <div
              v-for="(b, i) in batchRows"
              :key="i"
              class="mp-batch-row"
              :class="{ 'is-checked': b.qty > 0, 'is-scanned': b.scanned }"
            >
              <span class="mp-bh-lot">
                <el-checkbox :model-value="b.qty > 0" @change="(v) => onBatchQty(b, v ? b.avail : 0)" />
                <span class="mp-batch-lot" :class="{ mono: !!b.lot }">{{ b.lot || tt('无批次') }}</span>
                <span v-if="b.scanned" class="mp-batch-scan">{{ tt('扫到') }}</span>
              </span>
              <span class="mp-bh-wh">{{ b.warehouse || '—' }}</span>
              <span class="mp-bh-avail num">{{ fmt(b.avail) }}</span>
              <span class="mp-bh-qty">
                <el-input-number
                  :model-value="b.qty"
                  :min="0"
                  :max="b.avail"
                  :precision="2"
                  :step="1"
                  size="small"
                  controls-position="right"
                  @change="(v) => onBatchQty(b, v)"
                />
              </span>
            </div>
            <div v-if="!batchRows.length" class="mp-empty">{{ tt('该物料没有可用批次') }}</div>
          </template>
        </div>

        <div class="mp-row mp-qty">
          <span class="mp-qty-label">{{ tt('领用数量') }}</span>
          <el-input-number v-model="qty" :min="0" :precision="2" :step="1" size="large" controls-position="right" />
          <span class="mp-qty-unit">{{ mat.uom }}</span>
          <el-button size="large" @click="resetFifo">{{ tt('按先进先出重排') }}</el-button>
          <el-button type="primary" size="large" :disabled="!canAdd" @click="addLines">
            {{ tt('加入') }}
          </el-button>
        </div>

        <div class="mp-alloc-sum">
          <span>{{ tt('已选') }} <b class="num">{{ fmt(selectedQty) }}</b> / {{ fmt(qty) }} {{ mat.uom }}</span>
          <span v-if="shortage > 0" class="warn">{{ tt('还剩') }} {{ fmt(shortage) }} {{ tt('未分配到批次') }}</span>
          <span v-else-if="!overSel.ok" class="warn">{{ tt('勾选超过需求') }} {{ fmt(overSel.over) }}</span>
        </div>
        <div v-if="nonFifo" class="mp-warn mp-warn-note">
          {{ tt('当前勾选不是先进先出,生成单据时会写进明细备注') }}
        </div>
      </template>
    </section>

      </div><!-- /mp-left -->

      <div class="mp-right">
    <!-- ③ 领料清单 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('领料清单') }}</span>
        <span class="mp-sec-num">{{ lines.length }}</span>
      </div>
      <div v-if="!lines.length" class="mp-empty">{{ tt('还没有物料') }}</div>
      <div v-for="(l, i) in lines" :key="i" class="mp-line">
        <div class="mp-line-main">
          <div class="mp-line-name">{{ l.name || l.code }}</div>
          <div class="mp-line-meta">
            {{ l.code }} · {{ l.batch || tt('无批次') }} · {{ l.warehouse || '—' }}
            <template v-if="l.bin"> · {{ l.bin }}</template>
          </div>
        </div>
        <span class="mp-line-qty num">{{ fmt(l.qty) }} {{ l.uom }}</span>
        <span class="mp-line-del" @click="lines.splice(i, 1)">{{ tt('删除') }}</span>
      </div>
    </section>

      </div><!-- /mp-right -->
    </div><!-- /mp-body -->

    <div class="mp-foot">
      <el-button size="large" :disabled="!lines.length" @click="reset">{{ tt('清空') }}</el-button>
      <el-button
        type="primary"
        size="large"
        :loading="saving"
        :disabled="!lines.length || !wo || woBlocked"
        @click="submit"
      >
        {{ tt('生成材料出库单') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { queryFormDataList, callButton, errMsg } from '@/business/engine'
import { sumAvailable, buildMaterialOutForm } from '@/business/scanPick'
import {
  parseWorkOrderCode, parseMaterialCode,
  makeBatchRows, autoAllocateFifo, isNonFifo, selectedBatchRows, selectedTotal, checkSelection,
} from '@/business/scanCode'

const router = useRouter()
/**
 * 是否显示「返回」:只有**没有桌面壳**时才有意义 ——
 *   ① 安卓 App(Capacitor/手搓壳)整页无导航;
 *   ② 网页在窄屏下走 immersive(见 PortalLayout 的 meta.immersiveOnMobile)。
 * 判据在 onMounted 里再确认一次 DOM(immersive 时 PortalLayout 不渲染顶栏/页签)。
 */
const showBack = ref(false)
function goHome() {
  router.push('/dashboard')
}

const woInput = ref(null)
const matInput = ref(null)
const woText = ref('')
const wo = ref(null)
const woCandidates = ref([])
const woLoading = ref(false)
/** 工单未排产(排产数量 ≤ 0)⇒ 不允许领料;卡片照常显示(让人看得到是哪张单),但物料区与提交禁用 */
const woBlocked = ref(false)

const matText = ref('')
const mat = ref(null)
const matLoading = ref(false)
const qty = ref(0)

/**
 * 扫码解析结果(2026-10-21):
 *   woLine       工单码第 3 段解出的**工单行号**(1001 → 1);0 表示码里没带
 *   matScanBatch 物料码里带的**批次号**(采购标识码才有);空 = 商品码(不带批次)
 *   batchRows    该物料的**全部批次**行(可勾选,默认先进先出)
 */
const woLine = ref(0)
const matScanBatch = ref('')
const batchRows = ref([])
/** 批次表是否展开(2026-10-21:批次多的物料二三十行,允许收起) */
const batchOpen = ref(true)
/** 用户手改过批次数量 ⇒ 不再用"领用数量"自动重排 */
const qtyEdited = ref(false)
/** 扫工单码但该工单查不到 / 行号对不上时的提示(不阻断,降到按工单号取) */
const woLineHint = ref('')

const lines = ref([])
const saving = ref(false)
const errText = ref('')
const binCache = new Map()

const fmt = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

/** 已勾选的批次行(按 FIFO 顺序) */
const selected = computed(() => selectedBatchRows(batchRows.value))
const selectedQty = computed(() => selectedTotal(batchRows.value))
/** 领用数量还没分配到批次上的部分 */
const shortage = computed(() => {
  const want = Number(qty.value) || 0
  return Math.max(0, Math.round((want - selectedQty.value) * 10000) / 10000)
})
/** 勾选是否违反先进先出(违反 ⇒ 明细备注写明) */
const nonFifo = computed(() => isNonFifo(batchRows.value))
/** 勾选超过需求/库存 */
const overSel = computed(() => checkSelection(batchRows.value, qty.value))
/** 勾选批次扫到的那一批(页面标亮) */
const scannedLot = computed(() => String(matScanBatch.value || '').trim())

/** 交给「加入清单」的明细行(与批号一一对应,一次领用可拆多条) */
const alloc = computed(() => selected.value.map((b) => ({
  code: mat.value ? mat.value.code : '',
  name: mat.value ? mat.value.name : '',
  uom: mat.value ? mat.value.uom : '',
  spec: mat.value ? mat.value.spec : '',
  batch: b.lot,
  warehouse: b.warehouse,
  warehouseCode: b.warehouseCode,
  qty: b.qty,
  price: Number(b.row['结存单价']) || 0,
})))

const canAdd = computed(() => {
  const want = Number(qty.value) || 0
  return !!mat.value && want > 0 && selected.value.length > 0 && shortage.value <= 0 && overSel.value.ok
})

/**
 * 扫码能力(2026-10-21 定稿):
 *  **只用 `window.YjNative.scan()`** —— 两个安卓壳(手搓版 / Capacitor 版)现在都注入这个桥,
 *  底层都是自研 ScanActivity + ZXing(离线、不依赖 Google Play 服务)。
 *  网页版没有这个桥 ⇒ 不显示「扫码」按钮,只留「查询」(手输/扫码枪)。
 *
 *  曾经的 ML Kit 方案已移除:@capacitor-mlkit/barcode-scanning 依赖
 *  play-services-code-scanner(按需下载模块),国内无 GMS 机型必然报
 *  「The Google Barcode Scanner Module is not available」。
 */
const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()
/** 这次扫码是扫给「工单」还是「物料」——原生页返回时用它决定填哪个输入框 */
let scanTarget = null

/**
 * 把扫到的码按**目标**解析后填进去(2026-10-21 用户口径):
 *
 *   工单码 `0@GD-2026-10-0221@1001` → 工单号 GD-2026-10-0221 + **工单行号 1**
 *     (1001 = 固定前缀 1000 + 行号;行号要一起填,材料出库单上也要显示)
 *   物料码 `0@YJ-ZZ-001`            → 物料编码,不带批次 ⇒ 列出该物料**全部批次**供勾选
 *   物料码 `0@YJ-ZZ-001@20261021`   → 物料编码 + 批次 ⇒ 同上,并把该批次**标亮**
 */
function applyScan(code) {
  const text = String(code == null ? '' : code).trim()
  if (!text) return
  const target = scanTarget || (wo.value ? 'mat' : 'wo')
  scanTarget = null

  if (target === 'wo') {
    const p = parseWorkOrderCode(text)
    if (!p.ok) {
      errText.value = tt('这个码里没有工单号')
      return
    }
    woText.value = p.wo
    woLine.value = p.line
    woLineHint.value = ''
    loadWo(p.line)
    return
  }

  const p = parseMaterialCode(text)
  if (!p.ok) {
    errText.value = tt('这个码里没有物料编码')
    return
  }
  matText.value = p.code
  matScanBatch.value = p.batch
  probeMaterial()
}

function scanInto(target) {
  scanTarget = target
  if (window.YjNative && typeof window.YjNative.scan === 'function') {
    try {
      window.YjNative.scan()
    } catch (e) {
      scanTarget = null
      errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    }
    return
  }
  scanTarget = null
  errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
}

onMounted(() => {
  nextTick(() => woInput.value?.focus?.())
  // 手搓壳:原生扫码页返回时由 MainActivity 调这个函数
  window.__yjScanResult = (code, ok) => {
    if (!ok || !code) { scanTarget = null; return }
    applyScan(code)
  }
  // 返回箭头只在**真的没有桌面壳**时显示。
  // ⚠ 2026-10-21:原来用 `.topbar` 是否存在判断,而它在 mounted 这一刻可能还没渲染完
  //   ⇒ App 里明明有顶栏页签也冒出个「‹」。改成看壳的根节点 `.portal`(它在 PortalLayout
  //   模板第一层,挂载时一定在了),并再等一帧。
  nextTick(() => {
    const hasShell = !!document.querySelector('.portal .portal-body')
    showBack.value = !hasShell
  })
})

onBeforeUnmount(() => {
  try { delete window.__yjScanResult } catch (e) { /* ignore */ }
  scanTarget = null
})

watch(lines, () => { errText.value = '' })

/**
 * 工单:扫到/输入工单号 → 精确命中优先,否则列出候选。
 *
 * @param {number} [line] 扫工单码解出的**工单行号**(1001→1);给了就**只取这一行** ——
 *   一张工单可能有多行(不同产品/不同排产),领料必须落到扫的那一行上,
 *   否则材料出库单的「工单行号」写错、后续回写 plang.ll_no2 也会错行。
 */
async function loadWo(line) {
  const kw = String(woText.value || '').trim()
  const wantLine = Number(line) || 0
  errText.value = ''
  woCandidates.value = []
  if (!kw) {
    errText.value = tt('请先扫描或输入工单号')
    return
  }
  woLoading.value = true
  try {
    const res = await request.post('/px/workOrderList', { keyword: kw })
    const rows = Array.isArray(res.data) ? res.data : []
    if (!rows.length) {
      errText.value = tt('没有找到该工单:请核对工单号(已作废的单查不到)')
      return
    }
    const exact = rows.filter((r) => String(r.工单号 || '').trim() === kw)
    // 带行号:先在精确匹配里找该行;找不到就提示(不要静默退化成第一行,否则领错行)
    if (wantLine > 0) {
      const byLine = exact.filter((r) => Number(r.工单行号) === wantLine)
      if (byLine.length === 1) {
        pickWo(byLine[0])
        return
      }
      if (byLine.length === 0 && exact.length > 0) {
        woLineHint.value = tt('码里的工单行号在该工单上不存在,已列出全部行,请手工选择')
        woCandidates.value = exact
        return
      }
    }
    if (exact.length === 1) pickWo(exact[0])
    else if (rows.length === 1) pickWo(rows[0])
    else woCandidates.value = exact.length ? exact : rows.slice(0, 20)
  } catch (e) {
    errText.value = errMsg(e) || tt('查询工单失败')
  } finally {
    woLoading.value = false
  }
}

/**
 * 选中工单行。
 *
 * 2026-10-20 口径:**未排产(排产数量 ≤ 0)的工单不能领料**,而且必须**当场把原因写在最显眼处** ——
 * 之前是直接 return 不选中,结果「按钮是灰的、页面上没有任何提示」,现场只会说"提交不了"。
 * 现在:卡片照常显示(能看见工单号/物料编码/产品/排产数量 = 0 和红色「未排产」标),
 * 物料区与提交按钮禁用,顶部提示条写明去「快速排产」把该工单行排入产线。
 */
function pickWo(row) {
  const planned = Number(row.排产数量) || 0
  wo.value = row
  woText.value = String(row.工单号 || '').trim()
  woLine.value = Number(row.工单行号) || Number(woLine.value) || 0
  woCandidates.value = []
  woBlocked.value = planned <= 0
  mat.value = null
  qty.value = 0
  matText.value = ''
  batchRows.value = []
  matScanBatch.value = ''
  qtyEdited.value = false
  if (woBlocked.value) {
    errText.value = tt('该工单未排产(排产数量为 0),不能领料:请先到「快速排产」把该工单行排入产线,再回来扫码领料')
    return
  }
  errText.value = ''
  nextTick(() => matInput.value?.focus?.())
}

/**
 * 物料:按存货编码查**批号级**可用量,并把该物料的**全部批次**整理成可勾选行。
 *
 * 2026-10-21 用户口径:「扫完物料码后,直接带出这个物料所有批次号和对应的数量,
 * 然后可以根据数量来勾选,默认是先进先出;勾选没遵守先进先出要在备注中写出;
 * 扫到的码里带批次的,要给那个批次标亮」。
 */
async function probeMaterial() {
  const code = String(matText.value || '').trim()
  errText.value = ''
  mat.value = null
  qty.value = 0
  batchRows.value = []
  qtyEdited.value = false
  if (!code) {
    errText.value = tt('请先扫描或输入物料编码')
    return
  }
  matLoading.value = true
  try {
    const res = await queryFormDataList({
      panelCode: 'STOCK_PICK',
      condition: { 存货编码: code },
      pageNo: 1,
      pageSize: 200,
    })
    const rows = (res.list || []).filter((r) => String(r['存货编码'] || '').trim() === code)
    if (!rows.length) {
      errText.value = tt('该物料没有可用库存')
      return
    }
    mat.value = {
      code,
      name: String(rows[0]['存货名称'] || '').trim(),
      spec: String(rows[0]['规格型号'] || '').trim(),
      uom: String(rows[0]['计量单位'] || '').trim(),
      total: sumAvailable(rows),
      rows,
    }
    // 全部批次(先进先出排好);扫到的批次会被标记 scanned ⇒ 页面标亮
    batchRows.value = makeBatchRows(rows, matScanBatch.value)
    // 刚扫完就展开,让人先看见批次(之后用户可收起)
    batchOpen.value = true
    // 扫到的码带了批次 ⇒ 默认就领这一批(数量 = 该批可用量,用户可改)
    const hit = batchRows.value.find((b) => b.scanned)
    if (hit) {
      qty.value = hit.avail
      qtyEdited.value = true
      batchRows.value = batchRows.value.map((b) => ({ ...b, qty: b.scanned ? b.avail : 0, checked: !!b.scanned }))
    }
  } catch (e) {
    errText.value = errMsg(e) || tt('查询可用量失败')
  } finally {
    matLoading.value = false
  }
}

/** 领用数量变化 ⇒ 未手改过就按先进先出重排批次 */
watch(qty, (v) => {
  if (!mat.value) return
  if (qtyEdited.value) return
  batchRows.value = autoAllocateFifo(batchRows.value, Number(v) || 0)
})

/** 用户手改某批数量(勾选 = 数量 > 0) */
function onBatchQty(row, val) {
  const b = batchRows.value.find((x) => x.lot === row.lot && x.warehouseCode === row.warehouseCode)
  if (!b) return
  const v = Math.max(0, Math.round((Number(val) || 0) * 10000) / 10000)
  b.qty = Math.min(v, b.avail)
  b.checked = b.qty > 0
  qtyEdited.value = true
  // 领用数量跟着勾选合计走(避免"选了 5 却说领 3")
  const total = selectedTotal(batchRows.value)
  if (total > 0) qty.value = total
}

/** 一键恢复先进先出 */
function resetFifo() {
  qtyEdited.value = false
  batchRows.value = autoAllocateFifo(batchRows.value, Number(qty.value) || 0)
}

/** 仓库的默认仓位(bs_wh_loc:是否默认=1 优先,其次任一未停用) */
async function resolveBin(warehouseCode, warehouseName) {
  const key = String(warehouseCode || warehouseName || '').trim()
  if (!key) return { binCode: '', bin: '' }
  if (binCache.has(key)) return binCache.get(key)
  let out = { binCode: '', bin: '' }
  try {
    let res = await queryFormDataList({ panelCode: 'WHLOC', condition: { 仓库编码: key }, pageNo: 1, pageSize: 50 })
    let rows = res.list || []
    if (!rows.length && warehouseName) {
      res = await queryFormDataList({ panelCode: 'WHLOC', condition: { 仓库: warehouseName }, pageNo: 1, pageSize: 50 })
      rows = res.list || []
    }
    const usable = rows.filter((r) => !r.停用)
    const def = usable.find((r) => r.是否默认) || usable[0]
    if (def) out = { binCode: String(def.仓位编码 || '').trim(), bin: String(def.仓位编码 || '').trim() }
  } catch { /* 没有仓位档案就不带仓位,不阻断领料 */ }
  binCache.set(key, out)
  return out
}

/** 加入清单:同一 (物料,批号,仓库) 合并数量,避免重复行 */
async function addLines() {
  if (!canAdd.value) return
  // 这一批勾选是否违反先进先出 ⇒ 写进明细备注(用户 2026-10-21 口径)
  const note = nonFifo.value ? tt('未按先进先出') : ''
  const need = await Promise.all(alloc.value.map(async (a) => ({ a, bin: await resolveBin(a.warehouseCode, a.warehouse) })))
  for (const { a, bin } of need) {
    const key = [a.code, a.batch, a.warehouseCode || a.warehouse].map((x) => String(x || '').trim()).join('|')
    const exist = lines.value.find((l) => l.key === key)
    if (exist) {
      exist.qty = Math.round((exist.qty + a.qty) * 10000) / 10000
      if (note) exist.note = note
    } else {
      lines.value.push({
        key,
        code: a.code,
        name: a.name,
        uom: a.uom,
        spec: a.spec,
        batch: a.batch,
        warehouse: a.warehouse,
        warehouseCode: a.warehouseCode,
        binCode: bin.binCode,
        bin: bin.bin,
        qty: a.qty,
        price: a.price,
        note,
      })
    }
  }
  matText.value = ''
  mat.value = null
  qty.value = 0
  batchRows.value = []
  matScanBatch.value = ''
  qtyEdited.value = false
  errText.value = ''
  nextTick(() => matInput.value?.focus?.())
}

function reset() {
  lines.value = []
  matText.value = ''
  mat.value = null
  qty.value = 0
  batchRows.value = []
  matScanBatch.value = ''
  qtyEdited.value = false
  errText.value = ''
}

/** 生成材料出库单草稿(带 加工单号 + 工单行号:追溯与回写都靠这两列) */
async function submit() {
  if (!wo.value || !lines.value.length) return
  // 兜底:未排产的工单不允许生成领料草稿(按钮本该是灰的,这里再拦一次并把原因写到顶部)
  if (woBlocked.value) {
    errText.value = tt('该工单未排产(排产数量为 0),不能领料:请先到「快速排产」把该工单行排入产线,再回来扫码领料')
    return
  }
  saving.value = true
  try {
    const wh = lines.value.every((l) => (l.warehouseCode || l.warehouse) === (lines.value[0].warehouseCode || lines.value[0].warehouse))
      ? lines.value[0].warehouse
      : ''
    const formData = buildMaterialOutForm(lines.value, {
      woNo: wo.value.工单号,
      // 工单行号(2026-10-21):优先用扫工单码解出来的行号,其次工单行自带的行号
      woLine: woLine.value || wo.value.工单行号,
      warehouse: wh,
      warehouseCode: wh ? lines.value[0].warehouseCode : '',
    })
    await callButton({ panelCode: 'MATERIAL_OUT', buttonName: '保存', formData })
    ElMessage.success(tt('已生成材料出库单草稿,请到材料出库单里审核'))
    lines.value = []
  } catch (e) {
    errText.value = errMsg(e) || tt('生成材料出库单失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 手机 375 宽为基准:不横向滚动;命中区 ≥44px;数量右对齐(等宽数字);无装饰动画。
   2026-10-20 第二轮:地址统一到 /panelx/list/PROD_PICK(桌面壳内),所以页脚不再用 position:fixed
  (会压住壳层内容),改成 flex 列 + margin-top:auto —— 内容短时贴底、内容长时随页面滚。 */
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

/* 手机宽度下本页不套桌面壳(见 PortalLayout 的 immersiveOnMobile),此时它自己占满整屏 */
:global(.portal-immersive) { min-height: 100vh; background: var(--el-bg-color-page); }
:global(.portal-immersive) .mp { min-height: 100vh; }

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
/* 返回箭头:只在没有桌面壳时渲染(见 showBack),给沉浸页一条回工作台的路 */
.mp-back {
  flex: none;
  width: 28px;
  font-size: 24px;
  line-height: 1;
  color: var(--el-text-color-regular);
  cursor: pointer;
  user-select: none;
}
.mp-title { font-size: 16px; font-weight: 600; }
/* App 内显示接口号(服务器地址);省略号截断,长地址不撑破标题栏 */
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
.mp-card.dim { opacity: .55; }
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mp-sec-ok { font-size: 11px; font-weight: 400; color: var(--el-color-success); }
.mp-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row :deep(.el-input), .mp-row :deep(.el-input-number) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */

.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mp-warn { margin-top: 6px; font-size: 12px; color: var(--el-color-warning); }

.mp-cand { margin-top: 8px; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-cand-tip { padding: 6px 0; font-size: 12px; color: var(--el-text-color-secondary); }
.mp-cand-row {
  display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 2px;
  border-bottom: 1px solid var(--el-border-color-lighter); cursor: pointer;
}
.mp-cand-row:last-child { border-bottom: 0; }
.mp-cand-no { font-size: 13px; }
.mp-cand-no i { font-style: normal; color: var(--el-text-color-secondary); }
.mp-cand-p { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }

.mp-wo { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-wo-no { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.mp-tag {
  margin-left: 6px; padding: 0 6px; border-radius: 4px; font-size: 11px; font-weight: 400;
  background: var(--el-fill-color); color: var(--el-text-color-regular);
}
.mp-kv { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 13px; }
.mp-kv > span { width: 76px; flex: none; color: var(--el-text-color-secondary); }
.mp-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }

.mp-mat {
  display: flex; align-items: center; gap: 10px;
  margin-top: 10px; padding: 10px; border-radius: 6px; background: var(--el-fill-color-lighter);
}
.mp-mat-main { flex: 1; min-width: 0; }
.mp-mat-name { font-size: 14px; font-weight: 600; }
.mp-mat-meta { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mp-mat-stock { flex: none; text-align: right; }
.mp-mat-stock b { display: block; font-size: 20px; color: var(--el-color-primary); }
.mp-mat-stock span { font-size: 11px; color: var(--el-text-color-secondary); }

/* 领用数量这一行:标签 + 数字 + 单位 + 「按先进先出重排」+「加入」共 5 件,
   390 宽放不下一行 ⇒ 允许换行,并给数字框固定宽(否则标签被压到输入框下面,2026-10-21 实测) */
.mp-qty { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mp-qty-label { flex: none; font-size: 13px; color: var(--el-text-color-regular); }
.mp-qty :deep(.el-input-number) { flex: none; width: 116px; }
.mp-qty-unit { flex: none; min-width: 24px; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-qty :deep(.el-button) { flex: 1 1 96px; margin-left: 0; }

/* ── 批次勾选表(2026-10-21)──────────────────────────────────────────
   手机 375 宽四列不挤:批号占剩余宽、仓库可截断、可用/本次固定宽。
   勾选 = 本次数量 > 0;扫到的批次整行淡黄底 + 「扫到」角标。 */
.mp-batches {
  margin-top: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}

/* 批次表表头条 = 展开/收起开关(2026-10-21):收起时只留这一行摘要,
   把「领用数量 / 加入」留在首屏(批次多的物料有 20~30 行)。 */
.mp-batches-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  user-select: none;
}
.mp-bt-title { flex: none; font-size: 13px; font-weight: 600; }
.mp-bt-sum {
  flex: 1; min-width: 0;
  font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mp-bt-lots { margin-left: 4px; color: var(--el-text-color-placeholder); }
.mp-bt-arrow {
  flex: none;
  font-size: 18px;
  line-height: 1;
  color: var(--el-text-color-secondary);
  transform: rotate(90deg);
  transition: transform 0.15s ease;
}
.mp-bt-arrow.open { transform: rotate(-90deg); }
.mp-batches-head,
.mp-batch-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
}
.mp-batches-head {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
.mp-batch-row {
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}
.mp-batch-row.is-checked { background: var(--el-color-primary-light-9); }
.mp-batch-row.is-scanned { box-shadow: inset 3px 0 0 var(--el-color-warning); }
.mp-bh-lot { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
.mp-batch-lot { min-width: 0; word-break: break-all; }
.mp-batch-scan {
  flex: none;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--el-color-warning-light-8);
  color: var(--el-color-warning-dark-2);
  font-size: 10px;
}
.mp-bh-wh { flex: none; width: 62px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-bh-avail { flex: none; width: 52px; text-align: right; }
.mp-bh-qty { flex: none; width: 92px; }
.mp-bh-qty :deep(.el-input-number) { width: 92px; }
.mp-bh-qty :deep(.el-input__inner) { text-align: right; }
.mp-alloc-sum {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary);
}
.mp-warn-note { margin-top: 6px; }

.mp-alloc { margin-top: 10px; }
.mp-alloc-title { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.mp-alloc-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mp-alloc-row:last-child { border-bottom: 0; }
.mp-alloc-batch { flex: 1; min-width: 0; word-break: break-all; }
.mp-alloc-wh { flex: none; max-width: 40%; color: var(--el-text-color-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-alloc-qty { flex: none; min-width: 64px; text-align: right; }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-line { display: flex; align-items: center; gap: 8px; min-height: 48px; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mp-line:last-child { border-bottom: 0; }
.mp-line-main { flex: 1; min-width: 0; }
.mp-line-name { font-size: 14px; }
.mp-line-meta { margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }
.mp-line-qty { flex: none; min-width: 72px; text-align: right; font-size: 14px; }
.mp-line-del { flex: none; padding: 0 4px; font-size: 13px; color: var(--el-color-danger); cursor: pointer; }

/* 提示条置顶(见模板注释):顶部一眼可见,不随右栏滚动跑掉 */
.mp-err-top { margin: 10px 12px 0; }
/* 未排产:红色小标 + 排产数量标红,卡片照常显示,让人看清是哪张单 */
.mp-sec-warn { font-size: 11px; font-weight: 400; color: var(--el-color-danger); }
.mp-tag-warn { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.mp-kv > b.warn { color: var(--el-color-danger); }
.mp-cand-qty { flex: none; font-size: 12px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mp-cand-qty.warn { color: var(--el-color-danger); }
/* 编码类字段用等宽,长编码更好核对 */
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; font-size: 12px; }
.mp-err {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
  background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2);
}

.mp-foot {
  display: flex; gap: 10px; margin: 12px 12px 0; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  margin-top: auto;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { flex: 1; height: 46px; margin: 0; }

.num { font-variant-numeric: tabular-nums; text-align: right; }

/* ── 电脑端(2026-10-20 用户口径「写成面版,电脑端也能操作」)──
   同一份页面同一地址:窄屏 = 单列;≥900px = 双栏(左:工单/物料录入,右:领料清单),
   一屏能同时看到「扫进去的」和「已加入的」。 */
@media (min-width: 900px) {
  .mp-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 430px);
    gap: 12px;
    align-items: start;
    padding-top: 10px;
  }
  .mp-left, .mp-right { min-width: 0; }
  .mp-right { position: sticky; top: 12px; }
  .mp-card { margin: 0 0 12px; }
}
</style>
