<!-- WorkOrderCreateDialog.vue — 生产工单「新增」弹窗(2026-11-13)
     入口:生产工单页工具栏「新增」(Lead 集成)→ 本弹窗;此前只有订单结转能生成工单。
     用户四项需求之②③:
       ② 生产工单页可以新建生产工单;
       ③ 新建弹窗加「临时工单」页签:上方主物料(公共表单),下方所需物料(临时 BOM 子件表)。
     口径(详见 tools/archive/_wo-create-20261113/CONTRACT.md「前端契约」):
       · 两个页签只做**类型选择**(常规/临时),公共表单只写一份 —— 常规工单不填子件,
         领料按产品的标准组装 BOM 取料;临时工单的子件落本工单自己的 wo_bom(领料/报工优先按它)。
       · 主物料:产品编码远程搜 `/px/invOptions?panelCode=WORK_ORDER_LIST&keyword=`,
         选中后 `/px/workOrderList/productInfo` 回填 名称/规格/单位 并给默认工艺路线;
       · 工艺路线只允许**已审核**(未审核 disabled + 后缀标注;2026-10-16 用户口径);
       · 保存 `POST /px/workOrderList/create` → 成功提示单号、emit('saved',{工单号,工单类型,行id})、关闭。
     校验与请求体的组装全部在 business/workOrderCreate.js(纯函数,带 node --test 单测);
     本组件只负责请求、渲染与提示。显示层文案一律 tt()(en.js 由 columns-ui 统一追加,本文件不改它)。 -->
<template>
  <el-dialog
    v-model="visible"
    :title="tt('新增生产工单')"
    width="1060px"
    top="4vh"
    append-to-body
    destroy-on-close
    class="woc-dlg"
  >
    <!-- 页签按钮:只切换「工单类型」,公共表单两个页签共用(避免同一份字段写两遍) -->
    <el-tabs v-model="kind" class="woc-tabs">
      <el-tab-pane :label="tt('常规工单')" :name="KIND_NORMAL" />
      <el-tab-pane :label="tt('临时工单')" :name="KIND_TEMP" />
    </el-tabs>

    <div v-if="isTemp" class="woc-sec">{{ tt('主物料') }}</div>

    <!-- ① 公共表单(常规/临时共用) -->
    <el-form :label-width="96" size="small" class="woc-form" @submit.prevent>
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

    <!-- ② 临时工单额外:本工单自己的用料(临时 BOM) -->
    <template v-if="isTemp">
      <el-alert type="info" :closable="false" show-icon class="woc-alert"
                :title="tt('临时工单的用料保存到本工单自己的物料清单（临时BOM），领料/报工优先按它取料；常规工单不用填子件，领料按产品的《组装物料清单》标准BOM取料')" />

      <div class="woc-sub-h">
        <span class="woc-sub-t">{{ tt('临时工单用料') }}</span>
        <el-button size="small" :loading="bomLoading" @click="loadStdBom">{{ tt('从标准BOM带出') }}</el-button>
        <el-button size="small" type="primary" plain @click="addLine">{{ tt('添加行') }}</el-button>
      </div>

      <el-table :data="lines" size="small" border max-height="320" class="woc-tb"
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

    <template #footer>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ tt('保存') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
// 商品档案行归一:档案面板返回「虚拟单 {list:[{detail:{inv:[...]}}]}」而不是平表,
// 直接 res.data.list 会拿到 0 行(RecipeCalcDialog/XsinterCalcDialog 同一套取数)
import { invRowsOf } from '@/core/panel/invCarry.js'
import {
  KIND_NORMAL, KIND_TEMP, WORK_ORDER_PANEL,
  blankBomLine, blankForm, buildCreatePayload, lineProblem, mapStdBomLines,
  nextLineSeq, pickDefaultRoute, renumberLines, validateWorkOrder,
} from '@/business/workOrderCreate'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

/** 页签(值 = 数据键 常规/临时,永不翻译;显示层用 tt('常规工单'/'临时工单')) */
const kind = ref(KIND_NORMAL)
const isTemp = computed(() => kind.value === KIND_TEMP)

/** 公共表单(键名与契约 D 一致,提交前由 buildCreatePayload 规范化) */
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

const saving = ref(false)
const bomLoading = ref(false)
/** 校验失败后才给问题行标红(刚点「添加行」的空行不先飘红,免得一打开就满屏红) */
const showErrors = ref(false)
/** 生产数量是否被手工改过(没改过 ⇒ 跟着订单数量同步) */
const producedTouched = ref(false)
const prevOrderQty = ref(undefined)
/** 当前明细是用哪个主物料带出来的(换主物料时据此清掉旧料,避免把 A 的用料存到 B 上) */
const bomProductCode = ref('')

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

// ── 打开弹窗 = 重置 ──────────────────────────────────────────────────────────────
// el-dialog 带 destroy-on-close,但脚本里的 ref 不会跟着销毁 ⇒ 每次打开都必须重置,
// 否则上一次的单据内容会残留在下一次(静默把上一张单的字段带进下一次 = 脏数据)。
// 用 watch(modelValue, immediate) 而不是 el-dialog 的 @open(2026-11-13 实测):
//   父组件若一开始就把 modelValue 传成 true(或页面常驻挂载本组件),@open 不会补发 ⇒
//   客户/工艺路线候选永远是空的。watch + immediate 两种挂载方式都覆盖,且只跑一次(不会重复请求)。
watch(() => props.modelValue, (v) => { if (v) onOpen() }, { immediate: true })

async function onOpen() {
  kind.value = KIND_NORMAL
  form.value = blankForm()
  lines.value = []
  productOptions.value = []
  partOptions.value = []
  saving.value = false
  bomLoading.value = false
  showErrors.value = false
  producedTouched.value = false
  prevOrderQty.value = form.value.订单数量
  bomProductCode.value = ''
  await Promise.all([loadOptions(), loadRoutes()])
  // 产品还没选 ⇒ 默认路线只能取 options.默认工艺路线(且必须已审核)
  form.value.工艺路线 = pickDefaultRoute({ routes: routes.value, fallback: options.value.默认工艺路线 })
}

watch(kind, () => { showErrors.value = false })

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

// ── 主物料 ───────────────────────────────────────────────────────────────────────
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

// ── 临时工单用料(子件)───────────────────────────────────────────────────────────
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
  return showErrors.value && lineProblem(row) ? 'woc-row-bad' : ''
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

// ── 保存 ─────────────────────────────────────────────────────────────────────────
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

async function save() {
  if (saving.value) return
  const v = validateWorkOrder({ kind: kind.value, form: form.value, lines: lines.value, routes: routes.value })
  showErrors.value = !v.ok
  if (!v.ok) { ElMessage.warning(problemText(v)); return }
  saving.value = true
  try {
    const res = await request.post('/px/workOrderList/create', buildCreatePayload(form.value, lines.value, kind.value))
    const d = res?.data || {}
    ElMessage.success(`${tt('已新增生产工单')} ${str(d.工单号)}`)
    emit('saved', {
      工单号: str(d.工单号),
      工单类型: str(d.工单类型) || kind.value,
      行id: d.行id ?? null,
    })
    visible.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('新增工单失败'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.woc-tabs { margin-top: -6px; }
.woc-tabs :deep(.el-tabs__content) { display: none; }
.woc-sec { margin: 2px 0 8px; font-size: 13px; font-weight: 600; color: #1e6fb8; }
.woc-form { padding-bottom: 2px; }
.woc-alert { margin: 4px 0 10px; }
.woc-sub-h { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.woc-sub-t { font-size: 13px; font-weight: 600; color: #303133; }
.woc-tb { width: 100%; }
/* 校验失败后的问题行:整行淡红 + 左侧红条,现场一眼看到是哪行没填完 */
:deep(.woc-row-bad) td { background: #fef0f0 !important; }
:deep(.woc-row-bad) td:first-child { box-shadow: inset 3px 0 0 #f56c6c; }
</style>
