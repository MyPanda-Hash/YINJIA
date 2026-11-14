<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="880px"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="open"
  >
    <div class="rpd">
      <div class="rpd-toolbar">
        <el-input v-model="keyword" placeholder="输入关键字过滤…" clearable size="small" style="width: 240px" @keyup.enter="open" />
        <el-button size="small" type="primary" :icon="Search" @click="open">查询</el-button>
        <span class="rpd-tip">{{ tipText }} · 共 {{ total }} 条</span>
      </div>
      <!-- 级联字段的空态说明(2026-10-09):仓位这类「按本行仓库收窄」的参照,候选为空时
           光一句「暂无数据」说不清是没选上级还是上级真的没有数据 —— 这里把原因讲明。 -->
      <div v-if="!loading && cascadeHint" class="rpd-cascade-hint">{{ cascadeHint }}</div>
      <!-- 点行即勾选（2026-11-13 用户口径：「其他的这种弹窗的勾选形式都进行改动，都做点击行就判定勾选
           的操作，比如客户名称这个」）—— 不必再去点前面那个 45px 的小方框。
           复选框列保留：表头全选、跨页 reserve-selection 与键盘可达性都还要靠它。 -->
      <el-table
        ref="tableRef"
        :data="pagedRows"
        :row-key="rowKeyOf"
        v-loading="loading"
        size="small"
        border
        height="380"
        highlight-current-row
        class="rpd-table"
        @row-click="onRowClick"
        @selection-change="(r) => (selected = r)"
      >
        <!-- reserve-selection:跨页保留勾选(多选导入语义),row-key 用载入时分配的稳定 __rk -->
        <el-table-column type="selection" width="45" reserve-selection />
        <el-table-column v-for="c in displayColumns" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip>
          <template v-if="c === '开发状态'" #default="{ row }">
            <span class="rpd-dev" :class="devTone(row['开发状态'])">{{ tt(row['开发状态']) }}</span>
          </template>
        </el-table-column>
      </el-table>
      <!-- 大数据参照分页(2026-09-16):数据全量驻内存(keyword 过滤后),DOM 只渲染当前页 ——
           商品 3850 行×75 列全量渲染曾把弹窗冻住数十秒;形态对齐档案页(总数+每页条数+箭头+跳页) -->
      <div v-if="total > PAGE_SIZES[0]" class="rpd-pager">
        <el-pagination
          small background
          v-model:page-size="pageSize"
          layout="total, sizes, prev, next, jumper"
          :page-sizes="PAGE_SIZES"
          :total="total"
          :current-page="page"
          @size-change="onSizeChange"
          @current-change="(p) => (page = p)"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">确定导入（{{ selected.length }} 行）</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, markRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { usePanelRuntime } from '@core/panel-runtime'
import { tt } from '@/i18n'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 兼容旧调用方（v-model:visible）
  // 参照字段定义（原始配置字段或 buildMeta 输出的 meta.ref 均可）
  field: { type: Object, default: null },
  // 'header' 表头单值字段（多选仅导入第一行）/ 'detail' 明细行（多选每行生成一条明细）
  mode: { type: String, default: 'header' },
  // 调用方所属面板(用于「产品开发」状态标注:仅下游文件面板显示;2026-09-11 起 4 个)
  ownerPanel: { type: String, default: '' },
  // 本行数据(2026-10-09):供参照过滤里的 `$字段` 占位取值 —— 仓位(ref_filter=`仓库=$仓库`)
  // 之类级联字段据此把候选收窄到本行仓库;非级联字段传不传都一样。
  row: { type: Object, default: null },
  // 跳过「单据状态=已审核」候选过滤(2026-11-01,纸面单据关联单号专用):
  // 纸面单据(不合格报告/不合格品处理单等)表头 单据状态 是历史遗留列、MES 不维护,
  // 按它过滤会把候选砍到只剩零星几条(实测 433→1) ⇒ 由 DocSheet 的纸面格子(refAllStatus)声明后透传。
  skipAuditFilter: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'update:visible', 'confirm'])

const keyword = ref('')
const rows = ref([])
const columns = ref([])
const selected = ref([])
const loading = ref(false)
const total = ref(0)

// ── 大数据参照分页(2026-09-16):档案参照(商品 3850 行×75 列)此前全量渲染把弹窗冻住。
// 数据全量驻内存(同档案页口径),DOM 只渲染当前页;行对象 markRaw 避免 ~29 万属性深度代理。
const PAGE_SIZES = [50, 100, 200, 500]
const pageSize = ref(PAGE_SIZES[0])
const page = ref(1)
const tableRef = ref(null)
const pagedRows = computed(() => {
  const s = (page.value - 1) * pageSize.value
  return rows.value.slice(s, s + pageSize.value)
})
/**
 * 点行即勾选（2026-11-13）。
 *
 * 口径：
 *   · 点行内任意位置 = 切换该行勾选（复选框列除外，见下）；
 *   · **点复选框本身不重复处理** —— 那一下 el-checkbox 自己的 change 已经翻过一次，
 *     若再走行点击就会翻第二次 ⇒ 看起来像"点了没反应"。判据 closest('.el-checkbox')；
 *   · 切换走 el-table 的 toggleRowSelection（不自己维护数组）：这一源本来就用
 *     `reserve-selection` 跨页保留，自己另存一份会跟表格内部状态打架。
 */
function onRowClick(row, column, event) {
  const t = event?.target
  if (t && typeof t.closest === 'function' && t.closest('.el-checkbox, .el-checkbox__input')) return
  if (!row || row.__rk === undefined) return
  const isOn = selected.value.some((r) => r && r.__rk === row.__rk)
  tableRef.value?.toggleRowSelection(row, !isOn)
}
function onSizeChange() { page.value = 1 }
/** reserve-selection 的稳定行键:载入时按序分配(过滤/翻页后仍指向同一行对象) */
function rowKeyOf(r) { return r.__rk }

// ── 产品开发状态标注(2026-09-09):参照产品信息表时,按当前面板标注 未开发 / 已开发 ──
const DEV_PANEL_CODES = ['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN']
const devMap = ref({})
const showDevStatus = computed(() => props.field?.refPanel === 'RD_PROD_INFO'
  && DEV_PANEL_CODES.includes(String(props.ownerPanel || '')))
const displayColumns = computed(() => (showDevStatus.value ? [...columns.value, '开发状态'] : columns.value))
function devTone(status) {
  return status === '已开发' ? 'done' : 'none'
}

const title = ref('参照选择')
const multi = computed(() => !!props.field?.refMulti || !!props.field?.multi)

/** 级联空态说明:字段的过滤值带 `$字段` 占位(= 候选按本行某字段收窄,如 仓位 ← 仓库)时,
 *  提示「先选上级」或「上级下暂无数据」——否则用户只看到「暂无数据」,分不清是漏填还是真没有。 */
const cascadeHint = computed(() => {
  const filter = props.field?.filter || {}
  const pairs = Object.entries(filter).filter(([, v]) => typeof v === 'string' && v.startsWith('$'))
  if (!pairs.length) return ''
  for (const [, v] of pairs) {
    const parent = String(v).slice(1)
    const val = props.row?.[parent]
    if (val === undefined || val === null || String(val).trim() === '') return '请先选择「' + tt(parent) + '」'
  }
  // 上级有值却查不到候选:多半是上级档案下还没建下级数据(如该仓库尚未维护仓位档案)
  if (rows.value.length === 0 && !keyword.value.trim()) {
    return '该「' + tt(String(pairs[0][1]).slice(1)) + '」下暂无候选数据(请先在对应档案里维护)'
  }
  return ''
})
const tipText = computed(() => {
  if (props.mode === 'detail') return '可勾选多行，确定后每行生成一条明细'
  if (multi.value) return '可勾选多行，确定后一次导入（多值顿号连接）'
  return '单值字段，勾选多行时仅导入第一行'
})

async function open() {
  if (!props.field) return
  title.value = (await engine.refPanelName(props.field)) + ' · 参照选择'
  loading.value = true
  tableRef.value?.clearSelection() // 重新查询后旧勾选(含跨页保留)整体作废
  selected.value = []
  rows.value = []
  try {
    columns.value = await engine.refColumns(props.field)
    const list = await engine.queryRefRows(props.field, { keyword: keyword.value, row: props.row, skipAuditFilter: props.skipAuditFilter })
    if (showDevStatus.value) {
      const codes = list.map((r) => r['产品编号']).filter((v) => v !== undefined && v !== null && v !== '')
      try {
        devMap.value = (await engine.rdDevAnnotate(props.ownerPanel, codes)) || {}
      } catch (e) {
        devMap.value = {}
      }
      // 标注写进行对象,须在 rows.value 赋值(raw 进响应式)之前完成,渲染时即带值
      for (const r of list) r['开发状态'] = devMap.value[r['产品编号']] || ''
    } else {
      devMap.value = {}
    }
    // markRaw 必须在进入响应式系统(rows.value 赋值)之前打在原始行对象上
    for (let i = 0; i < list.length; i++) { list[i].__rk = String(i); markRaw(list[i]) }
    rows.value = list
    total.value = list.length
    page.value = 1
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '参照数据加载失败')
  } finally {
    loading.value = false
  }
}

function confirm() {
  if (!selected.value.length) return
  emit('confirm', selected.value)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.rpd-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rpd-tip {
  font-size: 12px;
  color: var(--t-text-3);
  margin-left: 4px;
}
/* 级联空态说明(仓位 ← 仓库 这类) */
.rpd-cascade-hint {
  font-size: 12px;
  color: #b26a00;
  background: #fff7e6;
  border: 1px solid #ffe0a3;
  border-radius: 6px;
  padding: 4px 8px;
  margin-bottom: 6px;
}
/* 大数据参照分页器:贴在表格下沿右对齐(形态对齐档案页 arch-pager) */
.rpd-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
/* 整行可点（2026-11-13）：手型光标提示"这一行能点"；勾中的行由 highlight-current-row 之外
   再给一层底色，跨页翻回来也看得见自己勾过哪几行。 */
.rpd-table :deep(.el-table__body-wrapper tbody tr) { cursor: pointer; }
/* 产品开发状态标注 */
.rpd-dev {
  display: inline-block;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 18px;
}
.rpd-dev.none { background: #fff2e0; color: #b26a00; }
.rpd-dev.done { background: #e6f4ea; color: #1a7f37; }
</style>
