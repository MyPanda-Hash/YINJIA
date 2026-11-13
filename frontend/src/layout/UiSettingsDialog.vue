<template>
  <el-dialog :model-value="modelValue" :title="tt('界面设置')" width="480px" append-to-body @update:model-value="(v) => $emit('update:modelValue', v)">
    <div class="ui-setting">
      <!-- 换肤（2026-10-30）：外观排在最上面 —— 打开这一页的人十次有九次是来改外观的。 -->
      <SkinPicker />
      <div class="set-row">
        <div class="set-label">{{ tt('菜单模式') }}</div>
        <el-radio-group v-model="mode" @change="(v) => app.setMenuMode(v)">
          <el-radio-button value="accordion">{{ tt('手风琴') }}</el-radio-button>
          <el-radio-button value="flat">{{ tt('平铺') }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="set-row">
        <div class="set-label">{{ tt('侧边栏默认折叠') }}</div>
        <el-switch :model-value="app.collapsed" @change="app.toggleCollapse()" />
      </div>
      <!-- 字段视图(2026-11-13):两层=系统整体 → 角色。切换后所有面板都按所选视图显示。 -->
      <div class="set-row">
        <div class="set-label">{{ tt('字段视图') }}</div>
        <el-radio-group v-model="fieldScope" @change="(v) => app.setFieldScope(v)">
          <el-radio-button value="role">{{ tt('本角色定制') }}</el-radio-button>
          <el-radio-button value="system">{{ tt('系统整体') }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="set-hint">{{ tt('「本角色定制」由本角色任一账号在「表格调整 / 表头调整」里设置，对本角色所有账号生效；「系统整体」只看未定制时的样子。') }}</div>
      <div class="set-hint">{{ tt('设置实时生效并保存到本机浏览器。') }}</div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { tt } from '@/i18n'
import SkinPicker from '@core/ui/SkinPicker.vue'

defineProps({ modelValue: Boolean })
defineEmits(['update:modelValue'])

const app = useAppStore()
const mode = ref(app.menuMode)
const fieldScope = ref(app.fieldScope)

watch(
  () => app.menuMode,
  (v) => { mode.value = v }
)
watch(
  () => app.fieldScope,
  (v) => { fieldScope.value = v }
)
</script>

<style scoped>
.set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--t-border-light);
}
.set-label {
  font-size: 13px;
  color: var(--t-text-2);
}
.set-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--t-text-3);
}
</style>
