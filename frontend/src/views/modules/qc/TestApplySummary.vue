<!--
  TestApplySummary.vue — 「测试申请汇总表」(2026-11-19)

  用户口径(原话):「做一个类似于样品检验汇总单一样的按照人员进行一个汇总分类的有关测试申请单的
  测试申请汇总面板,还可以点击跳转到对应的测试申请单」;补充确认:
  「内部和销售端放在同一张表里查询,按申请人分组,列按你拟的」。

  形态(照 `qc/InspSummary.vue`,同一套版式与交互):
    ① 顶部 KPI(申请人数 / 申请单据数 / 检测项目项次 / 收费合计 / 已审核单数 / 待处理单数);
    ② 时间范围(今天/本周/本月/自定义)+ 申请人筛选 + 单据状态 + 关键字;
    ③ 「按申请人」「按单据」两个页签,按申请人表格可展开列出该人的单据;
    ④ 点单号 = 跳 `/panelx/list/RD_DOM_TEST?focus=<单号>` 定位那张测试申请单(无查看权只提示);
    ⑤ 导出 Excel(前端 xlsx 现生成,列序 = 页面列序 = 后端 SUMMARY_COLUMNS)。

  数据:GET /api/px/testApplySummary(后端 TestApplySummaryService,只读)。
    两张申请表 = **同一张面板 RD_DOM_TEST** 的两个页签(内部委托-测试申请单 / 销售端-测试/检测申请表),
    共用行表 rd_dom_test_detail(按 [表区] 分块)—— 所以「合并查询」就是一张头表 + 一张行表。
    状态真源 yj_doc_status;申请人按字段存在性兜底(申请人 → 发起人 → 委托人 → 业务员)。
  权限:复用测试申请单的查看权(RD_DOM_TEST),不新造页面级虚拟面板码 —— 能看到这张单的人才看得到汇总;
    导出按钮按该面板的 export 词显隐(canPanelDo)。
-->
<template>
  <div class="tas-page">
    <!-- ===== ① 工具条 ===== -->
    <div class="tas-toolbar">
      <div class="tas-head">
        <span class="tas-title">{{ tt('测试申请汇总表') }}</span>
        <span class="tas-datatime">{{ tt('数据时间') }}<em>{{ dataTime || '-' }}</em></span>
      </div>

      <div class="tas-controls">
        <el-radio-group v-model="quick" size="small" class="tas-quick" @change="onQuickChange">
          <el-radio-button value="today">{{ tt('今天') }}</el-radio-button>
          <el-radio-button value="week">{{ tt('本周') }}</el-radio-button>
          <el-radio-button value="month">{{ tt('本月') }}</el-radio-button>
          <el-radio-button value="custom">{{ tt('自定义') }}</el-radio-button>
        </el-radio-group>

        <!-- 日期区间:宽度只给两个日期 + 至 + 图标(与样品检验汇总表同一处断点)。
             ⚠ 必须内联 width/flex:Element Plus 的 .el-range-editor 自带宽度,且工具条是 flex 行。 -->
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          size="small"
          class="tas-range"
          style="width: 272px; flex: none"
          :range-separator="tt('至')"
          :start-placeholder="tt('开始日期')"
          :end-placeholder="tt('结束日期')"
          @change="onRangeChange"
        />

        <el-input v-model="applicant" size="small" clearable class="tas-kw" :placeholder="tt('申请人')"
                  @keyup.enter="search" @clear="search" />
        <el-select v-model="status" size="small" class="tas-status" @change="search">
          <el-option v-for="o in STATUS_OPTIONS" :key="o.value" :label="tt(o.label)" :value="o.value" />
        </el-select>
        <el-input v-model="keyword" size="small" clearable class="tas-kw" :placeholder="tt('单号 / 样品 / 检测项目')"
                  @keyup.enter="search" @clear="search" />

        <el-button size="small" type="primary" :loading="loading" @click="search">
          <el-icon><Search /></el-icon>
          <span>{{ tt('查询') }}</span>
        </el-button>
        <el-button size="small" :disabled="loading" @click="reset">{{ tt('重置') }}</el-button>
        <el-button v-if="canExport" size="small" type="success" plain :disabled="loading || !hasData" class="tas-export" @click="exportExcel">
          <el-icon><Download /></el-icon>
          <span>{{ tt('导出 Excel') }}</span>
        </el-button>
      </div>
    </div>

    <!-- ===== ② 汇总条 ===== -->
    <div class="tas-stats">
      <span class="tas-stat"><em>{{ tt('申请人数') }}</em><b>{{ stat['申请人数'] ?? 0 }}</b></span>
      <span class="tas-stat"><em>{{ tt('申请单据数') }}</em><b>{{ stat['申请单据数'] ?? 0 }}</b></span>
      <span class="tas-stat is-item"><em>{{ tt('检测项目项次') }}</em><b>{{ stat['检测项目项次'] ?? 0 }}</b></span>
      <span class="tas-stat is-fee"><em>{{ tt('收费合计') }}</em><b>{{ money(stat['收费合计']) }}</b></span>
      <span class="tas-stat is-done"><em>{{ tt('已审核单数') }}</em><b>{{ stat['已审核单数'] ?? 0 }}</b></span>
      <span class="tas-stat is-wait"><em>{{ tt('待处理单数') }}</em><b>{{ stat['待处理单数'] ?? 0 }}</b></span>
      <span class="tas-tip">{{ tt('统计口径：测试申请单的「单据日期」；内部委托与销售端两个页签合并统计；默认不含已作废/已中止的单；本面板暂无金额字段，收费合计按 0.00 显示') }}</span>
    </div>

    <el-alert v-if="error && hasData" class="tas-alert" type="error" :closable="false" show-icon
              :title="`${tt('加载失败')}: ${error}`" />

    <!-- ===== ③ 两个视角 ===== -->
    <section class="tas-body">
      <el-tabs v-model="tab" class="tas-tabs">
        <el-tab-pane name="applicant">
          <template #label>
            <span>{{ tt('按申请人') }}<em v-if="groups.length"> ({{ groups.length }})</em></span>
          </template>
          <el-table :data="groups" v-loading="loading" border stripe size="small" row-key="申请人"
                    class="tas-table" :empty-text="emptyText">
            <el-table-column type="expand" width="56" :label="tt('展开')">
              <template #default="{ row }">
                <div class="tas-expand">
                  <div class="tas-expand-title">{{ tt('该申请人的测试申请单') }}</div>
                  <el-table :data="row['单据明细'] || []" border size="small" class="tas-subtable" row-key="单据编号">
                    <el-table-column v-for="c in DOC_COLUMNS" :key="'g' + c.prop" :prop="c.prop" :label="tt(c.label)"
                                     :width="c.width" :min-width="c.minWidth" :align="c.align || 'left'"
                                     :show-overflow-tooltip="!!c.overflow">
                      <template v-if="c.type" #default="{ row: d }">
                        <el-link v-if="c.type === 'docno'" type="primary" :underline="false"
                                 @click="openDoc(d['单据编号'])">{{ d['单据编号'] }}</el-link>
                        <span v-else-if="c.type === 'money'">{{ money(d[c.prop]) }}</span>
                        <el-tag v-else-if="c.type === 'status'" size="small" :type="statusTag(d[c.prop])">{{ tt(d[c.prop] || '草稿') }}</el-tag>
                        <span v-else-if="c.type === 'tag'">
                          <el-tag v-if="d[c.prop]" size="small" effect="plain">{{ tt(d[c.prop]) }}</el-tag>
                          <span v-else class="tas-muted">-</span>
                        </span>
                        <span v-else class="tas-code">{{ d[c.prop] }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="申请人" :label="tt('申请人')" min-width="120" fixed />
            <el-table-column prop="申请单据数" :label="tt('申请单据数')" width="120" align="right" sortable />
            <el-table-column prop="检测项目项次" :label="tt('检测项目项次')" width="132" align="right" sortable />
            <el-table-column prop="涉及样品" :label="tt('涉及样品')" min-width="220" show-overflow-tooltip />
            <el-table-column prop="检测项目" :label="tt('检测项目')" min-width="260" show-overflow-tooltip />
            <el-table-column prop="已审核单数" :label="tt('已审核单数')" width="110" align="right" />
            <el-table-column prop="待处理单数" :label="tt('待处理单数')" width="110" align="right" />
            <el-table-column :label="tt('收费合计')" width="130" align="right" prop="收费合计" sortable>
              <template #default="{ row }">{{ money(row['收费合计']) }}</template>
            </el-table-column>
            <el-table-column prop="最近申请日期" :label="tt('最近申请日期')" width="140" sortable />
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="doc">
          <template #label>
            <span>{{ tt('按单据') }}<em v-if="docs.length"> ({{ docs.length }})</em></span>
          </template>
          <el-table :data="docs" v-loading="loading" border stripe size="small" row-key="单据编号"
                    class="tas-table" :empty-text="emptyText">
            <el-table-column type="expand" width="56" :label="tt('展开')">
              <template #default="{ row }">
                <div class="tas-expand">
                  <div class="tas-expand-title">{{ tt('该单的检测项目明细') }}</div>
                  <el-table :data="row['明细'] || []" border size="small" class="tas-subtable">
                    <el-table-column prop="序号" :label="tt('序号')" width="70" />
                    <el-table-column prop="检测项目" :label="tt('检测项目')" min-width="240" show-overflow-tooltip />
                    <el-table-column prop="样品名称" :label="tt('样品名称')" min-width="150" show-overflow-tooltip />
                    <el-table-column prop="样品型号/规格" :label="tt('样品型号/规格')" width="130" />
                    <el-table-column prop="样品数量" :label="tt('样品数量')" width="110" />
                    <el-table-column prop="备注" :label="tt('备注')" min-width="160" show-overflow-tooltip />
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-for="c in DOC_COLUMNS" :key="c.prop" :prop="c.prop" :label="tt(c.label)"
                             :width="c.width" :min-width="c.minWidth" :align="c.align || 'left'"
                             :sortable="!!c.sortable" :show-overflow-tooltip="!!c.overflow">
              <template v-if="c.type" #default="{ row }">
                <el-link v-if="c.type === 'docno'" type="primary" :underline="false"
                         @click="openDoc(row['单据编号'])">{{ row['单据编号'] }}</el-link>
                <span v-else-if="c.type === 'money'">{{ money(row[c.prop]) }}</span>
                <el-tag v-else-if="c.type === 'status'" size="small" :type="statusTag(row[c.prop])">{{ tt(row[c.prop] || '草稿') }}</el-tag>
                <span v-else-if="c.type === 'tag'">
                  <el-tag v-if="row[c.prop]" size="small" effect="plain">{{ tt(row[c.prop]) }}</el-tag>
                  <span v-else class="tas-muted">-</span>
                </span>
                <span v-else class="tas-code">{{ row[c.prop] }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { canPanelDo, canViewPanel } from '@core/auth/panelAccess'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

defineOptions({ name: 'TestApplySummary' })

/** 面板码:内部委托-测试申请单 + 销售端-测试/检测申请表 = 同一面板 RD_DOM_TEST 的两个页签 */
const PANEL_CODE = 'RD_DOM_TEST'
/** 只读汇总接口(契约见 PxController.testApplySummary:GET,参数全可选,日期缺省=今天) */
const API_SUMMARY = '/px/testApplySummary'

/**
 * 列契约:顺序必须与后端 TestApplySummaryService.SUMMARY_COLUMNS 逐字同序
 * (页面 / 导出 Excel / node:test 三方同源)。
 */
const SUMMARY_COLUMNS = ['单据日期', '单据编号', '申请人', '申请类型', '样品名称', '样品型号/规格', '样品数量', '检测项目', '检测项目数', '收费合计', '单据状态', '面板码']

/** 每列的渲染参数:type 决定单元格形态(docno 可点跳转 / money / status / tag / panel),其余交给表格默认渲染 */
const COL_META = {
  '单据日期': { width: 112, sortable: true },
  '单据编号': { width: 150, type: 'docno' },
  '申请人': { width: 110 },
  '申请类型': { width: 106, type: 'tag' },
  '样品名称': { minWidth: 160, overflow: true },
  '样品型号/规格': { width: 120, overflow: true },
  '样品数量': { width: 110 },
  '检测项目': { minWidth: 240, overflow: true },
  '检测项目数': { width: 108, align: 'right', sortable: true },
  '收费合计': { width: 110, align: 'right', type: 'money', sortable: true },
  '单据状态': { width: 100, align: 'center', type: 'status', sortable: true },
  '面板码': { width: 120, type: 'panel' },
}
const DOC_COLUMNS = SUMMARY_COLUMNS.map((label) => ({ prop: label, label, ...COL_META[label] }))

const STATUS_OPTIONS = [
  { value: '全部', label: '全部' },
  { value: '草稿', label: '草稿' },
  { value: '审批中', label: '审批中' },
  { value: '已审核', label: '已审核' },
  { value: '已作废', label: '已作废' },
  { value: '已中止', label: '已中止' },
]

const router = useRouter()
const user = useUserStore()

const quick = ref('week')
const range = ref([])
const applicant = ref('')
const status = ref('全部')
const keyword = ref('')
const tab = ref('applicant')
const loading = ref(false)
const error = ref('')
const dataTime = ref('')
const stat = ref({})
const groups = ref([])
const docs = ref([])

const hasData = computed(() => groups.value.length > 0 || docs.value.length > 0)
const emptyText = computed(() => {
  if (loading.value) return tt('加载中…')
  const [s, e] = range.value || []
  // 空态带上当前区间:用户看到 0 行时先能确认「查的是哪一段」
  return s && e ? `${tt('当前时间范围内没有测试申请单')}（${s} ~ ${e}）` : tt('暂无数据')
})
const canExport = computed(() => canPanelDo({ isAdmin: user.isAdmin, panelPerms: user.panelPerms }, PANEL_CODE, 'export'))

function pad(n) {
  return String(n).padStart(2, '0')
}
function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** 周一为一周第一天(国内口径) */
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const off = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - off)
  return x
}
function rangeOf(kind, now = new Date()) {
  if (kind === 'today') return [ymd(now), ymd(now)]
  if (kind === 'week') return [ymd(mondayOf(now)), ymd(now)]
  if (kind === 'month') return [`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, ymd(now)]
  return [ymd(now), ymd(now)]
}

/** 快捷区间:点一下即设定并查询(自定义=保留用户自己选的日期,手点查询) */
function onQuickChange(v) {
  if (v === 'custom') return
  range.value = rangeOf(v)
  search()
}
function onRangeChange(v) {
  if (!v || v.length !== 2) return
  quick.value = 'custom'
}

async function load() {
  if (!range.value || range.value.length !== 2) range.value = rangeOf('week')
  loading.value = true
  error.value = ''
  try {
    const res = await request.get(API_SUMMARY, {
      params: {
        from: range.value[0],
        to: range.value[1],
        applicant: applicant.value.trim(),
        status: status.value,
        keyword: keyword.value.trim(),
      },
    })
    if (!res || res.code !== 200) throw new Error(res?.message || tt('请求失败'))
    const data = res.data || {}
    stat.value = data['汇总'] || {}
    groups.value = Array.isArray(data['按申请人']) ? data['按申请人'] : []
    docs.value = Array.isArray(data['按单据']) ? data['按单据'] : []
    dataTime.value = data['数据时间'] || ''
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || tt('请求失败')
    error.value = msg
    stat.value = {}
    groups.value = []
    docs.value = []
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

function search() {
  load()
}

function reset() {
  quick.value = 'week'
  range.value = rangeOf('week')
  applicant.value = ''
  status.value = '全部'
  keyword.value = ''
  tab.value = 'applicant'
  load()
}

function money(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function statusTag(s) {
  if (s === '已审核') return 'success'
  if (s === '审批中') return 'warning'
  if (s === '已作废' || s === '已中止') return 'info'
  return ''
}

/** 点单号 = 跳测试申请单并定位那张单(没有该面板查看权时只提示,与品质流程监控同口径) */
function openDoc(no) {
  const code = String(no || '').trim()
  if (!code) return
  if (!canViewPanel({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }, PANEL_CODE)) {
    ElMessage.warning(tt('无查看该面板的权限'))
    return
  }
  router.push({ path: `/panelx/list/${PANEL_CODE}`, query: { focus: code } })
}

/**
 * 导出 Excel(.xlsx,单 sheet):表头 = 列契约 SUMMARY_COLUMNS,与页面列序逐字一致;
 * 由前端 xlsx 现生成(本页没有需要 Excel 下拉/合并的纸面版式,不必为它加后端 POI 端点)。
 */
async function exportExcel() {
  if (!docs.value.length) return
  const tip = ElMessage({ message: tt('正在生成 Excel…'), duration: 0 })
  try {
    const XLSX = await import('xlsx')
    const header = SUMMARY_COLUMNS.map((c) => tt(c))
    const aoa = [header]
    for (const d of docs.value) {
      aoa.push(SUMMARY_COLUMNS.map((c) => {
        if (c === '收费合计') return Number(d[c] || 0)
        if (c === '检测项目数') return Number(d[c] || 0)
        return d[c] == null ? '' : String(d[c])
      }))
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = SUMMARY_COLUMNS.map((c) => ({ wch: c === '检测项目' || c === '样品名称' ? 34 : 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '测试申请汇总表')
    const [s, e] = range.value || []
    XLSX.writeFile(wb, `测试申请汇总表_${(s || '').replace(/-/g, '')}-${(e || '').replace(/-/g, '')}.xlsx`)
    ElMessage.success(tt('已导出'))
  } catch (e) {
    ElMessage.error(e?.message || tt('导出失败'))
  } finally {
    tip.close()
  }
}

onMounted(() => {
  range.value = rangeOf('week')
  load()
})
</script>

<style scoped>
.tas-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 18px;
  min-height: 100%;
  background: #f5f7fa;
  box-sizing: border-box;
}
.tas-toolbar,
.tas-stats,
.tas-body {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.tas-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}
.tas-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.tas-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.tas-datatime {
  font-size: 12px;
  color: #909399;
}
.tas-datatime em {
  font-style: normal;
  color: #606266;
  margin-left: 4px;
}
.tas-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.tas-range {
  width: 272px;
}
.tas-kw {
  width: 150px;
}
.tas-status {
  width: 110px;
}
.tas-export {
  margin-left: auto;
}
.tas-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  padding: 10px 14px;
}
.tas-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}
.tas-stat b {
  font-size: 18px;
  color: #303133;
  font-weight: 600;
}
.tas-stat.is-item b {
  color: #409eff;
}
.tas-stat.is-fee b {
  color: #e6a23c;
}
.tas-stat.is-done b {
  color: #67c23a;
}
.tas-stat.is-wait b {
  color: #f56c6c;
}
.tas-tip {
  margin-left: auto;
  font-size: 12px;
  color: #c0c4cc;
}
.tas-alert {
  margin: 0;
}
.tas-body {
  padding: 4px 14px 14px;
  flex: 1;
  min-height: 0;
}
.tas-tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.tas-table {
  width: 100%;
}
/* 表头排序:文字与排序箭头必须同一行(与样品检验汇总表同一处返工) */
.tas-table :deep(.el-table__header .cell) {
  white-space: nowrap;
}
.tas-table :deep(.el-table__header .caret-wrapper) {
  flex: none;
}
.tas-expand {
  padding: 8px 12px;
  background: #fafbfc;
}
.tas-expand-title {
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
}
.tas-subtable {
  width: 100%;
}
.tas-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #606266;
}
.tas-muted {
  color: #c0c4cc;
}
</style>
