<!-- PurInMultiWhDialog.vue —— 采购入库单「多仓库入库」(2026-11-17 用户口径,第三轮)

     用户原话:
       「写法还是改成有个多仓库入库按钮(在顶部)。点击后和生单一样的界面。
         然后每行明细的头部有个下拉扩展的倒三角,点一下就多出一行明细来。但是总数量不超过最大数量。」

     所以这个弹窗就是「整单明细一张表」:
       · 每行明细前面一颗 ▾ —— **点一下就多出一行**(给这一行再加一个仓库存放);
       · 子行的仓库/仓位/数量在这里填,同一行各子行数量合计 **不能超过** 该行可入库数量(实收数量);
       · 没分完的部分仍留在原行(原仓库);原行没有仓库时要求分完,否则不知道该入哪个仓;
       · 确定 = 服务端一个事务里把这些行拆开(复制行 + 金额按占比分摊 + 占用链一起拆)。

     为什么拆成多行而不是行内挂分配子表:库存台账/流水/库存状况表/转ERP 全是按「行 × 仓库」取数,
     拆行这条链一个字都不用改,也不会出现两套账。 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('多仓库入库') + (docNo ? ' · ' + docNo : '')"
    width="96vw"
    top="2vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <div class="pmw">
      <div class="pmw-bar">
        <span class="pmw-chip">{{ tt('单据编号') }}: {{ docNo || '—' }}</span>
        <span class="pmw-chip">{{ tt('明细行') }}: {{ lines.length }}</span>
        <span class="pmw-chip">{{ tt('批次号') }}: {{ batchNo || '—' }}</span>
        <span class="pmw-tip">
          {{ tt('点每行前面的 ▾ 增加一行仓库；同一行各仓库数量合计不能超过「可入库数量」，没分完的留在原行') }}
        </span>
      </div>

      <el-table :data="flat" row-key="key" border size="small" :row-class-name="rowClass" max-height="480">
        <el-table-column :label="tt('展开')" width="56" align="center">
          <template #default="{ row }">
            <span v-if="row.kind === 'line'" class="pmw-caret" :title="tt('点一下加一行仓库')"
                  @click="addAlloc(row.L)">▾</span>
            <span v-else class="pmw-sub">↳</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('行号')" width="60">
          <template #default="{ row }">{{ row.kind === 'line' ? (row.L.row['行号'] || row.L.seq) : '' }}</template>
        </el-table-column>
        <el-table-column :label="tt('物料编码')" min-width="120">
          <template #default="{ row }">{{ row.kind === 'line' ? row.L.row['存货编码'] : '' }}</template>
        </el-table-column>
        <el-table-column :label="tt('物料名称')" min-width="130">
          <template #default="{ row }">{{ row.kind === 'line' ? row.L.row['存货名称'] : '' }}</template>
        </el-table-column>
        <el-table-column :label="tt('规格型号')" min-width="110">
          <template #default="{ row }">{{ row.kind === 'line' ? row.L.row['规格型号'] : '' }}</template>
        </el-table-column>
        <el-table-column :label="tt('计量单位')" width="80" align="center">
          <template #default="{ row }">{{ row.kind === 'line' ? (row.L.row['计量单位'] || '') : '' }}</template>
        </el-table-column>
        <el-table-column :label="tt('可入库数量')" width="110" align="right">
          <template #default="{ row }">{{ row.kind === 'line' ? fmt(maxOf(row.L)) : '' }}</template>
        </el-table-column>
        <el-table-column :label="tt('仓库')" width="180">
          <template #default="{ row }">
            <span v-if="row.kind === 'line'" class="pmw-cur">{{ row.L.row['仓库'] || tt('未选') }}</span>
            <el-select v-else v-model="row.a['仓库']" size="small" filterable clearable :placeholder="tt('选择仓库')"
                       style="width: 100%">
              <el-option v-for="w in warehouses" :key="w.code || w.name" :label="w.name" :value="w.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="tt('仓位')" width="150">
          <template #default="{ row }">
            <span v-if="row.kind === 'line'" class="pmw-cur">{{ row.L.row['仓位编码'] || '' }}</span>
            <el-select v-else v-model="row.a['仓位编码']" size="small" filterable clearable
                       :disabled="!row.a['仓库']"
                       :placeholder="row.a['仓库'] ? tt('选择仓位') : tt('先选仓库')" style="width: 100%">
              <el-option v-for="b in binsOfWarehouse(bins, row.a['仓库'])" :key="b.code" :label="b.code" :value="b.code" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="tt('数量')" width="140">
          <template #default="{ row }">
            <span v-if="row.kind === 'line'" class="pmw-cur">{{ fmt(row.L.row['实收数量']) }}</span>
            <el-input-number v-else v-model="row.a['数量']" :min="0" :max="maxOf(row.L)" :controls="false"
                             size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('已分配 / 剩余')" width="140" align="right">
          <template #default="{ row }">
            <template v-if="row.kind === 'line'">
              <b>{{ fmt(allocatedOf(row.L)) }}</b> / <span :class="{ bad: remainingOf(row.L) < 0 }">{{ fmt(remainingOf(row.L)) }}</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="70" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.kind === 'alloc'" class="pmw-del" :title="tt('删除')" @click="removeAlloc(row.L, row.i)"><Delete /></el-icon>
          </template>
        </el-table-column>
        <template #empty>{{ tt('这张单没有可拆分的明细行') }}</template>
      </el-table>

      <div class="pmw-foot">
        <span>{{ tt('要拆分的行') }}: <b>{{ splitLineCount }}</b> · {{ tt('拆出来') }}: <b>{{ willSplitRows }}</b> {{ tt('行') }}</span>
        <span v-if="problem" class="pmw-problem">{{ problem }}</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!canSubmit" :loading="saving" @click="confirm">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 只做三件事:① 拉仓库/仓位档案 ② 收集每行的仓库子行并先把关(合计不超过可入库数量)
 * ③ 一次提交给服务端拆行(POST /px/purIn/multiWh,整批一个事务)。
 * 校验只在这里做"不超过上限 + 子行完整";服务端另有等价守卫(合计必须等于该行实收数量,
 * 未分完的余量由下面 appendRemainder() 补成原仓库那一行再提交)。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { binsOfWarehouse, loadWhBinSources } from '@core/selection/genWhBin'
import { numOr0 } from '@core/panel/purInSplit'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 采购入库单号 */
  docNo: { type: String, default: '' },
  /** 当前单据的明细行(表单里正在编辑的那一份) */
  rows: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const lines = reactive([])
const warehouses = reactive([])
const bins = reactive([])
const saving = ref(false)

const batchNo = computed(() => {
  const hit = (props.rows || []).find((r) => String(r?.['批次号'] || '').trim())
  return hit ? String(hit['批次号']).trim() : ''
})

const fmt = (v) => {
  const n = numOr0(v)
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000)
}

/** 该行可入库数量 = 实收数量(拆分的上限) */
const maxOf = (L) => numOr0(L?.row?.['实收数量'])
const allocatedOf = (L) => (L?.allocs || []).reduce((s, a) => s + Math.max(0, numOr0(a['数量'])), 0)
const remainingOf = (L) => Math.round((maxOf(L) - allocatedOf(L)) * 10000) / 10000
const hasId = (L) => L && L.row && L.row.id !== undefined && L.row.id !== null && L.row.id !== ''

/** 要拆的行:填了 ≥2 个仓库子行(只填一个仓库 = 不拆,按普通单选处理,不在这里提交) */
const splitLines = computed(() => lines.filter((L) => (L.allocs || []).length >= 2))
const splitLineCount = computed(() => splitLines.value.length)
const willSplitRows = computed(() => splitLines.value.reduce((s, L) => s + L.allocs.length, 0))

/** 平铺成表格数据:一行明细 + 它下面的 N 个仓库子行 */
const flat = computed(() => {
  const out = []
  for (const L of lines) {
    out.push({ kind: 'line', key: 'L' + L.key, L })
    L.allocs.forEach((a, i) => out.push({ kind: 'alloc', key: 'A' + L.key + '_' + i, L, a, i }))
  }
  return out
})

const rowClass = ({ row }) => (row.kind === 'alloc' ? 'pmw-alloc-row' : '')

/** 校验失败说明(第一条) */
const problem = computed(() => {
  for (const L of lines) {
    const list = L.allocs || []
    if (!list.length) continue
    if (list.length === 1) return tt('同一行要拆至少两个仓库：再点一次 ▾')
    if (!hasId(L)) return tt('请先保存单据，再拆分仓库')
    const bad = list.findIndex((a) => !String(a['仓库'] || '').trim() || numOr0(a['数量']) <= 0)
    if (bad >= 0) return tt('第 {n} 个仓库子行还没填仓库或数量').replace('{n}', String(bad + 1))
    if (remainingOf(L) < 0) return tt('该行各仓库数量合计不能超过可入库数量')
    if (remainingOf(L) > 0 && !String(L.row['仓库'] || '').trim()) {
      return tt('该行还剩 {n} 没有分配，且原行没有仓库，请分完或先给原行选仓库').replace('{n}', fmt(remainingOf(L)))
    }
  }
  return ''
})

const canSubmit = computed(() => !saving.value && splitLineCount.value > 0 && !problem.value)

async function onOpen() {
  lines.splice(0, lines.length)
  for (const [i, r] of (props.rows || []).entries()) {
    // 只把有数量、有 id 的行做成可拆列表(没落库的新行拆不了)
    if (!r) continue
    lines.push({ key: String(r.id || 'new' + i), seq: i + 1, row: r, allocs: [] })
  }
  try {
    const src = await loadWhBinSources(engine)
    warehouses.splice(0, warehouses.length, ...src.warehouses)
    bins.splice(0, bins.length, ...src.bins)
  } catch (e) {
    ElMessage.warning(tt('仓库档案读取失败，请刷新后重试'))
  }
}

/** ▾:给这一行再加一个仓库子行(第一行默认原仓库 + 整行数量,后面加的从 0 起,用户自己分) */
function addAlloc(L) {
  if (!hasId(L)) {
    ElMessage.warning(tt('请先保存单据，再拆分仓库'))
    return
  }
  const first = L.allocs.length === 0
  L.allocs.push({
    仓库: first ? String(L.row['仓库'] || '') : '',
    仓位编码: first ? String(L.row['仓位编码'] || '') : '',
    数量: first ? maxOf(L) : 0,
  })
}

function removeAlloc(L, index) {
  L.allocs.splice(index, 1)
}

const close = () => emit('update:modelValue', false)

/** 没分完的余量补一行(仓库 = 原行的仓库),这样服务端"合计 = 实收数量"的老口径仍然成立 */
function withRemainder(L) {
  const allocs = L.allocs.map((a) => ({
    仓库: String(a['仓库'] || '').trim(),
    仓位编码: String(a['仓位编码'] || '').trim(),
    数量: Math.round(numOr0(a['数量']) * 10000) / 10000,
  }))
  const rest = remainingOf(L)
  if (rest > 0) {
    allocs.push({
      仓库: String(L.row['仓库'] || '').trim(),
      仓位编码: String(L.row['仓位编码'] || '').trim(),
      数量: Math.round(rest * 10000) / 10000,
    })
  }
  return allocs
}

async function confirm() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const payload = splitLines.value.map((L) => ({ lineId: Number(L.row.id), allocs: withRemainder(L) }))
    const res = await engine.splitPurInMultiWh({ docNo: props.docNo, lines: payload })
    ElMessage.success(tt('拆分成功，已拆成 {n} 行').replace('{n}', String(res?.rows || willSplitRows.value)))
    emit('saved', res)
    close()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('拆分失败'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.pmw { display: flex; flex-direction: column; gap: 10px; }
.pmw-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 12.5px; color: #46586e; }
.pmw-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.pmw-tip { color: #8b9893; }
.pmw-caret { cursor: pointer; color: #116a5b; font-weight: 700; user-select: none; }
.pmw-sub { color: #b3bfba; }
.pmw-cur { color: #5d6c67; }
.pmw-del { cursor: pointer; color: #c84d3f; }
.pmw-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 12.5px; color: #46586e; }
.pmw-foot b { color: #1e6fb8; }
.pmw-problem { color: #c84d3f; }
.pmw .bad { color: #c84d3f; }
:deep(.pmw-alloc-row) { background: #f6faf9; }
:deep(.pmw-alloc-row td) { padding-top: 3px; padding-bottom: 3px; }
</style>
