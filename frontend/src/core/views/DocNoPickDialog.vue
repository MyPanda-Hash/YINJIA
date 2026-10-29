/**
 * DocNoPickDialog.vue —— 「文档编号」左右双源选择弹窗(2026-10-29)
 *
 * 【用户口径·原文】
 *   「数据记录表也是引用的申请单的右上角的单据编号,这个自动生成,数据记录表的选择编号的弹窗
 *    改为左右两边,左边还是立项申请的项目编号关联,右边加入测试申请单的单据编号进行关联测试申请单」
 *
 * 【为什么单开一个组件,不改 RefPickDialog】
 *   RefPickDialog 是**通用**参照弹窗(所有面板的所有参照字段都走它),它的契约是
 *   「一个 refPanel → 一张表 → 勾一行」。这里要的是**两个来源并排**:左边仍按老口径
 *   (参照字段自己声明的 refPanel/refField),右边多一个「测试申请单」来源。
 *   把双源塞进 RefPickDialog 会让每个参照字段都长出一条用不到的右栏。
 *
 * 【口径细节】
 *   · 左侧 = 沿用该字段的参照定义(数据记录表就是 RD_APPROVAL 的「文档编号」= 项目编号),
 *     查询/勾选行为与原来完全一致。
 *   · 右侧 = 测试申请单 RD_DOM_TEST 的单据编号;额外带出「申请单类型/状态/发起人」方便认单。
 *   · 只能从**一边**取一个编号(写回同一个格);两边都不选 → 取消。
 *   · 单选语义:这格存的是"这张记录表关联到哪张申请单",不是多值。
 */
<template>
  <el-dialog v-model="visible" :title="tt('选择关联单据')" width="1080px" append-to-body class="dnp-dialog">
    <div class="dnp-tip">{{ tt('左右两侧选一个编号填入本格：左侧=立项申请的项目编号，右侧=测试申请单的单据编号。') }}</div>
    <div class="dnp-body">
      <!-- ── 左:项目编号(原参照口径) ── -->
      <section class="dnp-pane">
        <header class="dnp-head">
          <span class="dnp-title">{{ tt('立项申请 · 项目编号') }}</span>
          <span class="dnp-sub">{{ tt('沿用该字段的参照来源') }}</span>
        </header>
        <div class="dnp-bar">
          <el-input v-model="leftKeyword" size="small" :placeholder="tt('输入关键字过滤…')" clearable @keyup.enter="searchLeft" />
          <el-button size="small" type="primary" :loading="leftLoading" @click="searchLeft">{{ tt('查询') }}</el-button>
        </div>
        <el-table
          ref="leftTableRef"
          :data="leftRows"
          size="small"
          border
          height="360"
          highlight-current-row
          :row-class-name="({ row }) => (leftPick === rowKeyOf(row) ? 'dnp-picked' : '')"
          @row-click="(row) => pickLeft(row)"
        >
          <el-table-column width="42">
            <template #default="{ row }">
              <el-radio :model-value="leftPick" :value="rowKeyOf(row)" @change="() => pickLeft(row)"><span /></el-radio>
            </template>
          </el-table-column>
          <el-table-column v-for="col in leftCols" :key="col" :prop="col" :label="tt(col)" min-width="130" show-overflow-tooltip />
          <template #empty>
            <span class="dnp-empty">{{ leftLoading ? tt('加载中…') : tt('暂无数据') }}</span>
          </template>
        </el-table>
      </section>

      <!-- ── 右:测试申请单编号 ── -->
      <section class="dnp-pane">
        <header class="dnp-head">
          <span class="dnp-title">{{ tt('测试申请单 · 单据编号') }}</span>
          <span class="dnp-sub">{{ tt('关联到本次测试的申请单') }}</span>
        </header>
        <div class="dnp-bar">
          <el-input v-model="rightKeyword" size="small" :placeholder="tt('输入关键字过滤…')" clearable @keyup.enter="searchRight" />
          <el-button size="small" type="primary" :loading="rightLoading" @click="searchRight">{{ tt('查询') }}</el-button>
        </div>
        <el-table
          :data="rightRows"
          size="small"
          border
          height="360"
          highlight-current-row
          :row-class-name="({ row }) => (rightPick === rowKeyOf(row) ? 'dnp-picked' : '')"
          @row-click="(row) => pickRight(row)"
        >
          <el-table-column width="42">
            <template #default="{ row }">
              <el-radio :model-value="rightPick" :value="rowKeyOf(row)" @change="() => pickRight(row)"><span /></el-radio>
            </template>
          </el-table-column>
          <el-table-column prop="单据编号" :label="tt('单据编号')" width="150" show-overflow-tooltip />
          <el-table-column prop="申请单类型" :label="tt('类型')" width="90" />
          <el-table-column prop="单据状态" :label="tt('状态')" width="90" />
          <el-table-column prop="发起人" :label="tt('发起人')" min-width="100" show-overflow-tooltip />
          <el-table-column prop="单据日期" :label="tt('申请日期')" width="105" />
          <template #empty>
            <span class="dnp-empty">{{ rightLoading ? tt('加载中…') : tt('暂无数据') }}</span>
          </template>
        </el-table>
      </section>
    </div>
    <template #footer>
      <span class="dnp-picked-tip">{{ pickedText }}</span>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!pickedValue" @click="confirm">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 左栏来源:该字段的原始参照定义(refPanel/refField/displayField/filter 等) */
  field: { type: Object, default: null },
  /** 右栏来源面板码(缺省 RD_DOM_TEST) */
  rightPanel: { type: String, default: 'RD_DOM_TEST' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ── 左栏:(原参照口径) ──
const leftKeyword = ref('')
const leftRows = ref([])
const leftCols = ref([])
const leftLoading = ref(false)
const leftPick = ref('')
const leftTableRef = ref(null)

function rowKeyOf(row) {
  return String(row?.__rk ?? '')
}

async function searchLeft() {
  if (!props.field) return
  leftLoading.value = true
  leftPick.value = ''
  try {
    leftCols.value = await engine.refColumns(props.field)
    const list = await engine.queryRefRows(props.field, { keyword: leftKeyword.value, row: null })
    // markRaw 必须在进入响应式之前打在原始行对象上(与 RefPickDialog 同款,避免大表深度代理)
    for (let i = 0; i < list.length; i++) list[i].__rk = String(i)
    leftRows.value = list
  } catch (e) {
    leftRows.value = []
    ElMessage.error(engine.errMsg(e) || tt('参照数据加载失败'))
  } finally {
    leftLoading.value = false
  }
}

function pickLeft(row) {
  leftPick.value = rowKeyOf(row)
  rightPick.value = ''   // 单选语义:选左即清右
}

// ── 右栏:测试申请单 ──
const rightKeyword = ref('')
const rightRows = ref([])
const rightLoading = ref(false)
const rightPick = ref('')

async function searchRight() {
  rightLoading.value = true
  rightPick.value = ''
  try {
    // 与汇总表/列表同一份真源:面板列表接口(返回 {list:[...]})
    const res = await engine.queryFormDataList({
      panelCode: props.rightPanel,
      keyword: rightKeyword.value,
      condition: {},
      pageNo: 1,
      pageSize: 200,
    })
    const data = res?.data || res || {}
    const list = Array.isArray(data.list) ? data.list : []
    for (let i = 0; i < list.length; i++) list[i].__rk = String(i)
    rightRows.value = list
  } catch (e) {
    rightRows.value = []
  } finally {
    rightLoading.value = false
  }
}

function pickRight(row) {
  rightPick.value = rowKeyOf(row)
  leftPick.value = ''
}

// ── 取值/确认 ──
const leftValue = computed(() => {
  if (!leftPick.value) return ''
  const r = leftRows.value.find((x) => rowKeyOf(x) === leftPick.value)
  if (!r) return ''
  const f = props.field || {}
  // 与 RefPickDialog 一致:优先 refField,其次 displayField,最后第一个非空列
  return String(r[f.refField] ?? r[f.displayField] ?? r[leftCols.value[0]] ?? '').trim()
})
const rightValue = computed(() => {
  if (!rightPick.value) return ''
  const r = rightRows.value.find((x) => rowKeyOf(x) === rightPick.value)
  return r ? String(r['单据编号'] ?? r['编号'] ?? '').trim() : ''
})
const pickedValue = computed(() => leftValue.value || rightValue.value)
const pickedText = computed(() => {
  if (leftValue.value) return tt('已选：项目编号') + ' ' + leftValue.value
  if (rightValue.value) return tt('已选：测试申请单') + ' ' + rightValue.value
  return tt('尚未选择')
})

function confirm() {
  const v = pickedValue.value
  if (!v) return
  emit('confirm', v, {
    source: leftValue.value ? 'approval' : 'domtest',
    docNo: v,
  })
  visible.value = false
}

// 每次打开都重新拉两边(单据是会变的);不在打开时缓存,避免看到旧号
watch(() => props.modelValue, (open) => {
  if (!open) return
  leftKeyword.value = ''
  rightKeyword.value = ''
  leftPick.value = ''
  rightPick.value = ''
  searchLeft()
  searchRight()
})
</script>

<style scoped>
.dnp-tip {
  font-size: 12.5px;
  color: #8ba6bd;
  margin-bottom: 8px;
  line-height: 1.6;
}
.dnp-body {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.dnp-pane {
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
  background: #fbfcfd;
}
.dnp-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.dnp-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.dnp-sub {
  font-size: 11.5px;
  color: #a0aec0;
}
.dnp-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.dnp-empty {
  font-size: 12.5px;
  color: #a8b6c4;
}
.dnp-picked-tip {
  float: left;
  font-size: 12.5px;
  color: #606266;
  line-height: 32px;
}
/* 选中行高亮(不让用户勾了看不出选了哪行) */
:deep(.dnp-picked) {
  background: #ecf5ff !important;
}
:deep(.dnp-picked td) {
  background: #ecf5ff !important;
}
</style>
