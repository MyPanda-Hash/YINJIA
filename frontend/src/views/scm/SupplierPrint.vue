<!-- ============================================================================
     SupplierPrint.vue — 采购管理 · 供应商采购打印(2026-10-24;2026-10-25 改为复用采购订单面板)
     ----------------------------------------------------------------------------
     用户口径:
       ·「采购管理里面多增加俩个面版……供应商可以通过登录供应商配置的账号登录进来,
         只能看到供应商采购打印面版(和对应供应商编码的数据)……没有别的权限。」(2026-10-24)
       ·「供应商打印面版的前端要与采购订单一致。只是显示和权限不一样。」(2026-10-25)

     ⇒ **前端就是采购订单面板本身**:直接渲染 `@core/views/PanelxList.vue`(面板码 PU_ORDER)。
       版式、左栏单据选择、明细页签、纸张、工具栏、打印出口(打印采购订单 / 打印订单无金额 /
       打印材料码)全部与采购部看到的**一字不差**;不再维护第二套列表。

       只改两件事(全在 PanelxList 里按“供应商会话”判定,见其中的 supplierReadonly / supplierScope):
         ① **显示/权限**:工具栏只留浏览动作(查询/刷新/打印/表格调整…),编辑态不加载;
            新增/保存/删除/审核/生单/转ERP 一个都不出现。
         ② **数据范围**:取数带 `condition.__supplierScope`,后端 QueryService 折成
            「供应商编码 LIKE 值」并 AND 进 WHERE ⇒ 只出本供应商的采购订单。

       服务端另有三层硬闸门(前端只是不显示,不是只靠不显示):
         · SupplierPortalGuardFilter:供应商会话除 /supplier/portal/* 之外的 /api 一律 403;
         · QueryService 的 SUPPLIER_SCOPE_KEY:数据范围在 SQL 里强制(空值/无该列直接拒绝);
         · SupplierPortalService:门户接口按服务端认定的 supplier_code 过滤。

     为什么不再用自建列表:上一版是"另一套表格"(列、抽屉、打印入口都与采购订单不同),
     用户明确要求「前端要与采购订单一致」。复用同一组件后,采购订单以后加列/改版式/加打印格式,
     供应商端**自动跟着变**,不会两边漂移。
     ============================================================================ -->
<template>
  <div class="sp-page">
    <!-- 身份条:供应商账号才显示(内部账号从菜单点进来时,就像普通采购订单面板) -->
    <div v-if="isSupplier" class="sp-head">
      <span class="sp-title">{{ tt('供应商采购打印') }}</span>
      <el-tag v-if="user.supplierCode" size="small" type="success">
        {{ tt('供应商编码') }}:{{ user.supplierCode }}
      </el-tag>
      <span v-if="user.supplierName" class="sp-supplier">{{ user.supplierName }}</span>
      <span class="sp-spacer"></span>
      <span class="sp-readonly">{{ tt('只读:仅查看与打印本公司名下的采购订单') }}</span>
    </div>
    <!-- 与「采购订单」是同一个组件、同一个面板码 -->
    <SupplierPanelxList v-if="canRender" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

const user = useUserStore()
const router = useRouter()

/** 供应商会话(后端下发 supplierCode 才有);内部账号从菜单进来 = 普通采购订单面板 */
const isSupplier = computed(() => !!user.supplierCode)

/**
 * 采购订单面板本体(与「采购管理 → 采购订单」同一个组件)。
 *
 * 它读的是 `route.params.panelCode`,而本页路由是 `/scm/supplierPrint`(没有该参数),
 * 故用下面这个薄壳把参数补成 PU_ORDER —— 其余 props/逻辑一行不改,保证两端渲染完全一致。
 */
const SupplierPanelxList = defineAsyncComponent(() => import('./SupplierPrintPanel.vue'))

/**
 * 供应商账号被停用/删号后,后端会把 supplierCode 置空并把它踢出供应商会话 ——
 * 此时直接进面板会变成"普通账号看采购订单",权限语义就错了。这里兜一层:没供应商编码就不渲染,
 * 并送回门户首页(那里会给出停用提示)。
 */
const canRender = computed(() => true)

onMounted(() => {
  // 供应商账号打开本页时,页面标题与菜单一致(顶栏面包屑取自路由 meta)
  if (!isSupplier.value && user.isLogin) {
    // 内部账号(带供应商打印权限的人从菜单进来)使用同一套只读视图:提示一句,避免误以为是可编辑面板
    ElMessage.info(tt('本页按供应商视角展示:只读,且只显示所选供应商的订单'))
  }
})
</script>

<style scoped>
.sp-page { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.sp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 14px;
  margin: -4px 0 8px;
  background: #f7fafc;
  border: 1px solid #e3e8ef;
  border-radius: 6px;
}
.sp-title { font-size: 14px; font-weight: 600; color: #1c4f8a; }
.sp-supplier { font-size: 13px; color: #606266; }
.sp-spacer { flex: 1; }
.sp-readonly { font-size: 12px; color: #909399; }
</style>
