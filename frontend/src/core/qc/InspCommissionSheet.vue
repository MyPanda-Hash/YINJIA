<template>
  <!-- ═══════════════════════════════════════════════════════════════════════════
       检验委托单(委托检验合同)—— 纸张式受控表单 INSP_COMMISSION

       契约唯一真源:docs/design/检验委托单-首版.md(§三 字段数据键 / §四 纸面与带入)。
       版式一比一照用户 2026-11-10 给的 .doc 纸样(YJ-QP-701-1-01 (00),单页 A4 竖版;
       渲染图见 .tmp/srcdoc/render-doc/page-0001.png):
         纸头 : 左「□ 惠州市银嘉环保科技有限公司 / 水家电综合检测中心」· 右「检验委托单（委托检验合同）」
         次行 : 左「年 月 日(单据日期)」· 右「委托单编号:<单据编号>」
         主表 : 标签列 + 值列(可见时 2 列 / 联系人等行 6 列 / 确认行 4 列),框线细灰、宋体 13px;
                委托方三行按纸样合并 = 「委托单位/单位地址」「制造商/地址」「生产厂/地址」各一行一格
                (名称与地址同一行,数据键仍是两个独立字段,见 2026-11-16 用户口径)
         带项目格: 「检验类别」= 已选目录项目摘要 + 「选择检验项目」按钮(开 SampleCatalogPickDialog);
                   「检验项目及要求」= 文本要求 + 从送样登记表带入的行表小表(可逐行「×」删)
         尾部 : 说明 1./2./3. + 右下文件号 YJ-QP-701-1-01 (00)

       写法与 QcLinePatrolSheet.vue 同款(纸面组件的标准写法):
         props = head / fields / editable,emit('dirty');
         表头数据键 = yj_field.label(中文即键,ADR-0001:数据键永不翻译);
         明细行 = head.detail.items(行对象可能被上层 markRaw ⇒ 改完 bump++ 强制重渲);
         只读态一律 <span>,可编辑态才渲染 el-input / el-date-picker(纸面观感:无边框)。
       ═══════════════════════════════════════════════════════════════════════════ -->
  <div class="ic-sheet" :class="{ 'is-editing': editable }" data-ic-sheet="INSP_COMMISSION">
    <!-- ① 纸头:左公司名两行(+ 纸样上的空方框)· 右两行大标题 -->
    <div class="ic-head">
      <div class="ic-org">
        <span class="ic-org-mark" aria-hidden="true"></span>
        <div class="ic-org-names">
          <div>{{ tt('惠州市银嘉环保科技有限公司') }}</div>
          <div>{{ tt('水家电综合检测中心') }}</div>
        </div>
      </div>
      <div class="ic-title">
        <div class="ic-title-1">{{ tt('检验委托单') }}</div>
        <div class="ic-title-2">{{ tt('（委托检验合同）') }}</div>
      </div>
    </div>

    <!-- ② 次行:单据日期(纸面「年 月 日」) + 委托单编号(号池出的 WT 号,只读) -->
    <div class="ic-meta">
      <div class="ic-meta-date">
        <el-date-picker
          v-if="canEdit('单据日期')"
          :model-value="dateValue"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          :placeholder="tt('年 月 日')"
          class="ic-date-pick"
          @update:model-value="(v) => setHead('单据日期', v)"
        />
        <!-- 纸面是「年 月 日」三个字中间填数字:只读态/打印件按这个格式出字 -->
        <span class="ic-date-text" :class="{ 'is-edit-hide': canEdit('单据日期') }">
          <template v-if="dateParts">{{ dateParts.y }} {{ tt('年') }} {{ dateParts.m }} {{ tt('月') }} {{ dateParts.d }} {{ tt('日') }}</template>
          <template v-else>{{ tt('年 月 日') }}</template>
        </span>
      </div>
      <div class="ic-meta-no">
        <span class="ic-meta-no-label">{{ tt('委托单编号：') }}</span>
        <span class="ic-meta-no-val">{{ headVal('单据编号') }}</span>
      </div>
    </div>

    <!-- ③ 主表:6 列基准栅格(列宽按纸样实测百分比,见文件末尾 style 里的 colgroup 注释) -->
    <table class="ic-grid">
      <colgroup>
        <col class="ic-col-1" />
        <col class="ic-col-2" />
        <col class="ic-col-3" />
        <col class="ic-col-4" />
        <col class="ic-col-5" />
        <col class="ic-col-6" />
      </colgroup>
      <tbody>
        <!-- ── 委托方/制造方/生产方:每行「名称/地址」合并成一格(纸样三行,值跨后 5 列) ── -->
        <tr v-for="row in PARTY_ROWS" :key="row.label">
          <th class="ic-lbl">{{ tt(row.label) }}</th>
          <td class="ic-cell" colspan="5">
            <div class="ic-party-line">
              <template v-for="(key, ki) in row.keys" :key="key">
                <el-input
                  v-if="canEdit(key)"
                  :model-value="headVal(key)"
                  size="small"
                  :class="['ic-input', ki === 0 ? 'ic-party-name' : 'ic-party-addr']"
                  maxlength="200"
                  :placeholder="tt(key)"
                  @update:model-value="(v) => setHead(key, v)"
                />
                <span
                  v-else
                  :class="['ic-text', 'ic-party-text', ki === 0 ? 'ic-party-name' : 'ic-party-addr']"
                >{{ headVal(key) }}</span>
              </template>
            </div>
          </td>
        </tr>

        <!-- ── 联系人 / 联系电话（手机）/ E-mail(纸面列头印 E-mail,数据键仍是「邮箱」) ── -->
        <tr v-for="(rowDef, ri) in SIX_CELL_ROWS" :key="'ic-six-' + ri">
          <template v-for="c in rowDef" :key="c.key">
            <th class="ic-lbl">{{ tt(c.title || c.key) }}</th>
            <td class="ic-cell">
              <el-input
                v-if="canEdit(c.key)"
                :model-value="headVal(c.key)"
                size="small"
                class="ic-input"
                :maxlength="c.key === '联系电话（手机）' ? 40 : 120"
                @update:model-value="(v) => setHead(c.key, v)"
              />
              <span v-else class="ic-text">{{ headVal(c.key) }}</span>
            </td>
          </template>
        </tr>

        <!-- ── 样品型号/规格 | 检验类别(值区 = 已选目录项目摘要 + 选择按钮) ── -->
        <tr>
          <th class="ic-lbl">{{ tt('样品型号/规格') }}</th>
          <td class="ic-cell" colspan="2">
            <el-input
              v-if="canEdit('样品型号/规格')"
              :model-value="headVal('样品型号/规格')"
              size="small"
              class="ic-input"
              maxlength="120"
              @update:model-value="(v) => setHead('样品型号/规格', v)"
            />
            <span v-else class="ic-text">{{ headVal('样品型号/规格') }}</span>
          </td>
          <th class="ic-lbl">{{ tt('检验类别') }}</th>
          <td class="ic-cell ic-cat-cell" colspan="2">
            <div class="ic-cat-line">
              <span class="ic-text">{{ headVal('检验类别') }}</span>
              <el-button
                v-if="editable && !isLocked('检验类别')"
                size="small"
                type="primary"
                plain
                class="ic-pick-btn no-print"
                @click="openCatalog"
              >
                {{ tt('选择检验项目') }}
              </el-button>
            </div>
          </td>
        </tr>

        <!-- ── 检验依据(由选中项目的「检测标准」自动拼接,可手改) ── -->
        <tr>
          <th class="ic-lbl">{{ tt('检验依据') }}</th>
          <td class="ic-cell" colspan="5">
            <el-input
              v-if="canEdit('检验依据')"
              :model-value="headVal('检验依据')"
              size="small"
              class="ic-input"
              maxlength="500"
              @update:model-value="(v) => setHead('检验依据', v)"
            />
            <span v-else class="ic-text">{{ headVal('检验依据') }}</span>
          </td>
        </tr>

        <!-- ── 检验项目及要求:上方文本框(占位即纸面提示),下方带入的行表小表 ── -->
        <tr>
          <th class="ic-lbl ic-lbl-multi">
            <div>{{ tt('检验项目及要求') }}</div>
            <div class="ic-lbl-hint">{{ tt('全项/部分项目(注明具体章节号)') }}</div>
          </th>
          <td class="ic-cell ic-items-cell" colspan="5">
            <el-input
              v-if="canEdit('检验项目及要求')"
              :model-value="headVal('检验项目及要求')"
              type="textarea"
              :rows="2"
              resize="none"
              class="ic-textarea"
              maxlength="500"
              :placeholder="tt('全项/部分项目(注明具体章节号)')"
              @update:model-value="(v) => setHead('检验项目及要求', v)"
            />
            <div v-else class="ic-text ic-text-block">{{ headVal('检验项目及要求') }}</div>

            <table v-if="items.length" class="ic-items">
              <colgroup>
                <col style="width: 38px" />
                <col style="width: 13%" />
                <col style="width: 15%" />
                <col style="width: 12%" />
                <col style="width: 12%" />
                <col style="width: 11%" />
                <col style="width: 9%" />
                <col />
                <col v-if="editable" style="width: 24px" />
              </colgroup>
              <thead>
                <tr>
                  <th>{{ tt('序号') }}</th>
                  <th>{{ tt('检测元素') }}</th>
                  <th>{{ tt('内部检出限') }}</th>
                  <th>{{ tt('检测误差') }}</th>
                  <th>{{ tt('测试方法') }}</th>
                  <th>{{ tt('测试周期') }}</th>
                  <th>{{ tt('收费') }}</th>
                  <th>{{ tt('检测标准') }}</th>
                  <th v-if="editable" class="no-print"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in items" :key="rowKeyOf(row, ri)">
                  <td class="ic-items-no">{{ cell(row, '行号') || ri + 1 }}</td>
                  <td>{{ cell(row, '检测元素') }}</td>
                  <td>{{ cell(row, '内部检出限') }}</td>
                  <td>{{ cell(row, '检测误差') }}</td>
                  <td>{{ cell(row, '测试方法') }}</td>
                  <td>{{ cell(row, '测试周期') }}</td>
                  <td class="ic-items-fee">{{ feeTextOf(row) }}</td>
                  <td>{{ cell(row, '检测标准') }}</td>
                  <td v-if="editable" class="ic-items-op no-print">
                    <span class="ic-del" :title="tt('删除本行')" @click="removeItem(ri)">×</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="ic-items-empty">{{ tt('尚未从送样登记表带入检验项目') }}</div>

            <div v-if="items.length" class="ic-items-total">
              {{ tt('合计收费：') }}<span class="ic-items-total-val">{{ feeTotalText }}</span>
            </div>
          </td>
        </tr>

        <!-- ── 样品处理方式(3 选 1,纸面 ■/□ 呈现) + 样品处理备注 ── -->
        <tr>
          <th class="ic-lbl ic-lbl-multi">
            <div>{{ tt('样品处理方式') }}</div>
            <div class="ic-lbl-hint">{{ tt('（任选其一）') }}</div>
          </th>
          <td class="ic-cell ic-handle-cell" colspan="5">
            <div
              v-for="opt in HANDLE_OPTIONS"
              :key="opt.value"
              class="ic-opt"
              :class="{ 'is-clickable': canEdit('样品处理方式') }"
              @click="pickOne('样品处理方式', opt.value)"
            >
              <span class="ic-box">{{ isPicked('样品处理方式', opt.value) ? '■' : '□' }}</span>
              <span class="ic-opt-text">{{ tt(opt.text) }}</span>
              <span v-if="opt.note" class="ic-opt-note">{{ tt(opt.note) }}</span>
            </div>
            <div class="ic-opt-extra">
              <span class="ic-opt-extra-label">{{ tt('备注：') }}</span>
              <el-input
                v-if="canEdit('样品处理备注')"
                :model-value="headVal('样品处理备注')"
                size="small"
                class="ic-input ic-input-inline"
                maxlength="200"
                @update:model-value="(v) => setHead('样品处理备注', v)"
              />
              <span v-else class="ic-text">{{ headVal('样品处理备注') }}</span>
            </div>
          </td>
        </tr>

        <!-- ── 判定规则(3 选 1;选「其他判定规则」时后面的横线可填) ── -->
        <tr>
          <th class="ic-lbl">{{ tt('判定规则') }}</th>
          <td class="ic-cell" colspan="5">
            <span
              class="ic-opt ic-opt-inline"
              :class="{ 'is-clickable': canEdit('判定规则') }"
              @click="pickOne('判定规则', '按标准限值判定')"
            >
              <span class="ic-box">{{ isPicked('判定规则', '按标准限值判定') ? '■' : '□' }}</span>
              <span class="ic-opt-text">{{ tt('按标准限值判定；') }}</span>
            </span>
            <span
              class="ic-opt ic-opt-inline"
              :class="{ 'is-clickable': canEdit('判定规则') }"
              @click="pickOne('判定规则', '其他判定规则')"
            >
              <span class="ic-box">{{ isPicked('判定规则', '其他判定规则') ? '■' : '□' }}</span>
              <span class="ic-opt-text">{{ tt('其他判定规则') }}</span>
            </span>
            <span class="ic-fill">
              <el-input
                v-if="canEdit('其他判定规则') && isPicked('判定规则', '其他判定规则')"
                :model-value="headVal('其他判定规则')"
                size="small"
                class="ic-input ic-input-fill"
                maxlength="200"
                @update:model-value="(v) => setHead('其他判定规则', v)"
              />
              <span v-else class="ic-fill-text">{{ headVal('其他判定规则') }}</span>
            </span>
            <span
              class="ic-opt ic-opt-inline"
              :class="{ 'is-clickable': canEdit('判定规则') }"
              @click="pickOne('判定规则', '无需判定')"
            >
              <span class="ic-box">{{ isPicked('判定规则', '无需判定') ? '■' : '□' }}</span>
              <span class="ic-opt-text">{{ tt('无需判定') }}</span>
            </span>
          </td>
        </tr>

        <!-- ── 报告类型(2 选 1) ── -->
        <tr>
          <th class="ic-lbl">{{ tt('报告类型') }}</th>
          <td class="ic-cell" colspan="5">
            <span
              v-for="(opt, oi) in REPORT_OPTIONS"
              :key="opt"
              class="ic-opt ic-opt-inline"
              :class="{ 'is-clickable': canEdit('报告类型') }"
              @click="pickOne('报告类型', opt)"
            >
              <span class="ic-box">{{ isPicked('报告类型', opt) ? '■' : '□' }}</span>
              <span class="ic-opt-text">{{ tt(oi === 0 ? '普通报告；' : 'CNAS 报告') }}</span>
            </span>
          </td>
        </tr>

        <!-- ── 检验报告有效期(2 选 1;选「规定有效期」时年数可填) + 纸面注释 ── -->
        <tr>
          <th class="ic-lbl">{{ tt('检验报告有效期') }}</th>
          <td class="ic-cell" colspan="5">
            <div class="ic-validity-line">
              <span
                class="ic-opt ic-opt-inline"
                :class="{ 'is-clickable': canEdit('检验报告有效期') }"
                @click="pickOne('检验报告有效期', '长期有效')"
              >
                <span class="ic-box">{{ isPicked('检验报告有效期', '长期有效') ? '■' : '□' }}</span>
                <span class="ic-opt-text">{{ tt('长期有效') }}</span>
              </span>
              <span
                class="ic-opt ic-opt-inline"
                :class="{ 'is-clickable': canEdit('检验报告有效期') }"
                @click="pickOne('检验报告有效期', '规定有效期')"
              >
                <span class="ic-box">{{ isPicked('检验报告有效期', '规定有效期') ? '■' : '□' }}</span>
                <span class="ic-opt-text">{{ tt('规定有效期') }}</span>
              </span>
              <span class="ic-fill ic-fill-year">
                <el-input
                  v-if="canEdit('有效期年数') && isPicked('检验报告有效期', '规定有效期')"
                  :model-value="headVal('有效期年数')"
                  size="small"
                  class="ic-input ic-input-fill"
                  maxlength="20"
                  @update:model-value="(v) => setHead('有效期年数', v)"
                />
                <span v-else class="ic-fill-text">{{ headVal('有效期年数') }}</span>
              </span>
              <span class="ic-unit">{{ tt('年') }}</span>
            </div>
            <div class="ic-note-text">{{ tt('注：原始记录保存期限6年，如需长期保存应在提前3个月告知本机构') }}</div>
          </td>
        </tr>

        <!-- ── 备注(纸样是整行一格:「备 注:」印在格内左上,格底居中印确认声明) ── -->
        <tr>
          <td class="ic-note-cell" colspan="6">
            <div class="ic-note-label">{{ tt('备 注：') }}</div>
            <el-input
              v-if="canEdit('备注')"
              :model-value="headVal('备注')"
              type="textarea"
              :rows="3"
              resize="none"
              class="ic-textarea"
              maxlength="500"
              @update:model-value="(v) => setHead('备注', v)"
            />
            <div v-else class="ic-text ic-text-block">{{ headVal('备注') }}</div>
            <div class="ic-note-sign">
              {{ tt('（委托单位已确认本检验委托单信息准确，对样品、资料及所填信息的真实性负责）') }}
            </div>
          </td>
        </tr>

        <!-- ── 机构承诺(静态整段) ── -->
        <tr>
          <td class="ic-promise-cell" colspan="6">
            <div class="ic-promise-label">{{ tt('机构承诺：') }}</div>
            <div class="ic-promise-text">
              {{ tt('本机构保证检测工作的公正性，对检测活动中获得或产生的所有信息承担管理责任，除客户公开的信息，或本机构与客户有约定（例如：为回应投诉的目的），其他所有信息都被视为专有信息，将予以保密。') }}
            </div>
          </td>
        </tr>

        <!-- ── 双方确认格(标签 4 格:标签|值|标签|值) ── -->
        <tr>
          <th class="ic-lbl">{{ tt('委托单位确认、日期') }}</th>
          <td class="ic-cell">
            <el-input
              v-if="canEdit('委托单位确认')"
              :model-value="headVal('委托单位确认')"
              size="small"
              class="ic-input"
              maxlength="60"
              @update:model-value="(v) => setHead('委托单位确认', v)"
            />
            <span v-else class="ic-text">{{ headVal('委托单位确认') }}</span>
          </td>
          <th class="ic-lbl" colspan="2">{{ tt('业务经办人确认、日期') }}</th>
          <td class="ic-cell" colspan="2">
            <el-input
              v-if="canEdit('业务经办人确认')"
              :model-value="headVal('业务经办人确认')"
              size="small"
              class="ic-input"
              maxlength="60"
              @update:model-value="(v) => setHead('业务经办人确认', v)"
            />
            <span v-else class="ic-text">{{ headVal('业务经办人确认') }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ④ 表尾:说明 1./2./3. + 右下受控文件号(纸样逐字) -->
    <div class="ic-notes">
      <div class="ic-notes-title">{{ tt('说明：') }}</div>
      <div class="ic-notes-body">
        <div>{{ tt('1. 委托单位对提供的样品和相关资料的真实性负责。') }}</div>
        <div>{{ tt('2. 本机构仅对检验检测结果的准确性负责。') }}</div>
        <div>{{ tt('3. 本委托单手写或机打均可，经双方确认后有效。') }}</div>
      </div>
    </div>
    <div class="ic-docno">{{ tt('YJ-QP-701-1-01 (00)') }}</div>

    <!-- ⑤ 送样登记表目录弹窗(档案面板 SAMPLE_REG 的 44 行检测目录;确认后带入行表) -->
    <SampleCatalogPickDialog v-model="catalogOpen" @confirm="onCatalogConfirm" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'
import SampleCatalogPickDialog from './SampleCatalogPickDialog.vue'

const props = defineProps({
  /** 当前单据(与首件/巡线/出厂检验同一口径:表头字段平铺 + detail.items 明细行) */
  head: { type: Object, required: true },
  /** 表头字段元数据(yj_field 下发) —— 只用于判「该格是否锁定」 */
  fields: { type: Array, default: () => [] },
  /** 草稿态才可填;只读态(已审核/归档/无权限/标注模式)全部渲染成纯文本 */
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

/** 本地版本号:明细数组/行对象可能被上层 markRaw(非响应式) ⇒ push/splice/写值后 bump++ 强制重渲 */
const bump = ref(0)

/* ───────────────────────── 表头字段(数据键 = yj_field.label,中文即键) ───────────────────────── */

/**
 * 委托方三行(纸样 2026-11-16 口径:名称与对应地址合并成同一行一格):
 *   委托单位/单位地址 | 值(委托单位 + 委托单位地址)
 *   制造商/地址      | 值(制造商 + 制造商地址)
 *   生产厂/地址      | 值(生产厂 + 生产厂地址)
 * 显示标签是合并文案(照 .doc 纸样),数据键仍是两个独立字段 —— 没有合并 SQL 列、没改 yj_field。
 */
const PARTY_ROWS = [
  { label: '委托单位/单位地址', keys: ['委托单位', '委托单位地址'] },
  { label: '制造商/地址', keys: ['制造商', '制造商地址'] },
  { label: '生产厂/地址', keys: ['生产厂', '生产厂地址'] },
]

/**
 * 纸面上的 6 格行(标签|值|标签|值|标签|值):
 *   联系人      | 值 | 联系电话（手机） | 值 | E-mail | 值
 *   样品名称    | 值 | 商标            | 值 | 样品数量 | 值
 * ⚠ E-mail 那格纸面列头印「E-mail」,但数据键仍是 yj_field.label「邮箱」(§3.3)。
 */
const SIX_CELL_ROWS = [
  [{ key: '联系人' }, { key: '联系电话（手机）' }, { key: '邮箱', title: 'E-mail' }],
  [{ key: '样品名称' }, { key: '商标' }, { key: '样品数量' }],
]

/**
 * 样品处理方式(纸面 3 选 1):
 *   `value` = 写进库的中文文案(yj_field 是文本字段,契约 §3.3 的三个选项文案即数据值);
 *   `text` / `note` = 纸面整句与括号说明(显示层,全部过 tt())。
 */
const HANDLE_OPTIONS = [
  { value: '委托单位自行取走', text: '1、委托单位自行取走；', note: '' },
  {
    value: '委托单位自愿放弃',
    text: '2、委托单位自愿放弃；',
    note: '（自发出检验报告之日起 45 日内不取样品，又未做任何说明的，视为委托单位自愿放弃样品，由检验机构对其进行处置）；',
  },
  {
    value: '委托单位委托检验机构代办样品托运手续',
    text: '3、委托单位委托检验机构代办样品托运手续，费用由委托单位承担。',
    note: '（请在备注中填写样品接收人、联系电话（手机）、邮寄地址；不填写，默认样品寄送给委托人）；',
  },
]

/** 判定规则 / 报告类型 / 检验报告有效期(纸面单选;值 = 选中项中文文案) */
const RULE_OPTIONS = ['按标准限值判定', '其他判定规则', '无需判定']
const REPORT_OPTIONS = ['普通报告', 'CNAS 报告']
const VALIDITY_OPTIONS = ['长期有效', '规定有效期']
/** 单选组清单(按数据键索引) —— 判当前选中项与「点谁写谁」都看这一份 */
const PICK_GROUPS = {
  样品处理方式: HANDLE_OPTIONS.map((o) => o.value),
  判定规则: RULE_OPTIONS,
  报告类型: REPORT_OPTIONS,
  检验报告有效期: VALIDITY_OPTIONS,
}

/** 新建空单默认值(契约 §4.1;报告类型故意留空,由用户自己勾) */
const DEFAULT_PICKS = [
  ['样品处理方式', '委托单位自行取走'],
  ['判定规则', '无需判定'],
  ['检验报告有效期', '长期有效'],
]

/* ───────────────────────── 明细行(从送样登记表带入的检验项目) ───────────────────────── */

/** 行表的全部数据键(= yj_field.label;「收费」的 label 带单位,见 §3.3) */
const DETAIL_LABELS = [
  '行号',
  '检测元素',
  '内部检出限',
  '检测误差',
  '测试方法',
  '测试周期',
  '收费（一个样/元）',
  '检测标准',
  '检测标准备注',
]
/** 「收费」两个可能的键:label 是 收费（一个样/元）,物理列是 收费 —— 读两边都认 */
const FEE_KEYS = ['收费（一个样/元）', '收费']

/** 明细行(只读取,不创建) */
const items = computed(() => {
  bump.value // ← 建立依赖:变更后强制重算并触发重渲染
  const d = props.head?.detail
  if (!d || typeof d !== 'object') return []
  if (Array.isArray(d.items)) return d.items
  // 兜底:单据面板理论上恒为 items;历史上也有档案键(见 @core/panel/detailRows 的说明)
  for (const v of Object.values(d)) if (Array.isArray(v)) return v
  return []
})

/** 取(必要时创建)明细数组 —— 新建单据 head.detail 可能是 {} 或没有 items 键 */
function ensureItems() {
  const d = props.head.detail || (props.head.detail = {})
  if (Array.isArray(d.items)) return d.items
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k]
  d.items = []
  return d.items
}

/** 单元格取值(老单据可能没有该键 / 值为 null ⇒ 统一成字符串) */
function cell(row, key) {
  return String(row?.[key] ?? '')
}

/** v-for 的 key:新建行没有 id ⇒ 用「id 或下标」兜底 */
function rowKeyOf(row, index) {
  const id = row?.id
  return id != null && id !== '' ? `id-${id}` : `ix-${index}`
}

/** 数字/文本 → 数值(带千分位、全角空格等脏值一律按 0 算,不抛异常) */
function numOf(raw) {
  const n = Number(String(raw ?? '').replace(/[,，\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 一行的收费(两个键都认) */
function feeOf(row) {
  for (const k of FEE_KEYS) {
    const raw = String(row?.[k] ?? '').trim()
    if (raw) return numOf(raw)
  }
  return 0
}

/** 一行的收费显示:原样文本(保留目录里的写法,如 0.05),没有就给空 */
function feeTextOf(row) {
  for (const k of FEE_KEYS) {
    const raw = String(row?.[k] ?? '').trim()
    if (raw) return raw
  }
  return ''
}

/** 合计收费 = 行表「收费」求和(两位小数) */
const feeTotal = computed(() => {
  bump.value
  return items.value.reduce((sum, row) => sum + feeOf(row), 0)
})
const feeTotalText = computed(() => feeTotal.value.toFixed(2))

/** 取某一列去重后的非空值(保持行表顺序) */
function uniqueOf(rows, key) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const v = String(row?.[key] ?? '').trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/** 行号重排 1..n */
function renumber() {
  ensureItems().forEach((row, i) => {
    row['行号'] = i + 1
  })
}

/**
 * 整份行表重算三处汇总(契约 §4.2 第 2~4 条,带入与删行后都要重算):
 *   检验类别 = 检测元素去重后「、」拼接;检验依据 = 检测标准去重后「；」拼接;合计收费 = 收费求和。
 * 只写这三格,用户手填的其它表头字段一律不动。
 */
function recomputeSummary() {
  const arr = ensureItems()
  props.head['检验类别'] = uniqueOf(arr, '检测元素').join('、')
  props.head['检验依据'] = uniqueOf(arr, '检测标准').join('；')
  props.head['合计收费'] = arr.reduce((sum, row) => sum + feeOf(row), 0).toFixed(2)
}

/** 删除一行(纸样小表可编辑时每行末「×」) */
function removeItem(index) {
  if (!props.editable) return
  const arr = ensureItems()
  if (index < 0 || index >= arr.length) return
  arr.splice(index, 1)
  renumber()
  recomputeSummary()
  bump.value++
  emit('dirty')
}

/**
 * 带入:送样登记表目录弹窗确认后的行 → 追加进本单行表(契约 §4.2)。
 *   1. 按「检测元素」去重追加(已存在的不重复),行号重排 1..n;
 *   2. 检验类别 / 检验依据 / 合计收费 按整份行表重算;
 *   3. emit('dirty') + bump++(行对象可能 markRaw)。
 */
function applyCarry(rows) {
  if (!props.editable || !Array.isArray(rows) || !rows.length) return
  const arr = ensureItems()
  const seen = new Set(arr.map((row) => String(row?.['检测元素'] ?? '').trim()).filter(Boolean))
  for (const src of rows) {
    const name = String(src?.['检测元素'] ?? '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const row = {}
    for (const key of DETAIL_LABELS) row[key] = String(src?.[key] ?? '')
    const fee = String(src?.['收费（一个样/元）'] ?? src?.['收费'] ?? '').trim()
    row['收费（一个样/元）'] = fee
    // 双写「收费」:契约 §3.2 说物理列叫「收费」,§3.3 说 label 叫「收费（一个样/元）」;
    // 后端按 label 落库(labelsToCols),多写的那个键不会被认领 ⇒ 两种命名都不会丢值。
    row['收费'] = fee
    arr.push(row)
  }
  renumber()
  recomputeSummary()
  bump.value++
  emit('dirty')
}

/* ───────────────────────── 只读判定 / 读写表头 ───────────────────────── */

/**
 * 只读判定:该字段在 yj_field 里登记成不可编辑(未登记 ≠ 锁定,与首件/巡线同口径)。
 * ⚠ 后端契约:yj_field.editable=0 在 dataSchema 里下发的是 readonly:true,同时兼容旧写法。
 */
function isLocked(key) {
  const f = (props.fields || []).find((x) => (x.dataName || x.name || x.code) === key)
  return !!f && (f.readonly === true || f.editable === false || f.editable === 0)
}

/** 这一格能不能填:纸面可编辑 且 该字段没被登记成只读 */
function canEdit(key) {
  return props.editable && !isLocked(key)
}

/** 表头取值 */
function headVal(key) {
  return String(props.head?.[key] ?? '')
}

/** 表头写值:统一走这里(写完标脏并强制重渲) */
function setHead(key, value) {
  props.head[key] = String(value ?? '')
  bump.value++
  emit('dirty')
}

/* ───────────────────────── 日期(纸面「年 月 日」) ───────────────────────── */

const dateValue = computed(() => headVal('单据日期'))
/** 'YYYY-MM-DD' → {y,m,d}(其它格式原样不进纸面三段) */
const dateParts = computed(() => {
  bump.value
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(headVal('单据日期').trim())
  if (!m) return null
  return { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) }
})

/** 今天(YYYY-MM-DD) */
function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ───────────────────────── 单选组(纸面 ■/□) ───────────────────────── */

/** 当前选中的中文文案(精确命中优先;老数据/手填值按包含容错,不误判成空) */
function pickedOf(key) {
  const cur = headVal(key).trim()
  if (!cur) return ''
  const values = PICK_GROUPS[key] || []
  const squash = (s) => String(s ?? '').replace(/\s+/g, '')
  if (values.includes(cur)) return cur
  // 空格差异(如老数据「CNAS报告」vs 契约文案「CNAS 报告」)不该让复选框全空
  const same = values.find((v) => squash(v) === squash(cur))
  if (same) return same
  return values.find((v) => cur.includes(v) || v.includes(cur)) || ''
}

/** 这一项是不是当前选中项(纸面 ■/□) */
function isPicked(key, value) {
  return pickedOf(key) === value
}

/** 点选:值 = 选中项的中文文案(单击即选中,不做取消 —— 纸面单选语义) */
function pickOne(key, value) {
  if (!canEdit(key)) return
  if (headVal(key).trim() === value) return
  setHead(key, value)
}

/* ───────────────────────── 送样登记表目录弹窗 ───────────────────────── */

const catalogOpen = ref(false)
function openCatalog() {
  if (!props.editable) return
  catalogOpen.value = true
}
function onCatalogConfirm(rows) {
  applyCarry(rows)
}

/* ───────────────────────── 新建空单默认值(只填空值) ───────────────────────── */

/**
 * 触发口径(与巡线记录表的「默认铺块」同款,只此一处):
 *   · 只对**空白新建草稿**动手(有单据编号 = 已保存单 ⇒ 一律不碰,免得覆盖用户数据);
 *   · 同一张空白草稿只判一次(用 lastDocKey 记住上一张);
 *   · 逐格只填空值(已有值不覆盖),填了才标脏(这些默认值要跟着第一次保存落库)。
 */
const lastDocKey = ref(null)
function docKeyOf() {
  return String(props.head?.['单据编号'] || '')
}
function seedDefaultsOnce() {
  if (!props.editable) return
  const key = docKeyOf()
  if (key) {
    lastDocKey.value = key
    return
  }
  if (lastDocKey.value === '') return
  lastDocKey.value = ''
  let changed = false
  if (!headVal('单据日期').trim()) {
    props.head['单据日期'] = todayStr()
    changed = true
  }
  for (const [k, v] of DEFAULT_PICKS) {
    if (!headVal(k).trim()) {
      props.head[k] = v
      changed = true
    }
  }
  if (changed) {
    bump.value++
    emit('dirty')
  }
}
watch(
  () => props.editable + '|' + docKeyOf(),
  () => {
    seedDefaultsOnce()
  },
  { immediate: true },
)
</script>

<style scoped>
/* ── 纸张本体:白色卡片 + 细灰框(屏上像一张纸;打印时由文件末尾的 @media print 收回纸宽) ──
   纸宽 880px(契约 §4.1「800~900px」),内容区 836px —— 与纸样表格 1054px 的等比基准;
   宋体是纸样字体,照排。 */
.ic-sheet {
  /* 2026-11-15(Lead 复验):纸面宽度**定死 880px**(契约 §4.1),左侧单据栏展开/窗口偏窄时
     由外层横向滚动,不把纸压成一条线 —— 与 QcLinePatrolSheet 的 min-width:900px 同一口径。
     打印态由文件末尾 @media print 收回 width:100% / min-width:0。 */
  width: 880px;
  min-width: 880px;
  margin: 14px auto 24px;
  padding: 16px 22px 18px;
  background: #fff;
  border: 1px solid #8a8a8a;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  color: #222;
  font-family: 'SimSun', 'Songti SC', 'Noto Serif SC', serif;
  font-size: 13px;
  line-height: 1.45;
  box-sizing: border-box;
}
.ic-sheet *,
.ic-sheet *::before,
.ic-sheet *::after {
  box-sizing: border-box;
}

/* ── ① 纸头 ──
   纸样实测(以表格 1054px 宽为基准):方框 7%~8.8%、公司名 11.8%~48.1%、
   大标题 62.9%~91.1%(右侧留 8.9%)。 */
.ic-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 9% 6px 7%;
}
.ic-org {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
/* 纸样上公司名左侧的空方框(受控文件勾选位),纯装饰,不上字 */
.ic-org-mark {
  flex: none;
  width: 13px;
  height: 13px;
  border: 1.6px solid #222;
}
.ic-org-names {
  font-size: 17px;
  line-height: 1.35;
  letter-spacing: 1px;
  white-space: nowrap;
}
.ic-title {
  text-align: right;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
}
.ic-title-1 {
  font-size: 27px;
  letter-spacing: 2px;
}
.ic-title-2 {
  font-size: 25px;
  letter-spacing: 1px;
}

/* ── ② 次行:日期居中在 21.8% 处(纸样实测),委托单编号从 59.5% 起 ── */
.ic-meta {
  display: flex;
  align-items: baseline;
  padding: 3px 0 5px;
  font-size: 13px;
}
.ic-meta-date {
  flex: 0 0 43.6%;
  text-align: center;
  white-space: nowrap;
}
.ic-date-text {
  letter-spacing: 1px;
}
.ic-date-text.is-edit-hide {
  display: none;
}
.ic-date-pick {
  width: 176px;
}
.ic-date-pick :deep(.el-input__wrapper) {
  box-shadow: none !important;
  border-bottom: 1px solid #8a8a8a;
  border-radius: 0;
  background: transparent;
  padding: 0 2px;
}
.ic-meta-no {
  flex: 1 1 auto;
  padding-left: 15.9%;
  white-space: nowrap;
}
.ic-meta-no-label {
  font-weight: 700;
}
.ic-meta-no-val {
  padding-left: 2px;
}

/* ── ③ 主表:6 列基准栅格(列宽 = 纸样实测 / 1054px) ──
   186 / 152 / 174 / 134 / 137 / 271  ⇒  17.6% 14.4% 16.5% 12.7% 13.0% 25.8% */
.ic-col-1 {
  width: 17.6%;
}
.ic-col-2 {
  width: 14.4%;
}
.ic-col-3 {
  width: 16.5%;
}
.ic-col-4 {
  width: 12.7%;
}
.ic-col-5 {
  width: 13%;
}
.ic-col-6 {
  width: 25.8%;
}
.ic-grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.ic-grid th,
.ic-grid td {
  border: 1px solid #8a8a8a;
  padding: 3px 5px;
  vertical-align: middle;
}
/* 标签格:纸样是居中加粗 */
.ic-lbl {
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5px;
  word-break: break-word;
}
/* 标签格里再分两行(如「检验项目及要求」+ 提示、「样品处理方式」+「（任选其一）」) */
.ic-lbl-multi {
  padding: 3px 3px;
  line-height: 1.35;
}
.ic-lbl-hint {
  font-weight: 400;
  font-size: 12px;
  color: #333;
}
/* 值格:纸样是左对齐(留白给手写) */
.ic-cell {
  text-align: left;
  min-height: 26px;
  height: 26px;
  padding: 2px 6px;
}
.ic-text {
  display: block;
  width: 100%;
  min-height: 18px;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.ic-text-block {
  min-height: 18px;
  white-space: pre-wrap;
}
/* 格内直编:去边框、透明底,保持白纸观感(与首件/巡线同一套) */
.ic-input {
  width: 100%;
  min-width: 0;
}
.ic-input :deep(.el-input__wrapper),
.ic-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
}
.ic-input :deep(.el-input__inner) {
  font-family: inherit;
  font-size: 13px;
  height: 20px;
}
.ic-textarea {
  width: 100%;
}
.ic-textarea :deep(.el-textarea__inner) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  resize: none;
}
.ic-input-inline {
  width: 62%;
}
.ic-input-fill {
  width: 100%;
}

/* ── 委托方三行:名称 + 地址同一行一格(纸样「委托单位/单位地址」合并行) ──
   名称左、地址右,同一个值格里并排;只读/打印态就是两段文字,不留额外框线。 */
.ic-party-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.ic-party-line > * {
  min-width: 0;
}
.ic-party-name {
  flex: 1 1 42%;
}
.ic-party-addr {
  flex: 1.35 1 52%;
}
.ic-party-text {
  width: auto;
}

/* ── 检验类别格:摘要 + 「选择检验项目」按钮 ── */
.ic-cat-cell {
  height: auto;
  min-height: 26px;
  padding: 2px 4px;
}
.ic-cat-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ic-cat-line .ic-text {
  flex: 1 1 auto;
  min-width: 0;
}
.ic-pick-btn {
  flex: none;
}

/* ── 检验项目及要求格:文本框 + 带入的行表小表 ── */
.ic-items-cell {
  height: auto;
  padding: 3px 5px 5px;
}
.ic-items {
  width: 100%;
  margin-top: 4px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 11.5px;
}
.ic-items th,
.ic-items td {
  border: 1px solid #a8a8a8;
  padding: 2px 3px;
  text-align: center;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.3;
}
.ic-items thead th {
  background: #f4f4f4;
  font-weight: 600;
  font-size: 11.5px;
}
.ic-items-no {
  color: #444;
}
.ic-items-fee {
  text-align: right;
}
.ic-items-op {
  padding: 0 !important;
  background: #fafafa;
}
.ic-del {
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 14px;
  border: 1px solid #8a8a8a;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #333;
}
.ic-del:hover {
  background: #fdecea;
  border-color: #b3261e;
  color: #b3261e;
}
.ic-items-empty {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}
.ic-items-total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  margin-top: 3px;
  font-size: 12px;
}
.ic-items-total-val {
  font-weight: 700;
}

/* ── 单选组(■/□ 纸面风格) ── */
.ic-opt {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  line-height: 1.4;
}
.ic-opt-inline {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}
.ic-opt.is-clickable {
  cursor: pointer;
}
.ic-opt.is-clickable:hover .ic-opt-text {
  color: #1f5fa8;
}
.ic-box {
  flex: none;
  font-size: 13px;
  line-height: 1.4;
}
.ic-opt-text {
  white-space: pre-wrap;
}
.ic-opt-note {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.ic-handle-cell {
  height: auto;
  padding: 3px 6px 4px;
}
.ic-handle-cell .ic-opt + .ic-opt {
  margin-top: 1px;
}
.ic-opt-extra {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  padding-left: 16px;
}
.ic-opt-extra-label {
  flex: none;
}
.ic-opt-extra .ic-text {
  flex: 1 1 auto;
  min-height: 16px;
  border-bottom: 1px solid #b8b8b8;
}

/* ── 判定规则/有效期里的「____」填空线 ── */
.ic-fill {
  display: inline-block;
  min-width: 120px;
  vertical-align: bottom;
  border-bottom: 1px solid #555;
  line-height: 1.4;
}
.ic-fill-year {
  min-width: 56px;
}
.ic-fill-text {
  display: inline-block;
  min-width: 40px;
  padding: 0 2px;
}
.ic-unit {
  margin-left: 2px;
}
.ic-validity-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 8px;
}
.ic-note-text {
  margin-top: 2px;
  font-size: 12.5px;
}

/* ── 备注行(整行一格) ── */
.ic-note-cell {
  height: auto;
  padding: 3px 6px 6px;
}
.ic-note-label {
  font-weight: 700;
}
.ic-note-sign {
  margin-top: 24px;
  text-align: center;
  letter-spacing: 0.5px;
}

/* ── 机构承诺行(整行一格) ── */
.ic-promise-cell {
  height: auto;
  padding: 3px 6px 6px;
}
.ic-promise-label {
  font-weight: 700;
}
.ic-promise-text {
  text-indent: 2em;
  line-height: 1.5;
}

/* ── ④ 表尾 ── */
.ic-notes {
  display: flex;
  gap: 10px;
  padding: 10px 0 0 4.2%;
  font-size: 13px;
  line-height: 1.5;
}
.ic-notes-title {
  flex: none;
  font-weight: 400;
}
.ic-notes-body > div + div {
  margin-top: 1px;
}
.ic-docno {
  margin-top: 42px;
  padding-right: 3%;
  text-align: right;
  font-size: 10px;
  letter-spacing: 0.5px;
}

/* 可编辑态:值格淡淡的高亮底,提示"这里能填"(纸面本身没有这层色,打印也会去掉) */
.ic-sheet.is-editing .ic-cell:hover {
  background: #f7fbff;
}
</style>

<!-- ═══════════════════════════ 打印:只留这张纸 ═══════════════════════════
     与首件检验单 / 巡线记录表同一套白名单机制(公共样式见 DocSheet.vue 的非 scoped 块:
     `body.approval-printing .portal { visibility: hidden }` + 逐张纸放行)。
     ⚠ `.ic-sheet` 必须在这里放行,否则点「打印」出来是空白页(2026-10-17 首件检验单踩过)。

     纸向/页边距:本组件只写 `@page { margin: 8mm }`,**不写 size**。
     背景(2026-11-15 Lead 复验):`@page` 不认类选择器、也没法按面板条件化,而 QcLinePatrolSheet
     在全局声明了 `@page { size: A4 landscape }` ⇒ 本纸直接写 portrait 会与之互相覆盖(实测横版裁半张)。
     而「具名页」(`page: 名字`)在嵌套元素上会让 Chromium 多出一张空白页。
     结论:**纸向由打印入口统一动态注入**(`PanelxList.printApprovalSheet` 里对 `.ic-sheet`
     注入 `@page { size: A4 portrait }`,打完整条移除——与样品申请单 sg-table 同一套做法)。 -->
<style>
@media print {
  html,
  body,
  body.approval-printing {
    background: #fff !important;
  }
  body.approval-printing {
    margin: 0 !important;
  }
  body.approval-printing .portal {
    visibility: hidden;
    display: block !important;
    height: auto !important;
    padding: 0 !important;
  }
  body.approval-printing .topbar,
  body.approval-printing .leftnav,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .doc-select-rail,
  body.approval-printing .tools {
    display: none !important;
  }
  /* approval-layout 里的其它装饰(分隔线/滚动容器)一律退回静态块,保证纸上只有纸面 */
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout,
  body.approval-printing .sheet-scroll {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .ic-sheet {
    visibility: visible !important;
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    color: #000 !important;
    font-size: 12px !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .ic-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 屏上编辑态的悬停底色不该印出来 */
  body.approval-printing .ic-sheet .ic-cell:hover {
    background: transparent !important;
  }
  /* 字号收敛一档:纸宽 880px → A4 可打印宽 733px,不收会把行撑高、易分页 */
  body.approval-printing .ic-grid th,
  body.approval-printing .ic-grid td {
    font-size: 11px !important;
    padding: 2px 3px !important;
    height: auto !important;
  }
  body.approval-printing .ic-org-names {
    font-size: 15px !important;
    letter-spacing: 0 !important;
  }
  body.approval-printing .ic-title-1 {
    font-size: 22px !important;
    letter-spacing: 1px !important;
  }
  body.approval-printing .ic-title-2 {
    font-size: 20px !important;
    letter-spacing: 0 !important;
  }
  body.approval-printing .ic-head {
    padding: 0 4% 4px 3% !important;
  }
  body.approval-printing .ic-meta {
    font-size: 11px !important;
  }
  body.approval-printing .ic-lbl-hint,
  body.approval-printing .ic-note-text,
  body.approval-printing .ic-items-empty,
  body.approval-printing .ic-items-total,
  body.approval-printing .ic-opt-note {
    font-size: 10.5px !important;
  }
  body.approval-printing .ic-items,
  body.approval-printing .ic-items th,
  body.approval-printing .ic-items td,
  body.approval-printing .ic-items thead th {
    font-size: 9.5px !important;
  }
  body.approval-printing .ic-notes {
    padding: 6px 0 0 2% !important;
    font-size: 10.5px !important;
  }
  body.approval-printing .ic-docno {
    margin-top: 16px !important;
    font-size: 9px !important;
  }
  /* 表格里的输入框:去控件外观、与纸面同字号(值照常打印) */
  body.approval-printing .ic-sheet .el-input__wrapper,
  body.approval-printing .ic-sheet .el-textarea__inner {
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
  }
  body.approval-printing .ic-sheet .el-input__inner,
  body.approval-printing .ic-sheet .el-textarea__inner {
    font-family: inherit !important;
    font-size: 11px !important;
    height: auto !important;
    min-height: 0 !important;
    line-height: 1.3 !important;
    padding: 0 !important;
    color: #000 !important;
  }
  /* 日期控件在纸上退回「年 月 日」文字形态(见模板里 .is-edit-hide) */
  body.approval-printing .ic-sheet .ic-date-pick {
    display: none !important;
  }
  body.approval-printing .ic-sheet .ic-date-text.is-edit-hide {
    display: inline !important;
  }
  /* 日历/清除图标不是纸面内容,占位提示词也不该印在纸上 */
  body.approval-printing .ic-sheet .el-input__suffix,
  body.approval-printing .ic-sheet .el-input__prefix {
    display: none !important;
  }
  body.approval-printing .ic-sheet input::placeholder,
  body.approval-printing .ic-sheet textarea::placeholder {
    color: transparent !important;
  }
  /* 编辑态控件(「×」删行、「选择检验项目」按钮)不上纸 */
  body.approval-printing .no-print,
  body.approval-printing .ic-items-op,
  body.approval-printing .ic-pick-btn {
    display: none !important;
  }
  /* 🔴 2026-11-16:编辑控件一律不上纸 —— 这一段**不依赖** body.approval-printing 类:
     Ctrl+P / 浏览器打印预览 / 以后新加的打印入口都会走 @media print;纸样上没有按钮/控件。
     (「导出 → 打印预览 / 导出 PDF」走截图,另由 PanelxList.prepareInspSheetSnapshot 摘节点) */
  .ic-sheet .ic-pick-btn,
  .ic-sheet .ic-items-op,
  .ic-sheet .no-print {
    display: none !important;
  }
  .ic-sheet .ic-date-pick {
    display: none !important;
  }
  .ic-sheet .ic-date-text.is-edit-hide {
    display: inline !important;
  }
  .ic-sheet .el-input__suffix,
  .ic-sheet .el-input__prefix {
    display: none !important;
  }
  .ic-sheet input::placeholder,
  .ic-sheet textarea::placeholder {
    color: transparent !important;
  }
  /* 行距收紧的相反面:印刷态行与行不要贴住(用户 2026-11-16「字的格式会挤压」) */
  .ic-sheet .ic-grid th,
  .ic-sheet .ic-grid td,
  .ic-sheet .ic-opt,
  .ic-sheet .ic-note-text {
    line-height: 1.5 !important;
  }
  .ic-sheet .ic-items,
  .ic-sheet .ic-items th,
  .ic-sheet .ic-items td {
    line-height: 1.45 !important;
  }
  /* 弹窗(append-to-body,不在 .portal 里)不跟着隐藏 ⇒ 开着弹窗按打印会印上去 */
  body.approval-printing .el-overlay,
  body.approval-printing .el-message-box__wrapper,
  body.approval-printing .el-message,
  body.approval-printing .el-picker__popper {
    display: none !important;
  }
  /* 行不跨页截断(标签与它的值格永远同页) */
  body.approval-printing .ic-grid tr {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  @page {
    margin: 8mm;
  }
}</style>
