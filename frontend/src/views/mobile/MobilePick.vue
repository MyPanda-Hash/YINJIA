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
      <span class="mp-title">{{ tt('生产领料') }}</span>
      <span class="mp-sub">{{ tt('扫工单 → 扫物料 → 先进先出拆批') }}</span>
    </div>

    <div class="mp-body">
      <div class="mp-left">
    <!-- ① 工单 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('生产工单') }}</span>
        <span v-if="wo" class="mp-sec-ok">{{ tt('已选') }}</span>
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
          <span class="mp-cand-p">{{ c.产品名称 || c.物料编码 }}</span>
        </div>
      </div>

      <div v-if="wo" class="mp-wo">
        <div class="mp-wo-no">{{ wo.工单号 }}<span class="mp-tag">#{{ wo.工单行号 }}</span></div>
        <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ wo.产品名称 || wo.物料编码 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('规格') }}</span><b>{{ wo.规格型号 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ wo.生产线 || '—' }}</b></div>
        <div class="mp-kv"><span>{{ tt('排产数量') }}</span><b class="num">{{ fmt(wo.排产数量) }}</b></div>
        <div class="mp-kv"><span>{{ tt('已开领料单') }}</span><b>{{ wo.领料单号 || tt('无') }}</b></div>
      </div>
      <div v-if="!wo" class="mp-hint">{{ tt('先扫工单码:领料会挂到该工单行上,审核后回写领料单号') }}</div>
    </section>

    <!-- ② 物料 -->
    <section class="mp-card" :class="{ dim: !wo }">
      <div class="mp-sec">{{ tt('领用物料') }}</div>
      <div class="mp-row">
        <el-input
          ref="matInput"
          v-model="matText"
          :placeholder="tt('扫物料码或输入物料编码')"
          size="large"
          clearable
          :disabled="!wo"
          @keyup.enter="probeMaterial"
        />
        <el-button size="large" :loading="matLoading" :disabled="!wo" @click="probeMaterial">
          {{ tt('查询') }}
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
        <div class="mp-row mp-qty">
          <span class="mp-qty-label">{{ tt('领用数量') }}</span>
          <el-input-number v-model="qty" :min="0" :precision="2" :step="1" size="large" controls-position="right" />
          <span class="mp-qty-unit">{{ mat.uom }}</span>
          <el-button type="primary" size="large" :disabled="!canAdd" @click="addLines">
            {{ tt('加入') }}
          </el-button>
        </div>

        <div v-if="alloc.length" class="mp-alloc">
          <div class="mp-alloc-title">{{ tt('按批号日期先进先出') }}</div>
          <div v-for="(a, i) in alloc" :key="i" class="mp-alloc-row">
            <span class="mp-alloc-batch">{{ a.batch || tt('无批次') }}</span>
            <span class="mp-alloc-wh">{{ a.warehouse || '—' }}</span>
            <span class="mp-alloc-qty num">{{ fmt(a.qty) }}</span>
          </div>
          <div v-if="shortage > 0" class="mp-warn">
            {{ tt('可用量不足,缺') }} {{ fmt(shortage) }} {{ mat.uom }}
          </div>
        </div>
      </template>
    </section>

    <!-- ③ 清单 -->
      </div><!-- /mp-left -->

      <div class="mp-right">
    <!-- ③ 清单 -->
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

    <div v-if="errText" class="mp-err">{{ errText }}</div>
      </div><!-- /mp-right -->
    </div><!-- /mp-body -->

    <div class="mp-foot">
      <el-button size="large" :disabled="!lines.length" @click="reset">{{ tt('清空') }}</el-button>
      <el-button
        type="primary"
        size="large"
        :loading="saving"
        :disabled="!lines.length || !wo"
        @click="submit"
      >
        {{ tt('生成材料出库单') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { queryFormDataList, callButton, errMsg } from '@/business/engine'
import { allocateFifo, sumAvailable, buildMaterialOutForm } from '@/business/scanPick'

const woInput = ref(null)
const matInput = ref(null)
const woText = ref('')
const wo = ref(null)
const woCandidates = ref([])
const woLoading = ref(false)

const matText = ref('')
const mat = ref(null)
const matLoading = ref(false)
const qty = ref(0)

const lines = ref([])
const saving = ref(false)
const errText = ref('')
const binCache = new Map()

const fmt = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

/** 先进先出预分配:一批不够就扣下一日期批次,生成多条明细 */
const allocResult = computed(() => (mat.value && qty.value > 0 ? allocateFifo(mat.value.rows, qty.value) : { lines: [], allocated: 0, shortage: 0 }))
const alloc = computed(() => allocResult.value.lines)
const shortage = computed(() => allocResult.value.shortage)

const canAdd = computed(() => {
  const need = Number(qty.value) || 0
  return !!mat.value && need > 0 && alloc.value.length > 0 && !shortage.value
})

onMounted(() => nextTick(() => woInput.value?.focus?.()))

watch(lines, () => { errText.value = '' })

/** 工单:扫到/输入工单号 → 精确命中优先,否则列出候选 */
async function loadWo() {
  const kw = String(woText.value || '').trim()
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
      errText.value = tt('该工单不存在或未排产')
      return
    }
    const exact = rows.filter((r) => String(r.工单号 || '').trim() === kw)
    if (exact.length === 1) pickWo(exact[0])
    else if (rows.length === 1) pickWo(rows[0])
    else woCandidates.value = exact.length ? exact : rows.slice(0, 20)
  } catch (e) {
    errText.value = errMsg(e) || tt('查询工单失败')
  } finally {
    woLoading.value = false
  }
}

function pickWo(row) {
  if (Number(row.排产数量) <= 0) {
    errText.value = tt('该工单未排产(排产数量为 0),请先快速排产')
    return
  }
  wo.value = row
  woText.value = String(row.工单号 || '').trim()
  woCandidates.value = []
  errText.value = ''
  nextTick(() => matInput.value?.focus?.())
}

/** 物料:按存货编码查批号级可用量(口径仍是 物料+仓库 合计) */
async function probeMaterial() {
  const code = String(matText.value || '').trim()
  errText.value = ''
  mat.value = null
  qty.value = 0
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
    qty.value = 0
  } catch (e) {
    errText.value = errMsg(e) || tt('查询可用量失败')
  } finally {
    matLoading.value = false
  }
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
  const need = await Promise.all(alloc.value.map(async (a) => ({ a, bin: await resolveBin(a.warehouseCode, a.warehouse) })))
  for (const { a, bin } of need) {
    const key = [a.code, a.batch, a.warehouseCode || a.warehouse].map((x) => String(x || '').trim()).join('|')
    const exist = lines.value.find((l) => l.key === key)
    if (exist) exist.qty = Math.round((exist.qty + a.qty) * 10000) / 10000
    else {
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
      })
    }
  }
  matText.value = ''
  mat.value = null
  qty.value = 0
  errText.value = ''
  nextTick(() => matInput.value?.focus?.())
}

function reset() {
  lines.value = []
  matText.value = ''
  mat.value = null
  qty.value = 0
  errText.value = ''
}

/** 生成材料出库单草稿(带 加工单号 + 工单行号:追溯与回写都靠这两列) */
async function submit() {
  if (!wo.value || !lines.value.length) return
  saving.value = true
  try {
    const wh = lines.value.every((l) => (l.warehouseCode || l.warehouse) === (lines.value[0].warehouseCode || lines.value[0].warehouse))
      ? lines.value[0].warehouse
      : ''
    const formData = buildMaterialOutForm(lines.value, {
      woNo: wo.value.工单号,
      woLine: wo.value.工单行号,
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
.mp-title { font-size: 16px; font-weight: 600; }
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

.mp-qty { margin-top: 10px; }
.mp-qty-label { flex: none; font-size: 13px; color: var(--el-text-color-regular); }
.mp-qty-unit { flex: none; min-width: 28px; font-size: 13px; color: var(--el-text-color-secondary); }

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
