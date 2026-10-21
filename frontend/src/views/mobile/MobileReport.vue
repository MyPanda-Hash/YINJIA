<template>
  <div class="mp">
    <div class="mp-top">
      <div class="mp-head">
        <span class="mp-title">{{ tt('工序报工') }}</span>
        <span v-if="baseUrl" class="mp-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mp-sub">{{ tt('扫工单 → 选工序 → 填数量 → 提交') }}</span>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>

    <div class="mp-body">
      <div class="mp-left">
        <!-- ① 工单 -->
        <section class="mp-card">
          <div class="mp-sec">
            <span>{{ tt('生产工单') }}</span>
            <span v-if="wo" class="mp-tag">{{ tt('已选') }}</span>
          </div>
          <div class="mp-row">
            <el-input
              ref="woInput"
              v-model="woText"
              :placeholder="tt('扫工单码或输入工单号')"
              size="large"
              clearable
              @keyup.enter="loadWo()"
            />
            <el-button size="large" :loading="woLoading" @click="loadWo()">{{ tt('查询') }}</el-button>
            <el-button v-if="nativeScan" size="large" @click="scanInto('wo')">{{ tt('扫码') }}</el-button>
          </div>

          <div v-if="wo" class="mp-wo">
            <div class="mp-wo-no">
              {{ wo.工单号 }}<span class="mp-tag">#{{ wo.工单行号 }}</span>
            </div>
            <div class="mp-kv"><span>{{ tt('物料编码') }}</span><b class="mono">{{ wo.物料编码 || '—' }}</b></div>
            <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ wo.产品名称 || '—' }}</b></div>
            <div class="mp-kv"><span>{{ tt('规格') }}</span><b>{{ wo.规格型号 || '—' }}</b></div>
            <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ wo.生产线 || '—' }}</b></div>
            <div class="mp-kv"><span>{{ tt('排产数量') }}</span><b class="num">{{ fmt(wo.排产数量) }}</b></div>
            <!-- 当前工序 / 完工状态:报工提交后由后端推进,这里读的是工单行的实时值 -->
            <div class="mp-kv">
              <span>{{ tt('当前工序') }}</span>
              <b class="mp-cur">{{ wo.当前工序 || '—' }}</b>
            </div>
            <div class="mp-kv"><span>{{ tt('完工状态') }}</span><b>{{ wo.完工状态 || '—' }}</b></div>
            <div class="mp-kv"><span>{{ tt('报工人') }}</span><b>{{ reporterName || '—' }}</b></div>
          </div>
          <div v-if="!wo" class="mp-hint">{{ tt('先扫工单码:报工会写进该工单行的工序进度') }}</div>
        </section>

        <!-- ② 工序 + 数量 -->
        <section class="mp-card" :class="{ dim: !wo }">
          <div class="mp-sec">{{ tt('报工') }}</div>

          <div class="mp-ops">
            <div
              v-for="op in ops"
              :key="op.工序"
              class="mp-op"
              :class="{ 'is-active': pickedOp === op.工序, 'is-done': Number(op.已报工) >= Number(op.计划数量) && Number(op.计划数量) > 0 }"
              @click="pickOp(op)"
            >
              <div class="mp-op-name">{{ opLabel(op.工序) }}</div>
              <div class="mp-op-meta">
                <span>{{ fmt(op.已报工) }} / {{ fmt(op.计划数量) }}</span>
                <span v-if="Number(op.待审核) > 0" class="mp-op-pending">{{ tt('待审') }} {{ fmt(op.待审核) }}</span>
              </div>
              <div class="mp-op-bar"><i :style="{ width: pct(op) + '%' }"></i></div>
            </div>
            <div v-if="!ops.length" class="mp-empty">{{ tt('该工单没有工序台账') }}</div>
          </div>

          <div class="mp-row mp-qty">
            <span class="mp-qty-label">{{ tt('完工数量') }}</span>
            <el-input-number v-model="qty" :min="0" :precision="2" :step="1" size="large" controls-position="right" />
            <span class="mp-qty-unit">{{ wo ? wo.计量单位 : '' }}</span>
          </div>

          <div class="mp-row mp-submit">
            <el-button type="primary" size="large" :disabled="!canSubmit" :loading="saving" @click="submit">
              {{ tt('提交报工') }}
            </el-button>
          </div>
          <div v-if="picked && !canSubmit && submitHint" class="mp-warn">{{ submitHint }}</div>
        </section>
      </div>

      <div class="mp-right">
        <!-- ③ 今日报工明细 -->
        <section class="mp-card">
          <div class="mp-sec">
            <span>{{ tt('今日报工') }}</span>
            <span class="mp-sec-num">{{ today.length }}</span>
          </div>
          <div v-if="!today.length" class="mp-empty">{{ tt('今天还没有报工记录') }}</div>
          <div v-for="(r, i) in today" :key="i" class="mp-line">
            <div class="mp-line-main">
              <div class="mp-line-name">{{ opLabel(r.工序) }} · {{ fmt(r.报工数量) }} {{ wo ? wo.计量单位 : '' }}</div>
              <div class="mp-line-meta">
                {{ r.报工单号 }} · {{ r.报工人 || '—' }} · {{ r.完工状态 === 'Y' ? tt('已审核') : tt('待审核') }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { parseWorkOrderCode } from '@/business/scanCode'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
/** 报工人 = 登录扫码人(与生产领料的「领用人」同一口径) */
const reporterName = computed(() => String(userStore.realName || '').trim())

const woInput = ref(null)
const woText = ref('')
const wo = ref(null)
const woLoading = ref(false)
const ops = ref([])
const today = ref([])
const pickedOp = ref('')
const qty = ref(0)
const saving = ref(false)
const errText = ref('')

const fmt = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}
const pct = (op) => {
  const plan = Number(op.计划数量) || 0
  const done = Number(op.已报工) || 0
  if (plan <= 0) return 0
  return Math.min(100, Math.round((done / plan) * 100))
}

/** 工序中文名(库里就是「成型/切炭/组装」;切炭不要写成"切碳") */
function opLabel(name) {
  return String(name || '').trim() || '—'
}

const picked = computed(() => ops.value.find((o) => o.工序 === pickedOp.value) || null)
const canSubmit = computed(() => !!wo.value && !!picked.value && Number(qty.value) > 0 && !saving.value)
const submitHint = computed(() => {
  if (!picked.value) return tt('请先选择工序')
  if (!(Number(qty.value) > 0)) return tt('请填写完工数量')
  return ''
})

/** 扫码桥:两个安卓壳都注入 window.YjNative(自研 ZXing),网页版没有 */
const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()
let scanTarget = null

function applyScan(code) {
  const text = String(code == null ? '' : code).trim()
  if (!text) return
  const p = parseWorkOrderCode(text)
  if (!p.ok) {
    errText.value = tt('这个码里没有工单号')
    return
  }
  woText.value = p.wo
  loadWo(p.line)
}

function scanInto() {
  scanTarget = 'wo'
  if (window.YjNative && typeof window.YjNative.scan === 'function') {
    try {
      window.YjNative.scan()
    } catch (e) {
      errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    }
  }
}

onMounted(() => {
  nextTick(() => woInput.value?.focus?.())
  window.__yjScanResult = (code, ok) => {
    if (!ok || !code) { scanTarget = null; return }
    applyScan(code)
  }
})

onBeforeUnmount(() => {
  try { delete window.__yjScanResult } catch (e) { /* ignore */ }
})

async function loadWo(line) {
  const kw = String(woText.value || '').trim()
  errText.value = ''
  wo.value = null
  ops.value = []
  today.value = []
  pickedOp.value = ''
  qty.value = 0
  if (!kw) {
    errText.value = tt('请先扫描或输入工单号')
    return
  }
  woLoading.value = true
  try {
    const res = await request.get('/px/workReport/context', { params: { woNo: kw, line: Number(line) || 0 } })
    const data = res.data?.data || res.data || {}
    wo.value = data.工单 || null
    ops.value = Array.isArray(data.工序台账) ? data.工序台账 : []
    today.value = Array.isArray(data.今日报工) ? data.今日报工 : []
    // 默认选中「当前工序」,没有就选第一道未做满的
    const cur = String(wo.value?.当前工序 || '').trim()
    const hit = ops.value.find((o) => o.工序 === cur)
      || ops.value.find((o) => Number(o.计划数量) > 0 && Number(o.已报工) < Number(o.计划数量))
      || ops.value[0]
    if (hit) {
      pickedOp.value = hit.工序
      // 数量默认 = 计划量 - 已报工(还差多少),不能为负
      const left = (Number(hit.计划数量) || 0) - (Number(hit.已报工) || 0)
      qty.value = left > 0 ? Math.round(left * 10000) / 10000 : 0
    }
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('查询工单失败')
  } finally {
    woLoading.value = false
  }
}

function pickOp(op) {
  pickedOp.value = op.工序
  const left = (Number(op.计划数量) || 0) - (Number(op.已报工) || 0)
  qty.value = left > 0 ? Math.round(left * 10000) / 10000 : 0
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  errText.value = ''
  try {
    const res = await request.post('/px/workReport/submit', {
      woNo: wo.value.工单号,
      工单行号: wo.value.工单行号,
      工序: pickedOp.value,
      数量: Number(qty.value),
      报工人: reporterName.value,
      批次号: wo.value.批号 || '',
      生产线: wo.value.生产线 || '',
    })
    const no = res.data?.data?.报工单号 || ''
    ElMessage.success(tt('报工已提交并审核') + (no ? ':' + no : ''))
    await loadWo(wo.value.工单行号)   // 重新拉一次:工序进度/当前工序会变
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('提交报工失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 手机 375 宽为基准:不横向滚动;命中区 ≥44px;数字等宽。 */
.mp {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--el-bg-color-page);
}
.mp-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 12px 14px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.mp-head { display: flex; align-items: baseline; gap: 8px; }
.mp-base { font-size: 11px; color: var(--el-text-color-placeholder); }
.mp-title { font-size: 16px; font-weight: 600; }
.mp-sub { font-size: 12px; color: var(--el-text-color-secondary); }

.mp-err-top {
  margin: 10px 14px 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
}

.mp-body { display: flex; flex-direction: column; gap: 10px; padding: 10px 14px 16px; }
.mp-card {
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.mp-card.dim { opacity: 0.6; }
.mp-sec {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px; font-size: 14px; font-weight: 600;
}
.mp-sec-num {
  padding: 0 6px; border-radius: 9px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary); font-size: 12px; font-weight: 500;
}
.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row .el-input { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { flex: none; margin-left: 0; }

.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-placeholder); }
.mp-warn { margin-top: 8px; font-size: 12px; color: var(--el-color-warning); }

.mp-wo { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-wo-no { margin-bottom: 6px; font-size: 15px; font-weight: 600; }
.mp-tag {
  margin-left: 6px; padding: 0 5px; border-radius: 3px;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary);
  font-size: 11px; font-weight: 500;
}
.mp-kv {
  display: flex; gap: 8px; padding: 2px 0;
  font-size: 13px; color: var(--el-text-color-regular);
}
.mp-kv > span { flex: none; width: 72px; color: var(--el-text-color-secondary); }
.mp-kv > b { flex: 1; min-width: 0; font-weight: 500; word-break: break-all; }
.mp-cur { color: var(--el-color-primary); font-weight: 600; }
/* 工单卡里的数值左对齐(2026-10-21 截图发现「排产数量」被 .num 的右对齐推到卡右侧,读起来像另一个字段) */
.mp-kv > b.num { text-align: left; }
.mp-kv > b { text-align: left; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }

/* 工序卡:三道横排(窄屏换行),进度条用已报/计划 */
.mp-ops { display: flex; flex-wrap: wrap; gap: 8px; }
.mp-op {
  flex: 1 1 96px; min-width: 96px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  cursor: pointer;
}
.mp-op.is-active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.mp-op.is-done { border-color: var(--el-color-success-light-5); }
.mp-op-name { font-size: 14px; font-weight: 600; }
.mp-op-meta {
  display: flex; justify-content: space-between; gap: 4px;
  margin-top: 4px; font-size: 11px; color: var(--el-text-color-secondary);
}
.mp-op-pending { color: var(--el-color-warning); }
.mp-op-bar { height: 4px; margin-top: 6px; border-radius: 2px; background: var(--el-fill-color); overflow: hidden; }
.mp-op-bar i { display: block; height: 100%; background: var(--el-color-primary); }

.mp-qty { margin-top: 12px; }
.mp-qty-label { flex: none; font-size: 13px; color: var(--el-text-color-regular); }
.mp-qty :deep(.el-input-number) { flex: none; width: 116px; }
.mp-qty-unit { flex: none; min-width: 24px; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-submit { margin-top: 12px; }
.mp-submit :deep(.el-button) { flex: 1; }

.mp-line { padding: 8px 0; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-line:first-of-type { border-top: 0; }
.mp-line-name { font-size: 13px; font-weight: 500; }
.mp-line-meta { margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }

/* ≥900px 双栏(电脑端同一份组件) */
@media (min-width: 900px) {
  .mp-body { flex-direction: row; align-items: flex-start; }
  .mp-left { flex: 1.6; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .mp-right { flex: 1; min-width: 0; }
}
</style>
