<!-- DbBackup.vue — 系统管理平台 · 数据安全(数据库主动备份 / 自动备份),用户 2026-10-19 -->
<!-- 用户口径:「给系统的系统管理模块加一个面板，面板是可以设置系统的数据库数据的主动备份和
     自动备份的时间的，是系统的一个数据安全的一个功能」。
     三块内容:① 自动备份设置(开关/时间/保留份数/备份目录) ② 立即备份(主动备份一次) ③ 备份记录。
     口径(见 backend DbBackupService 头注):备份是 BACKUP DATABASE 完整备份,由数据库引擎写到
     「备份目录」;保留份数从旧到新清理,只动本库前缀的 .bak。管理员专属(路由 meta.requireAdmin)。 -->
<template>
  <div class="bk-page">
    <div class="bk-head">
      <div class="bk-title">
        <span class="bk-name">{{ tt('数据库备份') }}</span>
        <el-tag size="small" type="info">{{ tt('当前库') }}:{{ overview.dbName || '-' }}</el-tag>
        <el-tag v-if="overview.isTestLedger" size="small" type="warning">{{ tt('测试账套') }}</el-tag>
        <el-tag v-if="overview.running" size="small" type="warning">{{ tt('正在备份…') }}</el-tag>
      </div>
      <div class="bk-actions">
        <el-button size="small" :loading="loading" @click="load">{{ tt('刷新') }}</el-button>
      </div>
    </div>
    <div class="bk-ledger-tip">
      {{ tt('自动备份按账套各自生效：本页设置只作用于当前账套；正式账套与测试账套各备各的，文件按库名区分。') }}
    </div>

    <div class="bk-grid">
      <!-- ① 自动备份设置 -->
      <section class="bk-card">
        <div class="bk-card-head">
          <span class="bk-card-title">{{ tt('自动备份') }}</span>
          <span class="bk-card-sub">{{ tt('到点由后台自动备份一次，每月一次') }}</span>
        </div>
        <el-form :model="form" label-width="auto" class="bk-form" @submit.prevent>
          <el-form-item :label="tt('启用自动备份')">
            <el-switch v-model="form.autoEnabled" />
            <span class="bk-inline-tip">{{ form.autoEnabled ? tt('已启用') : tt('未启用') }}</span>
          </el-form-item>
          <el-form-item :label="tt('备份周期')">
            <el-select v-model="form.autoDay" :disabled="!form.autoEnabled" style="width: 128px">
              <el-option v-for="d in 28" :key="d" :label="tt('每月') + ' ' + d + ' ' + tt('日')" :value="d" />
            </el-select>
            <el-time-picker v-model="form.autoTime" value-format="HH:mm" format="HH:mm" class="bk-time"
              :disabled="!form.autoEnabled" :placeholder="tt('选择时间')" style="width: 132px" />
            <span class="bk-inline-tip">{{ tt('服务器本地时间；1~28 号，避月末') }}</span>
          </el-form-item>
          <el-form-item :label="tt('保留份数')">
            <el-input-number v-model="form.keepFiles" :min="0" :max="365" :step="1" controls-position="right" style="width: 132px" />
            <span class="bk-inline-tip">{{ tt('0 = 不自动清理；超出后删最旧的') }}</span>
          </el-form-item>
          <el-form-item :label="tt('备份目录')">
            <el-input v-model="form.dir" :placeholder="tt('如 D:\\SQLBackup\\YINJIA-MES')" maxlength="200" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" :loading="saving" @click="save">{{ tt('保存设置') }}</el-button>
            <span class="bk-inline-tip">{{ tt('保存即生效，不用重启服务') }}</span>
          </el-form-item>
        </el-form>
        <div class="bk-hint">
          {{ tt('备份由数据库引擎写盘，目录必须是数据库服务账号可写的本机路径；改完点一次「立即备份」验证。') }}
        </div>
        <div v-if="overview.nextAutoHint" class="bk-hint bk-hint-strong">
          {{ tt('下一次自动备份') }}：{{ overview.nextAutoHint }}
          <template v-if="overview.lastAutoBackupAt">（{{ tt('上次成功') }}：{{ fmt(overview.lastAutoBackupAt) }}）</template>
        </div>
        <div v-else-if="!form.autoEnabled" class="bk-hint bk-hint-strong">{{ tt('自动备份未启用，只有点「立即备份」时才会生成备份文件。') }}</div>
      </section>

      <!-- ② 立即备份 -->
      <section class="bk-card">
        <div class="bk-card-head">
          <span class="bk-card-title">{{ tt('立即备份') }}</span>
          <span class="bk-card-sub">{{ tt('主动备份一次，成功与否都记在下方记录里') }}</span>
        </div>
        <div class="bk-run">
          <el-button type="danger" :loading="running" @click="runNow">{{ tt('立即备份') }}</el-button>
          <span class="bk-run-tip">{{ tt('备份期间不影响查询，但会占用磁盘 IO，建议避开生产高峰') }}</span>
        </div>
        <el-descriptions v-if="last" :column="1" border size="small" class="bk-last">
          <el-descriptions-item :label="tt('最近一次')">
            <el-tag size="small" :type="last.status === '成功' ? 'success' : 'danger'">{{ tt(last.status) }}</el-tag>
            <span class="bk-last-time">{{ fmt(last.started_at || last.startedAt) }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="tt('耗时')">{{ elapsed(last.elapsed_ms ?? last.elapsedMs) }}</el-descriptions-item>
          <el-descriptions-item :label="tt('文件大小')">{{ sizeText(last.file_size_kb ?? last.fileSizeKb) }}</el-descriptions-item>
          <el-descriptions-item :label="tt('备份文件')">
            <span class="bk-path">{{ last.file_path || last.filePath || '-' }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <div v-else class="bk-hint">{{ tt('还没有备份记录。') }}</div>
      </section>
    </div>

    <!-- ③ 备份记录 -->
    <section class="bk-card">
      <div class="bk-card-head">
        <span class="bk-card-title">{{ tt('备份记录') }}</span>
        <span class="bk-card-sub">{{ tt('最近 50 次（只增不改，可核对“什么时候备过、备到哪”）') }}</span>
      </div>
      <el-table :data="logs" v-loading="loading" border stripe size="small" height="320" empty-text="暂无备份记录">
        <el-table-column :label="tt('开始时间')" width="160">
          <template #default="{ row }">{{ fmt(row.started_at) }}</template>
        </el-table-column>
        <el-table-column :label="tt('方式')" width="92">
          <template #default="{ row }">{{ tt(row.run_type) }}</template>
        </el-table-column>
        <el-table-column :label="tt('结果')" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === '成功' ? 'success' : 'danger'">{{ tt(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('大小')" width="96">
          <template #default="{ row }">{{ sizeText(row.file_size_kb) }}</template>
        </el-table-column>
        <el-table-column :label="tt('耗时')" width="96">
          <template #default="{ row }">{{ elapsed(row.elapsed_ms) }}</template>
        </el-table-column>
        <el-table-column :label="tt('操作人')" width="96" prop="operator" />
        <el-table-column :label="tt('备份文件')" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.file_path || '-' }}</template>
        </el-table-column>
        <el-table-column :label="tt('说明')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.message || '-' }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const overview = ref({})
const logs = ref([])
const last = ref(null)

// 自动备份 = 每月一次(用户 2026-10-19:「显示的数据库备份记录改为每个月一次」)
const form = reactive({ autoEnabled: false, autoDay: 1, autoTime: '02:00', keepFiles: 14, dir: '' })

function applySetting(s) {
  if (!s) return
  form.autoEnabled = !!s.autoEnabled
  form.autoDay = Number(s.autoDay ?? 1)
  form.autoTime = s.autoTime || '02:00'
  form.keepFiles = Number(s.keepFiles ?? 14)
  form.dir = s.dir || ''
}

async function load() {
  loading.value = true
  try {
    const r = await request.get('/sys/backup/overview')
    const d = r?.data || {}
    overview.value = d
    logs.value = d.logs || []
    last.value = logs.value[0] || null
    applySetting(d.setting)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载失败'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const r = await request.post('/sys/backup/save', {
      autoEnabled: form.autoEnabled,
      autoDay: form.autoDay,
      autoTime: form.autoTime,
      keepFiles: form.keepFiles,
      dir: form.dir,
    })
    applySetting(r?.data)
    ElMessage.success(tt('设置已保存'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存失败'))
  } finally {
    saving.value = false
  }
}

async function runNow() {
  running.value = true
  try {
    const r = await request.post('/sys/backup/run', {})
    const d = r?.data || {}
    if (d.status === '成功') ElMessage.success(tt('备份成功') + '：' + (d.filePath || ''))
    else if (d.status === '跳过') ElMessage.warning(d.message || tt('已有备份在执行'))
    else ElMessage.error(d.message || tt('备份失败，详见备份记录'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('备份失败'))
  } finally {
    running.value = false
  }
}

function fmt(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 19)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function sizeText(kb) {
  if (kb === null || kb === undefined || kb === '') return '-'
  const n = Number(kb)
  if (!Number.isFinite(n)) return '-'
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' GB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' MB'
  return n + ' KB'
}

function elapsed(ms) {
  if (ms === null || ms === undefined || ms === '') return '-'
  const n = Number(ms)
  if (!Number.isFinite(n)) return '-'
  if (n < 1000) return n + ' ms'
  if (n < 60000) return (n / 1000).toFixed(1) + ' s'
  return Math.floor(n / 60000) + ' min ' + Math.round((n % 60000) / 1000) + ' s'
}

onMounted(load)
</script>

<style scoped>
.bk-page {
  padding: 12px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  max-width: 1280px;
}
.bk-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.bk-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bk-name { font-size: 15px; font-weight: 600; color: #1c4f8a; }
.bk-ledger-tip { margin-top: -4px; font-size: 12px; color: #909399; line-height: 1.6; }
.bk-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.bk-card {
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 6px;
  padding: 12px;
  min-width: 0;
}
.bk-card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.bk-card-title { font-size: 14px; font-weight: 600; color: #1c4f8a; }
.bk-card-sub { font-size: 12px; color: #909399; }
.bk-form { max-width: 560px; }
.bk-form :deep(.el-form-item) { margin-bottom: 12px; }
.bk-form :deep(.el-form-item__label) { color: #6b7280; white-space: nowrap; }
.bk-inline-tip { margin-left: 10px; font-size: 12px; color: #909399; }
.bk-time { margin-left: 8px; }
.bk-hint { margin-top: 8px; font-size: 12px; color: #909399; line-height: 1.6; }
.bk-hint-strong { color: #1c4f8a; }
.bk-run { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 4px 0 12px; }
.bk-run-tip { font-size: 12px; color: #909399; max-width: 320px; line-height: 1.5; }
.bk-last :deep(.el-descriptions__label) { width: 88px; color: #6b7280; }
.bk-last-time { margin-left: 8px; color: #606266; }
.bk-path { word-break: break-all; font-family: Consolas, Monaco, monospace; font-size: 12px; }

@media (max-width: 900px) {
  .bk-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
