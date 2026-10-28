<!-- ============================================================================
     SupplierPrint.vue — 采购管理 · 供应商采购打印(2026-10-24)
     ----------------------------------------------------------------------------
     用户口径:「采购管理里面多增加俩个面版,一个是供应商采购打印面版……供应商可以通过登录
     供应商配置的账号登录进来,只能看到供应商采购打印面版(和对应供应商编码的数据)。
     然后供应商可以通过这个面版来查看和打印数据。没有别的权限。」
     第二轮拍板:只做采购订单;两个入口都在「智能供应链 > 采购管理」下。

     · 供应商账号登录后**只**看得到这一页(后端把 visiblePanels 裁到 SUPPLIER_PRINT,
       PortalLayout 同时去掉侧栏/页签;敲别的地址会被路由守卫送回这里)。
     · 数据隔离在服务端:所有取数走 /api/supplier/portal/*,由后端按登录账号绑定的供应商编码过滤,
       本页**不传也不采信**任何供应商编码;后端还有 SupplierPortalGuardFilter 把其余 /api 全部 403。
     · 打印:复用「采购订单」面板同一个纸质单版式(print-formats.printPuOrder)——
       供应商看到的纸面与采购部的**逐字一致**,不会出现两套版式对不上账;
       打印前先向服务端取一次该单(服务端再核一遍归属),打完把留痕记到使用记录(谁/何时/哪张单)。
     · 主数据是"只读"的:这里没有任何新增/修改/删除/审核入口,连导出都不给(用户口径「没有别的权限」)。
     ============================================================================ -->
<template>
  <div class="sp-page">
    <!-- 页头:供应商身份(让供应商一眼确认"看到的就是本公司的单") -->
    <div class="sp-head">
      <div class="sp-head-main">
        <span class="sp-title">{{ tt('供应商采购打印') }}</span>
        <el-tag v-if="me.supplierCode" size="small" type="success">{{ tt('供应商编码') }}:{{ me.supplierCode }}</el-tag>
        <span v-if="me.supplierName" class="sp-supplier">{{ me.supplierName }}</span>
      </div>
      <div class="sp-head-tools">
        <span class="sp-readonly">{{ tt('只读:仅查看与打印本公司名下的采购订单') }}</span>
      </div>
    </div>

    <!-- 查询条:关键词 / 日期区间 / 只看未关闭 -->
    <div class="sp-filter">
      <el-input v-model="filter.keyword" clearable class="sp-kw" :placeholder="tt('搜索单据编号 / 物料编码 / 物料名称')"
        @keyup.enter="search" @clear="search">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-date-picker v-model="filter.range" type="daterange" value-format="YYYY-MM-DD" class="sp-range"
        range-separator="~" :start-placeholder="tt('单据日期起')" :end-placeholder="tt('单据日期止')" />
      <el-checkbox v-model="filter.onlyOpen">{{ tt('只看未关闭') }}</el-checkbox>
      <el-button type="primary" :loading="loading" @click="search">{{ tt('查询') }}</el-button>
      <el-button :loading="loading" @click="reset">{{ tt('重置') }}</el-button>
      <span class="sp-count">{{ countText }}</span>
    </div>

    <!-- 订单清单(单点:选中行 → 看明细 / 打印) -->
    <el-table :data="rows" v-loading="loading" border stripe size="small" highlight-current-row
      :empty-text="loading ? tt('加载中…') : tt('没有符合条件的采购订单')" class="sp-table"
      @current-change="onCurrent" @row-dblclick="(row) => openDetail(row)">
      <el-table-column width="42" align="center">
        <template #default="{ row }">
          <el-radio :model-value="currentNo" :value="row.docNo" @change="pick(row)"><span></span></el-radio>
        </template>
      </el-table-column>
      <el-table-column :label="tt('单据编号')" prop="docNo" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="sp-docno" @click="openDetail(row)">{{ row.docNo }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('单据日期')" prop="docDate" width="110" />
      <el-table-column :label="tt('供应商')" prop="supplier" min-width="170" show-overflow-tooltip />
      <el-table-column :label="tt('行数')" prop="lineCount" width="70" align="right" />
      <el-table-column :label="tt('数量合计')" width="110" align="right">
        <template #default="{ row }">{{ num(row.totalQty) }}</template>
      </el-table-column>
      <el-table-column :label="tt('金额合计')" width="120" align="right">
        <template #default="{ row }">{{ num(row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column :label="tt('交货日期')" prop="deliveryDate" width="110" />
      <el-table-column :label="tt('单据状态')" width="96" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === '已审核' ? 'success' : 'info'">{{ tt(row.status || '未知') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="tt('操作')" width="132" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="openDetail(row)">{{ tt('明细') }}</el-button>
          <el-button link type="primary" size="small" @click.stop="print(row)">{{ tt('打印') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="sp-foot">
      <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total"
        :current-page="page.no" :page-size="page.size" :page-sizes="[20, 50, 100, 200]"
        @current-change="onPage" @size-change="onSize" />
    </div>

    <!-- 明细抽屉:头字段 + 行表(价格等敏感列与采购部的订单一致,供应商看得到自己的价,别人看不到) -->
    <el-drawer v-model="detailVisible" :title="tt('采购订单明细')" size="72%" append-to-body class="sp-drawer">
      <template v-if="detail">
        <el-descriptions :column="3" border size="small" class="sp-desc">
          <el-descriptions-item :label="tt('单据编号')">{{ detail.head.docNo }}</el-descriptions-item>
          <el-descriptions-item :label="tt('单据日期')">{{ detail.head.docDate }}</el-descriptions-item>
          <el-descriptions-item :label="tt('单据状态')">{{ tt(detail.head.status || '-') }}</el-descriptions-item>
          <el-descriptions-item :label="tt('供应商编码')">{{ detail.head.supplierCode }}</el-descriptions-item>
          <el-descriptions-item :label="tt('供应商')">{{ detail.head.supplier }}</el-descriptions-item>
          <el-descriptions-item :label="tt('付款方式')">{{ detail.head.payType || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="tt('交货日期')">{{ detail.head.deliveryDate || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="tt('备注')" :span="2">{{ detail.head.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="detail.lines" border stripe size="small" show-summary :sum-text="tt('合计')"
          :summary-method="summary" class="sp-lines">
          <el-table-column :label="tt('行号')" prop="lineNo" width="70" />
          <el-table-column :label="tt('物料编码')" prop="itemCode" min-width="130" show-overflow-tooltip />
          <el-table-column :label="tt('物料名称')" prop="itemName" min-width="180" show-overflow-tooltip />
          <el-table-column :label="tt('规格型号')" prop="spec" min-width="140" show-overflow-tooltip />
          <el-table-column :label="tt('单位')" prop="unit" width="70" />
          <el-table-column :label="tt('数量')" width="100" align="right">
            <template #default="{ row }">{{ num(row.qty) }}</template>
          </el-table-column>
          <el-table-column :label="tt('单价')" width="100" align="right">
            <template #default="{ row }">{{ num(row.price) }}</template>
          </el-table-column>
          <el-table-column :label="tt('金额')" width="110" align="right">
            <template #default="{ row }">{{ num(row.amount) }}</template>
          </el-table-column>
          <el-table-column :label="tt('税率%')" prop="taxRate" width="80" align="right" />
          <el-table-column :label="tt('预计到货日期')" prop="arrivalDate" width="120" />
          <el-table-column :label="tt('备注')" prop="remark" min-width="140" show-overflow-tooltip />
        </el-table>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">{{ tt('关闭') }}</el-button>
        <el-button type="primary" :loading="printing === detailNo" @click="print(detail?.head)">
          {{ tt('打印') }}
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { printPuOrder } from '@/business/print-formats'
import { tt } from '@/i18n'

const route = useRoute()

/** 服务端认定的"我是哪个供应商"(页面只展示,绝不参与过滤 —— 过滤在 SQL 里) */
const me = reactive({ supplierCode: '', supplierName: '', userName: '' })

const filter = reactive({ keyword: '', range: null, onlyOpen: false })
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const page = reactive({ no: 1, size: 20 })
const currentNo = ref('')
const detailVisible = ref(false)
const detail = ref(null)
const detailNo = ref('')
const printing = ref('')

const num = (v) => {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : String(v)
}

/**
 * 「共 N 张」= 整句一条词条(而不是拼「共」+N+「张」)——
 * 中文/日文的量词在句尾,英文/德语在数词前是复数:「Total N orders」/「Gesamt N Belege …」
 * 拆开来拼必然出现「Total 74 sheet」这种病句。词条见 en.js 等 10 个语言包。
 */
const countText = computed(() => String(tt('共 {n} 张')).replace('{n}', String(total.value)))

function pick(row) {
  currentNo.value = row?.docNo || ''
}
function onCurrent(row) {
  if (row) currentNo.value = row.docNo
}

async function loadMe() {
  try {
    const r = await request.get('/supplier/portal/me')
    const d = r?.data || {}
    me.supplierCode = d.supplierCode || ''
    me.supplierName = d.supplierName || ''
    me.userName = d.userName || ''
  } catch (e) {
    // 非供应商账号(管理员点菜单进来)会拿到 403:给出明确指引,不留白屏
    ElMessage.warning(apiMsg(e, tt('当前账号不是供应商账号,无法使用供应商采购打印')))
  }
}

async function loadOrders() {
  loading.value = true
  try {
    const [start, end] = Array.isArray(filter.range) ? filter.range : ['', '']
    const r = await request.get('/supplier/portal/orders', {
      params: {
        keyword: filter.keyword || '',
        start: start || '',
        end: end || '',
        onlyOpen: filter.onlyOpen ? 'true' : 'false',
        pageNo: page.no,
        pageSize: page.size,
      },
    })
    const d = r?.data || {}
    rows.value = d.rows || []
    total.value = Number(d.total || 0)
    if (d.supplierCode) me.supplierCode = d.supplierCode
    if (d.supplierName) me.supplierName = d.supplierName
    // 当前选中行被翻页翻走了就撤选,免得"打印"打到看不见的单
    if (currentNo.value && !rows.value.some((x) => x.docNo === currentNo.value)) currentNo.value = ''
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(apiMsg(e, tt('查询采购订单失败')))
  } finally {
    loading.value = false
  }
}

function search() {
  page.no = 1
  loadOrders()
}
function reset() {
  filter.keyword = ''
  filter.range = null
  filter.onlyOpen = false
  page.no = 1
  loadOrders()
}
function onPage(p) {
  page.no = p
  loadOrders()
}
function onSize(s) {
  page.size = s
  page.no = 1
  loadOrders()
}

async function openDetail(row) {
  if (!row?.docNo) return
  currentNo.value = row.docNo
  detailNo.value = row.docNo
  detailVisible.value = true
  detail.value = null
  try {
    const r = await request.get('/supplier/portal/order', { params: { docNo: row.docNo } })
    detail.value = r?.data || null
  } catch (e) {
    detailVisible.value = false
    ElMessage.error(apiMsg(e, tt('读取订单明细失败')))
  }
}

/** 明细表合计行(数量/金额;其余列留空) */
function summary({ columns, data }) {
  const out = columns.map((c, i) => (i === 0 ? tt('合计') : ''))
  const idx = (label) => columns.findIndex((c) => (c.label || '') === tt(label))
  const qi = idx('数量')
  const ai = idx('金额')
  if (qi >= 0) out[qi] = num(data.reduce((s, r) => s + (Number(r.qty) || 0), 0))
  if (ai >= 0) out[ai] = num(data.reduce((s, r) => s + (Number(r.amount) || 0), 0))
  return out
}

/**
 * 打印:先向服务端取**最新**的单据(服务端会再核一次"这张单是不是你的"),再走与采购部同一个纸质单版式。
 * 打印成功记留痕(POST /print)——失败只提示、不影响出纸(纸已经打出去了,留痕是旁路事实)。
 */
async function print(row) {
  const no = row?.docNo || currentNo.value
  if (!no) {
    ElMessage.warning(tt('请先选择一张采购订单'))
    return
  }
  printing.value = no
  try {
    const r = await request.get('/supplier/portal/order', { params: { docNo: no } })
    const d = r?.data || {}
    const head = d.head || {}
    const lines = d.lines || []
    if (!head.docNo) throw new Error(tt('未取到单据数据'))
    // printPuOrder 的行键(物料编码/物料名称/规格型号/单价/单位/数量/金额/预计到货日期/备注/税率%)——
    // 服务端已按这些中文键下发(见 SupplierPortalService.orderDetail),这里只做键名对齐。
    printPuOrder(
      {
        单据编号: head.docNo,
        单据日期: head.docDate,
        供应商编码: head.supplierCode,
        供应商: head.supplier,
        付款方式: head.payType,
        备注: head.remark,
      },
      lines.map((l) => ({
        物料编码: l.itemCode,
        物料名称: l.itemName,
        规格型号: l.spec,
        单位: l.unit,
        数量: l.qty,
        单价: l.price,
        金额: l.amount,
        // 「税率%」是数据键(键名带百分号,必须加引号),printPuOrder 按这个键读
        '税率%': l.taxRate,
        预计到货日期: l.arrivalDate,
        备注: l.remark,
      })),
    )
    // 留痕(谁/何时/打了哪张单)——失败不打扰出纸
    request.post('/supplier/portal/print', { docNo: no }).catch(() => {})
  } catch (e) {
    ElMessage.error(apiMsg(e, tt('打印失败')))
  } finally {
    printing.value = ''
  }
}

/** 统一取错误文案:后端的 message 优先(如"该采购订单不存在,或不属于当前供应商") */
function apiMsg(e, fallback) {
  const body = e?.response?.data
  if (body?.message) return body.message
  return e?.message || fallback
}

onMounted(async () => {
  await loadMe()
  await loadOrders()
  // 支持「从别处带单号进来」:?docNo=YJ-20260901-03 直接展开明细(只用来自本供应商的单)
  const docNo = route.query.docNo
  if (docNo) openDetail({ docNo: String(docNo) })
})
</script>

<style scoped>
.sp-page { display: flex; flex-direction: column; gap: 10px; max-width: 1500px; }
.sp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sp-head-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sp-title { font-size: 15px; font-weight: 600; color: #1c4f8a; }
.sp-supplier { font-size: 13px; color: #606266; }
.sp-readonly { font-size: 12px; color: #909399; }
.sp-filter { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sp-kw { width: 320px; }
.sp-range { width: 280px; }
.sp-count { font-size: 12px; color: #909399; margin-left: 4px; }
.sp-table { width: 100%; }
.sp-docno { color: #1c4f8a; cursor: pointer; }
.sp-docno:hover { text-decoration: underline; }
.sp-foot { display: flex; justify-content: flex-end; }
.sp-desc { margin-bottom: 10px; }
.sp-lines { width: 100%; }
.sp-lines :deep(.el-table__footer td) { font-weight: 600; background: #fafafa; }
</style>
