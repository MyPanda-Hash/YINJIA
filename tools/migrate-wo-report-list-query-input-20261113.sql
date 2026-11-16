/* ============================================================================
 * migrate-wo-report-list-query-input-20261113.sql — 2026-11-13
 *   报工记录(WO_REPORT_LIST)查询区参照字段改「可输入即查」
 *
 * 【用户口径(2026-11-13,截图圈住查询区「产品编码」)】
 *   「报工记录中上方的查询不能只是选择查询的,而是可以输入后就查询的形式」
 *   追问确认:① 输入片段即联想下拉 + 直接回车也能按片段模糊查;
 *             ② 范围只改报工记录(WO_REPORT_LIST),其它面板不动。
 *
 * 【落地方案:零 DDL,面板级声明写进 yj_panel.config】
 *   yj_panel.config 加 `"queryInputRef": true`
 *     ⇒ PanelRegistry.PanelDef.queryInputRef() 读取(缺省 false = 现行为不变)
 *     ⇒ PanelConfigService 下发 metadata.queryInputRef(只下发 true)
 *     ⇒ 前端 PanelxList 查询区把该面板「弹窗模式参照字段」(原来只读输入框 + 放大镜,
 *        如 产品编码 wzdm→INV、客户编码 khdm→KHDA)渲染成 el-autocomplete:
 *          · 打字即远程联想(候选「编码 — 名称」);选中候选 ⇒ 写入编码 = 精确等值,
 *            与原来点放大镜弹窗选中**完全同一口径**;
 *          · 不选候选直接回车 ⇒ condition[字段] = 输入片段,并置控制键
 *            `condition._fuzzy = '产品编码,...'` ⇒ QueryService.appendDirectFilters
 *            对该参照字段改用 `LIKE %片段%`(精确选择时不带该键,仍等值);
 *          · 放大镜按钮保留:仍可打开原参照弹窗精确选择。
 *
 * 【为什么写在 yj_panel.config 而不是新增 yj_field 列】
 *   · 零 DDL:两账套不必改表结构;config JSON 本就是既有声明式配置位
 *     (singleDoc / fixedItems / uniqueKeys / headDefaults / rowLabels 同款);
 *   · 面板配置保存侧(PanelConfigService.saveRowLabels)是"读出全部键再回写",
 *     不会把本键冲掉;
 *   · 只对本面板生效 ⇒ 不改变其它面板查询区行为(用户口径:只改报工记录);
 *   · 以后要给别的面板开,同款 JSON 声明即可,不加代码。
 *
 * 【幂等】
 *   · 用 JSON_MODIFY **合并**写入(不是覆盖整列),重跑命中 0 行;
 *   · 末尾自检 severity 16:面板不在 / config 非法 JSON / 键值不是 true ⇒ 迁移失败且
 *     DbSync 不写 yj_schema_log。
 *
 * 【两账套】先正式库 HSDZ_MES、后测试库 HSDZ_MES_TEST —— 两个都要执行(脚本幂等)。
 * ============================================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 0. 前置守卫:面板在册 + config 若不是合法 JSON 则 fail fast(JSON_MODIFY 会直接抛错)──
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'WO_REPORT_LIST')
    RAISERROR(N'[FAIL] 面板 WO_REPORT_LIST 在 yj_panel 不存在,先确认库结构', 16, 1) WITH NOWAIT;
IF EXISTS (SELECT 1 FROM dbo.yj_panel
            WHERE panel_code = N'WO_REPORT_LIST' AND config IS NOT NULL
              AND ISJSON(config) = 0)
    RAISERROR(N'[FAIL] WO_REPORT_LIST.config 不是合法 JSON,拒绝改写(先人工修)', 16, 1) WITH NOWAIT;
GO

-- ── 1. 声明 queryInputRef=true(JSON_MODIFY 合并,保留 config 里其它键)──────────────
-- 条件里把「JSON_VALUE 为 NULL」也算未声明:config 是 '{}' 或已含其它键但没本键时都要写。
UPDATE dbo.yj_panel
   SET config = JSON_MODIFY(ISNULL(config, N'{}'), N'$.queryInputRef', CAST(1 AS bit)),
       config_at = SYSDATETIME()
 WHERE panel_code = N'WO_REPORT_LIST'
   AND (config IS NULL
        OR JSON_VALUE(config, N'$.queryInputRef') IS NULL
        OR JSON_VALUE(config, N'$.queryInputRef') <> N'true');
GO

-- ── 2. 自检(severity 16 ⇒ 迁移失败,DbSync 不记账)────────────────────────────────
DECLARE @bad int = 0;

IF (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = N'WO_REPORT_LIST') <> 1
    SET @bad = @bad + 1;
-- config 必须是合法 JSON(不能被本脚本写成非法内容)
IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'WO_REPORT_LIST' AND ISJSON(config) = 0)
    SET @bad = @bad + 1;
-- 键值必须是 JSON 布尔 true(不是字符串 'true')
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel
                WHERE panel_code = N'WO_REPORT_LIST'
                  AND JSON_VALUE(config, N'$.queryInputRef') = N'true')
    SET @bad = @bad + 1;
IF @bad > 0
    RAISERROR(N'[FAIL] 报工记录 queryInputRef 声明自检失败:%d 项不符(见脚本 §2 口径)', 16, 1, @bad) WITH NOWAIT;
ELSE
BEGIN
    DECLARE @cfg nvarchar(1200) = N'';
    SELECT @cfg = CONVERT(nvarchar(1200), ISNULL(config, N'<NULL>'))
      FROM dbo.yj_panel WHERE panel_code = N'WO_REPORT_LIST';
    RAISERROR(N'[PASS] WO_REPORT_LIST 已声明 queryInputRef=true —— 查询区参照字段(产品编码/客户编码等)可输入即查', 10, 1) WITH NOWAIT;
    RAISERROR(N'[当前 config] %s', 10, 1, @cfg) WITH NOWAIT;
END
GO
