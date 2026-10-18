<!-- 待办任务 -->
<template>
  <el-tabs type="border-card" v-model="activeName" @tab-click="queryPage">
    <el-tab-pane label="待质检" name="1">
      <await ref="awaitContent"></await>
    </el-tab-pane>
    <el-tab-pane label="全部" name="2">
      <total ref="totalContent"></total>
    </el-tab-pane>
  </el-tabs>
</template>
<script lang="ts">
import Await from "./task/await.vue";
import total from "./task/total.vue";
// import { queryQiTaskPage } from "/@/api/quality/mission";

export default {
  components: { total, Await },
  name: "mission"
};
</script>
<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
const activeName = ref("1");
const awaitContent = ref();
const totalContent = ref();
const queryPage = () => {
  if (activeName.value == "1") {
    awaitContent.value.queryUser();
  } else {
    totalContent.value.searchEvent();
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
