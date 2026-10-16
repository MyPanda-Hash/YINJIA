<!-- QcProcInspWoPicker.vue — 选生产工单(2026-10-15;2026-10-16 扩到首件检验单)

     用户口径:「选择生产工单加工单行号唯一确定当前的生产工单」(制程检验单)、
     「让当前的首件检验单也可以选择到生产工单。当前制程检验单中存在实现方式,可以参照制程检验单
     的实现方式进行」(首件检验单)⇒ **同一个弹窗**按 mode 分流,不复制一份:

       mode='proc' (默认) → /qc/procInsp/woLines  + /qc/procInsp/fromWoLine  → 生成**制程检验单**草稿
                            (表头带产品/批次/产线,明细留空,检验项目随后用「取出货检验计划」带入);
       mode='first'      → /qc/firstInsp/woLines + /qc/firstInsp/fromWoLine → 生成**首件检验单**草稿
                            (表头多带客户代码/客户名称,明细按《成型工艺清单》预铺 —— 与报工审核
                             自动出单同源,故手工建的与自动出的长得一样)。

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
        ? tt('选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。')
        : tt('选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。') }}
    </div>

    <div class="wopick-bar">
      <el-input v-model="keyword" :placeholder="tt('工单号 / 产品编码 / 产品名称')" clearable style="width: 280px"
                @keyup.enter="load(1)" />
      <el-button type="primary" @click="load(1)">{{ tt('查询') }}</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" size="small" border height="380" highlight-current-row
              @current-change="(r) => (cur = r)" @row-dblclick="confirm">
      <el-table-column :label="tt('工单号')" prop="工单号" width="150" />
      <el-table-column :label="tt('工单行号')" prop="工单行号" width="80" align="right" />
      <el-table-column :label="tt('产品编码')" prop="产品编码" width="110" />
      <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="180" show-overflow-tooltip />
      <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="140" show-overflow-tooltip />
      <el-table-column :label="tt('批次号')" prop="批次号" width="100" />
      <el-table-column :label="tt('生产线')" prop="生产线" width="100" />
      <el-table-column :label="tt('排产数量')" prop="排产数量" width="90" align="right" />
      <el-table-column :label="tt('客户')" prop="客户" width="80" />
      <el-table-column :label="tt('已建单号')" prop="已建单号" width="140">
        <template #default="{ row }">
          <el-tag v-if="row['已建单号']" size="small" type="info">{{ row['已建单号'] }}</el-tag>
          <span v-else>{{ '-' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="wopick-page">
      <el-pagination layout="total, prev, pager, next" :total="total" :current-page="pageNo"
                     :page-size="pageSize" @current-change="load" />
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" :disabled="!cur" @click="confirm">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
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
  } catch (error) {
    ElMessage.error(error?.message || tt('生产工单行加载失败'))
  } finally {
    loading.value = false
  }
}

async function confirm() {
  if (!cur.value) return
  saving.value = true
  try {
    const res = await request.post(`${base.value}/fromWoLine`, {
      工单号: cur.value['工单号'],
      工单行号: cur.value['工单行号'],
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
.wopick-bar { display: flex; gap: 8px; margin-bottom: 8px; }
.wopick-page { margin-top: 8px; display: flex; justify-content: flex-end; }
</style>
