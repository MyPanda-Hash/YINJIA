<!--
  MobilePickCreate.vue — 手机扫码 · 生成工单领料/退料单(开单工作台,2026-10-30)

  【为什么是独立一页】(用户 2026-10-30 第二轮口径)
  「还有少了一个『生成工单领料/退料单』这个面版,这个面版的功能和生成领料是有区别的(不是一个面版),
    重新分析需求」+ 三问确认:
    ① 定位 = **电脑上的开单工作台**(可扫多张工单**批量生成**、列表看已生成的单);
    ② 职责 = **只管生单**,生完引导到「生产领料」去领;
    ③ 菜单顺序 = 本页排在「生产领料」**之前**。

  ⇒ 本页不做领料:只做「扫工单 → 一对领料/退料单 → 自动打二维码」,
    领料核销与提交都在 /panelx/list/MOBILE_PICK。

  【批量口径】(为什么不是"整批成功或整批失败")
  现场是一沓工单码挨个扫。中间难免有一张 BOM 没维护、或行号对不上 ——
  整批事务回滚会把前面已经开好的单一起撤掉,现场只会说"扫了半天全没了"。
  ⇒ 逐张独立生成、失败的**点名列出原因**,成功的照常出现在结果里(后端 create/batch 同口径)。

  【规范】与 MobilePickList.vue 同一套视觉语言:44px 命中区、无装饰动画、文案走 tt()。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <div class="mp-head">
        <span class="mp-title">{{ tt('生成工单领料/退料单') }}</span>
        <span v-if="baseUrl" class="mp-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mp-sub">{{ tt('扫工单生单 → 自动打印工单二维码') }}</span>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- ① 扫工单(连续扫:扫一张进队列,点「生成」批量建) -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('扫工单') }}</span>
        <span v-if="queue.length" class="mp-sec-num">{{ queue.length }}</span>
      </div>
      <div class="mp-row">
        <el-input
          ref="woInput"
          v-model="woText"
          :placeholder="tt('扫工单码或输入工单号')"
          size="large"
          clearable
          @keyup.enter="addQueue"
        />
        <el-button size="large" @click="addQueue">{{ tt('添加') }}</el-button>
        <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>
      <div class="mp-hint">
        {{ tt('按工单行的产品取《组装BOM表》,生成一张领料单和一张退料单(退料数量默认 0),并自动打印一次工单二维码') }}
      </div>

      <!-- 待生成队列 -->
      <div v-if="queue.length" class="mp-queue">
        <div class="mp-queue-head">
          <span>{{ tt('待生成') }} {{ queue.length }}</span>
          <span class="mp-queue-clear" @click="queue = []">{{ tt('清空') }}</span>
        </div>
        <div v-for="(q, i) in queue" :key="i" class="mp-queue-row">
          <span class="mp-queue-no mono">{{ q.woNo }}</span>
          <span class="mp-queue-line">{{ q.line > 0 ? '#' + q.line : tt('全部行') }}</span>
          <span class="mp-queue-del" @click="queue.splice(i, 1)">{{ tt('删除') }}</span>
        </div>
      </div>

      <div class="mp-row mp-gen">
        <el-checkbox v-model="autoPrint" size="large">{{ tt('生成后自动打印工单二维码') }}</el-checkbox>
        <el-button
          type="primary"
          size="large"
          :loading="genLoading"
          :disabled="!canGenerate"
          @click="generateBatch"
        >
          {{ queue.length > 1 ? tt('批量生成') + ' (' + queue.length + ')' : tt('生成') }}
        </el-button>
      </div>
    </section>

    <!-- ② 本次生成结果 -->
    <section v-if="results.length || failures.length" class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('生成结果') }}</span>
        <span class="mp-sec-ok" v-if="results.length">{{ tt('成功') }} {{ results.length }}</span>
        <span class="mp-sec-warn" v-if="failures.length">{{ tt('失败') }} {{ failures.length }}</span>
      </div>

      <div v-for="r in results" :key="'ok' + r.工单号 + r.工单行号" class="mp-res is-ok">
        <div class="mp-res-l1">
          <span class="mp-res-wo">{{ r.工单号 }}<i v-if="r.工单行号"> #{{ r.工单行号 }}</i></span>
          <span class="mp-res-tag">{{ r.重复 ? tt('已存在') : tt('已生成') }}</span>
        </div>
        <div class="mp-res-l2 mono">{{ r.领料单号 || '—' }}<template v-if="r.退料单号"> / {{ r.退料单号 }}</template></div>
        <el-button size="small" @click="openDoc(r.id)">{{ tt('去领料') }}</el-button>
      </div>

      <div v-for="(f, i) in failures" :key="'bad' + i" class="mp-res is-bad">
        <div class="mp-res-l1">
          <span class="mp-res-wo">{{ f.工单号 }}<i v-if="f.工单行号"> #{{ f.工单行号 }}</i></span>
          <span class="mp-res-tag is-bad">{{ tt('失败') }}</span>
        </div>
        <div class="mp-res-l2">{{ f.原因 }}</div>
      </div>
    </section>

    <!-- ③ 已生成(列表) -->
    <section class="mp-card">
      <div class="mp-sec">{{ tt('已生成的单') }}</div>
      <div class="mp-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('工单号 / 领料单号 / 产品名称')"
          size="large"
          clearable
          @keyup.enter="loadList"
        />
        <el-button size="large" :loading="listLoading" @click="loadList">{{ tt('查询') }}</el-button>
      </div>

      <div class="mp-grp-head" @click="openOpen = !openOpen">
        <span class="mp-grp-title">{{ tt('未完成') }}</span>
        <span class="mp-grp-num">{{ list.open.length }}</span>
        <span class="mp-grp-arrow" :class="{ open: openOpen }">›</span>
      </div>
      <template v-if="openOpen">
        <div v-if="!list.open.length" class="mp-empty">{{ tt('没有未完成的单据') }}</div>
        <div v-for="d in list.open" :key="d.id" class="mp-doc" @click="openDoc(d.id)">
          <div class="mp-doc-l1">
            <span class="mp-doc-no mono">{{ d.领料单号 || tt('未生成') }}</span>
            <span class="mp-doc-prog">{{ d.已领项数 || 0 }}/{{ d.物料项数 || 0 }}</span>
          </div>
          <div class="mp-doc-l2">
            <span>{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mp-doc-p">{{ d.产品名称 || d.产品编号 || '—' }}</span>
          </div>
        </div>
      </template>

      <div class="mp-grp-head" @click="openDone = !openDone">
        <span class="mp-grp-title">{{ tt('已完成') }}</span>
        <span class="mp-grp-num">{{ list.done.length }}</span>
        <span class="mp-grp-arrow" :class="{ open: openDone }">›</span>
      </div>
      <template v-if="openDone">
        <div v-if="!list.done.length" class="mp-empty">{{ tt('还没有已完成的单据') }}</div>
        <div v-for="d in list.done" :key="d.id" class="mp-doc is-done" @click="openDoc(d.id)">
          <div class="mp-doc-l1">
            <span class="mp-doc-no mono">{{ d.领料单号 || '—' }}</span>
            <span class="mp-doc-prog">{{ d.已领项数 || 0 }}/{{ d.物料项数 || 0 }}</span>
          </div>
          <div class="mp-doc-l2">
            <span>{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
            <span class="mp-doc-p">{{ d.产品名称 || d.产品编号 || '—' }}</span>
          </div>
        </div>
      </template>
    </section>

    <!-- 引导:生完去领料面板 -->
    <div class="mp-foot">
      <el-button size="large" @click="clearAll">{{ tt('清空结果') }}</el-button>
      <el-button type="primary" size="large" @click="goPick">{{ tt('去生产领料') }}</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { parseWorkOrderCode } from '@/business/scanCode'
import { printWoQr } from '@/business/print-formats'
import { queueToPrintStation } from '@/business/printStation'

const router = useRouter()

const woInput = ref(null)
const woText = ref('')
const queue = ref([])
const autoPrint = ref(true)
const genLoading = ref(false)
const results = ref([])
const failures = ref([])
const keyword = ref('')
const listLoading = ref(false)
const errText = ref('')
const okText = ref('')
const openOpen = ref(true)
const openDone = ref(false)
const list = reactive({ open: [], done: [], openTotal: 0, doneTotal: 0 })

const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

const canGenerate = computed(() => queue.value.length > 0 && !genLoading.value)

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return e?.response?.data?.message || e?.message || '' }

function goPick() { router.push('/panelx/list/MOBILE_PICK') }
function openDoc(id) { if (id) router.push({ path: '/panelx/list/MOBILE_PICK/doc', query: { id: String(id) } }) }

function clearAll() {
  results.value = []
  failures.value = []
  clearMsg()
}

onMounted(() => {
  nextTick(() => woInput.value?.focus?.())
  window.__yjScanResult = (code, ok) => { if (ok && code) applyScan(code) }
  loadList()
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

/** 扫到的工单码 → 解析工单号 + 行号 → 进队列 */
function applyScan(code) {
  const p = parseWorkOrderCode(String(code || '').trim())
  if (!p.ok) { errText.value = tt('这个码里没有工单号'); return }
  woText.value = p.wo
  addQueue(p.line)
}

/**
 * 加入待生成队列。
 *
 * 同一工单行重复扫只留一条(现场扫重了不该开两次)——
 * 真正的防重复还有服务端唯一约束兜底(台账 UX_wo_pick_doc_wo)。
 */
function addQueue(line) {
  const woNo = String(woText.value || '').trim()
  clearMsg()
  if (!woNo) { errText.value = tt('请先扫描或输入工单号'); return }
  const ln = Number(line) || 0
  const dup = queue.value.some((q) => q.woNo === woNo && q.line === ln)
  if (dup) {
    // 重复扫同一张:不报错,但提示一声(现场常连续扫,静默会让人以为没扫上)
    okText.value = tt('这张工单已在待生成列表里')
  } else {
    queue.value.push({ woNo, line: ln })
  }
  woText.value = ''
  nextTick(() => woInput.value?.focus?.())
}

/** 批量生成:逐张提交,成功的进结果列表,失败的带原因留在失败列表 */
async function generateBatch() {
  if (!canGenerate.value) return
  genLoading.value = true
  clearMsg()
  results.value = []
  failures.value = []
  try {
    const res = await request.post('/px/mobilePick/create/batch', {
      items: queue.value.map((q) => ({ woNo: q.woNo, line: q.line })),
      // 打印载荷由后端给;这里传 true 表示"要自动打印"
      打印: autoPrint.value,
    })
    const d = res.data?.data || res.data || {}
    results.value = Array.isArray(d.成功) ? d.成功 : []
    failures.value = Array.isArray(d.失败) ? d.失败 : []
    queue.value = []

    if (results.value.length) {
      okText.value = `${tt('成功')} ${d.成功数 || results.value.length}${(d.失败数 || 0) > 0 ? ' · ' + tt('失败') + ' ' + d.失败数 : ''}`
      if (autoPrint.value) await autoPrintAll()
    } else if (failures.value.length) {
      errText.value = `${tt('全部失败')}:${failures.value[0].原因 || ''}`
    }
    await loadList()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('生成失败')
  } finally {
    genLoading.value = false
  }
}

/**
 * 生单后自动打印(用户口径「在生成生产领料单的时候自动打印一次」)。
 *
 * 优先发给「自动打印」站点电脑;没有在线站点就退回本机打印层。
 * **逐张打印、失败不阻断** —— 单已经建好了,现场可以在单据里重打。
 */
async function autoPrintAll() {
  for (const r of results.value) {
    if (r.重复 || !r.打印) continue
    try {
      const queued = await queueToPrintStation({ ...r.打印, 来源: 'mobilePick.create' })
      if (!(queued && queued.online)) await printWoQr(r.打印)
    } catch {
      // 打印失败只在控制台账:生单本身已成功
      console.warn('工单二维码自动打印失败(单据已生成,可在单据里重打)')
    }
  }
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await request.get('/px/mobilePick/create/list', {
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
</script>

<style scoped>
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
.mp-title { font-size: 16px; font-weight: 600; }
.mp-head { display: flex; flex-direction: column; min-width: 0; }
.mp-base {
  max-width: 42vw; font-size: 11px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mp-sub { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }

.mp-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mp-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}
.mp-sec-ok { font-size: 11px; font-weight: 400; color: var(--el-color-success); }
.mp-sec-warn { font-size: 11px; font-weight: 400; color: var(--el-color-danger); }

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row :deep(.el-input) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }

.mp-gen { margin-top: 10px; flex-wrap: wrap; }
.mp-gen :deep(.el-button) { flex: 0 0 auto; min-width: 120px; }

.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

/* 待生成队列 */
.mp-queue { margin-top: 10px; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-queue-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 0 4px;
  font-size: 12px; color: var(--el-text-color-secondary);
}
.mp-queue-clear { margin-left: auto; color: var(--el-color-danger); cursor: pointer; }
.mp-queue-row { display: flex; align-items: center; gap: 8px; min-height: 40px; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mp-queue-row:last-child { border-bottom: 0; }
.mp-queue-no { flex: 1; min-width: 0; font-size: 13px; }
.mp-queue-line { flex: none; font-size: 12px; color: var(--el-text-color-secondary); }
.mp-queue-del { flex: none; padding: 0 4px; font-size: 13px; color: var(--el-color-danger); cursor: pointer; }

/* 生成结果 */
.mp-res {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px;
  padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter);
}
.mp-res:first-of-type { border-top: 0; }
.mp-res-l1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mp-res-wo { font-size: 14px; font-weight: 600; }
.mp-res-wo i { font-style: normal; color: var(--el-text-color-secondary); font-weight: 400; }
.mp-res-tag { padding: 0 6px; border-radius: 4px; font-size: 11px; background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.mp-res-tag.is-bad { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.mp-res-l2 { font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; grid-column: 1; }
.mp-res.is-bad .mp-res-l2 { color: var(--el-color-danger); }
.mp-res :deep(.el-button) { grid-column: 2; grid-row: 1 / span 2; align-self: center; }

/* 分组 + 单据行 */
.mp-grp-head { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; user-select: none; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-grp-title { font-size: 14px; font-weight: 600; }
.mp-grp-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px;
}
.mp-grp-arrow {
  margin-left: auto; font-size: 18px; line-height: 1; color: var(--el-text-color-secondary);
  transform: rotate(90deg); transition: transform .15s ease;
}
.mp-grp-arrow.open { transform: rotate(-90deg); }

.mp-doc { padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter); cursor: pointer; }
.mp-doc:active { background: var(--el-fill-color-lighter); }
.mp-doc.is-done { opacity: .82; }
.mp-doc-l1 { display: flex; align-items: baseline; gap: 8px; }
.mp-doc-no { font-size: 14px; font-weight: 600; }
.mp-doc-prog { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mp-doc-l2 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mp-doc-l2 i { font-style: normal; color: var(--el-text-color-secondary); }
.mp-doc-p { flex: 1; min-width: 0; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }

.mp-err, .mp-ok { margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; }
.mp-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mp-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

.mp-foot {
  display: flex; gap: 10px; margin: 12px 12px 0; padding: 10px 12px;
  margin-top: auto;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { flex: 1; height: 46px; margin: 0; }

/* 电脑端:左边开单、右边已生成的单(开单工作台主要在电脑上用) */
@media (min-width: 900px) {
  .mp { display: grid; grid-template-columns: minmax(0, 480px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mp-top, .mp-err, .mp-ok, .mp-foot { grid-column: 1 / -1; }
  .mp-card { margin: 0 0 12px; }
}
</style>
