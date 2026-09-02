<!-- UsageLog.vue — 使用权限查看(仅管理员):按账号分类展示所有账号的登录记录 + 面板权限使用记录 -->
<template>
  <div class="usage-log-page">
    <el-card shadow="never" class="usage-card">
      <el-form inline class="usage-filter" @submit.prevent>
        <el-form-item :label="tt('账号')">
          <el-input v-model="q.userName" :placeholder="tt('账号')" clearable style="width: 140px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item :label="tt('面板')">
          <el-input v-model="q.panelName" :placeholder="tt('面板名')" clearable style="width: 160px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item :label="tt('动作')">
          <el-input v-model="q.actionName" :placeholder="tt('按钮/动作')" clearable style="width: 140px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item :label="tt('操作时间')">
          <el-date-picker v-model="q.range" type="daterange" value-format="YYYY-MM-DD"
            :start-placeholder="tt('开始日期')" :end-placeholder="tt('结束日期')" style="width: 250px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">{{ tt('查询') }}</el-button>
          <el-button @click="reset">{{ tt('重置') }}</el-button>
        </el-form-item>
      </el-form>

      <el-alert v-if="total > 2000" type="warning" :closable="false" show-icon
        :title="tt('记录超过 2000 条，仅展示最近部分，请用筛选缩小范围')" class="usage-alert" />

      <el-collapse v-model="openGroups" class="usage-groups">
        <el-collapse-item v-for="g in groups" :key="g.userName" :name="g.userName">
          <template #title>
            <span class="group-title">
              <el-icon><UserFilled /></el-icon>
              <span class="group-user">{{ g.userName }}</span>
              <span class="group-name">{{ g.realName }}</span>
              <el-tag size="small" type="info" class="group-total">{{ g.total }} {{ tt('条记录') }}</el-tag>
            </span>
          </template>
          <el-table :data="g.rows" v-loading="loading" border stripe size="small" height="360">
            <el-table-column :label="tt('操作时间')" width="170">
              <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column :label="tt('类型')" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.eventType === 'login' ? 'success' : 'primary'" size="small">
                  {{ row.eventType === 'login' ? tt('登录') : tt('操作') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="tt('面板')" prop="panelName" min-width="150" show-overflow-tooltip />
            <el-table-column :label="tt('动作')" prop="actionName" width="130" show-overflow-tooltip />
            <el-table-column :label="tt('单据号')" prop="docNo" min-width="170" show-overflow-tooltip />
            <el-table-column :label="tt('来源IP')" prop="ip" width="140" show-overflow-tooltip />
          </el-table>
        </el-collapse-item>
      </el-collapse>

      <el-empty v-if="!loading && !groups.length" :description="tt('暂无记录')" :image-size="70" />
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'

const q = reactive({ userName: '', panelName: '', actionName: '', range: null })
const groups = ref([])
const total = ref(0)
const openGroups = ref([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const params = {}
    if (q.userName) params.userName = q.userName
    if (q.panelName) params.panelName = q.panelName
    if (q.actionName) params.actionName = q.actionName
    if (q.range && q.range.length === 2) { params.start = q.range[0]; params.end = q.range[1] }
    const r = await request.get('/sys/usageLog/grouped', { params })
    groups.value = r?.data?.groups || []
    total.value = r?.data?.total || 0
    openGroups.value = groups.value.map((g) => g.userName)
  } finally {
    loading.value = false
  }
}

function reset() {
  q.userName = ''
  q.panelName = ''
  q.actionName = ''
  q.range = null
  load()
}

/** 具体操作时间:后端返回 UTC(带 +00:00),转本地时间显示,避免比北京时间慢 8 小时。 */
function fmt(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 19)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

load()
</script>

<style scoped>
.usage-log-page { padding: 14px; }
.usage-card { border-radius: 8px; }
.usage-filter { margin-bottom: 4px; }
.usage-alert { margin-bottom: 10px; }
.usage-groups :deep(.el-collapse-item__header) { height: 44px; }
.group-title { display: inline-flex; align-items: center; gap: 8px; }
.group-user { font-weight: 600; }
.group-name { color: #909399; }
.group-total { margin-left: 4px; }
</style>
