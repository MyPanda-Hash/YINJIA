<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品文件列表(RD_PROD_DOCLIST)—— 设计《产品开发系统需求汇总》sheet「文件汇总表」

       设计原表:产品编号 | 文件1 | 状态 | 文件2 | 状态 | 文件3 | 状态 | 文件4 | 状态 |
                 产品负责人 | 是否受控 | 受控日期

       【本面板不新建业务逻辑】4 个文件列 = DevTaskService.DEV_PANELS 的 4 个下游面板,
       每格状态 = statusOf(产品编号, 面板);本视图只负责**把它从按钮变成一张可查询的表**。
       受控是派生值(设计流程图 5.1~5.4 尾部「审批后自动受控」):4 份文件全归档即受控。

       只读视图:产品文件由各自的面板维护,这里不做就地编辑(与"产品开发"按钮同一份数据源)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="prod-doc-sheet">
    <!-- ① 公司头 + 右上单据编号 -->
    <div class="pds-topbar">
      <div class="pds-company">{{ tt('惠州市银嘉环保科技有限公司') }}</div>
      <div class="pds-docno">{{ head && head['单据编号'] ? head['单据编号'] : '' }}</div>
    </div>

    <!-- ② 标题行 -->
    <div class="pds-title-row">
      <div class="pds-title">{{ tt('产品文件列表') }}</div>
      <div class="pds-info-table">
        <div class="pds-info-row">
          <span class="pds-info-label">{{ tt('密级') }}</span>
          <span class="pds-info-value">{{ (head && head['密级']) || '' }}</span>
        </div>
        <div class="pds-info-row">
          <span class="pds-info-label">{{ tt('文件使用范围') }}</span>
          <span class="pds-info-value">{{ (head && head['文件使用范围']) || '' }}</span>
        </div>
      </div>
    </div>

    <!-- ③ 说明段 -->
    <div class="pds-note">
      {{ tt('可通过产品编号直接搜索；状态由各文件面板的单据实时推导（未开发 / 开发中 / 开发审核中 / 开发完毕）。') }}
    </div>

    <!-- ④ 矩阵表 -->
    <div class="pds-scroll">
      <table class="pds-table">
        <thead>
          <tr>
            <th class="pds-c-no">{{ tt('产品编号') }}</th>
            <template v-for="c in columns" :key="'h' + c.panelCode">
              <th class="pds-c-file">{{ tt(c.panelName) }}</th>
              <th class="pds-c-status">{{ tt('状态') }}</th>
            </template>
            <th class="pds-c-owner">{{ tt('产品负责人') }}</th>
            <th class="pds-c-ctrl">{{ tt('是否受控') }}</th>
            <th class="pds-c-date">{{ tt('受控日期') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="row['产品编号'] || ('r' + i)">
            <td class="pds-c-no">{{ row['产品编号'] || '' }}</td>
            <template v-for="c in columns" :key="'c' + c.panelCode + (row['产品编号'] || i)">
              <td class="pds-c-file">{{ tt(c.panelName) }}</td>
              <td class="pds-c-status">
                <span class="pds-badge" :class="toneOf(statusOf(row, c.panelCode))">
                  {{ tt(statusOf(row, c.panelCode)) }}
                </span>
              </td>
            </template>
            <td class="pds-c-owner">{{ row['产品负责人'] || '' }}</td>
            <td class="pds-c-ctrl">{{ tt(row['是否受控'] || '否') }}</td>
            <td class="pds-c-date">{{ row['受控日期'] || '' }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="14" class="pds-empty">
              {{ tt('暂无已下发的产品文件记录（先在产品信息表归档后点「产品开发」下发）') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { tt } from '@/i18n'
import request from '@/core/request'

const props = defineProps({
  head: { type: Object, default: () => ({}) },
  panelCode: { type: String, default: '' },
})

const columns = ref([])
const rows = ref([])

/**
 * 一行里某面板的状态。
 * 后端 board() 把 4 个面板的状态放在 row.cells[panelCode](键=面板编码)。
 * 兜底:缺该面板(历史 rd_dev_task 只指向已下线面板)时记「—」而不是空白。
 */
function statusOf(row, panelCode) {
  const c = row && row.cells ? row.cells[panelCode] : null
  return c || '—'
}

/** 状态色调:沿用项目既有语义(开发完毕=绿 / 开发中·开发审核中=蓝 / 未开发=灰) */
function toneOf(st) {
  if (st === '开发完毕') return 'done'
  if (st === '开发审核中') return 'review'
  if (st === '开发中') return 'doing'
  return 'none'
}

async function load() {
  try {
    const res = await request.get('/px/prodDocList')
    const data = (res && res.data) || {}
    columns.value = data.columns || []
    rows.value = data.rows || []
  } catch (e) {
    columns.value = []
    rows.value = []
  }
}

onMounted(load)
// 单据切换(单单据面板下通常只有一张)或面板编码变化时重取
watch(() => [props.panelCode, props.head && props.head['单据编号']], load)
</script>

<style scoped>
.prod-doc-sheet { padding: 8px 4px 24px; color: #1f2d3d; }

.pds-topbar { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 6px; }
.pds-company { font-size: 15px; font-weight: 700; letter-spacing: .5px; }
.pds-docno { font-size: 13px; color: #409eff; }

.pds-title-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #2f6fbf; color: #fff; padding: 8px 12px; border-radius: 2px;
}
.pds-title { font-size: 17px; font-weight: 700; letter-spacing: 2px; }
.pds-info-table { font-size: 12px; }
.pds-info-row { display: flex; gap: 6px; line-height: 1.7; }
.pds-info-label { opacity: .85; min-width: 62px; text-align: right; }
.pds-info-value { min-width: 70px; }

.pds-note { padding: 8px 6px 10px; font-size: 12px; color: #606266; }

.pds-scroll { overflow: auto; }
.pds-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pds-table th, .pds-table td { border: 1px solid #d9dee5; padding: 5px 6px; vertical-align: middle; }
.pds-table thead th {
  background: #eef2f7; font-weight: 600; text-align: center; white-space: nowrap;
}
.pds-c-no { min-width: 110px; font-weight: 600; }
.pds-c-file { min-width: 108px; white-space: nowrap; }
.pds-c-status { min-width: 96px; text-align: center; }
.pds-c-owner { min-width: 90px; }
.pds-c-ctrl { min-width: 74px; text-align: center; }
.pds-c-date { min-width: 120px; }
.pds-empty { text-align: center; color: #909399; padding: 18px 0; }

.pds-badge { display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 11px; line-height: 17px; }
.pds-badge.done { background: #e7f7ed; color: #1f9254; border: 1px solid #b7e3c7; }
.pds-badge.review { background: #eaf1fd; color: #2f6fbf; border: 1px solid #bfd5f5; }
.pds-badge.doing { background: #eef6ff; color: #3d7ec4; border: 1px solid #c8ddf7; }
.pds-badge.none { background: #f4f5f7; color: #909399; border: 1px solid #e0e3e8; }

@media print {
  .pds-note { display: none; }
}
</style>
