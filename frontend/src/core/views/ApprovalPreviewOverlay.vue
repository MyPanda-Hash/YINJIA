<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       立项申请 · 全屏单据预览（2026-11-17 用户口径）

       用户原话：「点击单据预览就根据申请立项人进行一个筛选全屏展示这些属于自己申请的单据的
         明细，设计要好看，使用设计库进行设计，要留一个返回按钮，点击对应单据要有一个
         跳转按钮，可以直接跳转到对应单据」。

       设计（antd 6.6.8 设计库规则）：
         · 骨架 = 列表页模板（页头 → 筛选 → 内容），全屏浮层挂在 body 上；
         · 卡片 0 层：白底 + 1px 边框，不加阴影；层级靠边框与留白；
         · 8pt 网格：8/16/24；控件高 32；圆角 6；正文 14/22；
         · 数字列（项目等级/序号）右对齐 + tabular-nums；
         · 一个操作区最多一个主按钮（「刷新」是 primary，其余默认/文字）；
         · 空态给主行动，不写裸的「暂无数据」。

       数据 = 调用方传入的 rows（父组件已按当前面板取全），本组件只做筛选与呈现；
       筛选口径在 core/panel/docPreview.js（filterApprovalPreview），本组件不另判一次。
       ═══════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <div v-if="visible" class="apv-mask" @click.self="emit('close')">
      <section class="apv-panel" role="dialog" aria-modal="true" :aria-label="tt('单据预览')">
        <!-- ① 页头：标题 + 计数 + 返回（返回放在**左侧**，符合「返回类按钮靠左」的导航习惯） -->
        <header class="apv-head">
          <div class="apv-head-main">
            <button class="apv-back" type="button" @click="emit('close')">
              <span aria-hidden="true">←</span> {{ tt('返回') }}
            </button>
            <div class="apv-titles">
              <h1 class="apv-title">{{ tt(titleText || '单据预览') }}</h1>
              <p class="apv-sub">
                {{ props.subject ? tt(props.subject) + ' · ' : '' }}{{ tt('按归属人筛选') }}
              </p>
            </div>
          </div>
          <div class="apv-head-act">
            <span class="apv-count">
              {{ tt('共') }} <b>{{ filtered.length }}</b> {{ tt('条') }}
              <template v-if="filtered.length !== rows.length">
                （{{ tt('全部') }} {{ rows.length }}）
              </template>
            </span>
          </div>
        </header>

        <!-- ② 查询栏（2026-11-17 参考金蝶「商品列表」的多条件形态）：
             范围 → 关键字 → 单据状态 → 项目等级 → 日期区间 → 重置。
             条件之间是 AND；「重置」只清条件、不动范围(我的/全部)。 -->
        <div class="apv-bar">
          <el-radio-group v-model="scope" size="default" class="apv-bar-item apv-scope">
            <el-radio-button value="mine">{{ tt('只看我申请的') }}</el-radio-button>
            <el-radio-button value="all">{{ tt('全部') }}</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="keyword"
            class="apv-search apv-bar-item"
            clearable
            :placeholder="tt('搜索单据编号 / 客户名 / 申请立项人')"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="status" clearable class="apv-sel apv-bar-item" :placeholder="tt('单据状态')">
            <el-option v-for="n in treeNodes.slice(1)" :key="n.key" :label="tt(n.label)" :value="n.key" />
          </el-select>
          <el-select v-model="grade" clearable class="apv-sel apv-bar-item" :placeholder="tt('项目等级')">
            <el-option v-for="g in gradeOptions" :key="g" :label="g" :value="g" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            class="apv-date apv-bar-item"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            unlink-panels
          />
          <el-button class="apv-bar-item" @click="resetFilter">{{ tt('重置') }}</el-button>
          <span class="apv-me apv-bar-item">
            {{ tt('当前登录人') }}：<b>{{ meName || '—' }}</b>
          </span>
        </div>

        <!-- ③ 内容：左侧「单据状态」分类树 + 右侧表格
             （2026-11-17 参考金蝶「商品列表」：左树给"看哪一类"、右表给"逐条比"） -->
        <div class="apv-body">
          <aside class="apv-tree" :aria-label="tt('按状态分类')">
            <div class="apv-tree-head">{{ tt('状态') }}</div>
            <ul class="apv-tree-list">
              <li
                v-for="n in treeNodes"
                :key="n.key || 'all'"
                class="apv-tree-item"
                :class="{ on: n.key === treeKey }"
                :title="tt('在当前的「我的/全部」范围内按状态筛选')"
                @click="pickTree(n.key)"
              >
                <span class="apv-tree-label">{{ tt(n.label) }}</span>
                <span class="apv-tree-count">{{ n.count }}</span>
              </li>
            </ul>
          </aside>
          <div class="apv-table-wrap">
          <el-table
            v-if="filtered.length"
            :data="filtered"
            row-key="单据编号"
            size="small"
            border
            height="100%"
            class="apv-table"
            @row-dblclick="(row) => emit('jump', row)"
            @row-click="(row) => emit('jump', row)"
          >
            <el-table-column :label="tt('序号')" width="64" align="right">
              <template #default="{ $index }">
                <span class="apv-num">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <!-- 业务列按面板配置（2026-11-17 用户口径：「单据编号是固定的，应该展示其他比较重点的字段」）
                 ⇒ 立项申请出 客户名/项目等级/申请人；产品信息表出 产品编号/名称/客户名称，
                 单据编号退到最后（它可能是 YJ-QR-152 这种固定表单号，没有区分度）。 -->
            <el-table-column
              v-for="c in cols"
              :key="c.key"
              :label="tt(c.label)"
              :min-width="c.minWidth || undefined"
              :width="c.width || undefined"
              :align="c.kind === 'num' ? 'right' : undefined"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span :class="c.kind === 'num' ? 'apv-num' : (row[c.key] ? '' : 'apv-muted')">
                  {{ row[c.key] || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('状态')" width="120">
              <template #default="{ row }">
                <span class="apv-chip" :class="'is-' + statusTone(row['单据状态'])">
                  {{ tt(String(row['单据状态'] || '—')) }}
                </span>
              </template>
            </el-table-column>
            <!-- 操作列固定右侧：文字按钮（表格内面积小、视觉最弱） -->
            <el-table-column :label="tt('操作')" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="emit('jump', row)">
                  {{ tt('跳转') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <!-- 空态：必须给下一步动作，不写裸的「暂无数据」 -->
          <div v-else class="apv-empty">
            <p class="apv-empty-t">
              {{ scope === 'mine' ? tt('你还没有申请过立项') : tt('没有符合条件的单据') }}
            </p>
            <p class="apv-empty-d">
              {{ scope === 'mine'
                ? tt('单据的「{f}」要填你本人姓名，才会出现在这里').replace('{f}', tt(props.ownerKey || '申请立项人'))
                : tt('换个关键字，或切到「全部」看看') }}
            </p>
            <el-button v-if="scope === 'mine'" @click="scope = 'all'">
              {{ tt('查看全部单据') }}
            </el-button>
            <el-button v-else @click="resetFilter">{{ tt('清空筛选') }}</el-button>
          </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { approvalStatusTree, filterApprovalPreview, previewColumnsOf } from '@/core/panel/docPreview'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 当前面板已取全的单据行（父组件负责取数） */
  rows: { type: Array, default: () => [] },
  /** 当前登录人姓名（= 表头「申请立项人」/「编辑人」里的值，用来判「我申请的」） */
  me: { type: String, default: '' },
  /** 归属人字段名：立项申请=申请立项人（缺省）；产品信息表=编辑人 */
  ownerKey: { type: String, default: '' },
  /** 副标题里的面板名（如「项目立项申请」「产品信息表」） */
  subject: { type: String, default: '' },
  /** 面板码：决定表格出哪些业务列（见 docPreview.PREVIEW_TABLE_COLUMNS） */
  panelCode: { type: String, default: '' },
  /** 浮层标题：产品信息表=产品信息查询 / 立项申请=立项查询 / 其余=单据预览（2026-11-19） */
  titleText: { type: String, default: '' },
});
const emit = defineEmits(['close', 'jump'])

/** 'mine' = 只看我申请的（默认，用户口径的正面需求）；'all' = 代查/管理员 */
const scope = ref('mine')
const keyword = ref('')
// 2026-11-17 新增：左侧分类树 + 三个查询条件（参考金蝶「商品列表」）
const treeKey = ref('')          // '' = 全部
const status = ref('')           // 与 treeKey 联动（点树即设状态，选状态下拉即跳树）
const grade = ref('')
const dateRange = ref([])        // ['2026-11-01','2026-11-17'] 或 []
const meName = computed(() => String(props.me || '').trim())

/** 表格业务列（按面板配置；未登记的退回最小集） */
const cols = computed(() => previewColumnsOf(props.panelCode, props.ownerKey))

/** 左树节点 = 数据里出现过的单据状态（空节点不画） */
const treeNodes = computed(() => approvalStatusTree(props.rows))

/** 项目等级下拉候选 = 数据里去重后的非空值 */
const gradeOptions = computed(() => {
  const set = new Set()
  for (const r of props.rows || []) {
    const v = String(r && r['项目等级'] || '').trim()
    if (v) set.add(v)
  }
  return [...set].sort()
})

const filtered = computed(() => filterApprovalPreview(props.rows, {
  me: meName.value,
  scope: scope.value,
  keyword: keyword.value,
  ownerKey: props.ownerKey || undefined,
  status: status.value,
  grade: grade.value,
  dateFrom: (dateRange.value && dateRange.value[0]) || '',
  dateTo: (dateRange.value && dateRange.value[1]) || '',
}))

/**
 * 点树节点 = 设状态（与状态下拉同一真源）。
 *
 * ⚠ 这里**不切 scope**（我的/全部）：
 *   树是"在这些单据里按状态分类"，而「我的/全部」是"看谁的单据"，两者维度不同。
 *   用户点「草稿」想表达的是"我草稿箱里的"，不是"所有人草稿"。
 *   要看别人的单，明确点上方「全部」—— 这是金蝶那套交互的同一口径
 *   （左树只管分类，范围由顶部范围控件决定）。
 */
function pickTree(key) {
  treeKey.value = key || ''
  status.value = key || ''
}

function resetFilter() {
  keyword.value = ''
  scope.value = 'mine'
  treeKey.value = ''
  status.value = ''
  grade.value = ''
  dateRange.value = []
}

/** 状态胶囊配色：完成=绿 / 进行中=蓝 / 草稿等=灰（与列表页同一套语义） */
function statusTone(s) {
  const v = String(s || '')
  if (v === '已归档' || v === '已审核' || v === '已完成') return 'done'
  if (v === '审批中' || v === '待二级审批' || v === '修改中') return 'doing'
  return 'none'
}

/** 每次打开都回到默认态（「只看我申请的」），避免上次的筛选残留让人误以为没数据 */
watch(() => props.visible, (v) => { if (v) resetFilter() })
/** 状态下拉与左树是同一真源，任一侧变化都要同步另一侧的高亮 */
watch(status, (v) => { treeKey.value = v || '' })

/** Esc 关闭（全屏浮层的常规预期） */
function onKey(e) { if (e.key === 'Escape' && props.visible) emit('close') }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
<style scoped>
/* ═══ 全屏单据预览 ═══
   数值全部取自 antd 6.6.8 设计库：
   padding 24/16/8、controlHeight 32、borderRadius 6、fontSize 14/lineHeight 22、
   colorBorderSecondary #f0f0f0、colorFillQuaternary rgba(0,0,0,.02)。
   卡片 0 层 → 白底 + 1px 边框，**不加阴影**；层级靠边框与留白。 */
.apv-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
}
.apv-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-width: 1440px;
  min-width: 0;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  box-sizing: border-box;
}

/* ① 页头：返回在左，标题居中偏左，右侧计数 */
.apv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  flex: none;
}
.apv-head-main { display: flex; align-items: center; gap: 16px; min-width: 0; }
/* 返回按钮：默认态（非主按钮），控件高 32、圆角 6 */
.apv-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
  flex: none;
  transition: border-color 0.15s, color 0.15s;
}
.apv-back:hover { border-color: #1677ff; color: #1677ff; }
.apv-back:focus-visible { outline: 2px solid #1677ff; outline-offset: 1px; }
.apv-titles { min-width: 0; }
.apv-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; color: rgba(0, 0, 0, 0.88); }
.apv-sub { margin: 2px 0 0; font-size: 12px; line-height: 20px; color: rgba(0, 0, 0, 0.45); }
.apv-head-act { flex: none; }
.apv-count { font-size: 13px; color: rgba(0, 0, 0, 0.45); }
.apv-count b { color: rgba(0, 0, 0, 0.88); font-variant-numeric: tabular-nums; }

/* ② 筛选区 */
.apv-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  flex: none;
}
.apv-scope { flex: none; }
.apv-search { width: 320px; max-width: 100%; }
.apv-me { font-size: 13px; color: rgba(0, 0, 0, 0.45); }
.apv-me b { color: rgba(0, 0, 0, 0.88); font-weight: 600; }

/* ③ 内容区：左「状态树」+ 右表格（2026-11-17 参考金蝶「商品列表」）
   树宽 200px 固定；表格占余下全部并内部滚动。
   取值仍是设计库：borderRadius 6 / colorBorderSecondary #f0f0f0 / padding 8·12 */
.apv-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px 24px 24px;
  box-sizing: border-box;
  display: flex;
  gap: 16px;
  flex-direction: row;
}
.apv-tree {
  flex: none;
  width: 200px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.apv-tree-head {
  flex: none;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
  border-bottom: 1px solid #f0f0f0;
  background: rgba(0, 0, 0, 0.02);
}
.apv-tree-list { flex: 1 1 auto; min-height: 0; overflow: auto; margin: 0; padding: 4px; list-style: none; }
.apv-tree-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.88);
}
.apv-tree-item:hover { background: rgba(0, 0, 0, 0.04); }
.apv-tree-item.on { background: #e6f4ff; color: #1677ff; font-weight: 600; }
.apv-tree-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.apv-tree-count {
  flex: none;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-variant-numeric: tabular-nums;
}
.apv-tree-item.on .apv-tree-count { color: #1677ff; }
.apv-table-wrap { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.apv-table { flex: 1 1 auto; min-height: 0; }
/* 查询栏控件宽度：下拉 140、日期 260，避免把一行挤爆 */
.apv-sel { width: 140px; }
.apv-date { width: 260px; }
/* 数字列右对齐 + 等宽（设计库硬规则） */
.apv-num { font-variant-numeric: tabular-nums; color: rgba(0, 0, 0, 0.88); }
.apv-no { font-variant-numeric: tabular-nums; letter-spacing: 0.2px; }
.apv-muted { color: rgba(0, 0, 0, 0.25); }

/* 状态胶囊：完成=绿 / 进行中=蓝 / 其它=灰 */
.apv-chip {
  display: inline-block;
  padding: 0 8px;
  line-height: 22px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid transparent;
}
.apv-chip.is-done { color: #389e0d; background: #f6ffed; border-color: #b7eb8f; }
.apv-chip.is-doing { color: #0958d9; background: #e6f4ff; border-color: #91caff; }
.apv-chip.is-none { color: rgba(0, 0, 0, 0.45); background: #fafafa; border-color: #f0f0f0; }

/* 空态：标题 + 一句话说明 + 一个可点的下一步（不是裸的「暂无数据」） */
.apv-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed #f0f0f0;
  border-radius: 6px;
  padding: 32px;
}
.apv-empty-t { margin: 0; font-size: 14px; line-height: 22px; color: rgba(0, 0, 0, 0.88); font-weight: 600; }
.apv-empty-d { margin: 0 0 8px; font-size: 13px; line-height: 20px; color: rgba(0, 0, 0, 0.45); text-align: center; }

/* 响应式三档：1440 / 768 / 375 都不得横向溢出 */
@media (max-width: 900px) {
  /* 窄屏：树改成横向一排，不占满高度 */
  .apv-body { flex-direction: column; }
  .apv-tree { width: 100%; max-height: 132px; }
  .apv-tree-list { display: flex; flex-wrap: wrap; gap: 4px; }
}
@media (max-width: 768px) {
  .apv-mask { padding: 0; }
  .apv-panel { border-radius: 0; border: none; }
  .apv-head { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
  .apv-bar { padding: 12px 16px; gap: 8px; }
  .apv-body { padding: 12px 16px 16px; }
  .apv-search { width: 100%; }
  .apv-me { width: 100%; }
}
</style>