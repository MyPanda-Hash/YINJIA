<template>
  <el-dialog
    v-model="visible"
    :title="tt('编辑表格模版') + (item ? ' · ' + item : '')"
    width="900px"
    append-to-body
    :close-on-click-modal="false"
  >
    <div class="slv-tip">
      {{ tt('一行一列。列名 = 单据表头显示的字；分格填同一个名字的相邻列会合并成一个大表头（例如「试剂用量（g）」）；列宽是打印时的宽度。') }}
    </div>

    <div v-loading="busy">
    <el-alert
      v-if="poolError"
      type="warning"
      :closable="false"
      show-icon
      :title="tt('读不到这张面板的字段库：') + poolError"
      :description="tt('改已有列的列名还能保存；新建列/加列会存不了值，请刷新后重试。')"
    />

    <div class="slv-bar">
      <el-button size="small" type="primary" :disabled="!pool.length" @click="startAdd">＋ {{ tt('加一列') }}</el-button>
      <span class="slv-count">{{ rows.length }} / {{ MAX_COLS }}</span>
      <span v-if="rows.length > MAX_COLS" class="slv-over">{{ tt('超过新建上限 ' + MAX_COLS + ' 列（存量原表可以保留）') }}</span>
    </div>

    <div v-if="adding" class="slv-add">
      <el-radio-group v-model="addMode" size="small">
        <el-radio value="new">{{ tt('新建自定义列') }}</el-radio>
        <el-radio value="reuse">{{ tt('复用已登记字段') }}</el-radio>
      </el-radio-group>
      <template v-if="addMode === 'new'">
        <el-input
          v-model="addLabel"
          size="small"
          style="width: 190px"
          maxlength="60"
          :placeholder="tt('列名（如：氟化钠）')"
          @keyup.enter="confirmAdd"
        />
        <el-select v-model="addType" size="small" style="width: 96px">
          <el-option :label="tt('文本')" value="文本" />
          <el-option :label="tt('日期')" value="日期" />
          <el-option :label="tt('是否')" value="是否" />
          <el-option :label="tt('下拉框')" value="下拉框" />
        </el-select>
        <el-input v-if="addType === '下拉框'" v-model="addDict" size="small" style="width: 170px" :placeholder="tt('词表：是,否,待定')" />
      </template>
      <el-select v-else v-model="addKey" size="small" filterable style="width: 240px" :placeholder="tt('选一个还没用到的字段')">
        <el-option v-for="f in freeFields" :key="f.label" :label="fieldText(f)" :value="f.label" />
      </el-select>
      <el-button size="small" type="primary" @click="confirmAdd">{{ tt('加入') }}</el-button>
      <el-button size="small" @click="adding = false">{{ tt('取消') }}</el-button>
    </div>

    <el-table :data="rows" size="small" border max-height="320" class="slv-t">
      <el-table-column type="index" width="44" align="center" />
      <el-table-column :label="tt('列名')" min-width="150">
        <template #default="{ row }">
          <el-input v-model="row.label" size="small" maxlength="60" :placeholder="tt('如：硫酸镁')" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('数据列（值存到这里）')" min-width="180">
        <template #default="{ row }">
          <span v-if="row.pending" class="slv-pending">{{ tt('自定义列（保存时登记）') }}</span>
          <span v-else-if="fieldOf(row.key)" class="slv-bound">{{ fieldText(fieldOf(row.key)) }}</span>
          <span v-else class="slv-unbound">⚠ {{ tt('未登记，存不了值') }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('列宽(px)')" width="104">
        <template #default="{ row }">
          <el-input-number v-model="row.w" :min="40" :max="400" :step="10" size="small" controls-position="right" style="width: 88px" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('分格')" min-width="150">
        <template #default="{ row }">
          <el-select
            v-model="row.group"
            size="small"
            filterable
            clearable
            allow-create
            default-first-option
            :placeholder="tt('留空=不分格')"
          >
            <el-option v-for="g in groupNames" :key="g" :label="g" :value="g" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column :label="tt('操作')" width="150" align="center">
        <template #default="{ $index }">
          <el-button size="small" :disabled="$index === 0" @click="move($index, -1)">↑</el-button>
          <el-button size="small" :disabled="$index === rows.length - 1" @click="move($index, 1)">↓</el-button>
          <el-button size="small" type="danger" plain @click="removeAt($index)">×</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="slv-preview">
      <div class="slv-pv-label">{{ tt('预览') }}</div>
      <table class="slv-pv">
        <colgroup>
          <col v-for="(c, i) in rows" :key="'cw' + i" :style="{ width: (Number(c.w) > 0 ? Number(c.w) : 90) + 'px' }" />
        </colgroup>
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
                <th v-for="n in s.span" :key="'c' + i + n">{{ rows[s.start + n - 1].label || '—' }}</th>
              </template>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr><td v-for="(c, i) in rows" :key="'d' + i">&nbsp;</td></tr>
        </tbody>
      </table>
    </div>
    </div>

    <template #footer>
      <span class="slv-foot">{{ mode === 'create' ? tt('保存后，这张模版就会出现在单据的「测试项目」下拉里') : '' }}</span>
      <el-button @click="visible = false">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ tt('保存') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * StdLibLayoutEditor.vue —— 标准库条目的**表格模版**设计器（2026-11-06 重做）
 *
 * 【用户口径】「在标准库里面加上一个可以编辑模版的功能，现在的不行，可以让客户在页面进行一个
 *   模版自己设计，然后存进标准库里面……去查看品质管理里面的来料检验要求，这个里面有类似的操作」
 *
 * 【上一版为什么"不行"（已修）】
 *   ① 保存发的是 `{lib,item,content}`，而 StdLibController.update 只认 `{id,content}` ⇒
 *      后端一律回「id 无效」，**改完根本存不进去**（界面只是弹个错，看着像没反应）；
 *   ② 「新增模版」只是把列清成 6 列，并没有**建一个新条目** ⇒ 没法为"很多种项目"加表；
 *   ③ 改「列名」顺手把 key 也改了（旧版把两者绑在一起），而 key 才是落库用的明细字段名 ⇒ 列名一改，
 *      这一列的值就存进一个不存在的字段，静默丢数据。
 *   这一版：编辑走 {id,content}；新建走 {lib,item,content}；key 与列名分开；
 *   新列先登记成动态字段（写法同「来料检验要求」的『自定义字段』，后端自动绑空闲备用列）。
 *
 * 【两种模式】openEdit(entry) 改已有条目；openCreate(name) 新建（列表侧弹窗问名字后调）。
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@/core/request'
import { parseLayout } from '@/core/panel/spikeWaterLayout.js'
import {
  MAX_COLS,
  baseTemplateCols,
  appendColumn,
  validateTemplate,
  layoutContent,
} from '@/core/panel/spikeWaterTemplate.js'

const props = defineProps({
  /** 面板码（新建自定义列要按它登记动态字段） */
  panelCode: { type: String, default: 'RD_SPIKE_WATER' },
  /** 标准库编码（lab.test_item）—— 新建条目时用 */
  lib: { type: String, default: '' },
})
const emit = defineEmits(['saved'])

const visible = ref(false)
const busy = ref(false)
const saving = ref(false)
/** 'create' = 新增模版（保存走 /stdlib/add）；'edit' = 改已有条目（走 /stdlib/update + id） */
const mode = ref('edit')
const entryId = ref(null)
const item = ref('')
const rows = ref([])
const pool = ref([])
const poolError = ref('')

const adding = ref(false)
const addMode = ref('new')
const addKey = ref('')
const addLabel = ref('')
const addType = ref('文本')
const addDict = ref('')

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** 面板明细字段池（label/dataType/width）—— 列的 key 必须是这里的一个 label，值才存得进去 */
async function loadPool() {
  poolError.value = ''
  try {
    const res = await request.get('/px/getPanelConfig', { params: { panelCode: props.panelCode } })
    const cfg = res?.data ?? res
    const fields = (cfg?.detail?.tabs?.[0]?.fields || []).filter((f) => f && f.dataName)
    pool.value = fields.map((f) => ({ label: f.dataName, dataType: f.dataType, width: f.width }))
  } catch (e) {
    pool.value = []
    poolError.value = e?.response?.data?.message || e?.message || String(e)
  }
}

function fieldOf(label) {
  return pool.value.find((f) => f.label === label) || null
}
function fieldText(f) {
  if (!f) return ''
  return String(f.label).replace(/\\n|\n/g, ' ') + ' · ' + tt(f.dataType || '文本')
}
const freeFields = computed(() => pool.value.filter((f) => !rows.value.some((r) => r.key === f.label)))
const groupNames = computed(() => {
  const out = []
  for (const r of rows.value) {
    const g = str(r.group)
    if (g && !out.includes(g)) out.push(g)
  }
  return out
})

/** 改已有模版：content 能解析就用它，否则按"还没设计"给一套 6 列基础表 */
async function openEdit(entry) {
  mode.value = 'edit'
  entryId.value = Number(entry?.id) || null
  item.value = str(entry?.item)
  const parsed = parseLayout(entry?.content)
  rows.value = parsed.ok
    ? parsed.cols.map((c) => ({ key: c.key, label: c.label, w: c.w, group: c.group || '' }))
    : []
  visible.value = true
  busy.value = true
  await loadPool()
  if (!rows.value.length) rows.value = baseTemplateCols(pool.value)
  busy.value = false
}

/** 新增模版：名字由列表侧先问好；列先给 6 列基础表 */
async function openCreate(name) {
  mode.value = 'create'
  entryId.value = null
  item.value = str(name)
  rows.value = []
  visible.value = true
  busy.value = true
  await loadPool()
  rows.value = baseTemplateCols(pool.value)
  busy.value = false
}

function startAdd() {
  if (rows.value.length >= MAX_COLS) {
    ElMessage.warning(tt('最多 ' + MAX_COLS + ' 列（这张表当前 ' + rows.value.length + ' 列，可删到 15 列以内）'))
    return
  }
  if (!pool.value.length) {
    ElMessage.warning(tt('还没读到字段库，暂不能加列'))
    return
  }
  adding.value = true
  addMode.value = nextFreeFieldExists() ? 'new' : 'reuse'
  addKey.value = freeFields.value[0]?.label || ''
  addLabel.value = ''
  addType.value = '文本'
  addDict.value = ''
}
function nextFreeFieldExists() {
  return freeFields.value.length > 0
}

/** 加入一列：新建自定义列 = 先记 pending，保存时再登记成动态字段（不留下没用的字段行） */
function confirmAdd() {
  if (addMode.value === 'reuse') {
    const f = fieldOf(addKey.value)
    if (!f) return ElMessage.warning(tt('请选一个字段'))
    rows.value = appendColumn(rows.value, f)
    adding.value = false
    return
  }
  const label = str(addLabel.value)
  if (!label) return ElMessage.warning(tt('列名不能为空'))
  if (pool.value.some((f) => f.label === label) || rows.value.some((r) => r.key === label)) {
    return ElMessage.warning(tt('这个名称已经有字段了，换个名字，或用「复用已登记字段」'))
  }
  if (addType.value === '下拉框' && !str(addDict.value)) return ElMessage.warning(tt('下拉框要给词表（逗号分隔）'))
  rows.value = [
    ...rows.value,
    {
      key: label,
      label,
      w: addType.value === '日期' ? 110 : 90,
      pending: true,
      dataType: addType.value,
      dictOptions: str(addDict.value),
    },
  ]
  adding.value = false
}

function removeAt(i) {
  rows.value.splice(i, 1)
}
function move(i, d) {
  const j = i + d
  if (j < 0 || j >= rows.value.length) return
  const [x] = rows.value.splice(i, 1)
  rows.value.splice(j, 0, x)
}

/** 表头分段（相邻同名分格合并；无分格列占两行） */
const segments = computed(() => {
  const out = []
  const cs = rows.value
  let i = 0
  while (i < cs.length) {
    const g = str(cs[i].group)
    if (!g) {
      out.push({ group: '', span: 0, col: cs[i], start: i })
      i += 1
      continue
    }
    let n = 1
    while (i + n < cs.length && str(cs[i + n].group) === g) n += 1
    out.push({ group: g, span: n, col: cs[i], start: i })
    i += n
  }
  return out
})

/** 把一条 pending 自定义列登记成动态字段（后端自动绑空闲备用列并写 yj_field，值才存得进去） */
async function registerField(row) {
  const body = {
    panel: props.panelCode,
    label: row.key,
    dataType: row.dataType || '文本',
    place: 'detail',
    width: Number(row.w) > 0 ? Number(row.w) : 90,
  }
  if (body.dataType === '下拉框') body.dictOptions = row.dictOptions || ''
  const post = async (extra) => {
    const res = await request.post('/px/extField/add', { ...body, ...extra })
    if (res && res.code != null && res.code !== 200) throw new Error(res.message || tt('保存失败'))
    return res?.data ?? {}
  }
  try {
    return await post({})
  } catch (e) {
    const msg = String(e?.response?.data?.message || e?.message || '')
    // 空闲备用列里有历史数据时后端要求二次确认（数据保留、与新列同显）
    if (msg.includes('历史数据') && !row.confirmDirty) {
      try {
        await ElMessageBox.confirm(tt(msg) + tt('。确认绑定该列？（历史数据保留，与新列同显）'), tt('占用列含历史数据'), { type: 'warning' })
      } catch {
        throw new Error(tt('已取消'))
      }
      row.confirmDirty = true
      return await post({ confirmDirty: true })
    }
    throw e
  }
}

async function save() {
  if (!item.value) return ElMessage.warning(tt('模版名称不能为空'))
  const v = validateTemplate(rows.value, pool.value)
  if (!v.ok) return ElMessage.warning(v.errors[0])
  saving.value = true
  try {
    // 1) 本次新建的列先登记成字段（这样列 key 才是能落库的字段名）
    for (const r of rows.value.filter((x) => x.pending)) {
      const out = await registerField(r)
      const label = str(out.label) || r.key
      r.key = label
      r.pending = false
      if (!pool.value.some((f) => f.label === label)) {
        pool.value = [...pool.value, { label, dataType: r.dataType || '文本', width: out.width || r.w }]
      }
    }
    const content = layoutContent(rows.value)
    // 2) 存进标准库：改已有条目必须带 id（后端只认 id，这是上一版"存不进去"的根因）
    const res = mode.value === 'create'
      ? await request.post('/stdlib/add', { lib: props.lib, item: item.value, content })
      : await request.post('/stdlib/update', { id: entryId.value, content })
    if (res && res.code != null && res.code !== 200) throw new Error(res.message || tt('保存失败'))
    ElMessage.success(tt('已保存，选中该条目的单据会用这套表头'))
    visible.value = false
    emit('saved', { item: item.value, mode: mode.value })
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存失败'))
  } finally {
    saving.value = false
  }
}

defineExpose({ openEdit, openCreate })
</script>

<style scoped>
.slv-tip { font-size: 12px; color: #606266; line-height: 1.6; margin-bottom: 10px; }
.slv-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.slv-count { font-size: 12px; color: #606266; font-variant-numeric: tabular-nums; }
.slv-over { font-size: 12px; color: #c08a00; }
.slv-add {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 10px; padding: 8px 10px; background: #f7f9fb; border: 1px solid #e4edf5; border-radius: 4px;
}
.slv-t { margin-bottom: 10px; }
.slv-pending { font-size: 12px; color: #1c4f8a; }
.slv-bound { font-size: 12px; color: #606266; }
.slv-unbound { font-size: 12px; color: #c08a00; }
.slv-preview { margin-top: 12px; max-height: 190px; overflow: auto; }
.slv-pv-label { font-size: 12px; color: #606266; margin-bottom: 6px; }
.slv-pv { border-collapse: collapse; table-layout: fixed; }
.slv-pv th,
.slv-pv td {
  border: 1px solid #dcdfe6; background: #fafafa; font-size: 12px; font-weight: 600;
  padding: 4px 6px; color: #303133; text-align: center; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.slv-pv td { background: #fff; height: 22px; }
.slv-foot { margin-right: 12px; font-size: 12px; color: #909399; }
</style>
