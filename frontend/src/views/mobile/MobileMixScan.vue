<!--
  MobileMixScan.vue — 手机扫码 · 扫码混料(2026-11-18,新增;接替已下架的「工单扫码领料」)

  【用户口径(原话)】
  「把 wms 管理-条码管理里面的扫码领料和扫码领料记录和工单扫码领料删除。然后在手机扫码里面
   加一个扫码混料的面版。逻辑:扫工单码,带出一级BOM(就是物料清单,之前生产领料的是组装物料清单),
   逐项扫物料码,自动获取电子秤的数量(我们系统已经有了(之前的工单扫码领料读的就是这个的数据)),
   提交保存一笔,全部扫完,整单保存。保存后自动打印,并且保留单据,重新扫码后进入可以补打印。」

  【作业链路(页面即流程)】
   ① 扫工单码        → GET /px/mix/lines(工单行 plang)
   ② 带出一级BOM     → GET /px/mix/bom  (《物料清单》WLBOM / 底表 mate;**不是**生产领料用的组装物料清单)
   ③ 逐项扫物料码    → 命中清单行 → 取电子秤(/api/dc/monitor)或手输 → POST /px/mix/scan
                        每次「提交本笔」= 往 wo_mixing_list 落一行(标记 N = 保存前)
   ④ 全部扫完        → POST /px/mix/save 取混料单号(PL+yyMMdd+4位)+ 标记置 Y
   ⑤ 保存后自动打印  → GET /px/mix/doc 取纸面数据 → 打印站点(MIX_SLIP)/ 本机打印兜底 → 记一次打印
   ⑥ 重扫工单可补打印 → GET /px/mix/docs 列出该工单已保存的混料单 → 点「补打印」再来一次

  【为什么落混料记录而不是开一张材料出库单】
  「混料」投的是原料(炭粉/活性炭…),不扣成品库存、也没有出库单据链;现场真正要留的是
  「这一锅投了多少料、秤上实际多少」。这正是 dbo.wo_mixing_list(混料记录,
  表注释「混料时通过电子称自动获取的实际用量」)的语义 —— 保存后电脑端
  「生产过程 → 混料记录」立刻能查到,不用再造一份数据。

  【为什么秤值要「提交本笔」才落库,而不是扫完就写】
  用户口径是「提交保存一笔」:现场放过料、看一眼秤稳定了才点提交;写早了会把称重跳动值存进去。
  取不到稳定值时页面要求手输(秤离线/故障不能让现场卡死)。
-->
<template>
  <div class="mm-scan">
    <div class="mm-head">
      <div class="mm-title">{{ tt('扫码混料') }}</div>
      <div class="mm-sub">
        {{ tt('扫工单码 → 带出物料清单 → 逐项扫物料码取电子秤 → 逐笔保存 → 全部扫完整单保存并自动打印') }}
      </div>
    </div>

    <!-- ① 扫工单码 -->
    <div class="mm-scanbar">
      <el-input
        ref="woInput"
        v-model="woText"
        size="large"
        clearable
        :placeholder="tt('扫描或输入工单二维码')"
        @keyup.enter="onScanWorkOrder"
      >
        <template #append>
          <el-button :loading="woLoading" @click="onScanWorkOrder">{{ tt('查询') }}</el-button>
        </template>
      </el-input>
      <el-button v-if="nativeScan" size="large" :loading="scanning === 'wo'" class="mm-cam" @click="scanWoCamera">
        {{ tt('相机扫码') }}
      </el-button>
    </div>

    <el-alert v-if="errText" :title="errText" type="warning" :closable="false" show-icon class="mm-alert" />
    <el-alert v-if="okText" :title="okText" type="success" :closable="false" show-icon class="mm-alert" />

    <!-- ② 工单内容 -->
    <div v-if="order" class="mm-card">
      <div class="mm-order-l1">
        <span class="mm-no mono">{{ order.orderNo }}</span>
        <span class="mm-tag">{{ tt('行号') }} {{ order.lineNo }}</span>
        <el-button text size="small" class="mm-clear" @click="resetOrder">{{ tt('换工单') }}</el-button>
      </div>
      <div class="mm-kv">
        <span class="mm-k">{{ tt('产品编码') }}</span><span class="mm-v mono">{{ order.productCode || '-' }}</span>
        <span class="mm-k">{{ tt('产品名称') }}</span><span class="mm-v">{{ order.productName || '-' }}</span>
        <span class="mm-k">{{ tt('生产线') }}</span><span class="mm-v">{{ order.line || '-' }}</span>
        <span class="mm-k">{{ tt('排产数量') }}</span><span class="mm-v strong">{{ fmt(order.planQty) }}</span>
      </div>
      <!-- 整单码(不带行号)扫进来时可能命中多行:让人自己选,别默认第一行当成对的 -->
      <div v-if="lineOptions.length > 1" class="mm-linepick">
        <span class="mm-k">{{ tt('工单行') }}</span>
        <el-select v-model="order.lineNo" size="large" class="mm-linepick-sel" @change="onLineChange">
          <el-option
            v-for="o in lineOptions"
            :key="o.lineNo"
            :label="`${tt('行号')} ${o.lineNo} · ${o.productCode} ${o.productName}`"
            :value="o.lineNo"
          />
        </el-select>
      </div>
    </div>

    <!-- ③ 电子秤 -->
    <div v-if="order" class="mm-scale" :class="{ live: scaleOk }">
      <div class="mm-scale-main">
        <span class="mm-scale-label">{{ tt('台车电子秤') }}</span>
        <span class="mm-scale-num">{{ scaleText }}</span>
        <span class="mm-scale-hint">{{ scaleHint }}</span>
      </div>
      <div class="mm-scale-manual">
        <span class="mm-k">{{ tt('手输数量') }}</span>
        <el-input-number v-model="manualQty" :min="0" :precision="4" :step="0.1" size="large" controls-position="right" />
      </div>
    </div>

    <!-- ④ 物料清单(一级BOM) -->
    <div v-if="order" class="mm-list">
      <div class="mm-list-head">
        <span>{{ tt('物料清单') }}</span>
        <span class="mm-prog">{{ progress.done }} / {{ progress.total }}</span>
      </div>
      <el-empty
        v-if="!lines.length"
        :description="tt('该产品在「物料清单」里还没有维护用料，请先在 数据建模 → 生产 → 物料清单 录入')"
        :image-size="70"
      />
      <div
        v-for="(l, i) in lines"
        :key="l.code"
        class="mm-row"
        :class="{ active: activeIdx === i, done: l.picked > 0, over: l.remain < 0 }"
        @click="activeIdx = i"
      >
        <div class="mm-row-main">
          <span class="mm-code mono">{{ l.code }}</span>
          <span class="mm-name">{{ l.name || '-' }}</span>
        </div>
        <div class="mm-row-qty">
          <span>{{ tt('应投') }} {{ fmt(l.required) }} {{ l.uom }}</span>
          <span class="mm-q-done">{{ tt('已记') }} {{ fmt(l.picked) }}</span>
          <span class="mm-q-remain" :class="{ neg: l.remain < 0 }">{{ tt('待投') }} {{ fmt(l.remain) }}</span>
        </div>
        <el-button
          v-if="l.picked > 0"
          text
          size="small"
          type="danger"
          class="mm-row-undo"
          :loading="undoing === l.code"
          @click.stop="undoLine(i)"
        >
          {{ tt('撤回本项') }}
        </el-button>
      </div>
    </div>

    <!-- ⑤ 扫物料码 -->
    <div v-if="order && lines.length" class="mm-scanbar">
      <el-input
        ref="matInput"
        v-model="matText"
        size="large"
        clearable
        :placeholder="tt('扫描或输入物料码（存货编码|批号）')"
        @keyup.enter="onScanMaterial"
      >
        <template #append>
          <el-button :loading="savingOne" @click="onScanMaterial">{{ tt('提交本笔') }}</el-button>
        </template>
      </el-input>
      <el-button v-if="nativeScan" size="large" :loading="scanning === 'mat'" class="mm-cam" @click="scanMatCamera">
        {{ tt('相机扫码') }}
      </el-button>
      <el-button size="large" :disabled="!activeLine" @click="submitActive">{{ tt('取秤提交') }}</el-button>
    </div>

    <!-- ⑥ 整单保存 -->
    <div v-if="order && lines.length" class="mm-foot">
      <div class="mm-foot-info">
        <span>
          {{ tt('已记') }} {{ progress.done }} / {{ progress.total }} {{ tt('行') }}
          <template v-if="progress.remainCount > 0">
            · {{ tt('还有') }} {{ progress.remainCount }} {{ tt('项未扫') }}
          </template>
        </span>
        <span v-if="progress.allDone" class="mm-foot-ok">{{ tt('可以整单保存') }}</span>
      </div>
      <el-button
        type="primary"
        size="large"
        class="mm-foot-btn"
        :loading="savingAll"
        :disabled="!progress.anyDone"
        @click="saveAll"
      >
        {{ tt('整单保存并打印') }}
      </el-button>
    </div>

    <!-- ⑦ 已保存的混料单(重新扫码后进来补打印) -->
    <section v-if="order" class="mm-docs">
      <div class="mm-list-head">
        <span>{{ tt('该工单已保存的混料单') }}</span>
        <el-button text size="small" :loading="docsLoading" @click="loadDocs">{{ tt('刷新') }}</el-button>
      </div>
      <el-alert v-if="printMsg" :title="printMsg" type="info" :closable="false" show-icon class="mm-print-msg" />
      <div v-if="!docs.length" class="mm-empty">{{ tt('还没有保存过混料单') }}</div>
      <div v-for="d in docs" :key="d.单据编号" class="mm-doc">
        <div class="mm-doc-l1">
          <span class="mm-no mono">{{ d.单据编号 }}</span>
          <span class="mm-doc-print">{{ tt('打印次数') }} {{ d.打印次数 || 0 }}</span>
        </div>
        <div class="mm-doc-l2">
          <span>{{ d.保存时间 || '-' }}</span>
          <span>{{ tt('行数') }} {{ d.行数 || 0 }}</span>
          <span>{{ tt('实际用量合计') }} {{ fmt(d.实际用量合计) }}</span>
        </div>
        <div class="mm-doc-l3">
          <span>{{ d.操作人 || '' }}</span>
          <el-button size="small" type="primary" plain :loading="printing === d.单据编号" @click="reprint(d.单据编号)">
            {{ tt('补打印') }}
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * 扫码混料(手机/电脑同一页:手机竖屏单列,电脑宽屏限宽 900)。
 *
 * 纯逻辑(工单码解析、BOM 展开、秤值校验、纸面载荷)全在 business/mixScan.js,
 * 本组件只负责交互与请求 —— 与 MobileOtherScan / MobilePickDoc 同一套写法(手机扫码规范:
 * el-input + append 按钮的扫码框、顶部标题+一句说明、卡片式分区、底部大按钮)。
 */
import { computed, onBeforeUnmount, onMounted, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { errMsg } from '@/business/engine'
import { parseBarcode } from '@/business/scanPick'
import {
  parseWorkOrderQr,
  expandBom,
  applyScan,
  checkScaleReading,
  scaleReadingOf,
  mixProgress,
  buildScanPayload,
} from '@/business/mixScan'
import { printSlip } from '@/business/slipPrintFlow'
import { scanOnce, hasNativeScan } from '@/business/nativeScan'
import request from '@core/request'

const nativeScan = hasNativeScan()

const woInput = ref(null)
const matInput = ref(null)
const woText = ref('')
const matText = ref('')
const woLoading = ref(false)
const savingOne = ref(false)
const savingAll = ref(false)
const docsLoading = ref(false)
const undoing = ref('')
const printing = ref('')
const scanning = ref('')          // 'wo' | 'mat' | '' —— 相机扫码进行中
const errText = ref('')
const okText = ref('')
const printMsg = ref('')

const order = ref(null)           // { orderNo, lineNo, lineId, productCode, productName, line, planQty }
const lineOptions = ref([])       // 整单码命中多行时的可选项
const lines = ref([])             // 物料清单(expandBom 结果,含 picked/remain)
const activeIdx = ref(-1)
const docs = ref([])

const manualQty = ref(0)          // 手输数量(秤离线时兜底)
const scaleVal = ref(0)
const scaleAt = ref(null)
const scaleOk = ref(false)
const prevScale = ref(null)
let scaleTimer = null

const activeLine = computed(() => (activeIdx.value >= 0 ? lines.value[activeIdx.value] : null))
const progress = computed(() => mixProgress(lines.value))
const scaleText = computed(() => (scaleVal.value > 0 ? `${fmt(scaleVal.value)} kg` : '—'))
const scaleHint = computed(() => {
  if (scaleOk.value) return tt('读数稳定，可取值')
  if (scaleVal.value <= 0) return tt('等待称重')
  return tt('读数跳动中')
})

function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return String(Math.round(v * 10000) / 10000)
}

const reasonText = (reason) => ({
  empty: tt('请先扫描或输入工单二维码'),
  'no-order': tt('不是工单码（工单码格式：公司代码@工单号@行号）'),
  'bad-line': tt('工单码里的行号不是数字'),
  'no-code': tt('条码里没有存货编码'),
  'too-many': tt('条码格式不对（应为 存货编码|批号）'),
  miss: tt('该物料不在本工单的物料清单里'),
  'no-qty': tt('取不到数量：请确认电子秤已连接，或在「手输数量」填一个值'),
}[reason] || '')

onMounted(() => {
  nextTick(() => woInput.value?.focus?.())
  pollScale()
  scaleTimer = setInterval(pollScale, 2000)
})

onBeforeUnmount(() => {
  if (scaleTimer) clearInterval(scaleTimer)
  scaleTimer = null
})

// ═══════════ ① 工单码 → 工单行 + 物料清单 + 未保存草稿 ═══════════

async function scanWoCamera() {
  errText.value = ''
  scanning.value = 'wo'
  try {
    const r = await scanOnce({ formats: ['QR_CODE', 'CODE_128', 'CODE_39'] })
    if (!r.ok) {
      if (r.reason !== 'cancelled') errText.value = scanErrText(r)
      return
    }
    woText.value = r.text
    await onScanWorkOrder()
  } finally {
    scanning.value = ''
  }
}

function scanErrText(r) {
  const map = {
    denied: tt('未授予相机权限，请在系统设置里开启后重试'),
    'not-native': tt('当前环境不支持相机扫码'),
    empty: tt('没有扫到内容'),
  }
  return map[r.reason] || (tt('扫码失败：') + (r.message || ''))
}

async function onScanWorkOrder() {
  errText.value = ''
  okText.value = ''
  printMsg.value = ''
  const q = parseWorkOrderQr(woText.value)
  if (!q.ok) {
    errText.value = reasonText(q.reason)
    return
  }
  woLoading.value = true
  try {
    const params = { orderNo: q.orderNo }
    if (q.lineNo) params.lineNo = q.lineNo
    const res = await request.get('/px/mix/lines', { params })
    const rows = (res && (res.data?.list || res.list)) || []
    if (!rows.length) {
      errText.value = tt('没找到这张工单') + (q.lineNo ? `(${tt('行号')} ${q.lineNo})` : '')
      order.value = null
      lines.value = []
      docs.value = []
      return
    }
    lineOptions.value = rows.map((r) => ({
      lineNo: Number(r['工单行号']) || 0,
      lineId: Number(r['行id']) || 0,
      productCode: r['产品编码'] || '',
      productName: r['产品名称'] || '',
      planQty: Number(r['排产数量']) || 0,
      line: r['生产线'] || '',
    }))
    const hit = rows.find((r) => Number(r['工单行号']) === (q.lineNo || Number(rows[0]['工单行号']))) || rows[0]
    await useWorkOrderRow(hit)
  } catch (e) {
    errText.value = errMsg(e) || tt('查询工单失败')
    order.value = null
    lines.value = []
  } finally {
    woLoading.value = false
  }
}

/** 把某一行工单设成本次作业对象,并拉它的物料清单 + 未保存草稿 */
async function useWorkOrderRow(r) {
  order.value = {
    orderNo: String(r['工单号'] || '').trim(),
    lineNo: Number(r['工单行号']) || 0,
    lineId: Number(r['行id']) || 0,
    productCode: String(r['产品编码'] || '').trim(),
    productName: String(r['产品名称'] || '').trim(),
    line: String(r['生产线'] || '').trim(),
    planQty: Number(r['排产数量']) || 0,
  }
  await loadBom()
  await loadDraft()
  await loadDocs()
  activeIdx.value = lines.value.length ? 0 : -1
  await nextTick()
  matInput.value?.focus?.()
}

async function onLineChange() {
  const picked = lineOptions.value.find((o) => o.lineNo === order.value?.lineNo)
  if (!picked) return
  await useWorkOrderRow({
    工单号: order.value.orderNo,
    工单行号: picked.lineNo,
    行id: picked.lineId,
    产品编码: picked.productCode,
    产品名称: picked.productName,
    生产线: picked.line,
    排产数量: picked.planQty,
  })
}

/** 一级BOM = 物料清单(mate),按排产数量折算应投量 */
async function loadBom() {
  if (!order.value?.productCode) {
    lines.value = []
    return
  }
  const res = await request.get('/px/mix/bom', { params: { productCode: order.value.productCode } })
  const bom = (res && (res.data?.list || res.list)) || []
  lines.value = expandBom(bom, order.value.planQty)
}

/**
 * 恢复「扫了一半」的草稿(标记 N 的行)。
 *
 * 为什么要有:手机熄屏/App 被杀/现场换人接着扫 —— 已经投的料不该凭空消失,
 * 否则重复投料会把实际用量记成两倍。
 */
async function loadDraft() {
  try {
    const res = await request.get('/px/mix/draft', {
      params: { orderNo: order.value.orderNo, lineNo: order.value.lineNo },
    })
    const rows = (res && (res.data?.list || res.list)) || []
    if (!rows.length) return
    let restored = 0
    for (const d of rows) {
      const line = lines.value.find((l) => String(l.code).trim() === String(d['物料编号'] || '').trim())
      if (!line) continue
      line.picked = Math.round((Number(line.picked) + Number(d['实际用量'] || 0)) * 10000) / 10000
      line.remain = Math.round((Number(line.required) - Number(line.picked)) * 10000) / 10000
      line.rowId = Number(d['行id']) || 0
      restored += 1
    }
    if (restored) okText.value = tt('已恢复本工单未保存的记录') + `：${restored}`
  } catch {
    // 恢复失败不影响接着扫(草稿还在库里,保存时会一起整单保存)
  }
}

// ═══════════ ② 扫物料码 → 取秤 → 提交本笔 ═══════════

async function scanMatCamera() {
  errText.value = ''
  scanning.value = 'mat'
  try {
    const r = await scanOnce({ formats: ['CODE_128', 'CODE_39', 'EAN_13', 'QR_CODE'] })
    if (!r.ok) {
      if (r.reason !== 'cancelled') errText.value = scanErrText(r)
      return
    }
    matText.value = r.text
    await onScanMaterial()
  } finally {
    scanning.value = ''
  }
}

async function onScanMaterial() {
  errText.value = ''
  okText.value = ''
  const p = parseBarcode(matText.value)
  if (!p.ok) {
    errText.value = reasonText(p.reason)
    return
  }
  const hit = lines.value.findIndex((l) => String(l.code).trim() === p.code)
  if (hit < 0) {
    errText.value = reasonText('miss') + `：${p.code}`
    return
  }
  activeIdx.value = hit
  await submitLine(lines.value[hit])
}

async function submitActive() {
  if (!activeLine.value) return
  errText.value = ''
  okText.value = ''
  await submitLine(activeLine.value)
}

/** 提交本笔:取数量(手输优先,否则读秤)→ 落库 → 累加到清单 → 跳下一项 */
async function submitLine(line) {
  if (!line || !order.value) return
  savingOne.value = true
  try {
    const qty = await qtyOf()
    if (qty == null) {
      errText.value = reasonText('no-qty')
      return
    }
    const body = buildScanPayload({ order: order.value, line, qty })
    const res = await request.post('/px/mix/scan', body)
    const saved = res?.data?.data || res?.data || res || {}
    const r = applyScan(lines.value, { code: line.code }, qty)
    if (!r.ok) {
      errText.value = tt('本笔保存失败')
      return
    }
    if (saved['行id']) lines.value[r.index].rowId = Number(saved['行id'])
    okText.value = `${line.code} +${fmt(qty)} ${line.uom || ''}`
    matText.value = ''
    manualQty.value = 0
    // 自动跳到下一个未记的项,减少点屏
    const next = lines.value.findIndex((l) => Number(l.picked) <= 0)
    if (next >= 0) activeIdx.value = next
    await nextTick()
    matInput.value?.focus?.()
  } catch (e) {
    errText.value = errMsg(e) || tt('提交本笔失败')
  } finally {
    savingOne.value = false
  }
}

/** 撤回本项:删掉该行未保存的草稿记录,并把界面上的已记数量清零 */
async function undoLine(i) {
  const line = lines.value[i]
  if (!line?.rowId) {
    // 草稿行 id 丢了(比如整页刷新后没恢复成功):只能清界面,库里那笔靠整单保存时一起处理
    line.picked = 0
    line.remain = line.required
    return
  }
  undoing.value = line.code
  errText.value = ''
  try {
    await request.post('/px/mix/undo', { 行id: line.rowId })
    line.picked = 0
    line.remain = line.required
    line.rowId = 0
    okText.value = tt('已撤回') + '：' + line.code
  } catch (e) {
    errText.value = errMsg(e) || tt('撤回失败')
  } finally {
    undoing.value = ''
  }
}

/**
 * 本次数量:手输优先,否则读秤。
 *
 * 手输为什么必须有(2026-10-21 教训):台车秤离线/故障时若硬要读数,现场当场卡死;
 * 而且验证阶段常常没有秤硬件。
 *
 * @returns {Promise<number|null>} 可用数量;两者都取不到时 null
 */
async function qtyOf() {
  const m = Number(manualQty.value)
  if (Number.isFinite(m) && m > 0) return Math.round(m * 10000) / 10000
  try {
    const res = await request.get('/dc/monitor')
    const reading = scaleReadingOf(res)
    if (!reading) return null
    const chk = checkScaleReading(reading, prevScale.value)
    prevScale.value = reading
    return chk.ok ? chk.value : null
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

// ═══════════ ③ 整单保存 → 自动打印 ═══════════

async function saveAll() {
  if (!order.value || !progress.value.anyDone) return
  errText.value = ''
  okText.value = ''
  // 「全部扫完,整单保存」是主路径;有漏项时给一次明确确认,免得少投的料被静默存成一张单
  if (!progress.value.allDone) {
    try {
      await ElMessageBox.confirm(
        `${tt('还有')} ${progress.value.remainCount} ${tt('项未扫，确定整单保存吗？')}`,
        tt('整单保存'),
        { confirmButtonText: tt('确定保存'), cancelButtonText: tt('返回继续扫'), type: 'warning' },
      )
    } catch {
      return
    }
  }
  savingAll.value = true
  try {
    const res = await request.post('/px/mix/save', {
      工单号: order.value.orderNo,
      工单行号: order.value.lineNo,
    })
    const saved = res?.data?.data || res?.data || res || {}
    const docNo = String(saved['单据编号'] || '').trim()
    if (!docNo) throw new Error(tt('保存后没有拿到混料单号'))
    ElMessage.success(tt('整单保存成功') + '：' + docNo)
    okText.value = tt('整单保存成功') + '：' + docNo
    // 保存后自动打印(用户口径「保存后自动打印」)—— 打印失败不撤销单据
    await doPrint(docNo, 'mobileMix.save')
    // 清掉本次已记数量,同一张工单可以接着配下一锅
    for (const l of lines.value) {
      l.picked = 0
      l.remain = l.required
      l.rowId = 0
    }
    activeIdx.value = lines.value.length ? 0 : -1
    await loadDocs()
  } catch (e) {
    errText.value = errMsg(e) || tt('整单保存失败')
  } finally {
    savingAll.value = false
  }
}

/**
 * 打一张混料单:优先发打印站点(MIX_SLIP),没电脑在线就退回浏览器打印层。
 *
 * 打印**永远不该让业务回滚**(单据已经存了),失败只提示;成功则让后端累加打印次数,
 * 这样"补打印"列表里能看出这张单已经出过几张纸。
 */
async function doPrint(docNo, source) {
  printing.value = docNo
  printMsg.value = ''
  try {
    const r = await printSlip({ kind: 'MIX', docNo, source })
    if (r.ok) {
      request.post('/px/mix/printed', { 单据编号: docNo }).catch(() => {})
    }
    printMsg.value = r.ok
      ? `${r.mode === 'station' ? tt('已发送到打印电脑') : tt('已调用本机打印')}：${docNo}`
      : `${tt('打印失败')}：${docNo}${r.message ? ' · ' + r.message : ''}`
    return r
  } finally {
    printing.value = ''
  }
}

/** 重新扫码后进来补打印(单据一直在库里,不做任何数据改动,只加打印次数) */
async function reprint(docNo) {
  await doPrint(docNo, 'mobileMix.reprint')
  await loadDocs()
}

// ═══════════ ④ 单据列表 ═══════════

async function loadDocs() {
  if (!order.value) return
  docsLoading.value = true
  try {
    const res = await request.get('/px/mix/docs', {
      params: { orderNo: order.value.orderNo, lineNo: order.value.lineNo },
    })
    docs.value = (res && (res.data?.list || res.list)) || []
  } catch (e) {
    errText.value = errMsg(e) || tt('查询混料单失败')
  } finally {
    docsLoading.value = false
  }
}

function resetOrder() {
  order.value = null
  lineOptions.value = []
  lines.value = []
  docs.value = []
  woText.value = ''
  matText.value = ''
  okText.value = ''
  errText.value = ''
  activeIdx.value = -1
  nextTick(() => woInput.value?.focus?.())
}
</script>

<style scoped>
/* 手机扫码统一规范(与 MobileOtherScan / MobilePick 一致):限宽 900 居左、14/16 内边距、
   卡片 + 虚线分隔、底部主按钮撑满、行内数字等宽。 */
.mm-scan { max-width: 900px; padding: 14px 16px 26px; }
.mm-head { margin-bottom: 12px; }
.mm-title { font-size: 18px; font-weight: 600; }
.mm-sub { margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mm-scanbar { display: flex; gap: 8px; margin-bottom: 12px; }
.mm-scanbar :deep(.el-input) { flex: 1; min-width: 0; }
.mm-cam { flex: none; }
.mm-alert { margin-bottom: 12px; }
.mm-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
.mm-order-l1 { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.mm-no { font-size: 15px; font-weight: 600; }
.mono { font-variant-numeric: tabular-nums; }
.mm-tag { font-size: 11px; padding: 0 6px; border-radius: 8px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.mm-clear { margin-left: auto; }
.mm-kv { display: grid; grid-template-columns: 64px 1fr; gap: 4px 8px; font-size: 13px; }
.mm-k { color: var(--el-text-color-secondary); font-size: 12px; }
.mm-v { word-break: break-all; }
.mm-v.strong { font-weight: 600; color: var(--el-color-primary); }
.mm-linepick { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.mm-linepick-sel { flex: 1; min-width: 0; }
.mm-scale { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border: 1px solid var(--el-border-color-light); border-left: 3px solid var(--el-color-warning); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
.mm-scale.live { border-left-color: var(--el-color-success); }
.mm-scale-main { display: flex; align-items: baseline; gap: 10px; flex: 1; min-width: 0; }
.mm-scale-label { font-size: 12px; color: var(--el-text-color-secondary); }
.mm-scale-num { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.mm-scale-hint { font-size: 11px; color: var(--el-text-color-secondary); }
.mm-scale-manual { display: flex; align-items: center; gap: 8px; }
.mm-scale-manual :deep(.el-input-number) { width: 132px; }
.mm-list { margin-bottom: 12px; }
.mm-list-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid var(--el-border-color-lighter); }
.mm-list-head :deep(.el-button) { margin-left: auto; }
.mm-prog { margin-left: auto; font-size: 12px; color: var(--el-color-primary); }
.mm-row { position: relative; padding: 8px 0; border-bottom: 1px dashed var(--el-border-color-lighter); cursor: pointer; }
.mm-row.active { background: var(--el-color-primary-light-9); box-shadow: inset 3px 0 0 var(--el-color-primary); }
.mm-row.done { background: var(--el-color-success-light-9); }
.mm-row.over { background: var(--el-color-danger-light-9); }
.mm-row-main { display: flex; align-items: baseline; gap: 8px; }
.mm-code { font-size: 14px; font-weight: 600; }
.mm-name { font-size: 12px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mm-row-qty { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 3px; font-size: 12px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mm-q-done { color: var(--el-color-success); }
.mm-q-remain { color: var(--el-color-warning); }
.mm-q-remain.neg { color: var(--el-color-danger); font-weight: 600; }
.mm-row-undo { position: absolute; right: 0; top: 6px; }
.mm-foot { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
.mm-foot-info { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.mm-foot-ok { color: var(--el-color-success); }
.mm-foot-btn { width: 100%; }
.mm-docs { margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--el-border-color-lighter); }
.mm-print-msg { margin: 8px 0; }
.mm-empty { padding: 14px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mm-doc { padding: 8px 6px; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mm-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mm-doc-print { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }
.mm-doc-l2, .mm-doc-l3 { margin-top: 3px; display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--el-text-color-secondary); }
.mm-doc-l3 :deep(.el-button) { margin-left: auto; }
@media (max-width: 480px) {
  .mm-scan { padding: 10px 12px 22px; }
  .mm-scale-manual :deep(.el-input-number) { width: 110px; }
}
</style>
