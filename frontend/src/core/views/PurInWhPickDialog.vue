<!-- PurInWhPickDialog.vue —— 采购入库单「仓库」格子改成的**多选仓库**弹窗(2026-11-17 用户口径)

     用户原话:「不要设置成这样,可以在仓库选择时多个按钮,实现多选仓库弹窗」
       —— 即:入口放在明细的「仓库」格子上,点一下弹出仓库清单(可勾多个),不再在操作列放一颗拆分图标。

     勾一个仓库  = 和原来的单选一样,直接把仓库落到这一行;
     勾多个仓库 = 这一行按仓库**拆成多行**(每行一个仓库 + 各自的实收数量),合计必须等于原行实收数量。

     拆行本身在服务端(PurInSplitService:复制行 + 分摊金额 + 拆占用链,一个事务),
     这里只负责:勾仓库、填数量、先把关(校验口径见 core/panel/purInSplit.js)。 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('选择仓库（可多选）')"
    width="760px"
    top="6vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <div class="pwp">
      <div class="pwp-head">
        <span class="pwp-chip">{{ tt('存货') }}: <b>{{ line['存货编码'] || '—' }}</b> {{ line['存货名称'] || '' }}</span>
        <span class="pwp-chip">{{ tt('实收数量') }}: <b>{{ total }}</b> {{ line['计量单位'] || '' }}</span>
        <span class="pwp-chip">{{ tt('批次号') }}: {{ line['批次号'] || line['批号'] || '—' }}</span>
        <span class="pwp-chip">{{ tt('采购订单行号') }}: {{ line['采购订单行号'] || line['源单行号'] || '—' }}</span>
      </div>
      <div class="pwp-tip">
        {{ tt('勾选多个仓库时，这一行会按仓库拆成多行（来源采购订单行号、批次号不变）；只勾一个仓库则直接用它') }}
      </div>

      <el-input v-model="keyword" :placeholder="tt('搜索仓库名称/编码')" clearable class="pwp-search">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>

      <div class="pwp-list">
        <div v-for="w in filtered" :key="keyOf(w)" class="pwp-item" :class="{ on: isChecked(w) }">
          <el-checkbox :model-value="isChecked(w)" @change="(v) => toggle(w, v)" />
          <span class="pwp-name" :title="w.name">{{ w.name }}</span>
          <span class="pwp-code">{{ w.code }}</span>
          <el-input-number v-model="qtyOf[keyOf(w)]" :min="0" :max="total" :controls="false"
                           :disabled="!isChecked(w)" size="small" :placeholder="tt('数量')" style="width: 120px" />
        </div>
        <div v-if="!filtered.length" class="pwp-empty">{{ tt('没有匹配的仓库') }}</div>
      </div>

      <div class="pwp-foot">
        <el-button size="small" :disabled="checkedKeys.length < 2" @click="evenSplit">{{ tt('平均分配') }}</el-button>
        <span class="pwp-sum">
          {{ tt('已选') }} <b>{{ checkedKeys.length }}</b> {{ tt('个仓库') }}
          <template v-if="multi">
            · {{ tt('已分配合计') }} <b>{{ sum }}</b> / {{ total }}
            · {{ tt('差额') }} <b :class="{ bad: diff !== 0 }">{{ diff }}</b>
          </template>
          <template v-else>· {{ tt('只选一个仓库：直接使用该仓库（不拆行）') }}</template>
        </span>
      </div>
      <div v-if="hint" class="pwp-hint">{{ hint }}</div>
    </div>
    <template #footer>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!canSubmit" :loading="saving" @click="confirm">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 只做三件事:① 拉仓库档案(应用已登录的档案接口) ② 勾仓库 + 填各仓数量并先把关
 * ③ 一个仓库就回填本行、多个仓库就交给服务端拆行。
 * 校验口径全在 core/panel/purInSplit.js(有单测),这里不写第二份判断。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { loadWhBinSources } from '@core/selection/genWhBin'
import { allocSum, canSplitRow, remainingQty, rowTotalQty, toPayload, validateAllocs } from '@core/panel/purInSplit'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 采购入库单号(拆行时服务端要按它校验草稿/未转ERP) */
  docNo: { type: String, default: '' },
  /** 要选仓库的那一行(bl_purchase_in 的一行;拆多行时必须有 id) */
  row: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'picked', 'saved'])

const line = computed(() => props.row || {})
const total = computed(() => rowTotalQty(line.value))
const warehouses = reactive([])
const qtyOf = reactive({})
const checkedKeys = reactive([])
const keyword = ref('')
const saving = ref(false)

const keyOf = (w) => String(w.code || w.name || '')

function isChecked(w) {
  return checkedKeys.includes(keyOf(w))
}

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return warehouses
  return warehouses.filter((w) => String(w.name).toLowerCase().includes(k) || String(w.code).toLowerCase().includes(k))
})

/** 勾上的仓库 → 分配清单(交给纯函数校验) */
const allocs = computed(() => warehouses
  .filter((w) => isChecked(w))
  .map((w) => ({ 仓库: w.name, 仓位编码: '', 数量: Number(qtyOf[keyOf(w)] || 0) })))

const sum = computed(() => allocSum(allocs.value))
const diff = computed(() => remainingQty(allocs.value, total.value))
const check = computed(() => validateAllocs(allocs.value, total.value))
/** 勾一个仓库不拆行,不受"合计相等"约束;勾多个才走拆分校验(且这一行必须已落库) */
const multi = computed(() => checkedKeys.length >= 2)
const canSubmit = computed(() => {
  if (saving.value) return false
  if (!checkedKeys.length) return false
  if (!multi.value) return true
  return canSplitRow(line.value) && check.value.ok
})

const hint = computed(() => {
  if (!checkedKeys.length) return tt('至少选择一个仓库')
  if (!multi.value) return ''
  if (!canSplitRow(line.value)) return tt('请先保存单据，再拆分仓库')
  const p = (check.value.problems || [])[0]
  if (!p) return ''
  if (p.code === 'sumMismatch') return tt('各仓库数量合计必须等于实收数量')
  if (p.code === 'qtyNotPositive') return tt('第 {n} 行数量必须大于 0').replace('{n}', String(p.index + 1))
  if (p.code === 'noWh') return tt('第 {n} 行没有选仓库').replace('{n}', String(p.index + 1))
  return ''
})

async function onOpen() {
  keyword.value = ''
  checkedKeys.splice(0, checkedKeys.length)
  for (const k of Object.keys(qtyOf)) delete qtyOf[k]
  try {
    const src = await loadWhBinSources(engine)
    warehouses.splice(0, warehouses.length, ...src.warehouses)
  } catch (e) {
    ElMessage.warning(tt('仓库档案读取失败，请刷新后重试'))
  }
  // 已选仓库默认勾上并吃掉整行数量(常见操作:先保原仓,再勾第二个仓分出去)
  const cur = String(line.value['仓库'] || line.value['仓库编码'] || '').trim()
  const hit = warehouses.find((w) => w.name === cur || w.code === cur)
  if (hit) {
    checkedKeys.push(keyOf(hit))
    qtyOf[keyOf(hit)] = total.value
  }
}

function toggle(w, on) {
  const k = keyOf(w)
  const i = checkedKeys.indexOf(k)
  if (on && i < 0) {
    checkedKeys.push(k)
    if (!(Number(qtyOf[k]) > 0)) qtyOf[k] = 0
  } else if (!on && i >= 0) {
    checkedKeys.splice(i, 1)
  }
  // 只剩一个仓库时不需要分配:数量直接等于整行实收量(与"勾一个 = 直接落值"同口径,避免差额红字误导)
  if (checkedKeys.length === 1) qtyOf[checkedKeys[0]] = total.value
}

/** 平均分配:把实收数量均摊到已勾的仓库上,尾差给最后一个(保证合计不差一分) */
function evenSplit() {
  const list = checkedKeys.slice()
  if (list.length < 2) return
  const each = Math.floor((total.value / list.length) * 10000) / 10000
  let left = total.value
  list.forEach((k, i) => {
    const v = i === list.length - 1 ? Math.round(left * 10000) / 10000 : each
    qtyOf[k] = v
    left = Math.round((left - v) * 10000) / 10000
  })
}

const close = () => emit('update:modelValue', false)

async function confirm() {
  if (!canSubmit.value) return
  const picked = warehouses.filter((w) => isChecked(w))
  if (picked.length === 1) {
    // 只勾一个仓库:不拆行,直接回填(与原来的单选参照行为一致)
    const w = picked[0]
    emit('picked', {
      name: w.name,
      code: w.code,
      clearBin: String(line.value['仓库'] || '') !== String(w.name),
    })
    close()
    return
  }
  saving.value = true
  try {
    const res = await engine.splitPurInLine({
      docNo: props.docNo,
      lineId: Number(line.value.id),
      allocs: toPayload(allocs.value),
    })
    ElMessage.success(tt('拆分成功，已拆成 {n} 行').replace('{n}', String(res?.rows || picked.length)))
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
.pwp { display: flex; flex-direction: column; gap: 10px; }
.pwp-head { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12.5px; color: #46586e; }
.pwp-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.pwp-tip { font-size: 12px; color: #8b9893; }
.pwp-list { max-height: 320px; overflow: auto; border: 1px solid #e4e9ef; border-radius: 4px; }
.pwp-item { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid #f0f3f6; }
.pwp-item:last-child { border-bottom: none; }
.pwp-item.on { background: #f2f8f6; }
.pwp-name { flex: 1; font-size: 13px; color: #1e2b27; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwp-code { font-size: 12px; color: #8b9893; width: 90px; }
.pwp-empty { padding: 18px; text-align: center; color: #8b9893; font-size: 12.5px; }
.pwp-foot { display: flex; align-items: center; gap: 12px; }
.pwp-sum { font-size: 12.5px; color: #46586e; }
.pwp-sum b { color: #1e6fb8; }
.pwp-sum b.bad { color: #c84d3f; }
.pwp-hint { font-size: 12px; color: #c84d3f; }
</style>
