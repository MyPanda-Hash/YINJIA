<!-- ============================================================================
     SupplierAccount.vue — 采购管理 · 供应商权限配置(2026-10-24,管理员专属)
     ----------------------------------------------------------------------------
     用户口径:「采购管理里面多增加俩个面版……一个是供应商权限配置。供应商可以通过登录
     供应商配置的账号登录进来,只能看到供应商采购打印面版(和对应供应商编码的数据)。」
     这里就是"供应商配置账号"的地方:给某个供应商开一个登录账号 → 他登录后只能看/打自己的采购订单。

     一行 = 一个供应商账号:账号 / 绑定供应商(编码+名称) / 启停 / 最近一次登录 / 备注。
     写操作全部走后端 requireAdmin(菜单 adminOnly、路由 requireAdmin、服务端 perm.requireAdmin 三层同源)。
     停用 = 立即生效(登录被拒 + 已登录的会话在下一次请求就被 SupplierPortalGuardFilter 挡住)。
     ============================================================================ -->
<template>
  <div class="sa-page">
    <div class="sa-head">
      <div class="sa-head-main">
        <span class="sa-title">{{ tt('供应商权限配置') }}</span>
        <el-tag v-if="!user.isAdmin" size="small" type="success">{{ tt('已授权') }}</el-tag>
        <el-tag v-if="stats.ledger" size="small" type="warning">{{ ledgerName }}</el-tag>
      </div>
      <div class="sa-head-tools">
        <el-button size="small" :loading="loading" @click="load">{{ tt('刷新') }}</el-button>
        <el-button type="primary" size="small" @click="openCreate">{{ tt('新增供应商账号') }}</el-button>
      </div>
    </div>

    <div class="sa-tip">
      {{ tt('供应商账号登录后只能看到「供应商采购打印」一页,只能查看和打印所绑定供应商编码名下的采购订单,没有其它任何权限。') }}
    </div>
    <div class="sa-tip">
      {{ tt('谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。') }}
    </div>

    <!-- 顶部统计 -->
    <div class="sa-stats">
      <div class="sa-stat"><span class="sa-stat-n">{{ stats.accounts ?? '-' }}</span><span class="sa-stat-l">{{ tt('供应商账号') }}</span></div>
      <div class="sa-stat"><span class="sa-stat-n">{{ stats.enabled ?? '-' }}</span><span class="sa-stat-l">{{ tt('已启用') }}</span></div>
      <div class="sa-stat"><span class="sa-stat-n">{{ stats.suppliers ?? '-' }}</span><span class="sa-stat-l">{{ tt('涉及供应商') }}</span></div>
      <div class="sa-stat"><span class="sa-stat-n">{{ stats.prints30d ?? '-' }}</span><span class="sa-stat-l">{{ tt('近30天打印次数') }}</span></div>
    </div>

    <!-- 查询 -->
    <div class="sa-filter">
      <el-input v-model="filter.keyword" clearable class="sa-kw" :placeholder="tt('搜索账号 / 供应商编码 / 供应商名称')"
        @keyup.enter="load" @clear="load">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button type="primary" size="default" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" border stripe size="small"
      :empty-text="loading ? tt('加载中…') : (denied || tt('还没有供应商账号,点右上角「新增供应商账号」'))">
      <el-table-column :label="tt('账号')" prop="userName" min-width="140" show-overflow-tooltip />
      <el-table-column :label="tt('供应商编码')" prop="supplierCode" width="130" />
      <el-table-column :label="tt('供应商名称')" prop="supplierName" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.supplierName || '-' }}</template>
      </el-table-column>
      <el-table-column :label="tt('姓名')" prop="realName" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('联系电话')" width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.phone || '—' }}</template>
      </el-table-column>
      <el-table-column :label="tt('状态')" width="96" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enabled === '1' && row.userEnabled === '1' ? 'success' : 'info'">
            {{ row.enabled === '1' && row.userEnabled === '1' ? tt('启用') : tt('停用') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="tt('创建时间')" prop="createAt" width="160" />
      <el-table-column :label="tt('创建人')" prop="createBy" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('备注')" prop="remark" min-width="160" show-overflow-tooltip />
      <el-table-column :label="tt('操作')" width="230" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">{{ tt('编辑') }}</el-button>
          <el-button link type="primary" size="small" @click="resetPwd(row)">{{ tt('重置密码') }}</el-button>
          <el-button link :type="row.enabled === '1' ? 'warning' : 'success'" size="small" @click="toggle(row)">
            {{ row.enabled === '1' ? tt('停用') : tt('启用') }}
          </el-button>
          <el-button link type="danger" size="small" @click="remove(row)">{{ tt('删除') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="dlg.visible" :title="dlg.id ? tt('编辑供应商账号') : tt('新增供应商账号')" width="580px" append-to-body>
      <el-form :model="dlg.form" label-width="110px" @submit.prevent>
        <!-- 2026-10-25 用户口径「新增应该弹窗关联供应商,然后选择后账号默认供应商编码(可修改)」:
             顺序 = **先选供应商**,账号随供应商自动带出,仍可手改(账号是登录名,允许与编码不同)。 -->
        <el-form-item :label="tt('供应商')" required>
          <el-select v-model="dlg.form.supplierCode" filterable remote clearable class="sa-sel"
            :remote-method="searchSuppliers" :loading="supplierLoading" :placeholder="tt('选择供应商(可输入编码或名称搜索)')"
            @change="onSupplierChange">
            <el-option v-for="s in suppliers" :key="s.code" :label="`${s.code} ${s.name}`" :value="s.code" />
          </el-select>
          <div class="sa-hint">{{ tt('选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。') }}</div>
        </el-form-item>
        <el-form-item :label="tt('账号')" required>
          <el-input v-model="dlg.form.userName" :disabled="!!dlg.id" maxlength="40"
            :placeholder="tt('默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)')" />
          <div v-if="dlg.id" class="sa-hint">{{ tt('账号创建后不可改名;如需换名,请新建账号并停用旧账号。') }}</div>
          <div v-else-if="autoFilledUser" class="sa-hint">{{ tt('已按供应商编码自动填写,可直接修改。') }}</div>
        </el-form-item>
        <el-form-item :label="tt('姓名')">
          <el-input v-model="dlg.form.realName" maxlength="60" :placeholder="tt('默认取供应商名称')" />
        </el-form-item>
        <el-form-item :label="tt('联系电话')">
          <el-input v-model="dlg.form.phone" maxlength="50" clearable
            :placeholder="tt('如 13800000000 / 0752-5583930')" />
        </el-form-item>
        <el-form-item :label="tt('登录密码')" :required="!dlg.id">
          <el-input v-model="dlg.form.password" type="password" show-password maxlength="40" autocomplete="new-password"
            :placeholder="dlg.id ? tt('留空则不修改') : tt('至少 6 位')" />
        </el-form-item>
        <el-form-item :label="tt('状态')">
          <el-switch v-model="dlg.form.enabled" :active-text="tt('启用')" :inactive-text="tt('停用')" />
          <span class="sa-hint sa-inline">{{ tt('停用后该账号立即无法登录,已登录的会话也会被挡下。') }}</span>
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="dlg.form.remark" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item :label="tt('权限')">
          <div class="sa-perm">{{ tt('供应商采购打印(只读 + 打印本公司采购订单)') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg.visible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

const user = useUserStore()

const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const suppliers = ref([])
const supplierLoading = ref(false)
const stats = reactive({})
const filter = reactive({ keyword: '' })
/** 无权限时的说明(不再是"只有管理员":组织架构授权的账号也能进,真拦下时要说清为什么) */
const denied = ref('')

const dlg = reactive({
  visible: false,
  id: null,
  form: { userName: '', supplierCode: '', realName: '', phone: '', password: '', enabled: true, remark: '' },
})

/**
 * 「账号是自动填的供应商编码」的标记(2026-10-25)。
 * 用于区分"用户还没动过账号"与"用户已经手改过":
 * 前者换供应商时跟着变,后者不覆盖(避免改到一半被冲掉)。
 */
const autoFilledUser = ref('')

const ledgerName = computed(() => (stats.ledger === 'YJ_TEST' ? tt('测试账套') : tt('正式账套')))

function apiMsg(e, fallback) {
  const body = e?.response?.data
  if (body?.message) return body.message
  return e?.message || fallback
}

async function load() {
  loading.value = true
  try {
    const [list, ov] = await Promise.all([
      request.get('/supplier/portal/accounts', { params: { keyword: filter.keyword || '' } }),
      request.get('/supplier/portal/accounts/overview'),
    ])
    // 后端 403 走 HTTP 200 + body code(GlobalExceptionHandler),这里必须显式判码,
    // 否则未授权账号会看到一张"空列表"而不是"没有权限"的说明。
    if (list?.code && list.code !== 200) throw new Error(list.message || tt('没有该面板的权限'))
    if (ov?.code && ov.code !== 200) throw new Error(ov.message || tt('没有该面板的权限'))
    rows.value = list?.data || []
    Object.assign(stats, ov?.data || {})
    denied.value = ''
  } catch (e) {
    denied.value = apiMsg(e, tt('加载供应商账号失败'))
    rows.value = []
    ElMessage.error(denied.value)
  } finally {
    loading.value = false
  }
}

async function searchSuppliers(keyword) {
  supplierLoading.value = true
  try {
    const r = await request.get('/supplier/portal/suppliers', { params: { keyword: keyword || '' } })
    suppliers.value = r?.data || []
  } catch (e) {
    suppliers.value = []
  } finally {
    supplierLoading.value = false
  }
}

/**
 * 选供应商后自动带出「账号 = 供应商编码」+「姓名 = 供应商名称」(2026-10-25 用户口径
 * 「新增应该弹窗关联供应商,然后选择后账号默认供应商编码(可修改)」)。
 *
 * 只在**新增**时预填账号,且只在当前账号为空、或仍是上一次自动填的值时才覆盖 ——
 * 用户如果已经手改过账号,就不该被后续换供应商冲掉(改到一半被覆盖很恼人)。
 * 账号规则是 3~40 位字母/数字/下划线/点/横线,供应商编码不满足时不预填,让用户手填。
 */
function onSupplierChange(code) {
  const hit = suppliers.value.find((s) => s.code === code)
  if (hit && !dlg.form.realName) dlg.form.realName = hit.name
  if (dlg.id) return                                    // 编辑态:账号不可改名,不预填
  const codeStr = String(code || '').trim()
  if (!codeStr) { autoFilledUser.value = ''; return }
  const untouched = !dlg.form.userName || dlg.form.userName === autoFilledUser.value
  if (!untouched) return                                // 用户已手改过,保留他的值
  if (!/^[A-Za-z0-9_.\-]{3,40}$/.test(codeStr)) { autoFilledUser.value = ''; return }
  dlg.form.userName = codeStr
  autoFilledUser.value = codeStr
}

function openCreate() {
  dlg.id = null
  autoFilledUser.value = ''
  dlg.form = { userName: '', supplierCode: '', realName: '', phone: '', password: '', enabled: true, remark: '' }
  dlg.visible = true
  searchSuppliers('')
}

function openEdit(row) {
  dlg.id = row.id
  autoFilledUser.value = ''
  dlg.form = {
    userName: row.userName,
    supplierCode: row.supplierCode,
    realName: row.realName,
    phone: row.phone || '',
    password: '',
    enabled: row.enabled === '1',
    remark: row.remark || '',
  }
  dlg.visible = true
  // 先放当前绑定进下拉,免得"打开编辑却看不到已选供应商"
  suppliers.value = [{ code: row.supplierCode, name: row.supplierName || '' }]
  searchSuppliers('')
}

async function save() {
  const f = dlg.form
  if (!f.userName || !f.supplierCode) return ElMessage.warning(tt('请填写账号与供应商'))
  if (!dlg.id && !f.password) return ElMessage.warning(tt('请设置登录密码'))
  if (f.password && f.password.length < 6) return ElMessage.warning(tt('新密码至少 6 位'))
  saving.value = true
  try {
    await request.post('/supplier/portal/accounts/save', {
      id: dlg.id || undefined,
      userName: f.userName,
      supplierCode: f.supplierCode,
      realName: f.realName,
      phone: f.phone,
      password: f.password,
      enabled: f.enabled ? '1' : '0',
      remark: f.remark,
    })
    ElMessage.success(tt('已保存'))
    dlg.visible = false
    autoFilledUser.value = ''
    await load()
  } catch (e) {
    ElMessage.error(apiMsg(e, tt('保存失败')))
  } finally {
    saving.value = false
  }
}

/** 启用/停用:停用是一条"立刻生效"的权限回收,做一次确认 */
async function toggle(row) {
  const next = row.enabled === '1' ? '0' : '1'
  try {
    if (next === '0') {
      await ElMessageBox.confirm(
        `${tt('停用后该供应商账号立即无法登录,已登录的会话也会被挡下。确定停用')}「${row.userName}」?`,
        tt('停用供应商账号'), { type: 'warning' })
    }
    await request.post('/supplier/portal/accounts/save', {
      id: row.id,
      userName: row.userName,
      supplierCode: row.supplierCode,
      realName: row.realName,
      // 带上电话:它只是档案信息,启停不该把它清掉(不带 = 后端按空值写入)
      phone: row.phone || '',
      password: '',
      enabled: next,
      remark: row.remark,
    })
    ElMessage.success(next === '1' ? tt('已启用') : tt('已停用'))
    await load()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(apiMsg(e, tt('操作失败')))
  }
}

/** 重置密码:管理员代设新口令(供应商忘了密码时用) */
async function resetPwd(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      `${tt('为账号')}「${row.userName}」${tt('设置新密码(至少 6 位)')}`,
      tt('重置密码'),
      { inputType: 'password', inputValidator: (v) => (v && v.length >= 6) || tt('新密码至少 6 位') },
    )
    await request.post('/supplier/portal/accounts/save', {
      id: row.id,
      userName: row.userName,
      supplierCode: row.supplierCode,
      realName: row.realName,
      phone: row.phone || '',   // 同上:重置密码不动电话
      password: value,
      enabled: row.enabled === '1' ? '1' : '0',
      remark: row.remark,
    })
    ElMessage.success(tt('密码已重置'))
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(apiMsg(e, tt('重置密码失败')))
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `${tt('删除供应商账号')}「${row.userName}」?${tt('删除后该账号不能再登录(历史打印记录保留)。')}`,
      tt('删除供应商账号'), { type: 'warning' })
    await request.delete(`/supplier/portal/accounts/${row.id}`)
    ElMessage.success(tt('已删除'))
    await load()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(apiMsg(e, tt('删除失败')))
  }
}

onMounted(() => {
  load()
  searchSuppliers('')
})
</script>

<style scoped>
.sa-page { display: flex; flex-direction: column; gap: 10px; max-width: 1400px; }
.sa-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sa-head-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sa-title { font-size: 15px; font-weight: 600; color: #1c4f8a; }
.sa-tip { font-size: 12px; color: #909399; line-height: 1.6; margin-top: -4px; }
.sa-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.sa-stat {
  background: #fff; border: 1px solid #e3e8ef; border-radius: 6px; padding: 10px 12px;
  display: flex; align-items: baseline; gap: 8px;
}
.sa-stat-n { font-size: 20px; font-weight: 700; color: #1c4f8a; }
.sa-stat-l { font-size: 12px; color: #909399; }
.sa-filter { display: flex; align-items: center; gap: 8px; }
.sa-kw { width: 320px; }
.sa-sel { width: 100%; }
.sa-hint { font-size: 12px; color: #909399; line-height: 1.6; }
.sa-inline { margin-left: 10px; }
.sa-perm { font-size: 13px; color: #303133; }

@media (max-width: 900px) {
  .sa-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sa-kw { width: 100%; }
}
</style>
