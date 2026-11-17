<!--
  MobileReturnList.vue — 手机扫码 · 生产退料(2026-11-18 独立成页;2026-11-18 第二轮:加扫码退料 + 版面与「生产领料」对齐)

  【用户口径】
  「我还想生产退料独立出来,就是已经领料且审核的领料单据,来扫码退料。……」
  「生产退料也要可以扫码退料而且前端页面要和生产领料对齐,两个界面有差距,其他的扫码也要和领料对齐。」
  「如果领料退料扫的是工单码,就要弹窗选择是混料还是组装。如果是领料单上的二维码就直接跳转。」

  ⇒ 本页 = 生产领料那套"查询单据 → 扫码定位 → 扫物料作业"的同构版本:
    ① 顶部标题栏(与生产领料同一套:标题 / 接口地址 / 说明 / 刷新);
    ② 「查询单据」卡:关键词查询 + **扫码定位**(扫领料单纸面二维码按 @A/@M 直接跳;扫工单码弹窗选 组装/混料);
    ③ 「可退单据」列表(只列已完成且材料出库单已审核的);
    ④ 选中一张 → 扫物料码 → 填退料数量 → 提交生成生产退料单。

  数据全部走既有接口(/px/mobilePick/locate、returnables、returnScan、submitReturn),
  本页只负责把"查单 → 扫码 → 提交"这条动线摆顺,不重复实现退料规则。
-->
<template>
  <div class="mr">
    <div class="mr-top">
      <div class="mr-head">
        <span class="mr-title">{{ tt('生产退料') }}</span>
        <span v-if="baseUrl" class="mr-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mr-sub">{{ tt('查询单据 → 扫码定位 → 扫物料码 → 提交退料') }}</span>
      <el-button class="mr-refresh" size="small" :loading="loading" @click="refreshAll">{{ tt('刷新') }}</el-button>
    </div>

    <div v-if="errText" class="mr-err mr-err-top">{{ errText }}</div>
    <div v-if="okText" class="mr-ok mr-err-top">{{ okText }}</div>

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
        {{ tt('只列已领料且材料出库单已审核的单据') }}
      </div>
    </section>

    <!-- ② 可退单据列表 -->
    <section class="mr-card">
      <div class="mr-sec">
        <span>{{ tt('可退单据') }}</span>
        <span class="mr-sec-num">{{ list.length }}</span>
      </div>

      <div v-if="!list.length" class="mr-empty">{{ tt('没有可退的领料单（需要先领料、且材料出库单被仓管审核）') }}</div>
      <div
        v-for="d in list"
        :key="d.id"
        class="mr-doc"
        :class="{ 'is-cur': cur && cur.id === d.id }"
        @click="select(d)"
      >
        <div class="mr-doc-l1">
          <span class="mr-doc-no mono">{{ d.领料单号 }}</span>
          <span class="mr-tag">{{ tt(d.领料类型 || '组装') }}</span>
          <span class="mr-doc-can num">{{ tt('可退') }} {{ fmtQty(d.可退数量) }}</span>
        </div>
        <div class="mr-doc-l2">
          <span>{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
          <span>{{ d.产品名称 || d.产品编号 || '—' }}</span>
        </div>
        <div class="mr-doc-l3">
          <span>{{ tt('已领') }} {{ fmtQty(d.已领数量) }}</span>
          <span>{{ tt('已退') }} {{ fmtQty(d.已退数量) }}</span>
          <span>{{ tt('可退项数') }} {{ d.可退项数 || 0 }}</span>
          <!-- 显式按钮:手机上比"整行点"更好按,也避免整行点击被内部元素吃掉 -->
          <el-button text size="small" class="mr-pick" type="primary" @click.stop="select(d)">
            {{ cur && cur.id === d.id ? tt('已选中') : tt('选这张退料') }}
          </el-button>
        </div>
      </div>
    </section>

    <!-- ③ 退料作业 -->
    <section v-if="cur" class="mr-card">
      <div class="mr-sec">
        <span>{{ tt('退料作业') }}</span>
        <span class="mr-cur-no mono">{{ cur.领料单号 }}</span>
      </div>

      <div class="mr-row">
        <el-input
          ref="scanInput"
          v-model="matText"
          :placeholder="tt('扫物料码或输入物料编码')"
          size="large"
          clearable
          @keyup.enter="scan"
        />
        <el-button size="large" :loading="scanning" @click="scan">{{ tt('查询') }}</el-button>
      </div>

      <div v-if="mat" class="mr-mat">
        <div class="mr-mat-main">
          <div class="mr-mat-name">{{ mat.名称 || mat.编码 }}</div>
          <div class="mr-mat-meta">
            {{ mat.编码 }} · {{ mat.规格 || '—' }} · {{ mat.单位 || '—' }}
            · {{ tt('已领') }} {{ fmtQty(mat.已领数量) }} / {{ tt('已退') }} {{ fmtQty(mat.已退数量) }}
          </div>
        </div>
        <div class="mr-mat-can">
          <b class="num">{{ fmtQty(mat.可退数量) }}</b>
          <span>{{ tt('本次可退') }}</span>
        </div>
      </div>

      <div v-if="mat" class="mr-qty">
        <span class="mr-qty-lab">{{ tt('退料数量') }}</span>
        <el-input-number v-model="qty" :min="0" :max="Number(mat.可退数量) || 0" :precision="4" :step="1" size="large" />
        <span class="mr-qty-unit">{{ mat.单位 || '' }}</span>
        <el-button type="primary" size="large" :disabled="!canAdd" @click="addLine">{{ tt('加入本次退料') }}</el-button>
      </div>

      <div class="mr-lines">
        <div class="mr-lines-head">
          <span>{{ tt('本次退料') }}</span>
          <span class="mr-sec-num">{{ lines.length }}</span>
        </div>
        <div v-if="!lines.length" class="mr-empty">{{ tt('还没有扫码加入的物料') }}</div>
        <div v-for="(l, i) in lines" :key="l.code" class="mr-line">
          <div class="mr-line-main">
            <span class="mr-line-name">{{ l.name || l.code }}</span>
            <span class="mr-line-meta">{{ l.code }} · {{ l.spec || '—' }}</span>
          </div>
          <span class="mr-line-qty num">-{{ fmtQty(l.qty) }} {{ l.unit }}</span>
          <el-button text type="danger" size="small" @click="removeLine(i)">{{ tt('移除') }}</el-button>
        </div>
      </div>

      <div class="mr-foot">
        <el-button size="large" @click="resetWork">{{ tt('清空') }}</el-button>
        <el-button type="warning" size="large" :loading="submitting" :disabled="!lines.length" @click="submit">
          {{ tt('提交退料') }}
        </el-button>
      </div>
    </section>

    <!-- 扫工单码(分不出组装/混料)时的选择框;扫领料单纸面二维码不会走到这里 -->
    <PickKindDialog v-model="kindVisible" :docs="kindDocs" @pick="(d) => openDocById(d.id)" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onDeactivated } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@core/request'
import { fmtQty, round4, locateQueryOf } from '@/business/mobilePick'
import { focusScanNow } from '@/business/scanFocus'
import PickKindDialog from './PickKindDialog.vue'

const route = useRoute()

const loading = ref(false)
const scanning = ref(false)
/** 物料扫码框:PDA 连扫用(2026-11-16 用户口径,见 business/scanFocus.js) */
const scanInput = ref(null)
const submitting = ref(false)
const errText = ref('')
const okText = ref('')

const keyword = ref('')
const list = ref([])
const cur = ref(null)          // 选中的领料单(台账行)
const matText = ref('')
const mat = ref(null)          // 扫到的物料(可退量等)
const qty = ref(0)
const lines = ref([])          // 本次要退的 [{code,name,spec,unit,qty,can}]

/** 扫码定位框(与「生产领料」对齐:扫领料单码/工单号直接打开) */
const locateInput = ref(null)
const locateText = ref('')
const locateLoading = ref(false)
/** 工单码分不出组装/混料 ⇒ 弹窗选(de-bounce 同一工单只弹一次) */
const kindVisible = ref(false)
const kindDocs = ref([])

const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

const canAdd = computed(() => {
  if (!mat.value) return false
  const n = round4(qty.value)
  return n > 0 && n <= round4(Number(mat.value.可退数量) || 0)
})

const errMsgOf = (e) => e?.response?.data?.message || e?.message || ''
function clearMsg() { errText.value = ''; okText.value = '' }

/** 可退单据(已完成 + 材料出库单已审核) */
async function load() {
  loading.value = true
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/returnables', { params: { keyword: keyword.value.trim() } })
    const d = res.data?.data || res.data || {}
    list.value = Array.isArray(d.list) ? d.list : []
    // 选中的那张如果已经不在列表里(退完/被作废),清掉作业区
    if (cur.value && !list.value.some((x) => x.id === cur.value.id)) resetWork()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询可退单据失败')
  } finally {
    loading.value = false
  }
}

/** 刷新:列表 + 提示一并刷新(与生产领料的「刷新」同一动作) */
async function refreshAll() {
  await load()
  okText.value = tt('已刷新')
}

function select(d) {
  if (cur.value && cur.value.id === d.id) return
  // ⚠ must keep the doc: resetWork(false) clears cur —— 早先这里传了 false,
  //   结果点行后作业区根本不出现(2026-11-18 实测)。
  cur.value = d
  resetWork(true)
  // 选中单据后光标直接进物料扫码框(2026-11-16 PDA 连扫口径)
  focusScanNow(() => scanInput.value, { delay: 150 })
}

/** 清空作业区(keepDoc=false 时连选中的单据一起清) */
function resetWork(keepDoc = true) {
  matText.value = ''
  mat.value = null
  qty.value = 0
  lines.value = []
  errText.value = ''
  okText.value = ''
  if (!keepDoc) cur.value = null
}

// ══════════════ 扫码定位(2026-11-18:扫领料单码/工单号 → 直接进退料) ══════════════

/**
 * 按扫到/输入的码打开**可退的那张单**。
 *
 * 口径(用户原话):「如果领料退料扫的是工单码,就要弹窗选择是混料还是组装。
 * 如果是领料单上的二维码就直接跳转」—— 领料单纸面二维码第 4 段是 @A/@M,
 * 解析出来当 kind 传给后端,后端只回那一张;工单码没有标记 ⇒ 回两张 ⇒ 弹窗让人选。
 */
async function openByCode(raw) {
  const q = locateQueryOf(raw)
  clearMsg()
  if (!q.wo) { errText.value = tt('请先扫描或输入工单号'); return }
  locateLoading.value = true
  try {
    const params = { woNo: q.wo }
    if (q.line > 0) params.line = q.line
    if (q.kind) params.kind = q.kind
    const res = await request.get('/px/mobilePick/locate', { params })
    const d = res.data?.data || res.data || {}
    // ⚠ 先看「单据[]」再判 found:命中整组时 found=true 且带 2 张单(组装在前),
    //   先判 found 会把工单码永远当组装单打开、弹窗出不来(2026-11-18 实测)。
    const docs = Array.isArray(d.单据) ? d.单据 : []
    if (docs.length > 1) {          // 同一工单行的组装 + 混料 ⇒ 让人选
      kindDocs.value = docs
      kindVisible.value = true
      return
    }
    if (d.found) { await openDocById(d.id); return }
    if (d.hint === 'voided') { errText.value = tt('这张单据已作废,不能再打开') + ' (' + q.wo + ')'; return }
    errText.value = tt('没有找到这个工单/单据') + ' (' + q.wo + ')'
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询失败')
  } finally {
    locateLoading.value = false
    focusScanNow(() => locateInput.value, { delay: 150 })
  }
}

/**
 * 按台账 id 打开可退单。
 *
 * <p>「可退」有硬闸门:领料单**已完成**且它的**材料出库单已被仓管审核**(库存才真扣了)。
 * 扫码定位拿到的可能是一张还没审批的单 —— 那就只提示,不能进退料作业区。
 */
async function openDocById(id) {
  if (!id) return
  await load()
  const hit = list.value.find((x) => String(x.id) === String(id))
  if (!hit) {
    errText.value = tt('这张单还不能退:需要先完成领料、且材料出库单被仓管审核')
    return
  }
  select(hit)
}

/** 扫码(PDA/相机):扫到的码交给 openByCode */
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
    errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    return
  }
  // ⚠ 壳里同一时刻只能有一个扫码会话:连点两下只认最后一次
  if (scanPending) return
  scanPending = true
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => { scanPending = false }, 30000)
  try { window.YjNative.scan() } catch { scanPending = false; errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入') }
}

function onScanResult(code, ok) {
  scanPending = false
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  if (!ok || !String(code || '').trim()) {
    errText.value = tt('没有识别到二维码,请重试;也可以直接用扫码枪扫进下面的输入框')
    return
  }
  applyScan(code)
}

function bindScan() {
  if (typeof window !== 'undefined') window.__yjScanResult = onScanResult
}

onDeactivated(() => {
  if (typeof window !== 'undefined' && window.__yjScanResult === onScanResult) window.__yjScanResult = null
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  scanPending = false
})

/** 扫物料码:后端按「已领 − 已退」算本次可退 */
async function scan() {
  clearMsg()
  mat.value = null
  const code = String(matText.value || '').trim()
  if (!code) { errText.value = tt('请先扫描或输入物料编码'); return }
  scanning.value = true
  try {
    const res = await request.post('/px/mobilePick/returnScan', { id: cur.value.id, code })
    const d = res.data?.data || res.data || {}
    mat.value = d
    qty.value = Number(d.可退数量) || 0
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询可退数量失败')
  } finally {
    scanning.value = false
    // PDA 连扫(2026-11-16):扫完光标回到扫码框
    focusScanNow(() => scanInput.value, { delay: 120 })
  }
}

function addLine() {
  if (!canAdd.value || !mat.value) return
  const code = String(mat.value.编码 || '').trim()
  const n = round4(qty.value)
  const exist = lines.value.find((l) => l.code === code)
  if (exist) {
    const total = round4(exist.qty + n)
    if (total > round4(Number(mat.value.可退数量) || 0)) { errText.value = tt('超过可退数量'); return }
    lines.value = lines.value.map((l) => (l.code === code ? { ...l, qty: total } : l))
  } else {
    lines.value = [...lines.value, {
      code, name: mat.value.名称, spec: mat.value.规格, unit: mat.value.单位, qty: n,
    }]
  }
  matText.value = ''
  mat.value = null
  qty.value = 0
  // 填完数量「加入」之后回扫码框(2026-11-16 用户口径)
  focusScanNow(() => scanInput.value, { delay: 80 })
}

function removeLine(i) {
  const next = lines.value.slice()
  next.splice(i, 1)
  lines.value = next
}

/** 提交:一张退料单可以一次退多项 */
async function submit() {
  if (!lines.value.length || !cur.value) return
  const total = lines.value.reduce((s, l) => s + round4(l.qty), 0)
  try {
    await ElMessageBox.confirm(
      `${tt('将退')} ${lines.value.length} ${tt('项物料,合计')} ${fmtQty(total)}。${tt('提交后生成一张生产退料单并入库,库存会增加。确定提交?')}`,
      tt('退料确认'),
      { confirmButtonText: tt('确定退料'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  submitting.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/submitReturn', {
      id: cur.value.id,
      items: lines.value.map((l) => ({ code: l.code, qty: round4(l.qty) })),
    })
    const d = res.data?.data || res.data || {}
    const no = String(d.退料单号 || '').trim()
    okText.value = `${tt('退料成功')}${no ? '：' + no : ''}`
    ElMessage.success(okText.value)
    resetWork()
    await load()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('退料失败')
  } finally {
    submitting.value = false
    // 提交完光标回扫码框(下一项/下一单直接扫)
    focusScanNow(() => scanInput.value, { delay: 200 })
  }
}

onMounted(async () => {
  bindScan()
  // 从「生产领料」单据页跳过来时带 ?no=领料单号 ⇒ 直接把那张单查出来并选中
  const no = String(route.query.no || '').trim()
  if (no) keyword.value = no
  await load()
  if (no) {
    const hit = list.value.find((d) => String(d.领料单号 || '').trim() === no)
    if (hit) select(hit)
  }
  // PDA 连扫(2026-11-16):进页面先落在「扫码定位」框(与生产领料一致),选单后再进物料框
  focusScanNow(() => locateInput.value, { delay: 350 })
})

/** keep-alive 从别的页签回来:重新挂扫码桥 + 光标回扫码框(2026-11-18 与生产领料统一) */
onActivated(() => {
  bindScan()
  focusScanNow(() => (cur.value ? scanInput.value : locateInput.value), { delay: 250 })
})
</script>

<style scoped>
/* 版面口径与「生产领料」(MobilePickList.vue) 保持一致:
   375 宽不横向滚动、命中区 ≥44px、数量右对齐等宽数字、无装饰动画。 */
.mr {
  box-sizing: border-box;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 0 16px;
  background: var(--el-bg-color-page);
  min-height: calc(100vh - 130px);
}
.mr * { box-sizing: border-box; }

.mr-top {
  display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 12px;
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

.mr-err, .mr-ok { margin: 8px 12px 0; padding: 8px 10px; border-radius: 4px; font-size: 13px; }
.mr-err { color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.mr-ok { color: var(--el-color-success); background: var(--el-color-success-light-9); }

.mr-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mr-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mr-sec-num {
  display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}
.mr-row { display: flex; align-items: center; gap: 8px; }
.mr-row-gap { margin-top: 8px; }
.mr-row :deep(.el-input) { flex: 1; min-width: 0; }
.mr-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mr-row :deep(.el-input__wrapper) { min-height: 44px; }
.mr-row :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */
.mr-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

.mr-empty { padding: 16px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mr-doc { padding: 9px 8px; border-bottom: 1px dashed var(--el-border-color-lighter); border-radius: 4px; cursor: pointer; }
.mr-doc:hover { background: var(--el-fill-color-lighter); }
.mr-doc.is-cur { background: var(--el-color-primary-light-9); }
.mr-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mr-doc-no { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mr-tag { padding: 0 6px; border-radius: 8px; font-size: 11px; background: var(--el-fill-color); color: var(--el-text-color-regular); }
.mr-doc-can { margin-left: auto; font-size: 13px; color: var(--el-color-warning); }
.mr-doc-l2, .mr-doc-l3 { margin-top: 3px; display: flex; gap: 12px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mr-cur-no { font-size: 13px; color: var(--el-text-color-regular); }
.mr-mat { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 8px 10px; background: var(--el-fill-color-lighter); border-radius: 4px; }
.mr-mat-main { flex: 1; min-width: 0; }
.mr-mat-name { font-size: 14px; font-weight: 500; }
.mr-mat-meta { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mr-mat-can { text-align: right; flex: none; }
.mr-mat-can b { font-size: 20px; color: var(--el-color-warning); }
.mr-mat-can span { display: block; font-size: 11px; color: var(--el-text-color-secondary); }
.mr-qty { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.mr-qty-lab { font-size: 13px; color: var(--el-text-color-regular); flex: none; }
.mr-qty-unit { font-size: 13px; color: var(--el-text-color-secondary); min-width: 24px; }
.mr-lines { margin-top: 14px; }
.mr-lines-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.mr-line { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mr-line-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mr-line-name { font-size: 14px; }
.mr-line-meta { font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mr-line-qty { font-size: 14px; color: var(--el-color-warning); font-variant-numeric: tabular-nums; }
.mr-foot { display: flex; gap: 10px; margin-top: 14px; }
.mr-foot :deep(.el-button) { flex: 1; }
.mono { font-variant-numeric: tabular-nums; }
@media (max-width: 480px) {
  .mr-qty { flex-wrap: wrap; }
  .mr-qty :deep(.el-input-number) { width: 120px; }
}
</style>
