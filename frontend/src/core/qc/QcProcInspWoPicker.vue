<!-- QcProcInspWoPicker.vue — 选生产工单(2026-10-15;2026-10-16 扩到首件检验单)

     用户口径:「选择生产工单加工单行号唯一确定当前的生产工单」(制程检验单)、
     「让当前的首件检验单也可以选择到生产工单。当前制程检验单中存在实现方式,可以参照制程检验单
     的实现方式进行」(首件检验单)⇒ **同一个弹窗**按 mode 分流,不复制一份:

       mode='proc' (默认) → /qc/procInsp/woLines  + /qc/procInsp/fromWoLine  → 生成**制程检验单**草稿
                            (表头带产品/批次/产线,明细留空,检验项目随后用「取出货检验计划」带入);
       mode='first'      → /qc/firstInsp/woLines + /qc/firstInsp/fromWoLine → 生成**首件检验单**草稿
                            (表头多带客户代码/客户名称,明细按《成型工艺清单》预铺 —— 与报工审核
                             自动出单同源,故手工建的与自动出的长得一样)。

     🔴 2026-10-20 口径(首件检验单):用户口径「首件检验单需要关联当前的生产工单即可,不需要实现成型
        报工完成流程才产生。就是当前检验单能选取工单,未完工的工单就可以选取,但是已经完成的就不需要
        能被选取,已经被当前的检验单选取的也不能被再次选取。」⇒
          · 首件这边**不再有成型报工门禁**:服务端只回「未完工 + 未被本单占用」的行,每行都可选,
            故成型完工量/成型计划量/可开单/已建单号四列**只在制程模式显示**,首件模式改显示「完工状态」;
          · 制程检验单保持原样(已排产 + 成型报工门禁 + 强制开单通道)。

     ⚠ 文件名保留历史名(QcProcInsp…):改名要动 PanelxList 的 import 与模板,收益只是好看;
       调用方一处(mode 由 PanelxList 按当前面板给)。

     为什么不用通用「选单」:来源须已审核(工单行不进审核流)、须带量明细行(工单行是单层)、
     且头行映射只认来源**表头**(而本单要的字段都在来源**行**上)。详见 QcProcInspController 类注释。

     可撤回:删本组件 + PanelxList 的挂载与 action 分支 + PanelConfigService 的按钮注入。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('选生产工单')" width="1080px" top="6vh" append-to-body
             destroy-on-close @update:model-value="(v) => emit('update:modelValue', v)" @open="load(1)">
    <div class="wopick-tip">
      {{ isFirst
        ? tt('选择一条未完工的生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）。')
        : tt('选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。') }}
    </div>
    <!-- 列表门槛(制程,2026-10-18 用户口径「选取的生产工单应该至少排产完成[成]型才能出现」):
         后端 woLines 只回**已排产入线**(有预排台账的还要求成型那道已排)的工单行,见 WoInspGate.pickable。
         门禁(2026-10-19「成型完成后的生产工单才能生成检验单」)仍逐行判定:置灰 + 写明原因,
         真正的拦截在后端(422)。
         🔴 2026-10-20:首件检验单**已退出**这道门禁(用户口径「未完工的工单就可以选取」)——
         服务端只回未完工、且还没有首件检验单的工单行,每行都可选。 -->
    <div class="wopick-gate">{{ isFirst
      ? tt('只列未完工的工单行；已完工、已结案或已有首件检验单的工单行不再列出。')
      : tt('只列已排产（成型已排）的工单行；成型未报工的行会置灰并写明原因。') }}</div>

    <div class="wopick-bar">
      <el-input v-model="keyword" :placeholder="tt('工单号 / 产品编码 / 产品名称')" clearable style="width: 280px"
                @keyup.enter="load(1)" />
      <el-button type="primary" @click="load(1)">{{ tt('查询') }}</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" size="small" border height="380" highlight-current-row
              :row-class-name="rowClass" @current-change="onCurrent" @row-dblclick="confirm">
      <el-table-column :label="tt('工单号')" prop="工单号" width="150" />
      <el-table-column :label="tt('工单行号')" prop="工单行号" width="80" align="right" />
      <el-table-column :label="tt('产品编码')" prop="产品编码" width="110" />
      <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="180" show-overflow-tooltip />
      <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="140" show-overflow-tooltip />
      <el-table-column :label="tt('批次号')" prop="批次号" width="100" />
      <el-table-column :label="tt('生产线')" prop="生产线" width="100" />
      <el-table-column :label="tt('排产数量')" prop="排产数量" width="90" align="right" />
      <!-- 门禁三列只对制程检验单有意义(首件已退出成型报工门禁,每行都可选,见文件头 2026-10-20) -->
      <el-table-column v-if="!isFirst" :label="tt('成型完工量')" prop="成型完工量" width="100" align="right" />
      <el-table-column v-if="!isFirst" :label="tt('成型计划量')" prop="成型计划量" width="100" align="right" />
      <el-table-column v-if="!isFirst" :label="tt('可开单')" width="130">
        <template #default="{ row }">
          <el-tooltip v-if="row['预警放行']" :content="tt(row['不能开单原因'])" placement="top">
            <el-tag size="small" type="warning">{{ tt('预警放行') }}</el-tag>
          </el-tooltip>
          <el-tag v-else-if="row['可开单']" size="small" type="success">
            {{ row['免门禁'] ? tt('免门禁') : (row['存量放行'] ? tt('存量放行') : tt('可开单')) }}
          </el-tag>
          <el-tooltip v-else :content="tt(row['不能开单原因'])" placement="top">
            <el-tag size="small" type="info">{{ tt('成型未报工') }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <!-- 首件模式:未完工的工单行才列出来(后端已过滤),这里给现场看「未开工 / 在制」 -->
      <el-table-column v-if="isFirst" :label="tt('完工状态')" width="100">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row['完工状态'] || tt('未开工') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="tt('客户')" prop="客户" width="80" />
      <!-- 已建单号:制程仍按原样标出来;首件那边「已有首件单」的行后端直接不列(用户口径:不能再选取) -->
      <el-table-column v-if="!isFirst" :label="tt('已建单号')" prop="已建单号" width="140">
        <template #default="{ row }">
          <el-tag v-if="row['已建单号']" size="small" type="info">{{ row['已建单号'] }}</el-tag>
          <span v-else>{{ '-' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="blockedReason" class="wopick-warn">{{ blockedReason }}</div>

    <div class="wopick-page">
      <el-pagination layout="total, prev, pager, next" :total="total" :current-page="pageNo"
                     :page-size="pageSize" @current-change="load" />
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <!-- 强制开单(2026-10-16):门禁拦截行的**人工通道**(行业口径:金蝶/畅捷通都保留"下推补生成",
           留通道 = 特殊场景不必改库)。仅当后端下发「可强制开单」时出现;必须填原因,写 yj_usage_log 留痕。 -->
      <el-button v-if="canForce" type="warning" :loading="saving" @click="forceCreate">{{ tt('强制开单') }}</el-button>
      <el-button type="primary" :loading="saving" :disabled="!cur || !canConfirm" @click="confirm">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 'proc' = 制程检验单(默认) / 'first' = 首件检验单 —— 只切换接口与话术,弹窗长得一样 */
  mode: { type: String, default: 'proc' },
})
const emit = defineEmits(['update:modelValue', 'picked'])

/** 接口基路径:两套后端入口字段完全对齐(QcProcInspController / QcFirstInspController) */
const base = computed(() => (props.mode === 'first' ? '/qc/firstInsp' : '/qc/procInsp'))
const isFirst = computed(() => props.mode === 'first')

const keyword = ref('')
const rows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = 20
const loading = ref(false)
const saving = ref(false)
const cur = ref(null)
/** 门禁元信息(后端下发):{门禁档位, 存量拦截, 可强制开单} */
const gateMeta = ref({})

/** 选中行的拦截原因(门禁不通过时显示在表格下方);tt() 走词典/机翻,后端中文话术同样能出英文 */
const blockedReason = computed(() => (cur.value && !cur.value['可开单'] ? tt(String(cur.value['不能开单原因'] || '')) : ''))
/** 只有后端说「可开单」的行才允许确定(后端 fromWoLine 还会再硬校验一次,返回 422) */
const canConfirm = computed(() => !!(cur.value && cur.value['可开单']))
/** 拦截行 + 当前用户有「强制开单」权限(管理员恒过) ⇒ 出人工通道按钮 */
const canForce = computed(() => !!(cur.value && cur.value['可开单'] === false && gateMeta.value['可强制开单']))

function rowClass({ row }) {
  return row && row['可开单'] === false && !gateMeta.value['可强制开单'] ? 'wopick-blocked' : ''
}

function onCurrent(r) {
  cur.value = r
  if (r && r['可开单'] === false && !gateMeta.value['可强制开单']) {
    ElMessage.warning(tt(String(r['不能开单原因'] || '该工单行暂不能生成检验单')))
  }
}

async function load(page) {
  pageNo.value = page || 1
  loading.value = true
  cur.value = null
  try {
    const res = await request.get(`${base.value}/woLines`, {
      params: { keyword: keyword.value, pageNo: pageNo.value, pageSize },
    })
    rows.value = res.data?.list || []
    total.value = res.data?.totalSize || 0
    gateMeta.value = res.data?.gate || {}
  } catch (error) {
    ElMessage.error(error?.message || tt('生产工单行加载失败'))
  } finally {
    loading.value = false
  }
}

/** 确定:warn 档(后端判为「预警放行」)先弹确认 —— 现场知道自己在绕过什么,后端同时写留痕 */
async function confirm() {
  if (!cur.value) return
  if (!canConfirm.value) {
    return ElMessage.warning(tt(String(cur.value['不能开单原因'] || '该工单行暂不能生成检验单')))
  }
  if (cur.value['预警放行']) {
    try {
      await ElMessageBox.confirm(tt('该工单行的成型工序尚未报工，确认仍要生成检验单吗？'), tt('预警放行'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
    } catch {
      return
    }
  }
  return submit({})
}

/** 强制开单:仅管理员/持权用户;必须填原因(后端还会再校验权限,403 兜底) */
async function forceCreate() {
  if (!cur.value || !canForce.value) return
  let reason = ''
  try {
    const r = await ElMessageBox.prompt(tt('强制开单原因'), tt('强制开单'), {
      inputPlaceholder: tt('强制开单原因'),
      type: 'warning',
      confirmButtonText: tt('确定'),
      cancelButtonText: tt('取消'),
      inputValidator: (v) => (v && String(v).trim() ? true : tt('请填写强制开单原因')),
    })
    reason = String(r.value || '').trim()
  } catch {
    return
  }
  return submit({ 强制开单: true, 强制开单原因: reason })
}

async function submit(extra) {
  if (!cur.value) return
  saving.value = true
  try {
    const res = await request.post(`${base.value}/fromWoLine`, {
      工单号: cur.value['工单号'],
      工单行号: cur.value['工单行号'],
      ...extra,
    })
    emit('update:modelValue', false)
    emit('picked', res.data || {})
  } catch (error) {
    ElMessage.error(error?.message || (isFirst.value ? tt('生成首件检验单失败') : tt('生成制程检验单失败')))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.wopick-tip { margin-bottom: 8px; color: #606266; font-size: 12px; line-height: 1.6; }
.wopick-gate { margin-bottom: 8px; color: #e6a23c; font-size: 12px; line-height: 1.6; }
.wopick-bar { display: flex; gap: 8px; margin-bottom: 8px; }
.wopick-warn { margin-top: 8px; color: #f56c6c; font-size: 12px; }
.wopick-page { margin-top: 8px; display: flex; justify-content: flex-end; }
:deep(.wopick-blocked) { color: #a8abb2; background: #fafafa; }
</style>
