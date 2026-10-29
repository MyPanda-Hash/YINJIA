<!--
  procFlowCardEditor.vue — 流程卡卡面(2026-10-29,工序流程追踪卡)

  【口径】docs/design/工序流程追踪卡-V1.0.md §5「页签①录入 → 右侧卡编辑区」:
    卡头信息 + 每道工序卡片(工序名/计划数量/已报工/待审核/状态徽标/完成时间/报工人
    + 照片墙 + 上传/删除照片)+ 卡备注 + 保存/确认完成。

  【一处实现三处复用】页签①(可编辑)、页签②行点击的详情抽屉(只读)、
    以后若要做打印预览也只改这里 —— 所以「可编辑/可确认」都走 props,组件本身不查权限。

  【完成情况是后端现算的】工序行里的 已报工/待审核/状态/完成时间/报工人 全部来自 /detail
    (契约 §1.4「只读现算,不落冗余完成量」)—— 本组件**不自己算**完成量,只画进度条百分比。
-->
<template>
  <div class="pfe">
    <!-- 卡头 -->
    <div class="pfe-head">
      <div class="pfe-head-main">
        <div class="pfe-no">
          <span class="pfe-cardno">{{ head.卡号 || '-' }}</span>
          <el-tag size="small" :type="cardStatusType(head.卡状态)">{{ tt(head.卡状态 || '录入中') }}</el-tag>
          <span v-if="head.照片数" class="pfe-photos">{{ tt('照片') }} {{ head.照片数 }}</span>
        </div>
        <div class="pfe-product">{{ head.产品编码 }} · {{ head.产品名称 }} · {{ head.规格型号 }}</div>
      </div>
    </div>

    <div class="pfe-kv">
      <div><span>{{ tt('大批次号') }}</span><b>{{ head.大批次号 || '-' }}</b></div>
      <div><span>{{ tt('小批次号') }}</span><b>{{ head.小批次号 || '-' }}</b></div>
      <div><span>{{ tt('工单号') }}</span><b>{{ head.工单号 || '-' }}<template v-if="head.工单行号 != null"> #{{ head.工单行号 }}</template></b></div>
      <div><span>{{ tt('产品编码') }}</span><b>{{ head.产品编码 || '-' }}</b></div>
      <div><span>{{ tt('计划数量') }}</span><b class="num">{{ fmtNum(head.计划数量) }}</b></div>
      <div><span>{{ tt('生产线') }}</span><b>{{ head.生产线 || '-' }}</b></div>
      <div><span>{{ tt('工艺路线') }}</span><b>{{ head.工艺路线 || '-' }}</b></div>
      <div><span>{{ tt('确认人') }}</span><b>{{ head.确认人 || '-' }}</b></div>
      <div><span>{{ tt('确认时间') }}</span><b>{{ rmtTime(head.确认时间) }}</b></div>
    </div>

    <!-- 工序卡片流 -->
    <div class="pfe-ops">
      <div v-for="op in ops" :key="op.id ?? op.工序序" class="pfe-op">
        <div class="pfe-op-head">
          <b class="pfe-op-name">{{ op.工序序 }}. {{ tt(op.工序) }}</b>
          <span v-if="op.生产车间" class="pfe-op-shop">{{ op.生产车间 }}</span>
          <el-tag size="small" :type="statusTagType(op.状态)">{{ tt(op.状态 || '未开始') }}</el-tag>
          <span v-if="Number(op.报工单数) > 0" class="pfe-op-bills">{{ tt('报工单数') }} {{ fmtNum(op.报工单数) }}</span>
        </div>
        <div class="pfe-op-nums">
          <span>{{ tt('计划数量') }} <b>{{ fmtNum(op.计划数量) }}</b></span>
          <span>{{ tt('已报工') }} <b class="ok">{{ fmtNum(op.已报工) }}</b></span>
          <span>{{ tt('待审核') }} <b :class="{ warn: Number(op.待审核) > 0 }">{{ fmtNum(op.待审核) }}</b></span>
          <span>{{ tt('完成时间') }} <b>{{ rmtTime(op.完成时间) }}</b></span>
          <span>{{ tt('报工人') }} <b>{{ op.报工人 || '-' }}</b></span>
        </div>
        <div class="pfe-op-bar"><i :style="{ width: opPct(op) + '%' }"></i></div>
        <div v-if="op.备注" class="pfe-op-note">{{ tt('工序备注') }}:{{ op.备注 }}</div>
        <procFlowCardPhotos
          :photos="photosOf(detail.照片, op.工序序)"
          :seq="op.工序序"
          :card-no="head.卡号 || ''"
          :can-edit="editable"
          @changed="$emit('reload')"
        />
      </div>
      <!-- 台账为空 = 该工单行还没预排产(不是"固定三道");要说清下一步去哪,别只丢一句"没有数据" -->
      <div v-if="!ops.length" class="pfe-empty">
        <div>{{ tt('该工单行还没有工序台账') }}</div>
        <div class="pfe-empty-sub">{{ tt('请先到「快速排产」把该工单行排入产线:系统会按产品的工艺路线生成工序') }}</div>
      </div>
    </div>

    <!-- 卡备注 -->
    <div class="pfe-note">
      <span class="pfe-note-label">{{ tt('卡备注') }}</span>
      <span v-if="readonly" class="pfe-note-text">{{ head.备注 || '-' }}</span>
      <el-input
        v-else
        v-model="note"
        type="textarea"
        :rows="2"
        maxlength="800"
        show-word-limit
        :disabled="!editable"
        :placeholder="tt('记录本卡的补充说明,选填')"
      />
    </div>

    <!-- 动作条(手机 ≥40px) -->
    <div v-if="!readonly" class="pfe-foot">
      <el-button v-if="canEntry && !isDone" size="large" :loading="saving" :disabled="saving" @click="saveCard">
        {{ tt('保存') }}
      </el-button>
      <el-button
        v-if="canConfirm"
        size="large"
        type="success"
        :loading="saving"
        :disabled="saving || isDone || !head.可确认完成"
        @click="confirmDone"
      >
        {{ tt('确认完成') }}
      </el-button>
      <!-- 写错可回退「录入中」(契约 §1.5:仅确认人/管理员) ⇒ 这里只在已完成且持有 confirm 词时露出 -->
      <el-button v-if="canConfirm && isDone" size="large" plain :loading="saving" @click="backToEntry">
        {{ tt('退回录入中') }}
      </el-button>
      <span v-if="canConfirm && !isDone && !head.可确认完成" class="pfe-hint">
        {{ tt('全部工序已完工且每道工序至少有 1 张照片后才能确认完成') }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import procFlowCardPhotos from './procFlowCardPhotos.vue'
import {
  cardStatusType, errText, fmtNum, opPct, photosOf, procCardApi, rmtTime, statusTagType,
} from './procFlowCardApi'

const props = defineProps({
  /** /procCard/detail 的返回(契约 §3.5);空对象时显示空白卡面(理论上不会出现) */
  detail: { type: Object, default: () => ({}) },
  /** 有 entry 词:可保存备注 / 上传删除照片 */
  canEntry: { type: Boolean, default: false },
  /** 有 confirm 词:可确认完成 / 退回录入中 */
  canConfirm: { type: Boolean, default: false },
  /** 只读(页签②的详情抽屉):不显示动作条,照片墙只留预览 */
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['reload'])

const saving = ref(false)

const head = computed(() => props.detail?.头 || {})
const ops = computed(() => (Array.isArray(props.detail?.工序行) ? props.detail.工序行 : []))
const isDone = computed(() => head.value?.卡状态 === '已完成')
/** 能改备注/传照片 = 有 entry 词、不是只读抽屉、且卡还没确认完成(已完成要先「退回录入中」) */
const editable = computed(() => props.canEntry && !props.readonly && !isDone.value)

/** 卡备注草稿:每次 detail 刷新(上传照片后父级 reload)都以服务端值为准,避免草稿覆盖别人的修改 */
const note = ref('')
watch(() => props.detail, () => { note.value = String(head.value?.备注 ?? '') }, { immediate: true })

/**
 * 保存卡(只提交备注)。
 * ⚠ 不要顺手带上「卡状态」:后端 /procCard/save 对**带卡状态**的请求额外校验 confirm 词
 *   (状态变更才算确认动作)。只改备注的人可能只有 entry 词,带上状态会被 403 —— 状态变更一律走
 *   confirmDone()/backToEntry() 两个显式动作。
 */
async function saveCard() {
  if (!head.value?.卡号) return
  saving.value = true
  try {
    await procCardApi.save({ 卡号: head.value.卡号, 备注: note.value })
    ElMessage.success(tt('已保存'))
    emit('reload')
  } catch (e) {
    ElMessage.error(errText(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

/** 确认完成:服务端强校验「全部工序已完工 + 每道至少一张照片」,不满足回 400 ⇒ 把后端话原样给出 */
async function confirmDone() {
  if (!head.value?.卡号) return
  try {
    await ElMessageBox.confirm(
      `${tt('确认把这批次的流程卡标记为已完成？')}(${head.value.卡号})`,
      tt('确认完成'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    )
  } catch { return }
  saving.value = true
  try {
    await procCardApi.save({ 卡号: head.value.卡号, 备注: note.value, 卡状态: '已完成' })
    ElMessage.success(tt('流程卡已完成'))
    emit('reload')
  } catch (e) {
    ElMessage.error(errText(e, '确认完成失败'))
  } finally {
    saving.value = false
  }
}

/** 回退「录入中」(契约 §1.5:写错可回退;权限由后端再校验 confirm 词) */
async function backToEntry() {
  try {
    await ElMessageBox.confirm(tt('把这张流程卡退回「录入中」？'), tt('退回录入中'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
  } catch { return }
  saving.value = true
  try {
    await procCardApi.save({ 卡号: head.value.卡号, 备注: note.value, 卡状态: '录入中' })
    ElMessage.success(tt('已退回录入中'))
    emit('reload')
  } catch (e) {
    ElMessage.error(errText(e, '操作失败'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.pfe { display: flex; flex-direction: column; gap: 10px; }
.pfe-head { display: flex; align-items: flex-start; gap: 8px; }
.pfe-head-main { flex: 1; min-width: 0; }
.pfe-no { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pfe-cardno { font-size: 16px; font-weight: 600; word-break: break-all; }
.pfe-photos { font-size: 12px; color: var(--el-text-color-secondary); }
.pfe-product { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }

/* 卡头键值:窄屏 2 列、桌面 3 列(信息密度够、不横向滚动) */
.pfe-kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
}
@media (min-width: 900px) { .pfe-kv { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pfe-kv > div { display: flex; gap: 6px; min-width: 0; }
.pfe-kv span { flex: none; color: var(--el-text-color-secondary); }
.pfe-kv b { font-weight: 500; min-width: 0; word-break: break-all; }

.pfe-ops { display: flex; flex-direction: column; gap: 8px; }
.pfe-op {
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.pfe-op-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pfe-op-name { font-size: 14px; }
.pfe-op-shop { font-size: 11px; color: var(--el-text-color-secondary); }
.pfe-op-bills { margin-left: auto; font-size: 11px; color: var(--el-text-color-secondary); }
.pfe-op-nums {
  display: flex; flex-wrap: wrap; gap: 4px 14px;
  margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary);
}
.pfe-op-nums b { font-weight: 600; color: var(--el-text-color-primary); }
.pfe-op-nums b.ok { color: var(--el-color-success); }
.pfe-op-nums b.warn { color: var(--el-color-warning); }
.pfe-op-bar { height: 4px; margin: 6px 0 8px; border-radius: 2px; background: var(--el-fill-color); overflow: hidden; }
.pfe-op-bar > i { display: block; height: 100%; background: var(--el-color-success); }
.pfe-op-note { margin-bottom: 6px; font-size: 12px; color: var(--el-text-color-regular); }

.pfe-empty { padding: 24px 12px; text-align: center; border: 1px dashed var(--el-border-color-lighter); border-radius: 8px; }
.pfe-empty-sub { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); }

.pfe-note { display: flex; flex-direction: column; gap: 6px; }
.pfe-note-label { font-size: 12px; color: var(--el-text-color-secondary); }
.pfe-note-text { font-size: 13px; word-break: break-all; }

.pfe-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
.pfe-foot :deep(.el-button) { margin-left: 0; min-height: 40px; }
.pfe-hint { font-size: 11px; color: var(--el-text-color-secondary); }
</style>
