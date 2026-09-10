# YINJIA-MES

制造执行系统(MES) — Vue3 + Spring Boot + SQL Server

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 / Element Plus / vue-i18n / Vite |
| 后端 | Spring Boot / Spring Security / JDBC |
| 数据库 | SQL Server(HSDZ_MES) |
| 外部服务 | 阿里云 OCR / 阿里云机器翻译 |

> **系统通用设计资产库**(供其它项目 agent 参考实现面板引擎/多语言/权限/生命周期等):
> https://github.com/MyPanda-Hash/CHENGXIAO(与 light-mes 双实现提炼)

## 系统结构

```text
浏览器
  → Vue 3 / Element Plus
  → /api/*
  → Spring Boot /api/px/* 与业务接口
  → SQL Server HSDZ_MES
```

面板与字段全部由数据库元数据(`yj_panel` / `yj_field`)驱动,前后端数据键为中文。

## 目录结构

```text
YINJIA-MES/
├── frontend/src/
│   ├── core/           # 通用面板引擎(PanelxList/PanelxForm/参照/导入导出)
│   ├── business/       # 适配层(engine.js / api.js / menus.js)
│   ├── i18n/           # 多语言(10 语言包 + tt() 直译)
│   ├── layout/         # 门户布局(侧栏/顶栏/页签/通知)
│   ├── views/          # Dashboard / 登录 / 组织架构 / 业务模块
│   └── stores/         # Pinia(用户/页签/locale/app)
├── backend/src/main/java/com/yinjia/mes/
│   ├── panel/          # 面板运行时契约与动作注册表
│   ├── ocr/            # OCR 网关(阿里云)与响应
│   ├── controller/     # REST API
│   ├── service/        # PanelRegistry / PanelConfigService / TranslationService 等
│   └── config/         # Security / JWT
├── tools/              # 数据库迁移/生成/校验脚本
├── docs/               # 开发规范(前端/后端/部署/质量) + ADR
└── AGENTS.md           # AI Agent 开发规范(多语言强制)
```

## 核心模块

| 模块 | 面板数 | 说明 |
|---|---|---|
| 基础档案 | 23 | 基础数据(部门/员工/数据字典/仓库/客户档案/往来单位/地区/项目) + 物料及价格(计量单位/存货/物料清单/存货价格本) + 生产(设备/班组/工作中心/工序/工艺路线/不合格原因/检验项目/检验方案) + 财务(税别资料/费用类别/会计科目) |
| 智能供应链 | 29 | 销售管理(销售订单 + 明细表/统计表) + 采购管理(请购单/采购订单) + 库存核算(8 单据 + 8 明细表 + 8 统计表) |
| 生产制造 | 7 | 生产管理(生产加工单/工序派工单/委外加工单 + 明细表 2 + 统计表 2) |
| 研发管理 | 22 | **项目管理**(立项申请/项目实施计划/项目进度查询) + **测试记录**(数据记录表 8:功能性滤效/碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降精度 + 实验室使用记录表 4:加标水配置/内部委托测试申请/设备使用登记/仪器使用记录) + **产品文件**(产品信息表/成型工艺清单/成型配方/规格书/组装BOM表/组装工艺清单/出货检验计划表) |
| 仓库管理 | 1 | 库存状况 |

> 面板数以 `yj_panel.module_group` 为准,合计 82 个;「我的桌面」(DASHBOARD)为虚拟入口,不入 `yj_panel`,按角色权限可见,不计入上表。

## 多语言

- 10 种语言(简体中文/English/日本語/한국어/Español/Français/Deutsch/Русский/Tiếng Việt/ไทย)
- 翻译表 `yj_translation`(通用翻译表 + 机翻兜底)
- 前端静态语言包(10 个 locale 文件)
- 热切换(不刷新页面,Alt+L 快捷键)

## 本地启动

```powershell
# 后端(自动注入阿里云 AK)
cd C:\INCER\YINJIA-MES\backend
..\tools\start-backend.bat

# 前端
cd C:\INCER\YINJIA-MES\frontend
npm run dev
```

前端地址 `http://localhost:5173`,后端 `http://localhost:8090`。

## 文档

| 文档 | 路径 |
|---|---|
| 前端面板设计 | `docs/frontend/前端面板设计.md` |
| 后端逻辑设计 | `docs/backend/后端逻辑设计.md` |
| 服务器部署 | `docs/deploy/服务器部署.md` |
| 开发与质量(含多语言规范) | `docs/development/开发与质量.md` |
| ADR:翻译边界 | `docs/adr/0001-dictionary-only-translation.md` |
| AI Agent 规范 | `AGENTS.md` |
