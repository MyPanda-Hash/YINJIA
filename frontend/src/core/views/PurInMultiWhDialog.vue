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
            <!-- 每一行都能改(用户口径「上下都可以改,只要提示不超过总数量」):
                 不做自动分配;填多了底部红字提示、确定置灰,填少了余量留在原行 -->
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
        <el-table-column :label="tt('操作')" width="120" align="center">
          <template #default="{ row }">
            <!-- 回退:把这一组仓库子行合并回一行(确定后服务端把子行合回父行) -->
            <el-button v-if="row.kind === 'line' && row.L.allocs.length >= 2" link type="primary" size="small"
                       @click="mergeBack(row.L)">{{ tt('合并回一行') }}</el-button>
            <el-icon v-else-if="row.kind === 'alloc'" class="pmw-del" :title="tt('删除')" @click="removeAlloc(row.L, row.i)"><Delete /></el-icon>
          </template>
        </el-table-column>
        <template #empty>{{ tt('这张单没有可拆分的明细行') }}</template>
      </el-table>

      <div class="pmw-foot">
        <span>{{ tt('要拆分的行') }}: <b>{{ splitLineCount }}</b> · {{ tt('拆出来') }}: <b>{{ willSplitRows }}</b> {{ tt('行') }}</span>
        <span v-if="problem" class="pmw-problem">{{ problem }}</span>
        <span v-else-if="singleHint" class="pmw-hint">{{ singleHint }}</span>
        <span v-else-if="remainderHint" class="pmw-hint">{{ remainderHint }}</span>
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

/** 该行可入库数量 = 整组行实收数量合计(拆过的行要把子行算进来;没拆过就是本行) */
const maxOf = (L) => (L?.groupRows || (L?.row ? [L.row] : [])).reduce((s, r) => s + numOr0(r['实收数量']), 0)
const allocatedOf = (L) => (L?.allocs || []).reduce((s, a) => s + Math.max(0, numOr0(a['数量'])), 0)
const remainingOf = (L) => Math.round((maxOf(L) - allocatedOf(L)) * 10000) / 10000
const hasId = (L) => L && L.row && L.row.id !== undefined && L.row.id !== null && L.row.id !== ''

/**
 * 要提交的行(用户口径 2026-11-17 第六轮「为什么确定不了」):
 *  · 填了 ≥2 个仓库子行 ⇒ 拆行(或改分配);
 *  · 只填了 1 个仓库子行 ⇒ **把这一行的仓库设成它**(已经拆过的则先合并回一行)—— 不拆行,但要能确定;
 * 没填子行的行不提交,避免把别人的行改坏。
 */
const needsApply = (L) => (L?.allocs || []).length >= 1
const splitLines = computed(() => lines.filter(needsApply))
const splitLineCount = computed(() => splitLines.value.length)
const willSplitRows = computed(() => splitLines.value.reduce((s, L) => s + Math.max(1, L.allocs.length), 0))

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
    // 只填一个仓库 = 直接设为这一行的仓库(不拆行):只要选了仓库就算合法,数量不参与
    const single = list.length === 1
    if (!hasId(L)) return tt('请先保存单据，再拆分仓库')
    if (single) {
      if (!String(list[0]['仓库'] || '').trim()) return tt('第 1 个仓库子行还没选仓库')
      continue
    }
    const bad = list.findIndex((a) => !String(a['仓库'] || '').trim() || numOr0(a['数量']) <= 0)
    if (bad >= 0) return tt('第 {n} 个仓库子行还没填仓库或数量').replace('{n}', String(bad + 1))
    // 同一行拆到"同一个仓库 + 同一个仓位"没有意义,而且会让金蝶收到两条一模一样的行
    const seen = new Set()
    for (const a of list) {
      const k = String(a['仓库'] || '').trim() + '|' + String(a['仓位编码'] || '').trim()
      if (seen.has(k)) return tt('同一行不能出现重复的仓库（仓位）')
      seen.add(k)
    }
    if (remainingOf(L) < 0) return tt('该行各仓库数量合计不能超过可入库数量')
    if (remainingOf(L) > 0 && !String(L.row['仓库'] || '').trim()) {
      return tt('该行还剩 {n} 没有分配，且原行没有仓库，请分完或先给原行选仓库').replace('{n}', fmt(remainingOf(L)))
    }
  }
  return ''
})

const canSubmit = computed(() => !saving.value && splitLineCount.value > 0 && !problem.value)

/** 只填一个仓库 = 直接把这一行的仓库设为它(不拆行);这里给一句说明,别让人以为"填少了" */
const singleHint = computed(() => {
  const hit = lines.find((L) => (L.allocs || []).length === 1)
  return hit ? tt('只填一个仓库：直接把这一行的仓库设为它（不拆行）') : ''
})

/** 填少了不算错:余量留在原行(原仓库),这里只做一句非阻断提示 */
const remainderHint = computed(() => {
  const hit = lines.find((L) => (L.allocs || []).length >= 2 && remainingOf(L) > 0)
  return hit ? tt('剩余 {n} 会留在原行（原仓库）').replace('{n}', fmt(remainingOf(hit))) : ''
})

/**
 * 打开时把"拆过的行"按 [源行id] 归组:**父行 + 缩进子行**(2026-11-17 用户口径
 * 「从那一行分出来的,进去的时候缩进还在」)。没拆过的行原样一条。
 */
async function onOpen() {
  // 先取"拆分组锚点"(源行id 不是面板字段,通用取数带不出来):id → 组id
  const gidOf = new Map()
  try {
    const list = await engine.purInWhGroups(props.docNo)
    for (const g of list || []) {
      const gid = Number(g['源行id'] || 0)
      if (gid) gidOf.set(String(g.id), gid)
    }
  } catch (e) {
    // 取不到就按"没拆过"展示:不影响拆行本身
  }
  const rows = props.rows || []
  const groups = new Map()
  for (const r of rows) {
    const gid = gidOf.get(String(r?.id)) || 0
    if (!gid) continue
    if (!groups.has(gid)) groups.set(gid, [])
    groups.get(gid).push(r)
  }
  lines.splice(0, lines.length)
  for (const [i, r] of rows.entries()) {
    if (!r) continue
    const gid = gidOf.get(String(r.id)) || 0
    // 子行:归到它那一组里,不单独成行(这样"缩进"才在)
    if (gid && gid !== Number(r.id)) continue
    const groupRows = gid ? (groups.get(gid) || [r]) : [r]
    if (groupRows.length > 1) {
      // 父行在前,其余按 id 排序,保证每次打开顺序一致
      groupRows.sort((a, b) => Number(a.id) - Number(b.id))
    }
    const allocs = groupRows.length > 1
      ? groupRows.map((g) => ({
          仓库: String(g['仓库'] || ''),
          仓位编码: String(g['仓位编码'] || ''),
          数量: numOr0(g['实收数量']),
        }))
      : []
    const L = { key: String(gid || r.id || 'new' + i), seq: i + 1, row: r, allocs, groupRows }
    lines.push(L)
  }
  try {
    const src = await loadWhBinSources(engine)
    warehouses.splice(0, warehouses.length, ...src.warehouses)
    bins.splice(0, bins.length, ...src.bins)
  } catch (e) {
    ElMessage.warning(tt('仓库档案读取失败，请刷新后重试'))
  }
}

/**
 * 每行最后一条仓库子行:
 * (2026-11-17 第六轮用户口径「上下都可以改,只要提示不超过总数量。不用自动计算了」)
 * —— 不再自动分配;所有子行都手填,填多了底部红字提示 + 确定置灰,填少了余量留在原行。
 */

/** ▾:给这一行再加一个仓库子行(默认从 0 起,用户自己分) */
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

/** 「合并回一行」= 回退:只留第一个仓库子行(数量取整组合计),确定后服务端把子行合回父行 */
function mergeBack(L) {
  const first = L.allocs[0] || {}
  L.allocs.splice(0, L.allocs.length, {
    仓库: String(first['仓库'] || L.row['仓库'] || ''),
    仓位编码: String(first['仓位编码'] || L.row['仓位编码'] || ''),
    数量: maxOf(L),
  })
}

const close = () => emit('update:modelValue', false)

/** 没分完的余量补一行(仓库 = 原行的仓库),这样服务端"合计 = 实收数量"的老口径仍然成立 */
function payloadOf(L) {
  const allocs = L.allocs.map((a) => ({
    仓库: String(a['仓库'] || '').trim(),
    仓位编码: String(a['仓位编码'] || '').trim(),
    数量: Math.round(numOr0(a['数量']) * 10000) / 10000,
  }))
  // 只有"真要拆成多行"时才把没分完的余量补成原仓库那一行;
  // 只填一个仓库 = 直接把这一行的仓库设成它(服务端 applySingle),不能补成两行
  if (allocs.length >= 2) {
    const rest = remainingOf(L)
    if (rest > 0) {
      allocs.push({
        仓库: String(L.row['仓库'] || '').trim(),
        仓位编码: String(L.row['仓位编码'] || '').trim(),
        数量: Math.round(rest * 10000) / 10000,
      })
    }
  }
  return allocs
}

async function confirm() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const payload = splitLines.value.map((L) => ({ lineId: Number(L.row.id), allocs: payloadOf(L) }))
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
.pmw-hint { color: #8b9893; }
.pmw .bad { color: #c84d3f; }
:deep(.pmw-alloc-row) { background: #f6faf9; }
:deep(.pmw-alloc-row td) { padding-top: 3px; padding-bottom: 3px; }
</style>
