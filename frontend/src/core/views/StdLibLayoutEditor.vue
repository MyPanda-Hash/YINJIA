<template>
  <el-dialog v-model="visible" :title="tt('表格结构') + ' · ' + itemName" width="820px" append-to-body>
    <div class="slv-tip">
      {{ tt('下面是这张表的列。改列名、改宽度、设分格（同一分格名的相邻列会合并成一个大表头），也可以加列/删列。最多 15 列。') }}
    </div>

    <div class="slv-bar">
      <el-button size="small" type="primary" @click="newTemplate">{{ tt('新增模版') }}</el-button>
      <el-button size="small" @click="addCol">{{ tt('加一列') }}</el-button>
      <span class="slv-count">{{ rows.length }} / {{ MAX_COLS }}</span>
      <span class="slv-hint">{{ tt('「新增模版」= 清空成 6 列空表格，自己填列名') }}</span>
    </div>

    <el-table :data="rows" size="small" border max-height="340" class="slv-t">
      <el-table-column type="index" width="46" align="center" />
      <el-table-column :label="tt('列名')" min-width="150">
        <template #default="{ row }">
          <el-input v-model="row.label" size="small" :placeholder="tt('如：硫酸镁')" @input="syncKey(row)" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('列宽(px)')" width="104">
        <template #default="{ row }">
          <el-input v-model.number="row.w" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('分格')" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.group" size="small" :placeholder="tt('留空=不分格')" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('操作')" width="130" align="center">
        <template #default="{ $index }">
          <el-button size="small" :disabled="$index === 0" @click="move($index, -1)">↑</el-button>
          <el-button size="small" :disabled="$index === rows.length - 1" @click="move($index, 1)">↓</el-button>
          <el-button size="small" type="danger" plain @click="remove($index)">×</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="slv-preview">
      <div class="slv-pv-label">{{ tt('预览') }}</div>
      <table class="slv-pv">
        <thead>
          <tr>
            <template v-for="(s, i) in segments" :key="'g' + i">
              <th v-if="s.span === 0" :rowspan="2">{{ s.col.label || '—' }}</th>
              <th v-else :colspan="s.span">{{ s.group }}</th>
            </template>
          </tr>
          <tr>
            <template v-for="(s, i) in segments" :key="'s' + i">
              <template v-if="s.span > 0">
                <th v-for="n in s.span" :key="'c' + i + n">{{ rows[subIndexOf(i, n)].label || '—' }}</th>
              </template>
            </template>
          </tr>
        </thead>
      </table>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" @click="save">{{ tt('保存') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * StdLibLayoutEditor.vue —— 标准库条目的**表格结构**编辑器（2026-11-06）
 *
 * 【用户口径】「加标水这个单据做成可以自定义面板格式的，就是可以自己编辑要多少列，
 *   列下面有没有分格，列名字叫啥，这个要和标准库绑定的」
 *   → 追加：「你去模仿来料检验单那个是怎么做的，你就加上一个新增模版按钮在标准库里面，
 *     然后生成一个 6 列的表格，让他自己去编辑列名称和列行数等，最多不超过 15 列」
 *
 * 【为什么是这个形态】第一版让用户直接编辑 JSON —— 用户明确反馈「这个设计得人家就不会操作」。
 *   现在改成**一张可视化表**：一行一列，填列名/列宽/分格即可；
 *   「新增模版」一键清成 6 列空表格（照来料检验单「自定义字段」的交互：点按钮 → 得到可填的列）。
 *   底层仍存 JSON（yj_std_lib.content），但用户永远看不到它。
 */
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/core/request'
import { parseLayout } from '@/core/panel/spikeWaterLayout.js'

/** 列数上限（用户口径「最多不超过 15 列」） */
const MAX_COLS = 15
/** 「新增模版」生成的初始列数（用户口径「生成一个 6 列的表格」） */
const TEMPLATE_COLS = 6

const visible = ref(false)
const lib = ref('')
const itemCode = ref('')
const itemName = ref('')
const rows = ref([])

function blankRows(n) {
  return Array.from({ length: n }, (_, i) => ({
    key: '列' + (i + 1),
    label: '列' + (i + 1),
    w: 90,
    group: '',
  }))
}

/** 打开：把该条目现有 content 解析成可编辑的行；没配过就给 6 列空模版 */
async function open(libCode, item) {
  lib.value = libCode
  itemCode.value = item
  itemName.value = item
  rows.value = []
  let had = false
  try {
    const res = await request.get('/stdlib/list', { params: { lib: libCode, all: 1 } })
    const list = res?.data ?? res ?? []
    const hit = list.find((r) => String(r.item_code || r.item || '').trim() === String(item).trim())
    const parsed = parseLayout(hit ? hit.content : null)
    if (parsed.ok) {
      had = true
      rows.value = parsed.cols.map((c) => ({ key: c.key, label: c.label, w: c.w, group: c.group || '' }))
    }
  } catch (e) { /* 取不到就按"还没配过"处理 */ }
  if (!had) rows.value = blankRows(TEMPLATE_COLS)
  visible.value = true
}

/** 「新增模版」：清成 6 列空表格（会覆盖当前编辑内容，先确认） */
async function newTemplate() {
  try {
    await ElMessageBox.confirm(
      tt('会把当前列全部换成 6 列空表格（列名先叫 列1..列6，你再逐个改）。继续？'),
      tt('新增模版'),
      { confirmButtonText: tt('继续'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch (e) { return }
  rows.value = blankRows(TEMPLATE_COLS)
}

function syncKey(row) {
  row.key = String(row.label || '').trim()
}
function addCol() {
  // 只在"已经超过上限"时拦：存量 17 列的可以继续减到 15 以内，但不能再加到 18
  if (rows.value.length >= MAX_COLS) {
    ElMessage.warning(tt('最多 ' + MAX_COLS + ' 列（这张表当前 ' + rows.value.length + ' 列，可删到 15 列以内）'))
    return
  }
  const i = rows.value.length + 1
  rows.value.push({ key: '列' + i, label: '列' + i, w: 90, group: '' })
}
function remove(i) {
  rows.value.splice(i, 1)
}
function move(i, d) {
  const j = i + d
  if (j < 0 || j >= rows.value.length) return
  const [x] = rows.value.splice(i, 1)
  rows.value.splice(j, 0, x)
}

const segments = computed(() => {
  const out = []
  let i = 0
  const cs = rows.value
  while (i < cs.length) {
    const g = String(cs[i].group || '').trim()
    if (!g) { out.push({ group: '', span: 0, col: cs[i], start: i }); i += 1; continue }
    let n = 1
    while (i + n < cs.length && String(cs[i + n].group || '').trim() === g) n += 1
    out.push({ group: g, span: n, col: cs[i], start: i })
    i += n
  }
  return out
})
function subIndexOf(segIdx, n) {
  return segments.value[segIdx].start + n - 1
}

async function save() {
  const cols = rows.value
    .filter((r) => String(r.label || '').trim())
    .map((r) => {
      const c = { key: String(r.label).trim(), label: String(r.label).trim(), w: Number(r.w) > 0 ? Number(r.w) : 90 }
      const g = String(r.group || '').trim()
      if (g) c.group = g
      else c.rowspan = 2
      return c
    })
  if (!cols.length) {
    ElMessage.warning(tt('至少要有一列'))
    return
  }
  // 15 列上限只约束**新建**（「新增模版」/「加一列」已挡）；
  // 存量结构是设计原表（除铅 17 列就是真的 17 列），保存时只提示不拦截 ——
  // 否则用户改个列名就被"最多 15 列"卡住，等于把历史表头锁死。
  if (cols.length > MAX_COLS) {
    ElMessage.warning(tt('当前 ' + cols.length + ' 列（超过新建上限 ' + MAX_COLS + ' 列），已按现有列保存'))
  }
  try {
    await request.post('/stdlib/update', {
      lib: lib.value,
      item: itemCode.value,
      content: JSON.stringify({ cols }, null, 1),
    })
    ElMessage.success(tt('已保存，选中该条目的单据会用这套表头'))
    visible.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存失败'))
  }
}

function onClosed() { emit('saved') }
const emit = defineEmits(['saved'])

defineExpose({ open })
</script>

<style scoped>
.slv-tip { font-size: 12px; color: #606266; line-height: 1.6; margin-bottom: 10px; }
.slv-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.slv-count { font-size: 12px; color: #606266; font-variant-numeric: tabular-nums; }
.slv-hint { font-size: 12px; color: #909399; }
.slv-t { margin-bottom: 10px; }
.slv-preview { margin-top: 14px; max-height: 200px; overflow: auto; }
.slv-pv-label { font-size: 12px; color: #606266; margin-bottom: 6px; }
.slv-pv { border-collapse: collapse; width: 100%; table-layout: fixed; }
.slv-pv th {
  border: 1px solid #dcdfe6; background: #fafafa; font-size: 12px; font-weight: 600;
  padding: 4px 6px; color: #303133; text-align: center; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
</style>
