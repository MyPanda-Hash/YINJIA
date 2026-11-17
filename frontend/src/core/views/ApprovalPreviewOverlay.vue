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
              <h1 class="apv-title">{{ tt('单据预览') }}</h1>
              <p class="apv-sub">
                {{ tt('项目立项申请 · 按申请立项人筛选') }}
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

        <!-- ② 筛选区：范围(我的/全部) + 关键字。搜索框走「信息池中找目标」的 Search 形态 -->
        <div class="apv-bar">
          <el-radio-group v-model="scope" size="default" class="apv-scope">
            <el-radio-button value="mine">
              {{ tt('只看我申请的') }}
            </el-radio-button>
            <el-radio-button value="all">{{ tt('全部') }}</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="keyword"
            class="apv-search"
            clearable
            :placeholder="tt('搜索单据编号 / 客户名 / 申请立项人')"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <span class="apv-me">
            {{ tt('当前登录人') }}：<b>{{ meName || '—' }}</b>
          </span>
        </div>

        <!-- ③ 内容：表格（重要列靠左、数字右对齐、操作列固定右侧） -->
        <div class="apv-body">
          <el-table
            v-if="filtered.length"
            :data="filtered"
            row-key="单据编号"
            size="small"
            border
            height="100%"
            class="apv-table"
            @row-dblclick="(row) => emit('jump', row)"
          >
            <el-table-column :label="tt('序号')" width="64" align="right">
              <template #default="{ $index }">
                <span class="apv-num">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="单据编号" :label="tt('单据编号')" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="apv-no">{{ row['单据编号'] || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="单据日期" :label="tt('单据日期')" width="120" />
            <el-table-column prop="申请立项人" :label="tt('申请立项人')" width="130">
              <template #default="{ row }">
                <span :class="{ 'apv-muted': !row['申请立项人'] }">{{ row['申请立项人'] || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="客户名" :label="tt('客户名')" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <span :class="{ 'apv-muted': !row['客户名'] }">{{ row['客户名'] || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('项目等级')" width="100" align="right">
              <template #default="{ row }">
                <span class="apv-num">{{ row['项目等级'] || '—' }}</span>
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
                ? tt('单据的「申请立项人」要填你本人姓名，才会出现在这里')
                : tt('换个关键字，或切到「全部」看看') }}
            </p>
            <el-button v-if="scope === 'mine'" @click="scope = 'all'">
              {{ tt('查看全部单据') }}
            </el-button>
            <el-button v-else @click="resetFilter">{{ tt('清空筛选') }}</el-button>
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
import { filterApprovalPreview } from '@/core/panel/docPreview'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 当前面板已取全的单据行（父组件负责取数） */
  rows: { type: Array, default: () => [] },
  /** 当前登录人姓名（= 表头字段「申请立项人」里的值，用来判「我申请的」） */
  me: { type: String, default: '' },
});
const emit = defineEmits(['close', 'jump'])

/** 'mine' = 只看我申请的（默认，用户口径的正面需求）；'all' = 代查/管理员 */
const scope = ref('mine')
const keyword = ref('')
const meName = computed(() => String(props.me || '').trim())

const filtered = computed(() => filterApprovalPreview(props.rows, {
  me: meName.value,
  scope: scope.value,
  keyword: keyword.value,
}))

function resetFilter() {
  keyword.value = ''
  scope.value = 'mine'
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

/* ③ 内容区：表格撑满剩余高度，内部滚动 */
.apv-body { flex: 1 1 auto; min-height: 0; padding: 16px 24px 24px; box-sizing: border-box; display: flex; flex-direction: column; }
.apv-table { flex: 1 1 auto; min-height: 0; }
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