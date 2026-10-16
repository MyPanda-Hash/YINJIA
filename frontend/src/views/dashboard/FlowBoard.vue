<!--
  FlowBoard.vue —— 「流程管控」看板(2026-10-16)

  用户口径:「我的桌面缺失对生产过程和库存的一个流程管理视图,可以根据图片以及下面文字设计一个
  对生产过程和库存的流程管控」。设计取向(工具界面,不是展示页):
    · 先扫什么   = 最上面那条「当前卡点」:谁卡住了、卡了几张、点一下直达该面板;
    · 再扫什么   = 每条泳道从左到右的节点卡,卡上**一个大数字**= 该节点最该动的量;
    · 颜色只表状态 = 红 阻断 / 橙 积压 / 绿 通畅 / 灰 无在办 / 虚 无数据(不拿颜色做装饰);
    · 记忆点     = 卡片右上角的流向箭头与左侧状态色条,扫一眼就知道"货走到哪、停在哪"。

  数据只来自 GET /api/dashboard/flow(见 FlowBoardService);链路排布与分级规则在
  @core/dashboard/flowSpec.js(纯数据,已单测)。所有文案走 tt(),词条在 i18n/locales/*.js。
-->
<template>
  <div class="flow-board">
    <!-- ① 当前卡点:按量降序,点一下直达面板 -->
    <section class="card fb-blocks" :class="{ empty: !blocks.length }">
      <div class="fb-head">
        <span class="fb-title">{{ tt('当前卡点') }}</span>
        <span v-if="at" class="fb-at">{{ tt('数据时间') }} {{ at }}</span>
      </div>
      <div v-if="!blocks.length" class="fb-calm">{{ tt('各节点无积压:流程通畅') }}</div>
      <div v-else class="fb-chips">
        <button
          v-for="b in blocks"
          :key="b.key"
          type="button"
          class="fb-chip"
          :class="b.level === 'block' ? 'is-block' : 'is-warn'"
          :title="tt(b.hint)"
          @click="go(b.panelCode)"
        >
          <span class="fb-chip-dot" aria-hidden="true"></span>
          <span class="fb-chip-name">{{ tt(b.name) }}</span>
          <span class="fb-chip-val">{{ fmtNum(b.value) }}</span>
        </button>
      </div>
    </section>

    <!-- ② 两条链路的泳道图 -->
    <section v-for="chain in CHAINS" :key="chain.key" class="card fb-chain" :class="'tone-' + chain.tone">
      <div class="fb-head">
        <span class="fb-title">{{ tt(chain.name) }}</span>
        <span class="fb-intro">{{ tt(chain.intro) }}</span>
        <span class="fb-legend">
          <i v-for="lv in ['block', 'warn', 'ok', 'idle']" :key="lv" class="fb-lg" :class="'lv-' + lv">{{ tt(LEVEL_TEXT[lv]) }}</i>
        </span>
      </div>

      <div v-for="(lane, li) in chain.lanes" :key="lane.key" class="fb-lane">
        <div class="fb-lane-head">
          <span class="fb-lane-name">{{ tt(lane.name) }}</span>
          <span class="fb-lane-hint">{{ tt(lane.hint) }}</span>
        </div>
        <div class="fb-row">
          <template v-for="(node, ni) in lane.nodes" :key="node.key">
            <span v-if="ni" class="fb-arrow" aria-hidden="true">→</span>
            <button
              type="button"
              class="fb-node"
              :class="'lv-' + levelOf(node, data)"
              :title="tt(node.note)"
              @click="go(node.route, node.code)"
            >
              <span class="fb-node-rail" aria-hidden="true"></span>
              <span class="fb-node-top">
                <span class="fb-node-name">{{ tt(node.name) }}</span>
                <span class="fb-node-code">{{ node.code }}</span>
              </span>
              <span class="fb-node-main">
                <span class="fb-node-num">{{ metricsOf(node, data).main.text }}</span>
                <span class="fb-node-label">{{ tt(metricsOf(node, data).main.label) }}</span>
              </span>
              <span class="fb-node-subs">
                <span v-for="s in metricsOf(node, data).subs" :key="s.label" class="fb-sub">
                  <em>{{ tt(s.label) }}</em><b>{{ s.text }}</b>
                </span>
              </span>
            </button>
          </template>
        </div>
        <div v-if="li < chain.lanes.length - 1" class="fb-down" aria-hidden="true">
          <span class="fb-down-line"></span>
          <span class="fb-down-tag">{{ tt(downTag(chain.key, li)) }}</span>
        </div>
      </div>
    </section>

    <p class="fb-foot">
      {{ tt('看板口径:节点数字为该面板当前在办量(草稿/待审/在制),点卡片进入面板;红=阻断、橙=积压、绿=通畅、灰=无在办。') }}
    </p>
  </div>
</template>

<script setup>
import { CHAINS, LEVEL_TEXT, fmtNum, levelOf, metricsOf } from '@core/dashboard/flowSpec'
import { tt } from '@/i18n'

const props = defineProps({
  data: { type: Object, default: null },
  blocks: { type: Array, default: () => [] },
  at: { type: String, default: '' },
})
const emit = defineEmits(['open'])

/** 泳道之间的流转说明(设计图上的箭头文字) */
const DOWN_TAGS = {
  prod: ['转领料单 / 排产', '报工审核通过', '检验合格 → 入库'],
  stock: ['来料检验分流', '合格 / 不合格分流'],
}
function downTag(chainKey, li) {
  return (DOWN_TAGS[chainKey] || [])[li] || '↓'
}

/** 卡片点击:交给宿主页统一 router.push(与桌面其它卡片同一跳转口径) */
function go(path, panelCode) {
  emit('open', typeof path === 'string' && path.startsWith('/') ? path : `/panelx/list/${panelCode || path}`)
}
</script>

<style scoped>
.flow-board { display: flex; flex-direction: column; gap: 12px; }

.fb-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.fb-title { font-size: 15px; font-weight: 600; color: #1f2d3d; }
.fb-intro, .fb-at { font-size: 12px; color: #909399; }
.fb-legend { margin-left: auto; display: flex; gap: 10px; }
.fb-lg { font-size: 11px; font-style: normal; color: #909399; }
.fb-lg::before { content: '●'; margin-right: 3px; }
.fb-lg.lv-block::before { color: #f56c6c; }
.fb-lg.lv-warn::before { color: #e6a23c; }
.fb-lg.lv-ok::before { color: #67c23a; }
.fb-lg.lv-idle::before { color: #c0c4cc; }

/* 卡点条 */
.fb-blocks { padding: 12px 14px; }
.fb-blocks.empty { background: #f6fbf7; }
.fb-calm { margin-top: 8px; font-size: 13px; color: #529b2e; }
.fb-chips { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
.fb-chip {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  padding: 6px 10px; border-radius: 14px; font-size: 13px;
  border: 1px solid #e3e8ef; background: #fff; color: #303133;
  transition: border-color .15s, box-shadow .15s;
}
.fb-chip:hover { border-color: #409eff; box-shadow: 0 1px 6px rgba(64, 158, 255, .18); }
.fb-chip.is-block { border-color: #fbc4c4; background: #fef4f4; }
.fb-chip.is-warn { border-color: #f5dab1; background: #fffaf1; }
.fb-chip-dot { width: 8px; height: 8px; border-radius: 50%; background: #e6a23c; }
.fb-chip.is-block .fb-chip-dot { background: #f56c6c; }
.fb-chip-val { font-weight: 700; font-variant-numeric: tabular-nums; }

/* 泳道 */
.fb-chain { padding: 12px 14px 14px; }
.tone-prod { border-top: 2px solid #d9e7ff; }
.tone-stock { border-top: 2px solid #d8f0e4; }
.fb-lane { margin-top: 12px; }
.fb-lane-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.fb-lane-name { font-size: 13px; font-weight: 600; color: #48566b; }
.fb-lane-hint { font-size: 12px; color: #a3aab6; }
.fb-row { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; }
.fb-arrow { align-self: center; color: #b9c2cf; font-size: 14px; }

/* 节点卡:左侧状态色条 + 主数字 */
.fb-node {
  position: relative; text-align: left; cursor: pointer;
  flex: 1 1 178px; min-width: 168px; max-width: 260px;
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px 8px 14px; border-radius: 6px;
  border: 1px solid #e3e8ef; background: #fff;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.fb-node:hover { border-color: #409eff; box-shadow: 0 2px 10px rgba(64, 158, 255, .16); transform: translateY(-1px); }
.fb-node-rail { position: absolute; left: 6px; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: #d8dee8; }
.fb-node.lv-block .fb-node-rail { background: #f56c6c; }
.fb-node.lv-warn .fb-node-rail { background: #e6a23c; }
.fb-node.lv-ok .fb-node-rail { background: #67c23a; }
.fb-node.lv-idle .fb-node-rail { background: #c0c4cc; }
.fb-node.lv-na { border-style: dashed; }
.fb-node-top { display: flex; align-items: baseline; gap: 6px; }
.fb-node-name { font-size: 13px; font-weight: 600; color: #1f2d3d; }
.fb-node-code { font-size: 10px; color: #a8b1bd; font-family: ui-monospace, Consolas, monospace; }
.fb-node-main { display: flex; align-items: baseline; gap: 6px; }
.fb-node-num { font-size: 22px; font-weight: 700; color: #1f2d3d; font-variant-numeric: tabular-nums; line-height: 1.1; }
.fb-node-label { font-size: 12px; color: #7a8494; }
.fb-node.lv-block .fb-node-num { color: #c45656; }
.fb-node.lv-warn .fb-node-num { color: #b88230; }
.fb-node-subs { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.fb-sub { font-size: 11px; color: #7a8494; }
.fb-sub em { font-style: normal; color: #a3aab6; margin-right: 3px; }
.fb-sub b { font-weight: 600; color: #48566b; font-variant-numeric: tabular-nums; }

/* 泳道之间的流转说明 */
.fb-down { display: flex; align-items: center; gap: 8px; margin: 8px 0 0 12px; }
.fb-down-line { width: 1px; height: 16px; background: #d7dde7; }
.fb-down-tag { font-size: 11px; color: #7a8494; background: #f4f7fb; border-radius: 10px; padding: 2px 8px; }

.fb-foot { margin: 2px 4px 6px; font-size: 12px; color: #a3aab6; line-height: 1.6; }

/* 窄屏:节点竖排,箭头转 90°(375 / 768 走查:不出现横向滚动) */
@media (max-width: 768px) {
  .fb-row { flex-direction: column; }
  .fb-node { max-width: none; flex: 1 1 auto; }
  .fb-arrow { transform: rotate(90deg); align-self: flex-start; margin-left: 14px; }
  .fb-legend { margin-left: 0; }
}
</style>
