# AGENTS.md — YINJIA-MES 开发规范(AI Agent 必读)

> 本文件由 DSH agent-instructions 自动注入;人类开发者请阅读
> `docs/development/开发与质量.md` 的「多语言开发规范」章节。

## 项目一句话

YINJIA-MES = light-mes 面板引擎(Vue3) + Spring Boot + SQL Server HSDZ_MES,
面板/字段全部由数据库元数据(`yj_panel`/`yj_field`)驱动,前后端数据键为中文。

## 🔴 多语言强制规范(2026-08-30 起生效,不可豁免)

任何**新增面板、字段、UI 功能**的工作,必须同时交付对应的多语言数据,
否则视为功能未完成。判定标准:`切换到英语/日语后,新功能显示目标语言而非中文`。

### 1. 新增面板(往 yj_panel 插行)时,必须同时:

```sql
-- 面板名译名(yj_translation,scope='panel';至少 en,鼓励全语言)
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
('panel', N'<面板中文名>', 'en', N'<英文名>', 'manual');
-- 重复 ja/ko/es/fr/de/ru/vi/th …
```

### 2. 新增字段(往 yj_field 插行)时,必须同时:

```sql
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
('field', N'<字段中文标签>', 'en', N'<英文标签>', 'manual');
-- 同一中文标签全局共享译名;已有译名的标签(数量/备注等)无需重复插入
```

### 3. 前端新增 UI 文案时:

- **显示层**一律 `{{ tt('中文原文') }}`(import { tt } from '@/i18n'),
  并把译名加入 `src/i18n/locales/*.js` 的 biz(至少 en.js)
- **禁止**在模板里裸写无翻译路径的中文显示(注释除外)
- 占位符/tooltip/标题同样走 tt()

### 4. 永不触碰的红线(ADR-0001):

- `dataName`/`buttonName`/单据状态存储值等**数据键永远中文**,不随语言变化
- 业务事实数据(客户名/单据号/用户输入)**不做翻译**,原样显示
- 机翻只兜底显示层零星词条,结果缓存进 yj_translation(source='mt')

### 5. 新增语言:

```sql
INSERT INTO yj_locale VALUES ('ar', N'阿拉伯语', N'العربية', 1, 100);
```
插行即可,切换器自动出现,词条由机翻初始化、可人工校对升级。

## 🔴 数据库注明与全量部署规范(2026-09-14 起生效,不可豁免)

1. **新增表必须带中文注明**:凡是 CREATE TABLE 的迁移脚本,必须同脚本内为
   新表及关键列写入 `MS_Description` 中文扩展属性(幂等写法参照
   `tools/migrate-table-comments.sql` 与 `tools/migrate-report-template-comments.sql`)。
   只建表不注明 = 任务未完成。改动已有表结构时鼓励补注。

   **全库表清单 = `docs/development/数据库表清单.md`**(437 表 + 101 视图逐张登记:
   表名/中文名/列数/关联面板,按 yj_/bs_/bd_bl_/rd_/qc_/wo_/已下架/ERP/遗留/备份 十组)。
   建表或改表前**先查这份清单**确认前缀归属与「这张表能不能动」:
   - 第 9 组 `legacy`(dm_/s_/拼音缩写)仍被面板引用的(`dm_ck`/`kucun`/`mate`/`inh`/`outh`/`Porder`/`order_bs`)——改动前须评估面板影响;
   - 第 7 组(已下架 `pr_*`/部分 `wo_*`)与第 10 组(`RENAME_*`/`*_bak_*`/`tmp_*`/`t1`/`t2`)——**禁止新代码引用**;
   - 新增表前缀按清单 §0 选,单据必须 `bd_` 头 + `bl_` 行(或 `*_head`/`*_detail`)成对且带 `asp_user1/2`+`asp_time1/2`。
   表结构变更后重跑清单末尾两条命令刷新并随任务提交。
2. **部署默认全量**:下次服务器部署走「全量恢复备份」路线(deploy/部署说明.md 二、A)——
   用本地库整体覆盖服务器。因此:
   - 打部署备份**之前**,必须先清掉本地库里的测试数据
     (按 `migrate-golive-cleanup.sql` 模式,待产出),保证全量推上去的是干净账;
   - 备份必须在部署当时新打(`BACKUP DATABASE ... WITH FORMAT, INIT`),
     禁止拿 `deploy/` 里的历史 .bak 直接用;
   - `tools/db-migrations.txt` 与 `deploy/push-migrations.bat` 清单仍需同步更新,
     供测试库(HSDZ_MES_TEST)与增量场景使用。

## 架构速查

- 术语表:`CONTEXT.md`(翻译表/翻译分层/字典翻事实不翻)
- 决策记录:`docs/adr/0001-dictionary-only-translation.md`
- 多语言实现:`TranslationService`(后端缓存+机翻)、`stores/locale.js`(前端真源)、
  `tools/i18n-*.sql`(翻译表迁移脚本)
- 提交前自检:切换 en 后走查新增页面,列头/标签/按钮/提示全部英文

## 🔴 Git 提交规范(2026-09-03 起生效,不可豁免)

**每次任务修改完成,必须创建独立 git commit**(方便追踪与回滚)。规则:
1. **单任务单提交**:一个任务(功能/修复/文档/迁移)一个 commit,不要把多个任务混在一个提交里;
   中途的一次性探针/临时检查脚本属任务产物,放 `tools/archive/`(以 `_` 开头)一并提交;
   tools 根层只留迁移链与正式工具(分类见 `tools/README.md`)。
2. **消息格式**:`<type>: <中文摘要>`,type ∈ feat/fix/docs/refactor/chore/db/i18n;
   摘要写清楚任务内容(可带要点),如 `feat: 参照字段双模(≤20下拉/>20弹窗)`。
3. **提交前检查**:① `git status` 确认本次任务文件(不夹带其它任务改动);② 敏感信息不入库
   (`.env`、AK/密码——提交前 `git grep` 扫一次);③ 涉代码改动先 `npm run build` / `mvn package` 通过;
   ④ 涉数据库改动确认幂等脚本已执行验证。
4. **本地工作区干净才能换任务**:一个任务 commit 后才开始下一个;推不推送不限,本地 commit 即达标。
5. 规范变更本身也按此提交(如本文件更新 = 一个 docs commit)。

## 🔴 验证与收尾:开发机服务(2026-09-22 起生效)

**环境前提:JDK 25**。`backend/pom.xml` 是 `<java.version>25</java.version>`(class major 69),
仓库脚本一律**优先取 `JAVA_HOME`**、其次探测 `C:\Program Files\Java\jdk-25` /
`D:\Program Files\Java\jdk-25` / `%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2`。
本机系统 PATH 里的 `java` 是 **Oracle JDK 24**(Machine 级 javapath,用户 PATH 覆盖不了),
所以**直接跑 `mvn` 会报「不支持发行版本 25」** —— 处置:`JAVA_HOME` 指向 JDK 25,
核对与验证命令见 `docs/development/环境与数据库.md`「开发机环境」。
新写脚本**沿用上述探测,不要把 JDK 路径写死**。

改完**要看效果**的活儿(界面/版面/交互/导出),先确认开发机服务在跑,**没开就一并开**,
别只跑构建就下结论;纯只读排查(看代码/查库)不必折腾服务。

| 用途 | 命令 | 地址 |
|---|---|---|
| 后端(正式账套 HSDZ_MES) | `tools/scripts/start-prod.ps1` | http://127.0.0.1:8090 |
| 前端热更(改完即刷) | `frontend/start-vite.bat` | http://localhost:5173 |

- `start-prod.ps1` **自身幂等**:8090 已在跑就只打印「正式实例已在运行」并 exit 0,`-Stop` 才停 ——
  所以「没开就开、开着就跳过」不需要额外判断,直接跑它即可。
- **收尾时服务保持运行,不要停**(用户常要立刻看效果);汇报里给出 URL 并注明「服务是我起的」。
- 起长驻进程**别阻塞当前流程**(后台起);**不要重启已在跑的服务**(会打断用户正在看的会话)。
- 只跑了构建/单测 ≠ 验证过界面:渲染/版式类改动要落到真实服务上看过再说(或明确声明未做像素级验证)。

## 架构速查(补充)

- 通用设计资产库(供其它项目 agent 参考实现):`https://github.com/MyPanda-Hash/CHENGXIAO`(9 专题+代码片段+表结构)
- **数据库表清单**:**`docs/development/数据库表清单.md`**(全库 437 表 + 101 视图逐张登记 + §0 命名与归属规范;建表/改表/查表先看它,刷新命令见文档末尾)
- **代码规范与防臃肿**:**`docs/development/代码规范与防臃肿.md`**(A 分层边界/B 契约数据驱动/C 文件红线/D 反复制粘贴/E 清理与技术债台账/F 自动化防线);新代码必须满足该规范,违背即视为任务未完成
- **踩坑台账**:`docs/development/开发与质量.md` §5.5(2026-09-11 前端导出/探针专项:jsPDF px 单位、html2canvas、$el fragment 锚点、离屏克隆全宽截图、PS 命令通道 CJK 键、char(2) 尾空格等);**涉 PDF 生成/截图导出/CDP 探针/PS 工具脚本/定长列比较,先读该节再动手,违者即重复事故**
