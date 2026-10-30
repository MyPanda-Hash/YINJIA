<!--
  MoldProcPanel.vue —— 「烧结工艺清单」总面板（双模板无极切换）  2026-10-30

  【用户口径·原话】
    「太宽了，应该是和之前的烧结工艺清单一样，把这个x烧结面板放到烧结面板里面去，
      就是做成一个双面板设计的一个总面板，因为一个产品信息表分发下来可以只填一个面板，
      或者填写两个面板都要填，做成一个无极切换的界面，最外的导航栏还是成型工艺清单，
      但是里面是两个不同的操作的面板的」

  【为什么是「一个入口 + 两个面板」而不是一张单两个页签】
    两个模板绑定**不同的表**（RD_MOLD_PROC → rd_mold_proc_*，RD_X_SINTER → rd_x_sinter_*），
    各自有自己的单号、审批、作废、修订记录；产品可以只填其中一个，也可以两个都填。
    所以是**两个独立面板**，只是在 UI 上共用一个导航入口与一个 Tab 切换条。

  【地址与刷新的一致性】
    切换 Tab 时 `router.replace('/panelx/list/<码>')`（不是 push：不要在浏览器历史里
    堆一串切换记录，返回键应该回到进这个页之前的页面）。
    两条静态路由都指向本组件（且必须排在 `panelx/list/:panelCode` 参数路由之前），
    于是：地址里始终是当前 Tab 的面板码 ⇒ 刷新/收藏/分享都能落在同一个 Tab 上。

  【为什么不给两个 PanelxList 做 keep-alive】
    切换时面板码变了就要重新取元数据与列表（两张单本来就是两套数据），
    缓存反而会出现"切回来还显示上一张单"的错觉。故 `:key="cur"` 强制重建。

  【⚠ 不要把 panelCode 写死成本组件内部 state 而不同步地址】
    同一份组件实例在两条路由间复用（Vue Router 对同组件的不同 path 默认复用实例），
    必须 watch props 才能让"从别处跳到 RD_X_SINTER"也切到正确的 Tab。
-->
<template>
  <div class="mp-wrap">
    <div class="mp-bar">
      <div class="mp-tabs" role="tablist">
        <button
          v-for="t in TABS"
          :key="t.code"
          type="button"
          role="tab"
          :aria-selected="cur === t.code"
          class="mp-tab"
          :class="{ on: cur === t.code }"
          @click="pick(t.code)"
        >{{ tt(t.title) }}</button>
      </div>
      <span class="mp-hint">{{ tt('同一产品可只填一个模板，也可两个都填') }}</span>
    </div>
    <PanelxList :key="cur" :panelCode="cur" />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PanelxList from '@core/views/PanelxList.vue'
import { tt } from '@/i18n'

const props = defineProps({ panelCode: { type: String, default: '' } })

/** 两个模板：顺序即 Tab 顺序 —— 烧结在前（既有面板），X烧结在后（新模板）。 */
const TABS = Object.freeze([
  { code: 'RD_MOLD_PROC', title: '烧结工艺清单' },
  { code: 'RD_X_SINTER', title: 'X烧结工艺清单' },
])

const route = useRoute()
const router = useRouter()

const cur = computed(() => {
  const c = props.panelCode || route.params.panelCode || ''
  return TABS.some((t) => t.code === c) ? c : TABS[0].code
})

function pick(code) {
  if (code === cur.value) return
  router.replace('/panelx/list/' + code)
}

// 同一实例跨两条路由复用 ⇒ props 变了要同步（不必自己改 cur，cur 是 computed）
watch(() => props.panelCode, () => {})
</script>

<style scoped>
.mp-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.mp-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  background: var(--el-bg-color, #fff);
  flex: 0 0 auto;
}
.mp-tabs { display: flex; gap: 6px; }
.mp-tab {
  border: 1px solid var(--el-border-color, #dcdfe6);
  background: var(--el-fill-color-blank, #fff);
  color: var(--el-text-color-regular, #606266);
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 14px;
  line-height: 1.2;
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s;
}
.mp-tab:hover { border-color: var(--el-color-primary-light-5, #a0cfff); color: var(--el-color-primary, #409eff); }
.mp-tab.on {
  background: var(--el-color-primary, #409eff);
  border-color: var(--el-color-primary, #409eff);
  color: #fff;
  font-weight: 600;
}
.mp-hint { font-size: 12px; color: var(--el-text-color-secondary, #909399); margin-left: auto; }
@media (max-width: 768px) {
  .mp-bar { flex-wrap: wrap; }
  .mp-hint { margin-left: 0; }
}
</style>
