import { az as defineStore } from './vue-vendor-DyX2BAKf.js';

/**
 * 「我的桌面」右上角快捷入口 —— 候选清单与可见性判定的唯一真源。
 *
 * 为什么单独成文件(2026-09-22):
 *   用户要求「右上角的按钮可以自定义,比如加入项目申请(填写立项申请表)和产品开发
 *   (填写产品信息表)」。原先按钮清单写死在 dashboard/index.vue,「工作台设置」弹窗
 *   又各写一份硬编码 checkbox —— 两边会漂移(设置里能勾的 ≠ 桌面能显示的)。
 *   现在桌面按钮与设置勾选项都从这里渲染,加一个入口只需在 QUICK_ENTRIES 加一行。
 *
 * 字段约定:
 *   key       存 localStorage.mes_desk_settings.quick(稳定标识,改中文标题不影响存储)
 *   title     按钮文案,显示层一律走 tt()
 *   path      点击后跳转的路由;/panelx/form/<面板码> 无 id 即"新增"
 *   panelCode **必填** —— 按 user.visiblePanels 过滤(与 filterMenuTree 同语义,admin 全量)。
 *             桌面按钮都要能判定"这个账号有没有资格点";不绑面板的入口=人人可点却可能
 *             点不动(2026-09-22 用户把两个这样的按钮否掉了)。将来若真出现非面板的功能页
 *             入口,再加显式的豁免标记,不要默认放行。
 *   hint      可选,按钮 title 提示(说明点进去填哪张表)
 *   primary   可选,标出主操作(只有新建加工单)
 *
 * 已下架(2026-09-22,用户报"无效按钮,暂时无对应功能",恢复前请先有真功能+真路由):
 *   quickReport 快速报工 → /prod/shop/procReport 在 router 里没有这条路由(仅 ModuleView 占位 key)
 *   board       生产看板 → ManufactureBoard.vue 自述"数据接口尚未接入 SQL 后端"
 */

/** 当前候选版本:v2 = 新增 项目申请 / 产品开发(用于给老用户增量补默认值) */
const DESK_QUICK_VERSION = 2;
/** v2 新增的候选 key —— 只给"角色默认包含它"的用户补 */
const DESK_QUICK_V2_ADDED = ['rdApply', 'rdProduct'];

const QUICK_ENTRIES = [
  { key: 'newOrder', title: '新建加工单', path: '/panelx/form/MANU_ORDER', panelCode: 'MANU_ORDER', primary: true },
  { key: 'rdApply', title: '项目申请', path: '/panelx/form/RD_APPROVAL', panelCode: 'RD_APPROVAL', hint: '填写立项申请表' },
  { key: 'rdProduct', title: '产品开发', path: '/panelx/form/RD_PROD_INFO', panelCode: 'RD_PROD_INFO', hint: '填写产品信息表' },
];

/** 该入口对当前用户是否可见:绑面板的按 visiblePanels(admin 全量);拿不到用户则不显示 */
function visibleFor(entry, user) {
  if (!user) return false
  if (user.isAdmin) return true
  const vis = Array.isArray(user.visiblePanels) ? user.visiblePanels : [];
  return vis.includes(entry.panelCode)
}

/** 设置弹窗的候选(已按权限过滤):没权限的面板不给勾,免得勾了点不动 */
function availableQuickEntries(user) {
  return QUICK_ENTRIES.filter((e) => visibleFor(e, user))
}

/** 桌面真正要渲染的按钮:勾过 + 当前可见;顺序以候选清单为准(不随勾选顺序乱) */
function pickQuickEntries(keys, user) {
  const want = Array.isArray(keys) ? keys : [];
  return QUICK_ENTRIES.filter((e) => want.includes(e.key) && visibleFor(e, user))
}

/**
 * 老用户的桌面设置增量补默认(v1→v2)。
 * 只补「本版本新增 且 角色默认包含」的 key,不动用户已有的任何选择
 * (v1 用户不可能取消过当时还不存在的入口,所以"没勾"= "没见过")。
 * 已是当前版本时返回同一引用,调用方可据此跳过落盘。
 */
function upgradeDeskSettings(saved, { presetQuick = [], version = DESK_QUICK_VERSION } = {}) {
  if (!saved) return saved
  if (Number(saved.v || 1) >= version) return saved
  const have = Array.isArray(saved.quick) ? saved.quick : [];
  const add = DESK_QUICK_V2_ADDED.filter((k) => presetQuick.includes(k) && !have.includes(k));
  return { ...saved, quick: [...have, ...add], v: version }
}

const DESK_DEFAULT = {
  quick: ['newOrder', 'quickReport', 'board'],
  showKpi: true,
  showProgress: true,
  showTodo: true,
};
// 注意:DESK_DEFAULT 刻意不带 v —— loadDeskSettings 会把默认值摊到存储值上,
// 若默认值里有 v,老用户(v1)会被误判成"已升级",增量补默认就永不执行。

/**
 * 角色预设(2026-09-22 桌面展示优化):只在「用户从未保存过桌面设置」时套用**一次**。
 *   · 管理员:全局视角 —— 生产执行核心 + 质量待办 + 事件流/数据内核都在,快捷入口带
 *     研发两个入口(项目申请/产品开发) —— 填表是管理员的日常起点;
 *   · 普通用户:聚焦「要我做/要我看」—— 首屏 KPI + 质量与待办为主,生产执行核心默认收起
 *     (它是长列表+图表,对仓管/工艺员这类角色日常价值低),快捷入口只留「新建加工单」,
 *     研发两个入口默认不勾(车间账号用不上,且多无该面板权限,勾了也点不动)。
 * 用户在工作台设置里改过之后就不再覆盖(以 localStorage 里的保存值为准)。
 * 注:快速报工/生产看板已于 2026-09-22 从候选中下架(无对应功能),预设里不再出现。
 */
const DESK_PRESET_ADMIN = { ...DESK_DEFAULT, v: DESK_QUICK_VERSION, quick: ['newOrder', 'rdApply', 'rdProduct'] };
const DESK_PRESET_USER = { ...DESK_DEFAULT, v: DESK_QUICK_VERSION, quick: ['newOrder'], showProgress: false };

function deskSavedByUser() {
  try {
    return !!localStorage.getItem('mes_desk_settings')
  } catch (e) {
    return false
  }
}

function loadDeskSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('mes_desk_settings') || 'null');
    return s ? { ...DESK_DEFAULT, ...s } : { ...DESK_DEFAULT }
  } catch (e) {
    return { ...DESK_DEFAULT }
  }
}

const useAppStore = defineStore('app', {
  state: () => ({
    collapsed: localStorage.getItem('mes_collapsed') === '1',
    dark: localStorage.getItem('mes_dark') === '1',
    menuMode: localStorage.getItem('mes_menu_mode') || 'accordion',
    fullscreen: false,
    deskSettings: loadDeskSettings(),
    // T+ 门户形态：内容区最大化（隐藏左侧导航）
    maxContent: false,
    // 移动端：左侧导航抽屉开关（≤768px 生效）
    mobileNav: false,
    // 右侧帮助面板
    helpVisible: false,
    helpTab: 'dynamic',
    // MES 初始化向导（首次登录自动弹出，之后可从用户下拉再次打开）
    initWizardVisible: false,
    initDone: localStorage.getItem('mes_init_done') === '1',
  }),
  actions: {
    toggleCollapse() {
      this.collapsed = !this.collapsed;
      localStorage.setItem('mes_collapsed', this.collapsed ? '1' : '0');
    },
    toggleDark() {
      this.dark = !this.dark;
      localStorage.setItem('mes_dark', this.dark ? '1' : '0');
      document.documentElement.classList.toggle('dark', this.dark);
    },
    setMenuMode(mode) {
      this.menuMode = mode;
      localStorage.setItem('mes_menu_mode', mode);
    },
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        this.fullscreen = true;
      } else {
        document.exitFullscreen();
        this.fullscreen = false;
      }
    },
    toggleMaxContent() {
      this.maxContent = !this.maxContent;
    },
    toggleMobileNav() {
      this.mobileNav = !this.mobileNav;
    },
    openHelp(tab) {
      this.helpVisible = true;
      if (tab) this.helpTab = tab;
    },
    closeHelp() {
      this.helpVisible = false;
    },
    openInitWizard() {
      this.initWizardVisible = true;
    },
    closeInitWizard(skip) {
      this.initWizardVisible = false;
      if (skip) {
        this.initDone = true;
        localStorage.setItem('mes_init_done', '1');
      }
    },
    finishInitWizard() {
      this.initDone = true;
      localStorage.setItem('mes_init_done', '1');
    },
    saveDeskSettings(patch) {
      this.deskSettings = { ...this.deskSettings, ...patch };
      localStorage.setItem('mes_desk_settings', JSON.stringify(this.deskSettings));
    },
    /** 首次进入桌面时按角色套预设;返回是否套用了(用户已保存过则不动,返回 false) */
    applyRoleDeskPreset(isAdmin) {
      if (deskSavedByUser()) return false
      this.deskSettings = { ...(isAdmin ? DESK_PRESET_ADMIN : DESK_PRESET_USER) };
      localStorage.setItem('mes_desk_settings', JSON.stringify(this.deskSettings));
      return true
    },
    /**
     * 新候选上线时的增量补默认(v1→v2:项目申请/产品开发)。
     * 老用户(已保存过设置)不会走 applyRoleDeskPreset,若不补就永远看不到新按钮;
     * 只补"角色默认包含且用户没见过"的 key,用户自己的勾选一律不动。
     */
    upgradeDeskSettings(isAdmin) {
      const cur = this.deskSettings;
      const next = upgradeDeskSettings(cur, { presetQuick: (isAdmin ? DESK_PRESET_ADMIN : DESK_PRESET_USER).quick });
      if (next === cur) return false
      this.deskSettings = next;
      localStorage.setItem('mes_desk_settings', JSON.stringify(next));
      return true
    },
  },
});

export { availableQuickEntries as a, pickQuickEntries as p, useAppStore as u };
