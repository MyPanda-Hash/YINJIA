# YINJIA-MES

制造执行系统(MES) — Vue3 + Spring Boot + SQL Server

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 / Element Plus / vue-i18n / Vite |
| 后端 | Spring Boot / Spring Security / JDBC |
| 数据库 | SQL Server(HSDZ_MES) |
| 外部服务 | 阿里云 OCR / 阿里云机器翻译 |

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
| 基础设置 | 21 | 部门/员工/往来单位/客户/计量单位/存货/设备/班组/工作中心/工序/工艺路线/BOM/仓库/地区/项目/不合格原因/检验项目/检验方案/数据字典/存货价格本 |
| 智能供应链 | 20 | 采购管理(请购/采购订单) + 库存核算(8 单据 + 8 明细表 + 8 统计表) |
| 新生产 | 6 | 生产管理(生产加工单/工序派工单/委外加工单 + 明细/统计) |
| 业务单据 | 5 | 原有面板(入库/出库/采购/客户订单/物料清单) |

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
