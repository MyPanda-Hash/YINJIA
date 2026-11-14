<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品文件列表(RD_PROD_DOCLIST)—— 设计《产品开发系统需求汇总》sheet「文件汇总表」

       设计原表:产品编号 | 文件1 | 状态 | 文件2 | 状态 | 文件3 | 状态 | 文件4 | 状态 |
                 产品负责人 | 是否受控 | 受控日期

       【本面板不新建业务逻辑】4 个文件列 = DevTaskService.DEV_PANELS 的 4 个下游面板,
       每格状态 = statusOf(产品编号, 面板);本视图只负责**把它从按钮变成一张可查询的表**。
       受控是派生值(设计流程图 5.1~5.4 尾部「审批后自动受控」):4 份文件全归档即受控。

       只读视图:产品文件由各自的面板维护,这里不做就地编辑(与"产品开发"按钮同一份数据源)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="prod-doc-sheet">
    <!-- ① 公司头 + 标题行
         2026-10-30 用户口径:去掉「单据编号 / 密级 / 文件使用范围」这三格。
         理由:本面板是 4 张文件面板的派生只读视图,既没有自己的单据号,也没有密级与
         使用范围的值(head 里永远是空/—),三个空标签只会占掉抬头最显眼的位置。
         单据编号仍由 props.head 传给下面的 load() 当刷新触发器,这里只是不再显示。 -->
    <div class="pds-topbar">
      <div class="pds-company">{{ tt('惠州市银嘉环保科技有限公司') }}</div>
    </div>

    <!-- ② 标题行 -->
    <div class="pds-title-row">
      <div class="pds-title">{{ tt('产品文件列表') }}</div>
    </div>

    <!-- ③ 说明段 + 视图切换(2026-11-06 用户口径:「加入一个隐藏切换入口可以像项目流程管控一样,
         可以全览得看到流程到哪里了」)——
         入口刻意做小、放在说明行右端:主视图仍是矩阵,流程全览是给"想看整体进度"的人按需打开的。 -->
    <div class="pds-note">
      <span class="pds-note-txt">
        {{ flowMode
          ? tt('全览每个产品走到哪一步：产品信息表 + 4 张文件的单据状态、单号与待重走标记，一眼看出卡在哪')
          : tt('可通过产品编号直接搜索；状态由各文件面板的单据实时推导（未开发 / 开发中 / 开发审核中 / 开发完毕）。') }}
      </span>
      <span class="pds-view-toggle" :title="flowMode ? tt('回到产品文件矩阵') : tt('全览流程进度')" @click="toggleFlow">
        {{ flowMode ? tt('矩阵视图') : tt('流程全览') }}
      </span>
    </div>

    <!-- ③′ 筛选中横幅(侧栏模糊搜索/查询产品/产品预览 → 本表按产品行筛选) -->
    <div v-if="activeFilter" class="pds-filter">
      <span class="pds-filter-txt">
        {{ tt('筛选中') }}：{{ filterText }}
        <span class="pds-filter-count">{{ shownRows.length }} / {{ rows.length }}</span>
      </span>
      <span class="pds-filter-clear" @click="emit('clear-filter')">✕ {{ tt('清除筛选') }}</span>
    </div>

    <!-- ③″ 流程全览(只读):每行一个产品,展开看「产品信息表 → 4 张文件」五步走到哪;
         数据源 = GET /px/rdDevOverview(与「项目进度查询 · 开发产品」同一份事实,不另造口径)。 -->
    <div v-if="flowMode" class="pds-scroll pds-flow">
      <div v-if="flowLoading" class="pds-flow-empty">{{ tt('加载流程进度…') }}</div>
      <div v-else-if="!flowRows.length" class="pds-flow-empty">{{ tt('没有可展示的产品') }}</div>
      <template v-else>
        <div v-for="r in flowRows" :key="r.产品编号" class="pds-flow-row" :class="{ 'is-target': r.产品编号 === focusProduct }">
          <div class="pds-flow-main" @click="toggleFlowRow(r.产品编号)">
            <span class="pds-flow-caret">{{ expanded.has(r.产品编号) ? '▾' : '▸' }}</span>
            <span class="pds-flow-code">{{ r.产品编号 || '—' }}</span>
            <span class="pds-flow-name">{{ r.产品名称 || '—' }}</span>
            <span class="pds-flow-link">{{ r.立项文档编号 || '—' }}</span>
            <span class="pds-flow-state" :class="'tone-' + toneOfState(r.state)">{{ tt(r.state || '草稿') }}</span>
            <span class="pds-flow-progress">{{ r.doneCount }}/{{ r.nodes.length }}</span>
            <span class="pds-flow-done" :class="{ on: r.allDone }">{{ r.allDone ? tt('已开发完毕') : tt('进行中') }}</span>
          </div>
          <ol v-if="expanded.has(r.产品编号)" class="pds-flow-steps">
            <li class="pds-flow-step" :class="'is-' + toneOfState(r.state)">
              <span class="pds-step-name">{{ tt('产品信息表') }}</span>
              <span class="pds-step-no">{{ r.单据编号 || '—' }}</span>
              <span class="pds-step-state">{{ tt(r.state || '草稿') }}</span>
            </li>
            <li v-for="n in r.nodes" :key="n.panel" class="pds-flow-step" :class="n.done ? 'is-done' : (n.state && n.state !== '未开始' ? 'is-doing' : 'is-none')">
              <span class="pds-step-name">{{ tt(n.label) }}</span>
              <span class="pds-step-no">{{ n.docNo || '—' }}</span>
              <span class="pds-step-state">{{ tt(n.state || '未开始') }}</span>
              <span v-if="n.reaudited" class="pds-step-flag">{{ tt('待重走') }}</span>
            </li>
          </ol>
        </div>
      </template>
    </div>

    <!-- ④ 矩阵表 -->
    <div v-else class="pds-scroll">
      <table class="pds-table">
        <thead>
          <tr>
            <th class="pds-c-no">{{ tt('产品编号') }}</th>
            <!-- 产品信息表信息（2026-11-11 用户口径：「给产品文件列表前面加上对应的产品信息表信息，
                 填写人这些」）：矩阵第一列是产品编号，紧接着给它所属**来源单据**（RD_PROD_INFO）的
                 产品名称与填写人，再往后才是 4 张文件 —— 这样一眼能看出"这份文件是给谁填的/谁填的"。
                 填写人 = 产品信息表单据的制单人（后端 board() 的「填写人」，asp_user1 → 姓名）。 -->
            <th class="pds-c-name">{{ tt('产品名称') }}</th>
            <th class="pds-c-filler">{{ tt('填写人') }}</th>
            <!-- 表头一律叫「文件N」(设计第 8 行 C8/D8 = 文件1/状态 …):**文件名写在数据格里**
                 (设计第 9 行 C9=规格书),不再把面板名放到表头上 —— 这样 4 列的文件名各自可读,
                 与 状态 列一一成对。文件列顺序由后端 DevTaskService.DEV_PANELS 给出(规格书在前)。 -->
            <template v-for="(c, ci) in columns" :key="'h' + c.panelCode">
              <th class="pds-c-file">{{ tt('文件' + (ci + 1)) }}</th>
              <th class="pds-c-status">{{ tt('状态') }}</th>
            </template>
            <th class="pds-c-owner">{{ tt('产品负责人') }}</th>
            <th class="pds-c-ctrl">{{ tt('是否受控') }}</th>
            <th class="pds-c-date">{{ tt('受控日期') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in shownRows" :key="row['产品编号'] || ('r' + i)">
            <td class="pds-c-no">{{ row['产品编号'] || '' }}</td>
            <td class="pds-c-name">{{ row['产品名称'] || '' }}</td>
            <td class="pds-c-filler">{{ row['填写人'] || '' }}</td>
            <template v-for="c in columns" :key="'c' + c.panelCode + (row['产品编号'] || i)">
              <td class="pds-c-file">{{ tt(c.panelName) }}</td>
              <!-- 点状态 = 跳到该文件面板查看这张单(2026-09-30 用户口径):
                   无该面板查看权限 → 提示「无查看该面板的权限」,不跳;
                   该文件还没建单(未开发)→ 仍跳到面板(无 focus),让用户能看到列表/新建。 -->
              <td
                class="pds-c-status pds-c-jump"
                :title="jumpTitle(c, row)"
                @click="onStatusClick(c, row)"
              >
                <span class="pds-badge" :class="toneOf(statusOf(row, c.panelCode))">
                  {{ tt(statusOf(row, c.panelCode)) }}
                </span>
                <!-- 2026-11-06 用户口径：「在产品文件列表里面的规格书的状态的已开发的右边加上一个
                     批准按钮，谁点击了批准按钮（给这个面板加上一个批准的单独权限…管理员默认拥有）
                     就回填进批准这一栏，也是账号名加日期」。
                     只给**规格书**那一列出（RD_SPEC_DOC），且必须有 specapprove 词才渲染
                     （没有权限的人看不到按钮，与"点了才 403"相比更早暴露）。 -->
                <button
                  v-if="canApprove(c) && statusOf(row, c.panelCode) === '开发完毕'"
                  class="pds-approve"
                  :title="approveTitle(row, c)"
                  :disabled="approving === docNoOf(row, c.panelCode)"
                  @click.stop="onApprove(row, c)"
                >
                  {{ tt('批准') }}
                </button>
                <span v-else-if="canApprove(c) && approvedAt(row)" class="pds-approved">
                  {{ approvedAt(row) }}
                </span>
              </td>
            </template>
            <td class="pds-c-owner">{{ row['产品负责人'] || '' }}</td>
            <td class="pds-c-ctrl">{{ tt(row['是否受控'] || '否') }}</td>
            <td class="pds-c-date">{{ row['受控日期'] || '' }}</td>
          </tr>
          <tr v-if="!shownRows.length">
            <!-- 列数 = 产品编号 1 + 产品名称/填写人 2 + 4×(文件+状态) 8
                 + 产品负责人/是否受控/受控日期 3 = 14 -->
            <td :colspan="14" class="pds-empty">
              {{ activeFilter
                ? tt('没有符合筛选条件的产品（点上方「清除筛选」看全部）')
                : tt('暂无已下发的产品文件记录（先在产品信息表归档后点「产品开发」下发）') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { tt } from '@/i18n'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '@/core/request'
import { useAppContext } from '@/core/panel-runtime'
import { canViewPanel } from '@/core/auth/panelAccess'
import { PROD_DOC_FIELD_OPTIONS, filterProdDocRows } from '@/core/prod/prodDocSearch'

const props = defineProps({
  head: { type: Object, default: () => ({}) },
  panelCode: { type: String, default: '' },
  // 侧栏搜索生效中的矩阵行筛选({conditions, valid});无则整表显示
  filter: { type: Object, default: null },
})
// rows:取到矩阵行后上报(侧栏的结果清单/预览卡片要用同一份数据;本组件自己不存搜索结果)
const emit = defineEmits(['rows', 'clear-filter'])

const router = useRouter()
const { user } = useAppContext()

const columns = ref([])
const rows = ref([])

/* ── 流程全览(2026-11-06) ─────────────────────────────────────────────────
   用户口径:「产品信息表在提交审批之后跳转到产品文件列表，可以查看流程信息；现在给这个产品文件列表
   更新一下，加入一个隐藏切换入口可以像项目流程管控一样，可以全览得看到流程到哪里了」。
   做法:同一面板内二选一视图 —— 矩阵(默认) ⇄ 流程全览。
   数据源复用 GET /px/rdDevOverview(「项目进度查询 · 开发产品」的同一份事实:每个产品
   产品信息表状态 + 4 张文件节点的 单号/状态/是否完成/是否反审核待重走)，不新增后端端点、
   不另立口径。无 RD_PROGRESS 权限时接口 403,这里降级成一句提示,不影响矩阵视图。 */
const FLOW_KEY = 'pds.flowMode'
const flowMode = ref(false)
const flowLoading = ref(false)
const flowRows = ref([])
const flowDenied = ref(false)
const expanded = ref(new Set())
/** 从产品信息表提交审批跳过来时带的产品编号(高亮那一行) */
const focusProduct = ref('')

function toggleFlow() {
  flowMode.value = !flowMode.value
  try { localStorage.setItem(FLOW_KEY, flowMode.value ? '1' : '0') } catch { /* 隐私模式下存不了,不影响本次会话 */ }
  if (flowMode.value) loadFlow()
}

function toggleFlowRow(code) {
  const next = new Set(expanded.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  expanded.value = next
}

/** 状态 → 色调(与矩阵矩阵列的 tone 同一套语义) */
function toneOfState(st) {
  const s = String(st || '')
  if (s === '已归档' || s === '已审核' || s === '已生效') return 'done'
  if (s === '审批中' || s === '待二级审批' || s === '开发审核中') return 'review'
  if (s === '修改中' || s === '开发中') return 'doing'
  return 'none'
}

async function loadFlow() {
  if (flowLoading.value) return
  flowLoading.value = true
  flowDenied.value = false
  try {
    const res = await request.get('/px/rdDevOverview')
    const list = (res && res.data && res.data.products) || []
    flowRows.value = list.filter((r) => String(r.产品编号 || '').trim() !== '')
    emit('rows', rows.value, columns.value)
  } catch (e) {
    flowRows.value = []
    flowDenied.value = true
  } finally {
    flowLoading.value = false
  }
}

/** 生效中的筛选(横幅与"没有符合条件的产品"空态都看它) */
const activeFilter = computed(() => (props.filter && props.filter.valid ? props.filter : null))
const shownRows = computed(() => filterProdDocRows(rows.value, columns.value, activeFilter.value))
/** 横幅文案:字段 包含 "值" [+ …] */
const filterText = computed(() => (activeFilter.value?.conditions || [])
  .map((c) => `${tt(c.field)} ${tt('包含')} "${c.value}"`)
  .join('  '))

/**
 * 一行里某面板的状态。
 * 后端 board() 把 4 个面板的状态放在 row.cells[panelCode](键=面板编码)。
 * 兜底:缺该面板(历史 rd_dev_task 只指向已下线面板)时记「—」而不是空白。
 */
function statusOf(row, panelCode) {
  const c = row && row.cells ? row.cells[panelCode] : null
  return c || '—'
}

/** 状态色调:沿用项目既有语义(开发完毕=绿 / 开发中·开发审核中=蓝 / 未开发=灰) */
function toneOf(st) {
  if (st === '开发完毕') return 'done'
  if (st === '开发审核中') return 'review'
  if (st === '开发中') return 'doing'
  return 'none'
}

/** 该产品在该文件面板的单据号(点状态跳转的目标;未开发时为空) */
function docNoOf(row, panelCode) {
  const m = row && row.docNos ? row.docNos : null
  const v = m ? m[panelCode] : ''
  return v === undefined || v === null ? '' : String(v)
}

function canView(panelCode) {
  return canViewPanel({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }, panelCode)
}

/**
 * 该列是不是「规格书」那一列（2026-11-06：只有规格书有「批准」动作）。
 * RD_X_SINTER 在 DevTaskService 里是 RD_MOLD_PROC 的别名，不参与批准。
 */
function isSpecColumn(c) {
  return String(c?.panelCode || '') === 'RD_SPEC_DOC'
}

/**
 * 当前登录用户能否点「批准」= 持有 RD_SPEC_DOC 的 specapprove 词（管理员恒有）。
 * 与后端 PanelPermissionService.requireAnyPerm('specapprove') 同一口径 —— 前端不渲染按钮，
 * 后端仍会拦（两处都要：只靠前端可绕过，只靠后端则按钮看得见点不动）。
 */
function canApprove(c) {
  if (!isSpecColumn(c)) return false
  if (user?.isAdmin) return true
  const p = user?.pagePerms || {}
  const csv = p.RD_SPEC_DOC || ''
  return String(csv).split(',').map((s) => s.trim()).includes('specapprove')
}

/**
 * 批准按钮的悬停提示。
 *
 * ⚠ 2026-11-10 事故：模板里 `:title="approveTitle(row, c)"` 先落了地，函数却漏写 ⇒ 只要这一格
 *   命中（管理员 × 规格书列 × 状态=开发完毕）渲染就抛 `TypeError: approveTitle is not a function`，
 *   Vue 把整棵子树丢掉 —— 用户看到的是**整个产品文件列表一片空白**（生产 11-10 报障）。
 *   组件里"模板用了、脚本没定义"的漏写不会在构建期报错，只能靠这条注释与测试兜住。
 */
function approveTitle(row, c) {
  const no = docNoOf(row, c.panelCode)
  return no ? tt('批准规格书 {no}（回填批准人与日期）').replace('{no}', no) : tt('批准')
}

/** 已批准时那格显示的落款（后端 board 回填 批准日期：姓名/yyyy.M.d） */
function approvedAt(row) {
  return row?.批准日期 || ''
}

const approving = ref('')

/** 点「批准」→ 后端写 rd_spec_doc_head.批准日期，刷新本表 */
async function onApprove(row, c) {
  const no = docNoOf(row, c.panelCode)
  if (!no) {
    ElMessage.warning(tt('这张规格书还没有单据号，无法批准'))
    return
  }
  approving.value = no
  try {
    const res = await request.post('/px/specApprove', { docNo: no })
    const stamp = res?.data?.['批准日期'] || ''
    if (stamp) row.批准日期 = stamp
    ElMessage.success(tt('已批准') + '：' + stamp)
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('批准失败'))
  } finally {
    approving.value = ''
  }
}

/** 状态格的悬停提示:说清点了会发生什么(含"没有查看权限"这一种) */
function jumpTitle(c, row) {
  if (!canView(c.panelCode)) return tt('无查看该面板的权限')
  const no = docNoOf(row, c.panelCode)
  return no ? `${tt('查看')}：${tt(c.panelName)} ${no}` : `${tt('打开')}：${tt(c.panelName)}`
}

/**
 * 点状态 → 跳该文件面板查看(带 ?focus=单据号 直接定位到那张单)。
 * 权限预检走 core/auth/panelAccess(与导航/桌面入口同一口径),不放行就提示,不跳。
 */
function onStatusClick(c, row) {
  if (!canView(c.panelCode)) {
    ElMessage.warning(`${tt('无查看该面板的权限')}：${tt(c.panelName)}`)
    return
  }
  const no = docNoOf(row, c.panelCode)
  router.push({ path: `/panelx/list/${c.panelCode}`, query: no ? { focus: no } : {} })
}

async function load() {
  try {
    const res = await request.get('/px/prodDocList')
    const data = (res && res.data) || {}
    columns.value = data.columns || []
    rows.value = data.rows || []
  } catch (e) {
    columns.value = []
    rows.value = []
  }
  emit('rows', rows.value, columns.value)
}

onMounted(async () => {
  try { flowMode.value = localStorage.getItem(FLOW_KEY) === '1' } catch { /* 忽略 */ }
  const q = router.currentRoute.value.query || {}
  if (String(q.flow || '') === '1') flowMode.value = true
  focusProduct.value = String(q.product || '').trim()
  if (flowMode.value && focusProduct.value) expanded.value = new Set([focusProduct.value])
  await load()
  if (flowMode.value) await loadFlow()
  // 从产品信息表提交审批跳过来时,流程全览里把该产品展开并滚到眼前
  if (focusProduct.value && flowMode.value) {
    await nextTick()
    const el = document.querySelector('.pds-flow-row.is-target')
    if (el) el.scrollIntoView({ block: 'center' })
  }
})
// 单据切换(单单据面板下通常只有一张)或面板编码变化时重取
watch(() => [props.panelCode, props.head && props.head['单据编号']], load)
</script>

<style scoped>
/* ════════════════════════════════════════════════════════════════════════════
   产品文件列表 —— 2026-10-30 视觉重做（**只动观感，一行逻辑没改**）
   用户口径：「设计得不是很好看，重新设计一下，要高级简约，不改变现有逻辑」

   旧版的问题：整块标题条是高饱和蓝底白字（#2f6fbf），吃掉了一整页的注意力，
   而这页真正要看的是「哪几个文件还没开发」；表格又是逐格 1px 实线方格纸，
   和标题条一起把页面压得很满。

   新版三件事：
     ① 标题条去色 → 深墨字 + 细分隔线（去掉色块，视觉重心回到表格内容）
     ② 表格改「横向细线」→ 竖线只保留极浅的辅助线，行高放宽，读起来不挤
     ③ 状态标签降饱和 → 同色系浅底 + 细边，不再是四种抢眼的彩色胶囊
   ========================================================================== */
.prod-doc-sheet {
  --pds-ink: #1d232b;          /* 主文字 */
  --pds-ink-2: #5b6472;        /* 次要文字 */
  --pds-ink-3: #98a1ad;        /* 弱提示 */
  --pds-line: #e8eaee;         /* 分隔线 */
  --pds-line-soft: #f1f3f6;    /* 极浅辅助线 */
  --pds-surface: #f7f8fa;      /* 表头/淡底 */
  padding: 10px 6px 28px;
  color: var(--pds-ink);
  font-variant-numeric: tabular-nums;
}

/* ── 说明行 + 视图切换(流程全览的"隐藏"入口:小字弱化,悬停才明显) ── */
.pds-note {
  display: flex; align-items: baseline; gap: 12px;
}
.pds-note-txt { flex: 1; min-width: 0; }
.pds-view-toggle {
  flex: none; cursor: pointer; font-size: 12px; color: var(--pds-ink-3);
  padding: 2px 8px; border: 1px solid var(--pds-line); border-radius: 10px;
  transition: color .15s ease, border-color .15s ease, background-color .15s ease;
}
.pds-view-toggle:hover { color: #1668dc; border-color: #bcd2f5; background: #f2f7ff; }

/* ── 流程全览 ── */
.pds-flow { display: flex; flex-direction: column; gap: 6px; }
.pds-flow-empty { padding: 28px 4px; color: var(--pds-ink-3); text-align: center; }
.pds-flow-row { border: 1px solid var(--pds-line); border-radius: 6px; padding: 0 10px; }
.pds-flow-row.is-target { border-color: #bcd2f5; background: #f7faff; }
.pds-flow-main {
  display: grid; align-items: center; gap: 10px; padding: 9px 0; cursor: pointer;
  grid-template-columns: 14px 116px minmax(140px, 1.4fr) 120px 84px 46px 84px;
  font-size: 13px;
}
.pds-flow-caret { color: var(--pds-ink-3); }
.pds-flow-code { font-variant-numeric: tabular-nums; font-weight: 600; }
.pds-flow-name { color: var(--pds-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pds-flow-link { color: var(--pds-ink-2); font-variant-numeric: tabular-nums; }
.pds-flow-state, .pds-flow-done {
  font-size: 12px; padding: 1px 7px; border-radius: 9px; text-align: center;
  border: 1px solid var(--pds-line); color: var(--pds-ink-2); background: var(--pds-surface);
}
.pds-flow-state.tone-done { color: #237804; border-color: #b7eb8f; background: #f6ffed; }
.pds-flow-state.tone-review { color: #0958d9; border-color: #adc6ff; background: #f0f5ff; }
.pds-flow-state.tone-doing { color: #ad6800; border-color: #ffe58f; background: #fffbe6; }
.pds-flow-progress { color: var(--pds-ink-2); font-variant-numeric: tabular-nums; text-align: right; }
.pds-flow-done.on { color: #237804; border-color: #b7eb8f; background: #f6ffed; }
.pds-flow-steps {
  list-style: none; margin: 0 0 10px; padding: 8px 0 0 24px;
  border-top: 1px dashed var(--pds-line);
  display: flex; flex-wrap: wrap; gap: 8px;
}
.pds-flow-step {
  display: flex; align-items: center; gap: 6px; font-size: 12px;
  padding: 3px 8px; border-radius: 6px; border: 1px solid var(--pds-line); background: #fff;
}
.pds-flow-step.is-done { border-color: #b7eb8f; background: #f6ffed; }
.pds-flow-step.is-review { border-color: #adc6ff; background: #f0f5ff; }
.pds-flow-step.is-doing { border-color: #ffe58f; background: #fffbe6; }
.pds-step-name { color: var(--pds-ink); font-weight: 600; }
.pds-step-no { color: var(--pds-ink-3); font-variant-numeric: tabular-nums; }
.pds-step-state { color: var(--pds-ink-2); }
.pds-step-flag { color: #cf1322; font-weight: 600; }

/* ── 抬头 ── */
.pds-topbar {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 0 2px 14px;
}
.pds-company { font-size: 15px; font-weight: 600; letter-spacing: .3px; color: var(--pds-ink); }

/* ── 标题条：大字 + 一条细线（右侧信息格已于 2026-10-30 去掉） ── */
.pds-title-row {
  display: flex; align-items: flex-end;
  padding: 4px 2px 12px; border-bottom: 1px solid var(--pds-line);
}
.pds-title {
  font-size: 20px; font-weight: 600; letter-spacing: 3px; color: var(--pds-ink);
}

.pds-note {
  padding: 12px 2px 16px; font-size: 12px; color: var(--pds-ink-3); line-height: 1.7;
}

/* ── 筛选横幅：淡到几乎只剩一条提示 ── */
.pds-filter {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin: 0 2px 14px; padding: 8px 12px; font-size: 12px;
  background: var(--pds-surface); border: 1px solid var(--pds-line);
  border-radius: 6px; color: var(--pds-ink-2);
}
.pds-filter-count { margin-left: 8px; color: var(--pds-ink-3); }
.pds-filter-clear {
  cursor: pointer; color: var(--pds-ink-2); text-decoration: none;
  border-bottom: 1px solid currentColor; padding-bottom: 1px;
}
.pds-filter-clear:hover { color: var(--pds-ink); }

/* ── 表格：横向细线为主，竖线只留极浅 ── */
.pds-scroll { overflow: auto; border-radius: 6px; }
.pds-table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  font-size: 12.5px; background: #fff;
}
.pds-table th, .pds-table td {
  padding: 10px 10px; vertical-align: middle;
  border-bottom: 1px solid var(--pds-line);
  border-right: 1px solid var(--pds-line-soft);
}
.pds-table th:last-child, .pds-table td:last-child { border-right: none; }
.pds-table thead th {
  background: var(--pds-surface); font-weight: 500; text-align: center;
  white-space: nowrap; color: var(--pds-ink-2); letter-spacing: .3px;
  border-bottom: 1px solid var(--pds-line);
}
.pds-table tbody tr:last-child td { border-bottom: none; }
.pds-table tbody tr:hover td { background: #fafbfc; }

.pds-c-no { min-width: 112px; font-weight: 600; color: var(--pds-ink); }
/* 产品信息表信息（2026-11-11）：名称给宽一点（产品名较长），填写人窄；都单行省略，不撑破纸面 */
.pds-c-name { min-width: 150px; max-width: 220px; color: var(--pds-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pds-c-filler { min-width: 84px; color: var(--pds-ink-2); white-space: nowrap; }
.pds-c-file { min-width: 108px; white-space: nowrap; color: var(--pds-ink-2); }
/* 2026-11-06 规格书「批准」按钮：紧贴状态标签右侧，体量小于标签（它是动作不是状态） */
.pds-approve {
  margin-left: 6px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 18px;
  color: #2f6f4e;
  background: #f2f9f5;
  border: 1px solid #b7d9c5;
  border-radius: 3px;
  cursor: pointer;
}
.pds-approve:hover:not(:disabled) { background: #e4f3ea; border-color: #8fc4a6; }
.pds-approve:disabled { opacity: .5; cursor: default; }
/* 已批准的落款（姓名/日期）比状态标签更弱：它是留痕，不是当前状态 */
.pds-approved { margin-left: 6px; font-size: 11px; color: #8a9099; }

.pds-c-status { min-width: 96px; text-align: center; }
/* 状态格可点：跳该文件面板查看（无权限时给提示）—— 只做极轻的反馈，不抢眼 */
.pds-c-jump { cursor: pointer; }
.pds-c-jump:hover td { background: #f6f8fb; }
.pds-c-jump:hover .pds-badge { border-color: #c9d3e0; }
.pds-c-owner { min-width: 92px; color: var(--pds-ink-2); }
.pds-c-ctrl { min-width: 74px; text-align: center; color: var(--pds-ink-2); }
.pds-c-date { min-width: 122px; color: var(--pds-ink-3); }
.pds-empty { text-align: center; color: var(--pds-ink-3); padding: 28px 0; }

/* ── 状态标签：同色系浅底 + 细边，降饱和 ── */
.pds-badge {
  display: inline-block; padding: 2px 9px; border-radius: 999px;
  font-size: 11.5px; line-height: 18px; letter-spacing: .2px;
  background: #fff; border: 1px solid var(--pds-line); color: var(--pds-ink-2);
}
.pds-badge.done { background: #f1f8f3; color: #2f7a4f; border-color: #d8e9de; }
.pds-badge.review { background: #f2f5fb; color: #3c5c8a; border-color: #dbe3f0; }
.pds-badge.doing { background: #f4f7fb; color: #4a6b8f; border-color: #dfe6ef; }
.pds-badge.none { background: #fafbfc; color: #9aa3ae; border-color: #e8eaee; }

@media print {
  .pds-note { display: none; }
  .prod-doc-sheet { padding: 0; }
  .pds-title-row { border-bottom: 1px solid #c9ccd2; }
}
</style>
