<script setup>
// 字段管理(动态字段/备用列池):入口由调用方按该面板「自定义字段」权限显隐(2026-10-09 起
// 不再是「仅管理员」:组织架构 →「角色与面板权限」勾了该面板「自定义字段」的角色即可配置);
// 列表/表单/查询/导出由元数据引擎自动获得新字段。
// 规格见 docs/design/动态字段扩展-备用列池-V1.0.md §10;入口由 PanelxList「更多 ▼」注入。
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { poolUnavailableOf } from '@core/panel/extFieldPool.js'

// 2026-09-28 修「点关闭无反应」:本组件此前声明 visible prop + emit('update:visible'),
// 而父组件(PanelxList)用 v-model(即 modelValue / update:modelValue)⇒ 页脚「关闭」按钮
// 发出的 update:visible 没人监听(× 能关是 el-dialog 的 update:modelValue 经透传 attr 落回父级)。
// 统一为 Vue 标准 v-model 契约:modelValue + update:modelValue。
const props = defineProps({
  modelValue: Boolean,
  panelCode: String,
  /** 分页签面板(来料检验要求)才传:该面板的页签清单 [{value,label}] —— 自定义列必须指明住哪张表 */
  tabs: { type: Array, default: () => [] },
  /** 打开时默认选中的页签(一般是当前正在看的那张表) */
  defaultTab: { type: String, default: '' },
  /** 父字段候选:(tabKey) => string[] —— 固定列已有的分组 + 该页签已用的父(仍可自己新建) */
  parentOptionsOf: { type: Function, default: null },
})
const emit = defineEmits(['update:modelValue', 'done'])
const engine = usePanelRuntime()
const extFieldOverview = (panelCode) => engine.extFieldOverview(panelCode)
const extFieldAdd = (payload) => engine.extFieldAdd(payload)
const extFieldRetire = (payload) => engine.extFieldRetire(payload)
const loading = ref(false)
const saving = ref(false)
const data = ref({ capacity: 20, fields: [], linePool: [] })
const form = ref({ label: '', labelEn: '', dataType: '文本', dictOptions: '', place: 'detail', inQuery: false, width: 120, required: false, confirmDirty: false, tab: '', parent: '' })
/** 需要指定「所属页签」的面板:传了 tabs 就是 */
const needTab = () => Array.isArray(props.tabs) && props.tabs.length > 0
const blankForm = () => ({ label: '', labelEn: '', dataType: '文本', dictOptions: '', place: 'detail', inQuery: false, width: 120, required: false, confirmDirty: false, tab: needTab() ? (props.defaultTab || props.tabs[0].value) : '', parent: '' })
/** 当前所选页签的父字段候选 */
const parentOptions = computed(() => (needTab() && props.parentOptionsOf ? props.parentOptionsOf(form.value.tab) || [] : []))
/**
 * 该面板是否支持「父字段(分组)」= 分页签面板(下拉候选) 或 支持自定义列的数据记录表(自由输入)。
 * 判据取后端下发的 cap<capacity(数据记录表 8 < 20),避免前端再写一份面板码白名单。
 */
const supportsGroup = computed(() => {
  if (needTab()) return true
  const cap = Number(data.value?.cap)
  const base = Number(data.value?.capacity)
  return Number.isFinite(cap) && Number.isFinite(base) && cap < base
})
/** 自定义列上限用量(数据记录表 8 列;其余面板 = 备用列池总数,不提示) */
const capInfo = computed(() => {
  const cap = Number(data.value?.cap)
  const used = Number(data.value?.usedOfCap)
  if (!Number.isFinite(cap) || !Number.isFinite(cap)) return null
  const base = Number(data.value?.capacity)
  if (!Number.isFinite(base) || cap >= base) return null
  return { cap, used: Number.isFinite(used) ? used : 0, full: Number.isFinite(used) && used >= cap }
})
/** 父字段下拉没有候选(该表还没任何分组名)—— 提示"直接输入一个新名字即可新建" */
const parentEmptyHint = computed(() => needTab() && parentOptions.value.length === 0)
/** 字段列表**只显示当前所选页签自己的**自定义字段(用户口径 2026-10-04:切页签要显示他自己的页面的自定义字段)。
 *  归属判据与 @core/qc/qcInspReqCols 同一口径:严格按 tab 比(分页签面板绑定必填所属页签)。 */
const visibleFields = computed(() => {
  const all = Array.isArray(data.value?.fields) ? data.value.fields : []
  if (!needTab()) return all
  const cur = String(form.value.tab || '').trim()
  return all.filter((f) => String(f.tab || '').trim() === cur)
})
/** 各页签用量一览(切页签前也能看到别的表用了多少) */
const tabUsage = computed(() => {
  const tp = data.value?.tabPools
  if (!tp || !needTab()) return []
  return props.tabs.map((t) => ({ tab: t.value, label: t.label, used: tp[t.value]?.used ?? 0, capacity: tp[t.value]?.capacity ?? 20 }))
})
/** 当前所选页签的扩展池用量(每表 20 个:后端 tabPools 按页签给账) */
const tabPool = computed(() => {
  const tp = data.value?.tabPools
  if (!tp || !needTab()) return null
  return tp[form.value.tab] || null
})
/**
 * 承载表**没有预置备用列池**(或表不存在):这张表加不了自定义字段。
 * 以前后端直接 500(逐列 `SELECT COUNT(*) ... WHERE [备用1] IS NOT NULL` 打到不存在的列),
 * 界面只弹「Request failed with status code 500」并把对话框关掉 —— 用户完全不知道发生了什么。
 * 现在后端下发 poolAvailable=false,这里负责说人话 + 禁用「添加」。
 */
const poolUnavailable = computed(() => poolUnavailableOf(data.value, needTab()))

watch(() => props.modelValue, (v) => { if (v) { form.value = blankForm(); load() } })

async function load() {
  loading.value = true
  try {
    data.value = await extFieldOverview(props.panelCode)
  } catch (e) {
    ElMessage.error(String(e?.message || e))
    emit('update:modelValue', false)
  } finally { loading.value = false }
}

function usedOf(pool) { return (pool || []).filter((p) => p.bound).length }

async function submit() {
  saving.value = true
  try {
    const payload = { ...form.value, panel: props.panelCode }
    const res = await extFieldAdd(payload)
    ElMessage.success(tt('字段已添加') + ':' + res.colName)
    form.value = blankForm()
    await load()
    emit('done')
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || String(e)
    if (String(msg).includes('历史数据') && !form.value.confirmDirty) {
      try {
        await ElMessageBox.confirm(msg + tt('。确认绑定该列?(数据将保留,与新字段同显)'), tt('占用列含历史数据'), { type: 'warning' })
        form.value.confirmDirty = true
        return submit()
      } catch { return }
    }
    ElMessage.error(msg)
  } finally { saving.value = false }
}

async function retire(f) {
  try {
    await ElMessageBox.confirm(tt('停用字段「') + f.label + tt('」?已录入数据将保留,重新绑定同名标签即可恢复显示。'), tt('停用字段'), { type: 'warning' })
  } catch { return }
  try {
    await extFieldRetire({ panel: props.panelCode, fieldId: f.id })
    ElMessage.success(tt('已停用'))
    await load()
    emit('done')
  } catch (e) { ElMessage.error(e?.response?.data?.message || String(e)) }
}
</script>

<template>
  <el-dialog :model-value="modelValue" :title="tt('字段管理')" width="640px" append-to-body :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading">
      <!-- 用途说明(2026-11-11 用户口径「这样子的操作指引不够明确」):
           一句话讲清 做什么 / 加完在哪能看到 / 最多几列。原来只有一行"动态字段 0 · 上限 0/8 列 / 20…"
           的业务黑话，用户看不出这块是干嘛的。 -->
      <div class="fm-intro">
        <div class="fm-intro-main">{{ tt('在这里给这张纸面「加列」。填字段名 →（可选）填分组 → 点「添加」；保存单据后，新列出现在纸面表格的最后一列。') }}</div>
        <div class="fm-intro-sub">
          <template v-if="capInfo">{{ tt('最多') }} <b :class="{ 'fm-cap-full': capInfo.full }">{{ capInfo.cap }}</b> {{ tt('列，已用') }} <b :class="{ 'fm-cap-full': capInfo.full }">{{ capInfo.used }}</b> {{ tt('列') }}</template>
          <template v-else>{{ tt('上限') }} {{ data.capacity }} {{ tt('列') }}</template>
          <span class="fm-intro-note">{{ tt('（「承载列」是系统分配的占用列，不用管）') }}</span>
        </div>
      </div>
      <!-- 满额提示:比"添加按钮变灰"更能说明该怎么办 -->
      <el-alert
        v-if="capInfo?.full && !loading"
        type="warning" :closable="false" show-icon
        :title="tt('自定义列已达上限（已用满），如需再加请先在下方列表「停用」不用的列')"
      />
      <!-- 承载表没有备用列池:说清楚"为什么不能加",而不是让用户点添加再吃一个 500 -->
      <el-alert
        v-if="poolUnavailable && !loading"
        type="warning" :closable="false" show-icon
        :title="tt('该表的承载表未预置备用列池（缺少 备用1..20 列），无法新增自定义字段')"
        :description="tt('需要新增字段时：请让管理员先为这张表补 备用1..20 列（见 tools/migrate-share-file-spare-cols-20261016.sql 的做法），补完即可在界面上加字段。')"
      />
      <div v-if="data.tabPools" class="fm-summary">
        {{ tt('本表已用') }} <b>{{ tabPool ? tabPool.used : 0 }}</b>/{{ data.capacity }}
      </div>
      <!-- 各页签用量一览:一眼看出别的表用了多少(列表本身只显示当前页签的) -->
      <div v-if="tabUsage.length" class="fm-tabusage">
        <span v-for="u in tabUsage" :key="u.tab" class="fm-tabusage-item" :class="{ cur: u.tab === form.tab }">
          {{ tt(u.label) }} {{ u.used }}/{{ u.capacity }}
        </span>
      </div>
      <el-table :data="visibleFields" size="small" max-height="200">
        <el-table-column prop="label" :label="tt('字段名')" min-width="140" />
        <el-table-column v-if="needTab()" prop="tab" :label="tt('所属页签')" width="130" />
        <el-table-column v-if="needTab()" prop="parent" :label="tt('父字段(分组)')" width="120" />
        <el-table-column prop="col" :label="tt('承载列')" width="90" />
        <el-table-column prop="dataType" :label="tt('类型')" width="80" />
        <el-table-column prop="place" :label="tt('位置')" width="120" />
        <el-table-column :label="tt('操作')" width="80">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="retire(row)">{{ tt('停用') }}</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="fm-empty">
            <div>{{ tt('这张表还没有自定义列。') }}</div>
            <div class="fm-empty-steps">{{ tt('① 在下面「新增字段」填字段名　② 想单独一列就留空分组；想和别的列共用一个表头就填分组名　③ 点「添加」') }}</div>
          </div>
        </template>
      </el-table>
      <el-divider content-position="left">{{ tt('新增字段') }}</el-divider>
      <el-form :model="form" label-width="90px" size="small" @submit.prevent>
        <!-- 分页签面板:自定义列必须指明住哪张表(默认=当前页签) -->
        <el-form-item v-if="needTab()" :label="tt('所属页签')">
          <el-select v-model="form.tab" style="width: 220px">
            <el-option v-for="t in tabs" :key="t.value" :label="tt(t.label)" :value="t.value" />
          </el-select>
          <el-tooltip :content="tt('该列只出现在这张表里;检验数据记录带入时也按这张表的列走')" placement="top"><span class="fm-help">?</span></el-tooltip>
        </el-form-item>
        <el-form-item :label="tt('字段名')"><el-input v-model="form.label" :placeholder="tt('中文,禁 . % / ( ) 空格')" maxlength="60" /></el-form-item>
        <!-- 父字段(分组表头):选了父,这一列就并到那个分组标题下;父只是标题、没有数据格,
             检验数据记录只带入子字段(用户口径 2026-10-04) -->
        <!-- 2026-11-11 放开:原先 v-if="needTab()" 只给分页签面板(来料检验要求)。
             而用户要求 8 张**数据记录表**的自定义列也能「设计分叉…可以自己新建一个分组」——
             它们都不是分页签面板。分组承载本就是 yj_field.col_group 的固有语义,
             与"分页签"没有本质耦合。分页签面板仍用下拉(候选来自该表已有分组),
             其余面板直接用输入框写新分组名(留空=独立列)。 -->
        <el-form-item v-if="supportsGroup" :label="tt('分组（分叉）')">
          <div class="fm-parent">
            <el-select
              v-if="needTab()"
              v-model="form.parent"
              style="width: 220px"
              filterable
              clearable
              allow-create
              default-first-option
              :placeholder="tt('留空=独立列;可直接输入新分组名')"
            >
              <el-option v-for="p in parentOptions" :key="p" :label="tt(p)" :value="p" />
            </el-select>
            <el-input
              v-else
              v-model="form.parent"
              style="width: 220px"
              maxlength="50"
              clearable
              :placeholder="tt('留空=独立列;可直接输入新分组名')"
            />
            <span v-if="parentEmptyHint" class="fm-parent-hint">{{ tt('该表还没有分组名：直接输入一个名字（回车）即可新建') }}</span>
          </div>
          <!-- 业务口径说明:用户原话「列还可以设计分叉，可以参考加标水配置记录表的列分叉设计」，
               而「父字段(分组)」这个说法看不出是"两级表头"。这里用大白话讲清留空/填名两种结果。 -->
          <div class="fm-hint-line">{{ tt('留空＝单独一列；输入一个新名字＝新建一个表头分组（纸面表头上方会多出一格跨列标题，与「压力 / 出水 / 去除率」同款）。') }}</div>
          <el-tooltip :content="tt('父只做表头分组、没有数据格;检验数据记录只带入子字段')" placement="top"><span class="fm-help">?</span></el-tooltip>
        </el-form-item>
        <el-form-item :label="tt('英文名')"><el-input v-model="form.labelEn" maxlength="60" /></el-form-item>
        <el-form-item :label="tt('类型')">
          <el-select v-model="form.dataType" style="width: 160px">
            <el-option label="文本" value="文本" /><el-option label="下拉框" value="下拉框" /><el-option label="日期" value="日期" /><el-option label="是否" value="是否" />
          </el-select>
          <el-tooltip :content="tt('日期按 ISO 文本存储,排序正确;数值型请走正式迁移(需合计/排序精度)')" placement="top"><span class="fm-help">?</span></el-tooltip>
        </el-form-item>
        <el-form-item v-if="form.dataType === '下拉框'" :label="tt('词表')"><el-input v-model="form.dictOptions" :placeholder="tt('逗号分隔,如: 是,否,待定')" /></el-form-item>
        <el-form-item v-if="data.headPool" :label="tt('位置')">
          <el-radio-group v-model="form.place">
            <el-radio value="detail">{{ tt('明细行') }}</el-radio><el-radio value="header">{{ tt('表头') }}</el-radio>
          </el-radio-group>
          <div class="fm-hint-line fm-hint-inline">{{ tt('明细行＝纸面表格里的数据列（最常用）；表头＝单据抬头字段。') }}</div>
        </el-form-item>
        <el-form-item :label="tt('进查询区')"><el-switch v-model="form.inQuery" /></el-form-item>
        <el-form-item :label="tt('必填')"><el-switch v-model="form.required" /></el-form-item>
        <el-form-item :label="tt('列宽')"><el-input-number v-model="form.width" :min="60" :max="400" /></el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('关闭') }}</el-button>
      <span v-if="capInfo" class="fm-cap" :class="{ full: capInfo.full }">
        {{ tt('自定义列') }} {{ capInfo.used }}/{{ capInfo.cap }}
      </span>
      <el-button type="primary" :loading="saving" :disabled="poolUnavailable || !form.label || capInfo?.full" @click="submit">{{ tt('添加') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.fm-summary { margin-bottom: 8px; font-size: 13px; color: #606266; }
/* 各页签用量一览:当前页签高亮 */
.fm-tabusage { margin: -2px 0 8px; font-size: 12px; color: #909399; display: flex; flex-wrap: wrap; gap: 10px; }
.fm-tabusage-item.cur { color: #1c4f8a; font-weight: 600; }
.fm-parent { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fm-parent-hint { font-size: 12px; color: #c08a00; }
/* 自定义列用量(数据记录表上限 8):满额转红,与"添加"按钮的禁用状态配套说明原因 */
.fm-cap { font-size: 12px; color: #666; margin-right: 10px; }
.fm-cap.full, .fm-cap-full { color: #d03050; font-weight: 600; }
/* 操作指引(2026-11-11 用户口径「操作指引不够明确」)：顶部一句用途+用量、空态三步、字段旁白话说明 */
.fm-intro { margin-bottom: 10px; padding: 10px 12px; background: #f5f8fb; border: 1px solid #e3eaf2; border-radius: 6px; }
.fm-intro-main { font-size: 13px; color: #1f2d3d; line-height: 20px; }
.fm-intro-sub { margin-top: 4px; font-size: 12px; color: #5a6b7b; }
.fm-intro-note { margin-left: 6px; color: #8a97a5; }
.fm-empty { padding: 10px 0; color: #5a6b7b; }
.fm-empty-steps { margin-top: 6px; font-size: 12px; color: #1f2d3d; line-height: 20px; }
.fm-hint-line { font-size: 12px; color: #5a6b7b; line-height: 18px; margin-top: 2px; }
/* flex-basis:100% 让说明独占一行 —— el-form-item__content 是 flex 行，不加会跟控件挤在一排 */
.fm-hint-inline { margin: 2px 0 8px; flex-basis: 100%; }
.fm-help { margin-left: 6px; color: #909399; cursor: help; }
</style>
