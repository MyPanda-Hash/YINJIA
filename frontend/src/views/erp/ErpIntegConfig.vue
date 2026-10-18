<!--
  ERP集成配置清单(2026-10-18)

  用户口径:「写一个 erp 集成配置清单,分为导入与转出两种面板,针对每个面板的,然后每个面板再分类,
  将他们每个面板的 api 接口、对应的设备、字段间的映射,做成一个可视化、可以统一配置编辑的面板」。

  页面结构 = 三个联动区(一屏内完成"选 → 看 → 改"):
    ① 导入 / 转出 两个页签(链路方向不同:导入=金蝶→MES,转出=MES→金蝶);
    ② 每个页签按「基础资料 / 单据 / 设备」分类,左侧分类栏带计数;
    ③ 中间是接口卡片(方法 + 接口地址 + 对应面板 + 启用态 + 映射/设备条数),
       右侧是选中接口的编辑区:接口信息 / 对应设备 / 字段映射 三块,各自独立保存。

  数据源 = 三张配置表(erp_integ_api / _field / _device),
  接口地址与字段名照 KingdeePushService 现役口径实录;金蝶侧未开通的接口 启用=0 并在说明里写明。
  权限:页面级虚拟面板 ERP_INTEG(view 可见 / save 配置保存),未授权者菜单不显示。
-->
<template>
  <div class="erp-integ" v-loading="loading">
    <!-- ═══════════ 抬头:标题 + 统计 + 动作 ═══════════ -->
    <header class="ei-head">
      <div class="ei-head-main">
        <h2 class="ei-title">{{ tt('ERP集成配置清单') }}</h2>
        <p class="ei-sub">
          {{ tt('导入 = 把金蝶星辰的档案与单据拉进 MES;转出 = 把 MES 已审核单据推到金蝶。每条链路都写明接口、对应设备与字段映射,可在此统一维护。') }}
        </p>
      </div>
      <div class="ei-stats">
        <div class="ei-stat">
          <span class="n">{{ stats.接口数 }}</span>
          <span class="l">{{ tt('接口') }}</span>
        </div>
        <div class="ei-stat on">
          <span class="n">{{ stats.启用数 }}</span>
          <span class="l">{{ tt('已启用') }}</span>
        </div>
        <div class="ei-stat">
          <span class="n">{{ stats.字段映射数 }}</span>
          <span class="l">{{ tt('字段映射') }}</span>
        </div>
        <div class="ei-stat">
          <span class="n">{{ stats.设备绑定数 }}</span>
          <span class="l">{{ tt('设备绑定') }}</span>
        </div>
      </div>
      <div class="ei-head-actions">
        <el-button size="small" :icon="Refresh" @click="load()">{{ tt('刷新') }}</el-button>
      </div>
    </header>

    <!-- ═══════════ 方向页签 ═══════════ -->
    <div class="ei-dirbar">
      <el-tabs v-model="direction" class="ei-tabs" @tab-change="onDirectionChange">
        <el-tab-pane :label="`${tt('导入')} (${countOf('导入')})`" name="导入" />
        <el-tab-pane :label="`${tt('转出')} (${countOf('转出')})`" name="转出" />
      </el-tabs>
      <div class="ei-flow">
        <template v-if="direction === '导入'">
          <span class="node source">{{ tt('金蝶云星辰') }}</span>
          <span class="line"><span class="arrow">⟶</span><em>{{ tt('接口') }}</em></span>
          <span class="node target">{{ tt('MES') }}</span>
        </template>
        <template v-else>
          <span class="node source">{{ tt('MES') }}</span>
          <span class="line"><span class="arrow">⟶</span><em>{{ tt('转ERP按钮 / 定时') }}</em></span>
          <span class="node target">{{ tt('金蝶云星辰') }}</span>
        </template>
      </div>
    </div>

    <div class="ei-body">
      <!-- ═══════════ 左:分类 ═══════════ -->
      <aside class="ei-cats">
        <div class="ei-cats-title">{{ tt('分类') }}</div>
        <div
          v-for="c in categories"
          :key="c"
          class="ei-cat"
          :class="{ active: activeCat === c }"
          @click="selectCategory(c)"
        >
          <span class="cat-name">{{ tt(c) }}</span>
          <span class="cat-count">{{ catCount(c) }}</span>
        </div>
        <div class="ei-cats-foot">{{ tt('一条链路 = 一个接口;设备与字段映射按接口挂。') }}</div>
      </aside>

      <!-- ═══════════ 中:接口清单 ═══════════ -->
      <section class="ei-list">
        <div class="ei-list-head">
          <span class="ei-list-title">{{ tt(activeCat) }} · {{ tt(direction) }}</span>
          <el-button v-if="!readonly" size="small" type="primary" plain :icon="Plus" @click="newItem">{{ tt('新增接口') }}</el-button>
        </div>
        <div class="ei-cards">
          <div
            v-for="it in visibleItems"
            :key="it._key"
            class="ei-card"
            :class="{ active: it._key === activeKey, off: !isOn(it.启用), draft: it._draft }"
            @click="selectItem(it)"
          >
            <div class="card-top">
              <span class="card-name">{{ it.接口名称 || tt('未命名接口') }}</span>
              <el-tag v-if="it._draft" size="small" type="warning">{{ tt('未保存') }}</el-tag>
              <el-tag v-else :type="isOn(it.启用) ? 'success' : 'info'" size="small">
                {{ isOn(it.启用) ? tt('已启用') : tt('已停用') }}
              </el-tag>
            </div>
            <div class="card-code">
              <span class="mono">{{ it.接口编码 || '—' }}</span>
              <span class="method" :class="methodClass(it.请求方式)">{{ it.请求方式 || '—' }}</span>
            </div>
            <div class="card-path mono" :title="it.接口地址">{{ it.接口地址 || tt('未填写接口地址') }}</div>
            <div class="card-meta">
              <span class="meta-pill">{{ it.对应面板 || tt('无面板') }}</span>
              <span class="meta-pill ghost">{{ it.目标对象 || tt('未写目标') }}</span>
            </div>
            <div class="card-foot">
              <span>{{ (it.fields || []).length }} {{ tt('条映射') }}</span>
              <span class="dot">·</span>
              <span>{{ (it.devices || []).length }} {{ tt('台设备') }}</span>
            </div>
          </div>
          <div v-if="!visibleItems.length" class="ei-empty">{{ tt('该分类下还没有接口,点右上「新增接口」开始配置。') }}</div>
        </div>
      </section>

      <!-- ═══════════ 右:详情编辑 ═══════════ -->
      <section v-if="current" class="ei-detail">
        <div class="ei-detail-head">
          <div class="dh-left">
            <span class="dh-title">{{ current.接口名称 || tt('未命名接口') }}</span>
            <span class="dh-code mono">{{ current.接口编码 || tt('编码待填') }}</span>
            <!-- 2026-10-18 用户口径:除管理员只可看不可编辑 -->
            <el-tag v-if="readonly" size="small" type="info">{{ tt('只读(仅管理员可编辑)') }}</el-tag>
          </div>
          <div v-if="!readonly" class="dh-right">
            <el-button v-if="current._draft" size="small" @click="dropDraft">{{ tt('放弃') }}</el-button>
            <el-button v-else size="small" type="danger" plain :icon="Delete" @click="removeItem">{{ tt('删除接口') }}</el-button>
          </div>
        </div>

        <!-- ── ① 接口信息 ── -->
        <div class="ei-block">
          <div class="block-head">
            <span class="block-title"><i class="bar"></i>{{ tt('接口信息') }}</span>
            <el-button v-if="!readonly" size="small" type="primary" :loading="savingItem" @click="saveItem">{{ tt('保存接口') }}</el-button>
          </div>
          <div class="form-grid">
            <label class="fi">
              <span class="fi-label">{{ tt('接口名称') }}<em>*</em></span>
              <el-input v-model="current.接口名称" size="small" :disabled="readonly" :placeholder="tt('如:采购入库单转出')" />
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('接口编码') }}<em>*</em></span>
              <el-input
                v-model="current.接口编码"
                size="small"
                class="mono"
                :disabled="readonly || !current._draft"
                :placeholder="tt('唯一键,如 EXP_PUR_IN')"
              />
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('分类') }}</span>
              <el-select v-model="current.分类" size="small" :disabled="readonly">
                <el-option v-for="c in categories" :key="c" :label="tt(c)" :value="c" />
              </el-select>
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('提供方') }}</span>
              <el-input v-model="current.提供方" size="small" :disabled="readonly" :placeholder="tt('金蝶云星辰')" />
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('请求方式') }}</span>
              <el-select v-model="current.请求方式" size="small" :disabled="readonly">
                <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
              </el-select>
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('触发方式') }}</span>
              <el-input v-model="current.触发方式" size="small" :disabled="readonly" :placeholder="tt('转ERP按钮 / 定时同步 / 手动')" />
            </label>
            <label class="fi wide">
              <span class="fi-label">{{ tt('接口地址') }}</span>
              <el-input v-model="current.接口地址" size="small" class="mono" :disabled="readonly" :placeholder="tt('/jdy/v2/scm/pur_inbound')" />
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('对应面板') }}</span>
              <el-select
                v-model="current.对应面板"
                size="small"
                filterable
                clearable
                :disabled="readonly"
                :placeholder="tt('MES 面板编码')"
                @change="loadPanelFields"
              >
                <el-option
                  v-for="p in panels"
                  :key="p.面板编码"
                  :label="`${p.面板编码} · ${tt(p.面板名称)}`"
                  :value="p.面板编码"
                />
              </el-select>
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('目标对象') }}</span>
              <el-input v-model="current.目标对象" size="small" :disabled="readonly" :placeholder="tt('金蝶侧单据/档案名')" />
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('排序') }}</span>
              <el-input-number v-model="current.排序" size="small" :min="0" :step="10" :disabled="readonly" controls-position="right" />
            </label>
            <label class="fi">
              <span class="fi-label">{{ tt('启用') }}</span>
              <el-switch v-model="current.启用" :disabled="readonly" :active-text="tt('启用')" :inactive-text="tt('停用')" inline-prompt />
            </label>
            <label class="fi wide">
              <span class="fi-label">{{ tt('说明') }}</span>
              <el-input v-model="current.说明" size="small" type="textarea" :disabled="readonly" :autosize="{ minRows: 1, maxRows: 3 }" />
            </label>
          </div>
        </div>

        <!-- ── ② 对应设备 ── -->
        <div class="ei-block">
          <div class="block-head">
            <span class="block-title">
              <i class="bar"></i>{{ tt('对应设备') }}
              <em class="block-hint">{{ tt('这条接口的数据来自哪些设备 / 作用于哪些设备') }} · {{ deviceRows.length }} {{ tt('台设备') }}</em>
            </span>
            <el-button v-if="!readonly" size="small" type="primary" :loading="savingDevices" @click="saveDevices">{{ tt('保存设备') }}</el-button>
          </div>
          <div class="dev-toolbar">
            <el-select
              v-model="deviceToAdd"
              size="small"
              filterable
              clearable
              class="dev-picker"
              :disabled="readonly"
              :placeholder="tt('从设备档案(bs_equip)选择设备')"
              @change="addDevice"
            >
              <el-option
                v-for="d in devices"
                :key="d.设备编码"
                :label="`${d.设备编码} · ${d.设备名称}`"
                :value="d.设备编码"
                :disabled="deviceBound(d.设备编码)"
              />
            </el-select>
            <span class="dev-hint">{{ tt('设备编码取「系统管理平台 · 设备」档案;停用设备不再出现。') }}</span>
          </div>
          <el-table v-if="deviceRows.length" :data="deviceRows" size="small" border class="dev-table" empty-text="">
            <el-table-column :label="tt('设备编码')" width="120">
              <template #default="{ row }"><span class="mono">{{ row.设备编码 }}</span></template>
            </el-table-column>
            <el-table-column :label="tt('设备名称')" width="140" prop="设备名称" />
            <el-table-column :label="tt('设备用途')" width="140">
              <template #default="{ row }">
                <el-select v-model="row.设备用途" size="small" :disabled="readonly" filterable allow-create default-first-option>
                  <el-option v-for="u in deviceRoles" :key="u" :label="tt(u)" :value="u" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="tt('备注')" min-width="200">
              <template #default="{ row }"><el-input v-model="row.备注" size="small" :disabled="readonly" /></template>
            </el-table-column>
            <el-table-column v-if="!readonly" :label="tt('操作')" width="70" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="deviceRows.splice($index, 1)">{{ tt('移除') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!deviceRows.length" class="ei-empty small">{{ tt('未绑定设备(纯档案/单据类接口通常没有设备)。') }}</div>
        </div>

        <!-- ── ③ 字段映射 ── -->
        <div class="ei-block">
          <div class="block-head">
            <span class="block-title">
              <i class="bar"></i>{{ tt('字段映射') }}
              <em class="block-hint">{{ tt('一行 = 一个 MES 字段/常量 → 金蝶接口字段') }} · {{ tt('必填') }} {{ requiredCount }} / {{ fieldRows.length }}</em>
            </span>
            <div v-if="!readonly" class="block-actions">
              <el-button size="small" @click="fillFromPanel">{{ tt('按面板字段带出') }}</el-button>
              <el-button size="small" @click="addFieldRow">{{ tt('新增一行') }}</el-button>
              <el-button size="small" type="primary" :loading="savingFields" @click="saveFields">{{ tt('保存映射') }}</el-button>
            </div>
          </div>
          <el-table v-if="fieldRows.length" :data="fieldRows" size="small" border class="map-table" empty-text="">
            <el-table-column :label="tt('序号')" width="60" align="center">
              <!-- 序号 = 行在表里的位置,连续 1、2、3…(2026-10-18 用户口径「序号有错误」) -->
              <template #default="{ $index }"><span class="mono">{{ $index + 1 }}</span></template>
            </el-table-column>
            <el-table-column :label="tt('映射层级')" width="110">
              <template #default="{ row }">
                <el-select v-model="row.映射层级" size="small" :disabled="readonly">
                  <el-option v-for="lv in levels" :key="lv" :label="tt(lv)" :value="lv" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="tt('MES字段')" min-width="180">
              <template #default="{ row }">
                <el-select
                  v-model="row.MES字段"
                  size="small"
                  filterable
                  allow-create
                  default-first-option
                  :reserve-keyword="false"
                  :disabled="readonly"
                  :placeholder="tt('选择面板字段或直接输入常量')"
                >
                  <el-option v-for="f in panelFieldOptions" :key="f.字段名" :label="f.字段名" :value="f.字段名" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="'→'" width="42" align="center" class-name="arrow-col" />
            <el-table-column :label="tt('ERP字段')" min-width="170">
              <template #default="{ row }">
                <el-input v-model="row.ERP字段" size="small" class="mono" :disabled="readonly" :placeholder="tt('如 material_number')" />
              </template>
            </el-table-column>
            <el-table-column :label="tt('转换规则')" width="132">
              <template #default="{ row }">
                <el-select v-model="row.转换规则" size="small" :disabled="readonly" filterable allow-create default-first-option>
                  <el-option v-for="tf in transforms" :key="tf" :label="tt(tf)" :value="tf" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="tt('必填')" width="64" align="center">
              <template #default="{ row }"><el-switch v-model="row.是否必填" size="small" :disabled="readonly" /></template>
            </el-table-column>
            <el-table-column :label="tt('启用')" width="64" align="center">
              <template #default="{ row }"><el-switch v-model="row.启用" size="small" :disabled="readonly" /></template>
            </el-table-column>
            <el-table-column :label="tt('备注')" min-width="190">
              <template #default="{ row }"><el-input v-model="row.备注" size="small" :disabled="readonly" /></template>
            </el-table-column>
            <el-table-column v-if="!readonly" :label="tt('操作')" width="104" align="center" fixed="right">
              <template #default="{ $index }">
                <el-button link size="small" :disabled="$index === 0" @click="moveField($index, -1)">↑</el-button>
                <el-button link size="small" :disabled="$index === fieldRows.length - 1" @click="moveField($index, 1)">↓</el-button>
                <el-button link type="danger" size="small" @click="fieldRows.splice($index, 1)">×</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!fieldRows.length" class="ei-empty small">{{ tt('还没有字段映射,点「按面板字段带出」自动铺一行一字段。') }}</div>
        </div>
      </section>

      <section v-else class="ei-detail empty">
        <el-empty :description="tt('从左侧接口清单选一条,或新增接口')" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh } from '@element-plus/icons-vue'
import request from '@/core/request'
import { tt } from '@/i18n'
import { useUserStore } from '@/stores/user'

/* 2026-10-18 用户口径:「保证这个面板除管理员只可看不可编辑」——
 *   前端只负责"看得见但点不动"(按钮隐藏/控件 disabled + 弹提示);
 *   真正的闸门在服务端:ErpIntegController 的写接口一律 perm.requireAdmin()(非管理员 403),
 *   故即使有人绕过界面直接打接口也改不了配置。 */
const user = useUserStore()
const readonly = computed(() => !user.isAdmin)

/* ── 常量 ── */
const methods = ['GET', 'POST']
const levels = ['表头', '明细', '档案', '常量']
const deviceRoles = ['产量采集', '点检对象', '保养对象', '数据来源', '其他']

/* ── 状态 ── */
const loading = ref(false)
const direction = ref('导入')
const activeCat = ref('基础资料')
const items = ref([])
const stats = ref({ 接口数: 0, 启用数: 0, 字段映射数: 0, 设备绑定数: 0 })
const categories = ref(['基础资料', '单据', '设备'])
const transforms = ref([])
const panels = ref([])
const devices = ref([])
const panelFieldOptions = ref([])

const activeKey = ref('')
const deviceRows = ref([])
const fieldRows = ref([])
const deviceToAdd = ref('')
const savingItem = ref(false)
const savingDevices = ref(false)
const savingFields = ref(false)

/* ── 派生 ── */
const visibleItems = computed(() =>
  items.value.filter((i) => i.方向 === direction.value && i.分类 === activeCat.value)
)
const current = computed(() => items.value.find((i) => i._key === activeKey.value) || null)
/** 当前接口的必填映射条数(映射块抬头「必填 N / 总数」) */
const requiredCount = computed(() => fieldRows.value.filter((r) => r.是否必填).length)

function isOn(v) {
  return v === true || v === 1 || v === '1' || v === 'true'
}
function methodClass(m) {
  return String(m || '').toUpperCase() === 'POST' ? 'post' : 'get'
}
function countOf(dir) {
  return items.value.filter((i) => i.方向 === dir).length
}
function catCount(cat) {
  return items.value.filter((i) => i.方向 === direction.value && i.分类 === cat).length
}

/* ── 载入 ── */
async function load() {
  loading.value = true
  try {
    const res = await request.get('/erp/integ/config')
    const data = res?.data ?? res ?? {}
    const list = data.items || []
    items.value = list.map((it) => ({
      ...it,
      _key: it.接口编码,
      _draft: false,
      fields: it.fields || [],
      devices: it.devices || [],
    }))
    categories.value = data.categories || categories.value
    transforms.value = data.transforms || []
    stats.value = data.stats || stats.value
    if (!items.value.some((i) => i.方向 === direction.value && i.分类 === activeCat.value)) {
      const first = items.value.find((i) => i.方向 === direction.value)
      if (first) activeCat.value = first.分类
    }
    const keep = items.value.find((i) => i._key === activeKey.value)
    if (keep) selectItem(keep)
    else if (visibleItems.value.length) selectItem(visibleItems.value[0])
    else {
      activeKey.value = ''
      fieldRows.value = []
      deviceRows.value = []
    }
  } catch (e) {
    ElMessage.error(tt('配置加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const res = await request.get('/erp/integ/meta')
    const data = res?.data ?? res ?? {}
    panels.value = data.panels || []
    devices.value = data.devices || []
    if (data.categories) categories.value = data.categories
    if (data.transforms) transforms.value = data.transforms
  } catch (e) {
    /* 元数据失败不阻断配置加载:面板/设备下拉为空而已 */
  }
}

async function loadPanelFields() {
  const code = current.value?.对应面板
  panelFieldOptions.value = []
  if (!code) return
  try {
    const res = await request.get('/erp/integ/panelFields', { params: { panelCode: code } })
    panelFieldOptions.value = res?.data ?? res ?? []
  } catch (e) {
    panelFieldOptions.value = []
  }
}

/* ── 选择 ── */
function selectCategory(cat) {
  activeCat.value = cat
  if (visibleItems.value.length) selectItem(visibleItems.value[0])
  else {
    activeKey.value = ''
    fieldRows.value = []
    deviceRows.value = []
  }
}

function onDirectionChange() {
  const first = items.value.find((i) => i.方向 === direction.value)
  activeCat.value = first?.分类 || '基础资料'
  if (visibleItems.value.length) selectItem(visibleItems.value[0])
  else selectCategory(activeCat.value)
}

function selectItem(it) {
  activeKey.value = it._key
  fieldRows.value = (it.fields || []).map((r) => ({ ...r, 是否必填: isOn(r.是否必填), 启用: r.启用 == null ? true : isOn(r.启用) }))
  deviceRows.value = (it.devices || []).map((r) => ({
    设备编码: r.设备编码,
    设备名称: r.设备名称,
    设备用途: r.设备用途 || '数据来源',
    备注: r.备注 || '',
  }))
  loadPanelFields()
}

/** 只读闸门(前端):非管理员点任何写动作直接拦下,并说明"仅管理员可编辑" */
function denyReadonly() {
  if (!readonly.value) return false
  ElMessage.warning(tt('只读模式:仅管理员可编辑配置'))
  return true
}

function newItem() {
  if (denyReadonly()) return
  const seq = Math.max(0, ...items.value.filter((i) => i.方向 === direction.value).map((i) => Number(i.排序) || 0)) + 10
  const draft = {
    _key: `__new_${Date.now()}`,
    _draft: true,
    接口编码: '',
    接口名称: '',
    方向: direction.value,
    分类: activeCat.value,
    提供方: '金蝶云星辰',
    接口地址: '',
    请求方式: direction.value === '导入' ? 'GET' : 'POST',
    对应面板: '',
    目标对象: '',
    触发方式: direction.value === '导入' ? '定时同步' : '转ERP按钮',
    启用: true,
    排序: seq,
    说明: '',
    fields: [],
    devices: [],
  }
  items.value.unshift(draft)
  selectItem(draft)
}

async function dropDraft() {
  const it = current.value
  if (!it?._draft) return
  items.value = items.value.filter((x) => x._key !== it._key)
  activeKey.value = ''
  fieldRows.value = []
  deviceRows.value = []
  if (visibleItems.value.length) selectItem(visibleItems.value[0])
}

/* ── 保存 ── */
async function saveItem() {
  const it = current.value
  if (!it || denyReadonly()) return
  if (!String(it.接口编码 || '').trim()) return ElMessage.warning(tt('请填写接口编码'))
  if (!String(it.接口名称 || '').trim()) return ElMessage.warning(tt('请填写接口名称'))
  savingItem.value = true
  try {
    await request.post('/erp/integ/item', {
      接口编码: it.接口编码,
      接口名称: it.接口名称,
      方向: it.方向,
      分类: it.分类,
      提供方: it.提供方,
      接口地址: it.接口地址,
      请求方式: it.请求方式,
      对应面板: it.对应面板,
      目标对象: it.目标对象,
      触发方式: it.触发方式,
      启用: isOn(it.启用),
      排序: Number(it.排序) || 0,
      说明: it.说明,
    })
    ElMessage.success(tt('接口已保存'))
    await load()
    selectByCode(it.接口编码)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'))
  } finally {
    savingItem.value = false
  }
}

function selectByCode(code) {
  const hit = items.value.find((i) => i.接口编码 === code)
  if (hit) {
    direction.value = hit.方向
    activeCat.value = hit.分类
    selectItem(hit)
  }
}

async function removeItem() {
  const it = current.value
  if (!it || denyReadonly()) return
  try {
    await ElMessageBox.confirm(
      tt('删除接口「{name}」？其字段映射与设备绑定会一并删除。').replace('{name}', it.接口名称 || it.接口编码),
      tt('确认删除'),
      { type: 'warning', confirmButtonText: tt('删除'), cancelButtonText: tt('取消') }
    )
  } catch (e) {
    return
  }
  try {
    await request.post('/erp/integ/item/delete', { 接口编码: it.接口编码 })
    ElMessage.success(tt('已删除'))
    activeKey.value = ''
    await load()
  } catch (e) {
    ElMessage.error(tt('删除失败'))
  }
}

async function saveFields() {
  const it = current.value
  if (!it || denyReadonly()) return
  if (it._draft) return ElMessage.warning(tt('请先保存接口信息,再保存字段映射'))
  savingFields.value = true
  try {
    await request.post('/erp/integ/fields', {
      接口编码: it.接口编码,
      rows: fieldRows.value.map((r, i) => ({
        序号: i + 1,
        映射层级: r.映射层级 || '表头',
        MES字段: r.MES字段,
        ERP字段: r.ERP字段,
        转换规则: r.转换规则 || '直传',
        是否必填: !!r.是否必填,
        启用: r.启用 !== false,
        备注: r.备注,
      })),
    })
    ElMessage.success(tt('字段映射已保存'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'))
  } finally {
    savingFields.value = false
  }
}

async function saveDevices() {
  const it = current.value
  if (!it || denyReadonly()) return
  if (it._draft) return ElMessage.warning(tt('请先保存接口信息,再保存设备绑定'))
  savingDevices.value = true
  try {
    await request.post('/erp/integ/devices', {
      接口编码: it.接口编码,
      rows: deviceRows.value.map((r) => ({
        设备编码: r.设备编码,
        设备用途: r.设备用途,
        备注: r.备注,
      })),
    })
    ElMessage.success(tt('设备绑定已保存'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'))
  } finally {
    savingDevices.value = false
  }
}

/* ── 字段 / 设备行操作 ── */
function addFieldRow() {
  if (denyReadonly()) return
  fieldRows.value.push({ 映射层级: '表头', MES字段: '', ERP字段: '', 转换规则: '直传', 是否必填: false, 启用: true, 备注: '' })
}

function moveField(index, delta) {
  if (denyReadonly()) return
  const to = index + delta
  if (to < 0 || to >= fieldRows.value.length) return
  const arr = fieldRows.value
  ;[arr[index], arr[to]] = [arr[to], arr[index]]
}

/** 按当前面板的字段清单铺映射(已有同名 MES 字段的行不重复) */
function fillFromPanel() {
  if (denyReadonly()) return
  const it = current.value
  if (!it?.对应面板) return ElMessage.warning(tt('先在「接口信息」里选好对应面板'))
  if (!panelFieldOptions.value.length) return ElMessage.warning(tt('该面板没有可带出的字段'))
  const exists = new Set(fieldRows.value.map((r) => r.MES字段).filter(Boolean))
  let added = 0
  for (const f of panelFieldOptions.value) {
    if (exists.has(f.字段名)) continue
    fieldRows.value.push({ 映射层级: '明细', MES字段: f.字段名, ERP字段: '', 转换规则: '直传', 是否必填: false, 启用: true, 备注: '' })
    added++
  }
  ElMessage.success(added ? tt('已带出 {n} 个字段,记得补 ERP 字段名后保存').replace('{n}', added) : tt('没有新字段可带出'))
}

function deviceBound(code) {
  return deviceRows.value.some((r) => r.设备编码 === code)
}

function addDevice(code) {
  if (denyReadonly()) return
  if (!code) return
  deviceToAdd.value = ''
  if (deviceBound(code)) return
  const d = devices.value.find((x) => x.设备编码 === code)
  deviceRows.value.push({ 设备编码: code, 设备名称: d?.设备名称 || '', 设备用途: '数据来源', 备注: '' })
}

onMounted(async () => {
  await loadMeta()
  await load()
})
</script>

<style scoped>
.erp-integ {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 10px 14px 14px;
  background: var(--t-bg, #f4f6f9);
  color: var(--t-text-1);
  overflow: hidden;
}

/* ── 抬头 ── */
.ei-head {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  flex-shrink: 0;
  padding: 12px 16px;
  background: var(--t-card-bg, #fff);
  border: 1px solid var(--t-border, #e3e7ec);
  border-radius: 8px;
}
.ei-head-main { flex: 1; min-width: 0; }
.ei-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.ei-sub {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--t-text-3, #8a93a0);
}
.ei-stats { display: flex; gap: 8px; flex-shrink: 0; }
.ei-stat {
  min-width: 76px;
  padding: 6px 12px;
  text-align: center;
  border-radius: 6px;
  background: var(--t-hover-bg, #f3f6fa);
  border: 1px solid var(--t-border-light, #eef1f5);
}
.ei-stat.on { background: #eaf7ee; border-color: #cbe9d5; }
.ei-stat .n { display: block; font-size: 18px; font-weight: 700; line-height: 1.2; color: var(--t-primary, #2f6bff); }
.ei-stat.on .n { color: #1f9d55; }
.ei-stat .l { display: block; font-size: 11px; color: var(--t-text-3, #8a93a0); }
.ei-head-actions { display: flex; align-items: center; }

/* ── 方向条 ── */
.ei-dirbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  margin-top: 8px;
  padding: 0 12px;
  background: var(--t-card-bg, #fff);
  border: 1px solid var(--t-border, #e3e7ec);
  border-radius: 8px 8px 0 0;
}
.ei-tabs { flex: 1; }
.ei-tabs :deep(.el-tabs__header) { margin: 0; }
.ei-flow { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--t-text-2); }
.ei-flow .node {
  padding: 3px 10px;
  border-radius: 12px;
  background: #eef3ff;
  border: 1px solid #d8e3ff;
  color: #2f5fd0;
  font-weight: 600;
}
.ei-flow .node.target { background: #eefaf1; border-color: #cfeeda; color: #1f8a4c; }
.ei-flow .line { display: flex; align-items: center; gap: 4px; color: #9aa4b2; }
.ei-flow .line .arrow { font-size: 16px; color: #7f8b9c; }
.ei-flow .line em { font-style: normal; font-size: 11px; }

/* ── 三栏 ── */
.ei-body {
  display: flex;
  gap: 8px;
  flex: 1;
  min-height: 0;
  margin-top: 8px;
}
.ei-cats {
  width: 150px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 8px;
  background: var(--t-card-bg, #fff);
  border: 1px solid var(--t-border, #e3e7ec);
  border-radius: 8px;
  overflow: auto;
}
.ei-cats-title { padding: 0 6px 8px; font-size: 12px; font-weight: 700; color: var(--t-text-3); }
.ei-cat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 10px;
  margin-bottom: 4px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--t-text-2);
}
.ei-cat:hover { background: var(--t-hover-bg, #f3f6fa); }
.ei-cat.active { background: #eaf1ff; color: #2f5fd0; font-weight: 600; }
.ei-cat .cat-count {
  min-width: 20px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  background: var(--t-hover-bg, #eef1f6);
  color: var(--t-text-3);
}
.ei-cat.active .cat-count { background: #d7e4ff; color: #2f5fd0; }
.ei-cats-foot { margin-top: auto; padding: 8px 6px 0; font-size: 11px; line-height: 1.7; color: var(--t-text-3); }

.ei-list {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px;
  background: var(--t-card-bg, #fff);
  border: 1px solid var(--t-border, #e3e7ec);
  border-radius: 8px;
}
.ei-list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ei-list-title { font-size: 13px; font-weight: 700; }
.ei-cards { flex: 1; min-height: 0; overflow: auto; padding-right: 2px; }
.ei-card {
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid var(--t-border, #e3e7ec);
  border-left: 3px solid #cfd8e3;
  border-radius: 7px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  background: var(--t-card-bg, #fff);
}
.ei-card:hover { box-shadow: 0 2px 8px rgba(31, 42, 55, 0.09); }
.ei-card.active { border-color: #9db9ff; border-left-color: #2f6bff; background: #f7faff; }
.ei-card.off { opacity: 0.68; }
.ei-card.draft { border-left-color: #e6a23c; background: #fffcf5; }
.card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.card-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-code { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.card-code .mono { font-size: 11px; color: var(--t-text-3); }
.method {
  padding: 0 6px;
  font-size: 10px;
  line-height: 16px;
  border-radius: 3px;
  font-weight: 700;
}
.method.get { background: #eaf7ee; color: #1f8a4c; }
.method.post { background: #fff2e8; color: #c96a15; }
.card-path {
  margin-top: 5px;
  font-size: 11px;
  color: var(--t-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.meta-pill {
  padding: 1px 7px;
  font-size: 10px;
  border-radius: 9px;
  background: #eef3ff;
  color: #2f5fd0;
}
.meta-pill.ghost { background: var(--t-hover-bg, #f3f6fa); color: var(--t-text-3); }
.card-foot { display: flex; gap: 6px; margin-top: 6px; font-size: 11px; color: var(--t-text-3); }
.card-foot .dot { opacity: 0.5; }

.ei-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 10px 12px;
  background: var(--t-card-bg, #fff);
  border: 1px solid var(--t-border, #e3e7ec);
  border-radius: 8px;
}
.ei-detail.empty { align-items: center; justify-content: center; }
.ei-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dh-left { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.dh-title { font-size: 15px; font-weight: 700; }
.dh-code { font-size: 11px; color: var(--t-text-3); }
.dh-right { display: flex; gap: 8px; }

.ei-block {
  border: 1px solid var(--t-border-light, #eef1f5);
  border-radius: 8px;
  padding: 10px 12px 12px;
  background: var(--t-card-bg, #fff);
}
.block-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.block-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.block-title .bar { display: inline-block; width: 3px; height: 13px; border-radius: 2px; background: #2f6bff; }
.block-hint { font-style: normal; font-weight: 400; font-size: 11px; color: var(--t-text-3); }
.block-actions { display: flex; gap: 6px; }

.form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
.fi { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fi.wide { grid-column: span 2; }
.fi-label { font-size: 11px; color: var(--t-text-3); }
.fi-label em { color: #e6a23c; font-style: normal; margin-left: 2px; }

.dev-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.dev-picker { width: 260px; }
.dev-hint { font-size: 11px; color: var(--t-text-3); }
.dev-table { margin-bottom: 2px; }

.map-table :deep(.arrow-col) { color: #9aa4b2; font-weight: 700; background: var(--t-hover-bg, #f7f9fc); }
.map-table :deep(.el-table__cell) { padding: 4px 0; }
.mono { font-family: 'JetBrains Mono', Consolas, monospace; }

.ei-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--t-text-3);
}
.ei-empty.small { padding: 10px 0; }

/* 窄屏(≤1280)压一压左两栏,保证编辑区不被挤没 */
@media (max-width: 1360px) {
  .ei-list { width: 272px; }
  .ei-cats { width: 128px; }
  .form-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1080px) {
  .ei-cats { display: none; }
  .ei-list { width: 240px; }
}
</style>
