<!--
  InstrSummary.vue — 「仪器使用汇总表」(2026-11-20)

  用户口径:
    「为当前的试验仪器记录表创建一个汇总表,汇总表需要查看的内容如图1所示。汇总表实现可以参考样品检验汇总表。」
  图1 表样列(顺序即纸面顺序):
    仪器名称/型号 | 日期 | 起止时间 | 仪器状态 | 是否内校 | 项目名称/内容 | 数量 | 使用人 | 备注。

  形态(照「样品检验汇总表」同构):
    ① 研发管理 › 测试记录 › 实验室使用记录表 下的**独立页面**(不进记录表页签);
    ② 时间区间快捷筛选(今天/本周/本月/上月/全部/自定义)+ 仪器/使用人/关键字;
    ③ 表格可**勾选行**,「导出 Excel」只导所选;不勾 = 导当前查询结果全部;
    ④ 导出由服务端 POI 生成纸面版式(跨列大标题「实验室仪器使用记录表」+ 表头 + 记录行)。

  数据:POST /px/instrSummary/summary(后端 InstrSummaryService,只读)
    行源 = rd_instr_use_detail × rd_instr_use_head,一行 = 一条使用记录(跨全部单据/仪器)。
    
  权限:页面级虚拟面板 INSTR_SUMMARY(定义见后端 PagePanelRegistry);
    导出按钮按 pagePerms 的 export 词显隐(canDo),后端 requireButton 兜底。

  ⚠ 2026-11-19 曾在仪器使用记录表面板内加过第 2 页签「使用记录汇总」,2026-11-20 用户口径
    「不要这个页签」⇒ 页签与该端点已撤除,本页是唯一入口。
-->
<template>
  <div class="isu-page">
    <!-- ===== ① 工具条 ===== -->
    <div class="isu-toolbar">
      <div class="isu-head">
        <span class="isu-title">{{ tt('仪器使用汇总表') }}</span>
        <span class="isu-datatime">{{ tt('数据时间') }}<em>{{ dataTime || '-' }}</em></span>
      </div>

      <div class="isu-controls">
        <el-radio-group v-model="quick" size="small" class="isu-quick" @change="onQuickChange">
          <el-radio-button value="today">{{ tt('今天') }}</el-radio-button>
          <el-radio-button value="week">{{ tt('本周') }}</el-radio-button>
          <el-radio-button value="month">{{ tt('本月') }}</el-radio-button>
          <el-radio-button value="lastMonth">{{ tt('上月') }}</el-radio-button>
          <el-radio-button value="all">{{ tt('全部') }}</el-radio-button>
          <el-radio-button value="custom">{{ tt('自定义') }}</el-radio-button>
        </el-radio-group>

        <!-- 日期区间:宽度只给两个日期 + 至 + 图标(同样品检验汇总表,太宽会把后面的筛选挤走) -->
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          size="small"
          class="isu-range"
          style="width: 272px; flex: none"
          :disabled="quick === 'all'"
          :range-separator="tt('至')"
          :start-placeholder="tt('开始日期')"
          :end-placeholder="tt('结束日期')"
          @change="onRangeChange"
        />

        <el-input v-model="instrument" size="small" clearable class="isu-kw" :placeholder="tt('仪器名称/型号')"
                  @keyup.enter="search" @clear="search" />
        <el-input v-model="userName" size="small" clearable class="isu-kw is-narrow" :placeholder="tt('使用人')"
                  @keyup.enter="search" @clear="search" />
        <el-input v-model="keyword" size="small" clearable class="isu-kw" :placeholder="tt('项目名称/内容 / 备注')"
                  @keyup.enter="search" @clear="search" />

        <el-button size="small" type="primary" :loading="loading" @click="search">
          <el-icon><Search /></el-icon>
          <span>{{ tt('查询') }}</span>
        </el-button>
        <el-button size="small" :disabled="loading" @click="reset">{{ tt('重置') }}</el-button>

        <span v-if="selectedRows.length" class="isu-picked">
          {{ tt('已选') }} <b>{{ selectedRows.length }}</b> {{ tt('条记录') }}
          <el-button link type="primary" size="small" class="isu-picked-clear" @click="clearSelection">
            {{ tt('清除选择') }}
          </el-button>
        </span>
        <el-button v-if="canExport" size="small" type="success" plain :disabled="loading || !rows.length"
                   class="isu-export" @click="exportExcel">
          <el-icon><Download /></el-icon>
          <span>{{ exportLabel }}</span>
        </el-button>
      </div>
    </div>

    <!-- ===== ② 汇总条 ===== -->
    <div class="isu-stats">
      <span class="isu-stat"><em>{{ tt('记录条数') }}</em><b>{{ stat['记录条数'] ?? 0 }}</b></span>
      <span class="isu-stat is-instr"><em>{{ tt('涉及仪器') }}</em><b>{{ stat['涉及仪器'] ?? 0 }}</b></span>
      <span class="isu-stat is-user"><em>{{ tt('使用人数') }}</em><b>{{ stat['使用人数'] ?? 0 }}</b></span>
      <span class="isu-stat is-item"><em>{{ tt('涉及项目') }}</em><b>{{ stat['涉及项目'] ?? 0 }}</b></span>
      <span class="isu-tip">{{ tt('统计口径：仪器使用记录的「使用日期」（为空时用单据日期）；默认不含已作废记录') }}</span>
    </div>

    <el-alert v-if="error && rows.length" class="isu-alert" type="error" :closable="false" show-icon
              :title="`${tt('加载失败')}: ${error}`" />

    <el-alert v-if="truncated" class="isu-alert" type="warning" :closable="false" show-icon
              :title="tt('数据量超过单页上限，已只显示最近 5000 条，请缩小时间范围')" />

    <!-- ===== ③ 记录表(勾选 = 导出所选) ===== -->
    <section class="isu-body">
      <el-table ref="tableRef" :data="pageRows" v-loading="loading" border stripe size="small"
                row-key="记录id" reserve-selection class="isu-table" :empty-text="emptyText"
                @selection-change="onSelection">
        <!-- 列宽口径:default 窗口(约 1270px)内容区 ≈ 975px,9 列合计必须 ≤ 它 ——
             否则「备注」被挤到横向滚动条外(与记录表汇总页同一条教训)。
             min-width 的列分到富余宽度,大屏自动变宽。 -->
        <el-table-column type="selection" width="34" fixed :label="tt('选择')" />
        <el-table-column prop="仪器名称/型号" :label="tt('仪器名称/型号')" min-width="130" show-overflow-tooltip />
        <el-table-column prop="日期" :label="tt('日期')" width="96" sortable />
        <el-table-column prop="起止时间" :label="tt('起止时间')" width="108" show-overflow-tooltip />
        <el-table-column prop="仪器状态" :label="tt('仪器状态')" width="70" align="center" />
        <el-table-column prop="是否内校" :label="tt('是否内校')" width="70" align="center" />
        <el-table-column prop="项目名称/内容" :label="tt('项目名称/内容')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="数量" :label="tt('数量')" width="60" align="center" />
        <el-table-column prop="使用人" :label="tt('使用人')" width="76" />
        <el-table-column prop="备注" :label="tt('备注')" min-width="110" show-overflow-tooltip />
      </el-table>

      <div v-if="rows.length > pageSize" class="isu-pager">
        <el-pagination
          v-model:current-page="pageNo"
          :page-size="pageSize"
          :total="rows.length"
          layout="total, prev, pager, next, jumper"
          background
          small
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { canDo } from '@core/auth/panelAccess'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

defineOptions({ name: 'InstrSummary' })

/** 后端只读接口(契约见 InstrSummaryController:请求体条件全可空 = 不限) */
const API_SUMMARY = '/px/instrSummary/summary'
const API_EXPORT = '/px/instrSummary/export'
const PANEL = 'INSTR_SUMMARY'

const user = useUserStore()

const quick = ref('week')
const range = ref([])
const instrument = ref('')
const userName = ref('')
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const dataTime = ref('')
const stat = ref({})
const rows = ref([])
const truncated = ref(false)
const pageNo = ref(1)
const pageSize = 200
const tableRef = ref(null)
/** 勾中的行(2026-11-20):导出时只导这些记录;不勾 = 全部 */
const selectedRows = ref([])

const canExport = computed(() => canDo({ isAdmin: user.isAdmin, pagePerms: user.pagePerms }, PANEL, 'export'))
const exportLabel = computed(() => (selectedRows.value.length
  ? `${tt('导出所选 Excel')} (${selectedRows.value.length})`
  : tt('导出 Excel')))
const pageRows = computed(() => {
  const start = (pageNo.value - 1) * pageSize
  return rows.value.slice(start, start + pageSize)
})
const emptyText = computed(() => {
  if (loading.value) return tt('加载中…')
  const [s, e] = range.value || []
  if (quick.value === 'all') return tt('暂无使用记录')
  return s && e ? `${tt('当前时间范围内没有使用记录')}（${s} ~ ${e}）` : tt('暂无使用记录')
})

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
  if (kind === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return [ymd(first), ymd(last)]
  }
  return []
}

/** 快捷区间:点一下即设区间并查询(全部 = 清空区间 = 不限日期;自定义 = 用户自己选日期再点查询) */
function onQuickChange(v) {
  if (v === 'custom') return
  range.value = v === 'all' ? [] : rangeOf(v)
  search()
}
function onRangeChange(v) {
  if (!v || v.length !== 2) return
  quick.value = 'custom'
}

/** 勾选变化:Element Plus 直接给整批选中行(reserve-selection 下含跨页勾选) */
function onSelection(list) {
  selectedRows.value = Array.isArray(list) ? list : []
}
function clearSelection() {
  tableRef.value?.clearSelection?.()
  selectedRows.value = []
}

async function load() {
  if (quick.value !== 'all' && (!range.value || range.value.length !== 2)) range.value = rangeOf('week')
  clearSelection()          // 重新查询即清勾选:导出只允许针对"看得见的当前结果"
  pageNo.value = 1
  loading.value = true
  error.value = ''
  try {
    const res = await request.post(API_SUMMARY, {
      日期起: range.value?.[0] || '',
      日期止: range.value?.[1] || '',
      '仪器名称/型号': instrument.value.trim(),
      使用人: userName.value.trim(),
      keyword: keyword.value.trim(),
    })
    if (!res || res.code !== 200) throw new Error(res?.message || tt('请求失败'))
    const data = res.data || {}
    stat.value = data['汇总'] || {}
    rows.value = Array.isArray(data['列表']) ? data['列表'] : []
    truncated.value = data['截断'] === true
    dataTime.value = data['数据时间'] || ''
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || tt('请求失败')
    error.value = msg
    stat.value = {}
    rows.value = []
    truncated.value = false
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
  instrument.value = ''
  userName.value = ''
  keyword.value = ''
  load()
}

/**
 * 导出「实验室仪器使用记录表」(.xlsx)。
 *
 * 由服务端 POI 生成:第 1 行是跨 9 列的大标题,第 2 行表头,之后一行 = 一条使用记录,
 * A4 横向一页宽 —— 纸面版式只有服务端一份,前端只负责下载(与样品检验汇总表同款)。
 */
async function exportExcel() {
  if (!rows.value.length) return
  const loadingMsg = ElMessage({ message: tt('正在生成 Excel…'), duration: 0 })
  const picked = selectedRows.value.map((r) => r['记录id']).filter((v) => v != null)
  const body = {
    日期起: range.value?.[0] || '',
    日期止: range.value?.[1] || '',
    '仪器名称/型号': instrument.value.trim(),
    使用人: userName.value.trim(),
    keyword: keyword.value.trim(),
  }
  if (picked.length) body['记录id'] = picked
  try {
    const blob = await request.post(API_EXPORT, body, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const [s, e] = range.value || []
    const span = quick.value === 'all' ? '全部' : `${(s || '').replace(/-/g, '')}-${(e || '').replace(/-/g, '')}`
    a.href = url
    a.download = `实验室仪器使用记录表_${span}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    ElMessage.success(picked.length
      ? `${tt('已导出')} ${picked.length} ${tt('条记录')}`
      : tt('已导出'))
  } catch (e) {
    ElMessage.error(await blobErrorMessage(e) || tt('导出失败'))
  } finally {
    loadingMsg.close()
  }
}

/** blob 响应的错误体解析:失败时后端回 JSON(ApiResult),按 Blob.text() 读出 message */
async function blobErrorMessage(e) {
  const data = e?.response?.data
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text())?.message || '' } catch { /* 非 JSON 走兜底 */ }
  }
  return e?.response?.data?.message || e?.message || ''
}

onMounted(() => {
  range.value = rangeOf('week')
  load()
})
</script>

<style scoped>
.isu-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 18px;
  min-height: 100%;
  background: #f5f7fa;
  box-sizing: border-box;
}
.isu-toolbar,
.isu-stats,
.isu-body {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.isu-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}
.isu-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.isu-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.isu-datatime {
  font-size: 12px;
  color: #909399;
}
.isu-datatime em {
  font-style: normal;
  color: #606266;
  margin-left: 4px;
}
.isu-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.isu-range {
  width: 272px;
}
.isu-kw {
  width: 150px;
}
.isu-kw.is-narrow {
  width: 110px;
}
/* 勾选回显:紧跟导出按钮左侧,靠 .isu-export 的 margin-left:auto 一起贴右 */
.isu-picked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #606266;
}
.isu-picked b {
  color: #409eff;
  font-weight: 600;
}
.isu-picked-clear {
  padding: 0;
}
.isu-export {
  margin-left: auto;
}
.isu-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 10px 14px;
}
.isu-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}
.isu-stat b {
  font-size: 18px;
  color: #303133;
  font-weight: 600;
}
.isu-stat.is-instr b {
  color: #409eff;
}
.isu-stat.is-user b {
  color: #67c23a;
}
.isu-stat.is-item b {
  color: #e6a23c;
}
.isu-tip {
  margin-left: auto;
  font-size: 12px;
  color: #c0c4cc;
}
.isu-alert {
  margin: 0;
}
.isu-body {
  padding: 12px 14px 14px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.isu-table {
  width: 100%;
}
/* 表头文字与排序箭头同一行(与样品检验汇总表同因:列宽不足时 caret 会折到第二行) */
.isu-table :deep(.el-table__header .cell) {
  white-space: nowrap;
}
.isu-table :deep(.el-table__header .caret-wrapper) {
  flex: none;
}
.isu-pager {
  display: flex;
  justify-content: flex-end;
}
</style>
