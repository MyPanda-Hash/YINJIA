<template>
  <div class="dc-page dc-config">
    <header class="dc-head">
      <div class="dc-head-main">
        <h1 class="dc-title">{{ tt('设备配置管理') }}</h1>
        <p class="dc-sub">{{ tt('设备接入五连：绑定网关 → 配置数采工程 → 绘制组态 → 配置数采规则 → 数据调试；五项齐备才算接入完成') }}</p>
      </div>
      <p class="dc-source">{{ tt('数据来源：数采网关上报（DC-Ingest 接口），未接入设备显示为离线') }}</p>
    </header>

    <section class="dc-kpis">
      <article v-for="k in kpiCards" :key="k.key" class="dc-kpi">
        <span class="dc-kpi-label">{{ tt(k.label) }}</span>
        <strong class="dc-kpi-num" :class="'tone-' + k.tone">{{ k.value }}</strong>
        <span class="dc-kpi-hint">{{ tt(k.hint) }}</span>
      </article>
    </section>

    <div class="dc-bar">
      <el-button v-if="canWrite" type="primary" @click="openDevice(null)">
        <el-icon><Plus /></el-icon><span class="dc-btn-txt">{{ tt('新增设备') }}</span>
      </el-button>
      <el-button v-if="canWrite" @click="openGateway(null)">
        <el-icon><Connection /></el-icon><span class="dc-btn-txt">{{ tt('新增网关') }}</span>
      </el-button>
      <span v-else class="dc-readonly-tip">{{ tt('配置维护仅管理员可操作，当前为只读查看') }}</span>
      <el-button @click="ingestHelp = true">{{ tt('数据接入说明') }}</el-button>
      <el-input
        v-model="keyword"
        class="dc-search"
        clearable
        :placeholder="tt('搜索设备编码 / 名称 / 网关')"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-checkbox v-model="onlyUnfinished">{{ tt('只看未完成') }}</el-checkbox>
      <el-button :loading="loading" @click="load(true)">{{ tt('刷新') }}</el-button>
    </div>

    <section class="dc-card">
      <div class="dc-card-head">
        <h2 class="dc-card-title">{{ tt('设备五连检查') }}</h2>
        <span class="dc-card-tip">{{ tt('✓ 已完成 / ✗ 未完成；缺哪一项看「缺失提示」列') }}</span>
      </div>
      <el-table
        v-loading="loading"
        :data="rows"
        border
        size="small"
        row-key="id"
        class="dc-table"
        :empty-text="tt('尚未登记采集设备；电子秤 / 看板 / 扫码枪可在此新增')"
      >
        <el-table-column :label="tt('设备编码')" prop="code" min-width="108" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="dc-dot" :class="row.online ? 'on' : 'off'" :title="row.online ? tt('在线') : tt('离线')"></span>
            <span class="dc-code">{{ row.code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('设备名称')" prop="name" min-width="132" show-overflow-tooltip />
        <el-table-column :label="tt('类型')" prop="type" width="96">
          <template #default="{ row }">
            <span class="dc-muted">{{ row.type ? tt(row.type) : '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('网关')" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.gatewayName || row.gatewayId">{{ row.gatewayName || row.gatewayId }}</span>
            <el-tag v-else type="info" size="small" effect="plain">{{ tt('未绑定') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('五连检查')" width="188" align="center">
          <template #default="{ row }">
            <span class="dc-checks">
              <el-tooltip v-for="c in CHECKS" :key="c.key" :content="tt(c.label)" placement="top">
                <span class="dc-check" :class="isChecked(row, c.key) ? 'ok' : 'no'">
                  <el-icon><Check v-if="isChecked(row, c.key)" /><Close v-else /></el-icon>
                </span>
              </el-tooltip>
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('完成度')" width="146">
          <template #default="{ row }">
            <el-progress :percentage="pct(row.progress)" :stroke-width="10" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('缺失提示')" min-width="150">
          <template #default="{ row }">
            <el-tag v-if="tipOf(row)" type="warning" size="small" effect="plain">{{ tipOf(row) }}</el-tag>
            <el-tag v-else-if="pct(row.progress) >= 100" type="success" size="small" effect="plain">{{ tt('配置齐备') }}</el-tag>
            <span v-else class="dc-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('采集点')" width="86" align="center">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" @click="openPoints(row)">{{ row.pointCount ?? 0 }}</el-button>
            <span v-else class="dc-muted">{{ row.pointCount ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('数采规则')" width="92" align="center">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" @click="openRules(row)">{{ row.ruleCount ?? 0 }}</el-button>
            <span v-else class="dc-muted">{{ row.ruleCount ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="canWrite" :label="tt('操作')" width="238" fixed="right">
          <template #default="{ row }">
            <span class="dc-row-btns">
              <el-button size="small" @click="openDevice(row)">{{ tt('编辑') }}</el-button>
              <el-button size="small" :disabled="isChecked(row, 'debug')" :loading="debuggingId === row.id" @click="markDebugged(row)">
                {{ tt('标记调试完成') }}
              </el-button>
              <el-button size="small" type="danger" plain @click="removeDevice(row)">{{ tt('删除') }}</el-button>
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="dc-card">
      <div class="dc-card-head">
        <h2 class="dc-card-title">{{ tt('数采网关') }}</h2>
        <span class="dc-card-tip">{{ tt('设备需绑定网关才能上报数据；地址 / 端口由硬件接入时填写') }}</span>
      </div>
      <el-table :data="gateways" border size="small" class="dc-table" :empty-text="tt('尚未登记网关；设备接入前请先新增网关')">
        <el-table-column :label="tt('网关编码')" prop="code" min-width="110" show-overflow-tooltip />
        <el-table-column :label="tt('网关名称')" prop="name" min-width="130" show-overflow-tooltip />
        <el-table-column :label="tt('通信协议')" width="112">
          <template #default="{ row }"><span class="dc-muted">{{ row.protocol || '-' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('地址')" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ addressOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="92">
          <template #default="{ row }">
            <el-tag :type="row.enabled === false ? 'info' : row.status ? 'success' : 'warning'" size="small" effect="plain">
              {{ gatewayStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('最近上报')" width="152">
          <template #default="{ row }"><span class="dc-muted">{{ fmtAt(row.lastSeenAt) }}</span></template>
        </el-table-column>
        <el-table-column v-if="canWrite" :label="tt('操作')" width="150" fixed="right">
          <template #default="{ row }">
            <span class="dc-row-btns">
              <el-button size="small" @click="openGateway(row)">{{ tt('编辑') }}</el-button>
              <el-button size="small" type="danger" plain @click="removeGateway(row)">{{ tt('删除') }}</el-button>
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <!-- 设备对话框 -->
    <el-dialog v-model="deviceDialog" :title="deviceForm.id ? tt('编辑设备') : tt('新增设备')" width="min(680px, 94vw)" append-to-body>
      <el-form :model="deviceForm" label-width="96px" class="dc-form" @submit.prevent>
        <el-form-item :label="tt('设备编码')" required>
          <el-input v-model="deviceForm.code" :placeholder="tt('如 SCALE-01，唯一')" maxlength="32" />
        </el-form-item>
        <el-form-item :label="tt('设备名称')" required>
          <el-input v-model="deviceForm.name" :placeholder="tt('如 一号线电子秤')" maxlength="64" />
        </el-form-item>
        <el-form-item :label="tt('设备类型')">
          <el-select v-model="deviceForm.type" class="dc-full" filterable allow-create default-first-option :placeholder="tt('选择或输入类型')">
            <el-option v-for="o in DEVICE_TYPES" :key="o" :label="tt(o)" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('规格型号')">
          <el-input v-model="deviceForm.model" maxlength="64" :placeholder="tt('选填')" />
        </el-form-item>
        <el-form-item :label="tt('出厂编号')">
          <el-input v-model="deviceForm.serialNo" maxlength="64" :placeholder="tt('选填')" />
        </el-form-item>
        <el-form-item :label="tt('所属网关')">
          <el-select v-model="deviceForm.gatewayId" class="dc-full" clearable :placeholder="tt('未绑定')">
            <el-option v-for="g in gateways" :key="g.id" :label="gatewayLabel(g)" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('IP 地址')">
          <el-input v-model="deviceForm.ip" maxlength="64" :placeholder="tt('如 192.168.1.20')" />
        </el-form-item>
        <el-form-item :label="tt('端口')">
          <el-input v-model="deviceForm.port" maxlength="8" :placeholder="tt('如 502')" />
        </el-form-item>
        <el-form-item :label="tt('所属车间')">
          <el-input v-model="deviceForm.workshop" maxlength="64" :placeholder="tt('选填')" />
        </el-form-item>
        <el-form-item :label="tt('数采工程')">
          <el-input v-model="deviceForm.projectCode" maxlength="64" :placeholder="tt('数采工程编码，选填')" />
        </el-form-item>
        <el-form-item :label="tt('已绘制组态')">
          <el-switch v-model="deviceForm.scadaDrawn" />
        </el-form-item>
        <el-form-item :label="tt('备注')" class="dc-span2">
          <el-input v-model="deviceForm.remark" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deviceDialog = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="savingDevice" @click="submitDevice">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- 网关对话框 -->
    <el-dialog v-model="gatewayDialog" :title="gatewayForm.id ? tt('编辑网关') : tt('新增网关')" width="min(560px, 94vw)" append-to-body>
      <el-form :model="gatewayForm" label-width="96px" class="dc-form" @submit.prevent>
        <el-form-item :label="tt('网关编码')" required>
          <el-input v-model="gatewayForm.code" :placeholder="tt('如 DC-GW-01，唯一')" maxlength="32" />
        </el-form-item>
        <el-form-item :label="tt('网关名称')" required>
          <el-input v-model="gatewayForm.name" maxlength="64" :placeholder="tt('如 一号车间网关')" />
        </el-form-item>
        <el-form-item :label="tt('通信协议')">
          <el-select v-model="gatewayForm.protocol" class="dc-full" filterable allow-create default-first-option :placeholder="tt('选择或输入协议')">
            <el-option v-for="o in GATEWAY_PROTOCOLS" :key="o" :label="tt(o)" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('地址')">
          <el-input v-model="gatewayForm.host" maxlength="64" :placeholder="tt('IP 或域名')" />
        </el-form-item>
        <el-form-item :label="tt('端口')">
          <el-input v-model="gatewayForm.port" maxlength="8" :placeholder="tt('如 8899')" />
        </el-form-item>
        <el-form-item :label="tt('备注')" class="dc-span2">
          <el-input v-model="gatewayForm.remark" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gatewayDialog = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="savingGateway" @click="submitGateway">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- 采集点对话框:硬件上报报文里的 pointCode 必须先在这里登记 -->
    <el-dialog v-model="pointDialog" :title="pointTitle" width="min(820px, 96vw)" append-to-body>
      <p class="dc-dialog-tip">{{ tt('采集点编码就是硬件上报报文里的 pointCode，须与设备侧一致；未登记的采集点上报会被拒绝') }}</p>
      <el-form :model="pointForm" label-width="100px" class="dc-form dc-form-3" @submit.prevent>
        <el-form-item :label="tt('采集点编码')" required>
          <el-input v-model="pointForm.code" maxlength="32" :placeholder="tt('如 weight')" />
        </el-form-item>
        <el-form-item :label="tt('采集点名称')" required>
          <el-input v-model="pointForm.name" maxlength="64" :placeholder="tt('如 重量')" />
        </el-form-item>
        <el-form-item :label="tt('数据类型')">
          <el-select v-model="pointForm.dataType" class="dc-full">
            <el-option v-for="o in DATA_TYPES" :key="o" :label="tt(o)" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('单位')">
          <el-input v-model="pointForm.unit" maxlength="16" :placeholder="tt('如 kg')" />
        </el-form-item>
        <el-form-item :label="tt('采集频率(秒)')">
          <el-input v-model="pointForm.freqSeconds" maxlength="6" />
        </el-form-item>
        <el-form-item :label="tt('下限')">
          <el-input v-model="pointForm.lowLimit" maxlength="12" :placeholder="tt('选填，越限报警用')" />
        </el-form-item>
        <el-form-item :label="tt('上限')">
          <el-input v-model="pointForm.highLimit" maxlength="12" :placeholder="tt('选填，越限报警用')" />
        </el-form-item>
        <el-form-item class="dc-span2">
          <el-button type="primary" :loading="savingPoint" @click="submitPoint">
            {{ pointForm.id ? tt('保存') : tt('新增采集点') }}
          </el-button>
          <el-button v-if="pointForm.id" @click="pointForm = emptyPoint()">{{ tt('取消编辑') }}</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="pointLoading" :data="points" border size="small" class="dc-table" :empty-text="tt('该设备尚未登记采集点')">
        <el-table-column :label="tt('采集点编码')" prop="code" min-width="110" show-overflow-tooltip />
        <el-table-column :label="tt('采集点名称')" prop="name" min-width="110" show-overflow-tooltip />
        <el-table-column :label="tt('数据类型')" width="92">
          <template #default="{ row }"><span class="dc-muted">{{ tt(row.dataType || '-') }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('单位')" width="72">
          <template #default="{ row }"><span class="dc-muted">{{ dash(row.unit) }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('下限')" width="72">
          <template #default="{ row }"><span class="dc-muted">{{ dash(row.lowLimit) }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('上限')" width="72">
          <template #default="{ row }"><span class="dc-muted">{{ dash(row.highLimit) }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('采集频率(秒)')" width="104" align="right">
          <template #default="{ row }"><span class="dc-muted">{{ row.freqSeconds ?? '-' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="132" fixed="right">
          <template #default="{ row }">
            <span class="dc-row-btns">
              <el-button size="small" @click="editPoint(row)">{{ tt('编辑') }}</el-button>
              <el-button size="small" type="danger" plain @click="removePoint(row)">{{ tt('删除') }}</el-button>
            </span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="pointDialog = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <!-- 数采规则对话框:配齐后「配置数采规则」一项才算完成 -->
    <el-dialog v-model="ruleDialog" :title="ruleTitle" width="min(760px, 96vw)" append-to-body>
      <p class="dc-dialog-tip">{{ tt('至少一条启用状态的规则，设备「配置数采规则」一项才算完成；报警级别由后端按规则判定') }}</p>
      <el-form :model="ruleForm" label-width="100px" class="dc-form" @submit.prevent>
        <el-form-item :label="tt('规则名称')" required>
          <el-input v-model="ruleForm.name" maxlength="64" :placeholder="tt('如 重量越限报警')" />
        </el-form-item>
        <el-form-item :label="tt('规则类型')">
          <el-select v-model="ruleForm.ruleType" class="dc-full">
            <el-option v-for="o in RULE_TYPES" :key="o" :label="tt(o)" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('规则表达式')" class="dc-span2">
          <el-input v-model="ruleForm.expression" maxlength="200" :placeholder="tt('如 value &gt; 50')" />
        </el-form-item>
        <el-form-item :label="tt('参数')">
          <el-input v-model="ruleForm.params" maxlength="200" :placeholder="tt('选填，如 采样次数=3')" />
        </el-form-item>
        <el-form-item :label="tt('启用')">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
        <el-form-item class="dc-span2">
          <el-button type="primary" :loading="savingRule" @click="submitRule">
            {{ ruleForm.id ? tt('保存') : tt('新增规则') }}
          </el-button>
          <el-button v-if="ruleForm.id" @click="ruleForm = emptyRule()">{{ tt('取消编辑') }}</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="ruleLoading" :data="rules" border size="small" class="dc-table" :empty-text="tt('该设备尚未配置数采规则')">
        <el-table-column :label="tt('规则名称')" prop="name" min-width="130" show-overflow-tooltip />
        <el-table-column :label="tt('规则类型')" width="104">
          <template #default="{ row }"><span class="dc-muted">{{ tt(row.ruleType || '-') }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('规则表达式')" min-width="150" show-overflow-tooltip>
          <template #default="{ row }"><span class="dc-muted">{{ row.expression || '-' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('启用')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="plain">{{ row.enabled ? tt('启用') : tt('停用') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="132" fixed="right">
          <template #default="{ row }">
            <span class="dc-row-btns">
              <el-button size="small" @click="editRule(row)">{{ tt('编辑') }}</el-button>
              <el-button size="small" type="danger" plain @click="removeRule(row)">{{ tt('删除') }}</el-button>
            </span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="ruleDialog = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <!-- 硬件接入说明 -->
    <el-dialog v-model="ingestHelp" :title="tt('数据接入说明')" width="min(680px, 94vw)" append-to-body>
      <div class="dc-help">
        <p class="dc-help-p">{{ tt('本模块只做配置与展示；实时数据由数采网关（或边缘程序）调用下列接口上报，未上报的设备一律显示离线。') }}</p>
        <h3 class="dc-help-h">{{ tt('① 首次上报前先登记') }}</h3>
        <p class="dc-help-p">{{ tt('在「设备配置管理」里登记网关与设备，网关编码 / 设备编码是上报时的唯一标识。') }}</p>
        <h3 class="dc-help-h">{{ tt('② 数据上报') }}</h3>
        <pre class="dc-code">POST /api/dc/ingest
{
  "gatewayCode": "DC-GW-01",
  "deviceCode": "SCALE-01",
  "values": [ { "pointCode": "weight", "value": 12.35 } ]
}</pre>
        <h3 class="dc-help-h">{{ tt('③ 心跳') }}</h3>
        <pre class="dc-code">POST /api/dc/heartbeat
{ "deviceCode": "SCALE-01" }</pre>
        <p class="dc-help-p">{{ tt('上报后「数据监控」会出现采集点与实时值；报警由后端按数采规则判定。') }}</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="ingestHelp = false">{{ tt('知道了') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'
import {
  apiDeleteDcDevice,
  apiDeleteDcGateway,
  apiDeleteDcPoint,
  apiDeleteDcRule,
  apiGetDcConfig,
  apiGetDcPoints,
  apiGetDcRules,
  apiMarkDcDebugged,
  apiSaveDcDevice,
  apiSaveDcGateway,
  apiSaveDcPoint,
  apiSaveDcRule,
} from '@/business/dcApi'

// 写操作仅管理员:后端 DcController 的保存/删除/标记调试均 requireAdmin
const user = useUserStore()
const canWrite = computed(() => user.isAdmin === true)

// 五连检查:顺序即业务顺序(网关 → 工程 → 组态 → 规则 → 调试)
const CHECKS = [
  { key: 'gateway', label: '绑定网关' },
  { key: 'project', label: '配置数采工程' },
  { key: 'scada', label: '绘制组态' },
  { key: 'rule', label: '配置数采规则' },
  { key: 'debug', label: '数据调试' },
]
// 设备类型候选(可选可输入)。2026-10-19 补生产设备口径:联网设备台账按「注塑机/机械手/干燥机/
//   加工设备/产线/检测设备/隔音设施/包装设备/公用设备/办公终端」归类导入(见
//   tools/migrate-dc-device-import-20261019.sql),候选项同步,人工新增时不用手敲。
const DEVICE_TYPES = ['电子秤', '看板', '扫码枪', '温湿度计', 'PLC', '注塑机', '机械手', '干燥机',
  '加工设备', '产线', '检测设备', '隔音设施', '包装设备', '公用设备', '办公终端', '其他']
const GATEWAY_PROTOCOLS = ['MODBUS-TCP', 'MODBUS-RTU', 'MQTT', 'HTTP', 'OPC-UA', '串口/RS485']

const loading = ref(false)
const kpis = ref({})
const gateways = ref([])
const devices = ref([])
const keyword = ref('')
const onlyUnfinished = ref(false)
const debuggingId = ref(null)

const deviceDialog = ref(false)
const gatewayDialog = ref(false)
const ingestHelp = ref(false)
const savingDevice = ref(false)
const savingGateway = ref(false)

function emptyDevice() {
  return {
    id: null, code: '', name: '', type: '电子秤', model: '', serialNo: '',
    gatewayId: '', ip: '', port: '', workshop: '', projectCode: '', scadaDrawn: false, remark: '',
  }
}
function emptyGateway() {
  return { id: null, code: '', name: '', protocol: 'MODBUS-TCP', host: '', port: '', remark: '' }
}
const deviceForm = ref(emptyDevice())
const gatewayForm = ref(emptyGateway())

const kpiCards = computed(() => {
  const k = kpis.value || {}
  const total = typeof k.deviceTotal === 'number' ? k.deviceTotal : devices.value.length
  const bound = typeof k.gatewayBound === 'number' ? k.gatewayBound : devices.value.filter((d) => isChecked(d, 'gateway')).length
  const fully = typeof k.fullyReady === 'number' ? k.fullyReady : devices.value.filter((d) => pct(d.progress) >= 100).length
  const unfinished = Math.max(0, total - fully)
  return [
    { key: 'total', label: '设备总数', value: total, tone: 'primary', hint: '已登记的采集设备' },
    { key: 'bound', label: '已绑定网关', value: bound, tone: 'ok', hint: '网关一项已完成' },
    { key: 'fully', label: '配置齐备', value: fully, tone: 'ok', hint: '五连全部完成' },
    { key: 'unfinished', label: '未完成', value: unfinished, tone: unfinished > 0 ? 'warn' : 'ok', hint: '至少缺一项，见下表' },
    { key: 'gateway', label: '网关数量', value: gateways.value.length, tone: 'neutral', hint: '已登记的数采网关' },
  ]
})

const rows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return devices.value.filter((d) => {
    if (onlyUnfinished.value && pct(d.progress) >= 100) return false
    if (!kw) return true
    return [d.code, d.name, d.type, d.gatewayName, d.workshop, d.projectCode]
      .some((v) => String(v || '').toLowerCase().includes(kw))
  })
})

function isChecked(row, key) {
  return !!(row && row.checks && row.checks[key])
}
function pct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}
/** 缺失提示:优先用后端 missingTip(中文、、连接),缺失时按五连本地拼装 */
function tipOf(row) {
  if (row && row.missingTip) return tt(row.missingTip)
  if (pct(row?.progress) >= 100) return ''
  return CHECKS.filter((c) => !isChecked(row, c.key)).map((c) => tt(c.label)).join('、')
}
function fmtAt(v) {
  if (!v) return '-'
  return String(v).replace('T', ' ').slice(0, 19)
}
function addressOf(row) {
  const host = row?.host || ''
  const port = row?.port || ''
  if (!host && !port) return '-'
  return port ? host + ':' + port : host
}
function gatewayLabel(g) {
  if (!g) return ''
  return g.code ? g.code + ' · ' + (g.name || '') : g.name || String(g.id)
}
function gatewayStatusText(row) {
  if (row.enabled === false) return tt('已停用')
  return row.status ? tt('在线') : tt('离线')
}

async function load(showToast) {
  loading.value = true
  try {
    const data = await apiGetDcConfig()
    kpis.value = data?.kpis || {}
    gateways.value = Array.isArray(data?.gateways) ? data.gateways : []
    devices.value = Array.isArray(data?.devices) ? data.devices : []
    if (showToast) ElMessage.success(tt('已刷新'))
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载数采配置失败'))
  } finally {
    loading.value = false
  }
}

function openDevice(row) {
  if (row) {
    deviceForm.value = {
      id: row.id ?? null,
      code: row.code || '',
      name: row.name || '',
      type: row.type || '',
      model: row.model || '',
      serialNo: row.serialNo || '',
      gatewayId: row.gatewayId ?? '',
      ip: row.ip || '',
      port: row.port === null || row.port === undefined ? '' : String(row.port),
      workshop: row.workshop || '',
      projectCode: row.projectCode || '',
      scadaDrawn: !!row.scadaDrawn,
      remark: row.remark || '',
    }
  } else {
    deviceForm.value = emptyDevice()
  }
  deviceDialog.value = true
}

function openGateway(row) {
  gatewayForm.value = row
    ? {
        id: row.id ?? null,
        code: row.code || '',
        name: row.name || '',
        protocol: row.protocol || '',
        host: row.host || '',
        port: row.port === null || row.port === undefined ? '' : String(row.port),
        remark: row.remark || '',
      }
    : emptyGateway()
  gatewayDialog.value = true
}

async function submitDevice() {
  const f = deviceForm.value
  if (!f.code.trim()) return ElMessage.warning(tt('请填写设备编码'))
  if (!f.name.trim()) return ElMessage.warning(tt('请填写设备名称'))
  const body = {
    code: f.code.trim(),
    name: f.name.trim(),
    type: f.type,
    model: f.model,
    serialNo: f.serialNo,
    gatewayId: f.gatewayId === '' ? null : f.gatewayId,
    ip: f.ip,
    port: f.port === '' ? null : Number(f.port),
    workshop: f.workshop,
    projectCode: f.projectCode,
    scadaDrawn: !!f.scadaDrawn,
    remark: f.remark,
  }
  if (f.id) body.id = f.id
  savingDevice.value = true
  try {
    await apiSaveDcDevice(body)
    deviceDialog.value = false
    ElMessage.success(tt('保存成功'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存设备失败'))
  } finally {
    savingDevice.value = false
  }
}

async function submitGateway() {
  const f = gatewayForm.value
  if (!f.code.trim()) return ElMessage.warning(tt('请填写网关编码'))
  if (!f.name.trim()) return ElMessage.warning(tt('请填写网关名称'))
  const body = {
    code: f.code.trim(),
    name: f.name.trim(),
    protocol: f.protocol,
    host: f.host,
    port: f.port === '' ? null : Number(f.port),
    remark: f.remark,
  }
  if (f.id) body.id = f.id
  savingGateway.value = true
  try {
    await apiSaveDcGateway(body)
    gatewayDialog.value = false
    ElMessage.success(tt('保存成功'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存网关失败'))
  } finally {
    savingGateway.value = false
  }
}

async function removeDevice(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除后该设备的采集点与报警记录不再展示，确认删除？'),
      tt('删除设备'),
      { confirmButtonText: tt('确认删除'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await apiDeleteDcDevice(row.id)
    ElMessage.success(tt('删除成功'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('删除设备失败'))
  }
}

async function removeGateway(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除后绑定该网关的设备将变为未绑定，确认删除？'),
      tt('删除网关'),
      { confirmButtonText: tt('确认删除'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await apiDeleteDcGateway(row.id)
    ElMessage.success(tt('删除成功'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('删除网关失败'))
  }
}

async function markDebugged(row) {
  debuggingId.value = row.id
  try {
    await apiMarkDcDebugged(row.id)
    ElMessage.success(tt('已标记数据调试完成'))
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('标记调试失败'))
  } finally {
    debuggingId.value = null
  }
}

// ── 采集点 / 数采规则维护(硬件上报报文里的 pointCode 必须先登记,否则 ingest 被拒) ──
const DATA_TYPES = ['数值', '布尔', '文本']
const RULE_TYPES = ['定时采集', '变化上报', '越限报警']

const pointDialog = ref(false)
const pointDevice = ref(null)
const points = ref([])
const pointLoading = ref(false)
const savingPoint = ref(false)
const pointForm = ref(emptyPoint())

const ruleDialog = ref(false)
const ruleDevice = ref(null)
const rules = ref([])
const ruleLoading = ref(false)
const savingRule = ref(false)
const ruleForm = ref(emptyRule())

const pointTitle = computed(() => tt('采集点') + ' · ' + deviceLabel(pointDevice.value))
const ruleTitle = computed(() => tt('数采规则') + ' · ' + deviceLabel(ruleDevice.value))

function deviceLabel(d) {
  if (!d) return ''
  return d.code ? d.code + ' · ' + (d.name || '') : d.name || String(d.id)
}
function dash(v) {
  return v === null || v === undefined || v === '' ? '-' : v
}
function emptyPoint() {
  return {
    id: null, code: '', name: '', dataType: '数值', unit: '',
    lowLimit: '', highLimit: '', freqSeconds: 5, remark: '',
  }
}
function emptyRule() {
  return { id: null, name: '', ruleType: '定时采集', expression: '', params: '', enabled: true, remark: '' }
}
function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function loadPoints() {
  const id = pointDevice.value?.id
  if (!id) return
  pointLoading.value = true
  try {
    const list = await apiGetDcPoints(id)
    points.value = Array.isArray(list) ? list : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载采集点失败'))
  } finally {
    pointLoading.value = false
  }
}
async function loadRules() {
  const id = ruleDevice.value?.id
  if (!id) return
  ruleLoading.value = true
  try {
    const list = await apiGetDcRules(id)
    rules.value = Array.isArray(list) ? list : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载数采规则失败'))
  } finally {
    ruleLoading.value = false
  }
}

async function openPoints(row) {
  pointDevice.value = row || null
  pointForm.value = emptyPoint()
  points.value = []
  pointDialog.value = true
  await loadPoints()
}
async function openRules(row) {
  ruleDevice.value = row || null
  ruleForm.value = emptyRule()
  rules.value = []
  ruleDialog.value = true
  await loadRules()
}

function editPoint(row) {
  pointForm.value = {
    id: row.id ?? null,
    code: row.code || '',
    name: row.name || '',
    dataType: row.dataType || '数值',
    unit: row.unit || '',
    lowLimit: row.lowLimit === null || row.lowLimit === undefined ? '' : String(row.lowLimit),
    highLimit: row.highLimit === null || row.highLimit === undefined ? '' : String(row.highLimit),
    freqSeconds: row.freqSeconds ?? 5,
    remark: row.remark || '',
  }
}
function editRule(row) {
  ruleForm.value = {
    id: row.id ?? null,
    name: row.name || '',
    ruleType: row.ruleType || '定时采集',
    expression: row.expression || '',
    params: row.params || '',
    enabled: row.enabled !== false,
    remark: row.remark || '',
  }
}

async function submitPoint() {
  const d = pointDevice.value
  if (!d?.id) return
  const fm = pointForm.value
  if (!String(fm.code || '').trim()) return ElMessage.warning(tt('请填写采集点编码'))
  if (!String(fm.name || '').trim()) return ElMessage.warning(tt('请填写采集点名称'))
  const body = {
    deviceId: d.id,
    code: String(fm.code).trim(),
    name: String(fm.name).trim(),
    dataType: fm.dataType,
    unit: fm.unit || '',
    freqSeconds: numOrNull(fm.freqSeconds) ?? 5,
    lowLimit: numOrNull(fm.lowLimit),
    highLimit: numOrNull(fm.highLimit),
    remark: fm.remark || '',
  }
  if (fm.id) body.id = fm.id
  savingPoint.value = true
  try {
    await apiSaveDcPoint(body)
    ElMessage.success(tt('保存成功'))
    pointForm.value = emptyPoint()
    await loadPoints()
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存采集点失败'))
  } finally {
    savingPoint.value = false
  }
}
async function submitRule() {
  const d = ruleDevice.value
  if (!d?.id) return
  const fm = ruleForm.value
  if (!String(fm.name || '').trim()) return ElMessage.warning(tt('请填写规则名称'))
  const body = {
    deviceId: d.id,
    name: String(fm.name).trim(),
    ruleType: fm.ruleType,
    expression: fm.expression || '',
    params: fm.params || '',
    enabled: fm.enabled !== false,
    remark: fm.remark || '',
  }
  if (fm.id) body.id = fm.id
  savingRule.value = true
  try {
    await apiSaveDcRule(body)
    ElMessage.success(tt('保存成功'))
    ruleForm.value = emptyRule()
    await loadRules()
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存数采规则失败'))
  } finally {
    savingRule.value = false
  }
}

async function removePoint(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除后该采集点的历史采样仍保留，确认删除？'),
      tt('删除采集点'),
      { confirmButtonText: tt('确认删除'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await apiDeleteDcPoint(row.id)
    ElMessage.success(tt('删除成功'))
    if (pointForm.value.id === row.id) pointForm.value = emptyPoint()
    await loadPoints()
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('删除采集点失败'))
  }
}
async function removeRule(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除规则后该设备可能不再满足「配置数采规则」，确认删除？'),
      tt('删除数采规则'),
      { confirmButtonText: tt('确认删除'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await apiDeleteDcRule(row.id)
    ElMessage.success(tt('删除成功'))
    if (ruleForm.value.id === row.id) ruleForm.value = emptyRule()
    await loadRules()
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('删除数采规则失败'))
  }
}

onMounted(() => load())
</script>

<style scoped>
.dc-page {
  --dc-ok: #1f8a5b;
  --dc-warn: #b87816;
  --dc-bad: #b94d3f;
  --dc-ic: #537786;
  padding: 14px 16px 24px;
  min-width: 0;
  color: var(--t-text-1);
}
.dc-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}
.dc-head-main { min-width: 0; }
.dc-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--t-text-1); }
.dc-sub { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--t-text-3); }
.dc-source {
  margin: 0;
  flex: 1 1 320px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--t-text-3);
  text-align: right;
}
.dc-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.dc-kpi {
  min-width: 0;
  padding: 10px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.dc-kpi-label { display: block; font-size: 12px; color: var(--t-text-3); }
.dc-kpi-num {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--t-text-1);
}
.dc-kpi-num.tone-primary { color: var(--t-primary); }
.dc-kpi-num.tone-ok { color: var(--dc-ok); }
.dc-kpi-num.tone-warn { color: var(--dc-warn); }
.dc-kpi-num.tone-neutral { color: var(--t-text-2); }
.dc-kpi-hint { display: block; margin-top: 2px; font-size: 11px; color: var(--t-text-3); }
.dc-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.dc-readonly-tip { font-size: 12px; color: var(--t-text-3); }
.dc-bar :deep(.el-button) { min-height: 40px; }
.dc-btn-txt { margin-left: 4px; }
.dc-search { width: 240px; max-width: 100%; }
.dc-search :deep(.el-input__wrapper) { min-height: 40px; }
.dc-card {
  min-width: 0;
  margin-bottom: 12px;
  padding: 10px 12px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.dc-card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dc-card-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--t-primary); }
.dc-card-tip { font-size: 12px; color: var(--t-text-3); }
.dc-table { width: 100%; }
.dc-table :deep(.el-table__cell) { padding: 5px 0; }
.dc-row-btns { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.dc-row-btns :deep(.el-button) { min-height: 40px; margin-left: 0; }
.dc-code { font-variant-numeric: tabular-nums; }
.dc-muted { color: var(--t-text-3); }
.dc-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: middle;
}
.dc-dot.on { background: var(--dc-ok); }
.dc-dot.off { background: var(--t-text-3); }
.dc-checks { display: inline-flex; gap: 4px; align-items: center; }
.dc-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 13px;
  cursor: default;
}
.dc-check.ok { color: var(--dc-ok); background: rgba(31, 138, 91, 0.12); }
.dc-check.no { color: var(--dc-bad); background: rgba(185, 77, 63, 0.12); }
.dc-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.dc-span2 { grid-column: 1 / -1; }
.dc-full { width: 100%; }
.dc-dialog-tip { margin: 0 0 10px; font-size: 12px; line-height: 1.5; color: var(--t-text-3); }
.dc-form-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 12px; }
.dc-form-3 .dc-span2 { grid-column: span 2; }
.dc-form.dc-form-3 .dc-span2 { grid-column: span 2; }
.dc-help-p { margin: 6px 0; font-size: 13px; line-height: 1.6; color: var(--t-text-2); }
.dc-help-h { margin: 12px 0 4px; font-size: 13px; font-weight: 600; color: var(--t-text-1); }
.dc-code {
  margin: 4px 0;
  padding: 8px 10px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.55;
  color: var(--t-text-2);
  background: var(--t-sidebar-bg);
  border: 1px solid var(--t-border-light);
  border-radius: 4px;
}
@media (max-width: 900px) {
  .dc-form-3 { grid-template-columns: minmax(0, 1fr); }
  .dc-form-3 .dc-span2 { grid-column: span 1; }
}
@media (max-width: 640px) {
  .dc-form { grid-template-columns: minmax(0, 1fr); }
  .dc-source { text-align: left; }
  .dc-search { width: 100%; }
}
</style>

<style>
/* 非 scoped:el-dialog 被传送到 body,scoped 选择器覆盖不到 */
html.dark .dc-page {
  --dc-ok: #58b09e;
  --dc-warn: #e0a83a;
  --dc-bad: #d97364;
  --dc-ic: #8fadb9;
}
</style>
