<!--
  MobilePickDoc.vue — 手机扫码 · 生产领料单据详情(2026-10-30)

  【用户口径】(2026-10-30 原话)
  「然后进入到那个单据(带有明细里面),可以扫码(扫的是物料码,如果对应的物料码存在,
    就可以填写领料数量(数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的)
    和打印(打印就先只是先打印工单二维码,在生成生产领料单的时候自动打印一次)。
    全部领料完成后才可以提交转成材料出库单……
    生产退料与领料一致,只是退料默认数量为0。可以不进行退料操作,
    退料生成的应该是其他入库单,并且写好备注」

  ⇒ 一页两个页签(领料 / 退料),两边同一套交互,只是退料默认 0 且上限 = 已领数量。

  【交互骨架】
    · 抬头:工单号 #行号 / 产品 / 领料单号 / 退料单号 / 进度(已领 N/M);
    · 扫码框:扫物料码 → 校验"这个物料在本单明细里" → 解锁这一行的数量输入
      (批次沿用 scanCode.js 的先进先出拆批;扫到批次优先填那一批);
    · 明细表:每行 物料/规格/可用量/数量/BOM用量/批次;
    · 底栏:打印(工单二维码) / 提交(仅领料页签,且**每行都有数量**才亮)。

  【为什么数量不是"选批次填"而是"填总量自动拆批"】
  用户口径「数量可以随意填写,只要仓库数量足够,多少都可以」+ 二次确认「超出自动拆到下一批」
  ⇒ 人只填一个总数,拆到哪些批由系统按先进先出决定,拆批结果写在明细备注里(可追溯)。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <span class="mp-back" @click="goBack">‹</span>
      <div class="mp-head">
        <span class="mp-title">{{ doc.领料单号 || tt('领料单据') }}</span>
        <span class="mp-sub2">{{ doc.工单号 }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></span>
      </div>
      <span class="mp-state" :class="{ done: isDone }">{{ doc.状态 }}</span>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- 抬头 -->
    <section class="mp-card">
      <div class="mp-kv"><span>{{ tt('工单号') }}</span><b>{{ doc.工单号 }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></b></div>
      <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ doc.产品名称 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('规格') }}</span><b>{{ wo.规格型号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ wo.生产线 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('领料单号') }}</span><b class="mono">{{ doc.领料单号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('退料单号') }}</span><b class="mono">{{ doc.退料单号 || '—' }}</b></div>
      <div class="mp-kv">
        <span>{{ tt('领料进度') }}</span>
        <b class="num" :class="{ ok: progress.ok }">{{ progress.done }} / {{ progress.total }}</b>
      </div>
    </section>

    <!-- 页签:领料 / 退料 -->
    <div class="mp-tabs">
      <div class="mp-tab" :class="{ on: side === 'pick' }" @click="side = 'pick'">
        {{ tt('生产领料') }} <i>{{ pickRows.length }}</i>
      </div>
      <div class="mp-tab" :class="{ on: side === 'back' }" @click="side = 'back'">
        {{ tt('生产退料') }} <i>{{ backRows.length }}</i>
        <span v-if="backEmpty" class="mp-tab-tip">{{ tt('默认 0') }}</span>
      </div>
    </div>

    <!-- 扫码区 -->
    <section class="mp-card" :class="{ dim: isDone }">
      <div class="mp-sec">
        <span>{{ tt('扫物料码') }}</span>
        <span v-if="cur" class="mp-sec-ok">{{ cur.编码 }}</span>
      </div>
      <div class="mp-row">
        <el-input
          ref="matInput"
          v-model="matText"
          :placeholder="tt('扫物料码或输入物料编码')"
          size="large"
          clearable
          :disabled="isDone"
          @keyup.enter="scanMaterial"
        />
        <el-button size="large" :loading="matLoading" :disabled="isDone" @click="scanMaterial">{{ tt('查询') }}</el-button>
        <el-button v-if="nativeScan" size="large" :disabled="isDone" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>

      <div v-if="cur" class="mp-mat">
        <div class="mp-mat-main">
          <div class="mp-mat-name">{{ cur.名称 || cur.编码 }}</div>
          <div class="mp-mat-meta">
            {{ cur.编码 }} · {{ cur.规格 || '—' }} · {{ cur.单位 || '—' }}
            <template v-if="cur.BOM用量 > 0"> · {{ tt('BOM用量') }} {{ fmtQty(cur.BOM用量) }}</template>
          </div>
        </div>
        <div class="mp-mat-stock">
          <b class="num">{{ fmtQty(cur.允许上限) }}</b>
          <span>{{ side === 'back' ? tt('最多可退') : tt('可用总量') }}</span>
        </div>
      </div>

      <template v-if="cur">
        <!-- 数量:随便填,上限 = 库存总量(领) / 已领数量(退) -->
        <div class="mp-row mp-qty">
          <span class="mp-qty-label">{{ side === 'back' ? tt('退料数量') : tt('领用数量') }}</span>
          <el-input-number
            v-model="curQty"
            :min="0"
            :max="cur.允许上限"
            :precision="4"
            :step="1"
            size="large"
            controls-position="right"
            :disabled="isDone"
            @change="onQtyChange"
          />
          <span class="mp-qty-unit">{{ cur.单位 || '' }}</span>
          <el-button
            type="primary"
            size="large"
            :loading="saving"
            :disabled="isDone || !(curQty > 0)"
            @click="saveQty"
          >
            {{ tt('写入') }}
          </el-button>
        </div>

        <!-- 批次:沿用旧逻辑(先进先出/扫到优先),这里只读展示拆批结果 -->
        <div v-if="batchRows.length" class="mp-batches">
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
              <span class="mp-batch-lot" :class="{ mono: !!b.lot }">{{ b.lot || tt('无批次') }}</span>
              <span v-if="b.scanned" class="mp-batch-scan">{{ tt('扫到') }}</span>
            </span>
            <span class="mp-bh-wh">{{ b.warehouse || '—' }}</span>
            <span class="mp-bh-avail num">{{ fmtQty(b.avail) }}</span>
            <span class="mp-bh-qty num">{{ b.qty > 0 ? fmtQty(b.qty) : '—' }}</span>
          </div>
          <div v-if="shortage > 0" class="mp-warn">
            {{ tt('库存不够') }}:{{ tt('还差') }} {{ fmtQty(shortage) }} {{ cur.单位 }}
          </div>
          <div v-else-if="nonFifo" class="mp-warn">{{ tt('当前不是先进先出,已写进明细备注') }}</div>
        </div>
      </template>
      <div v-else class="mp-hint">
        {{ side === 'back'
          ? tt('退料默认数量为 0:不退料就不用管本页签,提交时这张退料单会一起作废,不产生其他入库单')
          : tt('扫物料码:物料存在才能填数量;数量可随意填,只要仓库数量足够') }}
      </div>
    </section>

    <!-- 明细 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ side === 'back' ? tt('退料明细') : tt('领料明细') }}</span>
        <span class="mp-sec-num">{{ rows.length }}</span>
      </div>
      <div v-if="!rows.length" class="mp-empty">{{ tt('没有明细') }}</div>
      <div
        v-for="r in rows"
        :key="r.行号"
        class="mp-line"
        :class="{ 'is-cur': cur && cur.编码 === r.编码 }"
        @click="pickRow(r)"
      >
        <span class="mp-line-dot" :class="{ on: r.数量 > 0 }"></span>
        <div class="mp-line-main">
          <div class="mp-line-name">{{ r.名称 || r.编码 }}</div>
          <div class="mp-line-meta">
            {{ r.编码 }} · {{ r.规格 || '—' }}
            <template v-if="r.批号"> · {{ r.批号 }}</template>
            <template v-if="r.BOM用量 > 0"> · {{ tt('BOM') }} {{ fmtQty(r.BOM用量) }}</template>
          </div>
          <div v-if="r.明细备注" class="mp-line-note">{{ r.明细备注 }}</div>
        </div>
        <span class="mp-line-qty num">{{ fmtQty(r.数量) }} <i>{{ r.单位 }}</i></span>
      </div>
    </section>

    <!-- 底栏 -->
    <div class="mp-foot">
      <el-button size="large" :loading="printing" @click="reprint">{{ tt('打印二维码') }}</el-button>
      <el-button
        v-if="side === 'pick'"
        type="primary"
        size="large"
        :loading="submitting"
        :disabled="!progress.ok || isDone"
        @click="submit"
      >
        {{ isDone ? tt('已完成') : tt('提交转材料出库单') }}
      </el-button>
      <el-button v-else disabled size="large">{{ tt('退料提交在领料页签') }}</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { parseMaterialCode } from '@/business/scanCode'
import { makeBatchRows, allocateScannedFirst, allocateForQty, pickProgress, backIsEmpty, fmtQty, round4, isNonFifo } from '@/business/mobilePick'
import { printWoQr } from '@/business/print-formats'
import { queueToPrintStation } from '@/business/printStation'

const route = useRoute()
const router = useRouter()

const docId = Number(route.query.id) || 0
const doc = ref({})
const wo = ref({})
const pickRows = ref([])
const backRows = ref([])
const side = ref('pick')

const matInput = ref(null)
const matText = ref('')
const matLoading = ref(false)
const cur = ref(null)
const curQty = ref(0)
const batchRows = ref([])
const saving = ref(false)
const submitting = ref(false)
const printing = ref(false)
const errText = ref('')
const okText = ref('')

const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)

const rows = computed(() => (side.value === 'back' ? backRows.value : pickRows.value))
const progress = computed(() => pickProgress(pickRows.value))
const backEmpty = computed(() => backIsEmpty(backRows.value))
const isDone = computed(() => String(doc.value.状态 || '') === '已完成')
const shortage = computed(() => round4((Number(curQty.value) || 0) - batchRows.value.reduce((s, b) => s + round4(b.qty), 0)))
/**
 * 是否跳批(没按先进先出) —— 直接用 scanCode 的同一判定,别在这里自己数。
 * 跳批不是错误:拆批备注里已经写明,过账照常(与 2026-10-21 版口径一致)。
 */
const nonFifo = computed(() => isNonFifo(batchRows.value))

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return e?.response?.data?.message || e?.message || '' }

function goBack() {
  router.push('/panelx/list/MOBILE_PICK')
}

onMounted(() => {
  window.__yjScanResult = (code, ok) => {
    if (!ok || !code) return
    applyScan(code)
  }
  loadDoc()
  nextTick(() => matInput.value?.focus?.())
})

onBeforeUnmount(() => {
  try { delete window.__yjScanResult } catch { /* ignore */ }
})

function scanInto() {
  if (!(window.YjNative && typeof window.YjNative.scan === 'function')) {
    errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    return
  }
  try { window.YjNative.scan() } catch { errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入') }
}

function applyScan(code) {
  const p = parseMaterialCode(code)
  if (!p.ok) { errText.value = tt('这个码里没有物料编码'); return }
  matText.value = p.code
  scanMaterial(p.batch)
}

async function loadDoc() {
  if (!docId) { errText.value = tt('没有指定单据:请从生产领料列表点进来'); return }
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/doc', { params: { id: docId } })
    const d = res.data?.data || res.data || {}
    doc.value = d
    wo.value = d.工单 || {}
    // BOM 用量:后端明细里没有直接带,按"领料行 → 组装BOM 明细"的用量补上(取后端给的 BOM用量 字段)
    pickRows.value = (d.领料明细 || []).map(normalize)
    backRows.value = (d.退料明细 || []).map(normalize)
  } catch (e) {
    errText.value = errMsgOf(e) || tt('加载单据失败')
  }
}

function normalize(l) {
  const q = Number(l?.数量) || 0
  return {
    行号: String(l?.行号 ?? ''),
    编码: String(l?.编码 ?? '').trim(),
    名称: String(l?.名称 ?? '').trim(),
    规格: String(l?.规格 ?? '').trim(),
    单位: String(l?.单位 ?? '').trim(),
    仓库: String(l?.仓库 ?? '').trim(),
    仓库编码: String(l?.仓库编码 ?? '').trim(),
    数量: round4(q),
    批号: String(l?.批号 ?? '').trim(),
    明细备注: String(l?.明细备注 ?? '').trim(),
    BOM用量: Number(l?.BOM用量) || 0,
  }
}

/** 点明细行 = 直接把那一行加载到扫码区(不用再扫一次码) */
function pickRow(r) {
  if (isDone.value) return
  matText.value = r.编码
  scanMaterial(r.批号)
}

/** 扫物料码 → 后端校验"本单是否有这个料"并回库存/批次 */
async function scanMaterial(scanBatch) {
  const code = String(matText.value || '').trim()
  clearMsg()
  cur.value = null
  batchRows.value = []
  if (!code) { errText.value = tt('请先扫描或输入物料编码'); return }
  matLoading.value = true
  try {
    const res = await request.post('/px/mobilePick/scanMaterial', {
      id: docId, code, batch: String(scanBatch || '').trim(), side: side.value,
    })
    const d = res.data?.data || res.data || {}
    cur.value = {
      编码: d.编码, 名称: d.名称, 规格: d.规格, 单位: d.单位,
      允许上限: Number(d.允许上限) || 0,
      BOM用量: Number(d.BOM用量) || 0,
      当前数量: Number(d.当前数量) || 0,
      可用总量: Number(d.可用总量) || 0,
    }
    // 批次行沿用 scanCode.makeBatchRows(先进先出排好;扫到的批次标亮)
    batchRows.value = makeBatchRows(Array.isArray(d.批次) ? d.批次 : [], String(scanBatch || '').trim())
    // 默认数量:已有的填多少就带多少;没有则按扫到的批次可用量(退料默认 0)
    const preset = side.value === 'back' ? cur.value.当前数量 : (cur.value.当前数量 > 0 ? cur.value.当前数量 : cur.value.允许上限)
    curQty.value = round4(Math.min(Math.max(0, preset), cur.value.允许上限))
    onQtyChange(curQty.value, String(scanBatch || '').trim())
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询物料失败')
  } finally {
    matLoading.value = false
  }
}

/**
 * 数量变化 → 重算拆批。
 *
 * 口径(用户二次确认「超出自动拆到下一批」):
 *   · 扫到批次的:sanctify 先填那一批,不够再按 FIFO 往后补;
 *   · 没扫批次的:纯先进先出。
 */
function onQtyChange(v) {
  const need = round4(Number(v) || 0)
  const scanned = batchRows.value.some((b) => b.scanned)
  const r = scanned ? allocateScannedFirst(batchRows.value, need) : allocateForQty(batchRows.value, need)
  batchRows.value = r.rows
}

/** 写入数量(后端改明细行 + 写批次备注),成功后就地刷新进度 */
async function saveQty() {
  if (!cur.value || !(curQty.value > 0)) return
  saving.value = true
  clearMsg()
  try {
    const batches = batchRows.value
      .filter((b) => round4(b.qty) > 0)
      .map((b) => ({ 批号: b.lot, 仓库: b.warehouse, 仓库编码: b.warehouseCode, 数量: round4(b.qty) }))
    const res = await request.post('/px/mobilePick/setQty', {
      id: docId, side: side.value, code: cur.value.编码, qty: round4(curQty.value), batches,
    })
    const d = res.data?.data || res.data || {}
    pickRows.value = (d.领料明细 || []).map(normalize)
    backRows.value = (d.退料明细 || []).map(normalize)
    doc.value = { ...doc.value, 物料项数: d.物料项数, 已领项数: d.已领项数 }
    okText.value = progress.value.ok
      ? tt('全部明细已领完,可以提交')
      : `${tt('已写入')} ${cur.value.编码} · ${tt('还剩')} ${progress.value.missing.length} ${tt('项未领')}`
    matText.value = ''
    cur.value = null
    batchRows.value = []
    curQty.value = 0
    nextTick(() => matInput.value?.focus?.())
  } catch (e) {
    errText.value = errMsgOf(e) || tt('写入数量失败')
  } finally {
    saving.value = false
  }
}

/** 打印工单二维码:优先发打印站点,没在线站点就用本机打印层 */
async function reprint() {
  printing.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/reprint', { id: docId })
    const payload = (res.data?.data || res.data || {}).打印 || {}
    const queued = await queueToPrintStation({ ...payload, 来源: 'mobilePick.doc' })
    if (queued && queued.online) {
      okText.value = tt('已发送到打印电脑')
      return
    }
    await printWoQr(payload)
  } catch (e) {
    errText.value = errMsgOf(e) || tt('打印失败')
  } finally {
    printing.value = false
  }
}

/** 提交:全部领完 → 审核领料单 → 材料出库单过账;退料全 0 时那张退料单一起作废 */
async function submit() {
  if (!progress.value.ok || isDone.value) return
  const tip = backEmpty.value
    ? tt('提交后领料单会审核过账成材料出库单;本次没有退料,那张退料单会一起作废(不产生其他入库单)。确定提交?')
    : tt('提交后领料单会审核过账成材料出库单。确定提交?')
  try {
    await ElMessageBox.confirm(tip, tt('提交确认'), {
      confirmButtonText: tt('确定提交'), cancelButtonText: tt('取消'), type: 'warning',
    })
  } catch { return }
  submitting.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/submit', { id: docId })
    const d = res.data?.data || res.data || {}
    doc.value = { ...doc.value, 状态: d.状态 || '已完成', 退料单号: d.退料单号 || null }
    ElMessage.success(tt('已提交:材料出库单已生成'))
    okText.value = d.说明 || tt('已提交')
  } catch (e) {
    errText.value = errMsgOf(e) || tt('提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* 与 MobilePickList.vue 同一套视觉语言:卡片 / 44px 命中区 / 等宽数字 / 无装饰动画 */
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
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  height: 48px; padding: 0 12px;
  background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-lighter);
}
.mp-back {
  flex: none; width: 28px; font-size: 24px; line-height: 1;
  color: var(--el-text-color-regular); cursor: pointer; user-select: none;
}
.mp-head { display: flex; flex-direction: column; min-width: 0; }
.mp-title { font-size: 16px; font-weight: 600; }
.mp-sub2 { font-size: 11px; color: var(--el-text-color-secondary); }
.mp-sub2 i { font-style: normal; color: var(--el-text-color-placeholder); }
.mp-state {
  margin-left: auto; padding: 0 8px; border-radius: 4px; font-size: 12px;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mp-state.done { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }

.mp-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mp-card.dim { opacity: .6; }
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mp-sec-ok { font-size: 11px; font-weight: 400; color: var(--el-color-success); }
.mp-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}

/* 页签 */
.mp-tabs { display: flex; gap: 8px; margin: 10px 12px 0; }
.mp-tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; font-size: 14px; cursor: pointer; user-select: none;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-tab.on { border-color: var(--el-color-primary); color: var(--el-color-primary); font-weight: 600; }
.mp-tab i { font-style: normal; font-size: 12px; color: var(--el-text-color-secondary); }
.mp-tab-tip { font-size: 10px; padding: 0 4px; border-radius: 3px; background: var(--el-fill-color); color: var(--el-text-color-secondary); }

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row :deep(.el-input), .mp-row :deep(.el-input-number) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }

.mp-qty { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mp-qty-label { flex: none; font-size: 13px; color: var(--el-text-color-regular); }
.mp-qty :deep(.el-input-number) { flex: none; width: 130px; }
.mp-qty-unit { flex: none; min-width: 24px; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-qty :deep(.el-button) { flex: 1 1 96px; }

.mp-kv { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 13px; }
.mp-kv > span { width: 76px; flex: none; color: var(--el-text-color-secondary); }
.mp-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }
.mp-kv > b.ok { color: var(--el-color-success); }
.mp-kv > b i { font-style: normal; color: var(--el-text-color-secondary); }

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

/* 批次表(与 MobilePick.vue 同款四列) */
.mp-batches { margin-top: 10px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; overflow: hidden; }
.mp-batches-head, .mp-batch-row {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-size: 12px;
}
.mp-batches-head { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
.mp-batch-row { border-top: 1px solid var(--el-border-color-lighter); font-size: 13px; }
.mp-batch-row.is-checked { background: var(--el-color-primary-light-9); }
.mp-batch-row.is-scanned { box-shadow: inset 3px 0 0 var(--el-color-warning); }
.mp-bh-lot { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
.mp-batch-lot { min-width: 0; word-break: break-all; }
.mp-batch-scan {
  flex: none; padding: 0 4px; border-radius: 3px; font-size: 10px;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mp-bh-wh { flex: none; width: 62px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-bh-avail { flex: none; width: 52px; text-align: right; }
.mp-bh-qty { flex: none; width: 62px; text-align: right; font-weight: 600; }

.mp-line {
  display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter); cursor: pointer;
}
.mp-line:last-child { border-bottom: 0; }
.mp-line.is-cur { background: var(--el-color-primary-light-9); border-radius: 6px; }
.mp-line-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--el-border-color); }
.mp-line-dot.on { background: var(--el-color-success); }
.mp-line-main { flex: 1; min-width: 0; }
.mp-line-name { font-size: 14px; }
.mp-line-meta { margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }
.mp-line-note { margin-top: 2px; font-size: 11px; color: var(--el-text-color-placeholder); word-break: break-all; }
.mp-line-qty { flex: none; min-width: 84px; text-align: right; font-size: 14px; font-weight: 600; }
.mp-line-qty i { font-style: normal; font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mp-warn { margin-top: 6px; padding: 6px 8px; font-size: 12px; color: var(--el-color-warning-dark-2); background: var(--el-color-warning-light-9); border-radius: 4px; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }
.num { font-variant-numeric: tabular-nums; }

.mp-err, .mp-ok { margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; }
.mp-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mp-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

.mp-foot {
  display: flex; gap: 10px; margin: 12px 12px 0; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  margin-top: auto;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { flex: 1; height: 46px; margin: 0; }

/* 电脑端两栏:左=扫码区,右=明细 */
@media (min-width: 900px) {
  .mp { display: grid; grid-template-columns: minmax(0, 460px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mp-top, .mp-tabs, .mp-err, .mp-ok, .mp-foot { grid-column: 1 / -1; }
  .mp-card { margin: 0 0 12px; }
  .mp-tabs { margin: 0 0 12px; }
}
</style>
