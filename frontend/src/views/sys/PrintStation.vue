<!--
  PrintStation.vue — 自动打印(打印电脑配置页,2026-10-30 建 / 2026-11-04 改按电脑+按类型)

  【用户口径】
  建面板时(原话):
  「关于打印还有单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数并且设置成打开,
    然后在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」
  二次确认:「需要做个设置(来配置需要用到打印的电脑,实现连接的电脑自动打印)」。

  2026-11-04 报障(触发本次改造):
  「现在的自动打印有问题,我是想要设置的电脑开启自动打印,没有设置的电脑就不开启,
    但是在服务器上开启是固定的。能不能在自动打印的面版加个参数来限定电脑。
    还有我想加个勾选打印类型的。现在自动打印只有生产领料单。但如果后面也有多个电脑
    每个电脑又不同打印要求,需要面版能够勾选打印的需求报表。」

  【改前为什么"没设置的电脑也会打"】
  旧版只有一个**全局**开关(存在服务端)+ 一条**共享**队列:任何一台电脑只要在轮询
  (打印代理或本页),就取走队列里的任务 —— 谁先轮到谁打,于是没配置过的电脑也抢着出纸;
  而且只能"全打/全不打",表达不了"这台只打领料单、那台只打报工单"。

  【现在这一页是什么】
  一张**打印电脑清单** —— 每台跑着打印代理的电脑是一行(站点名 = 代理的 -Station),
  每行自己一个开关 + 一组打印类型勾选:
   · 开关打开 ⇒ 这台电脑才会收到派单;没设置过的电脑默认关闭(用户口径:没设置的不开);
   · 勾了哪个类型 ⇒ 只收那个类型的任务;同一类型多台都勾了,那几台都会打印;
   · 服务端总闸固定常开(用户口径「在服务器上开启是固定的」),这里只作状态展示。

  【谁去取任务】
  不是本页 —— 是**本机打印代理**(`tools/printing/print-agent.ps1`),它每 4 秒自己
  登录服务器拉 `/pending` 并静默出纸(2026-11-03 起的架构:页面开在公网地址时浏览器
  禁止它访问本机代理,所以取任务这件事只能由代理自己做)。本页只负责"告诉服务器
  哪台电脑该打、打哪些类型",以及展示代理状态。

  【配置存哪】
  服务端 `yj_app_setting` 的 `print.station.<站点名>.enabled/.types` —— 代理在跑、
  页面可能没开,只存浏览器 localStorage 的话服务端一重启就丢,现场表现是"昨天还好好的,
  今天不打了",极难排查。
-->
<template>
  <div class="ps">
    <div class="ps-top">
      <div class="ps-head">
        <span class="ps-title">{{ tt('自动打印') }}</span>
        <span class="ps-sub">{{ tt('哪台电脑打什么报表,在这里勾选;没勾的电脑不会出纸') }}</span>
      </div>
      <span class="ps-badge" :class="statusClass">{{ statusText }}</span>
    </div>

    <div v-if="errText" class="ps-err">{{ errText }}</div>

    <!-- ① 打印电脑清单(本页的主体:按电脑限定 + 按类型勾选) -->
    <section class="ps-card">
      <div class="ps-sec">
        <span>{{ tt('打印电脑') }}</span>
        <span class="ps-sec-num">{{ stationRows.length }}</span>
        <span class="ps-sec-note">{{ tt('站点名 = 安装打印代理时填的 -Station') }}</span>
        <el-button class="ps-refresh" size="small" :loading="loading" @click="refreshState">{{ tt('刷新') }}</el-button>
      </div>

      <div class="ps-kv">
        <span>{{ tt('服务端总闸') }}</span>
        <b class="ok">{{ tt('常开(由服务器固定,不需要在这里开)') }}</b>
      </div>

      <div v-if="!stationRows.length" class="ps-empty">
        {{ tt('还没有打印电脑报上来:请确认那台电脑的打印代理在运行(每 4 秒会自己拉一次任务)') }}
      </div>

      <div v-for="s in stationRows" :key="s.name" class="ps-station" :class="{ off: !s.online }">
        <div class="ps-station-head">
          <span class="ps-dot" :class="{ on: s.online && s.enabled }"></span>
          <span class="ps-station-name">{{ s.name }}</span>
          <span class="ps-station-tag" :class="{ on: s.online, warn: !s.enabled }">
            {{ s.online ? tt('在线') : tt('离线') }}
          </span>
          <span v-if="!s.enabled" class="ps-station-tag warn">{{ tt('未启用') }}</span>
          <el-switch
            class="ps-station-switch"
            :model-value="s.enabled"
            :loading="savingName === s.name"
            @change="(v) => saveStation(s, { enabled: !!v })"
          />
        </div>
        <!-- 认机信息(2026-11-05 用户问「怎么才能知道这个是哪一台电脑」):
             站点名 + 最近心跳 + 来源 IP。站点名就是那台电脑安装代理时填的名字(默认计算机名)。 -->
        <div class="ps-station-meta">
          <span v-if="s.lastSeen">{{ tt('最近心跳') }} {{ s.lastSeen }}</span>
          <span v-else class="ps-meta-warn">{{ tt('这台电脑还没有连过:代理没装或没启动') }}</span>
          <span v-if="s.ip">· {{ tt('来源 IP') }} <b class="mono">{{ s.ip }}</b></span>
        </div>
        <div class="ps-station-body">
          <!-- 纸张(2026-11-05 用户口径「能不能设定打印的纸张大小(如 A4 或 A5),但是表格实际占用大小不变」):
               只换纸、不缩放 —— 代理画的永远是 210×148mm 的内容,选 A4 只是纸更大、多出来是空白。 -->
          <div class="ps-station-line">
            <span class="ps-station-label">{{ tt('纸张') }}</span>
            <el-select
              :model-value="s.paper || 'A5'"
              size="small"
              class="ps-paper"
              :loading="savingName === s.name"
              @change="(v) => saveStation(s, { paper: v })"
            >
              <el-option value="A5" :label="tt('A5 · 中一刀 210×148.5 横')" />
              <el-option value="A4" :label="tt('A4 横 297×210(内容大小不变)')" />
            </el-select>
          </div>
          <div class="ps-station-label">{{ tt('打印类型') }}</div>
          <el-checkbox-group
            :model-value="s.types || []"
            class="ps-types"
            @change="(v) => saveStation(s, { types: v })"
          >
            <el-checkbox v-for="t in typeOptions" :key="t.code" :value="t.code">{{ tt(t.label) }}</el-checkbox>
          </el-checkbox-group>
          <div v-if="s.enabled && !(s.types || []).length" class="ps-hint ps-hint-warn">
            {{ tt('开关打开了,但一个打印类型都没勾 —— 这台电脑不会收到任何打印任务') }}
          </div>
        </div>
      </div>

      <div class="ps-hint">
        {{ tt('勾选的类型才会发到这台电脑;同一类型多台电脑都勾了,那几台都会打印') }}
      </div>
      <div class="ps-hint">
        {{ tt('离线 = 90 秒内没收到那台电脑的心跳(电脑关机 / 打印代理没运行 / 代理不是带 -Server 启动的);离线时不派单,手机端会退回自己弹打印') }}
      </div>

      <!-- 新增打印电脑(2026-11-05 用户问「怎么才能增加电脑」):
           列表是代理"自己报上来"的,所以新增 = 先把名字登记好,再去那台电脑装代理用同一个名字。 -->
      <div class="ps-add">
        <div class="ps-add-title">{{ tt('新增打印电脑') }}</div>
        <div class="ps-add-row">
          <el-input
            v-model="newName"
            size="large"
            :placeholder="tt('填那台电脑的站点名(默认就是计算机名)')"
            clearable
            @keyup.enter="addStation"
          />
          <el-button size="large" :loading="adding" :disabled="!newName.trim()" @click="addStation">
            {{ tt('添加') }}
          </el-button>
        </div>
        <div class="ps-hint">
          {{ tt('在那台电脑上双击「安装.bat」装打印代理,「这台打印机的名字」填成同一个名字(回车 = 计算机名);代理连上后这一行会自动变成在线,再打开开关、勾上要打的报表。') }}
        </div>
      </div>
    </section>

    <!-- ② 本机打印代理(运行参数;代理没连上时置灰) -->
    <section class="ps-card">
      <div class="ps-sec">{{ tt('本机打印代理') }}</div>
      <div class="ps-kv">
        <span>{{ tt('打印代理') }}</span>
        <!-- 2026-11-03:公网部署下这一项**必然显示未连接** —— 浏览器禁止公网页面访问 127.0.0.1。
             真正判"能不能打"的是上面清单里的「在线」;代理要不要出纸由它自己轮询决定。 -->
        <b :class="agentOk ? 'ok' : 'muted'">
          {{ agentOk ? tt('已连接(本机页面可直接控制)') : tt('由打印电脑自行取任务,不受本页面控制') }}
        </b>
      </div>
      <div class="ps-kv">
        <span>{{ tt('代理出纸方式') }}</span>
        <b :class="agentMode === 'printer' ? 'ok' : 'warn'">{{ agentModeText }}</b>
      </div>
      <div class="ps-kv"><span>{{ tt('队列待打印') }}</span><b class="num">{{ queueSize }}</b></div>
      <div class="ps-kv"><span>{{ tt('最近心跳') }}</span><b>{{ state.lastHeartbeat || '—' }}</b></div>
      <div v-if="agentMode !== 'printer'" class="ps-kv">
        <span>{{ tt('PDF 存放目录') }}</span>
        <b class="mono">{{ agentPdfDir || '—' }}</b>
      </div>
      <div v-if="lastPdfPath" class="ps-kv">
        <span>{{ tt('最近生成') }}</span>
        <b class="mono">{{ lastPdfPath }}</b>
      </div>

      <!-- 输出方式 / PDF 目录(2026-11-01):这两项改的是**代理的运行参数**,
           不是浏览器配置 —— 真正决定"出纸还是落文件"的是代理进程。 -->
      <div class="ps-row">
        <div class="ps-row-main">
          <div class="ps-row-title">{{ tt('输出方式') }}</div>
          <div class="ps-row-sub">{{ tt('自动 = 有打印机就出纸,打不出来自动存 PDF') }}</div>
        </div>
        <el-select v-model="modeSel" class="ps-name" size="large" :disabled="!agentOk" @change="saveAgentConfig">
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

      <div class="ps-agent">
        <div class="ps-agent-title">{{ tt('本地打印代理') }}</div>
        <div class="ps-agent-body">
          <p>{{ tt('浏览器标准打印一定会弹出打印对话框,做不到「零点击」。真正的自动出纸需要本机代理程序:') }}</p>
          <ol>
            <li>{{ tt('无打印机时:print-agent.ps1 -Mode Pdf(只生成 PDF 文件,不出纸)') }}</li>
            <li>{{ tt('有打印机时:print-agent.ps1 -Mode Printer(直接打系统打印机)') }}</li>
            <li>{{ tt('加 -Install 参数跑一次即可设为开机自启') }}</li>
            <li>{{ tt('代理自己每 4 秒拉任务,不需要一直开着本页') }}</li>
          </ol>
          <p class="ps-agent-note">
            {{ tt('没有代理时,手机端会退回自己弹打印(需要人点一次对话框)。') }}
          </p>
        </div>
      </div>
    </section>

    <!-- ③ 最近出纸 -->
    <section class="ps-card">
      <div class="ps-sec">
        <span>{{ tt('最近出纸') }}</span>
        <span class="ps-sec-num">{{ recent.length }}</span>
      </div>
      <div v-if="!recent.length" class="ps-empty">{{ tt('还没有打印记录') }}</div>
      <div v-for="(r, i) in recent" :key="i" class="ps-line">
        <span class="ps-line-t">{{ r.时间 }}</span>
        <span class="ps-line-n">{{ r.工单号 || '—' }}<i v-if="r.工单行号"> #{{ r.工单行号 }}</i></span>
        <span class="ps-line-s" :class="{ bad: r.来源 === '失败' }">{{ r.来源 || tt('已出纸') }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { fetchStationState, saveStationConfig } from '@/business/printStation'

/** 本地代理的探活地址(代理默认监听本机 18777,见 tools/printing/print-agent.ps1) */
const AGENT_URL = 'http://127.0.0.1:18777/health'
/** 刷新间隔:15 秒(代理每 4 秒心跳一次,页面只是"看板",不需要更密) */
const REFRESH_MS = 15000

const state = ref({})
const queueSize = ref(0)
/** 服务端登记的打印类型清单(唯一真源;前端不硬编码) */
const typeOptions = ref([])
const loading = ref(false)
const savingName = ref('')
const errText = ref('')
const recent = ref([])
/** 新增/预登记一台打印电脑时输入的名字(= 那台电脑装代理时填的站点名) */
const newName = ref('')
const adding = ref(false)

const agentOk = ref(false)
/** 代理的出纸方式:auto=自动兜底 / printer=直接打印 / pdf=只落 PDF(来自代理 /health) */
const agentMode = ref('printer')
/** 代理的 PDF 输出目录(来自代理 /health) */
const agentPdfDir = ref('')
/** 页面上选择的输出方式与 PDF 目录(保存时下发给代理,不存 localStorage) */
const modeSel = ref('Auto')
const pdfDirInput = ref('')
/** 最近一次生成的 PDF 路径(2026-11-01):代理跑 -Mode Pdf 时不出纸,要让人知道文件在哪 */
const lastPdfPath = ref('')
/** 用户是否手工动过这两个控件 —— 动过就别在轮询时被代理值覆盖 */
let modeSelTouched = false
let pdfDirTouched = false

let timer = null

/** 打印电脑清单(含各自开关与类型) */
const stationRows = computed(() => (Array.isArray(state.value.stations) ? state.value.stations : []))
const onlineCount = computed(() => stationRows.value.filter((s) => s.online && s.enabled).length)

/**
 * 顶部徽标:服务端总闸固定开,所以只说"现在有几台电脑在打"。
 * ⚠ 不拿 `agentOk` 判断 —— 公网地址下浏览器必然连不上本机代理(非安全上下文),
 * 那会让正常的现场永远挂着「代理未连接」的红字(2026-11-03 的教训)。
 */
const statusClass = computed(() => (onlineCount.value ? 'on' : 'off'))
const statusText = computed(() => (onlineCount.value
  ? tt('打印中就绪') + ' · ' + onlineCount.value
  : tt('没有启用的打印电脑')))

const agentModeText = computed(() => {
  if (agentMode.value === 'pdf') return tt('只生成 PDF 文件')
  if (agentMode.value === 'auto') return tt('自动(有打印机出纸,否则存 PDF)')
  return tt('直接打印')
})

function clearErr() { errText.value = '' }
function errMsgOf(e) { return e?.response?.data?.message || e?.message || '' }

onMounted(async () => {
  await refreshState()
  await probeAgent()
  loop()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  timer = null
})

function loop() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    await probeAgent()
    await refreshState()
    loop()
  }, REFRESH_MS)
}

/**
 * 探本地代理:连得上 = 这台机器上"可以直接控制代理"(局域网/本机打开本页时才有)。
 * 探测失败不弹错(公网地址下必然失败,属于常态)。
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

/** 拉一次站点状态(打印电脑清单 + 类型清单 + 队列 + 最近出纸) */
async function refreshState() {
  loading.value = true
  try {
    const d = await fetchStationState()
    state.value = d || {}
    queueSize.value = Number(d?.queueSize) || 0
    if (Array.isArray(d?.types)) typeOptions.value = d.types
    if (Array.isArray(d?.recent)) recent.value = d.recent
  } catch (e) {
    if (e?.response?.status === 403) errText.value = tt('没有自动打印的权限:请联系管理员在组织架构里授权')
  } finally {
    loading.value = false
  }
}

/**
 * 新增/预登记一台打印电脑(2026-11-05)。
 *
 * <p>清单里的行是**打印代理自己报上来**的,所以"增加电脑"只有一条正路:
 * 先在这里登记名字(= 那台电脑装代理时填的站点名),再去那台电脑装/启代理,
 * 它一连上这一行就变在线(默认关闭,还要打开开关、勾类型才会派单)。
 *
 * <p>登记时**故意先关闭**:用户口径「没有设置的电脑就不开启」——
 * 一台还没连过的电脑不该因为"名字被登记"就开始抢任务。
 */
async function addStation() {
  const name = String(newName.value || '').trim()
  if (!name) { ElMessage.warning(tt('请先填站点名')); return }
  if (stationRows.value.some((s) => s.name === name)) {
    ElMessage.warning(tt('已经有同名电脑了'))
    return
  }
  adding.value = true
  clearErr()
  try {
    await saveStationConfig({ stationName: name, enabled: false, types: [] })
    newName.value = ''
    ElMessage.success(tt('已登记:等那台电脑的打印代理连上来就会显示在线'))
    await refreshState()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('保存失败')
  } finally {
    adding.value = false
  }
}

/**
 * 保存**某一台打印电脑**的开关 / 打印类型(2026-11-04)。
 *
 * <p>🔴 旧版这里写的是全局开关 —— 点一下所有电脑一起变,正是用户报障
 * 「我是想要设置的电脑开启自动打印,没有设置的电脑就不开启」的根因。
 * 现在按站点名写,只影响那一台。
 */
async function saveStation(s, patch) {
  const name = s?.name
  if (!name) return
  const enabled = patch.enabled === undefined ? !!s.enabled : !!patch.enabled
  const types = patch.types === undefined ? (s.types || []) : patch.types
  const paper = patch.paper === undefined ? (s.paper || 'A5') : patch.paper
  savingName.value = name
  clearErr()
  // 先乐观更新,失败再回读(勾选/开关手感不能等一个请求)
  const next = stationRows.value.map((x) => (x.name === name ? { ...x, enabled, types, paper } : x))
  state.value = { ...state.value, stations: next }
  try {
    const d = await saveStationConfig({ stationName: name, enabled, types, paper })
    state.value = { ...state.value, ...(d || {}) }
    if (patch.enabled !== undefined) {
      ElMessage.success(enabled ? tt('已开启这台电脑的自动打印') : tt('已关闭这台电脑的自动打印'))
    } else if (patch.paper !== undefined) {
      ElMessage.success(tt('纸张已改为') + ' ' + paper + tt('(内容大小不变)'))
    } else if (!types.length) {
      ElMessage.warning(tt('没有勾选任何打印类型:这台电脑不会收到打印任务'))
    } else {
      ElMessage.success(tt('已保存'))
    }
  } catch (e) {
    errText.value = errMsgOf(e) || tt('保存失败')
    await refreshState()   // 回读真实状态,别让开关停在假的"已开"
  } finally {
    savingName.value = ''
  }
}

/**
 * 保存「输出方式 / PDF 目录」到**本地代理**(2026-11-01)。
 *
 * 为什么存代理而不是服务端:真正决定"出纸还是落文件、落到哪个目录"的是代理进程,
 * 网页只是它的遥控器。代理没连上时这两项置灰 —— 改不了就别让人改。
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
    const m = String(j?.mode || '').toLowerCase()
    agentMode.value = m === 'pdf' ? 'pdf' : (m === 'auto' ? 'auto' : 'printer')
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
  max-width: 900px;
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
.ps-badge.off { background: var(--el-fill-color); color: var(--el-text-color-secondary); }

.ps-card {
  margin-bottom: 14px; padding: 16px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.ps-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 10px; flex-wrap: wrap; }
.ps-sec-note { font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }
.ps-sec-num {
  padding: 0 6px; border-radius: 10px; font-size: 12px; font-weight: 400;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary);
}
.ps-refresh { margin-left: auto; }

/* 打印电脑行(2026-11-04):一行一台电脑,行内 = 名称/在线 + 开关 + 类型勾选 */
.ps-station {
  padding: 10px 12px; margin-top: 8px; border-radius: 6px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}
.ps-station.off { opacity: .72; }
.ps-station-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ps-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--el-border-color); }
.ps-dot.on { background: var(--el-color-success); }
.ps-station-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; word-break: break-all; }
.ps-station-tag {
  flex: none; padding: 0 6px; border-radius: 4px; font-size: 11px;
  background: var(--el-fill-color); color: var(--el-text-color-secondary);
}
.ps-station-tag.on { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.ps-station-tag.warn { background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2); }
.ps-station-switch { flex: none; margin-left: 4px; }
/* 认机信息(2026-11-05):最近心跳 + 来源 IP —— 现场据此认出是哪一台电脑 */
.ps-station-meta { margin-top: 2px; padding-left: 16px; font-size: 11px; color: var(--el-text-color-secondary); display: flex; flex-wrap: wrap; gap: 2px 8px; }
.ps-station-meta b { font-weight: 400; }
.ps-meta-warn { color: var(--el-color-warning-dark-2); }
.ps-station-body { margin-top: 6px; padding-left: 16px; }
.ps-station-line { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ps-paper { flex: none; width: 260px; }
.ps-station-label { font-size: 12px; color: var(--el-text-color-secondary); }
.ps-types { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 2px 18px; }
.ps-hint { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); }
.ps-hint-warn { color: var(--el-color-warning-dark-2); }

/* 新增打印电脑(2026-11-05):登记名字 → 那台电脑装代理用同一个名字 → 自动上线 */
.ps-add { margin-top: 12px; padding: 12px; border-radius: 6px; background: var(--el-fill-color-lighter); }
.ps-add-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.ps-add-row { display: flex; align-items: center; gap: 8px; }
.ps-add-row :deep(.el-input) { flex: 1; min-width: 0; }
.ps-add-row :deep(.el-button) { flex: none; height: 40px; margin-left: 0; }

.ps-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0; border-top: 1px dashed var(--el-border-color-lighter);
}
.ps-row-main { flex: 1; min-width: 0; }
.ps-row-title { font-size: 14px; }
.ps-row-sub { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); }
.ps-name { flex: none; width: 260px; }

.ps-kv { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; font-size: 13px; }
.ps-kv > span { width: 92px; flex: none; color: var(--el-text-color-secondary); }
.ps-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }
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
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }

.ps-err {
  margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; font-size: 13px;
  background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2);
}

@media (max-width: 640px) {
  .ps-name { width: 100%; }
  .ps-row { flex-wrap: wrap; }
}
</style>
