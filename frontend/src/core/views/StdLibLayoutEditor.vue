<template>
  <el-dialog v-model="visible" :title="tt('表格结构编辑')" width="760px" append-to-body @closed="onClosed">
    <div class="slv-tip">
      {{ tt('这里编辑的是「表格长什么样」：有几列、每列叫什么、哪些列归到同一个分格下面。保存后写进标准库条目，选中该条目的单据就用这套表头。') }}
    </div>

    <el-table :data="rows" size="small" border class="slv-t">
      <el-table-column :label="tt('列名')" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.label" size="small" :placeholder="tt('如：硫酸镁')" @input="syncKey(row)" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('列宽')" width="96">
        <template #default="{ row }">
          <el-input v-model.number="row.w" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('分格')" min-width="150">
        <template #default="{ row }">
          <el-input v-model="row.group" size="small" :placeholder="tt('留空=不分格')" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('操作')" width="120" align="center">
        <template #default="{ $index }">
          <el-button size="small" :disabled="$index === 0" @click="move($index, -1)">↑</el-button>
          <el-button size="small" :disabled="$index === rows.length - 1" @click="move($index, 1)">↓</el-button>
          <el-button size="small" type="danger" plain @click="remove($index)">×</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="slv-actions">
      <el-button size="small" @click="addCol">{{ tt('加一列') }}</el-button>
      <span class="slv-hint">{{ tt('同一分格名、且相邻的列会合并成一个表头大格（如「试剂用量（g）」盖住 7 列）。') }}</span>
    </div>

    <div class="slv-preview">
      <div class="slv-pv-label">{{ tt('预览') }}</div>
      <table class="slv-pv">
        <thead>
          <tr>
            <template v-for="(s, i) in segments" :key="'g' + i">
              <th v-if="s.span === 0" :rowspan="2">{{ s.col.label }}</th>
              <th v-else :colspan="s.span">{{ s.group }}</th>
            </template>
          </tr>
          <tr>
            <template v-for="(s, i) in segments" :key="'s' + i">
              <template v-if="s.span > 0">
                <th v-for="n in s.span" :key="'c' + i + n">{{ rows[subIndexOf(i, n)].label }}</th>
              </template>
            </template>
          </tr>
        </thead>
      </table>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" @click="save">{{ tt('保存到标准库条目') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * StdLibLayoutEditor.vue —— 标准库条目的**表格结构**可视化编辑器（2026-11-06）
 *
 * 【用户口径】「加标水这个单据做成可以自定义面板格式的，就是可以自己编辑要多少列，
 *   列下面有没有分格，列名字叫啥，这个要和标准库绑定的，就是一个标准库条目对应一个设计的表格样式」
 *
 * 【为什么不直接让用户改 JSON】标准库正文本身是可手改的字符串（StdLibManager 就把它当字符串），
 *   但"表头长什么样"这件事手写 JSON 太容易错一个逗号就白屏。这里给一张可视化表：
 *   加列/删列/改列名/设分格/上下移动，右边实时预览两行表头。
 *
 * 【落点】保存时把 { cols:[...] } 序列化回**该标准库条目的 content**（走既有 /stdlib/update），
 *   所以"一个条目 = 一套表样式"成立，且不新增任何后端接口。
 */
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
import { ElMessage } from 'element-plus'
import request from '@/core/request'
import { parseLayout } from '@/core/panel/spikeWaterLayout.js'

const visible = ref(false)
const lib = ref('')
const itemCode = ref('')
const rows = ref([])

/** 打开：把该条目现有 content 解析成可编辑的行 */
async function open(libCode, item) {
  lib.value = libCode
  itemCode.value = item
  rows.value = []
  try {
    const res = await request.get('/stdlib/list', { params: { lib: libCode, all: 1 } })
    const list = res?.data ?? res ?? []
    const hit = list.find((r) => String(r.item_code || r.item || '').trim() === String(item).trim())
    const { cols } = parseLayout(hit ? hit.content : null)
    rows.value = cols.map((c) => ({ key: c.key, label: c.label, w: c.w, group: c.group || '' }))
  } catch (e) {
    rows.value = []
  }
  visible.value = true
}

function syncKey(row) {
  // 列名即数据键（历史单据按列名存值）—— 改列名会同时改键，这是有意的：
  // 用户改了列名就是要那一列以后叫这个名字；已录入的老单据仍按老键存着，互不影响。
  row.key = String(row.label || '').trim()
}

function addCol() {
  rows.value.push({ key: '', label: '', w: 90, group: '' })
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

/** 预览用：按分格分段（与渲染器 groupSegments 同口径，这里内联一份避免再引依赖） */
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
  try {
    await request.post('/stdlib/update', {
      lib: lib.value,
      item: itemCode.value,
      content: JSON.stringify({ cols }, null, 1),
    })
    ElMessage.success(tt('表格结构已保存，选中该条目的单据会用这套表头'))
    visible.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存失败'))
  }
}

function onClosed() {
  emit('saved')
}
const emit = defineEmits(['saved'])

defineExpose({ open })
</script>

<style scoped>
.slv-tip { font-size: 12px; color: #606266; line-height: 1.6; margin-bottom: 10px; }
.slv-t { margin-bottom: 10px; }
.slv-actions { display: flex; align-items: center; gap: 10px; }
.slv-hint { font-size: 12px; color: #909399; }
.slv-preview { margin-top: 16px; }
.slv-pv-label { font-size: 12px; color: #606266; margin-bottom: 6px; }
.slv-pv { border-collapse: collapse; width: 100%; table-layout: fixed; }
.slv-pv th {
  border: 1px solid #dcdfe6; background: #fafafa; font-size: 12px; font-weight: 600;
  padding: 4px 6px; color: #303133; text-align: center; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
</style>
