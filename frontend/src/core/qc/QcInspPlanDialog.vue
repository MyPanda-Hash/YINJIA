<!-- QcInspPlanDialog.vue — 检验项目 / 检验方案 维护弹窗(2026-10-09,用户口径:
     「给出一个按钮,让他可以在组装成品检验处对这个检验项目和检验方案进行维护」)

     定位:这是**标准本身的维护入口**(受控文件里的 检验项目/接受标准/检验方法/取样/处置),
     只读写 bs_qc_plan(方案头)+ bs_qc_item(方案下的检验项目),**不往任何检验单写数据**,
     也不改动已录入单据 —— 与 StdLibManager「改库不污染已录入数据」同口径。

     入口:组装成品检验单 / 制程检验单 / 首件检验单 工具栏「更多」组里的「检验项目维护」按钮
     (2026-10-16:成型检验单 QC_MOLD_INSP 与切炭检验单 QC_CUT_INSP 已随面板下架,不再有这两个入口)。
     可撤回:删本组件 + PanelxList 的挂载与 action 分支 + PanelConfigService 的按钮注入。

     2026-10-16 实现模式变更(用户口径「修改当前检验方案的实现模式,不需要绑定文件编码,而是设定
     当前检验的类型,然后下方增加可选的检验数量」):
       · 方案的「文件编码」退场(yj_field 已隐藏,老值留在库里),换成「检验类型」= **项目分类**
         (外观检测/重量检测/尺寸检测…),自由录入 + 常用候选;
       · 「一个方案 = 一类项目」:选定方案后,下方新增项目的类别默认继承该类型,带入明细时
         它当作横表的「表区」名(curPlan.检验类型 贴到每一行上,见 confirmPick);
       · 项目的「检验数量」可选:带入后 = 该项目在横表里的格数,也是列头「＋」的上限
         (留空 = 不设上限,照旧自由加减)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('检验项目/检验方案')" width="1200px" top="4vh" append-to-body
             destroy-on-close @update:model-value="(v) => emit('update:modelValue', v)" @open="load">
    <!-- 来源切换(2026-10-17):用户口径「维护检验项目可以根据当前出货检验计划来获取」
         —— 弹窗多一个**只读**来源:按本单「产品编码」读《出货检验计划表》RD_INSP_PLAN 里**已经填好**的
         检验项目,勾选后带入本单明细。计划是单据事实、标准库是标准,两者各自独立:这个来源只读,
         不改 bs_qc_item、也不改计划本身。默认仍是标准库,没开这个来源的面板连切换条都不显示。
         2026-10-18 开到组装成品检验单 + 制程检验单(见 PanelxList SHIP_PLAN_SOURCE_PANELS)。 -->
    <el-radio-group v-if="shipSource" v-model="source" size="small" class="qcplan-src" @change="onSourceChange">
      <el-radio-button value="lib">{{ tt('检验标准库') }}</el-radio-button>
      <el-radio-button value="ship">{{ tt('出货检验计划') }}</el-radio-button>
    </el-radio-group>

    <!-- 两块来源按 shipMode 分流(**不是**只看 source):面板没开这个来源时,哪怕 source 还停在
         'ship'(组件被所有面板共用一个实例,见 shipMode 的注释)也一律回标准库,杜绝跨面板串数据。 -->
    <template v-if="!shipMode">
    <div class="qcplan-tip">
      {{ tt('上=检验方案、下=该方案下的检验项目。勾选项目后点「带入明细」即写入当前单据（再按单填写实测数值与判定）；也可以直接在两张表上新增/编辑/停用/删除标准本身（停用可恢复，删除不可恢复）。维护动作不会改动任何已录入的检验单。') }}
      <br />
      {{ tt('检验类型 = 项目分类（如 外观检测/重量检测）：一个方案 = 一类项目，带入检验单后它就是横表的「表区」。项目的检验数量可留空；填了 N，带入后该项目在横表里就有 N 格、列头「＋」加不过它。') }}
    </div>

    <!-- ═══ ① 检验方案(主表) ═══ -->
    <div class="qcplan-sec">
      <div class="qcplan-bar">
        <span class="qcplan-no">1</span>
        <b>{{ tt('检验方案') }}</b>
        <span class="qcplan-sub">{{ tt('一个产品/一类物料一套方案；点一行选中，下方就是它下面的检验项目') }}</span>
        <span class="qcplan-gap" />
        <el-checkbox v-model="showDisabled" size="small" @change="loadPlans">{{ tt('显示停用') }}</el-checkbox>
        <el-button size="small" type="primary" @click="openPlanForm(null)">{{ tt('新增方案') }}</el-button>
        <el-button size="small" :disabled="!curPlan" @click="openPlanForm(curPlan)">{{ tt('编辑') }}</el-button>
        <el-button size="small" :disabled="!curPlan" @click="togglePlan">
          {{ curPlan?.['停用'] ? tt('恢复启用') : tt('停用') }}
        </el-button>
        <!-- 彻底删除(2026-10-15 用户口径「不能只可增加不可删除」):停用只影响以后的使用、
             列表里留灰行;建错的方案要能真拿掉 —— 连同其下检验项目一并删(确认框里报清条数)。 -->
        <el-button size="small" type="danger" plain :disabled="!curPlan" :title="tt('彻底删除')" @click="destroyPlan">
          {{ tt('删除') }}
        </el-button>
      </div>
      <el-table :data="plans" size="small" border height="190" highlight-current-row
                :current-row-key="curPlan?.id" row-key="id" @current-change="onPlanRow">
        <el-table-column :label="tt('方案编码')" prop="方案编码" width="130" />
        <el-table-column :label="tt('方案名称')" prop="方案名称" min-width="200" show-overflow-tooltip />
        <el-table-column :label="tt('适用存货')" prop="适用存货" width="120" show-overflow-tooltip />
        <el-table-column :label="tt('适用存货类别')" prop="适用存货类别" width="130" show-overflow-tooltip />
        <el-table-column :label="tt('检验方式')" prop="检验方式" width="80" />
        <!-- 2026-10-16 用户口径:「不需要绑定文件编码,而是设定当前检验的类型」——
             原来这一列是受控文件号(文件编码 YJ-Q-125);现在 = 方案的**项目分类**(外观检测/重量检测…) -->
        <el-table-column :label="tt('检验类型')" prop="检验类型" width="120" show-overflow-tooltip />
        <el-table-column :label="tt('取样规则')" prop="取样规则" min-width="190" show-overflow-tooltip />
        <el-table-column :label="tt('项目数')" prop="项目数" width="70" align="right" />
        <el-table-column :label="tt('状态')" width="80">
          <template #default="{ row }">{{ row['停用'] ? tt('已停用') : tt('启用') }}</template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 主从关系的"桥":当前选中的方案,一眼看清下方表格属于谁 -->
    <div class="qcplan-bridge" :class="{ empty: !curPlan }">
      <span class="qcplan-arrow">▼</span>
      <template v-if="curPlan">
        <span class="qcplan-cur">{{ tt('当前方案') }}：<b>{{ curPlan['方案编码'] }}</b> {{ curPlan['方案名称'] }}</span>
        <span class="qcplan-pill">{{ curPlan['项目数'] ?? items.length }} {{ tt('个检验项目') }}</span>
        <span v-if="curPlan['适用存货']" class="qcplan-pill">{{ tt('适用存货') }} {{ curPlan['适用存货'] }}</span>
      </template>
      <span v-else class="qcplan-none">{{ tt('请先在上方点选一个检验方案，下方才会显示它的检验项目') }}</span>
    </div>

    <!-- ═══ ② 该方案下的检验项目(从表) ═══ -->
    <div class="qcplan-sec" :class="{ 'is-dim': !curPlan }">
      <div class="qcplan-bar">
        <span class="qcplan-no">2</span>
        <b>{{ tt('检验项目') }}</b>
        <span class="qcplan-sub">{{ curPlan ? tt('属于方案') + ' ' + curPlan['方案编码'] : tt('（先选方案）') }}</span>
        <span class="qcplan-gap" />
        <el-button size="small" type="primary" :disabled="!curPlan" @click="openItemForm(null)">{{ tt('新增项目') }}</el-button>
        <el-button size="small" :disabled="!curItem" @click="openItemForm(curItem)">{{ tt('编辑') }}</el-button>
        <el-button size="small" :disabled="!curItem" @click="toggleItem">
          {{ curItem?.['停用'] ? tt('恢复启用') : tt('停用') }}
        </el-button>
        <!-- 彻底删除:勾了行就删勾选的那些,没勾就删当前行(点行高亮)——
             勾选框在 Element 里不改「当前行」,只认高亮会让用户觉得点了没反应。 -->
        <el-button size="small" type="danger" plain :disabled="!canDestroyItems" :title="tt('彻底删除')" @click="destroyItems">
          {{ tt('删除') }}
        </el-button>
      </div>
      <el-table ref="itemTable" :data="items" size="small" border height="240" highlight-current-row row-key="id"
                :empty-text="curPlan ? tt('该方案下还没有检验项目，点右上角「新增项目」') : tt('请先在上方选择一个检验方案')"
                @current-change="(r) => (curItem = r)" @selection-change="(r) => (picked = r)">
        <!-- 勾选列(2026-10-09 合并口径):同一个弹窗既维护标准,也把勾选的项目带入当前检验单 -->
        <el-table-column type="selection" width="42" reserve-selection />
        <el-table-column :label="tt('序号')" prop="序号" width="60" />
        <el-table-column :label="tt('项目编码')" prop="项目编码" width="130" show-overflow-tooltip />
        <el-table-column :label="tt('项目名称')" prop="项目名称" width="150" show-overflow-tooltip />
        <el-table-column :label="tt('检验内容')" prop="检验内容" width="100" show-overflow-tooltip />
        <el-table-column :label="tt('检验标准')" prop="检验标准" width="180" show-overflow-tooltip />
        <el-table-column :label="tt('判定规则')" prop="判定规则" width="90" />
        <el-table-column :label="tt('标准下限')" prop="标准下限" width="90" align="right" />
        <el-table-column :label="tt('标准上限')" prop="标准上限" width="90" align="right" />
        <el-table-column :label="tt('计量单位')" prop="计量单位" width="80" />
        <el-table-column :label="tt('取样要求')" prop="取样要求" width="110" show-overflow-tooltip />
        <!-- 检验数量(2026-10-16 用户口径「下方增加可选的检验数量」):= 带入后横表该项目的格数上限 -->
        <el-table-column :label="tt('检验数量')" prop="检验数量" width="80" align="right" />
        <el-table-column :label="tt('检验方法')" prop="检验方法" min-width="180" show-overflow-tooltip />
        <el-table-column :label="tt('合格处置')" prop="合格处置" width="90" show-overflow-tooltip />
        <el-table-column :label="tt('不合格处置')" prop="不合格处置" width="100" show-overflow-tooltip />
        <el-table-column :label="tt('状态')" width="80">
          <template #default="{ row }">{{ row['停用'] ? tt('已停用') : tt('启用') }}</template>
        </el-table-column>
      </el-table>
    </div>
    </template>

    <!-- ═══ 来源②:出货检验计划(只读,组装成品检验单 / 制程检验单) ═══ -->
    <template v-else>
      <div class="qcplan-tip">
        {{ tt('下面列出本单产品对应的《出货检验计划表》里已经填好的检验项目（控制项目/控制标准及要求/控制方法/检测频率）。这里是只读来源：勾选后点「带入明细」写进本单，不会改动标准库、也不会改动计划本身；要改计划请到「研发管理 → 出货检验计划表」。') }}
      </div>
      <div class="qcplan-bar">
        <b>{{ tt('出货检验计划') }}</b>
        <span class="qcplan-sub">{{ tt('产品编码') }}：{{ shipCode || tt('（表头未填）') }}</span>
        <span v-if="shipMeta.planNo" class="qcplan-pill">{{ tt('计划单号') }} {{ shipMeta.planNo }}</span>
        <span v-if="shipMeta.version" class="qcplan-pill">{{ tt('版本号') }} {{ shipMeta.version }}</span>
        <span class="qcplan-gap" />
        <el-button size="small" :loading="shipLoading" :disabled="!shipCode" @click="loadShip">{{ tt('刷新') }}</el-button>
      </div>
      <!-- 列与《出货检验计划表》面板上**看得见的那几列**一一对齐(2026-10-15 用户口径
           「可获取的内容就是当前出货检验计划里填写的内容」):序号/检验项目/检验要求/检验方法/
           不合格应对措施/检查频率/备注。计划表里的隐藏列(检验类别、检验内容=表区、检验仪器)
           不在界面上出现 —— 其中 表区 只在「带入明细」时按计划内容写到本单,不在这里展示。 -->
      <el-table ref="shipTable" v-loading="shipLoading" :data="shipRows" size="small" border height="430"
                row-key="__k" :empty-text="shipEmptyText"
                @selection-change="(r) => (shipPicked = r)">
        <el-table-column type="selection" width="42" reserve-selection />
        <el-table-column :label="tt('序号')" prop="序号" width="70" />
        <el-table-column :label="tt('检验项目')" prop="检验项目" width="150" show-overflow-tooltip />
        <el-table-column :label="tt('检验要求')" prop="检验要求" min-width="230" show-overflow-tooltip />
        <el-table-column :label="tt('检验方法')" prop="检验方法" min-width="230" show-overflow-tooltip />
        <el-table-column :label="tt('不合格应对措施')" prop="不合格应对措施" min-width="180" show-overflow-tooltip />
        <el-table-column :label="tt('检查频率')" prop="检查频率" width="140" show-overflow-tooltip />
        <el-table-column :label="tt('备注')" prop="备注" min-width="130" show-overflow-tooltip />
      </el-table>
    </template>

    <!-- 合并口径(2026-10-09):勾选 → 带入明细;不带入也能当维护弹窗用 -->
    <template #footer>
      <template v-if="shipMode">
        <span class="qcplan-count">{{ tt('已选') }} {{ shipPicked.length }} {{ tt('项') }}</span>
        <el-button size="small" @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :disabled="!shipPicked.length" @click="confirmPickShip">
          {{ tt('带入明细') }}
        </el-button>
      </template>
      <template v-else>
        <span class="qcplan-count">{{ tt('已选') }} {{ picked.length }} {{ tt('项') }}</span>
        <el-button size="small" @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :disabled="!picked.length" @click="confirmPick">{{ tt('带入明细') }}</el-button>
      </template>
    </template>

    <!-- ═══ 方案表单 ═══ -->
    <el-dialog v-model="planFormVisible" :title="planForm.id ? tt('编辑检验方案') : tt('新增检验方案')"
               width="620px" append-to-body>
      <el-form label-width="110px" size="small">
        <el-form-item :label="tt('方案编码')" required>
          <el-input v-model="planForm.方案编码" :disabled="!!planForm.id" :placeholder="tt('如 QP-CAS18')" />
        </el-form-item>
        <el-form-item :label="tt('方案名称')" required>
          <el-input v-model="planForm.方案名称" :placeholder="tt('如 Y料成品检验方案')" />
        </el-form-item>
        <el-form-item :label="tt('适用存货')">
          <el-input v-model="planForm.适用存货" :placeholder="tt('填存货编码或存货名称（建单匹配用）')" />
        </el-form-item>
        <el-form-item :label="tt('适用存货类别')">
          <el-input v-model="planForm.适用存货类别" />
        </el-form-item>
        <el-form-item :label="tt('检验方式')">
          <el-select v-model="planForm.检验方式" style="width: 140px">
            <el-option :label="tt('抽检')" value="抽检" />
            <el-option :label="tt('全检')" value="全检" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('抽检比例%')">
          <el-input v-model="planForm.抽检比例" style="width: 140px" />
        </el-form-item>
        <el-form-item :label="tt('取样规则')">
          <el-input v-model="planForm.取样规则" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }"
                    :placeholder="tt('如 每50kg成品取样1个，每个样品200g')" />
        </el-form-item>
        <!-- 检验类型(2026-10-16):取代原来的「文件编码」—— 方案按**项目分类**归属(外观检测/重量检测…)。
             与项目的「检验内容」同款:候选给常用值 + 已有值,想开新类型直接打字(allow-create),不预设死。 -->
        <el-form-item :label="tt('检验类型')">
          <el-select
            v-model="planForm.检验类型"
            style="width: 260px"
            filterable
            allow-create
            default-first-option
            clearable
            :placeholder="tt('如 外观检测 / 重量检测 / 尺寸检测（可直接输入新类型）')"
          >
            <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('执行标准')">
          <el-input v-model="planForm.执行标准" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="planForm.备注" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="planFormVisible = false">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="savePlan">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 检验项目表单 ═══ -->
    <el-dialog v-model="itemFormVisible" :title="itemForm.id ? tt('编辑检验项目') : tt('新增检验项目')"
               width="760px" top="6vh" append-to-body>
      <el-form label-width="110px" size="small">
        <el-form-item :label="tt('项目编码')" required>
          <el-input v-model="itemForm.项目编码" :disabled="!!itemForm.id" style="width: 220px" :placeholder="tt('如 FIN-MESH-P20')" />
        </el-form-item>
        <el-form-item :label="tt('项目名称')" required>
          <el-input v-model="itemForm.项目名称" style="width: 320px" :placeholder="tt('如 目数(+20目)')" />
        </el-form-item>
        <el-form-item :label="tt('检验内容')">
          <!-- 项目类别(2026-10-12 用户口径):「在项目维护处增加一个项目类别来实现各个分类」——
               类别由维护时**自由录入**(如 外观/重要尺寸/性能/材质/包装),同一类别的项目自动归为一组;
               不是预设死的几个值。allow-create + filterable:既能选已有类别,也能直接打新类别。 -->
          <el-select
            v-model="itemForm.检验内容"
            style="width: 320px"
            filterable
            allow-create
            default-first-option
            clearable
            :placeholder="tt('如 外观 / 重要尺寸 / 性能 / 材质 / 包装(可直接输入新类别)')"
          >
            <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('检验标准')" required>
          <el-input v-model="itemForm.检验标准" :placeholder="tt('如 +20目占比≤15%')" />
        </el-form-item>
        <el-form-item :label="tt('数据类型')">
          <el-select v-model="itemForm.数据类型" style="width: 140px">
            <el-option :label="tt('定量')" value="定量" />
            <el-option :label="tt('定性')" value="定性" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('判定规则')">
          <el-select v-model="itemForm.判定规则" style="width: 160px">
            <el-option v-for="r in ['符合标准', '区间判定', '上限判定', '下限判定']" :key="r" :label="tt(r)" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('标准下限')">
          <el-input v-model="itemForm.标准下限" style="width: 140px" />
        </el-form-item>
        <el-form-item :label="tt('标准上限')">
          <el-input v-model="itemForm.标准上限" style="width: 140px" />
        </el-form-item>
        <el-form-item :label="tt('计量单位')">
          <el-input v-model="itemForm.计量单位" style="width: 140px" :placeholder="tt('如 % / mg/L')" />
        </el-form-item>
        <el-form-item :label="tt('序号')">
          <el-input v-model="itemForm.序号" style="width: 140px" :placeholder="tt('小的排在前')" />
        </el-form-item>
        <el-form-item :label="tt('取样要求')">
          <el-input v-model="itemForm.取样要求" style="width: 320px" :placeholder="tt('如 称取100g')" />
        </el-form-item>
        <!-- 检验数量(2026-10-16 用户口径「下方增加可选的检验数量」):可选。
             填 N ⇒ 带入检验单后该项目在横表里就有 N 格,且列头「＋」加不过 N(留空 = 不设上限)。
             存量已按取样要求里写死的「nPCS」回填(1PCS→1 / 5PCS→5),其余留空。 -->
        <el-form-item :label="tt('检验数量')">
          <el-input v-model="itemForm.检验数量" style="width: 140px"
                    :placeholder="tt('可留空；填 N = 带入后该项目的格数（列头 ＋ 加不过它）')" />
        </el-form-item>
        <el-form-item :label="tt('检验方法')">
          <el-input v-model="itemForm.检验方法" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
        </el-form-item>
        <el-form-item :label="tt('合格处置')">
          <el-input v-model="itemForm.合格处置" style="width: 200px" :placeholder="tt('如 入库')" />
        </el-form-item>
        <el-form-item :label="tt('不合格处置')">
          <el-input v-model="itemForm.不合格处置" style="width: 200px" :placeholder="tt('如 重新筛分 / 退货')" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="itemForm.备注" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="itemFormVisible = false">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="saveItem">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 本单「产品编码」:出货检验计划来源按它取数(取不到就提示先填表头) */
  productCode: { type: String, default: '' },
  /** 是否给出「出货检验计划」这个只读来源(2026-10-17 先只开给组装成品检验单 QC_ASM_INSP;
   *  2026-10-18 起制程检验单 QC_PROC_INSP 也开,见 PanelxList SHIP_PLAN_SOURCE_PANELS) */
  shipSource: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'changed', 'pick'])
/** 勾选的项目行(带入当前单据用) */
const picked = ref([])
const itemTable = ref(null)

// ────────── 来源②:出货检验计划(RD_INSP_PLAN,只读) ──────────
const source = ref('lib')
const shipRows = ref([])
const shipPicked = ref([])
const shipLoading = ref(false)
const shipTable = ref(null)
const shipMeta = ref({ planNo: '', title: '', version: '' })
/**
 * 本弹窗此刻该按「出货检验计划」来源渲染吗?= 面板开了这个来源 **且** 用户切到了它。
 *
 * ⚠ 少了 `props.shipSource` 这一半就会串数据:全系统所有面板共用**同一个** PanelxList 实例
 *   (PortalLayout 的 keep-alive 按组件类型缓存,面板间切换不重建),本组件也就跟着复用,
 *   `source`/`shipRows` 是组件内存状态 —— 在「成品检验单」切到出货检验计划取到数据后,换到没开
 *   这个来源的面板再打开弹窗,它会顶着「产品编码（表头未填）」把上一次的计划行显示出来
 *   (2026-10-18 报障:制程检验单没填产品编码却看到出货检验计划的行)。
 */
const shipMode = computed(() => props.shipSource && source.value === 'ship')
const shipCode = computed(() => String(props.productCode || '').trim())
const shipEmptyText = computed(() => (!shipCode.value
  ? tt('本单还没填「产品编码」，先在表头填写后再取计划')
  : (shipLoading.value ? '' : tt('该产品没有出货检验计划或计划里没有检验项目'))))
/** 取数代次:每复位/每次新请求都 +1,晚到的响应凭它作废(换面板、切来源、连点刷新都会碰到) */
let shipSeq = 0

/** 清空计划来源的全部内存状态(切来源、换面板、关弹窗重开都要清干净,别把上一张单的行留下) */
function resetShip() {
  shipSeq++
  shipRows.value = []
  shipPicked.value = []
  shipMeta.value = { planNo: '', title: '', version: '' }
}

function onSourceChange(v) {
  if (v === 'ship') loadShip()
}

/**
 * 按本单产品编码取《出货检验计划表》已填的检验项目(后端 /qc/inspPlan/fromShipPlan:
 * 控制项目→检验项目、控制标准及要求→检验要求、控制方法→检验方法、检测频率→检查频率、
 * 检验内容→表区)。**只读**,不写任何库表。
 *
 * 产品编码为空 ⇒ **不发请求、不留任何行**(表里只显示「本单还没填产品编码,先在表头填写后再取计划」),
 * 后端同一口径(空编码返回 400「请先填写产品编码」),两边都不猜产品。
 */
async function loadShip() {
  resetShip()
  const code = shipCode.value
  if (!code) return
  const seq = ++shipSeq
  shipLoading.value = true
  try {
    const r = await request.get(`${API}/fromShipPlan`, { params: { productCode: code } })
    if (seq !== shipSeq) return          // 已被复位/后一次取数取代 ⇒ 丢弃这次结果
    const d = r.data || {}
    // row-key 必须唯一:同产品同名项目可能重复,故带上下标(纯视图用,不入库)
    shipRows.value = (d.rows || []).map((x, i) => ({ ...x, __k: i }))
    shipMeta.value = { planNo: d.planNo || '', title: d.title || '', version: d.version || '' }
  } catch (e) {
    if (seq !== shipSeq) return
    err(e, '取出货检验计划失败')
  } finally {
    if (seq === shipSeq) shipLoading.value = false
  }
}

/**
 * 出货检验计划来源 → 带入明细。
 * 归一成**标准库条目形状**再 emit('pick'),复用 PanelxList.applyInspItems 的带入链路
 * (判重/写表区/写检查频率/成功话术都只有一份实现,不复制粘贴)。
 */
function confirmPickShip() {
  if (!shipPicked.value.length) return
  emit('pick', shipPicked.value.map((r) => ({
    项目名称: r['检验项目'] || '',
    // 类别:后端把计划表里**填了但界面隐藏**的「检验内容」(外观/重要尺寸/重量/性能)映射成 表区 / 检验类型,
    // 它决定本单明细归到哪一类(组装成品检验单就是明细第一列「检验类型」,打印报表也按它归组),
    // 故照样带过去 —— 本单没有这一列时 applyInspItems 会自己跳过;组装成品检验单还会按三类归一。
    检验内容: r['表区'] || '',
    检验标准: r['检验要求'] || '',
    检验方法: r['检验方法'] || '',
    检查频率: r['检查频率'] || '',
    不合格应对措施: r['不合格应对措施'] || '',
    检验仪器: r['检验仪器'] || '',
    备注: r['备注'] || '',
    来源: '出货检验计划',
  })))
  emit('update:modelValue', false)
}

function confirmPick() {
  if (!picked.value.length) return
  // 2026-10-16 拍板:带入时把**当前方案的「检验类型」**贴到每一行上 ——
  // 它是这批项目在检验单横表里所属的「表区」(方案 = 一类项目);
  // 方案没填类型时照旧按项目自己的「检验内容」分类,老数据行为不变。
  const type = String(curPlan.value?.['检验类型'] ?? '').trim()
  emit('pick', picked.value.map((it) => (type ? { ...it, 检验类型: type } : { ...it })))
  emit('update:modelValue', false)
}

const API = '/qc/inspPlan'
const plans = ref([])
const items = ref([])
const curPlan = ref(null)
const curItem = ref(null)
const showDisabled = ref(true)
const saving = ref(false)

const planFormVisible = ref(false)
const planForm = ref({})
const itemFormVisible = ref(false)
const itemForm = ref({})

/**
 * 项目类别候选(2026-10-12):类别由维护时自由录入,不是预设死的值。
 * 候选 = 当前项目列表里已用过的类别去重 —— 便于同一类别复用(如把多个项目都归到「外观」);
 * 想开新类别直接在下拉里打字(allow-create),无需改代码/字典。
 */
const categoryOptions = computed(() => {
  const set = new Set()
  for (const it of items.value || []) {
    const c = String(it['检验内容'] ?? '').trim()
    if (c) set.add(c)
  }
  // 当前正在编辑的值也纳入(编辑已有项目时能选中自身)
  const cur = String(itemForm.value?.['检验内容'] ?? '').trim()
  if (cur) set.add(cur)
  return [...set]
})

/**
 * 检验类型的候选(2026-10-16):常用分类 + 已在用的值(方案的检验类型 ∪ 方案下项目的类别)。
 * 与「检验内容」同款:可自由输入新类型(allow-create),不预设死 —— 类别是业务口径,不是字典项。
 */
const TYPE_PRESETS = ['外观检测', '重量检测', '尺寸检测', '性能检测', '材质检测', '包装检测']
const typeOptions = computed(() => {
  const set = new Set(TYPE_PRESETS)
  for (const p of plans.value || []) {
    const t = String(p['检验类型'] ?? '').trim()
    if (t) set.add(t)
  }
  for (const it of items.value || []) {
    const c = String(it['检验内容'] ?? '').trim()
    if (c) set.add(c)
  }
  const cur = String(planForm.value?.['检验类型'] ?? '').trim()
  if (cur) set.add(cur)
  return [...set]
})

const err = (e, dft) => ElMessage.error(e?.response?.data?.message || e?.message || tt(dft))

async function loadPlans() {
  try {
    const r = await request.get(`${API}/plans`, { params: { all: showDisabled.value ? 1 : '' } })
    plans.value = r.data || []
    // 保持选中:优先原方案编码,否则第一条
    const keep = curPlan.value ? plans.value.find((p) => p['方案编码'] === curPlan.value['方案编码']) : null
    curPlan.value = keep || plans.value[0] || null
    await loadItems()
  } catch (e) { err(e, '加载检验方案失败') }
}

async function loadItems() {
  curItem.value = null
  if (!curPlan.value) { items.value = []; return }
  try {
    const r = await request.get(`${API}/items`, { params: { planCode: curPlan.value['方案编码'], all: showDisabled.value ? 1 : '' } })
    items.value = r.data || []
  } catch (e) { err(e, '加载检验项目失败') }
}

function load() {
  // 每次打开先清空勾选:上一次「带入明细」留下的勾选若留着,「删除」会误伤那些行
  picked.value = []
  shipPicked.value = []
  shipTable.value?.clearSelection()
  loadPlans()
  // 打开即复位来源与计划数据(2026-10-18):
  //   · 面板开了「出货检验计划」来源 ⇒ 按**最新**表头产品编码重取一次(编码可能在弹窗外刚改过);
  //     编码为空时 loadShip 自己会停在"不发请求"上,表里只剩提示语。
  //   · 面板没开 ⇒ 来源拉回标准库 + 清掉上一个面板留下的计划行,否则会串到别的检验单上。
  if (props.shipSource) loadShip()
  else { source.value = 'lib'; resetShip() }
}

/** 方案行选中 → 加载它的项目 */
async function onPlanRow(row) {
  if (!row || row.id === curPlan.value?.id) return
  curPlan.value = row
  await loadItems()
}

function openPlanForm(row) {
  planForm.value = row
    ? { ...row, 抽检比例: row['抽检比例'] ?? '' }
    : { 检验方式: '抽检', 方案编码: '', 方案名称: '' }
  planFormVisible.value = true
}

async function savePlan() {
  const f = planForm.value
  if (!String(f['方案编码'] || '').trim()) return ElMessage.warning(tt('请填写方案编码'))
  if (!String(f['方案名称'] || '').trim()) return ElMessage.warning(tt('请填写方案名称'))
  saving.value = true
  try {
    await request.post(`${API}/planSave`, f)
    ElMessage.success(tt('已保存'))
    planFormVisible.value = false
    const keepCode = f['方案编码']
    await loadPlans()
    const hit = plans.value.find((p) => p['方案编码'] === keepCode)
    if (hit) { curPlan.value = hit; await loadItems() }
    emit('changed')
  } catch (e) { err(e, '保存失败') } finally { saving.value = false }
}

async function togglePlan() {
  const p = curPlan.value
  if (!p) return
  const off = !!p['停用']
  try {
    if (!off) await ElMessageBox.confirm(tt('停用该检验方案？停用只影响以后的使用，已录入的检验单不受影响。'), tt('提示'), { type: 'warning' })
    await request.post(`${API}/${off ? 'planEnable' : 'planRemove'}`, { id: p.id })
    ElMessage.success(off ? tt('已恢复启用') : tt('已停用'))
    await loadPlans()
    emit('changed')
  } catch (e) { if (e !== 'cancel') err(e, '操作失败') }
}

/**
 * 彻底删除方案(2026-10-15 用户口径「检验项目需要能实现删除,不能只可增加不可删除」)。
 * 与「停用」的分工:停用=以后不用了,列表留灰行可恢复;删除=建错了、不要了,从库里拿掉。
 * 连同其下检验项目一并删(方案编码是唯一归属键),确认框里先把条数说清楚。
 * 不影响已录入单据:检验单存的是文本快照,不按 id 回查这两张库表。
 */
async function destroyPlan() {
  const p = curPlan.value
  if (!p) return
  const n = Number(p['项目数'] ?? items.value.length ?? 0) || 0
  const detail = `${p['方案编码'] || ''}${p['方案名称'] ? ' ' + p['方案名称'] : ''}${n ? ` · ${n}${tt('项')}` : ''}`
  try {
    await ElMessageBox.confirm(
      `${tt('彻底删除该检验方案？其下的检验项目会一并删除，不可恢复；已录入的检验单不受影响。')}（${detail}）`,
      tt('删除确认'), { type: 'warning' })
  } catch { return }
  saving.value = true
  try {
    await request.post(`${API}/planDestroy`, { id: p.id })
    ElMessage.success(tt('已彻底删除'))
    picked.value = []
    itemTable.value?.clearSelection()
    curPlan.value = null
    curItem.value = null
    await loadPlans()
    emit('changed')
  } catch (e) { err(e, '删除失败') } finally { saving.value = false }
}

function openItemForm(row) {
  // 新增项目时「检验内容(类别)」默认继承当前方案的「检验类型」(方案 = 一类项目,2026-10-16)——
  // 用户口径「让当前的检验类型格决定…」:类型定在上方方案格上,下方项目跟着走,不用再各填一次。
  itemForm.value = row
    ? { ...row, 标准下限: row['标准下限'] ?? '', 标准上限: row['标准上限'] ?? '', 序号: row['序号'] ?? '', 检验数量: row['检验数量'] ?? '' }
    : {
        数据类型: '定量', 判定规则: '符合标准', 项目编码: '', 项目名称: '',
        序号: (items.value.length + 1) * 10,
        检验内容: String(curPlan.value?.['检验类型'] ?? '').trim(),
        检验数量: '',
      }
  itemFormVisible.value = true
}

async function saveItem() {
  const f = itemForm.value
  if (!String(f['项目编码'] || '').trim()) return ElMessage.warning(tt('请填写项目编码'))
  if (!String(f['项目名称'] || '').trim()) return ElMessage.warning(tt('请填写项目名称'))
  if (!String(f['检验标准'] || '').trim()) return ElMessage.warning(tt('请填写检验标准'))
  saving.value = true
  try {
    await request.post(`${API}/itemSave`, { ...f, 方案编码: curPlan.value?.['方案编码'] })
    ElMessage.success(tt('已保存'))
    itemFormVisible.value = false
    await loadItems()
    await loadPlans()          // 项目数会变
    emit('changed')
  } catch (e) { err(e, '保存失败') } finally { saving.value = false }
}

async function toggleItem() {
  const it = curItem.value
  if (!it) return
  const off = !!it['停用']
  try {
    if (!off) await ElMessageBox.confirm(tt('停用该检验项目？'), tt('提示'), { type: 'warning' })
    await request.post(`${API}/${off ? 'itemEnable' : 'itemRemove'}`, { id: it.id })
    ElMessage.success(off ? tt('已恢复启用') : tt('已停用'))
    await loadItems()
    await loadPlans()
    emit('changed')
  } catch (e) { if (e !== 'cancel') err(e, '操作失败') }
}

/**
 * 「删除」按钮的可用条件:勾了行,或点了行高亮。
 * ⚠ Element 的勾选框**不改当前行**(selection-change 与 current-change 是两回事):
 * 只认高亮会让「勾了行再点删除」看着像点了没反应 —— 故两者都收。
 */
const canDestroyItems = computed(() => picked.value.length > 0 || !!curItem.value)

/** 待删项目:勾选优先(多选一次删),否则当前高亮行 */
function destroyTargets() {
  return picked.value.length ? picked.value.slice() : (curItem.value ? [curItem.value] : [])
}

/** 彻底删除检验项目(物理删,与 StdLibManager 的 🗑 同口径);不影响已录入单据 */
async function destroyItems() {
  const rows = destroyTargets()
  if (!rows.length) return
  const names = rows.map((r) => r['项目名称'] || r['项目编码']).filter(Boolean).join('、')
  try {
    await ElMessageBox.confirm(
      `${tt('彻底删除该检验项目？不可恢复，已录入的检验单不受影响。')}（${names}）`,
      tt('删除确认'), { type: 'warning' })
  } catch { return }
  saving.value = true
  try {
    const r = await request.post(`${API}/itemDestroy`, { ids: rows.map((x) => x.id) })
    ElMessage.success(`${tt('已彻底删除')} ${r?.data?.deleted ?? rows.length} ${tt('项')}`)
    picked.value = []
    itemTable.value?.clearSelection()
    await loadItems()
    await loadPlans()
    emit('changed')
  } catch (e) { err(e, '删除失败') } finally { saving.value = false }
}
</script>

<style scoped>
.qcplan-tip { font-size: 12px; color: #909399; background: #f4f4f5; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; }
/* 来源切换条(2026-10-17):标准库 / 出货检验计划 —— 两个来源性质不同(标准 vs 单据事实),
   用按钮组明示"这是二选一",避免用户以为计划里的条目也能在这里编辑。 */
.qcplan-src { margin-bottom: 10px; }
.qcplan-sec { margin-bottom: 14px; }
.qcplan-count { float: left; font-size: 12px; color: #909399; line-height: 32px; }
/* 主从层级(2026-10-09 用户口径「上方为检验方案的表,下方为检验项目的表」):
   两块长得一样就看不出从属关系 ⇒ 用序号徽章 + 桥接条 + 未选方案时把从表压暗来表明层级。 */
.qcplan-sec.is-dim { opacity: .55; }
.qcplan-no { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
  border-radius: 50%; background: #1e6fb8; color: #fff; font-size: 12px; font-weight: 700; }
.qcplan-bridge { display: flex; align-items: center; gap: 10px; margin: -6px 0 12px 8px; padding: 6px 12px;
  background: #eef6ff; border-left: 3px solid #1e6fb8; border-radius: 3px; font-size: 12px; color: #1e6fb8; }
.qcplan-bridge.empty { background: #fdf6ec; border-left-color: #e6a23c; color: #b88230; }
.qcplan-arrow { font-size: 10px; }
.qcplan-cur b { font-weight: 700; }
.qcplan-pill { background: #fff; border: 1px solid #b9d8f5; border-radius: 10px; padding: 1px 8px; color: #1e6fb8; }
.qcplan-bridge.empty .qcplan-none { font-weight: 600; }
.qcplan-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.qcplan-bar b { font-size: 13px; color: #303133; }
.qcplan-sub { font-size: 12px; color: #909399; }
.qcplan-gap { flex: 1; }
</style>
