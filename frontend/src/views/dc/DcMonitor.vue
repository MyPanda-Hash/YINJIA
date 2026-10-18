<template>
  <div class="dc-page dc-monitor">
    <header class="dc-head">
      <div class="dc-head-main">
        <h1 class="dc-title">{{ tt('数据监控') }}</h1>
        <p class="dc-sub">{{ tt('按设备查看采集点的实时值与报警记录；这里的数字全部来自网关上报，没有数据就是真没有') }}</p>
      </div>
      <p class="dc-source">{{ tt('数据来源：数采网关上报（DC-Ingest 接口），未接入设备显示为离线') }}</p>
    </header>

    <div class="dc-mon-grid">
      <aside class="dc-card dc-side">
        <div class="dc-side-head">
          <span class="dc-side-title">{{ tt('设备列表') }}</span>
          <span class="dc-side-count">{{ onlineCount }} / {{ devices.length }} {{ tt('在线') }}</span>
        </div>
        <div v-if="devices.length" class="dc-dev-list">
          <button
            v-for="d in devices"
            :key="d.id"
            type="button"
            class="dc-dev"
            :class="{ active: d.id === selectedId }"
            @click="selectDevice(d)"
          >
            <span class="dc-dot" :class="d.online ? 'on' : 'off'"></span>
            <span class="dc-dev-main">
              <span class="dc-dev-name">{{ d.name || d.code }}</span>
              <span class="dc-dev-meta">{{ d.code }}<template v-if="d.type"> · {{ tt(d.type) }}</template></span>
            </span>
            <span class="dc-dev-progress">{{ pct(d.progress) }}%</span>
          </button>
        </div>
        <p v-else-if="loading" class="dc-side-empty">{{ tt('加载中…') }}</p>
        <p v-else class="dc-side-empty">{{ tt('尚未登记设备，先去「设备配置管理」新增') }}</p>
      </aside>

      <main class="dc-main">
        <section v-if="current" class="dc-card dc-dev-head">
          <div class="dc-dev-head-main">
            <h2 class="dc-dev-title">{{ current.name || current.code }}</h2>
            <p class="dc-dev-sub">{{ current.code }}<template v-if="current.type"> · {{ tt(current.type) }}</template></p>
          </div>
          <div class="dc-dev-head-side">
            <el-tag :type="current.online ? 'success' : 'info'" effect="plain" size="small">
              {{ current.online ? tt('在线') : tt('离线') }}
            </el-tag>
            <span class="dc-meta">{{ tt('最近上报') }}：{{ fmtAt(current.lastSeenAt) }}</span>
            <el-button :loading="loading" @click="load(true)">{{ tt('刷新') }}</el-button>
          </div>
        </section>

        <section v-if="current" class="dc-card">
          <div class="dc-card-head">
            <h3 class="dc-card-title">{{ tt('实时数据') }}</h3>
            <span class="dc-card-tip">{{ tt('共') }} {{ points.length }} {{ tt('个采集点') }}</span>
          </div>
          <el-table
            v-if="points.length"
            v-loading="loading"
            :data="points"
            border
            size="small"
            class="dc-table"
            :empty-text="tt('暂无采集点')"
          >
            <el-table-column :label="tt('采集点')" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="dc-code">{{ row.code || row.pointId }}</span>
                <span v-if="row.name" class="dc-muted"> · {{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('实时值')" min-width="110" align="right">
              <template #default="{ row }">
                <strong class="dc-value">{{ row.valueText ?? '-' }}</strong>
              </template>
            </el-table-column>
            <el-table-column :label="tt('单位')" width="88">
              <template #default="{ row }"><span class="dc-muted">{{ row.unit || '-' }}</span></template>
            </el-table-column>
            <el-table-column :label="tt('采集时间')" width="164">
              <template #default="{ row }"><span class="dc-muted">{{ fmtAt(row.at) }}</span></template>
            </el-table-column>
            <el-table-column :label="tt('状态')" width="100">
              <template #default="{ row }">
                <el-tag :type="pointStatusOf(row).type" size="small" effect="plain">{{ tt(pointStatusOf(row).label) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-else-if="loading" class="dc-empty">
            <span>{{ tt('加载中…') }}</span>
          </div>
          <div v-else class="dc-empty">
            <span>{{ tt('该设备尚未接入采集数据（硬件接入后自动出现）') }}</span>
            <em>{{ tt('硬件按 DC-Ingest 接口上报后，采集点会出现在这里') }}</em>
          </div>
        </section>

        <section v-if="current" class="dc-card">
          <div class="dc-card-head">
            <h3 class="dc-card-title">{{ tt('报警记录') }}</h3>
            <span class="dc-card-tip">{{ tt('未处理') }} {{ unhandledCount }} / {{ tt('共') }} {{ alarms.length }}</span>
          </div>
          <el-table
            v-if="alarms.length"
            v-loading="loading"
            :data="alarms"
            border
            size="small"
            class="dc-table"
            :empty-text="tt('该设备暂无报警记录')"
          >
            <el-table-column :label="tt('级别')" width="84">
              <template #default="{ row }">
                <el-tag :type="levelType(row.level)" size="small" effect="plain">{{ row.level ? tt(row.level) : '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="tt('报警内容')" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.message || '-' }}</template>
            </el-table-column>
            <el-table-column :label="tt('触发值')" width="110" align="right">
              <template #default="{ row }"><span class="dc-muted">{{ row.valueText ?? '-' }}</span></template>
            </el-table-column>
            <el-table-column :label="tt('发生时间')" width="164">
              <template #default="{ row }"><span class="dc-muted">{{ fmtAt(row.occurAt) }}</span></template>
            </el-table-column>
            <el-table-column :label="tt('处理状态')" width="100">
              <template #default="{ row }">
                <el-tag :type="row.state === '已处理' ? 'success' : 'danger'" size="small" effect="plain">
                  {{ tt(row.state || '未处理') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="tt('处理人 / 时间')" min-width="150">
              <template #default="{ row }">
                <span class="dc-muted">{{ row.handledBy || '-' }} {{ row.handledAt ? '· ' + fmtAt(row.handledAt) : '' }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('操作')" width="96" fixed="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :disabled="row.state === '已处理'"
                  @click="openHandle(row)"
                >
                  {{ tt('处理') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-else-if="loading" class="dc-empty">
            <span>{{ tt('加载中…') }}</span>
          </div>
          <div v-else class="dc-empty">
            <span>{{ tt('该设备暂无报警记录') }}</span>
          </div>
        </section>

        <section v-if="!current && !loading" class="dc-card dc-empty-card">
          <div class="dc-empty">
            <span>{{ tt('还没有可监控的设备') }}</span>
            <em>{{ tt('先在「设备配置管理」登记网关与设备，硬件上报后这里才有实时数据') }}</em>
          </div>
          <el-button type="primary" @click="goConfig">{{ tt('去设备配置管理') }}</el-button>
        </section>
      </main>
    </div>

    <el-dialog v-model="handleDialog" :title="tt('处理报警')" width="min(480px, 94vw)" append-to-body>
      <p class="dc-handle-tip">{{ tt('报警内容') }}：{{ handleForm.message || '-' }}</p>
      <el-form :model="handleForm" label-width="80px" @submit.prevent>
        <el-form-item :label="tt('处理说明')">
          <el-input v-model="handleForm.note" type="textarea" :rows="3" maxlength="200" show-word-limit :placeholder="tt('选填，记录处置方式')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialog = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="handling" @click="submitHandle">{{ tt('确认处理') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { apiGetDcMonitor, apiHandleDcAlarm } from '@/business/dcApi'

const POINT_STATUS = {
  normal: { label: '正常', type: 'success' },
  alarm: { label: '报警', type: 'danger' },
  stale: { label: '数据过期', type: 'info' },
}
const LEVEL_TYPES = {
  高: 'danger',
  中: 'warning',
  低: 'info',
  critical: 'danger',
  major: 'warning',
  minor: 'info',
  warning: 'warning',
  info: 'info',
}

const router = useRouter()
const loading = ref(false)
const devices = ref([])
const points = ref([])
const alarms = ref([])
const selectedId = ref(null)
const handleDialog = ref(false)
const handling = ref(false)
const handleForm = ref({ id: null, message: '', note: '' })

const current = computed(() => devices.value.find((d) => d.id === selectedId.value) || null)
const onlineCount = computed(() => devices.value.filter((d) => d.online).length)
const unhandledCount = computed(() => alarms.value.filter((a) => a.state !== '已处理').length)

function pct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}
function fmtAt(v) {
  if (!v) return '-'
  return String(v).replace('T', ' ').slice(0, 19)
}
function pointStatusOf(row) {
  return POINT_STATUS[row?.status] || { label: '未知', type: 'info' }
}
function levelType(level) {
  return LEVEL_TYPES[level] || 'info'
}

async function load(showToast) {
  loading.value = true
  try {
    const data = await apiGetDcMonitor(selectedId.value ?? undefined)
    devices.value = Array.isArray(data?.devices) ? data.devices : []
    points.value = Array.isArray(data?.points) ? data.points : []
    alarms.value = Array.isArray(data?.alarms) ? data.alarms : []
    if (selectedId.value !== null && !devices.value.some((d) => d.id === selectedId.value)) {
      selectedId.value = devices.value.length ? devices.value[0].id : null
      if (selectedId.value !== null) await load()
    }
    if (showToast) ElMessage.success(tt('已刷新'))
  } catch (e) {
    points.value = []
    alarms.value = []
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载监控数据失败'))
  } finally {
    loading.value = false
  }
}

async function selectDevice(d) {
  if (d.id === selectedId.value) return
  selectedId.value = d.id
  points.value = []
  alarms.value = []
  await load()
}

function openHandle(row) {
  handleForm.value = { id: row.id, message: row.message || '', note: '' }
  handleDialog.value = true
}

async function submitHandle() {
  const f = handleForm.value
  if (!f.id) return
  handling.value = true
  try {
    await apiHandleDcAlarm(f.id, f.note)
    handleDialog.value = false
    ElMessage.success(tt('报警已处理'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('处理报警失败'))
  } finally {
    handling.value = false
  }
}

function goConfig() {
  router.push('/dc/config')
}

onMounted(async () => {
  await load()
  if (selectedId.value === null && devices.value.length) {
    selectedId.value = devices.value[0].id
    await load()
  }
})
</script>

<style scoped>
.dc-page {
  --dc-ok: #1f8a5b;
  --dc-warn: #b87816;
  --dc-bad: #b94d3f;
  --dc-ic: #537786;
  padding: 14px 16px 24px;
  min-width: 0;
  color: var(--t-text-1);
}
.dc-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}
.dc-head-main { min-width: 0; }
.dc-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--t-text-1); }
.dc-sub { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--t-text-3); }
.dc-source {
  margin: 0;
  flex: 1 1 320px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--t-text-3);
  text-align: right;
}
.dc-mon-grid {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.dc-card {
  min-width: 0;
  padding: 10px 12px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.dc-side { position: sticky; top: 8px; }
.dc-side-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.dc-side-title { font-size: 14px; font-weight: 600; color: var(--t-primary); }
.dc-side-count { font-size: 12px; color: var(--t-text-3); font-variant-numeric: tabular-nums; }
.dc-dev-list { display: flex; flex-direction: column; gap: 4px; max-height: 62vh; overflow-y: auto; }
.dc-dev {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 6px 8px;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  font: inherit;
}
.dc-dev:hover { background: var(--t-hover-bg); }
.dc-dev.active { background: var(--t-hover-bg); border-color: var(--t-primary); }
.dc-dev-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.dc-dev-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dc-dev-meta {
  font-size: 11px;
  color: var(--t-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dc-dev-progress { font-size: 11px; color: var(--t-text-3); font-variant-numeric: tabular-nums; }
.dc-side-empty { margin: 8px 0; font-size: 12px; color: var(--t-text-3); line-height: 1.6; }
.dc-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.dc-dev-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
}
.dc-dev-head-main { min-width: 0; }
.dc-dev-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--t-text-1); }
.dc-dev-sub { margin: 2px 0 0; font-size: 12px; color: var(--t-text-3); }
.dc-dev-head-side { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.dc-dev-head-side :deep(.el-button) { min-height: 40px; }
.dc-meta { font-size: 12px; color: var(--t-text-3); font-variant-numeric: tabular-nums; }
.dc-card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dc-card-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--t-primary); }
.dc-card-tip { font-size: 12px; color: var(--t-text-3); }
.dc-table { width: 100%; }
.dc-table :deep(.el-table__cell) { padding: 5px 0; }
.dc-table :deep(.el-button) { min-height: 40px; margin-left: 0; }
.dc-code { font-variant-numeric: tabular-nums; }
.dc-muted { color: var(--t-text-3); }
.dc-value { font-variant-numeric: tabular-nums; font-size: 13px; }
.dc-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.dc-dot.on { background: var(--dc-ok); }
.dc-dot.off { background: var(--t-text-3); }
.dc-empty {
  display: grid;
  place-content: center;
  gap: 4px;
  min-height: 96px;
  padding: 12px;
  text-align: center;
  color: var(--t-text-3);
  background: var(--t-sidebar-bg);
  border: 1px dashed var(--t-border);
  border-radius: 5px;
}
.dc-empty em { font-style: normal; font-size: 11px; opacity: 0.85; }
.dc-empty-card { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.dc-empty-card :deep(.el-button) { min-height: 40px; }
.dc-handle-tip { margin: 0 0 10px; font-size: 13px; color: var(--t-text-2); line-height: 1.6; }
@media (max-width: 900px) {
  .dc-mon-grid { grid-template-columns: minmax(0, 1fr); }
  .dc-side { position: static; }
  .dc-dev-list { max-height: 260px; }
}
@media (max-width: 640px) {
  .dc-source { text-align: left; }
}
</style>

<style>
html.dark .dc-monitor {
  --dc-ok: #58b09e;
  --dc-warn: #e0a83a;
  --dc-bad: #d97364;
  --dc-ic: #8fadb9;
}
</style>
