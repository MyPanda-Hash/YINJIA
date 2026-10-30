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

    <!-- ③ 说明段 -->
    <div class="pds-note">
      {{ tt('可通过产品编号直接搜索；状态由各文件面板的单据实时推导（未开发 / 开发中 / 开发审核中 / 开发完毕）。') }}
    </div>

    <!-- ③′ 筛选中横幅(侧栏模糊搜索/查询产品/产品预览 → 本表按产品行筛选) -->
    <div v-if="activeFilter" class="pds-filter">
      <span class="pds-filter-txt">
        {{ tt('筛选中') }}：{{ filterText }}
        <span class="pds-filter-count">{{ shownRows.length }} / {{ rows.length }}</span>
      </span>
      <span class="pds-filter-clear" @click="emit('clear-filter')">✕ {{ tt('清除筛选') }}</span>
    </div>

    <!-- ④ 矩阵表 -->
    <div class="pds-scroll">
      <table class="pds-table">
        <thead>
          <tr>
            <th class="pds-c-no">{{ tt('产品编号') }}</th>
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
              </td>
            </template>
            <td class="pds-c-owner">{{ row['产品负责人'] || '' }}</td>
            <td class="pds-c-ctrl">{{ tt(row['是否受控'] || '否') }}</td>
            <td class="pds-c-date">{{ row['受控日期'] || '' }}</td>
          </tr>
          <tr v-if="!shownRows.length">
            <!-- 列数 = 产品编号 1 + 4×(文件+状态) 8 + 产品负责人/是否受控/受控日期 3 = 12
                 (原写 14 是错的:空态那行会多撑出两格) -->
            <td :colspan="12" class="pds-empty">
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
import { computed, onMounted, ref, watch } from 'vue'
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

onMounted(load)
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
.pds-c-file { min-width: 108px; white-space: nowrap; color: var(--pds-ink-2); }
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
