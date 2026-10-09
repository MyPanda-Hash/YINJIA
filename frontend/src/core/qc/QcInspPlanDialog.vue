<!-- QcInspPlanDialog.vue — 检验项目 / 检验方案 维护弹窗(2026-10-09,用户口径:
     「给出一个按钮,让他可以在组装成品检验处对这个检验项目和检验方案进行维护」)

     定位:这是**标准本身的维护入口**(受控文件里的 检验项目/接受标准/检验方法/取样/处置),
     只读写 bs_qc_plan(方案头)+ bs_qc_item(方案下的检验项目),**不往任何检验单写数据**,
     也不改动已录入单据 —— 与 StdLibManager「改库不污染已录入数据」同口径。

     入口:组装成品检验单(以及成型/切炭检验单)工具栏「更多」组里的「检验项目维护」按钮。
     可撤回:删本组件 + PanelxList 的挂载与 action 分支 + PanelConfigService 的按钮注入。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('检验项目/检验方案维护')" width="1200px" top="4vh" append-to-body
             destroy-on-close @update:model-value="(v) => emit('update:modelValue', v)" @open="load">
    <div class="qcplan-tip">
      {{ tt('这里维护的是检验标准本身（项目/接受标准/检验方法/取样要求/处置方式），不会改动任何已录入的检验单。') }}
    </div>

    <!-- ═══ 检验方案 ═══ -->
    <div class="qcplan-sec">
      <div class="qcplan-bar">
        <b>{{ tt('检验方案') }}</b>
        <span class="qcplan-sub">{{ tt('一个产品/一类物料一套方案') }}</span>
        <span class="qcplan-gap" />
        <el-checkbox v-model="showDisabled" size="small" @change="loadPlans">{{ tt('显示停用') }}</el-checkbox>
        <el-button size="small" type="primary" @click="openPlanForm(null)">{{ tt('新增方案') }}</el-button>
        <el-button size="small" :disabled="!curPlan" @click="openPlanForm(curPlan)">{{ tt('编辑') }}</el-button>
        <el-button size="small" :disabled="!curPlan" @click="togglePlan">
          {{ curPlan?.['停用'] ? tt('恢复启用') : tt('停用') }}
        </el-button>
      </div>
      <el-table :data="plans" size="small" border height="190" highlight-current-row
                :current-row-key="curPlan?.id" row-key="id" @current-change="onPlanRow">
        <el-table-column :label="tt('方案编码')" prop="方案编码" width="130" />
        <el-table-column :label="tt('方案名称')" prop="方案名称" min-width="200" show-overflow-tooltip />
        <el-table-column :label="tt('适用存货')" prop="适用存货" width="120" show-overflow-tooltip />
        <el-table-column :label="tt('适用存货类别')" prop="适用存货类别" width="130" show-overflow-tooltip />
        <el-table-column :label="tt('检验方式')" prop="检验方式" width="80" />
        <el-table-column :label="tt('文件编码')" prop="文件编码" width="100" />
        <el-table-column :label="tt('取样规则')" prop="取样规则" min-width="190" show-overflow-tooltip />
        <el-table-column :label="tt('项目数')" prop="项目数" width="70" align="right" />
        <el-table-column :label="tt('状态')" width="80">
          <template #default="{ row }">{{ row['停用'] ? tt('已停用') : tt('启用') }}</template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ═══ 该方案下的检验项目 ═══ -->
    <div class="qcplan-sec">
      <div class="qcplan-bar">
        <b>{{ tt('检验项目') }}</b>
        <span class="qcplan-sub">{{ curPlan ? tt('所属方案') + '：' + curPlan['方案名称'] : tt('请先在上方选择一个检验方案') }}</span>
        <span class="qcplan-gap" />
        <el-button size="small" type="primary" :disabled="!curPlan" @click="openItemForm(null)">{{ tt('新增项目') }}</el-button>
        <el-button size="small" :disabled="!curItem" @click="openItemForm(curItem)">{{ tt('编辑') }}</el-button>
        <el-button size="small" :disabled="!curItem" @click="toggleItem">
          {{ curItem?.['停用'] ? tt('恢复启用') : tt('停用') }}
        </el-button>
      </div>
      <el-table :data="items" size="small" border height="240" highlight-current-row row-key="id"
                :empty-text="tt('该方案下还没有检验项目')" @current-change="(r) => (curItem = r)">
        <el-table-column :label="tt('序号')" prop="序号" width="60" />
        <el-table-column :label="tt('项目编码')" prop="项目编码" width="130" show-overflow-tooltip />
        <el-table-column :label="tt('项目名称')" prop="项目名称" width="150" show-overflow-tooltip />
        <el-table-column :label="tt('检验内容')" prop="检验内容" width="100" show-overflow-tooltip />
        <el-table-column :label="tt('检验标准')" prop="检验标准" width="180" show-overflow-tooltip />
        <el-table-column :label="tt('判定规则')" prop="判定规则" width="90" />
        <el-table-column :label="tt('标准下限')" prop="标准下限" width="90" align="right" />
        <el-table-column :label="tt('标准上限')" prop="标准上限" width="90" align="right" />
        <el-table-column :label="tt('计量单位')" prop="计量单位" width="80" />
        <el-table-column :label="tt('取样要求')" prop="取样要求" width="110" show-overflow-tooltip />
        <el-table-column :label="tt('检验方法')" prop="检验方法" min-width="180" show-overflow-tooltip />
        <el-table-column :label="tt('合格处置')" prop="合格处置" width="90" show-overflow-tooltip />
        <el-table-column :label="tt('不合格处置')" prop="不合格处置" width="100" show-overflow-tooltip />
        <el-table-column :label="tt('状态')" width="80">
          <template #default="{ row }">{{ row['停用'] ? tt('已停用') : tt('启用') }}</template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ═══ 方案表单 ═══ -->
    <el-dialog v-model="planFormVisible" :title="planForm.id ? tt('编辑检验方案') : tt('新增检验方案')"
               width="620px" append-to-body>
      <el-form label-width="110px" size="small">
        <el-form-item :label="tt('方案编码')" required>
          <el-input v-model="planForm.方案编码" :disabled="!!planForm.id" :placeholder="tt('如 QP-CAS18')" />
        </el-form-item>
        <el-form-item :label="tt('方案名称')" required>
          <el-input v-model="planForm.方案名称" :placeholder="tt('如 Y料成品检验方案')" />
        </el-form-item>
        <el-form-item :label="tt('适用存货')">
          <el-input v-model="planForm.适用存货" :placeholder="tt('填存货编码或存货名称（建单匹配用）')" />
        </el-form-item>
        <el-form-item :label="tt('适用存货类别')">
          <el-input v-model="planForm.适用存货类别" />
        </el-form-item>
        <el-form-item :label="tt('检验方式')">
          <el-select v-model="planForm.检验方式" style="width: 140px">
            <el-option :label="tt('抽检')" value="抽检" />
            <el-option :label="tt('全检')" value="全检" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('抽检比例%')">
          <el-input v-model="planForm.抽检比例" style="width: 140px" />
        </el-form-item>
        <el-form-item :label="tt('取样规则')">
          <el-input v-model="planForm.取样规则" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }"
                    :placeholder="tt('如 每50kg成品取样1个，每个样品200g')" />
        </el-form-item>
        <el-form-item :label="tt('文件编码')">
          <el-input v-model="planForm.文件编码" style="width: 200px" :placeholder="tt('如 YJ-Q-125')" />
        </el-form-item>
        <el-form-item :label="tt('执行标准')">
          <el-input v-model="planForm.执行标准" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="planForm.备注" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="planFormVisible = false">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="savePlan">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 检验项目表单 ═══ -->
    <el-dialog v-model="itemFormVisible" :title="itemForm.id ? tt('编辑检验项目') : tt('新增检验项目')"
               width="760px" top="6vh" append-to-body>
      <el-form label-width="110px" size="small">
        <el-form-item :label="tt('项目编码')" required>
          <el-input v-model="itemForm.项目编码" :disabled="!!itemForm.id" style="width: 220px" :placeholder="tt('如 FIN-MESH-P20')" />
        </el-form-item>
        <el-form-item :label="tt('项目名称')" required>
          <el-input v-model="itemForm.项目名称" style="width: 320px" :placeholder="tt('如 目数(+20目)')" />
        </el-form-item>
        <el-form-item :label="tt('检验内容')">
          <el-input v-model="itemForm.检验内容" style="width: 320px" :placeholder="tt('如 目数')" />
        </el-form-item>
        <el-form-item :label="tt('检验标准')" required>
          <el-input v-model="itemForm.检验标准" :placeholder="tt('如 +20目占比≤15%')" />
        </el-form-item>
        <el-form-item :label="tt('数据类型')">
          <el-select v-model="itemForm.数据类型" style="width: 140px">
            <el-option :label="tt('定量')" value="定量" />
            <el-option :label="tt('定性')" value="定性" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('判定规则')">
          <el-select v-model="itemForm.判定规则" style="width: 160px">
            <el-option v-for="r in ['符合标准', '区间判定', '上限判定', '下限判定']" :key="r" :label="tt(r)" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('标准下限')">
          <el-input v-model="itemForm.标准下限" style="width: 140px" />
        </el-form-item>
        <el-form-item :label="tt('标准上限')">
          <el-input v-model="itemForm.标准上限" style="width: 140px" />
        </el-form-item>
        <el-form-item :label="tt('计量单位')">
          <el-input v-model="itemForm.计量单位" style="width: 140px" :placeholder="tt('如 % / mg/L')" />
        </el-form-item>
        <el-form-item :label="tt('序号')">
          <el-input v-model="itemForm.序号" style="width: 140px" :placeholder="tt('小的排在前')" />
        </el-form-item>
        <el-form-item :label="tt('取样要求')">
          <el-input v-model="itemForm.取样要求" style="width: 320px" :placeholder="tt('如 称取100g')" />
        </el-form-item>
        <el-form-item :label="tt('检验方法')">
          <el-input v-model="itemForm.检验方法" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
        </el-form-item>
        <el-form-item :label="tt('合格处置')">
          <el-input v-model="itemForm.合格处置" style="width: 200px" :placeholder="tt('如 入库')" />
        </el-form-item>
        <el-form-item :label="tt('不合格处置')">
          <el-input v-model="itemForm.不合格处置" style="width: 200px" :placeholder="tt('如 重新筛分 / 退货')" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="itemForm.备注" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="itemFormVisible = false">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="saveItem">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue', 'changed'])

const API = '/qc/inspPlan'
const plans = ref([])
const items = ref([])
const curPlan = ref(null)
const curItem = ref(null)
const showDisabled = ref(true)
const saving = ref(false)

const planFormVisible = ref(false)
const planForm = ref({})
const itemFormVisible = ref(false)
const itemForm = ref({})

const err = (e, dft) => ElMessage.error(e?.response?.data?.message || e?.message || tt(dft))

async function loadPlans() {
  try {
    const r = await request.get(`${API}/plans`, { params: { all: showDisabled.value ? 1 : '' } })
    plans.value = r.data || []
    // 保持选中:优先原方案编码,否则第一条
    const keep = curPlan.value ? plans.value.find((p) => p['方案编码'] === curPlan.value['方案编码']) : null
    curPlan.value = keep || plans.value[0] || null
    await loadItems()
  } catch (e) { err(e, '加载检验方案失败') }
}

async function loadItems() {
  curItem.value = null
  if (!curPlan.value) { items.value = []; return }
  try {
    const r = await request.get(`${API}/items`, { params: { planCode: curPlan.value['方案编码'], all: showDisabled.value ? 1 : '' } })
    items.value = r.data || []
  } catch (e) { err(e, '加载检验项目失败') }
}

function load() { loadPlans() }

/** 方案行选中 → 加载它的项目 */
async function onPlanRow(row) {
  if (!row || row.id === curPlan.value?.id) return
  curPlan.value = row
  await loadItems()
}

function openPlanForm(row) {
  planForm.value = row
    ? { ...row, 抽检比例: row['抽检比例'] ?? '' }
    : { 检验方式: '抽检', 方案编码: '', 方案名称: '' }
  planFormVisible.value = true
}

async function savePlan() {
  const f = planForm.value
  if (!String(f['方案编码'] || '').trim()) return ElMessage.warning(tt('请填写方案编码'))
  if (!String(f['方案名称'] || '').trim()) return ElMessage.warning(tt('请填写方案名称'))
  saving.value = true
  try {
    await request.post(`${API}/planSave`, f)
    ElMessage.success(tt('已保存'))
    planFormVisible.value = false
    const keepCode = f['方案编码']
    await loadPlans()
    const hit = plans.value.find((p) => p['方案编码'] === keepCode)
    if (hit) { curPlan.value = hit; await loadItems() }
    emit('changed')
  } catch (e) { err(e, '保存失败') } finally { saving.value = false }
}

async function togglePlan() {
  const p = curPlan.value
  if (!p) return
  const off = !!p['停用']
  try {
    if (!off) await ElMessageBox.confirm(tt('停用该检验方案？停用只影响以后的使用，已录入的检验单不受影响。'), tt('提示'), { type: 'warning' })
    await request.post(`${API}/${off ? 'planEnable' : 'planRemove'}`, { id: p.id })
    ElMessage.success(off ? tt('已恢复启用') : tt('已停用'))
    await loadPlans()
    emit('changed')
  } catch (e) { if (e !== 'cancel') err(e, '操作失败') }
}

function openItemForm(row) {
  itemForm.value = row
    ? { ...row, 标准下限: row['标准下限'] ?? '', 标准上限: row['标准上限'] ?? '', 序号: row['序号'] ?? '' }
    : { 数据类型: '定量', 判定规则: '符合标准', 项目编码: '', 项目名称: '', 序号: (items.value.length + 1) * 10 }
  itemFormVisible.value = true
}

async function saveItem() {
  const f = itemForm.value
  if (!String(f['项目编码'] || '').trim()) return ElMessage.warning(tt('请填写项目编码'))
  if (!String(f['项目名称'] || '').trim()) return ElMessage.warning(tt('请填写项目名称'))
  if (!String(f['检验标准'] || '').trim()) return ElMessage.warning(tt('请填写检验标准'))
  saving.value = true
  try {
    await request.post(`${API}/itemSave`, { ...f, 方案编码: curPlan.value?.['方案编码'] })
    ElMessage.success(tt('已保存'))
    itemFormVisible.value = false
    await loadItems()
    await loadPlans()          // 项目数会变
    emit('changed')
  } catch (e) { err(e, '保存失败') } finally { saving.value = false }
}

async function toggleItem() {
  const it = curItem.value
  if (!it) return
  const off = !!it['停用']
  try {
    if (!off) await ElMessageBox.confirm(tt('停用该检验项目？'), tt('提示'), { type: 'warning' })
    await request.post(`${API}/${off ? 'itemEnable' : 'itemRemove'}`, { id: it.id })
    ElMessage.success(off ? tt('已恢复启用') : tt('已停用'))
    await loadItems()
    await loadPlans()
    emit('changed')
  } catch (e) { if (e !== 'cancel') err(e, '操作失败') }
}
</script>

<style scoped>
.qcplan-tip { font-size: 12px; color: #909399; background: #f4f4f5; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; }
.qcplan-sec { margin-bottom: 14px; }
.qcplan-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.qcplan-bar b { font-size: 13px; color: #303133; }
.qcplan-sub { font-size: 12px; color: #909399; }
.qcplan-gap { flex: 1; }
</style>
