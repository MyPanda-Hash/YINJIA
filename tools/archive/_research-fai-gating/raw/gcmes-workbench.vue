<!-- 质检任务 -->
<template>
  <el-tabs type="border-card" v-model="activeName" @tab-click="queryPage">
    <el-tab-pane label="待分配" name="1">
      <wait ref="waitContent"></wait>
    </el-tab-pane>
    <el-tab-pane label="全部" name="2">
      <all ref="allContent"></all>
    </el-tab-pane>
  </el-tabs>
</template>
<script lang="ts">
import all from "./module/all.vue";
import wait from "./module/wait.vue";
export default {
  components: { all, wait },
  name: "workbench"
};
</script>
<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
const activeName = ref("1");
const waitContent = ref();
const allContent = ref();
const queryPage = () => {
  if (activeName.value == "1") {
    waitContent.value.searchEvent();
  } else {
    allContent.value.searchEvent();
  }
};
// mounted
onMounted(() => {
  nextTick(() => {
    queryPage();
  });
});
</script>

<style>
.mytable-style .vxe-body--column.col-blue {
  background-color: #60b8ff;
  color: #fff;
}
.mytable-style .vxe-body--column.col-orange {
  background-color: #f56c6c;
  color: #fff;
}
</style>
<style lang="scss" scoped>
.vxe-input + .vxe-button,
.vxe-input + .vxe-button--dropdown,
.vxe-button + .vxe-button,
.vxe-button + .vxe-button--dropdown {
  margin-left: 0;
}

.vxe-toolbar.size--medium {
  padding: 10px;
}

.vxe-table--render-default.size--medium {
  margin-top: 12px;
}

.vxe-button.size--medium.type--button {
  margin-left: 1em;
  height: 32px;
}

.text-model {
  &:hover {
    cursor: pointer;
  }
}
</style>
