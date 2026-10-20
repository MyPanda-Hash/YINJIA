<!-- WorkOrderPick.vue — 工单扫码领料(手机端):扫工单码 → BOM 清单 → 扫物料码 → 秤取数 → 提交(2026-10-21) -->
<template>
  <div class="wop-page">
    <!-- ① 扫工单 -->
    <div class="wop-head">
      <div class="wop-title">{{ tt('工单扫码领料') }}</div>
      <div class="wop-sub">{{ tt('扫工单码 → 按 BOM 列出该领的料 → 逐项扫码取秤 → 整单提交') }}</div>
    </div>

    <div class="wop-scanbar">
      <input
        ref="woInputRef"
        v-model="woInput"
        class="wop-input"
        :placeholder="tt('扫描/输入工单二维码')"
        @keyup.enter="onScanWorkOrder"
      />
      <button class="wop-btn primary" :disabled="loadingWo" @click="onScanWorkOrder">
        {{ loadingWo ? tt('查询中…') : tt('确定') }}
      </button>
    </div>

    <div v-if="woError" class="wop-err">{{ woError }}</div>

    <!-- ② 工单内容 -->
    <div v-if="order" class="wop-card">
      <div class="wop-card-head">
        <span class="wop-order-no">{{ order.orderNo }}</span>
        <span v-if="order.lineNo" class="wop-line-tag">{{ tt('行号') }} {{ order.lineNo }}</span>
      </div>
      <div class="wop-kv">
        <span class="k">{{ tt('产品编码') }}</span><span class="v">{{ order.productCode || '-' }}</span>
        <span class="k">{{ tt('产品名称') }}</span><span class="v">{{ order.productName || '-' }}</span>
        <span class="k">{{ tt('生产线') }}</span><span class="v">{{ order.line || '-' }}</span>
        <span class="k">{{ tt('排产数量') }}</span><span class="v strong">{{ fmt(order.planQty) }}</span>
      </div>
    </div>

    <!-- ③ 秤状态 -->
    <div v-if="order" class="wop-scale" :class="{ live: scaleOk, dead: !scaleOk }">
      <span class="wop-scale-label">{{ tt('台车电子秤') }}</span>
      <span class="wop-scale-val">{{ scaleText }}</span>
      <span class="wop-scale-hint">{{ scaleHint }}</span>
    </div>

    <!-- ④ BOM 领料清单 -->
    <div v-if="order" class="wop-list">
      <div class="wop-list-head">
        <span>{{ tt('领料清单') }}</span>
        <span class="wop-prog">{{ progress.done }} / {{ progress.total }}</span>
      </div>
      <div v-if="!lines.length" class="wop-empty">
        {{ tt('该产品还没有物料清单(BOM),请先在「物料清单」面板录入。') }}
      </div>
      <div
        v-for="(l, i) in lines"
        :key="l.code + i"
        class="wop-row"
        :class="{ active: activeIdx === i, done: l.picked > 0, over: l.remain < 0 }"
        @click="activeIdx = i"
      >
        <div class="wop-row-main">
          <span class="wop-code">{{ l.code }}</span>
          <span class="wop-name">{{ l.name || '-' }}</span>
        </div>
        <div class="wop-row-qty">
          <span class="wop-q">{{ tt('应领') }} {{ fmt(l.required) }} {{ l.uom }}</span>
          <span class="wop-q picked">{{ tt('已领') }} {{ fmt(l.picked) }}</span>
          <span class="wop-q remain" :class="{ neg: l.remain < 0 }">
            {{ tt('待领') }} {{ fmt(l.remain) }}
          </span>
        </div>
      </div>
    </div>

    <!-- ⑤ 扫物料 -->
    <div v-if="order && lines.length" class="wop-scanbar">
      <input
        ref="matInputRef"
        v-model="matInput"
        class="wop-input"
        :placeholder="tt('扫描/输入物料条码')"
        @keyup.enter="onScanMaterial"
      />
      <button class="wop-btn" :disabled="!activeLine" @click="useScaleForActive">
        {{ tt('取秤') }}
      </button>
      <button class="wop-btn primary" :disabled="!activeLine" @click="submitOne">
        {{ tt('提交本笔') }}
      </button>
    </div>

    <div v-if="matError" class="wop-err">{{ matError }}</div>
    <div v-if="matOk" class="wop-ok">{{ matOk }}</div>

    <!-- ⑥ 整单提交 -->
    <div v-if="order && lines.length" class="wop-foot">
      <div class="wop-foot-info">
        <span>{{ tt('已领') }} {{ progress.done }} / {{ progress.total }} {{ tt('行') }}</span>
        <span v-if="!progress.allPicked" class="wop-foot-warn">{{ tt('还有未领的行') }}</span>
      </div>
      <button
        class="wop-btn submit"
        :disabled="!progress.anyPicked || submitting"
        @click="submitAll"
      >
        {{ submitting ? tt('提交中…') : tt('整单提交') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { callButton, errMsg } from '@/business/engine'
import { parseBarcode } from '@/business/scanPick'
import {
  parseWorkOrderQr,
  expandBom,
  applyScan,
  checkScaleReading,
  buildPickForm,
  pickProgress,
} from '@/business/workOrderPick'
import request from '@/core/request'

const woInputRef = ref(null)
const matInputRef = ref(null)
const woInput = ref('')
const matInput = ref('')
const loadingWo = ref(false)
const submitting = ref(false)
const woError = ref('')
const matError = ref('')
const matOk = ref('')
const order = ref(null)
const lines = ref([])
const activeIdx = ref(-1)
const scaleVal = ref(0)
const scaleAt = ref(null)
const scaleOk = ref(false)
const prevScale = ref(null)
let scaleTimer = null

const activeLine = computed(() => (activeIdx.value >= 0 ? lines.value[activeIdx.value] : null))
const progress = computed(() => pickProgress(lines.value))
const scaleText = computed(() => (scaleVal.value > 0 ? fmt(scaleVal.value) + ' kg' : '—'))
const scaleHint = computed(() => {
  if (scaleOk.value) return tt('读数稳定,可取值')
  if (scaleVal.value <= 0) return tt('等待称重')
  return tt('读数跳动中')
})

function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return String(Math.round(v * 10000) / 10000)
}

/** 扫工单码 → 查工单行(plang)+ 该产品的 BOM(mate) */
async function onScanWorkOrder() {
  woError.value = ''
  matError.value = ''
  matOk.value = ''
  const q = parseWorkOrderQr(woInput.value)
  if (!q.ok) {
    const map = {
      empty: tt('请先扫描或输入工单二维码'),
      'no-order': tt('不是工单码(工单码格式:公司代码@工单号@行号)'),
      'bad-line': tt('工单码里的行号不是数字'),
    }
    woError.value = map[q.reason] || tt('工单码无法识别')
    return
  }
  loadingWo.value = true
  try {
    // 工单行:plang 表(工单号 pl_no + 行号 pl_xc)。plang 不是注册面板,走不了通用
    // queryFormDataList,故由后端 /px/woPick/lines 提供只读端点。
    const params = { orderNo: q.orderNo }
    if (q.lineNo) params.lineNo = q.lineNo
    const res = await request.get('/px/woPick/lines', { params })
    const rows = (res && (res.list || res.data?.list)) || []
    if (!rows.length) {
      woError.value = tt('没找到这张工单') + (q.lineNo ? `(${tt('行号')} ${q.lineNo})` : '')
      order.value = null
      lines.value = []
      return
    }
    const r = rows[0]
    order.value = {
      orderNo: String(r['工单号'] || q.orderNo),
      lineNo: Number(r['工单行号'] || q.lineNo) || 0,
      productCode: String(r['产品编码'] || '').trim(),
      productName: String(r['产品名称'] || '').trim(),
      line: String(r['生产线'] || '').trim(),
      planQty: Number(r['排产数量'] || 0) || 0,
    }
    await loadBom(order.value.productCode, order.value.planQty)
    matInput.value = ''
    activeIdx.value = lines.value.length ? 0 : -1
    await nextTick()
    matInputRef.value && matInputRef.value.focus()
  } catch (e) {
    woError.value = errMsg(e) || tt('查询工单失败')
    order.value = null
    lines.value = []
  } finally {
    loadingWo.value = false
  }
}

/** 按产品编码取 BOM(mate 表)并按排产数量展开应领量 */
async function loadBom(productCode, planQty) {
  if (!productCode) {
    lines.value = []
    return
  }
  // mate 表不是注册面板(WLBOM 是单据面板,查它拿到的是整单头而非子件行),
  // 故由后端 /px/woPick/bom 直接给出该产品的全部子件行。
  const res = await request.get('/px/woPick/bom', { params: { productCode } })
  const bom = (res && (res.list || res.data?.list)) || []
  lines.value = expandBom(bom, planQty)
}

/** 扫物料码 → 找到对应行 → 用当前秤值提交本笔 */
async function onScanMaterial() {
  matError.value = ''
  matOk.value = ''
  const p = parseBarcode(matInput.value)
  if (!p.ok) {
    const map = {
      empty: tt('请先扫描或输入物料条码'),
      'no-code': tt('条码里没有存货编码'),
      'too-many': tt('条码格式不对(应为 存货编码|批号)'),
    }
    matError.value = map[p.reason] || tt('条码无法识别')
    return
  }
  // 命中哪一行就切到哪一行,不依赖用户先点
  const hit = lines.value.findIndex((l) => String(l.code).trim() === p.code)
  if (hit < 0) {
    matError.value = tt('该物料不在本工单的 BOM 里:') + p.code
    return
  }
  activeIdx.value = hit
  const qty = await readScaleQty()
  if (qty == null) {
    matError.value = tt('电子秤读数不可用,请确认秤已连接并稳定')
    return
  }
  const r = applyScan(lines.value, p, qty)
  if (!r.ok) {
    matError.value = tt('本笔提交失败')
    return
  }
  matOk.value = `${p.code} +${fmt(qty)} ${r.line.uom || ''}`
  matInput.value = ''
  await nextTick()
  matInputRef.value && matInputRef.value.focus()
  // 自动跳到下一个未领的行,减少点屏
  const next = lines.value.findIndex((l) => Number(l.picked) <= 0)
  if (next >= 0) activeIdx.value = next
}

/** 「取秤」按钮:给当前行按秤值记一笔 */
async function useScaleForActive() {
  matError.value = ''
  matOk.value = ''
  if (!activeLine.value) return
  const qty = await readScaleQty()
  if (qty == null) {
    matError.value = tt('电子秤读数不可用,请确认秤已连接并稳定')
    return
  }
  const r = applyScan(lines.value, { code: activeLine.value.code }, qty)
  if (r.ok) matOk.value = `${activeLine.value.code} +${fmt(qty)}`
}

/**
 * 从 /api/dc/monitor 的响应里取出「电子秤 · 重量」这一个点位的最新读数。
 *
 * ⚠ 返回结构是**扁平的**:`data.points` 是当前选中设备的点位数组(不是嵌在 devices 里),
 * 每个点位 { code, name, valueNum, valueText, unit, at, status }。
 * 2026-10-21 实测踩过:按 `devices[].points` 取会永远拿不到值 ⇒ 秤一直显示「等待称重」。
 *
 * @returns {{ value:number, at:string, stable:boolean }|null}
 */
function scaleReadingOf(res) {
  const d = (res && (res.data || res)) || {}
  const points = d.points || []
  if (!points.length) return null
  // 优先「重量」点位,其次 kg 单位,最后退回第一个
  const w = points.find((p) => String(p.name || '').includes('重量'))
    || points.find((p) => String(p.unit || '') === 'kg')
    || points[0]
  if (!w) return null
  const v = w.valueNum != null ? Number(w.valueNum) : Number(w.valueText)
  return {
    value: v,
    at: w.at || w.collectAt || '',
    // 数采侧给 status='normal' 才算稳定;报警/超限一律不算
    stable: String(w.status || '') === 'normal',
  }
}

/**
 * 读一次秤值并做有效性判断。
 *
 * 有效性:重量 > 0、采样在 10 秒内、连续两次一致(见 workOrderPick.checkScaleReading)。
 * 实测教训:库里出现过 -1 脏值(当前最新一条就是 -1),必须拦下。
 *
 * @returns {Promise<number|null>} 可用重量;不可用时 null
 */
async function readScaleQty() {
  try {
    const res = await request.get('/dc/monitor')
    const reading = scaleReadingOf(res)
    if (!reading) return null
    const chk = checkScaleReading(reading, prevScale.value)
    prevScale.value = reading
    if (!chk.ok) return null
    return chk.value
  } catch {
    return null
  }
}

/** 轮询秤值,让用户扫之前就能看到读数是否稳定 */
async function pollScale() {
  try {
    const res = await request.get('/dc/monitor')
    const reading = scaleReadingOf(res)
    if (!reading) {
      scaleOk.value = false
      return
    }
    const chk = checkScaleReading(reading, prevScale.value)
    prevScale.value = reading
    scaleVal.value = reading.value > 0 ? reading.value : 0
    scaleAt.value = reading.at
    scaleOk.value = chk.ok
  } catch {
    scaleOk.value = false
  }
}

/** 提交本笔 = 把当前行已累计的数量记下来(实际落库在整单提交时) */
function submitOne() {
  if (!activeLine.value) return
  if (Number(activeLine.value.picked) <= 0) {
    matError.value = tt('本行还没有数量,请先扫码或取秤')
    return
  }
  matOk.value = tt('已记录') + ' ' + activeLine.value.code + ' ' + fmt(activeLine.value.picked)
  const next = lines.value.findIndex((l) => Number(l.picked) <= 0)
  if (next >= 0) activeIdx.value = next
}

/** 整单提交 → 生成一张材料出库单(写进资料表) */
async function submitAll() {
  if (!order.value || !progress.value.anyPicked) return
  submitting.value = true
  matError.value = ''
  try {
    const form = buildPickForm({
      orderNo: order.value.orderNo,
      lineNo: order.value.lineNo,
      warehouse: order.value.warehouse || '',
      lines: lines.value,
    })
    await callButton({ panelCode: 'MATERIAL_OUT', buttonName: '保存', formData: form, buttonParam: {} })
    ElMessage.success(tt('整单提交成功,已生成材料出库单'))
    // 提交后清空,便于扫下一张工单
    order.value = null
    lines.value = []
    woInput.value = ''
    matOk.value = ''
    await nextTick()
    woInputRef.value && woInputRef.value.focus()
  } catch (e) {
    matError.value = errMsg(e) || tt('整单提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  woInputRef.value && woInputRef.value.focus()
  pollScale()
  scaleTimer = setInterval(pollScale, 2000)
})

onBeforeUnmount(() => {
  if (scaleTimer) clearInterval(scaleTimer)
  scaleTimer = null
})
</script>

<style scoped>
.wop-page {
  padding: 10px 12px 90px;
  background: #f5f6f8;
  min-height: 100%;
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
}
.wop-head {
  margin-bottom: 10px;
}
.wop-title {
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
}
.wop-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 3px;
  line-height: 1.5;
}
.wop-scanbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.wop-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  font-size: 15px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
  outline: none;
}
.wop-input:focus {
  border-color: #1c4f8a;
  box-shadow: 0 0 0 2px rgba(28, 79, 138, 0.12);
}
.wop-btn {
  height: 42px;
  padding: 0 14px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}
.wop-btn.primary {
  background: #1c4f8a;
  border-color: #1c4f8a;
  color: #fff;
}
.wop-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.wop-btn.submit {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  width: 100%;
}
.wop-card {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.wop-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.wop-order-no {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.wop-line-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #eff6ff;
  color: #1c4f8a;
  border: 1px solid #dbeafe;
}
.wop-kv {
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 4px 8px;
  font-size: 13px;
}
.wop-kv .k {
  color: #6b7280;
}
.wop-kv .v {
  color: #111827;
  word-break: break-all;
}
.wop-kv .v.strong {
  font-weight: 600;
  color: #1c4f8a;
}
.wop-scale {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
  border-left: 3px solid #d1d5db;
}
.wop-scale.live {
  border-left-color: #16a34a;
}
.wop-scale.dead {
  border-left-color: #f59e0b;
}
.wop-scale-label {
  font-size: 12px;
  color: #6b7280;
}
.wop-scale-val {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
}
.wop-scale-hint {
  font-size: 11px;
  color: #9ca3af;
  margin-left: auto;
}
.wop-list {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}
.wop-list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}
.wop-prog {
  font-size: 12px;
  color: #1c4f8a;
  font-weight: 500;
}
.wop-empty {
  padding: 16px 12px;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.6;
}
.wop-row {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}
.wop-row:last-child {
  border-bottom: none;
}
.wop-row.active {
  background: #eff6ff;
  box-shadow: inset 3px 0 0 #1c4f8a;
}
.wop-row.done {
  background: #f0fdf4;
}
.wop-row.over {
  background: #fef2f2;
}
.wop-row-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.wop-code {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  font-variant-numeric: tabular-nums;
}
.wop-name {
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wop-row-qty {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
}
.wop-q.picked {
  color: #16a34a;
}
.wop-q.remain {
  color: #b45309;
}
.wop-q.remain.neg {
  color: #dc2626;
  font-weight: 600;
}
.wop-err {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 10px;
  line-height: 1.5;
}
.wop-ok {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 10px;
}
.wop-foot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #e5e7eb;
  max-width: 640px;
  margin: 0 auto;
}
.wop-foot-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}
.wop-foot-warn {
  color: #b45309;
}
</style>
