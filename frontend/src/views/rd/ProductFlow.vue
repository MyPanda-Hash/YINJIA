<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品文件流程管控(2026-11-11 用户口径):
         「再用设计库设计一个和项目流程管控面板一样的流程查看功能的面板去专门查看产品文件的
           流程管控，就是和产品信息表以及下面 4 个面板对应的流程」

       与 ProjectFlow.vue(项目流程管控)同一套版式语言:KPI 卡片 → 检索条 → 清单表(展开=时间轴)。
       区别只在"流程"是什么:这边一条 = 一个产品开发包 = 产品信息表 + 4 张受控文件。
       只读:数据全部来自 /px/rdDevOverview(与「产品文件列表·流程全览」「项目进度查询·开发产品」
       同一份事实),本页不写库、不触发审批。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="pfl-page">
    <!-- 2026-11-23 用户口径：「产品文件流程管控这些字样删掉」
         ⇒ 页头标题/副标题/数据来源三行整体撤除，直接从 KPI 卡片开始（页面标题已由页签给出）。 -->

    <section class="pfl-kpis">
      <article v-for="k in kpiCards" :key="k.key" class="pfl-kpi">
        <span class="pfl-kpi-label">{{ tt(k.label) }}</span>
        <strong class="pfl-kpi-num" :class="'tone-' + k.tone">{{ k.value }}</strong>
        <span class="pfl-kpi-hint">{{ tt(k.hint) }}</span>
      </article>
    </section>

    <div class="pfl-bar">
      <el-input
        v-model="keyword"
        class="pfl-search"
        clearable
        :placeholder="tt('输入产品编号 / 产品名称 / 立项文档编号（支持片段）')"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-checkbox v-model="onlyOpen">{{ tt('只看未完成') }}</el-checkbox>
      <el-button type="primary" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
      <span class="pfl-tip">{{ tt('展开行可看 5 步时间轴') }}</span>
    </div>

    <section v-if="denied" class="pfl-card pfl-denied">
      {{ tt('没有查看产品进度数据的权限（需要「项目进度查询」或「产品文件列表」的查看权）') }}
    </section>

    <section v-else class="pfl-card">
      <div class="pfl-card-head">
        <h2 class="pfl-card-title">{{ tt('流程清单') }}</h2>
        <span class="pfl-card-hint">{{ tt('共') }} {{ shown.length }} {{ tt('条') }}</span>
      </div>
      <el-table
        :data="shown"
        :row-key="rowKeyOf"
        size="small"
        border
        class="pfl-table"
        :empty-text="tt('没有符合条件的产品')"
      >
        <!-- 展开行 = 5 步时间轴 + 单据信息区。
             2026-11-17 用户口径「格式可以按照项目流程管控的格式进行参考设计」⇒ 与 ProjectFlow
             的展开行同构:① 一句话状态;② 每步「序号 + 环节名 + 状态标签 + 时间」;
             ③ 底部 dl 单据信息五项。 -->
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="pfl-flow">
              <p class="pfl-headline" :class="currentOf(row) ? 'is-stuck' : 'is-done'">
                {{ flowText(row) }}
              </p>
              <ol class="pfl-steps">
                <li v-for="(st, i) in stepsOf(row)" :key="st.key + i" class="pfl-step" :class="'is-' + st.tone">
                  <span class="pfl-step-idx">{{ i + 1 }}</span>
                  <div class="pfl-step-body">
                    <div class="pfl-step-row">
                      <span class="pfl-step-name">{{ tt(st.label) }}</span>
                      <!-- 状态标签:与项目流程管控的 el-tag 同款(三档统一说法,不再吐「草稿」原文) -->
                      <el-tag size="small" :type="tagTypeOf(st.tone)" effect="plain">{{ tt(stateLabel(st)) }}</el-tag>
                      <!-- 2026-11-20 用户口径：步骤行显示**产品编号**，不再显示单据编号。
                           单据编号只保留在下面「· N 张」展开的多单据清单里（区分同类多张单必需）。 -->
                      <span v-if="st.productCode" class="pfl-step-code" :title="tt('产品编号')">{{ st.productCode }}</span>
                      <!-- 2026-11-19 用户口径 A：同类多张数据记录表 —— 显示「· N 张」，点开列全部 -->
                      <span
                        v-if="st.docs && st.docs.length > 1"
                        class="pfl-step-count" @click.stop="toggleDocs(st)"
                      >· {{ st.docs.length }} {{ tt('张') }}</span>
                      <!-- 填写人（2026-11-19 销售问题汇总 P14：「要跟项目查询一样，增加填写人名字」） -->
                      <span v-if="st.actor" class="pfl-step-actor" :title="tt('填写人')">{{ st.actor }}</span>
                      <!-- 最后操作时间(2026-11-17 取代原来的「处理人」;取不到显示「-」,不编造) -->
                      <span class="pfl-step-at" :title="tt('最后操作时间')">{{ st.at || '-' }}</span>
                    </div>
                    <!-- 谁提交 / 谁审批通过（2026-11-23 用户口径「像立项申请表一样，展开能看到
                         谁提交了单据等待审批中，谁审批通过了，现在只有进行中」）。
                         有数据才渲染；没有就整行不出现（不占高度、不印「—」凑数）。 -->
                    <p v-if="approvalLine(st)" class="pfl-step-approval">{{ approvalLine(st) }}</p>
                    <!-- 多单据清单：保留单据编号（区分同类多张单），并补产品编号 / 日期 / 填写人。
                         点单号跳转的行为不变（openDoc 按前缀判面板）。 -->
                    <ul v-if="openDocs.has(st.key) && st.docs && st.docs.length" class="pfl-docs">
                      <li v-for="d in st.docs" :key="d.no" class="pfl-doc" @click.stop="openDoc(d.no)">
                        <span class="pfl-doc-code" :title="tt('产品编号')">{{ d.productCode || '—' }}</span>
                        <span class="pfl-doc-no" :title="tt('单据编号')">{{ d.no }}</span>
                        <span class="pfl-doc-at" :title="tt('最后操作时间')">{{ d.at || '-' }}</span>
                        <span class="pfl-doc-by" :title="tt('填写人')">{{ d.actor || '-' }}</span>
                      </li>
                    </ul>
                    <p v-if="st.reaudited" class="pfl-step-detail">{{ tt('曾经审核又被弃审，需重走这一步') }}</p>
                  </div>
                </li>
              </ol>
              <!-- 单据信息区(与 ProjectFlow 的 pf-meta 同构:label/value 成对,空值显示 -) -->
              <dl class="pfl-meta">
                <div v-for="m in metaOf(row)" :key="m.label">
                  <dt>{{ tt(m.label) }}</dt>
                  <dd>{{ m.value }}</dd>
                </div>
              </dl>
            </div>
          </template>
        </el-table-column>
        <!-- 产品编号为空(新建的产品信息表还没填)时显示「—」:行照常出现,但一眼看出"这单还没编号" -->
        <!-- 窄屏(min-width 定宽会横向溢出):改用 min-width 让它按比例收缩,1440 仍是 132px 观感 -->
        <el-table-column :label="tt('产品编号')" :width="wide ? 132 : undefined" :min-width="wide ? undefined : 110">
          <template #default="{ row }">{{ row['产品编号'] || '—' }}</template>
        </el-table-column>
        <el-table-column prop="产品名称" :label="tt('产品名称')" :min-width="wide ? 180 : 140" show-overflow-tooltip />
        <el-table-column :label="tt('立项文档编号')" :width="wide ? 160 : undefined" :min-width="wide ? undefined : 120" show-overflow-tooltip>
          <template #default="{ row }">{{ row['立项文档编号'] || '-' }}</template>
        </el-table-column>
        <!-- 「当前环节」列(2026-11-17 对齐项目流程管控):显示成 `3/5 成型工艺清单`,
             不再只在展开行里才说卡在哪;全完成显示「已完成」。 -->
        <el-table-column :label="tt('当前环节')" :min-width="wide ? 190 : 150">
          <template #default="{ row }">
            <span v-if="!currentOf(row)" class="pfl-chip is-done">{{ tt('已完成') }}</span>
            <span v-else class="pfl-cur">
              <span class="pfl-cur-no">{{ currentOf(row).text }}</span>
              <span class="pfl-cur-name">{{ tt(currentOf(row).step.label) }}</span>
            </span>
          </template>
        </el-table-column>
        <!-- 「进度」= 分数 + 进度条(与项目流程管控同款 el-progress),比纯文本分数更好扫 -->
        <el-table-column v-if="wide" :label="tt('进度')" width="130">
          <template #default="{ row }">
            <div class="pfl-progress">
              <span class="pfl-num">{{ progressOf(row) }}</span>
              <el-progress
                :percentage="progressPctOf(row)"
                :show-text="false"
                :stroke-width="6"
                :color="progressPctOf(row) === 100 ? '#1f8a5b' : '#537786'"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="tt('状态')" :width="wide ? 132 : undefined" :min-width="wide ? undefined : 100">
          <template #default="{ row }">
            <span class="pfl-chip" :class="'is-' + statusToneOf(row)">{{ tt(statusTextOf(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="wide" :label="tt('下一步')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="nextOf(row)">{{ tt(nextOf(row).label) }}</span>
            <span v-else class="pfl-done">{{ tt('已完成') }}</span>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { tt } from '@/i18n'
import { Search } from '@element-plus/icons-vue'
import request from '@/core/request'
import {
  STEP_STATE, approvalLineOf, currentStepOf, docMetaOf, filterFlowRows, flowKpisOf, flowStatusOf,
  flowStepsOf, nextStepOf, stateLabelOf,
} from '@/core/prod/productFlow'

const router = useRouter()
/** 展开状态：哪些步骤的多单据清单是打开的（2026-11-19） */
const openDocs = reactive(new Set())
function toggleDocs(st) {
  if (openDocs.has(st.key)) openDocs.delete(st.key)
  else openDocs.add(st.key)
}
/** 点单号进对应单据（按单号前缀判面板：LXA=立项、其余=实施计划/数据记录表走对应面板） */
function openDoc(no) {
  const v = String(no || '')
  if (!v) return
  const panel = v.startsWith('LXA') ? 'RD_APPROVAL' : (panelOfNo(v) || 'RD_PROGRESS')
  router.push({ path: `/panelx/list/${panel}`, query: { focus: v } })
}
/** 数据记录表单号 → 面板（碱性 YJ-PD-… 等；取不到就落回项目控制列表） */
function panelOfNo(no) {
  const map = { 'YJ-PD': 'RD_ALKALINE' }
  for (const k of Object.keys(map)) if (String(no).startsWith(k)) return map[k]
  return ''
}

const rows = ref([])
const loading = ref(false)
const denied = ref(false)
const keyword = ref('')
const onlyOpen = ref(false)
/**
 * 宽屏才显示「进度 / 下一步」两列(参考项目流程管控的 `wide` 做法)。
 *
 * <p>阈值 1200(不是参考实现那个 768):本表 7 列定宽合计 1104px,再加左侧菜单约 200px,
 * 768~1100 这一段窗口会横向溢出(实测 853 视口下 table 内部宽 1152 ⇒ 整页 docScrollW 968 > 853)。
 * 收到 4 列后合计 654px,853 也装得下。</p>
 */
const wide = ref(true)
const WIDE_MIN = 1200

function syncWidth() {
  wide.value = typeof window === 'undefined' ? true : window.innerWidth >= WIDE_MIN
}

const shown = computed(() => filterFlowRows(rows.value, keyword.value, onlyOpen.value))

const kpiCards = computed(() => {
  const k = flowKpisOf(rows.value)
  return [
    { key: 'total', label: '产品数', value: k.total, tone: 'total', hint: '已下发开发的产品' },
    { key: 'done', label: '已开发完毕', value: k.done, tone: 'done', hint: '5 步全部完成' },
    { key: 'doing', label: '进行中', value: k.doing, tone: 'doing', hint: '至少一份文件在建/已归档' },
    { key: 'none', label: '未开工', value: k.none, tone: 'none', hint: '4 份文件一份都没起' },
  ]
})

/**
 * 行键:优先产品编号;新建未填编号的单退回单据编号。
 * ⚠ 不能再写死 row-key="产品编号" —— 2026-11-17 起列表会含"还没填产品编号"的新单,
 * 空键在 el-table 里会互相撞车(同一 key 的多行共用一个展开态,展开一行另一行跟着动)。
 */
function rowKeyOf(row) {
  const code = String(row?.['产品编号'] || '').trim()
  return code || ('NO:' + String(row?.['单据编号'] || ''))
}

function stepsOf(row) { return flowStepsOf(row) }
function nextOf(row) { return nextStepOf(flowStepsOf(row)) }

/** 「当前环节」:第几步 + 环节名(全部完成返回 null) */
function currentOf(row) { return currentStepOf(flowStepsOf(row)) }
/** 展开行底部「单据信息」五项(label/value 成对,纯函数产出) */
function metaOf(row) { return docMetaOf(row) }
/** 状态文案三档(已完成/进行中/未开始) —— 不再显示「草稿」这种单据状态原文 */
function stateLabel(st) { return stateLabelOf(st) }
/** 这一步「谁提交 / 谁审批通过」的一句话（2026-11-23；没有就返回空串，不渲染那一行） */
function approvalLine(st) { return approvalLineOf(st) }
/** el-tag 的 type 映射(与项目流程管控的 tagType 同款) */
function tagTypeOf(tone) {
  if (tone === STEP_STATE.done) return 'success'
  if (tone === STEP_STATE.doing) return 'warning'
  return 'info'
}
/** 一句话状态:与项目流程管控的 flowText 同款(卡在 + 环节名 / 全部完成) */
function flowText(row) {
  const cur = currentOf(row)
  if (!cur) return `${tt('全部完成')}（${progressOf(row)}）`
  return `${tt('卡在：')}${tt(cur.step.label)}`
}

/** 进度 = 已完成的步骤数 / 5（产品信息表也算一步） */
function progressOf(row) {
  const steps = flowStepsOf(row)
  const done = steps.filter((s) => s.tone === STEP_STATE.done).length
  return `${done}/${steps.length}`
}
/** 进度百分比(el-progress 用) */
function progressPctOf(row) {
  const steps = flowStepsOf(row)
  if (!steps.length) return 0
  const done = steps.filter((s) => s.tone === STEP_STATE.done).length
  return Math.round((done / steps.length) * 100)
}

/** 整包状态：与 KPI 同一个函数（core/prod/productFlow.flowStatusOf），不在这里另判一次 */
function statusToneOf(row) { return flowStatusOf(row) }
function statusTextOf(row) {
  const t = flowStatusOf(row)
  return t === STEP_STATE.done ? '已开发完毕' : (t === STEP_STATE.doing ? '进行中' : '未开工')
}

async function load() {
  loading.value = true
  denied.value = false
  try {
    const res = await request.get('/px/rdDevOverview')
    const list = (res && res.data && res.data.products) || []
    // ⚠ 2026-11-17 用户口径「新增的产品信息应该放最上面，不要放下面」:
    //   原来这里把「产品编号为空」的行整条丢掉 —— 而新建的产品信息表恰恰**还没填产品编号**,
    //   于是"刚建的那张"永远不出现在列表里,用户看到的就是"新单跑到下面去了/根本找不到"。
    //   现在保留:只要**有单据编号**就说明这张单真实存在,列表照样列出来
    //   (产品编号列显示「—」,提示它还没填)。产品编号才是"开发包身份",
    //   没有它的单不该冒充成一个开发包,所以仍然过滤 —— 过滤条件改成"两者都空才算脏行"。
    rows.value = list.filter((r) => String(r?.['单据编号'] || '').trim() !== '' || String(r?.['产品编号'] || '').trim() !== '')
  } catch (e) {
    rows.value = []
    denied.value = true
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  syncWidth()
  window.addEventListener('resize', syncWidth)
  load()
})
onBeforeUnmount(() => window.removeEventListener('resize', syncWidth))
</script>

<style scoped>
/* 版式语言与 ProjectFlow.vue 一致：浅底、白卡片、1px 边框、无阴影；
   间距 8 的倍数；数字列 tabular-nums（这里只有"进度"是数字列）。 */
.pfl-page { padding: 20px 24px 32px; background: #f5f7fa; min-height: 100%; box-sizing: border-box; }
/* 页头三行已按 2026-11-23 用户口径撤除（.pfl-head/.pfl-title/.pfl-sub/.pfl-source 不再使用），
   故对应样式一并删除，避免留死样式误导后来者以为还有页头。 */

.pfl-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.pfl-kpi { background: #fff; border: 1px solid #e4e8ee; border-radius: 6px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.pfl-kpi-label { font-size: 12px; color: #8a97a5; }
.pfl-kpi-num { font-size: 24px; line-height: 32px; font-weight: 600; color: #1f2d3d; font-variant-numeric: tabular-nums; }
.pfl-kpi-num.tone-done { color: #2f6f4e; }
.pfl-kpi-num.tone-doing { color: #1e5a8a; }
.pfl-kpi-num.tone-none { color: #8a97a5; }
.pfl-kpi-hint { font-size: 12px; color: #a8b3bf; }

.pfl-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.pfl-search { width: 320px; }
.pfl-tip { font-size: 12px; color: #8a97a5; }

.pfl-card { background: #fff; border: 1px solid #e4e8ee; border-radius: 6px; }
.pfl-denied { padding: 32px; text-align: center; color: #8a97a5; font-size: 13px; }
.pfl-card-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eef1f5; }
.pfl-card-title { margin: 0; font-size: 14px; font-weight: 600; color: #1f2d3d; }
.pfl-card-hint { font-size: 12px; color: #8a97a5; }
.pfl-num { font-variant-numeric: tabular-nums; color: #5c6b7a; }
.pfl-done { color: #2f6f4e; }

.pfl-chip { display: inline-block; padding: 0 8px; line-height: 22px; border-radius: 11px; font-size: 12px; border: 1px solid transparent; }
.pfl-chip.is-done { color: #2f6f4e; background: #eef7f1; border-color: #cfe7d9; }
.pfl-chip.is-doing { color: #1e5a8a; background: #eff6fd; border-color: #cfe2f5; }
.pfl-chip.is-none { color: #8a97a5; background: #f5f7fa; border-color: #e4e8ee; }

/* 「当前环节」列:第几步徽标 + 环节名(与项目流程管控的 .pf-cur 同款) */
.pfl-cur { display: inline-flex; gap: 6px; align-items: baseline; min-width: 0; }
.pfl-cur-no {
  flex: none; padding: 0 6px; font-size: 11px; line-height: 18px;
  font-variant-numeric: tabular-nums; color: #a0641a;
  border: 1px solid rgba(160, 100, 26, 0.4); border-radius: 9px;
}
.pfl-cur-name { font-weight: 600; color: #1f2d3d; }
/* 「进度」列:分数 + 进度条同行,数字等宽好扫 */
.pfl-progress { display: flex; gap: 6px; align-items: center; }
.pfl-progress :deep(.el-progress) { flex: 1; margin: 0; }

/* 展开区 = 5 步时间轴（左竖线 + 圆点，与项目流程管控同款） */
.pfl-flow { padding: 12px 16px 8px 40px; background: #fafbfc; }
.pfl-headline { margin: 0 0 12px; font-size: 13px; }
.pfl-headline.is-stuck { color: #a0641a; }
.pfl-headline.is-done { color: #2f6f4e; }
.pfl-steps { list-style: none; margin: 0; padding: 0 0 0 18px; border-left: 1px dashed #d8e0e8; }
.pfl-step { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 13px; }
.pfl-step-idx {
  flex: none; width: 18px; height: 18px; margin-left: -27px; border-radius: 50%;
  background: #fff; border: 1px solid #d8e0e8; color: #8a97a5;
  font-size: 11px; line-height: 16px; text-align: center;
}
.pfl-step.is-done .pfl-step-idx { border-color: #2f6f4e; color: #2f6f4e; }
.pfl-step.is-doing .pfl-step-idx { border-color: #1e5a8a; color: #1e5a8a; }
/* 每一步一行:环节名 + 状态标签 + 产品编号 + 时间,空间不够自动换行(与 ProjectFlow 的 .pf-step-row 同款) */
.pfl-step-body { min-width: 0; flex: 1; }
.pfl-step-row { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.pfl-step-name { font-weight: 600; color: #1f2d3d; }
/* 2026-11-20:原来这里是单据编号,改显示该步骤所属产品的产品编号(单号只在多单据清单里) */
.pfl-step-code { font-size: 12px; color: #8a97a5; font-variant-numeric: tabular-nums; }
/* 最后操作时间(2026-11-17 取代原来的「处理人」):等宽数字,竖排时逐行对齐好扫 */
.pfl-step-at { font-size: 12px; color: #5b6b7c; font-variant-numeric: tabular-nums; }
.pfl-step-detail { margin: 2px 0 0; font-size: 12px; line-height: 1.5; color: #a0641a; }
/* 提交/审批副行：比主行弱一档（12px 次级灰），只在有数据时出现 */
.pfl-step-approval { margin: 2px 0 0; font-size: 12px; line-height: 18px; color: #5c6b7a; }

/* 展开行底部「单据信息」区(与 ProjectFlow 的 .pf-meta 同构:虚线分隔 + 横排 label/value) */
.pfl-meta {
  display: flex; flex-wrap: wrap; gap: 6px 24px;
  margin: 10px 0 0; padding-top: 8px; border-top: 1px dashed #e4e8ee;
}
.pfl-meta div { display: flex; gap: 6px; min-width: 0; }
.pfl-meta dt { font-size: 12px; color: #8a97a5; white-space: nowrap; }
.pfl-meta dd { margin: 0; font-size: 12px; color: #5c6b7a; }

@media (max-width: 1100px) {
  .pfl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* 窄屏(≤768):表格只留 4 列(见脚本里的 wide);展开行若不限宽,
   整句会被 el-table 的内部虚拟宽度撑着、在可视区右缘被裁掉 —— 与项目流程管控同一条兜底。 */
@media (max-width: 1200px) {
  .pfl-bar { flex-wrap: wrap; }
  .pfl-search { width: 100%; max-width: 320px; }
}
@media (max-width: 768px) {
  .pfl-flow { padding-left: 8px; max-width: calc(100vw - 56px); }
  .pfl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.pfl-step-actor { margin-left: 8px; font-size: 12px; color: #595959; }
.pfl-step-count { margin-left: 6px; font-size: 12px; color: #0958d9; cursor: pointer; }
.pfl-docs { margin: 4px 0 0 20px; padding: 0; list-style: none; }
/* 多单据清单:产品编号 + 单据编号 + 最后操作时间 + 填写人;窄屏自动换行,不撑出横向滚动 */
.pfl-doc { display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: 12px; color: #595959; padding: 2px 0; cursor: pointer; }
.pfl-doc-code { color: #1f2d3d; font-variant-numeric: tabular-nums; }
.pfl-doc-no { color: #0958d9; font-variant-numeric: tabular-nums; }
.pfl-doc-at { color: #5b6b7c; font-variant-numeric: tabular-nums; }
.pfl-doc-by { color: #595959; }
.pfl-doc:hover { background: #f0f6ff; }
</style>