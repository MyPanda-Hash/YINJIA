/* ============================================================================
 * migrate-sample-reg-detail-tab-20261119.sql — 2026-11-19
 *   送样登记表(SAMPLE_REG)明细页签标题:「送样登记表明细」→「内部检测目录」
 *
 * 【用户口径(2026-11-19)】
 *   「送样登记表(SAMPLE_REG)的明细页签标题『送样登记表明细』改为『内部检测目录』」
 *   背景:这一页装的就是**内部检测目录**本身(检测项/检出限/测试方法/周期/收费/标准),
 *         原来那个「<面板名>+明细」的硬编码标题读起来像"某张单的明细",与实际内容不符。
 *
 * 【落地方案:零 DDL,面板级声明写进 yj_panel.config(数据驱动)】
 *   yj_panel.config 加 `"detailTabLabel": "内部检测目录"`
 *     ⇒ PanelRegistry.PanelDef.detailTabLabel() 读取(缺省/非法/空串 ⇒ null,回落到原逻辑)
 *     ⇒ PanelConfigService.buildArchiveConfig 用它做 tabLabel
 *        (**gridTabs[0].label 与 detail.tabs[0].label 两处共用同一个变量**,前端不会出现两个标题)
 *     ⇒ 前端 PanelxList 按 `tt(tab.label)` 渲染 ⇒ 切 en 时走
 *        frontend/src/i18n/locales/en.js 的 biz 词条「内部检测目录 → Internal Test Catalog」。
 *
 * 【为什么写在 yj_panel.config 而不是在 Java 里 if(panelCode)】
 *   · 零 DDL:两账套不改表结构;config JSON 本就是既有声明式配置位
 *     (singleDoc / fixedItems / uniqueKeys / headDefaults / rowLabels / queryInputRef 同款);
 *   · 只对 SAMPLE_REG 生效 ⇒ 其它档案面板的标题行为一字不变(仍是「面板名+明细」);
 *   · 以后别的面板要换页签标题,同款 JSON 声明即可,不加代码。
 *
 * 【多语言】按 ADR-0001:后端下发的是**中文数据键**(detailTabLabel 原样),显示层由前端 tt() 翻译;
 *   同批补 yj_translation(scope='panel')英文译名,供后端机翻/缓存链兜底。
 *
 * 【幂等】
 *   · 用 JSON_MODIFY **合并**写入(不是覆盖整列)⇒ 既有 `uniqueKeys` 等键原样保留;
 *     已声明同值则命中 0 行,可重复执行;
 *   · 译名 NOT EXISTS 插入,重跑 0 行;
 *   · 末尾自检 severity 16:面板不在 / config 非法 JSON / 键值不是「内部检测目录」/ uniqueKeys 被冲掉
 *     / 译名没落 ⇒ 迁移失败且 DbSync 不写 yj_schema_log。
 *
 * 【两账套】先正式库 HSDZ_MES、后测试库 HSDZ_MES_TEST —— 两个都要执行(脚本幂等)。
 * ============================================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 0. 前置守卫:面板在册 + config 若不是合法 JSON 则 fail fast(JSON_MODIFY 会直接抛错)──
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'SAMPLE_REG')
    RAISERROR(N'[FAIL] 面板 SAMPLE_REG 在 yj_panel 不存在,先确认库结构', 16, 1) WITH NOWAIT;
IF EXISTS (SELECT 1 FROM dbo.yj_panel
            WHERE panel_code = N'SAMPLE_REG' AND config IS NOT NULL
              AND ISJSON(config) = 0)
    RAISERROR(N'[FAIL] SAMPLE_REG.config 不是合法 JSON,拒绝改写(先人工修)', 16, 1) WITH NOWAIT;
GO

-- ── 1. 声明 detailTabLabel=内部检测目录(JSON_MODIFY 合并,保留 config 里其它键)──────
-- 条件里把「键不存在」也算未声明:config 是 '{}'、或只有 uniqueKeys 时都要写。
UPDATE dbo.yj_panel
   SET config = JSON_MODIFY(ISNULL(config, N'{}'), N'$.detailTabLabel', N'内部检测目录'),
       config_at = SYSDATETIME()
 WHERE panel_code = N'SAMPLE_REG'
   AND (config IS NULL
        OR JSON_VALUE(config, N'$.detailTabLabel') IS NULL
        OR JSON_VALUE(config, N'$.detailTabLabel') <> N'内部检测目录');
GO

-- ── 2. 多语言:面板名/页签标题的英文译名(幂等;ADR-0001 数据键中文、译名走词典)────────
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                WHERE scope = N'panel' AND ref_key = N'内部检测目录' AND locale = N'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'内部检测目录', N'en', N'Internal Test Catalog', N'manual');
GO

-- ── 3. 自检(severity 16 ⇒ 迁移失败,DbSync 不记账)────────────────────────────────
DECLARE @bad int = 0;

-- 面板必须恰 1 行
IF (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = N'SAMPLE_REG') <> 1
    SET @bad = @bad + 1;
-- config 必须仍是合法 JSON(不能被本脚本写成非法内容)
IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'SAMPLE_REG' AND ISJSON(config) = 0)
    SET @bad = @bad + 1;
-- 键值必须是「内部检测目录」
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel
                WHERE panel_code = N'SAMPLE_REG'
                  AND JSON_VALUE(config, N'$.detailTabLabel') = N'内部检测目录')
    SET @bad = @bad + 1;
-- 既有 uniqueKeys 不能被冲掉(本脚本只合并、不覆盖)
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel
                WHERE panel_code = N'SAMPLE_REG' AND ISNULL(config, N'') LIKE N'%uniqueKeys%')
    SET @bad = @bad + 1;
-- 英文译名必须在册
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                WHERE scope = N'panel' AND ref_key = N'内部检测目录' AND locale = N'en')
    SET @bad = @bad + 1;

IF @bad > 0
    RAISERROR(N'[FAIL] 送样登记表 detailTabLabel 自检失败:%d 项不符(见脚本顶部口径)', 16, 1, @bad) WITH NOWAIT;
ELSE
BEGIN
    DECLARE @cfg nvarchar(1200) = N'';
    SELECT @cfg = CONVERT(nvarchar(1200), ISNULL(config, N'<NULL>'))
      FROM dbo.yj_panel WHERE panel_code = N'SAMPLE_REG';
    RAISERROR(N'[PASS] SAMPLE_REG 明细页签标题已声明为「内部检测目录」(uniqueKeys 保留)', 10, 1) WITH NOWAIT;
    RAISERROR(N'[当前 config] %s', 10, 1, @cfg) WITH NOWAIT;
END
GO
