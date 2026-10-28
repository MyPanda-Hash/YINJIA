<!-- PickScanLog.vue — 扫码领料记录:查谁在什么时候扫了哪张工单的哪个物料、多少(2026-10-21) -->
<template>
  <div class="psl-page">
    <div class="psl-head">
      <div class="psl-title">{{ tt('扫码领料记录') }}</div>
      <div class="psl-sub">
        {{ tt('工单扫码领料的逐笔留痕:谁、什么时候、哪张工单哪一行、扫了哪个物料、多少数量、秤读数、用相机还是扫码枪') }}
      </div>
    </div>

    <!-- 筛选条 -->
    <div class="psl-filter">
      <label class="psl-fl">
        <span>{{ tt('工单号') }}</span>
        <input v-model="q.woNo" class="psl-input" :placeholder="tt('模糊匹配')" @keyup.enter="search(1)" />
      </label>
      <label class="psl-fl">
        <span>{{ tt('操作人') }}</span>
        <input v-model="q.user" class="psl-input" :placeholder="tt('账号/姓名')" @keyup.enter="search(1)" />
      </label>
      <label class="psl-fl">
        <span>{{ tt('物料') }}</span>
        <input v-model="q.materialCode" class="psl-input" :placeholder="tt('编码或名称')" @keyup.enter="search(1)" />
      </label>
      <label class="psl-fl">
        <span>{{ tt('起始') }}</span>
        <input v-model="q.start" type="date" class="psl-input" />
      </label>
      <label class="psl-fl">
        <span>{{ tt('结束') }}</span>
        <input v-model="q.end" type="date" class="psl-input" />
      </label>
      <button class="psl-btn primary" :disabled="loading" @click="search(1)">
        {{ loading ? tt('查询中…') : tt('查询') }}
      </button>
      <button class="psl-btn" :disabled="loading" @click="reset">{{ tt('重置') }}</button>
    </div>

    <div v-if="error" class="psl-err">{{ error }}</div>

    <!-- 汇总 -->
    <div class="psl-sum">
      <span>{{ tt('共') }} <b>{{ total }}</b> {{ tt('条') }}</span>
      <span v-if="page > 1 || total > pageSize" class="psl-sum-page">
        {{ tt('第') }} {{ page }} / {{ maxPage }} {{ tt('页') }}
      </span>
      <span class="psl-sum-hint">{{ tt('按操作时间倒序') }}</span>
    </div>

    <!-- 表格 -->
    <div class="psl-table-wrap">
      <table class="psl-table">
        <thead>
          <tr>
            <th class="c-time">{{ tt('操作时间') }}</th>
            <th class="c-user">{{ tt('操作人') }}</th>
            <th class="c-wo">{{ tt('工单号') }}</th>
            <th class="c-line">{{ tt('行') }}</th>
            <th class="c-mat">{{ tt('物料') }}</th>
            <th class="c-name">{{ tt('物料名称') }}</th>
            <th class="c-qty">{{ tt('数量') }}</th>
            <th class="c-unit">{{ tt('单位') }}</th>
            <th class="c-scale">{{ tt('秤读数') }}</th>
            <th class="c-src">{{ tt('扫码方式') }}</th>
            <th class="c-cli">{{ tt('客户端') }}</th>
            <th class="c-doc">{{ tt('领料单号') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="12" class="psl-empty">{{ tt('没有符合条件的记录') }}</td>
          </tr>
          <tr v-for="(r, i) in rows" :key="r.id || i">
            <td class="c-time">{{ fmtTime(r['操作时间']) }}</td>
            <td class="c-user">{{ r['操作人'] || '-' }}</td>
            <td class="c-wo">{{ r['工单号'] || '-' }}</td>
            <td class="c-line">{{ r['工单行号'] || '-' }}</td>
            <td class="c-mat">{{ r['物料编码'] || '-' }}</td>
            <td class="c-name">{{ r['物料名称'] || '-' }}</td>
            <td class="c-qty">{{ fmt(r['数量']) }}</td>
            <td class="c-unit">{{ r['单位'] || '-' }}</td>
            <td class="c-scale">{{ r['秤读数'] == null ? '-' : fmt(r['秤读数']) }}</td>
            <td class="c-src">
              <span class="psl-tag" :class="srcClass(r['扫码方式'])">{{ r['扫码方式'] || '-' }}</span>
            </td>
            <td class="c-cli">
              <span class="psl-tag" :class="r['客户端'] === 'App' ? 'app' : 'web'">{{ r['客户端'] || '-' }}</span>
            </td>
            <td class="c-doc">{{ r['领料单号'] || tt('未提交') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="psl-pager">
      <button class="psl-btn" :disabled="page <= 1 || loading" @click="search(page - 1)">{{ tt('上一页') }}</button>
      <span class="psl-page-no">{{ page }} / {{ maxPage }}</span>
      <button class="psl-btn" :disabled="page >= maxPage || loading" @click="search(page + 1)">{{ tt('下一页') }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { tt } from '@/i18n'
import request from '@/core/request'

const q = reactive({ woNo: '', user: '', materialCode: '', start: '', end: '' })
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const error = ref('')

const maxPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '-'
  return String(Math.round(v * 10000) / 10000)
}

/** 时间显示到秒(操作留痕要看精确时刻) */
function fmtTime(v) {
  if (!v) return '-'
  const s = String(v).replace('T', ' ')
  return s.length > 19 ? s.slice(0, 19) : s
}

function srcClass(s) {
  if (s === '相机') return 'cam'
  if (s === '取秤') return 'scale'
  return 'manual'
}

async function search(p) {
  page.value = Math.max(1, p || 1)
  loading.value = true
  error.value = ''
  try {
    const res = await request.get('/px/woPick/scanLogs', {
      params: {
        woNo: q.woNo || undefined,
        user: q.user || undefined,
        materialCode: q.materialCode || undefined,
        start: q.start || undefined,
        end: q.end || undefined,
        page: page.value,
        size: pageSize.value,
      },
    })
    const d = (res && (res.data || res)) || {}
    rows.value = d.list || []
    total.value = d.total || 0
    if (d.pageSize) pageSize.value = d.pageSize
  } catch (e) {
    error.value = (e && (e.response?.data?.message || e.message)) || tt('查询失败')
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function reset() {
  q.woNo = ''
  q.user = ''
  q.materialCode = ''
  q.start = ''
  q.end = ''
  search(1)
}

onMounted(() => search(1))
</script>

<style scoped>
.psl-page {
  padding: 16px 20px 24px;
  background: #f5f6f8;
  min-height: 100%;
  box-sizing: border-box;
}
.psl-head {
  margin-bottom: 12px;
}
.psl-title {
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
}
.psl-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 3px;
  line-height: 1.6;
}
.psl-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
}
.psl-fl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}
.psl-input {
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
  outline: none;
  min-width: 130px;
}
.psl-input:focus {
  border-color: #1c4f8a;
  box-shadow: 0 0 0 2px rgba(28, 79, 138, 0.12);
}
.psl-btn {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}
.psl-btn.primary {
  background: #1c4f8a;
  border-color: #1c4f8a;
  color: #fff;
}
.psl-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.psl-err {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 10px;
}
.psl-sum {
  display: flex;
  gap: 14px;
  align-items: baseline;
  font-size: 13px;
  color: #374151;
  margin-bottom: 8px;
}
.psl-sum-page {
  color: #1c4f8a;
}
.psl-sum-hint {
  margin-left: auto;
  font-size: 12px;
  color: #9ca3af;
}
.psl-table-wrap {
  background: #fff;
  border-radius: 10px;
  overflow: auto;
}
.psl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  white-space: nowrap;
}
.psl-table th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  color: #374151;
  font-weight: 600;
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid #e5e7eb;
}
.psl-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f3f4f6;
  color: #111827;
}
.psl-table tbody tr:hover {
  background: #f9fafb;
}
.psl-empty {
  text-align: center;
  color: #9ca3af;
  padding: 24px 0;
}
.c-time { min-width: 150px; }
.c-user { min-width: 90px; }
.c-wo { min-width: 150px; }
.c-line { min-width: 50px; }
.c-mat { min-width: 130px; }
.c-name { min-width: 140px; }
.c-qty { min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }
.c-unit { min-width: 50px; }
.c-scale { min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }
.c-src { min-width: 80px; }
.c-cli { min-width: 70px; }
.c-doc { min-width: 140px; }
.psl-tag {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 16px;
  border-radius: 3px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #4b5563;
}
.psl-tag.cam {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1c4f8a;
}
.psl-tag.scale {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}
.psl-tag.app {
  border-color: #fde68a;
  background: #fffbeb;
  color: #b45309;
}
.psl-tag.web {
  border-color: #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
}
.psl-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}
.psl-page-no {
  font-size: 13px;
  color: #374151;
  font-variant-numeric: tabular-nums;
}
</style>
