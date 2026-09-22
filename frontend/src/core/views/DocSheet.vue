<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       文件类文书面板(DocSheet):按 config 渲染《立项申请表》/《项目实施计划》等纸面版式
       config 见 docSheetConfigs.js:
       ① 顶部条:公司名(斜体)| 文档编号(可编辑)
       ② 标题行:大标题(左区居中)| 信息表(文件管理人/密级/文件使用范围)
       ③ 内容区:序号列(蓝底)+ 项目名(蓝底)+ 填写区(可写字数标识)+ 可选点状虚线装饰列
       ④ 底部签名:signCells(蓝格标签 + 值区)
       数据键全部为字段 label;保存/审批/导出复用引擎既有逻辑,本组件只负责呈现与置脏。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="approval-sheet">
    <!-- ⛔ 终止审批横幅(项目实施计划:申请终止(阶段处)二级审批 立项人→管理员→落实;打印隐藏) -->
    <div v-if="panelCode === 'RD_PLAN' && term" class="as-term-banner no-print-term" :class="'term-' + term.state">
      <template v-if="term.state === 'T'">
        <span class="atb-tag">{{ tt('已终止') }}</span>
        <span class="atb-txt">{{ tt('终止于阶段') }} {{ term.stage }} · {{ tt('落实于') }} {{ term.p2_at || '' }}（{{ term.p2_by || '' }}）</span>
      </template>
      <template v-else>
        <span class="atb-tag">{{ tt(term.state === 'P1' ? '终止审批中（立项人）' : '终止审批中（管理员）') }}</span>
        <span class="atb-txt">{{ tt('终止于阶段') }} {{ term.stage }} · {{ tt('发起人') }} {{ term.req_by || '' }}<template v-if="term.reason"> · {{ tt('原因') }}：{{ term.reason }}</template></span>
        <span v-if="canApproveTerm" class="atb-ops">
          <el-button type="danger" size="small" @click="doTermAction('终止审批通过')">{{ tt('终止审批通过') }}</el-button>
          <el-button size="small" @click="doTermAction('终止审批驳回')">{{ tt('终止审批驳回') }}</el-button>
        </span>
        <span v-else-if="canWithdrawTerm" class="atb-ops">
          <el-button size="small" @click="doTermAction('撤回终止申请')">{{ tt('撤回终止申请') }}</el-button>
        </span>
      </template>
    </div>
    <!-- ① 顶部条 -->
    <div class="as-topbar">
      <div class="as-company">惠州市银嘉环保科技有限公司</div>
      <!-- 右上角:配置为参照时(项目实施计划→立项申请右上角编号)点击弹参照;否则保持手填(默认 YJ-XS002 模板号) -->
      <div class="as-docno">
        <div v-if="editable && isRefKey('文档编号')" class="as-ref-ctl" :title="tt('点击选择')" @click="openProdRef('文档编号')">
          <span class="as-ref-text" :class="{ 'is-empty': !head['文档编号'] }">{{ head['文档编号'] || tt('文档编号：') }}</span>
          <el-icon class="as-ref-ico"><Search /></el-icon>
        </div>
        <el-input
          v-else-if="editable"
          v-model="head['文档编号']"
          size="small"
          maxlength="30"
          class="as-docno-input"
          :placeholder="tt('文档编号：')"
          @input="emit('dirty')"
        />
        <template v-else>{{ head['文档编号'] || head['单据编号'] || config.docno || 'YJ-XS002' }}</template>
      </div>
    </div>

    <!-- ② 标题行:大标题 + 右上信息表(config.info 未配置时保持 文件管理人/密级/文件使用范围 原样) -->
    <div class="as-title-row">
      <div class="as-title">{{ tt(config.titlePart1) }}<template v-if="config.titlePart2">（{{ tt(config.titlePart2) }}）</template><template v-if="config.titlePart3">{{ tt(config.titlePart3) }}</template></div>
      <div class="as-info-table">
        <div v-for="info in infoRows" :key="info.key || info.label" class="as-info-row">
          <span class="as-info-label">{{ tt(info.label) }}</span>
          <span class="as-info-value">
            <template v-if="info.kind === 'static'">{{ tt(info.text || '') }}</template>
            <div v-else-if="editable && isRefKey(info.key)" class="as-ref-ctl" :title="tt('点击选择')" @click="openProdRef(info.key)">
              <span class="as-ref-text">{{ head[info.key] || tt('点击选择') }}</span>
              <el-icon class="as-ref-ico"><Search /></el-icon>
            </div>
            <el-date-picker
              v-else-if="editable && info.kind === 'date'"
              v-model="head[info.key]"
              type="date"
              value-format="YYYY-MM-DD"
              size="small"
              class="as-date"
              :clearable="false"
              @change="emit('dirty')"
            />
            <el-select
              v-else-if="editable && (info.kind === 'select' || selectOptions(info.key).length)"
              v-model="head[info.key]"
              size="small"
              class="as-cell-input"
              :clearable="false"
              @change="emit('dirty')"
            >
              <el-option v-for="o in selectOptions(info.key)" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input
              v-else-if="editable"
              v-model="head[info.key]"
              size="small"
              maxlength="50"
              class="as-cell-input"
              @input="emit('dirty')"
            />
            <template v-else>{{ head[info.key] || '' }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- ③ 内容表 + 右侧备注列(立项申请表设计:F5「备注」标签 + F6:G15 合并填写区) -->
    <div class="as-body">
    <div class="as-table">
      <!-- 行型:网格(pairs)/章节(section)/部门会签(dept)/单字段/多子区/阶段框 -->
      <template v-for="(row, ri) in config.rows" :key="row.key || row.label">
        <!-- 网格行:一行多组 标签|值(品质单据表头区);cell.kind: input/date/select/ref/checks(单选,存选项值) -->
        <div v-if="row.kind === 'pairs'" class="as-row q-pairs" :style="{ minHeight: (row.h || 40) + 'px' }">
          <div v-for="(c, ci) in row.cells" :key="(c.key || c.label) + ci" class="q-pair" :style="{ flex: c.flex || 1 }">
            <div class="q-label" :style="{ width: (c.labelW || row.labelW || 110) + 'px' }">{{ tt(c.label) }}</div>
            <div class="q-value">
              <div v-if="c.kind === 'checks'" class="q-checks">
                <span
                  v-for="o in c.options" :key="o" class="q-check" :class="{ on: head[c.key] === o }"
                  @click="setCheck(c.key, o)"
                >{{ head[c.key] === o ? '☑' : '□' }} {{ tt(o) }}</span>
              </div>
              <div v-else-if="editable && isRefKey(c.key)" class="as-ref-ctl" :title="tt('点击选择')" @click="openProdRef(c.key)">
                <span class="as-ref-text">{{ head[c.key] || tt('点击选择') }}</span>
                <el-icon class="as-ref-ico"><Search /></el-icon>
              </div>
              <el-date-picker
                v-else-if="editable && c.kind === 'date'"
                v-model="head[c.key]" type="date" value-format="YYYY-MM-DD"
                size="small" class="as-date" :clearable="false" @change="emit('dirty')"
              />
              <el-select
                v-else-if="editable && c.kind === 'select'"
                v-model="head[c.key]" size="small" class="as-cell-input" :clearable="false" @change="emit('dirty')"
              >
                <el-option v-for="o in cellOptions(c)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input
                v-else-if="editable"
                v-model="head[c.key]" size="small" :maxlength="c.max || 200"
                class="as-cell-input" @input="emit('dirty')"
              />
              <div v-else class="q-ro">{{ head[c.key] || '' }}</div>
            </div>
          </div>
        </div>

        <!-- 章节行:标题 + 大填写区 / 勾选行 / 多子区 + 签名行(品质单据「一.问题描述」等) -->
        <div v-else-if="row.kind === 'section'" class="as-row q-section" :style="{ minHeight: (row.h || 120) + 'px' }">
          <div class="q-section-title">{{ tt(row.label) }}</div>
          <div class="q-section-body">
            <template v-if="row.subs">
              <div v-for="sub in row.subs" :key="sub.key" class="q-sub">
                <div class="q-sub-label">{{ tt(sub.label) }}<span v-if="sub.max" class="q-sub-max">（{{ sub.max }}{{ tt('字') }}）</span></div>
                <el-input
                  v-if="editable" v-model="head[sub.key]" type="textarea"
                  :rows="sub.rows || 2" :maxlength="sub.max || 1000"
                  class="as-fill-input as-fill-area" resize="none" @input="emit('dirty')"
                />
                <div v-else class="as-ro-text">{{ head[sub.key] || '' }}</div>
              </div>
            </template>
            <el-input
              v-else-if="editable && row.key && !row.checks" v-model="head[row.key]" type="textarea"
              :rows="row.rows || 3" :maxlength="row.max || 2000"
              class="as-fill-input as-fill-area" resize="none" @input="emit('dirty')"
            />
            <div v-else-if="row.key && !row.checks" class="as-ro-text">{{ head[row.key] || '' }}</div>
            <div v-if="row.checks" class="q-checks">
              <span
                v-for="o in row.checks" :key="o" class="q-check" :class="{ on: head[row.key] === o }"
                @click="setCheck(row.key, o)"
              >{{ head[row.key] === o ? '☑' : '□' }} {{ tt(o) }}</span>
            </div>
            <div v-if="row.sign" class="q-signline">
              <span class="q-sign-label">{{ tt(row.sign) }}：</span>
              <span class="q-sign-val">
                <el-input
                  v-if="editable" v-model="head[row.signKey || '填写人']" size="small"
                  maxlength="50" class="as-cell-input q-sign-input" @input="emit('dirty')"
                />
                <span v-else>{{ head[row.signKey || '填写人'] || '' }}</span>
              </span>
              <span class="q-sign-date">{{ tt('日期') }}：　　　　　{{ tt('年') }}　　{{ tt('月') }}　　{{ tt('日') }}</span>
            </div>
          </div>
        </div>

        <!-- 部门会签行:左部门名格 + 右意见区(子区可带 纸面勾选样式;同意/不同意由审批流留痕,勾选为装饰) -->
        <div v-else-if="row.kind === 'dept'" class="as-row q-dept" :style="{ minHeight: (row.h || 90) + 'px' }">
          <div class="q-dept-name">{{ tt(row.label) }}</div>
          <div class="q-dept-body">
            <div v-for="(sub, si) in row.subs" :key="sub.key" class="q-dept-sub" :class="{ first: si === 0 }">
              <div class="q-dept-sub-head">
                <span v-if="sub.label" class="q-dept-sub-label">{{ tt(sub.label) }}</span>
                <span v-if="sub.checks" class="q-checks deco">
                  <span v-for="o in sub.checks" :key="o" class="q-check">□ {{ tt(o) }}</span>
                </span>
                <span class="q-dept-sign">{{ tt('签名') }}：　　　　{{ tt('年') }}　　{{ tt('月') }}　　{{ tt('日') }}</span>
              </div>
              <el-input
                v-if="editable" v-model="head[sub.key]" type="textarea"
                :rows="sub.rows || 2" :maxlength="sub.max || 500"
                class="as-fill-input as-fill-area" resize="none" @input="emit('dirty')"
              />
              <div v-else class="as-ro-text">{{ head[sub.key] || '' }}</div>
            </div>
          </div>
        </div>

        <!-- 单字段行 / 多子区行 / 阶段框行(测试计划) -->
        <!-- minHeight 而非 height:行高按设计磅值给,但控件(文本域/下拉)不得被裁切 -->
        <div v-else-if="!row.subs && row.kind !== 'phases'" class="as-row" :style="{ minHeight: row.h + 'px' }">
          <div class="as-no">{{ row.num }}</div>
          <div class="as-name">{{ tt(row.label) }}</div>
          <div class="as-fill">
            <div v-if="row.hint" class="as-hint">{{ tt(row.hint) }}</div>
            <div class="as-fill-main">
              <el-input
                v-if="editable && !signLocked(row) && row.kind === 'input'"
                v-model="head[row.key]"
                type="text"
                :maxlength="row.max || 50"
                :style="{ height: (row.h - 14) + 'px' }"
                class="as-fill-input"
                @input="emit('dirty')"
              />
              <el-select
                v-else-if="editable && !signLocked(row) && row.kind === 'select'"
                v-model="head[row.key]"
                :style="{ height: (row.h - 14) + 'px' }"
                class="as-fill-input as-fill-select"
                :clearable="false"
                :placeholder="row.hint ? tt(row.hint) : tt('请选择')"
                @change="emit('dirty')"
              >
                <el-option v-for="o in (row.options || [])" :key="o.value" :label="tt(o.label)" :value="o.value" />
              </el-select>
              <el-input
                v-else-if="editable && !signLocked(row)"
                v-model="head[row.key]"
                type="textarea"
                :maxlength="row.max || 2000"
                class="as-fill-input as-fill-area"
                resize="none"
                @input="emit('dirty')"
              />
              <div v-else class="as-ro-text">{{ head[row.key] || '' }}</div>
            </div>
            <!-- 同一行右侧的第二字段:实施计划第 8 行 = 负责人 + 编制日期(设计 B15/C15/F15) -->
            <div v-if="row.second" class="as-second">
              <span class="as-second-label">{{ tt(row.second.label) }}：</span>
              <el-date-picker
                v-if="editable && !signLocked(row.second) && row.second.kind === 'date'"
                v-model="head[row.second.key]"
                type="date"
                value-format="YYYY-MM-DD"
                size="small"
                class="as-date as-second-input"
                :clearable="false"
                @change="emit('dirty')"
              />
              <el-input
                v-else-if="editable && !signLocked(row.second)"
                v-model="head[row.second.key]"
                size="small"
                maxlength="50"
                class="as-cell-input as-second-input"
                @input="emit('dirty')"
              />
              <span v-else class="as-ro-text">{{ head[row.second.key] || '' }}</span>
            </div>
          </div>
        </div>

        <!-- 多子区行:如 测试方案(条件/方法/标准) -->
        <div v-else-if="row.subs" class="as-row" :style="{ minHeight: row.h + 'px' }">
          <div class="as-no">{{ row.num }}</div>
          <div class="as-name">{{ tt(row.label) }}</div>
          <div class="as-fill as-fill-multi">
            <div v-for="(sub, si) in row.subs" :key="sub.key" class="as-sub" :class="{ first: si === 0 }">
              <div class="as-sub-label">{{ tt(sub.label) }}：{{ sub.max }}{{ tt('字') }}</div>
              <el-input
                v-if="editable"
                v-model="head[sub.key]"
                type="textarea"
                :maxlength="sub.max"
                rows="2"
                class="as-fill-input as-fill-area"
                resize="none"
                @input="emit('dirty')"
              />
              <div v-else class="as-ro-text">{{ head[sub.key] || '' }}</div>
            </div>
          </div>
        </div>

        <!-- 阶段框行:10个阶段框,每框5行(计划内容/计划开始/计划完成/实际完成/责任人),完成按钮在五行最下边 -->
        <div v-else class="as-row as-row-phases" :style="{ minHeight: (row.h || 200) + 'px' }">
          <div class="as-no">{{ row.num }}</div>
          <div class="as-name">{{ tt(row.label) }}</div>
          <div class="as-fill">
            <template v-for="(ph, pi) in row.phases" :key="ph.key">
              <div
                v-if="!phaseHidden[pi]"
                class="as-phase"
                :class="{ 'as-phase-done': head[ph.key + '_实际完成'] }"
                :data-filled="hasPhaseContent(head, ph.num) ? '1' : '0'"
              >
                <div class="as-phase-head">
                  <span class="as-phase-title">{{ tt('阶段') }}{{ ph.num }}</span>
                  <span v-if="head[ph.key + '_实际完成']" class="as-phase-badge">{{ tt('已完成') }}</span>
                  <span class="as-phase-toggle" @click.stop="phaseHidden[pi] = true">{{ tt('隐藏') }}</span>
                </div>
                <!-- 五行:每行 label + input -->
                <div class="as-phase-grid">
                  <div class="as-phase-row">
                    <span class="as-phase-row-label">{{ tt('计划内容') }}</span>
                    <div class="as-phase-row-value">
                      <el-input
                        v-if="editable"
                        v-model="head[ph.key + '_计划内容']"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 3 }"
                        :maxlength="ph.max || 500"
                        class="as-fill-input as-fill-area"
                        resize="none"
                        @input="emit('dirty')"
                      />
                      <span v-else class="as-phase-text">{{ head[ph.key + '_计划内容'] || '' }}</span>
                    </div>
                  </div>
                  <div class="as-phase-row">
                    <span class="as-phase-row-label">{{ tt('计划开始') }}</span>
                    <div class="as-phase-row-value">
                      <el-date-picker
                        v-if="editable"
                        v-model="head[ph.key + '_计划开始']"
                        type="date"
                        value-format="YYYY-MM-DD"
                        format="YYYY-MM-DD"
                        size="small"
                        class="as-phase-input as-phase-date"
                        placeholder="YYYY-MM-DD"
                        @change="onPhaseStart(ph.key, $event)"
                      />
                      <span v-else class="as-phase-text">{{ head[ph.key + '_计划开始'] || '' }}</span>
                    </div>
                  </div>
                  <div class="as-phase-row">
                    <span class="as-phase-row-label">{{ tt('计划完成') }}</span>
                    <div class="as-phase-row-value">
                      <el-date-picker
                        v-if="editable"
                        v-model="head[ph.key + '_计划完成']"
                        type="date"
                        value-format="YYYY-MM-DD"
                        format="YYYY-MM-DD"
                        size="small"
                        class="as-phase-input as-phase-date"
                        placeholder="YYYY-MM-DD"
                        @change="onPhaseDone(ph.key, $event)"
                      />
                      <span v-else class="as-phase-text">{{ head[ph.key + '_计划完成'] || '' }}</span>
                    </div>
                  </div>
                  <div class="as-phase-row">
                    <span class="as-phase-row-label">{{ tt('实际完成') }}</span>
                    <div class="as-phase-row-value">
                      <span class="as-phase-text as-phase-actual" :class="{ done: head[ph.key + '_实际完成'] }">{{ head[ph.key + '_实际完成'] || '—' }}</span>
                    </div>
                  </div>
                  <div class="as-phase-row">
                    <span class="as-phase-row-label">{{ tt('责任人') }}</span>
                    <div class="as-phase-row-value">
                      <el-input v-if="editable" v-model="head[ph.key + '_责任人']" size="small" class="as-phase-input" maxlength="50" @input="emit('dirty')" />
                      <span v-else class="as-phase-text">{{ head[ph.key + '_责任人'] || '' }}</span>
                    </div>
                  </div>
                </div>
                <!-- 完成按钮:五行最下边;附「申请终止」(阶段处终止,二级审批;无在途/已落实终止时可用) -->
                <div v-if="canStageComplete && head[ph.key + '_计划内容']" class="as-phase-footer">
                  <el-button v-if="!head[ph.key + '_实际完成']" type="success" size="small" :loading="stageLoading === ph.num" @click.stop="doStageComplete(ph.num)">
                    {{ tt('完成') }}
                  </el-button>
                  <el-button v-if="!term" type="danger" plain size="small" @click.stop="doTermRequest(ph.num)">
                    {{ tt('申请终止') }}
                  </el-button>
                </div>
              </div>
            </template>
            <div v-if="Object.values(phaseHidden).filter(Boolean).length" class="as-phase-restore" @click.stop="phaseHidden = {}">
              {{ tt('显示全部') }}（{{ row.phases.length }}）
            </div>
          </div>
        </div>
      </template>

      <!-- ④ 底部签名:signKind='plain'=纸面简单行(编制/审核/批准);默认=蓝格签名区 -->
      <div v-if="config.signKind === 'plain'" class="q-signrow">
        <div v-for="c in config.signCells" :key="c.key" class="q-signitem" :style="{ flex: c.flex || 1 }">
          <span class="q-signitem-label">{{ tt(c.label) }}：</span>
          <el-input
            v-if="editable" v-model="head[c.key]" size="small"
            maxlength="50" class="as-cell-input q-signitem-input" @input="emit('dirty')"
          />
          <span v-else class="q-signitem-val">{{ head[c.key] || '' }}</span>
        </div>
      </div>
      <div v-else class="as-sign-row">
        <div v-for="(c, ci) in config.signCells" :key="c.key" class="as-sign-pair" :style="{ flex: c.flex }">
          <div class="as-sign-cell" :class="{ 'white-shell': c.white }" :style="{ width: c.w + 'px' }">{{ tt(c.label) }}</div>
          <div class="as-sign-val">
            <el-input
              v-if="editable && c.type === 'text' && !signLocked(c)"
              v-model="head[c.key]"
              size="small"
              maxlength="50"
              class="as-cell-input"
              @input="emit('dirty')"
            />
            <el-date-picker
              v-else-if="editable && !signLocked(c)"
              v-model="head[c.key]"
              type="date"
              value-format="YYYY-MM-DD"
              size="small"
              class="as-date"
              :clearable="false"
              @change="emit('dirty')"
            />
            <template v-else>{{ head[c.key] || '' }}</template>
          </div>
        </div>
      </div>
    </div>
      <!-- 备注列(设计:立项申请表 F5「备注」标签 + F6:G15 合并填写区)
           2026-09-22 前这里是 deco 装饰虚线(只画不填),而 rd_approval.备注 列一直存在却没登记字段 -->
      <div v-if="config.remark" class="as-remark">
        <div class="as-remark-label">{{ tt(config.remark.label) }}</div>
        <el-input
          v-if="editable"
          v-model="head[config.remark.key]"
          type="textarea"
          :maxlength="config.remark.max || 2000"
          class="as-remark-input"
          resize="none"
          @input="emit('dirty')"
        />
        <div v-else class="as-ro-text as-remark-ro">{{ head[config.remark.key] || '' }}</div>
      </div>
    </div>
    <RefPickDialog v-model="prodRefVisible" :field="prodRefField" mode="header" @confirm="onProdRefConfirm" />
  </div>
</template>

<script setup>
import { computed, reactive, nextTick, ref, watch } from 'vue'
import { ElMessage, ElButton, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { Search } from '@element-plus/icons-vue'
import RefPickDialog from './RefPickDialog.vue'
import request from '@core/request'
import { usePanelRuntime } from '@core/panel-runtime'
import { chainNextStageStart, hasPhaseContent } from '@core/progress/stageProgress'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  config: { type: Object, required: true },
  /** 面板编码(阶段完成按钮的 API 目标) */
  panelCode: { type: String, default: '' },
  /** 单据是否已审核(阶段完成按钮仅在审核后可用) */
  audited: { type: Boolean, default: false },
  /** 当前用户(终止审批按钮显隐:一级=立项人姓名匹配,二级=管理员) */
  user: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['dirty', 'term-changed'])

const engine = usePanelRuntime()
const stageLoading = ref(0)

/** 阶段完成按钮可用:非编辑态 + 已审核 */
const canStageComplete = computed(() => !props.editable && props.audited && props.panelCode === 'RD_PLAN')

/** 阶段计划开始:归一空值(清空时 el-date-picker 给 null),别把 null 存进库 */
function onPhaseStart(phaseKey, v) {
  props.head[phaseKey + '_计划开始'] = v || ''
  emit('dirty')
}

/** 阶段计划完成:同上归一,并把下一阶段的「计划开始」接上次日(仅当其为空) */
function onPhaseDone(phaseKey, v) {
  props.head[phaseKey + '_计划完成'] = v || ''
  const n = Number(String(phaseKey).replace(/[^0-9]/g, ''))
  if (n) chainNextStageStart(props.head, n)
  emit('dirty')
}
async function doStageComplete(stageNum) {
  stageLoading.value = stageNum
  try {
    const no = props.head['单据编号'] || props.head['编号'] || ''
    const res = await engine.callButton({
      panelCode: props.panelCode,
      buttonName: '阶段完成',
      formData: { 编号: no, 阶段序号: String(stageNum) },
      buttonParam: {},
    })
    if (res?.['实际完成']) {
      props.head[`阶段${stageNum}_实际完成`] = res['实际完成']
      ElMessage.success(`阶段${stageNum} 已完成 (${res['实际完成']})`)
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || `阶段${stageNum} 完成失败`)
  } finally {
    stageLoading.value = 0
  }
}

// ── 申请终止(阶段处)二级审批:立项人 → 管理员 → 落实终止(2026-09-11) ──
// 状态源 GET /px/planTerm(yj_plan_term 一单一行);动作走 callButton;动作后刷新状态并通知父级重载单据状态。
const term = ref(null)
const docNoOf = () => props.head['单据编号'] || props.head['编号'] || ''
async function loadTerm() {
  if (props.panelCode !== 'RD_PLAN') { term.value = null; return }
  const no = docNoOf()
  if (!no) { term.value = null; return }
  try {
    const res = await request.get('/px/planTerm', { params: { code: no } })
    term.value = res?.data || null
  } catch { term.value = null }
}
watch(() => [props.panelCode, docNoOf()], () => loadTerm(), { immediate: true })

/** 一级审批权:当前用户姓名 = 立项人(严格口径,姓名匹配;管理员不代审);二级:管理员 */
const canApproveTerm = computed(() => {
  if (!term.value) return false
  if (term.value.state === 'P1') return !!props.user?.realName && props.user.realName === term.value.initiator
  if (term.value.state === 'P2') return !!props.user?.isAdmin
  return false
})
/** 撤回权:发起人本人或管理员(仅 P1/P2) */
const canWithdrawTerm = computed(() => {
  if (!term.value || term.value.state === 'T') return false
  return props.user?.isAdmin || (props.user?.userName && props.user.userName === term.value.req_by)
})

async function doTermRequest(stageNum) {
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt(
      `${tt('申请终止')}：${tt('终止于阶段')} ${stageNum}。${tt('终止原因（选填）')}：`,
      tt('申请终止'), { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), inputPlaceholder: tt('终止原因（选填）') })
    reason = value || ''
  } catch { return /* 取消 */ }
  try {
    const res = await engine.callButton({ panelCode: props.panelCode, buttonName: '申请终止',
      formData: { 编号: docNoOf(), 阶段序号: String(stageNum), 终止原因: reason }, buttonParam: {} })
    ElMessage.success(`${tt('已提交终止申请')}（${tt('阶段')} ${res?.['阶段'] || stageNum}）→ ${tt('待立项人审批')}`)
    await loadTerm()
    emit('term-changed')
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('提交终止申请失败'))
  }
}

async function doTermAction(buttonName) {
  if (buttonName === '终止审批驳回' || (buttonName === '终止审批通过' && term.value?.state === 'P2')) {
    try {
      const { value } = await ElMessageBox.prompt(
        buttonName === '终止审批通过' ? `${tt('审批意见（选填）')}：` : `${tt('驳回须填写意见')}：`,
        tt(buttonName), { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'),
          inputValidator: buttonName === '终止审批通过' ? undefined : (v) => (v && v.trim() ? true : tt('意见必填')) })
      var opinion = value || ''
    } catch { return /* 取消 */ }
    try {
      await engine.callButton({ panelCode: props.panelCode, buttonName,
        formData: { 编号: docNoOf(), 审批意见: opinion }, buttonParam: {} })
    } catch (e) { ElMessage.error(engine.errMsg(e) || tt('操作失败')); return }
  } else {
    try {
      await engine.callButton({ panelCode: props.panelCode, buttonName, formData: { 编号: docNoOf() }, buttonParam: {} })
    } catch (e) { ElMessage.error(engine.errMsg(e) || tt('操作失败')); return }
  }
  ElMessage.success(tt('操作成功'))
  await loadTerm()
  emit('term-changed')
}

// 阶段框显示状态(本地视图;导出/打印按当前实际显示渲染)
const phaseHidden = reactive({})

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
/** 字段级只读(元数据 editable=0 → readonly):文书锁定字段(申请立项人/负责人)按纯文本显示,不可改 */
function signLocked(c) {
  return !!(fieldMap.value.get(c.key) || {}).readonly
}

// 右上信息表:未配置 config.info 时保持 文件管理人/密级/文件使用范围 三行(立项申请/实施计划原样)
const DEFAULT_INFO = [
  { label: '文件管理人', key: '文件管理人' },
  { label: '密级', key: '密级' },
  { label: '文件使用范围', key: '文件使用范围' },
]
const infoRows = computed(() => props.config.info || DEFAULT_INFO)

function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// 网格行单元格下拉:配置 options 优先,其次字段字典
function cellOptions(c) {
  if (c.options && c.options.length) {
    return c.options.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
  }
  return selectOptions(c.key)
}

// 勾选(单选语义,存选项值);只读态仅展示,点击无效
function setCheck(key, o) {
  if (!props.editable || !key) return
  if (props.head[key] !== o) {
    props.head[key] = o
    emit('dirty')
  }
}

// ── 参照字段(文档编号 → 立项申请右上角编号):点击右上角弹参照,确认后按 refMap 带回(密级等) ──
function isRefKey(key) {
  if (!key) return false
  const f = fieldMap.value.get(key)
  return !!(f && f.refPanel)
}
const prodRefVisible = ref(false)
const prodRefKey = ref('')
const prodRefField = computed(() => fieldMap.value.get(prodRefKey.value) || null)
function openProdRef(key) {
  if (!props.editable || !isRefKey(key)) return
  prodRefKey.value = key
  prodRefVisible.value = true
}
function onProdRefConfirm(rows) {
  const f = prodRefField.value
  const source = rows?.[0]
  if (!f || !source) return
  const refField = f.refField || f.dataName
  props.head[prodRefKey.value] = source[refField] ?? ''
  for (const m of f.refMap || []) {
    if (m && source[m.from] !== undefined) props.head[m.to || m.from] = source[m.from]
  }
  prodRefVisible.value = false
  emit('dirty')
}

// ── 校验定位(供 PanelxList 保存校验调用):滚动到该字段行并琥珀闪烁 ──
function focusField(label) {
  if (!label) return false
  nextTick(() => {
    const root = document.querySelector('.approval-sheet')
    if (!root) return
    const el = [...root.querySelectorAll('.as-name, .as-info-label, .as-sub-label, .q-label, .q-section-title, .q-dept-name, .q-dept-sub-label')]
      .find((e) => (e.textContent || '').trim() === label)
    || [...root.querySelectorAll('.as-name, .as-info-label, .as-sub-label, .q-label, .q-section-title, .q-dept-name, .q-dept-sub-label')]
        .find((e) => (e.textContent || '').includes(label))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('field-blink')
      setTimeout(() => el.classList.remove('field-blink'), 3200)
    }
  })
  return true
}
defineExpose({ focusField })
</script>

<style scoped>
/* ═══ 纸张主体 ═══ */
.approval-sheet {
  width: 940px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 14px;
  color: #222;
}
.approval-sheet :deep(.as-cell-input) {
  width: 100%;
}
.approval-sheet :deep(.as-date) {
  width: 132px;
}
/* 输入控件去边框:保持原版表格线条(编辑/聚焦均无提示线) */
.approval-sheet :deep(.el-input__wrapper),
.approval-sheet :deep(.el-select__wrapper),
.approval-sheet :deep(.el-input__wrapper.is-focus),
.approval-sheet :deep(.el-select__wrapper.is-focused),
.approval-sheet :deep(.el-date-editor .el-input__wrapper),
.approval-sheet :deep(.el-date-editor .el-input__wrapper.is-focus),
.approval-sheet :deep(.el-textarea__inner) {
  box-shadow: none !important;
  border: none;
  background: transparent;
}
.approval-sheet :deep(.el-input__inner),
.approval-sheet :deep(.el-textarea__inner) {
  font-size: 14px;
  padding: 0;
}

/* ═══ 终止审批横幅(打印隐藏;红系=已终止,蓝系=审批中) ═══ */
.as-term-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border: 1px solid #f3c1c1;
  background: #fef2f2;
  border-radius: 4px;
  padding: 6px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}
.as-term-banner.term-P1,
.as-term-banner.term-P2 {
  border-color: #bcd2f5;
  background: #f0f6ff;
}
.atb-tag {
  font-weight: 600;
  color: #b91c1c;
  border: 1px solid #f3c1c1;
  border-radius: 3px;
  padding: 1px 8px;
  background: #fff;
}
.term-P1 .atb-tag,
.term-P2 .atb-tag {
  color: #0d5bd3;
  border-color: #bcd2f5;
}
.atb-txt { color: #555; }
.atb-ops { margin-left: auto; display: inline-flex; gap: 6px; }
@media print { .no-print-term { display: none !important; } }

/* ═══ ① 顶部条:公司名 | 文档编号 ═══ */
.as-topbar {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  height: 40px;
}
.as-company {
  flex: 1;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 12px 0;
}
.as-docno {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  color: #333;
  text-align: right;
  padding: 8px 14px 0;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}
.as-docno-input {
  width: 130px;
}
/* 参照单元格(文档编号 -> 立项申请右上角编号):拟态输入框,点击弹参照 */
.as-ref-ctl {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  width: 200px;
  min-height: 24px;
  padding: 0 4px;
  border: 1px dashed #b9c0c8;
  border-radius: 3px;
  cursor: pointer;
  background: #fafbfc;
  font-style: normal;
  font-weight: 400;
}
.as-ref-ctl:hover {
  border-color: var(--el-color-primary, #409eff);
  background: #f0f6ff;
}
.as-ref-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #333;
  text-align: right;
}
.as-ref-text.is-empty { color: #a8b6c4; }   /* 空值时的背景提示词,与 input placeholder 同观感 */
.as-ref-ico {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-color-primary, #409eff);
}
.as-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  padding: 0;
}

/* ═══ ② 标题行:大标题 + 信息表 ═══ */
.as-title-row {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  min-height: 84px;
}
.as-title {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 30px;
  font-weight: 600;
  color: #1f5fa8;
  letter-spacing: 3px;
}
.as-info-table {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  display: flex;
  flex-direction: column;
}
.as-info-row {
  display: flex;
  flex: 1;
}
.as-info-row + .as-info-row {
  border-top: 1px solid #c9c9c9;
}
.as-info-label {
  width: 100px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 13px;
  color: #1f5fa8;
}
.as-info-value {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 8px;
  border-left: 1px solid #c9c9c9;
  font-size: 13px;
}

/* ═══ ③ 内容表 ═══ */
.as-table {
  border-top: none;
}
.as-row {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
}
.as-no {
  width: 52px;
  flex: none;
  background: #29b8f0;
  color: #fff;
  font-size: 15px;
  display: flex;
  align-items: center;
  padding: 0 0 0 10px;
}
.as-name {
  width: 150px;
  flex: none;
  background: #29b8f0;
  color: #fff;
  font-size: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  text-align: center;
}
/* 校验定位闪烁:琥珀高亮约3秒(保存必填缺失时) */
@keyframes dsFieldBlink {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 0 3px rgba(250, 173, 20, 0.65); }
}
.field-blink {
  animation: dsFieldBlink 0.65s ease-in-out 5;
  outline: 2px solid #faad14;
  outline-offset: -1px;
}
.as-fill {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 3px 6px;
}
.as-hint {
  font-size: 14px;
  color: #333;
  line-height: 20px;
  padding-left: 2px;
}
.as-fill-input {
  flex: 1;
}
.as-fill-area :deep(.el-textarea__inner) {
  line-height: 1.7;
}
.as-ro-text {
  flex: 1;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  padding: 2px 4px;
}
/* 内容区左右分栏:左=表格(序号/项目名/填写区),右=可填备注列(设计 立项申请表 F5/F6:G15)
   备注列原先是 .as-deco 装饰虚线(只画不填),2026-09-22 改为真字段 */
.as-body {
  display: flex;
  align-items: stretch;
}
.as-body > .as-table {
  flex: 1;
  min-width: 0;
}
.as-remark {
  width: 250px;
  flex: none;
  border-left: 3px dotted #9a9a9a;
  display: flex;
  flex-direction: column;
  padding: 3px 6px;
}
.as-remark-label {
  flex: none;
  font-size: 15px;
  color: #333;
  padding: 2px 0 4px;
}
.as-remark-input {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.as-remark-input :deep(.el-textarea__inner) {
  height: 100%;
  line-height: 1.7;
}
.as-remark-ro {
  flex: 1;
}
/* 行内第二字段(实施计划第 8 行:负责人 + 编制日期):占行内右侧约 40% */
.as-second {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 40%;
  padding-top: 2px;
}
.as-second-label {
  flex: none;
  font-size: 13px;
  color: #333;
}
.as-second-input {
  flex: 1;
  min-width: 0;
}
/* 填写区主控件:文本域撑满行高(行高按设计磅值给,文本域随之变高) */
.as-fill-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.as-fill-main .as-fill-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.as-fill-main .as-fill-area :deep(.el-textarea__inner) {
  height: 100% !important;
}
/* 多子区行:如 测试方案(条件/方法/标准) */
.as-fill-multi {
  padding: 0 6px;
}
.as-sub {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 2px 4px;
}
.as-sub + .as-sub {
  border-top: 1px solid #c9c9c9;
}
.as-sub-label {
  font-size: 14px;
  color: #333;
  line-height: 20px;
}
/* 阶段框行(测试计划):每框独立边框;内部五行(标签+输入),完成按钮在五行最下边 */
.as-phase {
  border: 1px solid #c9c9c9;
  margin: 3px 0;
  padding: 2px 6px 4px;
}
.as-phase-done {
  border-color: #b7e4c7;
  background: #f0faf0;
}
.as-phase-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #333;
  padding: 1px 0;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 2px;
}
.as-phase-title { font-weight: 600; }
.as-phase-badge {
  background: #52c41a; color: #fff; font-size: 11px;
  padding: 1px 6px; border-radius: 3px; margin-right: 4px;
}
.as-phase-toggle {
  color: #0d5bd3; cursor: pointer; font-size: 12px;
  user-select: none; padding: 0 2px;
}
.as-phase-toggle:hover { text-decoration: underline; }
/* 五行网格 */
.as-phase-grid { display: flex; flex-direction: column; gap: 2px; }
.as-phase-row {
  display: flex; align-items: flex-start; gap: 6px;
  min-height: 26px;
}
.as-phase-row-label {
  width: 60px; flex-shrink: 0;
  font-size: 12px; color: #5a7a99; font-weight: 500;
  line-height: 24px; text-align: right;
}
.as-phase-row-value {
  flex: 1; min-width: 0;
  display: flex; align-items: center;
}
.as-phase-date { width: 100%; }
.as-phase-input { max-width: 160px; }
.as-phase-text {
  font-size: 12px; color: #444; line-height: 24px;
  word-break: break-all; white-space: pre-wrap;
}
.as-phase-actual { color: #ccc; }
.as-phase-actual.done { color: #52c41a; font-weight: 600; }
/* 完成按钮:五行最下边 */
.as-phase-footer {
  display: flex; justify-content: flex-end;
  padding-top: 3px; margin-top: 2px;
  border-top: 1px dashed #d9e6f2;
}
.as-phase-restore {
  margin: 3px 0;
  padding: 3px 6px;
  font-size: 12px;
  color: #0d5bd3;
  cursor: pointer;
  user-select: none;
  text-align: center;
}
.as-phase-restore:hover {
  text-decoration: underline;
}

/* ═══ 品质单据行型:网格/章节/部门会签/简洁签名 ═══ */
.q-pairs {
  display: flex;
}
.q-pair {
  display: flex;
  min-width: 0;
}
.q-pair + .q-pair {
  border-left: 1px solid #8a8a8a;
}
.q-label {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 8px;
  background: #eef7fd;
  color: #1f5fa8;
  font-size: 13px;
  border-right: 1px solid #c9c9c9;
  text-align: right;
  line-height: 1.4;
}
.q-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 3px 6px;
  min-height: 32px;
}
.q-value .as-ref-ctl {
  width: 100%;
}
.q-ro {
  flex: 1;
  line-height: 1.6;
  word-break: break-all;
  padding: 2px;
  font-size: 13px;
}
.q-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13.5px;
}
.q-check {
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  color: #333;
}
.q-check.on {
  color: #1f5fa8;
  font-weight: 600;
}
.q-checks.deco .q-check {
  cursor: default;
}

.q-section {
  display: block;
}
.q-section-title {
  padding: 6px 10px;
  font-size: 14.5px;
  font-weight: 600;
  color: #222;
  border-bottom: 1px solid #c9c9c9;
  background: #f7fbfe;
}
.q-section-body {
  display: flex;
  flex-direction: column;
  padding: 4px 8px 6px;
}
.q-sub {
  display: flex;
  flex-direction: column;
  padding: 2px;
}
.q-sub + .q-sub {
  border-top: 1px dashed #d5dde5;
}
.q-sub-label {
  font-size: 13.5px;
  color: #333;
  line-height: 22px;
}
.q-sub-max {
  color: #999;
  font-size: 12px;
}
.q-signline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 0;
  font-size: 13.5px;
}
.q-sign-label {
  color: #333;
}
.q-sign-val {
  width: 130px;
}
.q-sign-date {
  color: #333;
}

.q-dept {
  display: flex;
}
.q-dept-name {
  width: 130px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: #eef7fd;
  color: #1f5fa8;
  font-size: 14px;
  border-right: 1px solid #c9c9c9;
  text-align: center;
  line-height: 1.5;
}
.q-dept-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.q-dept-sub {
  display: flex;
  flex-direction: column;
  padding: 3px 8px 4px;
}
.q-dept-sub + .q-dept-sub {
  border-top: 1px solid #c9c9c9;
}
.q-dept-sub-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 1px 0 2px;
  font-size: 13.5px;
}
.q-dept-sub-label {
  color: #333;
  font-weight: 600;
}
.q-dept-sign {
  margin-left: auto;
  color: #333;
}

.q-signrow {
  display: flex;
  min-height: 44px;
  padding: 8px 10px;
  gap: 8px;
}
.q-signitem {
  display: flex;
  align-items: center;
  font-size: 14px;
  min-width: 0;
}
.q-signitem-label {
  color: #333;
  white-space: nowrap;
}
.q-signitem-input {
  width: 120px;
}
.q-signitem-val {
  flex: 1;
  min-height: 20px;
  border-bottom: 1px solid #333;
  margin: 0 6px;
  padding: 0 4px;
}

/* ═══ ④ 底部签名 ═══ */
.as-sign-row {
  display: flex;
  min-height: 54px;
}
.as-sign-pair {
  display: flex;
}
.as-sign-cell {
  flex: none;
  background: #29b8f0;
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  text-align: center;
}
/* 白底蓝字标签(如 申请立项日期 自定义) */
.as-sign-cell.white-shell {
  background: #fff;
  color: #1f5fa8;
}
.as-sign-val {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 10px;
  min-height: 50px;
}
</style>

<!-- 打印/导出整张文书:只保留文书纸张,隐藏布局菜单/侧栏/其它页面元素 -->
<style>
@media print {
  body.approval-printing .portal {
    visibility: hidden;
  }
  body.approval-printing .topbar,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .tools {
    display: none !important;
  }
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    padding-right: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .approval-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
  }
  /* 强制打印背景色(蓝底标签/序号列),否则浏览器打印默认丢弃背景 */
  body.approval-printing .approval-sheet,
  body.approval-printing .approval-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 控件图标(下拉箭头/日历)不打印,输出与原版线条一致 */
  body.approval-printing .approval-sheet svg {
    display: none !important;
  }
  /* 阶段框标识(阶段N/隐藏/显示全部)仅为编辑标识,导出/打印不出现 */
  body.approval-printing .as-phase-title,
  body.approval-printing .as-phase-toggle,
  body.approval-printing .as-phase-restore,
  body.approval-printing .as-hint {
    display: none !important;
  }
  /* 「已完成」角标属于办理状态,不进导出件 */
  body.approval-printing .as-phase-badge {
    display: none !important;
  }
  /* 没填过内容的阶段框不导出(整框 5 个字段全空) */
  body.approval-printing .as-phase[data-filled="0"] {
    display: none !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
