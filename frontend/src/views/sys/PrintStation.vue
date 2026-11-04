<!--
  PrintStation.vue — 自动打印(打印站点配置页,电脑上打开),2026-10-30

  【用户口径】(原话)
  「关于打印还有单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数并且设置成打开,
    然后在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」
  二次确认:「需要做个设置(来配置需要用到打印的电脑,实现连接的电脑自动打印)」。

  【本页做什么】
   ① **选本机打印机** + 打开「自动打印」开关 —— 开关存服务端(全局),打印机名存**本机 localStorage**
      (一个账号可能登录多台电脑,打印机是每台各自的);
   ② 开着这一页时每 15 秒轮询打印队列,拿到任务就**交给本地打印代理静默出纸**;
   ③ 没有代理时降级为浏览器打印层 —— 但那会弹对话框,不是"自动",页面上会写清楚。

  【为什么必须有本地代理才能真正"自动"】
  浏览器标准 `window.print()` **一定**弹打印对话框,没有任何参数能让它静默。
  真正的零点击出纸只有本机程序调系统打印才能做到 —— 即 `tools/printing/print-agent.ps1`
  (在打印电脑上装一次、设成开机自启)。本页只负责"取任务 + 调用它",不假装浏览器能静默。

  【布局说明】
  这一页**平时是开在那台电脑上的常驻页**,所以做成"状态一眼可见 + 配置折叠"的形态:
  顶部大标题 + 开关 + 在线/队列;下面折叠的配置区;再下面最近出纸记录。
-->
<template>
  <div class="ps">
    <div class="ps-top">
      <div class="ps-head">
        <span class="ps-title">{{ tt('自动打印') }}</span>
        <span class="ps-sub">{{ tt('在这台电脑上打开,手机打印时会自动出纸') }}</span>
      </div>
      <span class="ps-badge" :class="statusClass">{{ statusText }}</span>
    </div>

    <div v-if="errText" class="ps-err">{{ errText }}</div>

    <!-- 开关 -->
    <section class="ps-card">
      <div class="ps-row">
        <div class="ps-row-main">
          <div class="ps-row-title">{{ tt('启用自动打印') }}</div>
          <div class="ps-row-sub">{{ tt('打开后,手机端点打印会发到这台电脑') }}</div>
        </div>
        <el-switch
          :model-value="autoEnabled"
          :loading="savingCfg"
          size="large"
          @change="toggleAuto"
        />
      </div>

      <div class="ps-row">
        <div class="ps-row-main">
          <div class="ps-row-title">{{ tt('站点名称') }}</div>
          <div class="ps-row-sub">{{ tt('手机端看到的就是这个名字') }}</div>
        </div>
        <el-input
          v-model="stationName"
          class="ps-name"
          :placeholder="tt('例如:一车间打印点')"
          size="large"
          @change="saveStationName"
        />
      </div>

      <div class="ps-row">
        <div class="ps-row-main">
          <div class="ps-row-title">{{ tt('打印机') }}</div>
          <div class="ps-row-sub">{{ tt('本机配置,只在这台电脑生效') }}</div>
        </div>
        <el-input
          v-model="printerName"
          class="ps-name"
          :placeholder="tt('留空 = 系统默认打印机')"
          size="large"
          @change="savePrinter"
        />
      </div>

      <!-- 输出方式 / PDF 目录(2026-11-01):这两项改的是**代理的运行参数**,
           不是本机 localStorage —— 因为真正决定"出纸还是落文件"的是代理。 -->
      <div class="ps-row">
        <div class="ps-row-main">
          <div class="ps-row-title">{{ tt('输出方式') }}</div>
          <div class="ps-row-sub">{{ tt('自动 = 有打印机就出纸,打不出来自动存 PDF') }}</div>
        </div>
        <el-select
          v-model="modeSel"
          class="ps-name"
          size="large"
          :disabled="!agentOk"
          @change="saveAgentConfig"
        >
          <el-option value="Auto" :label="tt('自动(推荐)')" />
          <el-option value="Printer" :label="tt('直接打印')" />
          <el-option value="Pdf" :label="tt('只生成 PDF')" />
        </el-select>
      </div>

      <div class="ps-row">
        <div class="ps-row-main">
          <div class="ps-row-title">{{ tt('PDF 存放目录') }}</div>
          <div class="ps-row-sub">{{ tt('仅「自动/只生成 PDF」时使用;留空 = 代理默认 print-out') }}</div>
        </div>
        <el-input
          v-model="pdfDirInput"
          class="ps-name"
          :placeholder="tt('如 D:\\MES-PDF')"
          size="large"
          :disabled="!agentOk"
          @change="saveAgentConfig"
        />
      </div>
    </section>

    <!-- 连接状态 + 代理 -->
    <section class="ps-card">
      <div class="ps-sec">{{ tt('连接状态') }}</div>
      <div class="ps-kv"><span>{{ tt('队列待打印') }}</span><b class="num">{{ queueSize }}</b></div>
      <div class="ps-kv"><span>{{ tt('最近心跳') }}</span><b>{{ state.lastHeartbeat || '—' }}</b></div>
      <div class="ps-kv">
        <span>{{ tt('打印代理') }}</span>
        <!-- 2026-11-03:公网部署下这一项**必然显示未连接** —— 浏览器禁止公网页面访问 127.0.0.1。
             真正判"能不能打"的是上面的「最近心跳」;这里改成中性说明,不再当成故障。 -->
        <b :class="agentOk ? 'ok' : 'muted'">
          {{ agentOk ? tt('已连接(本机页面可直接控制)') : tt('由打印电脑自行取任务,不受本页面控制') }}
        </b>
      </div>
      <!-- 代理模式(2026-11-01):auto=有打印机就出纸/否则落PDF · printer=只出纸 · pdf=只落文件 -->
      <div class="ps-kv">
        <span>{{ tt('代理出纸方式') }}</span>
        <b :class="agentMode === 'printer' ? 'ok' : 'warn'">
          {{ agentMode === 'pdf' ? tt('只生成 PDF 文件') : (agentMode === 'auto' ? tt('自动(有打印机出纸,否则存 PDF)') : tt('直接打印')) }}
        </b>
      </div>
      <div v-if="agentMode !== 'printer'" class="ps-kv">
        <span>{{ tt('PDF 存放目录') }}</span>
        <b class="mono">{{ agentPdfDir || '—' }}</b>
      </div>
      <div v-if="lastPdfPath" class="ps-kv">
        <span>{{ tt('最近生成') }}</span>
        <b class="mono">{{ lastPdfPath }}</b>
      </div>

      <div class="ps-agent">
        <div class="ps-agent-title">{{ tt('本地打印代理') }}</div>
        <div class="ps-agent-body">
          <p>{{ tt('浏览器标准打印一定会弹出打印对话框,做不到「零点击」。真正的自动出纸需要本机代理程序:') }}</p>
          <ol>
            <li>{{ tt('无打印机时:print-agent.ps1 -Mode Pdf(只生成 PDF 文件,不出纸)') }}</li>
            <li>{{ tt('有打印机时:print-agent.ps1 -Mode Printer(直接打系统打印机)') }}</li>
            <li>{{ tt('加 -Install 参数跑一次即可设为开机自启') }}</li>
            <li>{{ tt('开着本页,代理连上后状态会变成「已连接」') }}</li>
          </ol>
          <p class="ps-agent-note">
            {{ tt('没有代理时,打印会降级为浏览器打印(需要人点一次对话框)。') }}
          </p>
        </div>
      </div>
    </section>

    <!-- 最近出纸 -->
    <section class="ps-card">
      <div class="ps-sec">
        <span>{{ tt('最近出纸') }}</span>
        <span class="ps-sec-num">{{ recent.length }}</span>
      </div>
      <div v-if="!recent.length" class="ps-empty">{{ tt('还没有打印记录') }}</div>
      <div v-for="(r, i) in recent" :key="i" class="ps-line">
        <span class="ps-line-t">{{ r.时间 }}</span>
        <span class="ps-line-n">{{ r.工单号 || '—' }}<i v-if="r.工单行号"> #{{ r.工单行号 }}</i></span>
        <span class="ps-line-s" :class="{ bad: r.来源 === '失败' }">{{ r.来源 || '已出纸' }}</span>
      </div>
    </section>

    <!-- 降级打印:浏览器打印层(代理没连上时的兜底) -->
    <div v-if="fallbackTask" class="ps-fallback">
      <span>{{ tt('代理未连接:有 1 张单要打印') }} · {{ fallbackTask.工单号 }}</span>
      <el-button size="small" @click="printFallback">{{ tt('用浏览器打印') }}</el-button>
      <el-button size="small" text @click="fallbackTask = null">{{ tt('忽略') }}</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { fetchPendingTask, ackTask, fetchStationState, saveStationConfig } from '@/business/printStation'
import { printWoQr } from '@/business/print-formats'

/** localStorage 键:打印机与站点配置**绑本机**(不绑账号 —— 一个账号可能登录多台电脑) */
const LS_PRINTER = 'yj.printStation.printer'
const LS_STATION = 'yj.printStation.stationName'
/** 本地代理的探活地址(代理默认监听本机 18777,见 tools/printing/print-agent.ps1) */
const AGENT_URL = 'http://127.0.0.1:18777/health'
/** 轮询间隔:15 秒(手机端"有没有在线打印电脑"按 90 秒心跳判定,3 个周期容错) */
const POLL_MS = 15000

const autoEnabled = ref(false)
const stationName = ref(localStorage.getItem(LS_STATION) || '')
const printerName = ref(localStorage.getItem(LS_PRINTER) || '')
const queueSize = ref(0)
const state = ref({})
const agentOk = ref(false)
/**
 * 最近一次生成的 PDF 路径(2026-11-01)。
 * 代理跑在 -Mode Pdf 时不出纸、只落文件,这里把路径显出来,现场才知道去哪儿拿。
 */
const lastPdfPath = ref('')
/** 代理的出纸方式:auto=自动兜底 / printer=直接打印 / pdf=只落 PDF(来自代理 /health) */
const agentMode = ref('printer')
/** 代理的 PDF 输出目录(来自代理 /health) */
const agentPdfDir = ref('')
/** 页面上选择的输出方式与 PDF 目录(保存时下发给代理,不存 localStorage) */
const modeSel = ref('Auto')
const pdfDirInput = ref('')
/** 用户是否手工动过这两个控件 —— 动过就别在轮询时被代理值覆盖 */
let modeSelTouched = false
let pdfDirTouched = false
const recent = ref([])
const errText = ref('')
const savingCfg = ref(false)
const fallbackTask = ref(null)

let timer = null
let polling = false

/**
 * 顶部状态徽标(2026-11-03 重写)。
 *
 * <p>🔴 关键:系统上服务器后,**页面在公网 HTTP 上时浏览器一律禁止访问 127.0.0.1**
 * (非安全上下文 → loopback),所以 `agentOk`(本机代理探测)**必然是 false**。
 * 以前徽标只认 agentOk ⇒ 永远挂「代理未连接」的警告,其实打印一切正常,
 * 白白让人以为坏了。
 *
 * <p>改用**服务端心跳**(state.online)判断:那才代表"真有一台打印电脑在取任务"。
 */
const statusClass = computed(() => {
  if (!autoEnabled.value) return 'off'
  if (state.value.online || agentOk.value) return 'on'
  return 'warn'
})
const statusText = computed(() => {
  if (!autoEnabled.value) return tt('未启用')
  if (state.value.online || agentOk.value) return tt('打印中就绪')
  return tt('没有在线的打印电脑')
})

function clearErr() { errText.value = '' }
function errMsgOf(e) { return e?.response?.data?.message || e?.message || '' }

onMounted(async () => {
  await refreshState()
  await probeAgent()
  nextTickLoop()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  timer = null
})

function nextTickLoop() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(loopOnce, POLL_MS)
}

/** 一轮轮询:探代理 + 取任务 + 有任务就打印 + 回报 */
async function loopOnce() {
  if (polling) { nextTickLoop(); return }
  polling = true
  try {
    await probeAgent()
    if (autoEnabled.value) {
      const d = await fetchPendingTask(stationName.value || undefined)
      const task = d?.task || null
      queueSize.value = Number(d?.queueSize) || 0
      if (task) await runTask(task)
      else await refreshState()
    }
  } catch (e) {
    // 网络抖动不算错:下一轮会重试;只有持续失败才值得让用户看到
    if (e?.response?.status === 403) errText.value = tt('没有自动打印的权限:请联系管理员在组织架构里授权')
  } finally {
    polling = false
    nextTickLoop()
  }
}

/**
 * 探本地代理:连得上 = 真正的静默输出可用。
 * 探测失败不弹错(大多数电脑上还没装,属于常态)。
 *
 * 2026-11-01:同时读回代理的**出纸方式**(printer/pdf)与 PDF 目录 ——
 * 没打印机时跑 -Mode Pdf,页面要能一眼看出"现在是落文件、不是出纸"。
 */
async function probeAgent() {
  try {
    const r = await fetch(AGENT_URL, { method: 'GET', cache: 'no-store' })
    agentOk.value = r.ok
    if (r.ok) {
      try {
        const j = await r.json()
        const m = String(j?.mode || '').toLowerCase()
        agentMode.value = m === 'pdf' ? 'pdf' : (m === 'auto' ? 'auto' : 'printer')
        agentPdfDir.value = String(j?.pdfDir || '')
        // 首次连上(或用户没动过)时,用代理的当前值回填页面控件
        if (!modeSelTouched) modeSel.value = String(j?.mode || 'Auto')
        if (!pdfDirTouched) pdfDirInput.value = agentPdfDir.value
      } catch { /* 老版本代理没有这些字段 */ }
    }
  } catch {
    agentOk.value = false
  }
}

/** 打印一张任务:有代理走代理(静默),没代理降级(浏览器对话框,需人点) */
async function runTask(task) {
  if (agentOk.value) {
    try {
      const r = await fetch('http://127.0.0.1:18777/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, printer: printerName.value || '' }),
      })
      if (!r.ok) throw new Error(`代理返回 ${r.status}`)
      // 代理可能处于两种模式(2026-11-01):
      //   printer = 真出纸;pdf = 落一个 PDF 文件(暂时没打印机时用)。
      // 文案要能看出来,否则现场会以为"打了但没出纸"。
      let payload = {}
      try { payload = await r.json() } catch { /* 老版本代理不返回 JSON 体 */ }
      await ackTask({ taskId: task.id, ok: true, printer: printerName.value, ...pickAck(task) })
      if (payload && payload.mode === 'pdf') {
        const name = String(payload.pdfPath || '').split(/[\\/]/).pop() || 'PDF'
        lastPdfPath.value = payload.pdfPath || ''
        pushRecent(task, tt('已生成 PDF') + ':' + name)
      } else {
        pushRecent(task, tt('已出纸'))
      }
      return
    } catch (e) {
      // 代理中途挂了 ⇒ 降级
      agentOk.value = false
      errText.value = tt('打印代理出错,已降级为浏览器打印') + ':' + (e?.message || e)
    }
  }
  fallbackTask.value = task
}

function pickAck(task) {
  return { 标题: task.标题, 工单号: task.工单号, 工单行号: task.工单行号, 发起人: task.发起人 }
}

async function printFallback() {
  const task = fallbackTask.value
  if (!task) return
  try {
    const ok = await printWoQr(task)
    await ackTask({ taskId: task.id, ok: !!ok, printer: printerName.value || '', ...pickAck(task) })
    pushRecent(task, ok ? '浏览器打印' : '失败')
    fallbackTask.value = null
  } catch (e) {
    errText.value = errMsgOf(e) || tt('打印失败')
  }
}

function pushRecent(task, how) {
  recent.value = [{
    时间: new Date().toLocaleString(), 工单号: task.工单号, 工单行号: task.工单行号, 来源: how,
  }, ...recent.value].slice(0, 20)
}

async function refreshState() {
  try {
    const d = await fetchStationState()
    state.value = d || {}
    autoEnabled.value = !!d?.autoEnabled
    queueSize.value = Number(d?.queueSize) || 0
    if (Array.isArray(d?.recent) && d.recent.length) recent.value = d.recent
  } catch (e) {
    if (e?.response?.status === 403) errText.value = tt('没有自动打印的权限:请联系管理员在组织架构里授权')
  }
}

/** 开关自动打印(写服务端全局参数) */
async function toggleAuto(v) {
  savingCfg.value = true
  clearErr()
  try {
    const d = await saveStationConfig({ autoEnabled: !!v, stationName: stationName.value })
    autoEnabled.value = !!d?.autoEnabled
    ElMessage.success(v ? tt('已开启自动打印') : tt('已关闭自动打印'))
  } catch (e) {
    errText.value = errMsgOf(e) || tt('保存失败')
    await refreshState()   // 回读真实状态,别让开关停在假的"已开"
  } finally {
    savingCfg.value = false
  }
}

async function saveStationName() {
  localStorage.setItem(LS_STATION, stationName.value || '')
  try {
    await saveStationConfig({ autoEnabled: autoEnabled.value, stationName: stationName.value })
  } catch (e) {
    errText.value = errMsgOf(e) || tt('保存失败')
  }
}

/** 打印机名只存本机:换电脑不该带着别的电脑的打印机名走 */
function savePrinter() {
  localStorage.setItem(LS_PRINTER, printerName.value || '')
  ElMessage.success(tt('已保存到本机'))
}

/**
 * 保存「输出方式 / PDF 目录」到**本地代理**(2026-11-01)。
 *
 * 为什么存代理而不是 localStorage:真正决定"出纸还是落文件、落到哪个目录"的是代理进程,
 * 网页只是它的遥控器。存 localStorage 会造成"页面显示已改、实际没变"的假象。
 * 代理没连上时这两项置灰 —— 改不了就别让人改。
 */
async function saveAgentConfig() {
  if (!agentOk.value) return
  modeSelTouched = true
  pdfDirTouched = true
  try {
    const r = await fetch('http://127.0.0.1:18777/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: modeSel.value, pdfDir: pdfDirInput.value || '' }),
    })
    if (!r.ok) throw new Error('代理返回 ' + r.status)
    const j = await r.json()
    agentMode.value = String(j?.mode || '').toLowerCase() === 'pdf' ? 'pdf' : (String(j?.mode || '').toLowerCase() === 'auto' ? 'auto' : 'printer')
    agentPdfDir.value = String(j?.pdfDir || '')
    pdfDirInput.value = agentPdfDir.value
    modeSel.value = String(j?.mode || 'Auto')
    ElMessage.success(tt('已保存到打印代理'))
  } catch (e) {
    ElMessage.error(tt('保存失败') + ':' + (e?.message || e))
  }
}
</script>

<style scoped>
.ps {
  box-sizing: border-box;
  max-width: 860px;
  margin: 0 auto;
  padding: 16px 16px 32px;
}
.ps * { box-sizing: border-box; }

.ps-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.ps-head { display: flex; flex-direction: column; min-width: 0; }
.ps-title { font-size: 20px; font-weight: 600; }
.ps-sub { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); }
.ps-badge {
  margin-left: auto; padding: 4px 12px; border-radius: 12px; font-size: 13px; white-space: nowrap;
}
.ps-badge.on { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.ps-badge.warn { background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2); }
.ps-badge.off { background: var(--el-fill-color); color: var(--el-text-color-secondary); }

.ps-card {
  margin-bottom: 14px; padding: 16px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.ps-sec { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.ps-sec-num {
  margin-left: 8px; padding: 0 6px; border-radius: 10px; font-size: 12px; font-weight: 400;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary);
}

.ps-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0; border-bottom: 1px dashed var(--el-border-color-lighter);
}
.ps-row:last-child { border-bottom: 0; }
.ps-row-main { flex: 1; min-width: 0; }
.ps-row-title { font-size: 14px; }
.ps-row-sub { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); }
.ps-name { flex: none; width: 260px; }

.ps-kv { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; font-size: 13px; }
.ps-kv > span { width: 88px; flex: none; color: var(--el-text-color-secondary); }
.ps-kv > b { font-weight: 500; }
.ps-kv > b.ok { color: var(--el-color-success); }
.ps-kv > b.warn { color: var(--el-color-warning); }
.ps-kv > b.muted { color: var(--el-text-color-secondary); font-weight: 400; }

.ps-agent {
  margin-top: 12px; padding: 12px; border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.ps-agent-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.ps-agent-body { font-size: 12px; line-height: 1.7; color: var(--el-text-color-regular); }
.ps-agent-body ol { margin: 4px 0; padding-left: 20px; }
.ps-agent-note { color: var(--el-color-warning-dark-2); }

.ps-line { display: flex; align-items: baseline; gap: 10px; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed var(--el-border-color-lighter); }
.ps-line:last-child { border-bottom: 0; }
.ps-line-t { flex: none; width: 150px; color: var(--el-text-color-secondary); font-size: 12px; }
.ps-line-n { flex: 1; min-width: 0; }
.ps-line-n i { font-style: normal; color: var(--el-text-color-secondary); }
.ps-line-s { flex: none; font-size: 12px; color: var(--el-color-success); }
.ps-line-s.bad { color: var(--el-color-danger); }

.ps-empty { padding: 16px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.num { font-variant-numeric: tabular-nums; }

.ps-err {
  margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; font-size: 13px;
  background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2);
}

.ps-fallback {
  position: sticky; bottom: 0;
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: var(--el-color-warning-light-9); border-radius: 8px; font-size: 13px;
}
.ps-fallback span { flex: 1; min-width: 0; }
</style>
