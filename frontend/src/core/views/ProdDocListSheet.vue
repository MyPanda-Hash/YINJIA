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
    <!-- ① 公司头 + 右上单据编号 -->
    <div class="pds-topbar">
      <div class="pds-company">{{ tt('惠州市银嘉环保科技有限公司') }}</div>
      <div class="pds-docno">{{ head && head['单据编号'] ? head['单据编号'] : '' }}</div>
    </div>

    <!-- ② 标题行 -->
    <div class="pds-title-row">
      <div class="pds-title">{{ tt('产品文件列表') }}</div>
      <div class="pds-info-table">
        <div class="pds-info-row">
          <span class="pds-info-label">{{ tt('密级') }}</span>
          <span class="pds-info-value">{{ (head && head['密级']) || '' }}</span>
        </div>
        <div class="pds-info-row">
          <span class="pds-info-label">{{ tt('文件使用范围') }}</span>
          <span class="pds-info-value">{{ (head && head['文件使用范围']) || '' }}</span>
        </div>
      </div>
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
import { useUserStore } from '@/stores/user'
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
const user = useUserStore()

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
.prod-doc-sheet { padding: 8px 4px 24px; color: #1f2d3d; }

.pds-topbar { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 6px; }
.pds-company { font-size: 15px; font-weight: 700; letter-spacing: .5px; }
.pds-docno { font-size: 13px; color: #409eff; }

.pds-title-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #2f6fbf; color: #fff; padding: 8px 12px; border-radius: 2px;
}
.pds-title { font-size: 17px; font-weight: 700; letter-spacing: 2px; }
.pds-info-table { font-size: 12px; }
.pds-info-row { display: flex; gap: 6px; line-height: 1.7; }
.pds-info-label { opacity: .85; min-width: 62px; text-align: right; }
.pds-info-value { min-width: 70px; }

.pds-note { padding: 8px 6px 10px; font-size: 12px; color: #606266; }

/* 筛选中横幅(侧栏搜索 → 本表行筛选) */
.pds-filter {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin: 0 6px 8px; padding: 6px 10px; font-size: 12px;
  background: #eef6ff; border: 1px solid #c8ddf7; border-radius: 3px; color: #2f6fbf;
}
.pds-filter-count { margin-left: 8px; color: #909399; }
.pds-filter-clear { cursor: pointer; color: #2f6fbf; text-decoration: underline; }
.pds-filter-clear:hover { color: #1f4f8a; }

.pds-scroll { overflow: auto; }
.pds-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pds-table th, .pds-table td { border: 1px solid #d9dee5; padding: 5px 6px; vertical-align: middle; }
.pds-table thead th {
  background: #eef2f7; font-weight: 600; text-align: center; white-space: nowrap;
}
.pds-c-no { min-width: 110px; font-weight: 600; }
.pds-c-file { min-width: 108px; white-space: nowrap; }
.pds-c-status { min-width: 96px; text-align: center; }
/* 状态格可点:跳该文件面板查看(无权限时给提示) */
.pds-c-jump { cursor: pointer; }
.pds-c-jump:hover { background: #eef6ff; }
.pds-c-jump:hover .pds-badge { box-shadow: 0 0 0 2px #c8ddf7; }
.pds-c-owner { min-width: 90px; }
.pds-c-ctrl { min-width: 74px; text-align: center; }
.pds-c-date { min-width: 120px; }
.pds-empty { text-align: center; color: #909399; padding: 18px 0; }

.pds-badge { display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 11px; line-height: 17px; }
.pds-badge.done { background: #e7f7ed; color: #1f9254; border: 1px solid #b7e3c7; }
.pds-badge.review { background: #eaf1fd; color: #2f6fbf; border: 1px solid #bfd5f5; }
.pds-badge.doing { background: #eef6ff; color: #3d7ec4; border: 1px solid #c8ddf7; }
.pds-badge.none { background: #f4f5f7; color: #909399; border: 1px solid #e0e3e8; }

@media print {
  .pds-note { display: none; }
}
</style>
