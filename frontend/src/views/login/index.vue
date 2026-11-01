<template>
  <main class="login-page">
    <!-- 右上角语言切换(下拉;未登录也可切换,Alt+L 同样可用) -->
    <div class="login-locale">
      <el-select
        :model-value="localeStore.locale"
        size="small"
        filterable
        :placeholder="tt('切换语言')"
        class="locale-select"
        popper-class="locale-select-popper locale-glass-popper"
        @change="(l) => localeStore.set(l)"
      >
        <el-option
          v-for="l in localeStore.available"
          :key="l.locale"
          :value="l.locale"
          :label="localeLabel(l)"
        />
      </el-select>
    </div>

    <section class="login-scene">
      <img :src="manufacturingImage" alt="" aria-hidden="true" />
      <div class="scene-tint" aria-hidden="true"></div>

      <div class="scene-content">
        <p class="scene-kicker">
          <span></span>
          MANUFACTURING OPERATIONS
        </p>
        <h1><strong>{{ tt('银嘉数字化平台') }}</strong> {{ tt('让生产现场') }}<br />{{ tt('有序运转') }}</h1>
        <p class="scene-subtitle">{{ tt('生产制造执行系统') }}</p>
      </div>

      <div class="scene-meta" aria-hidden="true">
        <span>{{ tt('聚焦现场') }}</span>
        <span>{{ tt('协同执行') }}</span>
        <span>{{ tt('持续改善') }}</span>
      </div>
    </section>

    <section class="login-workspace">
      <div class="login-shell">
        <header class="brand">
          <div class="brand-mark">
            <el-icon><DataLine /></el-icon>
          </div>
          <div>
            <div class="brand-name">{{ tt('银嘉数字化平台') }}</div>
            <div class="brand-subtitle">{{ tt('制造协同工作台') }}</div>
          </div>
        </header>

        <div class="login-heading">
          <p class="eyebrow">{{ tt('企业账号') }}</p>
          <h2>{{ tt('登录工作台') }}</h2>
          <p class="heading-note">{{ tt('进入制造协同工作台') }}</p>
        </div>

        <div v-if="errorMessage" class="login-error" role="alert">
          <el-icon><WarningFilled /></el-icon>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 壳内首次使用:先让用户确认后端地址(否则工厂列表一定是空的)
             ⚠ 2026-11-01:改地址入口已统一到**顶部原生工具条的「设置」**(见 showServerAddr 注释),
                这里只提示"去哪儿改",不再自带输入框。 -->
        <div v-if="needOrigin" class="origin-hint">
          <el-icon><WarningFilled /></el-icon>
          <span>{{ tt('首次使用请点顶部的「设置」确认服务器地址(如 http://192.168.1.10:8090),改完会自动重连') }}</span>
        </div>

        <!-- 服务器地址输入框已移除(2026-11-01)。
             原位置在这里有一行「服务器地址 + 保存并重连」,与顶部原生工具条的「设置」重复;
             详见下方 showServerAddr 的注释。改地址请用**顶部原生工具条的「设置」**。 -->

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          class="login-form"
          @keyup.enter="doLogin"
        >
          <el-form-item :label="tt('账号')" prop="userName">
            <el-input
              v-model.trim="form.userName"
              :prefix-icon="User"
              :placeholder="tt('请输入登录账号')"
              autocomplete="username"
              clearable
              @input="clearError"
            />
          </el-form-item>

          <el-form-item :label="tt('密码')" prop="password">
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              :placeholder="tt('请输入登录密码')"
              autocomplete="current-password"
              show-password
              @input="clearError"
            />
          </el-form-item>

          <el-form-item :label="tt('登录工厂')" prop="factory">
            <el-select
              v-model="form.factory"
              :loading="factoryLoading"
              :prefix-icon="OfficeBuilding"
              :placeholder="factoryLoading ? tt('正在加载工厂') : tt('请选择登录工厂')"
              :disabled="factoryLoading || !user.factories.length"
              @change="clearError"
            >
              <el-option
                v-for="factory in user.factories"
                :key="factory.code"
                :label="factory.name"
                :value="factory.code"
              />
            </el-select>
          </el-form-item>

          <div class="form-options">
            <el-checkbox v-model="rememberAccount">{{ tt('记住账号') }}</el-checkbox>
            <span class="secure-note">
              <el-icon><Lock /></el-icon>
              {{ tt('安全连接') }}
            </span>
          </div>

          <el-button
            type="primary"
            class="login-submit"
            :loading="loading"
            :disabled="factoryLoading"
            @click="doLogin"
          >
            <span>{{ tt('进入系统') }}</span>
            <el-icon v-if="!loading"><ArrowRight /></el-icon>
          </el-button>
        </el-form>

        <footer class="login-footer">
          <span>LIGHT MES · 2026</span>
          <!-- 页脚的 serverLabel 入口已去掉(2026-11-01):与顶部原生工具条重复,
               见 showServerAddr 的注释。这里只保留**连接状态指示**(有用,且不该能点开改地址)。 -->
          <span
            class="footer-status"
            :class="{ 'is-error': !factoryLoading && !user.factories.length }"
          >
            <span class="status-dot"></span>
            {{ factoryLoading ? tt('正在连接服务') : user.factories.length ? tt('服务连接正常') : tt('服务连接异常') }}
          </span>
        </footer>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  DataLine,
  Lock,
  OfficeBuilding,
  User,
  WarningFilled,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useLocaleStore } from '@/stores/locale'
import { tt } from '@/i18n'
// 服务器地址读写统一走 appConfig(2026-10-25 合并:HEAD 侧从 @core/request 取,现由 appConfig 唯一真源)
// 2026-11-01:网页内的改地址入口已全部去掉(统一到顶部原生工具条「设置」),
// 这里只留读取 —— apiOrigin() 现在**优先读原生 SharedPreferences**,见 appConfig 注释。
import { API_ORIGIN_KEY } from '@/business/appConfig'
// 背景图 2026-09-28 转 WebP(1967KB→111KB,q80 视觉无损;原图已删)
import manufacturingImage from '@/assets/login-manufacturing.webp'

const REMEMBERED_ACCOUNT_KEY = 'mes_login_account'
const router = useRouter()

// ---- 服务器地址设置 ----
// 2026-11-01:网页内的三个入口(表单框 / 页脚 serverLabel / srvVisible 弹窗)全部去掉,
// 统一到**顶部原生工具条的「设置」**—— 它在 WebView 外层,页面白屏时照样能用。
// 原实现保留在 git 历史(fail-safe:真要救急,先看 MainActivity.showServerDialog)。
const user = useUserStore()
const localeStore = useLocaleStore()
localeStore.loadAvailable?.()
const formRef = ref(null)
const loading = ref(false)
const factoryLoading = ref(false)
const errorMessage = ref('')

/**
 * 服务器地址(2026-10-20):只在壳里出现。
 * 判据:Capacitor(window.Capacitor)、手搓壳(window.YjNative)、或用 file:// 打开 —— 这三种都没有同源后端。
 * 网页部署(8090/5173)同源,不显示这一行。
 */
const IN_SHELL = typeof window !== 'undefined'
  && (!!window.Capacitor || !!window.YjNative || location.protocol === 'file:')
/**
 * 是否在登录表单里显示「服务器地址」输入框(2026-11-01 改为 false)。
 *
 * <p>🔴 为什么去掉:用户报障「为什么会有上下两个连接的设置」——
 * 壳里同时存在**三个**改地址的入口:
 * <ol>
 *   <li>原生顶部工具条「设置」(MainActivity 的 btn_settings,在 WebView **外面**);</li>
 *   <li>本表单里的这一行;</li>
 *   <li>页脚的 serverLabel(点开 srvVisible 弹窗)。</li>
 * </ol>
 * 三处读写同一个 localStorage 键,功能完全重复,现场只会困惑。
 *
 * <p>⇒ 统一收敛到**原生工具条那一个**。关键理由:它在 WebView 外层,
 * 网页白屏 / JS 报错 / 地址配错导致页面加载不出来时**照样能点开改** ——
 * 而网页里的入口一旦页面没渲染出来就完全失效(这正是"配错地址就永远进不去"的死锁)。
 */
const showServerAddr = false

/**
 * 首次进 App(还没配过地址)时给个置顶提示。
 *
 * <p>⚠ 2026-11-01:地址的**存储真源已改为原生 SharedPreferences**
 * (`YjNative.getBaseUrl()`,由顶部工具条「设置」写入),localStorage 只作兼容回退。
 * 所以这里判断"是否配过"要**两边都看**:只要任一处有合法地址,就不再打扰。
 */
const savedOrigin = (() => {
  try {
    const nat = window.YjNative && typeof window.YjNative.getBaseUrl === 'function'
      ? String(window.YjNative.getBaseUrl() || '').trim() : ''
    if (nat && /^https?:\/\//i.test(nat)) return nat
    return localStorage.getItem(API_ORIGIN_KEY) || ''
  } catch { return '' }
})()
/** 还没配地址 ⇒ 顶部横幅提醒(配过后不再打扰) */
const needOrigin = ref(IN_SHELL && !savedOrigin)

// 原 keepVisible() 只服务于「服务器地址」输入框(软键盘遮挡时滚到可视区中部);
// 该输入框已于 2026-11-01 移除,函数一并删除。登录表单本身用 el-form + 大尺寸输入,
// 安卓 adjustResize 已足够,不需要再手工滚动。

const rememberedAccount = localStorage.getItem(REMEMBERED_ACCOUNT_KEY) || ''
const rememberAccount = ref(Boolean(rememberedAccount))
// 供应商账号的落地页(2026-10-24):与 router/menus 同一条路径,常量放业务层,登录页不必 import 整个 router
const SUPPLIER_HOME = '/scm/supplierPrint'
const form = reactive({ userName: rememberedAccount, password: '', factory: '' })
/** 语言选项显示:本地名 (语言码)——汉字系语言(日本語/繁體中文)加码消除歧义;简体中文例外。 */
const localeLabel = (l) => l.locale === 'zh-CN'
  ? '简体中文'
  : `${l.nameNative || l.locale} (${l.locale})`

const rules = {
  userName: [{ required: true, message: tt('请输入登录账号'), trigger: 'blur' }],
  password: [{ required: true, message: tt('请输入登录密码'), trigger: 'blur' }],
  factory: [{ required: true, message: tt('请选择登录工厂'), trigger: 'change' }],
}

function clearError() {
  errorMessage.value = ''
}

async function doLogin() {
  if (loading.value || factoryLoading.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMessage.value = ''
  try {
    // 所选工厂随登录请求一起发给后端(ADR-0003):它决定这次登录查哪个账套,
    // 并由后端写进令牌声明 —— 后续请求按声明路由,故换了工厂必须重新登录。
    // (账套显示名由 user.login 按登录响应里的 factory 自行落定,这里不必再补一次;
    //  switchFactory 自 2026-09-22 起是"按目标账套重登"的语义,登录流程里不能再调它。)
    await user.login({ userName: form.userName, password: form.password, factory: form.factory })
    if (rememberAccount.value) localStorage.setItem(REMEMBERED_ACCOUNT_KEY, form.userName)
    else localStorage.removeItem(REMEMBERED_ACCOUNT_KEY)
    // 供应商账号(2026-10-24):登录后**直接进「供应商采购打印」**——它只有这一页(用户口径「没有别的权限」);
    // 普通/内部账号照旧进我的桌面。判据是后端下发的 supplierCode,不是前端猜的。
    await router.replace(user.supplierCode ? SUPPLIER_HOME : '/dashboard')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || tt('登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 标记登录态供 index.html 预置深色底色(语言切换刷新无闪白)
  try { sessionStorage.setItem('mes_at_login', '1') } catch { /* ignore */ }
  factoryLoading.value = true
  try {
    await user.fetchFactories()
    form.factory = user.factory?.code || user.factories[0]?.code || ''
  } catch (error) {
    errorMessage.value = tt('工厂信息加载失败，请检查服务后重试')
  } finally {
    factoryLoading.value = false
  }
})
</script>

<style scoped>
/* 右上角语言切换(下拉) */
.login-locale {
  position: absolute;
  top: 18px;
  right: 22px;
  z-index: 30;
}
.locale-select {
  width: 190px;
}
.locale-select :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);
  border-radius: 999px;
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.locale-select :deep(.el-select__placeholder),
.locale-select :deep(.el-select__selected-item) {
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
}
.locale-select :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.85);
}

.login-page {
  --login-accent: #116a5b;
  --login-accent-hover: #0d584c;
  position: relative;
  min-height: 100%;
  overflow: hidden;
  background: #15241f;
  color: #1d2926;
}

.login-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #273b35;
}

.login-scene > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
}

.scene-tint {
  position: absolute;
  inset: 0;
  background: rgba(8, 28, 23, 0.25);
}

.scene-content {
  position: absolute;
  z-index: 1;
  top: 48%;
  left: clamp(52px, 7vw, 112px);
  width: min(48vw, 650px);
  color: #ffffff;
  transform: translateY(-50%);
  text-shadow: 0 2px 18px rgba(5, 19, 16, 0.3);
}

.scene-kicker {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0 0 22px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.scene-kicker span {
  width: 28px;
  height: 2px;
  background: #e6ad3d;
}

.scene-content h1 {
  margin: 0;
  color: #ffffff;
  font-size: 46px;
  font-weight: 560;
  line-height: 1.3;
  letter-spacing: 0;
}

.scene-content h1 strong {
  font-weight: 780;
}

.scene-subtitle {
  margin: 22px 0 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 17px;
  font-weight: 520;
}

.scene-meta {
  position: absolute;
  z-index: 1;
  left: clamp(52px, 7vw, 112px);
  bottom: 34px;
  display: flex;
  align-items: center;
  gap: 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
}

.scene-meta span + span::before {
  content: '';
  display: inline-block;
  width: 1px;
  height: 11px;
  margin: 0 14px;
  background: rgba(255, 255, 255, 0.44);
  vertical-align: -1px;
}

.login-workspace {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 40px clamp(36px, 5.2vw, 84px);
}

.login-shell {
  width: 100%;
  max-width: 400px;
  padding: 30px 32px 27px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  background: rgba(250, 252, 251, 0.98);
  box-shadow: 0 20px 54px rgba(8, 30, 24, 0.22);
  backdrop-filter: blur(10px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 13px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--login-accent);
  color: #ffffff;
  font-size: 23px;
}

.brand-name {
  color: #18231f;
  font-size: 20px;
  font-weight: 750;
  line-height: 1.15;
}

.brand-subtitle {
  margin-top: 4px;
  color: #71807b;
  font-size: 12px;
}

.login-heading {
  margin: 29px 0 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8e5;
}

.eyebrow {
  margin: 0 0 7px;
  color: var(--login-accent);
  font-size: 12px;
  font-weight: 700;
}

.login-heading h2 {
  margin: 0;
  color: #17221f;
  font-size: 27px;
  font-weight: 720;
  line-height: 1.25;
  letter-spacing: 0;
}

.heading-note {
  margin: 7px 0 0;
  color: #7b8984;
  font-size: 12px;
}

.login-error {
  min-height: 42px;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 18px;
  padding: 11px 12px;
  border: 1px solid #e4b9b0;
  border-radius: 6px;
  background: #fff4f1;
  color: #9d3325;
  font-size: 13px;
  line-height: 18px;
}

.login-error .el-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  font-size: 16px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.el-form-item__label) {
  height: auto;
  margin-bottom: 8px;
  padding: 0;
  color: #40504b;
  font-size: 13px;
  font-weight: 650;
  line-height: 18px;
}

.login-form :deep(.el-input__wrapper),
.login-form :deep(.el-select__wrapper) {
  min-height: 48px;
  border: 1px solid #cfd8d4;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.login-form :deep(.el-input__wrapper:hover),
.login-form :deep(.el-select__wrapper:hover) {
  border-color: #91a29c;
}

.login-form :deep(.el-input__wrapper.is-focus),
.login-form :deep(.el-select__wrapper.is-focused) {
  border-color: var(--login-accent);
  box-shadow: 0 0 0 3px rgba(17, 106, 91, 0.12);
}

.login-form :deep(.el-input__prefix),
.login-form :deep(.el-select__prefix) {
  color: #70817b;
  font-size: 17px;
}

.login-form :deep(.el-form-item.is-error .el-input__wrapper),
.login-form :deep(.el-form-item.is-error .el-select__wrapper) {
  border-color: #c64d3d;
  box-shadow: 0 0 0 3px rgba(198, 77, 61, 0.1);
}

.form-options {
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 0 18px;
}

.form-options :deep(.el-checkbox__label) {
  color: #52615c;
  font-size: 13px;
}

.form-options :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  border-color: var(--login-accent);
  background: var(--login-accent);
}

.secure-note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #82908b;
  font-size: 12px;
  white-space: nowrap;
}

.login-submit {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-color: var(--login-accent);
  border-radius: 6px;
  background: var(--login-accent);
  font-size: 15px;
  font-weight: 680;
}

.login-submit:hover,
.login-submit:focus {
  border-color: var(--login-accent-hover);
  background: var(--login-accent-hover);
}

.login-submit .el-icon {
  font-size: 17px;
}

/* 壳内首次使用的地址提示:比底部那行更醒目,配过就不再出现 */
.origin-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid #f0c78a;
  border-radius: 8px;
  background: #fff8ed;
  color: #8a5a00;
  font-size: 12px;
  line-height: 1.55;
}

.origin-hint .el-icon {
  flex: none;
  margin-top: 2px;
}

/* 服务器地址(只在安卓壳里渲染):一行三件套,窄屏自动换行。
   2026-10-21:从页脚挪到表单上方(原来键盘弹出会把它挡死),所以下边距改成 12px。 */
.server-addr {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 10px;
  border: 1px dashed #d5dedb;
  border-radius: 8px;
  background: #f7faf9;
}

.server-addr-label {
  flex: none;
  font-size: 12px;
  color: #5d6b66;
}

.server-addr :deep(.el-input) {
  flex: 1 1 150px;
  min-width: 0;
}

.footer-srv {
  font-size: 11px;
  color: #1c4f8a;
  cursor: pointer;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  border-radius: 10px;
  padding: 1px 8px;
  max-width: 46%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.srv-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 16px;
}
.srv-dlg {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
}
.srv-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
}
.srv-tip {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 10px;
}
.srv-input {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-sizing: border-box;
  outline: none;
}
.srv-input:focus {
  border-color: #1c4f8a;
  box-shadow: 0 0 0 2px rgba(28, 79, 138, 0.12);
}
.srv-acts {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
  flex-wrap: wrap;
}
.srv-btn {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
}
.srv-btn.primary {
  background: #1c4f8a;
  border-color: #1c4f8a;
  color: #fff;
}
.login-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 26px;
  padding-top: 19px;
  border-top: 1px solid #e5eae8;
  color: #929e9a;
  font-size: 10px;
  font-weight: 650;
}

.footer-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3d9a6f;
}

.footer-status.is-error {
  color: #a34437;
}

.footer-status.is-error .status-dot {
  background: #c75a49;
}

@media (max-width: 1100px) {
  .scene-content {
    left: 46px;
    width: 42vw;
  }

  .scene-content h1 {
    font-size: 38px;
  }

  .scene-meta {
    left: 46px;
  }

  .login-workspace {
    padding-right: 36px;
    padding-left: 36px;
  }
}

@media (max-width: 860px) {
  .scene-content,
  .scene-meta {
    display: none;
  }
}

@media (max-width: 720px) {
  .login-page {
    min-height: 100%;
    display: block;
    overflow: visible;
    background: #f8faf9;
  }

  .login-scene {
    position: relative;
    inset: auto;
    height: 180px;
  }

  .login-scene > img {
    object-position: 38% 48%;
  }

  .scene-tint {
    background: rgba(8, 28, 23, 0.16);
  }

  .scene-content {
    top: auto;
    bottom: 20px;
    left: 24px;
    display: block;
    width: calc(100% - 48px);
    transform: none;
  }

  .scene-kicker {
    margin-bottom: 9px;
    font-size: 9px;
  }

  .scene-kicker span {
    width: 20px;
  }

  .scene-content h1 {
    font-size: 25px;
    line-height: 1.25;
  }

  .scene-content h1 br,
  .scene-subtitle {
    display: none;
  }

  .login-workspace {
    min-height: calc(100vh - 180px);
    align-items: flex-start;
    padding: 0;
    background: #f8faf9;
  }

  .login-shell {
    max-width: none;
    padding: 27px 24px 24px;
    border: 0;
    border-radius: 0;
    background: #f8faf9;
    box-shadow: none;
    backdrop-filter: none;
  }

  .brand-mark {
    width: 38px;
    height: 38px;
    font-size: 20px;
  }

  .brand-name {
    font-size: 18px;
  }

  .login-heading {
    margin: 25px 0 22px;
    padding-top: 21px;
  }

  .login-heading h2 {
    font-size: 25px;
  }

  .login-footer {
    margin-top: 24px;
  }
}

@media (max-width: 380px) {
  .login-workspace {
    padding-right: 18px;
    padding-left: 18px;
  }

  .form-options {
    gap: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-form :deep(.el-input__wrapper),
  .login-form :deep(.el-select__wrapper) {
    transition: none;
  }
}
</style>
