<!-- WorkOrderList.vue — 生产工单(2026-09-26 用户拍板:纯查询页,数据=参考库工单表 plang)
     顶部 日期范围 + 单框模糊搜索(工单号/物料/客户/产品 多列 OR);按钮条 结案/取消结案/打印工单(勾选多个=批量)/打印领料单/导出/刷新;
     产线筛选 + 未完工/已完工/追溯;明细大表(勾选+操作列 BOM明细)。打印工单=勾选行直打+留痕;结案走 plang 专属端点。 -->
<template>
  <div class="wol-page">
    <!-- 查询行:日期范围 + 单框模糊搜索 -->
    <div class="wol-query">
      <span class="wol-lb">{{ tt('日期范围') }}</span>
      <el-date-picker v-model="dateFrom" type="date" value-format="YYYY-MM-DD" size="small" style="width: 130px" />
      <span class="wol-sep">-</span>
      <el-date-picker v-model="dateTo" type="date" value-format="YYYY-MM-DD" size="small" style="width: 130px" />
      <span class="wol-lb" style="margin-left: 12px">{{ tt('模糊搜索') }}</span>
      <el-input v-model="qText" size="small" style="width: 220px" :placeholder="tt('输入查询条件...')" clearable @keyup.enter="load" />
      <el-button size="small" type="success" @click="load">{{ tt('查找') }}</el-button>
      <span class="wol-count">{{ tt('共有数据') }}: <b>{{ rows.length }}</b> {{ tt('条') }}</span>
    </div>

    <!-- 按钮条(2026-09-28 用户拍板:生产工单=纯汇总视图——数据只由订单结转产生,排产唯一入口=快速排产;
         撤排产按钮防中间节点误操作;保留 查询/筛选/打印/结案留痕) -->
    <div class="wol-btns">
      <el-button size="small" type="success" plain @click="onClose(true)" :disabled="!checked.length">{{ tt('结案') }}</el-button>
      <el-button size="small" type="success" plain @click="onClose(false)" :disabled="!checked.length">{{ tt('取消结案') }}</el-button>
      <el-dropdown split-button size="small" type="primary" @click="doPrintTask('成型生产任务单')" @command="doPrintTask"
                   :disabled="!checked.length && !currentRow">
        {{ tt('打印工单') }}
        <template #dropdown>
          <el-dropdown-item command="成型生产任务单">{{ tt('成型生产任务单') }}</el-dropdown-item>
          <el-dropdown-item command="组装生产任务单">{{ tt('组装生产任务单') }}</el-dropdown-item>
          <el-dropdown-item command="生产投料单" divided>{{ tt('生产投料单') }}</el-dropdown-item>
        </template>
      </el-dropdown>
      <el-button size="small" @click="printPick" :disabled="!checked.length">{{ tt('打印领料单') }}</el-button>
      <el-button size="small" type="primary" @click="exportCsv">{{ tt('导出') }}</el-button>
      <el-button size="small" @click="load">{{ tt('刷新') }}</el-button>
    </div>

    <!-- 产线筛选条 -->
    <div class="wol-line">
      <span class="wol-lb">{{ tt('生产线') }}:</span>
      <el-select v-model="lineFilter" size="small" clearable filterable style="width: 170px" :placeholder="tt('全部产线')" @change="load">
        <el-option v-for="l in lines" :key="l.v" :label="l.t" :value="l.v" />
      </el-select>
      <span class="wol-lb" style="margin-left: 10px">{{ tt('产线代号') }}:</span>
      <el-input v-model="lineCode" size="small" style="width: 120px" readonly />
      <span class="wol-lb" style="margin-left: auto">{{ tt('筛选') }}:</span>
      <el-radio-group v-model="stateFilter" size="small" @change="applyFilter">
        <el-radio-button value="">{{ tt('全部') }}</el-radio-button>
        <el-radio-button value="未完工">{{ tt('未完工') }}</el-radio-button>
        <el-radio-button value="已完工">{{ tt('已完工') }}</el-radio-button>
      </el-radio-group>
      <el-button size="small" plain style="margin-left: 10px" @click="openTrace" :disabled="!currentRow">{{ tt('追溯') }}</el-button>
    </div>

    <!-- 明细大表 -->
    <el-table :data="paged" border size="small" class="wol-table" height="100%"
              @selection-change="(r) => (checked = r)" @current-change="(r) => (currentRow = r)"
              highlight-current-row row-key="rowKey">
      <el-table-column type="selection" width="40" fixed="left" reserve-selection />
      <el-table-column :label="tt('操作')" width="90" fixed="left">
        <template #default="{ row }">
          <el-link type="primary" :underline="false" @click.stop="showBom(row)">{{ tt('BOM明细') }}</el-link>
        </template>
      </el-table-column>
      <el-table-column :label="tt('公司代码')" prop="公司代码" width="90" show-overflow-tooltip />
      <el-table-column :label="tt('工单号')" prop="加工单号" width="150" sortable show-overflow-tooltip />
      <el-table-column :label="tt('工单行号')" prop="行号" width="90" sortable />
      <el-table-column :label="tt('批次号')" prop="批次号" width="100" sortable />
      <el-table-column :label="tt('工单日期')" prop="单据日期" width="100" sortable />
      <el-table-column :label="tt('转单时间')" prop="转单时间" width="140" sortable show-overflow-tooltip />
      <el-table-column :label="tt('物料编码')" prop="物料编码" width="130" show-overflow-tooltip />
      <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="180" show-overflow-tooltip />
      <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="160" show-overflow-tooltip />
      <el-table-column :label="tt('客户')" prop="客户" min-width="120" show-overflow-tooltip />
      <el-table-column :label="tt('生产线')" prop="生产线" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('需求数量')" prop="需求数量" width="100" align="right" sortable />
      <el-table-column :label="tt('排产数量')" prop="排产数量" width="90" align="right" />
      <el-table-column :label="tt('入库数量')" prop="入库数量" width="90" align="right" />
      <el-table-column :label="tt('余量')" prop="余量" width="90" align="right" />
      <el-table-column :label="tt('领料单号')" prop="领料单号" width="150" show-overflow-tooltip />
      <el-table-column :label="tt('打印人')" prop="打印人" width="90" />
      <el-table-column :label="tt('打印时间')" prop="打印时间" width="140" />
      <el-table-column :label="tt('生产状态')" width="90" fixed="right">
        <template #default="{ row }">
          <el-link type="primary" :underline="true" @click.stop="openSegments(row)">
            {{ tt(row.生产状态) }}
          </el-link>
        </template>
      </el-table-column>
      <el-table-column :label="tt('结案')" width="70" fixed="right">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.结案 === 'Y' }">{{ row.结案 === 'Y' ? tt('已结案') : '-' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- BOM明细弹窗 -->
    <el-dialog v-model="bomVisible" :title="tt('BOM明细') + ' — ' + (bomRow?.加工单号 || '')" width="760px" append-to-body>
      <el-table :data="bomRows" border size="small" max-height="420" v-loading="bomLoading">
        <el-table-column :label="tt('层级')" prop="层级" width="70" />
        <el-table-column :label="tt('子件编码')" prop="子件编码" width="130" />
        <el-table-column :label="tt('子件名称')" prop="子件名称" min-width="160" />
        <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="140" />
        <el-table-column :label="tt('计量单位')" prop="子件计量单位" width="90" />
        <el-table-column :label="tt('定额数量')" prop="定额数量" width="100" align="right" />
      </el-table>
    </el-dialog>

    <!-- 分段排产记录弹窗(2026-09-28):按 工单行号(=订单行,物料不同)分组汇总 + 全部批次分段明细 -->
    <el-dialog v-model="segVisible" :title="tt('分段排产记录') + ' — ' + (segRow?.加工单号 || '')" width="1080px" append-to-body>
      <div v-for="g in (segData?.分组 || [])" :key="g.工单行号" class="wol-segsum">
        <span class="ln">{{ tt('工单行号') }}{{ g.工单行号 }} · {{ g.产品名称 }}<template v-if="g.规格型号"> ({{ g.规格型号 }})</template></span>
        <span>{{ tt('需求') }}: <b>{{ num(g.需求数量) }}</b></span>
        <span>{{ tt('累计排产') }}: <b>{{ num(g.累计排产) }}</b></span>
        <span>{{ tt('累计入库') }}: <b>{{ num(g.累计入库) }}</b></span>
        <span>{{ tt('订单余量') }}: <b>{{ num(g.订单余量) }}</b></span>
        <span>{{ tt('分段') }}: <b>{{ g.分段行数 }}</b></span>
      </div>
      <el-table :data="segData?.分段 || []" border size="small" max-height="420" v-loading="segLoading">
        <el-table-column :label="tt('工单行号')" prop="工单行号" width="80" />
        <el-table-column :label="tt('物料编码')" prop="物料编码" width="110" show-overflow-tooltip />
        <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="150" show-overflow-tooltip />
        <el-table-column :label="tt('批次号')" prop="批次号" width="95" />
        <el-table-column :label="tt('生产线')" prop="生产线" width="100" show-overflow-tooltip />
        <el-table-column :label="tt('转单时间')" prop="转单时间" width="140" />
        <el-table-column :label="tt('排产数量')" prop="排产数量" width="85" align="right" />
        <el-table-column :label="tt('入库数量')" prop="入库数量" width="85" align="right" />
        <el-table-column :label="tt('已报工')" prop="已报工" width="85" align="right" />
        <el-table-column :label="tt('未交量')" prop="未交量" width="85" align="right" />
        <el-table-column :label="tt('计划完工日')" prop="计划完工日" width="100" />
        <el-table-column :label="tt('排产人')" prop="排产人" width="85" />
        <el-table-column :label="tt('转单人')" prop="转单人" width="85" />
        <el-table-column :label="tt('生产状态')" prop="生产状态" width="80">
          <template #default="{ row }">
            <span :class="{ 'wol-closed': row.生产状态 === '完工' }">{{ tt(row.生产状态) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { printWorkTaskSheet, printFeedingSheet } from '@/business/print-formats'
import { useUserStore } from '@/stores/user'

const rows = ref([])
const checked = ref([])
const currentRow = ref(null)
const lines = ref([])
const lineFilter = ref('')
const lineCode = ref('')
const stateFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const qText = ref('')
const bomVisible = ref(false)
const segVisible = ref(false)
const segLoading = ref(false)
const segRow = ref(null)
const segData = ref(null)
const bomRow = ref(null)
const bomRows = ref([])
const bomLoading = ref(false)

const filtered = computed(() => rows.value.filter((r) => {
  if (stateFilter.value === '未完工' && r.生产状态 === '完工') return false
  if (stateFilter.value === '已完工' && r.生产状态 !== '完工') return false
  return true
}))
const paged = computed(() => filtered.value)

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

async function load() {
  try {
    const cond = {}
    if (dateFrom.value) cond['日期从'] = dateFrom.value
    if (dateTo.value) cond['日期到'] = dateTo.value
    if (qText.value.trim()) cond['keyword'] = qText.value.trim()
    if (lineFilter.value) cond['生产线'] = lineFilter.value
    const res = await request.post('/px/workOrderList', cond)
    rows.value = (res.data || []).map((r) => ({ ...r, rowKey: String(r.行id ?? (r.工单号 + '#' + r.工单行号)) }))
    applyLineMeta()
  } catch (e) { err(e, '查询失败') }
}

async function loadLines() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: new Date().toISOString().slice(0, 10) })
    lines.value = [...new Map((res.data || []).map((x) => [x['生产线'], { v: x['生产线'], t: x['生产线'] + (x['生产车间'] ? '·' + x['生产车间'] : '') }])).values()]
  } catch { /* 不阻断 */ }
}

function applyLineMeta() {
  const l = lines.value.map((x) => x.v)
  for (const r of rows.value) if (!r.生产线) r.生产线 = ''
  lineCode.value = lineFilter.value ? (lines.value.find((x) => x.v === lineFilter.value)?.t.split('·')[1] || '') : ''
  void l
}

// 排产写入口已撤(2026-09-28 用户拍板):生产工单=纯汇总视图,数据只由订单结转产生;
// 排产/改数量/换线 → 一律走「快速排产」唯一入口(/px/scheduleBoard/assign)。

async function onClose(close) {
  const nos = [...new Set(checked.value.map((r) => r.工单号))]
  if (!nos.length) return
  try {
    await ElMessageBox.confirm(
      `${tt('确认')} ${close ? tt('结案') : tt('取消结案')} ${nos.length} ${tt('张工单')}?`,
      tt(close ? '结案' : '取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/close', {
      结案: close,
      rows: checked.value.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
    })
    if (res.status === 200) { ElMessage.success(tt('操作成功')); load() }
  } catch (e) { err(e, '操作失败') }
}

/**
 * 打印工单(三模板可选,2026-09-27):勾选行直打,打印留痕回写 plang。
 *   成型生产任务单/组装生产任务单 = 行表任务单(横版,列见截图版式);
 *   生产投料单 = 每工单一页,物料行 = 默认 BOM × 需求数量(/px/workOrderBom)。
 */
async function doPrintTask(mode) {
  const src = checked.value.length ? checked.value : (currentRow.value ? [currentRow.value] : [])
  if (!src.length) { ElMessage.warning(tt('请先勾选要打印的工单')); return }
  try {
    let okPrint = false
    if (mode === '生产投料单') {
      const orders = []
      for (const r of src) {
        let bom = []
        try {
          const res = await request.post('/px/workOrderBom', { 产品编码: r.物料编码 })
          bom = (res.data || []).map((b) => ({
            物料编码: b.子件编码, 物料名称: b.子件名称, 规格型号: b.规格型号,
            数量: Math.round(Number(b.定额数量 || 0) * Number(r.需求数量 || 0) * 10000) / 10000,
            单位: b.子件计量单位 || '', 行备注: '',
          }))
        } catch (e) { bom = [] }
        orders.push({
          单据编号: r.工单号, 产品编码: r.物料编码, 产品名称: r.产品名称,
          产品规格: r.规格型号 || '', 数量: r.需求数量, 客户名称: r.客户 || '',
          计划完工日期: r.计划完工日期 || '', 制单人: useUserStore().realName, bom,
        })
      }
      okPrint = await printFeedingSheet(orders)
    } else {
      const rowsToPrint = src.map((r) => ({
        单据编号: r.工单号,
        公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
        是否重点管控产品: r.重点管控 || '',
        商品编码: r.物料编码 || '',
        商品名称: r.产品名称 || '',
        规格型号: r.规格型号 || '',
        订单数量: r.需求数量,
        成型折算后数量: r.排产数量,
        计划完工日期: r.计划完工日期 || '',
        批号: r.批号 || '', 物料编码: r.物料编码 || '',
        排产数量: r.排产数量, 生产线: r.生产线 || lineFilter.value || '',
      }))
      okPrint = await printWorkTaskSheet(mode, rowsToPrint, { line: lineFilter.value || '', preparedBy: useUserStore().realName })
    }
    if (okPrint) {
      await request.post('/px/workOrderList/printStamp', {
        rows: src.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
      })
    }
    load()
  } catch (e) { err(e, '打印失败') }
}

async function printPick() {
  const no = currentRow.value?.工单号 || checked.value[0]?.工单号
  if (!no) return
  try {
    const res = await request.post('/px/scheduleBoard/trace', { 工单号: no })
    const pick = res.data?.领料数据 || []
    if (!pick.length) { ElMessage.warning(tt('该工单暂无领料单')); return }
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>${tt('打印领料单')} ${no}</title>
      <style>body{font-family:Microsoft YaHei,sans-serif;padding:24px}h2{margin:0 0 12px}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px 10px;font-size:13px}
      th{background:#f0f0f0}</style></head><body>
      <h2>${tt('打印领料单')} — ${no}</h2>
      <table><tr><th>${tt('领料单号')}</th><th>${tt('日期')}</th></tr>
      ${pick.map((p) => `<tr><td>${p.单据编号 || ''}</td><td>${(p.单据日期 || '').slice(0, 10)}</td></tr>`).join('')}
      </table></body></html>`)
    win.document.close()
    win.focus()
    win.print()
  } catch (e) { err(e, '打印失败') }
}

async function showBom(row) {
  bomRow.value = row
  bomVisible.value = true
  bomLoading.value = true
  try {
    const res = await request.post('/px/workOrderBom', { 产品编码: row.物料编码 })
    bomRows.value = res.data || []
  } catch (e) { err(e, '查询失败'); bomRows.value = [] }
  bomLoading.value = false
}

/** 分段排产记录(2026-09-28):点击生产状态 → 同工单号全部分段批次行+订单级汇总 */
async function openSegments(row) {
  segRow.value = row
  segVisible.value = true
  segLoading.value = true
  segData.value = null
  try {
    const res = await request.post('/px/workOrderList/segments', { 工单号: row.工单号 })
    segData.value = res.data || null
  } catch (e) { err(e, '查询失败'); segData.value = null }
  segLoading.value = false
}

function openTrace() {
  const no = currentRow.value?.工单号 || checked.value[0]?.工单号
  if (!no) return
  request.post('/px/scheduleBoard/trace', { 工单号: no }).then((res) => {
    ElMessageBox.alert(
      `<b>${tt('工单')}</b> ${no}<br/>
       <b>${tt('生产线')}</b> ${res.data?.头信息?.生产线 || '-'}<br/>
       <b>${tt('生产状态')}</b> ${res.data?.头信息?.生产状态 || '-'}<br/>
       <b>${tt('排产数量')}</b> ${num(res.data?.排产数据?.排产数量)} ｜ <b>${tt('已报工')}</b> ${num(res.data?.完工数据?.已报工)} ｜ <b>${tt('入库数量')}</b> ${num(res.data?.完工数据?.入库数量)}
       ${res.data?.流转时间线 ? `<hr/><div style="max-height:220px;overflow:auto">${res.data.流转时间线.map((x) => `<div>· ${x.时间 || ''} ${x.事件 || ''}</div>`).join('')}</div>` : ''}`,
      tt('追溯') + ' — ' + no, { dangerouslyUseHTMLString: true, confirmButtonText: tt('知道了') })
  }).catch((e) => err(e, '查询失败'))
}

function exportCsv() {
  const head = ['公司代码', '工单号', '工单行号', '批次号', '单据日期', '转单时间', '物料编码', '产品名称', '规格型号', '客户', '生产线', '需求数量', '排产数量', '入库数量', '余量', '领料单号', '打印人', '打印时间', '生产状态', '结案']
  const csv = '\ufeff' + [head.join(',')]
    .concat(filtered.value.map((r) => head.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `工单排产列表-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

onMounted(() => { load(); loadLines() })
</script>

<style scoped>
.wol-page { padding: 8px 12px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #fff; overflow: auto; }
.wol-query, .wol-btns, .wol-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wol-query { padding: 6px 0; border-bottom: 1px solid #eee; }
.wol-lb { font-size: 13px; color: #606266; }
.wol-sep { color: #909399; }
.wol-count { margin-left: auto; font-size: 13px; color: #303133; }
.wol-table { flex: 1; min-height: 0; }
.wol-closed { color: #f56c6c; font-weight: 600; }
.wol-segsum { display: flex; gap: 18px; flex-wrap: wrap; padding: 6px 2px 10px; font-size: 13px; color: #606266; border-bottom: 1px dashed #e4e7ed; margin-bottom: 2px; }
.wol-segsum b { color: #303133; margin-left: 2px; }
.wol-segsum .ln { color: #409eff; font-weight: 600; }
</style>
