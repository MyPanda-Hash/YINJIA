<!-- WorkOrderCreatePage.vue — 生产工单「新增」**整页编制** + 保存草稿(2026-11-13 方案 A)
     入口:生产工单页「新增」按钮 → router.push('/prod/plan/workOrderCreate');
           草稿箱「继续编辑」→ router.push('/prod/plan/workOrderCreate?draftId=<草稿id>')。
     本页由上一轮的 WorkOrderCreateDialog.vue(弹窗)整份迁移而来,内容同源:
       · 两个页签只做**类型选择**(常规/临时),公共表单只写一份 —— 常规工单不填子件,
         领料按产品的标准组装 BOM 取料;临时工单的子件落本工单自己的 wo_bom;
       · 主物料:产品编码远程搜 `/px/invOptions?panelCode=WORK_ORDER_LIST&keyword=`,
         选中后 `/px/workOrderList/productInfo` 回填 名称/规格/单位 并给默认工艺路线;
       · 工艺路线只允许**已审核**(未审核 disabled + 后缀标注;2026-10-16 用户口径)。
     本轮新增(用户口径:「新建的生产工单如何实现保存草稿?是否用页面形式更好?」→ 拍板方案 A):
       · 整页编制:顶部「返回列表」+ 标题 + 草稿号/更新时间;底部固定操作条
         「保存草稿 / 提交生成工单 / 返回列表」;
       · **保存草稿**:最小校验(仅产品编码必填)→ `POST /px/workOrderList/draft/save`
         (新草稿 草稿id:0,已有 id 覆盖)→ 更新草稿号/草稿id,**不跳走**;
         草稿存**独立草稿表**,不写 plang ⇒ 草稿态不会进待排产/报工/领料;
       · **提交**:`validateWorkOrder` 全量校验(路线审核/数量/临时行)→ 有草稿id 走
         `draft/submit`,没有草稿走 `workOrderList/create`;成功跳回列表并带 keyword 定位新单;
       · **离开守卫**:与「最后一次保存/提交成功的快照」比较(formSnapshot),
         有未保存修改 → ElMessageBox.confirm 问一句再走。
     校验/请求体组装/快照全在 business/workOrderCreate.js(纯函数,带 node --test 单测);
     本组件只负责请求、渲染与提示。显示层文案一律 tt()(新词条由 Lead 统一追加 en.js,本文件不改它)。 -->
<template>
  <div class="wop-page">
    <!-- ① 顶部:返回列表 + 标题 + 草稿号/更新时间 -->
    <header class="wop-head">
      <el-button text class="wop-back" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>{{ tt('返回列表') }}</span>
      </el-button>
      <h1 class="wop-title">{{ tt('新增生产工单') }}</h1>
      <el-tag v-if="draftNo" size="small" type="info" effect="plain">{{ tt('草稿') }}</el-tag>
      <div class="wop-meta">
        <span v-if="draftNo" class="wop-meta-item">{{ tt('草稿号') }}: {{ draftNo }}</span>
        <span v-if="savedAt" class="wop-meta-item">{{ tt('更新时间') }}: {{ savedAt }}</span>
      </div>
    </header>

    <!-- ② 中间:页签 + 表单 + 临时工单用料 -->
    <div v-loading="loading" class="wop-body">
      <!-- 页签按钮:只切换「工单类型」,公共表单两个页签共用(避免同一份字段写两遍) -->
      <el-tabs v-model="kind" class="wop-tabs">
        <el-tab-pane :label="tt('常规工单')" :name="KIND_NORMAL" />
        <el-tab-pane :label="tt('临时工单')" :name="KIND_TEMP" />
      </el-tabs>

      <div v-if="isTemp" class="wop-sec">{{ tt('主物料') }}</div>

      <el-form :label-width="96" size="small" class="wop-form" @submit.prevent>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item :label="tt('产品编码')" required>
              <!-- 远程搜商品档案(INV):label = 编码 — 名称;空关键字不发请求
                   (档案面板不吃 pageSize,空关键字等于把整份 bs_inv 拉回来) -->
              <el-select v-model="form.产品编码" filterable remote clearable
                         :remote-method="searchProducts" :loading="productLoading"
                         :placeholder="tt('搜索')" style="width: 100%" @change="onProductPick">
                <el-option v-for="o in productOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="tt('产品名称')">
              <el-input :model-value="form.产品名称" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="tt('规格型号')">
              <el-input :model-value="form.规格型号" readonly />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item :label="tt('计量单位')">
              <el-input :model-value="form.计量单位" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="tt('客户')">
              <el-select v-model="form.客户编码" filterable clearable :placeholder="tt('搜索')"
                         style="width: 100%" @change="onCustomerPick">
                <el-option v-for="c in customers" :key="c.客户编码" :label="customerLabel(c)"
                           :value="c.客户编码" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="tt('订单数量')" required>
              <!-- 改订单数量时:生产数量还没被手改过,或仍等于旧订单数量 ⇒ 跟着同步(契约口径) -->
              <el-input-number v-model="form.订单数量" :min="0" :controls="false" style="width: 100%"
                               @change="onOrderQtyChange" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item :label="tt('生产数量')" required>
              <el-input-number v-model="form.生产数量" :min="0" :controls="false" style="width: 100%"
                               @change="producedTouched = true" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="tt('工单日期')">
              <el-date-picker v-model="form.工单日期" type="date" value-format="YYYY-MM-DD"
                              style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="tt('计划开工日期')">
              <el-date-picker v-model="form.计划开工日期" type="date" value-format="YYYY-MM-DD"
                              style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item :label="tt('交期')">
              <el-date-picker v-model="form.交期" type="date" value-format="YYYY-MM-DD"
                              style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item :label="tt('工艺路线')" required>
              <!-- 只允许「已审核」的路线(2026-10-16 用户口径:工艺路线审核完成后才能被使用);
                   未审核的置灰,label 后缀标（未审核）让用户知道卡在哪 -->
              <el-select v-model="form.工艺路线" filterable clearable :placeholder="tt('请选择工艺路线')"
                         style="width: 100%">
                <el-option v-for="r in routes" :key="r.编码" :label="routeLabel(r)" :value="r.编码"
                           :disabled="!isAudited(r)" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item :label="tt('备注')">
              <el-input v-model="form.备注" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <!-- 临时工单额外:本工单自己的用料(临时 BOM) -->
      <template v-if="isTemp">
        <el-alert type="info" :closable="false" show-icon class="wop-alert"
                  :title="tt('临时工单的用料保存到本工单自己的物料清单（临时BOM），领料/报工优先按它取料；常规工单不用填子件，领料按产品的《组装物料清单》标准BOM取料')" />

        <div class="wop-sub-h">
          <span class="wop-sub-t">{{ tt('临时工单用料') }}</span>
          <el-button size="small" :loading="bomLoading" @click="loadStdBom">{{ tt('从标准BOM带出') }}</el-button>
          <el-button size="small" type="primary" plain @click="addLine">{{ tt('添加行') }}</el-button>
        </div>

        <el-table :data="lines" size="small" border max-height="460" class="wop-tb"
                  :empty-text="tt('临时工单至少要填写一行所需物料（子件）')" :row-class-name="bomRowCls">
          <el-table-column :label="tt('行序')" width="60" align="center">
            <template #default="{ row }">{{ row.行序 }}</template>
          </el-table-column>
          <el-table-column :label="tt('子件编码')" width="200">
            <template #default="{ row }">
              <!-- 子件也远程搜商品档案;选中后回填 名称/规格/单位(invOptions 行的 存货名称/规格型号/计量单位) -->
              <el-select v-model="row.子件编码" filterable remote clearable size="small"
                         :remote-method="searchComponents" :loading="partLoading"
                         :placeholder="tt('搜索')" style="width: 100%" @change="() => onComponentPick(row)">
                <el-option v-for="o in partOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column :label="tt('子件名称')" prop="子件名称" min-width="140" show-overflow-tooltip />
          <el-table-column :label="tt('子件规格')" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row.子件规格 || '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('计量单位')" width="90">
            <!-- 单位可改:档案口径不一定等于现场领料口径(与标准 BOM 一致允许人工覆盖) -->
            <template #default="{ row }"><el-input v-model="row.计量单位" size="small" /></template>
          </el-table-column>
          <el-table-column :label="tt('标准用量')" width="105" align="right">
            <template #default="{ row }">
              <el-input-number v-model="row.标准用量" :min="0" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column :label="tt('损耗量')" width="95" align="right">
            <template #default="{ row }">
              <el-input-number v-model="row.损耗量" :min="0" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column :label="tt('行备注')" min-width="120">
            <template #default="{ row }"><el-input v-model="row.行备注" size="small" /></template>
          </el-table-column>
          <el-table-column :label="tt('操作')" width="72" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeLine($index)">{{ tt('删除') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>

    <!-- ③ 底部固定操作条 -->
    <footer class="wop-foot">
      <el-button :loading="draftSaving" @click="saveDraft">{{ tt('保存草稿') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ tt('提交生成工单') }}</el-button>
      <el-button @click="goBack">{{ tt('返回列表') }}</el-button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import request from '@core/request'
import { tt } from '@/i18n'
// 商品档案行归一:档案面板返回「虚拟单 {list:[{detail:{inv:[...]}}]}」而不是平表,
// 直接 res.data.list 会拿到 0 行(RecipeCalcDialog/XsinterCalcDialog 同一套取数)
import { invRowsOf } from '@/core/panel/invCarry.js'
import { useUserStore } from '@/stores/user'
import { canDo } from '@core/auth/panelAccess'
import {
  KIND_NORMAL, KIND_TEMP, WORK_ORDER_PANEL,
  blankBomLine, blankForm, buildCreatePayload, buildDraftPayload, draftToState, formSnapshot,
  lineProblem, mapStdBomLines, nextLineSeq, pickDefaultRoute, renumberLines, validateWorkOrder,
} from '@/business/workOrderCreate'

/** 提交成功后回到生产工单列表(?keyword=单号 定位新单;WorkOrderList 已支持) */
const LIST_PATH = '/prod/plan/workOrderList'

const route = useRoute()
const router = useRouter()
// 页面级动作权限(与 WorkOrderList 同一词表):无 create 词 ⇒ 提示并回列表(后端同口径兜底)
const user = useUserStore()

/** 页签(值 = 数据键 常规/临时,永不翻译;显示层用 tt('常规工单'/'临时工单')) */
const kind = ref(KIND_NORMAL)
const isTemp = computed(() => kind.value === KIND_TEMP)

/** 公共表单(键名与契约一致,提交前由 buildCreatePayload/buildDraftPayload 规范化) */
const form = ref(blankForm())
/** 临时工单用料行(仅临时页签使用) */
const lines = ref([])

/** 参考数据:可选工艺路线 / 客户 / options(默认工艺路线) */
const routes = ref([])
const customers = ref([])
const options = ref({})

/** 产品候选(远程搜)、子件候选(远程搜,各页签共用一个候选池) */
const productOptions = ref([])
const productLoading = ref(false)
const partOptions = ref([])
const partLoading = ref(false)

/** 草稿:草稿id(0 = 还没存过)、草稿号、最后保存时间(GDD 号由后端取号) */
const draftId = ref(0)
const draftNo = ref('')
const savedAt = ref('')

/** 「最后一次保存/提交成功」的状态快照(脏检查唯一依据;空串 = 还没初始化完) */
const lastSnapshot = ref('')

const loading = ref(true)
const draftSaving = ref(false)
const submitting = ref(false)
const bomLoading = ref(false)
/** 校验失败后才给问题行标红(刚点「添加行」的空行不先飘红,免得一打开就满屏红) */
const showErrors = ref(false)
/** 生产数量是否被手工改过(没改过 ⇒ 跟着订单数量同步) */
const producedTouched = ref(false)
const prevOrderQty = ref(undefined)
/** 当前明细是用哪个主物料带出来的(换主物料时据此清掉旧料,避免把 A 的用料存到 B 上) */
const bomProductCode = ref('')

/** 有未保存修改(离开守卫用;初始化完成前一律不算脏) */
const isDirty = computed(
  () => lastSnapshot.value !== '' && formSnapshot(form.value, lines.value, kind.value) !== lastSnapshot.value,
)

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())
const sameQty = (a, b) => (Number(a) || 0) === (Number(b) || 0)
const isAudited = (r) => str(r && r.审核状态) === '已审核'

/** 商品档案行 → el-select 候选(label = 编码 — 名称;row 留着选中后回填用) */
function toInvOptions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      value: str(r && r.存货编码),
      label: `${str(r && r.存货编码)} — ${str(r && r.存货名称)}`,
      row: r || {},
    }))
    .filter((o) => o.value)
}

/** 客户下拉(客户编码/客户名称都是业务事实,原样显示,不翻译) */
function customerLabel(c) {
  return `${str(c && c.客户编码)} — ${str(c && c.客户名称)}`
}

/** 工艺路线 label;未审核的在尾部标注(用 en.js 已有的「未审核」词条,不新增文案) */
function routeLabel(r) {
  const base = `${str(r && r.编码)} — ${str(r && r.名称)}`
  return isAudited(r) ? base : `${base}（${tt('未审核')}）`
}

// ══════════════════════════════════════════════════════════════════════════════════
// 初始化 / keep-alive 下的再次进入
//   PortalLayout 的 <router-view> 外有 <keep-alive :key="route.path"> ⇒ 本页离开后实例被缓存。
//   ① 首次进入:onMounted 初始化;
//   ② 从「草稿箱·继续编辑」再进来(?draftId 变了)/ 切到临时页签(?kind=临时):onActivated 重新初始化;
//   ③ 刚提交成功、或用户确认放弃未保存修改 ⇒ 下次进入重开一张空白单(needsReset)。
//   注:保存草稿成功后会 router.replace 把 draftId 写进地址栏(刷新不丢草稿上下文;
//       之后再点「新增」= 地址栏没有 draftId ⇒ 与当前 loadedKey 不等 ⇒ 自动重开空白单)。
// ══════════════════════════════════════════════════════════════════════════════════

/** 本实例当前初始化所对应的「地址栏目标」(仅这两项会影响本页初值) */
const routeTarget = () => `${str(route.query.draftId)}|${str(route.query.kind)}`
/** 上一次 initPage 时的 routeTarget(keep-alive 切回来时据此判断要不要重载) */
let loadedKey = ''
/** 下一次激活时强制重开空白单(提交成功 / 用户确认放弃未保存修改) */
let needsReset = false
/** 首次 onActivated 紧跟 onMounted,跳过(初始化已由 onMounted 做) */
let firstActivate = true

async function initPage() {
  loading.value = true
  loadedKey = routeTarget()
  needsReset = false
  kind.value = KIND_NORMAL
  form.value = blankForm()
  lines.value = []
  productOptions.value = []
  partOptions.value = []
  draftId.value = 0
  draftNo.value = ''
  savedAt.value = ''
  showErrors.value = false
  producedTouched.value = false
  bomProductCode.value = ''
  draftSaving.value = false
  submitting.value = false
  const draftIdFromRoute = Number(route.query.draftId) || 0
  const tasks = [loadOptions(), loadRoutes()]
  if (draftIdFromRoute) tasks.push(loadDraft(draftIdFromRoute))
  try {
    await Promise.all(tasks)
  } finally {
    loading.value = false
  }
  if (!draftIdFromRoute && str(route.query.kind) === KIND_TEMP) kind.value = KIND_TEMP
  // 草稿里没存工艺路线(或新单还没选产品)⇒ 取默认路线(只取已审核的,绝不预填未审核的)
  if (!str(form.value.工艺路线)) {
    form.value.工艺路线 = pickDefaultRoute({ routes: routes.value, fallback: options.value.默认工艺路线 })
  }
  prevOrderQty.value = form.value.订单数量
  // 初始化完成 = 当前状态就是「已保存的基线」:此时离开不该弹未保存提示
  lastSnapshot.value = formSnapshot(form.value, lines.value, kind.value)
}

onMounted(async () => {
  // 进入权限:没有本页「新增」动作词 ⇒ 提示并回列表(不让人对着一个交不上去的表单填半天)
  if (!canDo(user, WORK_ORDER_PANEL, 'create')) {
    ElMessage.error(tt('没有该面板的权限'))
    router.replace(LIST_PATH)
    return
  }
  await initPage()
})

onActivated(async () => {
  if (firstActivate) { firstActivate = false; return }
  if (needsReset || routeTarget() !== loadedKey) await initPage()
})

/** 参考数据:客户 + 默认工艺路线(POST /px/workOrderList/options) */
async function loadOptions() {
  try {
    const res = await request.post('/px/workOrderList/options', {})
    options.value = res?.data || {}
    customers.value = Array.isArray(options.value.客户) ? options.value.客户 : []
  } catch {
    options.value = {}
    customers.value = []
  }
}

/** 可选工艺路线(与订单结转/排产弹窗同一个端点;含 审核状态) */
async function loadRoutes() {
  try {
    routes.value = (await request.post('/px/processTask/routes', {})).data || []
  } catch {
    routes.value = []
  }
}

/** 继续编辑草稿:POST /px/workOrderList/draft/get → 回填 kind/form/lines(口径见 draftToState) */
async function loadDraft(id) {
  try {
    const res = await request.post('/px/workOrderList/draft/get', { 草稿id: id })
    const d = res?.data || {}
    const st = draftToState(d)
    form.value = st.form
    lines.value = st.lines
    kind.value = st.kind
    draftId.value = Number(d.草稿id) || id
    draftNo.value = str(d.草稿号)
    savedAt.value = str(d.更新时间)
    // 草稿里的明细是「这个产品的用料」⇒ 换主物料时同样要清掉(与从标准BOM带出同一口径)
    bomProductCode.value = str(d.产品编码)
    prevOrderQty.value = form.value.订单数量
  } catch (e) {
    // 草稿可能已被别人提交/删除:如实提示后端原因,页面留空让用户重新编一张
    ElMessage.error(e?.response?.data?.message || tt('该草稿不存在或已提交'))
  }
}

watch(kind, () => { showErrors.value = false })

// ══════════════════════════════════════════════════════════════════════════════════
// 主物料 / 客户 / 数量联动
// ══════════════════════════════════════════════════════════════════════════════════
/** 远程搜商品档案(空关键字不发请求:档案分支忽略 pageSize,空关键字 = 拉全表) */
async function searchProducts(keyword) {
  const kw = str(keyword)
  if (!kw) { productOptions.value = []; return }
  productLoading.value = true
  try {
    const res = await request.get('/px/invOptions', { params: { panelCode: WORK_ORDER_PANEL, keyword: kw } })
    productOptions.value = toInvOptions(invRowsOf(res?.data))
  } catch {
    productOptions.value = []   // 读不到档案 ⇒ 下拉空,不阻断(用户可再输入重试)
  } finally {
    productLoading.value = false
  }
}

/**
 * 选中/清空主物料:
 *   ① 先用档案行回填 名称/规格/单位(立刻可见,不等接口);
 *   ② 再调 productInfo 拿**权威**值 + 产品档案的工艺路线(默认路线优先用它,其次 options 默认);
 *   ③ 换主物料后旧明细作废(明细是「这个产品的用料」)—— 只在确实带出过 BOM 时清,手填的行不动。
 */
async function onProductPick(code) {
  const picked = productOptions.value.find((o) => o.value === str(code))
  const row = picked?.row || {}
  form.value.产品名称 = str(row.存货名称)
  form.value.规格型号 = str(row.规格型号)
  form.value.计量单位 = str(row.计量单位)
  const code2 = str(code)
  const changed = code2 !== bomProductCode.value
  if (changed && lines.value.length && bomProductCode.value) {
    lines.value = []            // 旧产品的临时用料不再适用
    bomProductCode.value = ''
  }
  if (!code2) return
  try {
    const res = await request.post('/px/workOrderList/productInfo', { 存货编码: code2 })
    const d = res?.data || {}
    form.value.产品名称 = str(d.存货名称) || form.value.产品名称
    form.value.规格型号 = str(d.规格型号) || form.value.规格型号
    form.value.计量单位 = str(d.计量单位) || form.value.计量单位
    form.value.工艺路线 = pickDefaultRoute({
      routes: routes.value,
      productRoute: d.工艺路线,
      fallback: options.value.默认工艺路线,
    })
  } catch (e) {
    // 档案行已经填了 名称/规格/单位;这里只补不到工艺路线 —— 如实提示,不静默
    ElMessage.error(e?.response?.data?.message || tt('加载失败'))
  }
}

function onCustomerPick(code) {
  const hit = customers.value.find((c) => str(c && c.客户编码) === str(code))
  form.value.客户名称 = str(hit && hit.客户名称)
}

/** 订单数量变化:生产数量未被手改过、或仍等于旧订单数量 ⇒ 同步(契约口径) */
function onOrderQtyChange(v) {
  const next = v === undefined || v === null || v === '' ? undefined : Number(v)
  if (!producedTouched.value || sameQty(form.value.生产数量, prevOrderQty.value)) {
    form.value.生产数量 = next
  }
  prevOrderQty.value = next
}

// ══════════════════════════════════════════════════════════════════════════════════
// 临时工单用料(子件)
// ══════════════════════════════════════════════════════════════════════════════════
/** 子件远程搜(与主物料同一取数;候选池共用一份,选中后按编码回填该行) */
async function searchComponents(keyword) {
  const kw = str(keyword)
  if (!kw) { partOptions.value = []; return }
  partLoading.value = true
  try {
    const res = await request.get('/px/invOptions', { params: { panelCode: WORK_ORDER_PANEL, keyword: kw } })
    partOptions.value = toInvOptions(invRowsOf(res?.data))
  } catch {
    partOptions.value = []
  } finally {
    partLoading.value = false
  }
}

/** 子件选中 ⇒ 回填 名称/规格/单位(手打的编码查不到档案就只留编码,不猜) */
function onComponentPick(row) {
  const hit = partOptions.value.find((o) => o.value === str(row && row.子件编码))
  if (!hit) return
  const r = hit.row || {}
  row.子件名称 = str(r.存货名称)
  row.子件规格 = str(r.规格型号)
  const unit = str(r.计量单位)
  if (unit) row.计量单位 = unit    // 单位用户可改:档案有值才带,空着不覆盖用户输入
}

function addLine() {
  lines.value = [...lines.value, blankBomLine(nextLineSeq(lines.value))]
}

/** 删行后行序重排 1..n(后端 wo_bom 按行序展示,断号会看着别扭) */
function removeLine(index) {
  lines.value = renumberLines(lines.value.filter((_, i) => i !== index))
}

/** 问题行标红(仅在校验失败后;判定与 validateWorkOrder 同源:lineProblem) */
function bomRowCls({ row }) {
  return showErrors.value && lineProblem(row) ? 'wop-row-bad' : ''
}

/**
 * 「从标准BOM带出」:`POST /px/workOrderList/stdBom {产品编码}`。
 * 已有行 ⇒ 先确认覆盖(不静默冲掉用户刚录/刚改的明细);查不到标准BOM ⇒ 提示手工添加。
 */
async function loadStdBom() {
  const code = str(form.value.产品编码)
  if (!code) { ElMessage.warning(tt('请选择主物料')); return }
  if (lines.value.length) {
    try {
      await ElMessageBox.confirm(
        `${tt('临时工单用料')} ${tt('已存在')}, ${tt('从标准BOM带出')}?`,
        tt('从标准BOM带出'),
        { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
      )
    } catch { return }
  }
  bomLoading.value = true
  try {
    const res = await request.post('/px/workOrderList/stdBom', { 产品编码: code })
    const mapped = mapStdBomLines(res?.data || {})
    if (!mapped.length) {
      ElMessage.warning(tt('该产品没有标准组装BOM，请手工添加子件'))
      return
    }
    lines.value = mapped
    bomProductCode.value = code
    showErrors.value = false
    ElMessage.success(`${tt('已带出')} ${mapped.length}`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('物料清单读取失败'))
  } finally {
    bomLoading.value = false
  }
}

// ══════════════════════════════════════════════════════════════════════════════════
// 保存草稿 / 提交
// ══════════════════════════════════════════════════════════════════════════════════
/**
 * 校验失败的提示文案:
 *   主数据类 ⇒ 直接用纯函数给的契约原文(tt 一次);
 *   行级 ⇒ 「行序 2: 子件编码 必填」——都由 en.js 已有词条拼,不新增文案。
 */
function problemText(v) {
  if (!v || v.ok) return ''
  if (!v.lineNo) return tt(v.message)
  const field = tt(v.field || v.message)
  return v.reason === 'positive'
    ? `${tt('行序')} ${v.lineNo}: ${field} ${tt('大于')} 0`
    : `${tt('行序')} ${v.lineNo}: ${field} ${tt('必填')}`
}

/** 保存草稿成功后同步「已保存基线」(不跳走,可继续编辑) */
function markSaved() {
  lastSnapshot.value = formSnapshot(form.value, lines.value, kind.value)
}

/**
 * 保存草稿(方案 A ③):**最小校验只有产品编码** —— 草稿允许半成品
 * (数量没填、路线没选、临时工单还没加行都能存),严格校验留到「提交生成工单」。
 * 新草稿 `草稿id: 0`(后端取 GDD 号);已有草稿带 id **覆盖**。
 */
async function saveDraft() {
  if (draftSaving.value) return
  if (!str(form.value.产品编码)) {
    ElMessage.warning(tt('请先选择主物料再保存草稿'))
    return
  }
  draftSaving.value = true
  try {
    const payload = buildDraftPayload(form.value, lines.value, kind.value, draftId.value)
    const res = await request.post('/px/workOrderList/draft/save', payload)
    const d = res?.data || {}
    draftId.value = Number(d.草稿id) || draftId.value
    draftNo.value = str(d.草稿号) || draftNo.value
    savedAt.value = str(d.更新时间) || savedAt.value
    markSaved()
    // 新草稿要在地址栏留下 draftId:刷新/回退都不丢草稿上下文(之后点「新增」= 没 draftId ⇒ 重开空白单)
    if (draftId.value && Number(route.query.draftId) !== draftId.value) {
      await router.replace({ path: route.path, query: { ...route.query, draftId: String(draftId.value) } })
      loadedKey = routeTarget()
    }
    ElMessage.success(`${tt('草稿已保存')} ${draftNo.value}`.trim())
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存草稿失败'))
  } finally {
    draftSaving.value = false
  }
}

/** 提交成功后放行这次导航(不必再问「未保存修改」) */
let leavingBySubmit = false

/**
 * 提交生成工单:**全量校验**(validateWorkOrder:主物料/数量>0/路线已审核/临时工单≥1行),
 * 通过后:有草稿id → `draft/submit`(后端读草稿 → 走 create 全量校验 → 回填正式单号);
 * 没有草稿 → 直接 `workOrderList/create`。成功后跳回列表并用 keyword 定位新单。
 */
async function submit() {
  if (submitting.value) return
  const v = validateWorkOrder({ kind: kind.value, form: form.value, lines: lines.value, routes: routes.value })
  showErrors.value = !v.ok
  if (!v.ok) { ElMessage.warning(problemText(v)); return }
  submitting.value = true
  const useDraft = Number(draftId.value) > 0
  try {
    let 工单号 = ''
    if (useDraft) {
      const d = (await request.post('/px/workOrderList/draft/submit', { 草稿id: draftId.value }))?.data || {}
      工单号 = str(d.工单号)
    } else {
      const d = (await request.post('/px/workOrderList/create', buildCreatePayload(form.value, lines.value, kind.value)))?.data || {}
      工单号 = str(d.工单号)
    }
    ElMessage.success(`${tt('已新增生产工单')} ${工单号}`.trim())
    markSaved()
    needsReset = true                     // 本单已产出正式工单,再进本页应是一张空白单
    leavingBySubmit = true
    try {
      await router.push({ path: LIST_PATH, query: 工单号 ? { keyword: 工单号 } : {} })
    } finally {
      leavingBySubmit = false             // 离开守卫已消费;万一没触发也复位,别让下次离开静默跳过
    }
  } catch (e) {
    // 草稿提交失败时后端返回可读中文原因(草稿仍是草稿态,留在本页可继续改)
    ElMessage.error(e?.response?.data?.message || tt(useDraft ? '提交失败' : '新增工单失败'))
  } finally {
    submitting.value = false
  }
}

/** 返回列表(与底部按钮同一条路;有未保存修改时由离开守卫拦一下) */
function goBack() {
  router.push(LIST_PATH)
}

/**
 * 离开守卫(契约「组件 1·离开守卫」):有未保存修改 → 问一句再走。
 * 「未保存」的判定口径 = formSnapshot 与最后一次保存/提交成功的快照不同(见 business)。
 * 用户确认放弃 ⇒ needsReset:下次进本页重开空白单(不留上一张的内容,避免把旧单提交出去)。
 */
onBeforeRouteLeave(async () => {
  if (leavingBySubmit) { leavingBySubmit = false; return true }
  if (!isDirty.value) return true
  try {
    await ElMessageBox.confirm(
      tt('当前有未保存的修改，离开将丢失，是否继续？'),
      tt('提示'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    )
    needsReset = true
    return true
  } catch {
    return false
  }
})
</script>

<style scoped>
/* 整页编制:头/身/脚三段,身体内部滚动、脚固定 —— 右下角按钮永远看得见 */
.wop-page { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; background: #fff; }
.wop-head {
  flex: none; display: flex; align-items: center; gap: 10px;
  padding: 8px 16px; border-bottom: 1px solid #ebeef5;
}
.wop-back { padding: 0 4px; color: #1e6fb8; }
.wop-title { margin: 0; font-size: 16px; font-weight: 600; color: #303133; }
.wop-meta { margin-left: auto; display: flex; align-items: center; gap: 14px; font-size: 13px; color: #606266; }
.wop-meta-item { font-variant-numeric: tabular-nums; }
.wop-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 16px 18px; }
.wop-foot {
  flex: none; display: flex; justify-content: flex-end; gap: 10px;
  padding: 10px 16px; border-top: 1px solid #ebeef5; background: #fafafa;
}
.wop-tabs { margin-top: -6px; max-width: 1180px; }
.wop-tabs :deep(.el-tabs__content) { display: none; }
.wop-sec { margin: 2px 0 8px; font-size: 13px; font-weight: 600; color: #1e6fb8; }
.wop-form { max-width: 1180px; padding-bottom: 2px; }
.wop-alert { margin: 4px 0 10px; max-width: 1180px; }
.wop-sub-h { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.wop-sub-t { font-size: 13px; font-weight: 600; color: #303133; }
.wop-tb { width: 100%; }
/* 校验失败后的问题行:整行淡红 + 左侧红条,现场一眼看到是哪行没填完 */
:deep(.wop-row-bad) td { background: #fef0f0 !important; }
:deep(.wop-row-bad) td:first-child { box-shadow: inset 3px 0 0 #f56c6c; }
</style>
