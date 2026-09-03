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

## 架构速查

- 术语表:`CONTEXT.md`(翻译表/翻译分层/字典翻事实不翻)
- 决策记录:`docs/adr/0001-dictionary-only-translation.md`
- 多语言实现:`TranslationService`(后端缓存+机翻)、`stores/locale.js`(前端真源)、
  `tools/i18n-*.sql`(翻译表迁移脚本)
- 提交前自检:切换 en 后走查新增页面,列头/标签/按钮/提示全部英文

## 🔴 Git 提交规范(2026-09-03 起生效,不可豁免)

**每次任务修改完成,必须创建独立 git commit**(方便追踪与回滚)。规则:

1. **单任务单提交**:一个任务(功能/修复/文档/迁移)一个 commit,不要把多个任务混在一个提交里;
   中途的临时检查/调试文件也随所属任务一起提交(以 `_` 开头的工具文件如
   `tools/_xxx.java|.sql|cjs` 属任务产物,同样入库)。
2. **消息格式**:`<type>: <中文摘要>`,type ∈ feat/fix/docs/refactor/chore/db/i18n;
   摘要写清楚任务内容(可带要点),如 `feat: 参照字段双模(≤20下拉/>20弹窗)`。
3. **提交前检查**:① `git status` 确认本次任务文件(不夹带其它任务改动);② 敏感信息不入库
   (`.env`、AK/密码——提交前 `git grep` 扫一次);③ 涉代码改动先 `npm run build` / `mvn package` 通过;
   ④ 涉数据库改动确认幂等脚本已执行验证。
4. **本地工作区干净才能换任务**:一个任务 commit 后才开始下一个;推不推送不限,本地 commit 即达标。
5. 规范变更本身也按此提交(如本文件更新 = 一个 docs commit)。

## 架构速查(补充)

- 通用设计资产库(供其它项目 agent 参考实现):`https://github.com/MyPanda-Hash/CHENGXIAO`(9 专题+代码片段+表结构)
