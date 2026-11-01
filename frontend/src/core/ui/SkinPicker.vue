<template>
  <!-- 换肤（2026-10-30）—— 位置：界面设置对话框顶部。
       设计意图：让用户在 5 秒内看到"换一张纸"的效果并选定。
       先扫到的应该是**色卡本身**（不是名字）：每张卡就是那套皮肤的一张纸 ——
       画布底 + 左侧一条强调色 + 三行墨色灰条 + 一条分隔线。
       选中只用一条 1.5px 描边 + 一个小勾，不用整块高亮：这里是在挑纸，不是在挑按钮。 -->
  <div class="skin-picker">
    <div class="sp-head">
      <span class="sp-title">{{ tt('外观皮肤') }}</span>
      <el-radio-group :model-value="app.dark ? 'dark' : 'light'" size="small" @change="onScheme">
        <el-radio-button value="light">{{ tt('明色') }}</el-radio-button>
        <el-radio-button value="dark">{{ tt('暗色') }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="sp-grid" role="group" :aria-label="tt('外观皮肤')">
      <button
        v-for="s in SKINS"
        :key="s.id"
        type="button"
        class="sp-card"
        :class="{ 'is-on': s.id === app.skin }"
        :aria-pressed="s.id === app.skin"
        :style="s.id === app.skin ? { borderColor: s.accent } : null"
        @click="app.setSkin(s.id)"
      >
        <!-- 色卡：这套皮肤的"一张纸" -->
        <span class="sp-paper" :style="paperStyle(s)">
          <span class="sp-accent" :style="{ background: s.accent }"></span>
          <span class="sp-bars">
            <span class="sp-bar sp-bar-1"></span>
            <span class="sp-bar sp-bar-2"></span>
            <span class="sp-bar sp-bar-3"></span>
          </span>
          <span class="sp-rule"></span>
        </span>
        <span class="sp-name">{{ tt(s.name) }}</span>
        <span class="sp-desc">{{ tt(s.desc) }}</span>
        <span v-if="s.id === app.skin" class="sp-check" :style="{ color: s.accent }" aria-hidden="true">
          <el-icon><Select /></el-icon>
        </span>
      </button>
    </div>

    <div class="sp-hint">{{ tt('皮肤按浏览器记住，换一台电脑需要重新选。') }}</div>
  </div>
</template>

<script setup>
import { useAppStore } from '@/stores/app'
import { SKINS } from '@core/ui/skins.js'
import { tt } from '@/i18n'

const app = useAppStore()

/** 明/暗是同一个按钮组：它只是 `app.dark` 的另一个入口，复用既有开关，不新增状态 */
function onScheme(v) {
  const wantDark = v === 'dark'
  if (wantDark !== app.dark) app.toggleDark()
}

/** 色卡纸面：浅色取 canvas、深色取 canvasDark；两种纸面都用中性半透明画灰条，不复制墨色字面量 */
function paperStyle(s) {
  return { background: app.dark ? s.canvasDark : s.canvas }
}
</script>

<style scoped>
.skin-picker {
  padding-bottom: 14px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--t-border-light);
}
.sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.sp-title {
  font-size: 13px;
  color: var(--t-text-2);
}
.sp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: 10px;
}
.sp-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  min-height: 96px;
  border: 1px solid var(--t-border);
  border-radius: 8px;
  background: var(--t-card-bg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.sp-card:hover {
  background: var(--t-hover-bg);
}
.sp-card:focus-visible {
  outline: 2px solid var(--t-primary);
  outline-offset: 1px;
}
/* 纸面预览：只用一个 1px 内描边把它和卡片分开，不加阴影。
   灰条用 currentColor + 不同透明度 ⇒ 浅色纸上画深灰、深色纸上画浅灰，
   不需要为每套皮肤再复制一份墨色字面量（复制就会和 skins.css 漂移）。 */
.sp-paper {
  position: relative;
  display: block;
  height: 46px;
  border: 1px solid var(--t-border-light);
  border-radius: 4px;
  overflow: hidden;
  color: var(--t-text-1);
}
.sp-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}
.sp-bars {
  position: absolute;
  left: 12px;
  top: 9px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sp-bar {
  display: block;
  height: 3px;
  border-radius: 2px;
  background: currentColor;
}
.sp-bar-1 {
  width: 56%;
  opacity: 0.52;
}
.sp-bar-2 {
  width: 82%;
  opacity: 0.26;
}
.sp-bar-3 {
  width: 68%;
  opacity: 0.26;
}
.sp-rule {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 9px;
  height: 1px;
  background: currentColor;
  opacity: 0.16;
}
/* 灰条跟随当前主题的墨色（见上面 .sp-paper 的 color） */
.sp-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--t-text-1);
  letter-spacing: 0.2px;
}
.sp-desc {
  font-size: 11px;
  line-height: 1.5;
  color: var(--t-text-3);
}
.sp-check {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 11px;
  background: var(--t-card-bg);
  border-radius: 50%;
}
.sp-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--t-text-3);
}
</style>
