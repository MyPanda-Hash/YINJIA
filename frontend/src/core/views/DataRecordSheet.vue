<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       功能性滤效 数据记录表(RD_FILTER_EFF)——按《04数据记录表.xlsx》一比一复刻
       真实表格列对齐:报告头表(公司名|YJ-PD-01、主题+信息块4行) →
       区块表(标签170|值A|值B:1.基本信息/2.测试条件/4.数据结论)→ 数据记录表(分组表头)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="record-sheet">
    <!-- ═══ 报告头 ═══ -->
    <table class="rs-t rs-head-t">
      <colgroup><col style="width:auto" /><col style="width:300px" /></colgroup>
      <tbody>
        <tr>
          <td class="rs-td rs-company-cell">惠州市银嘉环保科技有限公司</td>
          <td class="rs-td rs-docno">
            <!-- 文档编号:配置为参照时(数据记录表→立项申请右上角编号)点击弹参照;否则保持纯输入 -->
            <div v-if="editable && isRefKey('文档编号')" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef('文档编号')">
              <span class="rs-ref-text">{{ head['文档编号'] || tt('点击选择') }}</span>
              <el-icon class="rs-ref-ico"><Search /></el-icon>
            </div>
            <el-input v-else-if="editable" v-model="head['文档编号']" size="small" maxlength="30" class="rs-docno-input" @input="emit('dirty')" />
            <span v-else class="rs-docno-text">{{ head['文档编号'] || head['单据编号'] || 'YJ-PD-01' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-topic-cell" rowspan="4">
            <el-input v-if="editable" v-model="head['测试主题']" size="small" class="rs-topic-input" @input="emit('dirty')" />
            <span v-else class="rs-topic">{{ head['测试主题'] || '' }}</span>
          </td>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('密级') }}</span>
              <span class="rs-ivalue">
                <el-select v-if="editable" v-model="head['密级']" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <template v-else>{{ head['密级'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('适用范围') }}</span>
              <span class="rs-ivalue">
                <el-select v-if="editable" v-model="head['适用范围']" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions('适用范围')" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <template v-else>{{ head['适用范围'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('测试负责人') }}</span>
              <span class="rs-ivalue">
                <el-input v-if="editable" v-model="head['测试负责人']" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
                <template v-else>{{ head['测试负责人'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('测试编号') }}</span>
              <span class="rs-ivalue">
                <el-input v-if="editable" v-model="head['测试编号']" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
                <template v-else>{{ head['测试编号'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 样品列控制(表格外,紧邻 1.基本信息 的 样品信息 行;打印隐藏;减列清空该列数据) ═══ -->
    <div v-if="editable" class="rs-sample-ctl">
      <span class="rs-sample-label">{{ tt('样品列') }}</span>
      <span class="rs-sample-btn" :class="{ dim: sampleCount <= MIN_SAMPLES }" :title="tt('减少样品列(清空该列数据)')" @click="setSampleCount(sampleCount - 1)">－</span>
      <span class="rs-sample-num">{{ sampleCount }}</span>
      <span class="rs-sample-btn" :class="{ dim: sampleCount >= MAX_SAMPLES }" :title="tt('增加样品列')" @click="setSampleCount(sampleCount + 1)">＋</span>
    </div>

    <!-- ═══ 1.基本信息 ═══ -->
    <table class="rs-t">
      <colgroup><col style="width:170px" /><col v-for="n in sampleCount" :key="'bc' + n" style="width:auto" /></colgroup>
      <tbody>
        <tr><td :colspan="sampleCount + 1" class="rs-sectionbar">{{ tt('1.基本信息') }}</td></tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试目的/背景') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['测试目的/背景']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试目的/背景'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('规格') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['规格']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['规格'] || '' }}</span>
          </td>
        </tr>
        <tr class="rs-row-mid">
          <td class="rs-td rs-label">{{ tt('样品配方') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['样品配方']" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }" size="small" maxlength="300" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['样品配方'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('样品信息') }}</td>
          <td v-for="n in sampleCount" :key="'si' + n" class="rs-td">
            <el-input v-if="editable" v-model="head['样品信息' + n]" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['样品信息' + n] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试要求') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['测试要求']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试要求'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试标准') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['测试标准']" size="small" maxlength="300" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试标准'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试时间') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['测试时间']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试时间'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('本次实验目的') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['本次实验目的']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['本次实验目的'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 2.测试条件 ═══ -->
    <table class="rs-t">
      <colgroup><col style="width:170px" /><col v-for="n in sampleCount" :key="'cc' + n" style="width:auto" /></colgroup>
      <tbody>
        <tr><td :colspan="sampleCount + 1" class="rs-sectionbar">{{ tt('2.测试条件') }}</td></tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试装置及编号') }}</td>
          <td v-for="n in sampleCount" :key="'td' + n" class="rs-td">
            <el-input v-if="editable" v-model="head['测试装置及编号' + n]" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试装置及编号' + n] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('加标方式') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['加标方式']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['加标方式'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('冲水方式') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['冲水方式']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['冲水方式'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试用仪器/检出限') }}</td>
          <td class="rs-td" :colspan="sampleCount">
            <el-input v-if="editable" v-model="head['测试用仪器/检出限']" size="small" maxlength="500" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试用仪器/检出限'] || '' }}</span>
          </td>
        </tr>
        <!-- 原水水质条件:左侧标签跨两行,右侧内嵌 指标名行 + 值行 -->
        <tr>
          <td class="rs-td rs-label rs-water-label" rowspan="2">{{ tt('原水水质条件') }}</td>
          <td class="rs-td rs-water-zone" :colspan="sampleCount">
            <table class="rs-inner">
              <tbody>
                <tr>
                  <td class="rs-ind-name">{{ tt('自来水') }}</td>
                  <td class="rs-ind-name">{{ tt('纯水') }}</td>
                  <td class="rs-ind-name">{{ tt('超纯水') }}</td>
                  <td class="rs-ind-name">{{ tt('PH') }}</td>
                  <td class="rs-ind-name">{{ tt('TDS') }}</td>
                  <td class="rs-ind-name narrow">{{ tt('缸内自来水VOC浓度') }}</td>
                  <td class="rs-ind-name">{{ tt('自来水加氯浓度') }}</td>
                  <td class="rs-ind-name">{{ tt('水温℃') }}</td>
                </tr>
                <tr>
                  <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水自来水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水自来水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水自来水'] || '' }}</template></td>
                  <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水纯水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水纯水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水纯水'] || '' }}</template></td>
                  <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水超纯水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水超纯水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水超纯水'] || '' }}</template></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['原水PH']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水PH'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['原水TDS']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水TDS'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['缸内自来水VOC浓度']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['缸内自来水VOC浓度'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['自来水加氯浓度']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['自来水加氯浓度'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['水温']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['水温'] || '' }}</span></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 3.数据记录表(样品组列随样品数,总宽恒定:组总宽÷列数) ═══ -->
    <table class="rs-t rs-dt">
      <colgroup>
        <col v-if="!dtHidden('冲水时间')" style="width:130px" />
        <col v-if="!dtHidden('累计进水（L）')" style="width:96px" />
        <col v-if="!dtHidden('水温（℃）')" style="width:80px" />
        <template v-for="n in sampleCount" :key="'cp' + n">
          <col v-if="!dtHidden(`压力（PSI)样品${n}`)" :style="{ width: pressColW + 'px' }" />
        </template>
        <col v-if="!dtHidden('原水含量（ug/L）5号缸')" style="width:96px" />
        <template v-for="n in sampleCount" :key="'co' + n">
          <col v-if="!dtHidden(`出水含量（ug/L）样品${n}`)" :style="{ width: outColW + 'px' }" />
        </template>
        <template v-for="n in sampleCount" :key="'cr' + n">
          <col v-if="!dtHidden(`去除率%样品${n}`)" :style="{ width: outColW + 'px' }" />
        </template>
        <col v-if="!dtHidden('测试时间')" style="width:110px" />
        <col v-if="editable" style="width:60px" />
      </colgroup>
      <tbody>
        <tr><td :colspan="dtColSpan" class="rs-sectionbar">
          {{ tt('3.数据记录表') }}
          <span v-if="editable" class="rs-fieldedit" :title="tt('可改列名(别名)与显隐,全用户共享')" @click="openFieldEdit">✎ {{ tt('字段编辑') }}</span>
        </td></tr>
        <tr class="rs-grp">
          <th v-if="!dtHidden('冲水时间')" class="rs-th" rowspan="2">{{ dtLabel('冲水时间') }}</th>
          <th v-if="!dtHidden('累计进水（L）')" class="rs-th" rowspan="2">{{ dtLabel('累计进水（L）') }}</th>
          <th v-if="!dtHidden('水温（℃）')" class="rs-th" rowspan="2">{{ dtLabel('水温（℃）') }}</th>
          <th v-if="dtGroupSpan('压力')" class="rs-th" :colspan="dtGroupSpan('压力')">{{ dtGroupLabel('压力') }}</th>
          <th v-if="!dtHidden('原水含量（ug/L）5号缸')" class="rs-th" rowspan="2">{{ dtLabel('原水含量（ug/L）5号缸', '原水含量（ug/L）') }}</th>
          <th v-if="dtGroupSpan('出水')" class="rs-th" :colspan="dtGroupSpan('出水')">{{ dtGroupLabel('出水') }}</th>
          <th v-if="dtGroupSpan('去除率')" class="rs-th" :colspan="dtGroupSpan('去除率')">{{ dtGroupLabel('去除率') }}</th>
          <th v-if="!dtHidden('测试时间')" class="rs-th" rowspan="2">{{ dtLabel('测试时间') }}</th>
          <th v-if="editable" class="rs-th rs-th-op" rowspan="2"></th>
        </tr>
        <tr class="rs-grp2">
          <template v-for="n in sampleCount" :key="'hp' + n">
            <th v-if="!dtHidden(`压力（PSI)样品${n}`)" class="rs-th">{{ dtLabel(`压力（PSI)样品${n}`, `样品${n}`) }}</th>
          </template>
          <template v-for="n in sampleCount" :key="'ho' + n">
            <th v-if="!dtHidden(`出水含量（ug/L）样品${n}`)" class="rs-th">{{ dtLabel(`出水含量（ug/L）样品${n}`, `样品${n}`) }}</th>
          </template>
          <template v-for="n in sampleCount" :key="'hr' + n">
            <th v-if="!dtHidden(`去除率%样品${n}`)" class="rs-th">{{ dtLabel(`去除率%样品${n}`, `样品${n}`) }}</th>
          </template>
        </tr>
        <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
          <td v-if="!dtHidden('冲水时间')" class="rs-td"><el-input v-if="editable" v-model="row['冲水时间']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['冲水时间'] || ' / ' }}</span></td>
          <td v-if="!dtHidden('累计进水（L）')" class="rs-td"><el-input v-if="editable" v-model="row['累计进水（L）']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['累计进水（L）'] || ' / ' }}</span></td>
          <td v-if="!dtHidden('水温（℃）')" class="rs-td"><el-input v-if="editable" v-model="row['水温（℃）']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['水温（℃）'] || ' / ' }}</span></td>
          <template v-for="n in sampleCount" :key="'dp' + n">
            <td v-if="!dtHidden(`压力（PSI)样品${n}`)" class="rs-td">
              <div class="rs-combo">
                <el-input v-if="editable" v-model="row[`压力（PSI)样品${n}`]" size="small" class="rs-c-in hl" placeholder="压力" @input="emit('dirty')" />
                <el-input v-if="editable" v-model="row[`流速（L/min)样品${n}`]" size="small" class="rs-c-in hl" placeholder="流速" @input="emit('dirty')" />
                <span v-else class="rs-txt">{{ combo(row, `压力（PSI)样品${n}`, `流速（L/min)样品${n}`) }}</span>
              </div>
            </td>
          </template>
          <td v-if="!dtHidden('原水含量（ug/L）5号缸')" class="rs-td"><el-input v-if="editable" v-model="row['原水含量（ug/L）5号缸']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['原水含量（ug/L）5号缸'] || ' / ' }}</span></td>
          <template v-for="n in sampleCount" :key="'do' + n">
            <td v-if="!dtHidden(`出水含量（ug/L）样品${n}`)" class="rs-td"><el-input v-if="editable" v-model="row[`出水含量（ug/L）样品${n}`]" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row[`出水含量（ug/L）样品${n}`] || ' / ' }}</span></td>
          </template>
          <template v-for="n in sampleCount" :key="'dr' + n">
            <td v-if="!dtHidden(`去除率%样品${n}`)" class="rs-td"><el-input v-if="editable" v-model="row[`去除率%样品${n}`]" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row[`去除率%样品${n}`] || ' / ' }}</span></td>
          </template>
          <td v-if="!dtHidden('测试时间')" class="rs-td"><el-input v-if="editable" v-model="row['测试时间']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['测试时间'] || ' / ' }}</span></td>
          <td v-if="editable" class="rs-td rs-td-op"><span class="rs-op-add" @click="addRow(i)">＋</span><span class="rs-op-del" @click="removeRow(i)">×</span></td>
        </tr>
        <tr v-if="!items.length"><td :colspan="dtColSpan" class="rs-empty">—</td></tr>
      </tbody>
    </table>
    <div v-if="editable" class="rs-add" @click="addRow(-1)">＋ {{ tt('新增数据记录行') }}</div>

    <!-- ═══ 4.数据结论 ═══ -->
    <table class="rs-t">
      <tbody>
        <tr><td colspan="3" class="rs-sectionbar">{{ tt('4.数据结论') }}</td></tr>
        <tr>
          <td class="rs-td rs-conclusion" colspan="3">
            <el-input v-if="editable" v-model="head['数据结论']" type="textarea" :autosize="{ minRows: 2, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['数据结论'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <RefPickDialog v-model="prodRefVisible" :field="prodRefField" mode="header" @confirm="onProdRefConfirm" />

    <!-- ═══ 字段编辑(3.数据记录表):列别名/显隐可改,应对复杂测试环境 ═══ -->
    <el-dialog v-model="fieldEditVisible" :title="tt('字段编辑')" width="620px" append-to-body>
      <div class="fe-list">
        <div v-for="(row, idx) in fieldEditRows" :key="idx" class="fe-row">
          <span class="fe-key" :title="row.key">{{ row.key }}</span>
          <span class="fe-label">{{ tt(row.label) }}</span>
          <el-input
            :model-value="row.alias"
            @update:model-value="(v) => { row.alias = v }"
            size="small"
            :placeholder="tt(row.label)"
            clearable
            class="fe-alias"
          />
          <el-checkbox :model-value="row.visible" @update:model-value="(v) => { row.visible = v }" class="fe-vis" :title="tt('不勾选=该列不显示/不导出')" />
        </div>
      </div>
      <div style="margin-top:8px;color:#909399;font-size:12px">{{ tt('留空=沿用原名;修改全局生效(所有用户共享)') }}</div>
      <template #footer>
        <el-button @click="fieldEditVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="saveFieldEdit">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { tt } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@/core/request'
import RefPickDialog from './RefPickDialog.vue'
import { buildColumnPrefsPayload, isColumnHidden, resolveColumnLabel } from '@core/sheet/columnPrefs'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ── 参照字段(文档编号 → 立项申请右上角编号):点击单元格弹参照,确认后按 refMap 带回(密级等) ──
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

// ── 3.数据记录表:列名(别名)与显隐可配置,与其余 7 张同一接口(字段编辑) ──
// 分组表头(取样前样品/出水含量/去除率)各管"样品数"列;隐藏一列时分组标题 colspan 自动收缩,全隐藏则整组不渲染。
// ── 动态样品列(2026-09-11):默认 2 列,2~6 列可调 ──
// 计数存头字段「样品数」(物理列 预置到 样品6,见 tools/migrate-filter-eff-samples.sql);
// 加列即时生效;减列**清空被减列数据**(用户口径,确认弹窗);总表宽恒定——样品组总宽不变,列宽=组总宽÷列数。
const MIN_SAMPLES = 2
const MAX_SAMPLES = 6
const sampleCount = computed(() => {
  const n = parseInt(props.head?.['样品数'], 10)
  return Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Number.isFinite(n) ? n : MIN_SAMPLES))
})
async function setSampleCount(n) {
  if (!props.editable) return
  const cur = sampleCount.value
  if (n === cur) return
  if (n < MIN_SAMPLES) return ElMessage.warning(tt('已是最少列数'))
  if (n > MAX_SAMPLES) return ElMessage.warning(tt('已是最大列数'))
  if (n < cur) {
    try {
      await ElMessageBox.confirm(tt('减少样品列将清空该列已填数据，确定减少吗？'), tt('减少样品列'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
    } catch { return /* 取消 */ }
    const drop = cur
    props.head[`样品信息${drop}`] = ''
    props.head[`测试装置及编号${drop}`] = ''
    for (const row of props.head?.detail?.items || []) {
      row[`压力（PSI)样品${drop}`] = ''
      row[`流速（L/min)样品${drop}`] = ''
      row[`出水含量（ug/L）样品${drop}`] = ''
      row[`去除率%样品${drop}`] = ''
    }
  }
  props.head['样品数'] = String(n)
  emit('dirty')
}
/** 样品组列宽:组总宽÷当前列数(总宽恒定,维持表格整齐;下限防过窄) */
const pressColW = computed(() => Math.max(34, Math.floor(220 / sampleCount.value)))
const outColW = computed(() => Math.max(30, Math.floor(192 / sampleCount.value)))
/** 某样品组的物理列键(1..样品数) */
function sampleKeys(prefix) {
  return Array.from({ length: sampleCount.value }, (_, i) => `${prefix}${i + 1}`)
}
const DT_GROUPS = {
  压力: { label: '取样前样品：压力（PSI)/流速（L/min）', prefix: '压力（PSI)样品' },
  出水: { label: '出水含量（ug/L）', prefix: '出水含量（ug/L）样品' },
  去除率: { label: '去除率%', prefix: '去除率%样品' },
}
/** 数据记录表全部物理列(键=数据键,label=纸面默认表头;样品列到 6,字段编辑可管全部) */
const DT_COLUMNS = (() => {
  const cols = [
    { key: '冲水时间', label: '冲水时间' },
    { key: '累计进水（L）', label: '累计进水（L）' },
    { key: '水温（℃）', label: '水温（℃）' },
  ]
  for (let n = 1; n <= MAX_SAMPLES; n++) cols.push({ key: `压力（PSI)样品${n}`, label: `样品${n}（压力/流速）` })
  cols.push({ key: '原水含量（ug/L）5号缸', label: '原水含量（ug/L）' })
  for (let n = 1; n <= MAX_SAMPLES; n++) cols.push({ key: `出水含量（ug/L）样品${n}`, label: `样品${n}` })
  for (let n = 1; n <= MAX_SAMPLES; n++) cols.push({ key: `去除率%样品${n}`, label: `样品${n}` })
  cols.push({ key: '测试时间', label: '测试时间' })
  return cols
})()
/** 当前渲染的列键序(固定列 + 各样品组 1..样品数 中未隐藏者) */
const dtRenderedKeys = computed(() => {
  const keys = []
  for (const k of ['冲水时间', '累计进水（L）', '水温（℃）']) if (!dtHidden(k)) keys.push(k)
  for (const k of sampleKeys(DT_GROUPS.压力.prefix)) if (!dtHidden(k)) keys.push(k)
  if (!dtHidden('原水含量（ug/L）5号缸')) keys.push('原水含量（ug/L）5号缸')
  for (const k of sampleKeys(DT_GROUPS.出水.prefix)) if (!dtHidden(k)) keys.push(k)
  for (const k of sampleKeys(DT_GROUPS.去除率.prefix)) if (!dtHidden(k)) keys.push(k)
  if (!dtHidden('测试时间')) keys.push('测试时间')
  return keys
})
function dtFieldOf(key) {
  return fieldMap.value.get(key)
}
function dtHidden(key) {
  return isColumnHidden(dtFieldOf(key))
}
function dtLabel(key, fallback) {
  return resolveColumnLabel(dtFieldOf(key), fallback || key)
}
function dtGroupSpan(name) {
  return sampleKeys(DT_GROUPS[name]?.prefix || '').filter((k) => !dtHidden(k)).length
}
function dtGroupLabel(name) {
  const g = DT_GROUPS[name]
  return g ? tt(g.label) : ''
}
const dtColSpan = computed(() => dtRenderedKeys.value.length + (props.editable ? 1 : 0))

/** 字段编辑弹窗:改列别名/显隐(存 yj_field.alias/visible,全用户共享) */
const fieldEditVisible = ref(false)
const fieldEditRows = ref([])
function openFieldEdit() {
  fieldEditRows.value = DT_COLUMNS.map((col) => {
    const f = dtFieldOf(col.key)
    const alias = f && f.displayName && f.displayName !== f.dataName ? String(f.displayName) : ''
    const visible = !dtHidden(col.key)
    return { key: col.key, label: col.label, alias, originalAlias: alias, visible, originalVisible: visible }
  })
  fieldEditVisible.value = true
}
async function saveFieldEdit() {
  const changed = buildColumnPrefsPayload(fieldEditRows.value)
  if (!changed.length) {
    fieldEditVisible.value = false
    return
  }
  try {
    // 该组件只服务功能性滤效面板;接口与其余 7 张数据记录表一致
    const res = await request.post('/px/saveColumnPrefs', { panelCode: 'RD_FILTER_EFF', columns: changed })
    if (res && res.code && res.code !== 200) {
      ElMessage.error(res.message || tt('保存失败'))
      return
    }
    ElMessage.success(tt('字段编辑已保存'))
    fieldEditVisible.value = false
    emit('refresh-config')
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}

// ── 校验定位(供 PanelxList 保存校验调用):滚动到该字段并琥珀闪烁 ──
function focusField(label) {
  if (!label) return false
  nextTick(() => {
    const root = document.querySelector('.drc-sheet') || document.querySelector('.record-sheet')
    if (!root) return
    const el = [...root.querySelectorAll('td.rs-label, .rs-topic-cell, th')]
      .find((e) => (e.textContent || '').trim() === label)
      || [...root.querySelectorAll('td.rs-label, .rs-topic-cell, th')]
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

/** 取样前组合显示:流速 / 压力(复刻 Excel "1.93/61.1") */
function combo(row, pKey, fKey) {
  const p = row[pKey] || ''
  const f = row[fKey] || ''
  if (!p && !f) return ' / '
  return `${f}/${p}`
}

const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})
function touch() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}
function addRow(i) {
  const arr = touch()
  if (i >= 0) arr.splice(i + 1, 0, {})
  else arr.push({})
  emit('dirty')
}
function removeRow(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}
</script>

<style scoped>
/* ═══ 纸张/表基础 ═══ */
.record-sheet {
  width: 1180px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  font-size: 14px;
  color: #222;
}
.rs-t {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.rs-t :deep(.el-input__wrapper),
.rs-t :deep(.el-input__wrapper.is-focus),
.rs-t :deep(.el-textarea__inner),
.rs-t :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0;
}
.rs-t :deep(.el-input__inner),
.rs-t :deep(.el-textarea__inner) {
  font-size: 13.5px;
  line-height: 1.6;
  padding: 0;
}
.rs-td {
  border: 1px solid #7f7f7f;
  padding: 4px 8px;
  vertical-align: middle;
  background: #fff;
}
.rs-label {
  background: #d9d9d9;
  color: #333;
  text-align: center;
  font-weight: 500;
}
.rs-txt {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.7;
}
.rs-t-in {
  width: 100%;
}
.rs-c-in {
  width: 100%;
}

/* ═══ 报告头 ═══ */
.rs-company-cell {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 14px !important;
}
.rs-docno {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-weight: 600;
  font-style: italic;
  font-size: 14px;
  padding: 6px 14px !important;
  vertical-align: middle;
}
.rs-docno-text {
  display: inline-block;
  min-width: 150px;
  text-align: right;
  letter-spacing: 1px;
}
.rs-docno-input {
  width: 160px;
}
.rs-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-style: italic;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
}
/* 字段编辑:区块条右侧入口 + 弹窗列表 */
.rs-fieldedit {
  float: right;
  color: #e6a23c;
  cursor: pointer;
  font-size: 12px;
}
.rs-fieldedit:hover { text-decoration: underline; }
.fe-list {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 4px 0;
}
.fe-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-bottom: 1px solid #f0f0f0;
}
.fe-row:last-child { border-bottom: none; }
.fe-key {
  flex: none;
  width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #606266;
}
.fe-label {
  flex: none;
  width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #909399;
}
.fe-alias { flex: 1; min-width: 120px; }
.fe-vis { flex: none; }

/* 参照单元格(文档编号 -> 立项申请右上角编号):拟态输入框,点击弹参照 */
.rs-ref-ctl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 24px;
  padding: 0 4px;
  border: 1px dashed #b9c0c8;
  border-radius: 3px;
  cursor: pointer;
  background: #fafbfc;
  font-style: normal;
  font-weight: 400;
}
.rs-ref-ctl:hover {
  border-color: var(--el-color-primary, #409eff);
  background: #f0f6ff;
}
.rs-ref-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #333;
  text-align: right;
}
.rs-ref-ico {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-color-primary, #409eff);
}
.rs-topic-cell {
  padding: 12px 14px 14px 30px !important;
  vertical-align: middle;
}
/* 校验定位闪烁:琥珀高亮约3秒(保存必填缺失时) */
@keyframes drcFieldBlink {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 0 3px rgba(250, 173, 20, 0.55); background: #ffe58f; }
}
.field-blink {
  animation: drcFieldBlink 0.65s ease-in-out 5;
  outline: 2px solid #faad14;
  outline-offset: -2px;
}
.rs-topic {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
  display: block;
  text-align: center;
}
.rs-topic-input {
  width: 90%;
}
.rs-topic-input :deep(.el-input__inner) {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
  text-align: center;
  height: 40px;
}
.rs-info-cell {
  padding: 0 !important;
  vertical-align: top !important;
}
.rs-irow {
  display: flex;
  border-bottom: 1px solid #7f7f7f;
  min-height: 34px;
}
.rs-irow:last-child {
  border-bottom: none;
}
.rs-ilabel {
  width: 90px;
  flex: none;
  background: #d9d9d9;
  text-align: center;
  font-size: 13px;
  padding: 5px 4px;
  border-right: 1px solid #7f7f7f;
}
.rs-ivalue {
  flex: 1;
  padding: 5px 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.rs-ivalue :deep(.el-select) {
  width: 100%;
}

/* ═══ 区块粉条 ═══ */
.rs-sectionbar {
  background: #f9dfe2;
  border: 1px solid #7f7f7f;
  border-top: none;
  color: #333;
  font-size: 14px;
  font-weight: 700;
  padding: 5px 10px;
  text-align: center;
}
.rs-t > tbody > tr:first-child .rs-sectionbar {
  border-top: 1px solid #7f7f7f;
}

/* ═══ 测试条件 ═══ */
.rs-inner {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.rs-inner td {
  border-left: 1px solid #7f7f7f;
  border-top: 1px solid #7f7f7f;
  border-bottom: 1px solid #7f7f7f;
}
.rs-inner tr:first-child td {
  border-top: none;
}
.rs-inner td:last-child {
  border-right: none;
}
.rs-water-zone {
  padding: 0 !important;
}
.rs-row-mid {
  height: 130px;
}
.rs-water-label {
  vertical-align: middle;
}
.rs-ind-name {
  text-align: center;
  font-size: 13px;
  color: #333;
  min-width: 86px;
}
.rs-ind-name.narrow {
  min-width: 120px;
}
.rs-water-val {
  text-align: center;
  min-width: 86px;
}
.rs-water-val :deep(.el-select) {
  width: 64px;
}

/* ═══ 样品列控制(表格外,紧邻 样品信息 行;打印隐藏) ═══ */
.rs-sample-ctl {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin: 0 0 6px;
  user-select: none;
}
.rs-sample-label { font-size: 12.5px; color: #1c4f8a; }
.rs-sample-btn {
  width: 22px;
  height: 22px;
  line-height: 20px;
  text-align: center;
  border: 1px solid #8fb4e0;
  border-radius: 3px;
  color: #0d5bd3;
  background: #f4f9ff;
  cursor: pointer;
  font-size: 14px;
}
.rs-sample-btn:hover { background: #e8f2ff; }
.rs-sample-btn.dim { color: #b6c2d0; border-color: #d4dde6; background: #f7fafc; cursor: not-allowed; }
.rs-sample-num { min-width: 18px; text-align: center; font-size: 13px; color: #333; font-weight: 600; }
@media print { .rs-sample-ctl { display: none !important; } }

/* ═══ 数据记录表 ═══ */
.rs-th {
  border: 1px solid #7f7f7f;
  background: #9c9c9c;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  padding: 6px 4px;
  vertical-align: middle;
  line-height: 1.35;
  word-break: break-all;
}
.rs-th-op {
  min-width: 60px;
}
.rs-combo {
  display: flex;
  gap: 6px;
  align-items: center;
}
.rs-c-in.hl {
  width: 46%;
}
.rs-dt td {
  height: 27px;
  text-align: center;
}
.rs-dt td .rs-txt {
  white-space: nowrap;
  display: inline-block;
  min-width: 40px;
  text-align: center;
}
.rs-td-op {
  text-align: center;
  white-space: nowrap;
}
.rs-op-add,
.rs-op-del {
  display: inline-block;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  margin: 0 3px;
}
.rs-op-add {
  color: #0d5bd3;
}
.rs-op-del {
  color: #c0392b;
}
.rs-empty {
  text-align: center;
  color: #98a4b3;
  padding: 14px 0 !important;
}
.rs-add {
  margin: 8px 0 2px;
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.rs-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
.rs-conclusion {
  padding: 10px 14px !important;
}
</style>
