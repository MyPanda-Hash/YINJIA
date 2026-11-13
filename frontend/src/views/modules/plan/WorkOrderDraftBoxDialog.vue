<!-- WorkOrderDraftBoxDialog.vue — 生产工单「草稿箱」弹窗(2026-11-13 方案 A)
     入口:生产工单页工具栏「草稿箱」按钮(带草稿数角标;按钮与角标由 Lead 接线,本组件自包含)。
     口径(详见 tools/archive/_wo-draft-20261113/CONTRACT.md「组件 2」):
       · 打开即 `POST /px/workOrderList/draft/list {keyword:''}`;列:草稿号/工单类型/产品编码/产品名称/
         生产数量/客户/创建人/更新时间/操作;
       · 继续编辑 → emit('edit',{草稿id}) 并关闭(生产工单页据此跳整页编制 `?draftId=…`);
       · 提交 → 确认 → `POST draft/submit` → 成功提示 + emit('submitted',{工单号,草稿号}) + 重拉列表;
       · 删除 → 确认 → `POST draft/delete` → 提示 + 重拉列表 + emit('changed')。
     草稿独立存表、**不写 plang** —— 本弹窗只动草稿自身的删/提,不碰工单数据;提交才由后端走
     `WorkOrderCreateService.create`(全量校验),所以「提交失败」原样提示后端可读原因即可,前端不重复校验。
     显示层文案一律 tt():新增词条由 Lead 统一加 en.js(本文件不改 en.js);
     未收录的键 tt() 会兜底显示中文并由机翻补齐(en 走查时要复查,见交接说明)。 -->
<template>
  <el-dialog
    v-model="visible"
    :title="tt('草稿箱')"
    width="94%"
    top="6vh"
    append-to-body
    destroy-on-close
    class="wodb-dlg"
  >
    <!-- 草稿列表:后端只返回 状态=草稿 且未作废的行,按更新时间倒序;本组件不再二次排序/过滤 -->
    <el-table
      v-loading="loading"
      :element-loading-text="tt('加载中…')"
      :data="rows"
      row-key="草稿id"
      size="small"
      border
      max-height="560"
      :empty-text="tt('草稿箱暂无数据')"
    >
      <el-table-column prop="草稿号" :label="tt('草稿号')" width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ row['草稿号'] || '-' }}</template>
      </el-table-column>
      <!-- 工单类型 = 数据值(常规/临时),与生产工单列表同口径走 tt() 显示 -->
      <el-table-column prop="工单类型" :label="tt('工单类型')" width="95" align="center">
        <template #default="{ row }">{{ row['工单类型'] ? tt(row['工单类型']) : '-' }}</template>
      </el-table-column>
      <el-table-column prop="产品编码" :label="tt('产品编码')" width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row['产品编码'] || '-' }}</template>
      </el-table-column>
      <el-table-column prop="产品名称" :label="tt('产品名称')" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row['产品名称'] || '-' }}</template>
      </el-table-column>
      <el-table-column prop="生产数量" :label="tt('生产数量')" width="100" align="right">
        <template #default="{ row }">{{ qty(row['生产数量']) }}</template>
      </el-table-column>
      <!-- 客户:名称为空时退回编码(草稿阶段可能只选了客户编码) -->
      <el-table-column :label="tt('客户')" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row['客户名称'] || row['客户编码'] || '-' }}</template>
      </el-table-column>
      <el-table-column prop="创建人" :label="tt('创建人')" width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ row['创建人'] || '-' }}</template>
      </el-table-column>
      <el-table-column prop="更新时间" :label="tt('更新时间')" width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row['更新时间'] || '-' }}</template>
      </el-table-column>
      <el-table-column :label="tt('操作')" width="250" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" :disabled="busy" @click="onEdit(row)">
            {{ tt('继续编辑') }}
          </el-button>
          <el-button link type="success" size="small"
                     :loading="submittingId === row['草稿id']" :disabled="busy && submittingId !== row['草稿id']"
                     @click="onSubmit(row)">{{ tt('提交生成工单') }}</el-button>
          <el-button link type="danger" size="small"
                     :loading="deletingId === row['草稿id']" :disabled="busy && deletingId !== row['草稿id']"
                     @click="onDelete(row)">{{ tt('删除') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button size="small" :loading="loading" @click="load">{{ tt('刷新') }}</el-button>
      <el-button size="small" type="primary" @click="visible = false">{{ tt('关闭') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 草稿箱弹窗(2026-11-13)—— 生产工单页「草稿箱」按钮打开。
 *
 * 只做三件事:列草稿 / 继续编辑(交给整页编制) / 提交或删除。
 * 契约里的四个事件:
 *   update:modelValue —— 关闭弹窗(继续编辑后本组件自行关闭,由调用页决定跳到哪);
 *   edit({草稿id})    —— 继续编辑;
 *   submitted({工单号, 草稿号}) —— 提交成功(调用页据此提示 + 刷新列表与角标);
 *   changed()         —— 草稿集变化(删除后,调用页刷新角标)。
 *
 * 接口返回统一是 `ApiResult{code,message,data}`;`@core/request` 的响应拦截器已把 body(而非
 * axios Response)交回来,所以这里 `await request.post(...)` 拿到的就是 ApiResult,取值要 `.data`
 * (见 unwrap)。失败提示按项目口径原样用后端的 message。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@core/request'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'edit', 'submitted', 'changed'])

/** 草稿接口(前端契约「一、后端接口契约」1)~5)) */
const LIST_API = '/px/workOrderList/draft/list'
const SUBMIT_API = '/px/workOrderList/draft/submit'
const DELETE_API = '/px/workOrderList/draft/delete'

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const rows = ref([])
const loading = ref(false)
/** 正在提交的草稿id(行内按钮 loading;同时挡住其它行的操作,避免重复点) */
const submittingId = ref(null)
/** 正在删除的草稿id */
const deletingId = ref(null)
const busy = computed(() => submittingId.value != null || deletingId.value != null)

function str(v) { return v == null ? '' : String(v).trim() }

/** 数量显示:草稿允许没填数量(空给 '-'),有值按列表页口径去掉多余的 0 */
function qty(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.?0+$/, '') : String(v)
}

/**
 * 解包统一返回体 ApiResult{code,message,data}。
 * 业务失败也可能是 **HTTP 200 + code≠200**(GlobalExceptionHandler 的 403 权限就这样返回),
 * 所以必须显式判 code —— 否则表现为「点了没反应、也不报错」。
 */
function unwrap(body) {
  if (body == null) throw new Error('')
  if (typeof body === 'object' && body.code != null) {
    if (Number(body.code) !== 200) throw new Error(str(body.message))
    return body.data
  }
  return body
}

/** 失败文案:后端 message 优先(契约要求原样展示),没有就退到本组件的通用提示 */
function errText(e, fallback) {
  return e?.response?.data?.message || str(e?.message) || fallback
}

/** 拉草稿列表(打开弹窗、提交/删除后、手点刷新都走这里) */
async function load() {
  loading.value = true
  try {
    const list = unwrap(await request.post(LIST_API, { keyword: '' }))
    // 后端 ApiResult.ok(List) ⇒ 这里已是数组;再兜底一层 {行:[…]},避免契约微调就整片空白
    rows.value = Array.isArray(list) ? list : (Array.isArray(list?.['行']) ? list['行'] : [])
  } catch (e) {
    rows.value = []
    ElMessage.error(errText(e, tt('加载失败')))
  } finally {
    loading.value = false
  }
}

// 打开即拉一次(immediate:调用页若用 v-if 挂载且一上来就是打开态,也能取到数据)
watch(() => props.modelValue, (v) => {
  if (!v) return
  rows.value = []
  submittingId.value = null
  deletingId.value = null
  load()
}, { immediate: true })

/** 继续编辑:交给调用页跳整页编制(带 draftId),本弹窗关闭 */
function onEdit(row) {
  const id = row?.['草稿id']
  if (id == null || busy.value) return
  emit('edit', { 草稿id: id })
  visible.value = false
}

/** 提交草稿 → 生成正式工单(校验全在后端,失败会原样回可读原因且草稿保持草稿态) */
async function onSubmit(row) {
  const id = row?.['草稿id']
  if (id == null || busy.value) return
  const no = str(row['草稿号'])
  try {
    await ElMessageBox.confirm(
      `${tt('确认提交草稿')}${no ? `（${no}）` : ''}`,
      tt('提交生成工单'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return } // 取消
  submittingId.value = id
  try {
    const d = unwrap(await request.post(SUBMIT_API, { 草稿id: id })) || {}
    const woNo = str(d['工单号'])
    const draftNo = str(d['草稿号']) || no
    ElMessage.success(`${tt('提交成功')}${draftNo ? `：${draftNo}` : ''}${woNo ? ` → ${tt('工单号')} ${woNo}` : ''}`)
    emit('submitted', { 工单号: woNo, 草稿号: draftNo })
    await load() // 已提交的草稿不再出现在草稿箱(状态=已提交)
  } catch (e) {
    ElMessage.error(errText(e, tt('提交失败')))
  } finally {
    submittingId.value = null
  }
}

/** 删除草稿(后端软删:asp_cancel='Y';只允许 状态=草稿) */
async function onDelete(row) {
  const id = row?.['草稿id']
  if (id == null || busy.value) return
  const no = str(row['草稿号'])
  try {
    await ElMessageBox.confirm(
      `${tt('确认删除草稿')}${no ? `（${no}）` : ''}`,
      tt('删除'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return } // 取消
  deletingId.value = id
  try {
    const d = unwrap(await request.post(DELETE_API, { 草稿id: id })) || {}
    const draftNo = str(d['草稿号']) || no
    ElMessage.success(draftNo ? `${tt('已删除草稿')}：${draftNo}` : tt('已删除草稿'))
    await load()
    emit('changed') // 调用页刷新「草稿箱」角标
  } catch (e) {
    ElMessage.error(errText(e, tt('删除失败')))
  } finally {
    deletingId.value = null
  }
}
</script>

<style scoped>
/* 9 列偏宽:窄屏交给 el-table 自己横向滚动(操作列 fixed="right"),弹窗正文不再另加内边距 */
.wodb-dlg :deep(.el-dialog__body) { padding-top: 8px; }
</style>
