<template>
  <div class="stm" v-loading="busy">
    <div class="stm-tip">
      {{ tt('每个模版就是一张表的结构：几列、列名叫什么、哪些列合并成一个分格。存进标准库后，单据上的「测试项目」下拉就能选到它 —— 加一种测试项目 = 新增一个模版，不用找开发。') }}
    </div>

    <div class="stm-bar">
      <el-button size="small" type="primary" @click="createTemplate">＋ {{ tt('新增模版') }}</el-button>
      <span class="stm-count">{{ tt('共') }} {{ rows.length }} {{ tt('个模版') }}</span>
    </div>

    <el-table :data="rows" size="small" border max-height="380" row-key="id">
      <el-table-column :label="tt('模版（= 测试项目）')" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'stm-off-text': !isOn(row) }">{{ row.item }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('列数')" width="72" align="right">
        <template #default="{ row }">
          <span v-if="row.summary.ok">{{ row.summary.count }}</span>
          <span v-else class="stm-undesigned">{{ tt('未设计') }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('分格')" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.summary.groups.length ? row.summary.groups.join(' / ') : '—' }}</template>
      </el-table-column>
      <el-table-column :label="tt('状态')" width="78" align="center">
        <template #default="{ row }">
          <span :class="isOn(row) ? 'stm-on' : 'stm-off'">{{ isOn(row) ? tt('已启用') : tt('已停用') }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('操作')" width="216" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" plain @click="design(row)">{{ tt('设计') }}</el-button>
          <el-button size="small" @click="switchEnabled(row)">{{ isOn(row) ? tt('停用') : tt('恢复启用') }}</el-button>
          <el-button size="small" type="danger" plain :title="tt('彻底删除这个模版')" @click="destroy(row)">×</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <span class="stm-empty">{{ busy ? tt('加载中…') : tt('暂无模版，点「新增模版」为一种测试项目设计一张表') }}</span>
      </template>
    </el-table>

    <div class="stm-hint">
      {{ tt('「停用」只是把它从「测试项目」下拉里收起来；「×」是彻底删除条目。两者都不动已录入单据里的数据。') }}
    </div>

    <StdLibLayoutEditor ref="editorRef" :lib="lib" :panel-code="panelCode" @saved="onSaved" />
  </div>
</template>

<script setup>
/**
 * StdLibTemplateManager.vue —— 加标水「标准库」里的**表格模版**列表（2026-11-06）
 *
 * 【用户口径】「在标准库里面加上一个可以编辑模版的功能，现在的不行……因为有很多种项目需要很多种表格，
 *   但是又不能一个一个写进去，只能是让客户自己能够操作去编辑模版」
 *
 * 【为什么单独一个组件，而不是继续用 StdLibManager】
 *   StdLibManager 把条目正文当**纯文本**原样往返（对章节库/检验项目库是对的），
 *   而加标水的条目正文是表格结构 JSON —— 给用户看一坨 JSON 就是"不会操作"（用户上一轮的原话）。
 *   这里改成一张模版清单：名称 / 列数 / 分格 / 状态，动作只有「设计 / 停用 / 彻底删除」。
 *
 * 【一个模版 = 一个标准库条目 = 单据「测试项目」下拉的一项】
 *   条目名(item_code) = 下拉里显示的名字；正文(content) = 列结构（见 core/panel/spikeWaterTemplate.js）。
 *   新增/改名都不碰代码，也不发版。
 */
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@/core/request'
import { summarizeTemplate } from '@/core/panel/spikeWaterTemplate.js'
import StdLibLayoutEditor from './StdLibLayoutEditor.vue'

const props = defineProps({
  /** 标准库编码（lab.test_item） */
  lib: { type: String, required: true },
  /** 面板码：新建自定义列要按它登记动态字段 */
  panelCode: { type: String, default: 'RD_SPIKE_WATER' },
})
const emit = defineEmits(['changed', 'saved'])

const rows = ref([])
const busy = ref(false)
const editorRef = ref(null)

const isOn = (r) => Number(r.enabled) !== 0

async function load() {
  if (!props.lib) return
  busy.value = true
  try {
    // all=1：维护界面要看见已停用的模版并允许恢复（业务下拉只取 enabled=1）
    const res = await request.get('/stdlib/list', { params: { lib: props.lib, all: 1 } })
    if (res && res.code != null && res.code !== 200) throw new Error(res.message || tt('加载失败'))
    rows.value = (res?.data || []).map((r) => ({
      id: r.id,
      item: r.item,
      enabled: r.enabled,
      content: r.content,
      summary: summarizeTemplate(r.content),
    }))
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载失败'))
  } finally {
    busy.value = false
  }
}
watch(() => props.lib, () => load(), { immediate: true })
defineExpose({ load })

/** 新增模版：先问名字（= 下拉里显示的名字），再打开设计器；保存时才真正入库 */
async function createTemplate() {
  let value = ''
  try {
    const r = await ElMessageBox.prompt(
      tt('模版名称就是单据「测试项目」下拉里显示的名字，例如「NSF 53-除铅（PH8.5）」。'),
      tt('新增模版'),
      {
        confirmButtonText: tt('创建并设计'),
        cancelButtonText: tt('取消'),
        inputPlaceholder: tt('模版名称（≤60 字）'),
        inputValidator: (v) => {
          const name = String(v || '').trim()
          if (!name) return tt('模版名称不能为空')
          if (name.length > 60) return tt('模版名称过长（≤60 字）')
          if (rows.value.some((x) => String(x.item || '').trim() === name)) return tt('这个名称已经有模版了')
          return true
        },
      },
    )
    value = String(r?.value || '').trim()
  } catch {
    return // 用户取消
  }
  editorRef.value?.openCreate(value)
}

function design(row) {
  editorRef.value?.openEdit(row)
}

/** 设计器保存完：刷新清单，并让单据侧重拉配置（新模版要立刻出现在「测试项目」下拉里） */
async function onSaved(payload) {
  await load()
  emit('changed')
  emit('saved', payload)
}

async function switchEnabled(row) {
  const on = isOn(row)
  try {
    const res = await request.post(on ? '/stdlib/remove' : '/stdlib/enable', { id: row.id })
    if (res && res.code != null && res.code !== 200) throw new Error(res.message || tt('操作失败'))
    ElMessage.success(on ? tt('已停用该条目') : tt('已恢复启用'))
    await load()
    emit('changed')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('操作失败'))
  }
}

async function destroy(row) {
  try {
    await ElMessageBox.confirm(
      tt('彻底删除模版「') + row.item + tt('」？删除后「测试项目」下拉不再有它；已录入单据里的数据不受影响。'),
      tt('删除模版'),
      { type: 'warning', confirmButtonText: tt('删除'), cancelButtonText: tt('取消') },
    )
  } catch {
    return
  }
  try {
    const res = await request.post('/stdlib/destroy', { id: row.id })
    if (res && res.code != null && res.code !== 200) throw new Error(res.message || tt('删除失败'))
    ElMessage.success(tt('已删除'))
    await load()
    emit('changed')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('删除失败'))
  }
}
</script>

<style scoped>
.stm { min-height: 120px; }
.stm-tip { font-size: 12px; color: #606266; line-height: 1.6; margin-bottom: 10px; }
.stm-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.stm-count { font-size: 12px; color: #909399; font-variant-numeric: tabular-nums; }
.stm-on { color: #16a34a; font-size: 12px; }
.stm-off { color: #a8b6c4; font-size: 12px; }
.stm-off-text { color: #a8b6c4; text-decoration: line-through; }
.stm-undesigned { font-size: 12px; color: #c08a00; }
.stm-empty { font-size: 12px; color: #909399; }
.stm-hint { margin-top: 8px; font-size: 12px; color: #909399; line-height: 1.6; }
</style>
