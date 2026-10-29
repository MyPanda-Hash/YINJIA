/* ============================================================================
   migrate-rd-domtest-docno-headdefaults-20261029.sql
   测试申请单:右上角改显单据编号 + 新建默认密级/文件使用范围(2026-10-29)

   用户口径(原文):
     「这个应该是显示表格编号,不应该是 YJ-RIR001,这个改为单据编号,自动生成,内容就是表格编号,
      表格编号改为单据编号,密级以及文件使用范围默认选择保密,内部,这些是可以换的,
      只是新增的单据就是默认选择这些」

   改动:
   1. yj_panel.config.headDefaults = {"密级":"保密","文件使用范围":"银嘉内部"}
      ⇒ 后端「新增」建单时自动带上(ButtonService.putHeadDefaults),用户仍可随时改。
   2. 纸面右上角的受控表单编号(YJ-RIR001 / YJ-XS002)**不再渲染** —— 改为显示自动生成的
      单据编号(DT-…),与汇总表「单据编号」列同一份值。这是**前端渲染口径**的改动
      (RecordSheetPanels.vue 去掉 docNoStatic 优先分支),本脚本只负责默认值。
      配置里的 docNoStatic 保留(打印空白模板/设计对照还要用),但不再优先。

   幂等:headDefaults 只在**没有**这个键时写入;已有则原样保留(用户改过的默认值不被回滚)。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @panel varchar(50) = 'RD_DOM_TEST';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @panel)
BEGIN
    PRINT '跳过:面板不存在 ' + @panel;
    RETURN;
END

DECLARE @cfg nvarchar(max) = (SELECT config FROM yj_panel WHERE panel_code = @panel);
IF @cfg IS NULL OR LTRIM(RTRIM(@cfg)) = '' SET @cfg = N'{}';

IF ISJSON(@cfg) = 0
BEGIN
    RAISERROR('yj_panel.config 不是合法 JSON,拒绝覆盖(请先人工修正 %s 的 config)', 16, 1, @panel);
    RETURN;
END

-- ⚠ 兼容级别 100 没有 OPENJSON(实测报「对象名 OPENJSON 无效」),故用 ISJSON + 字符串判定
IF @cfg NOT LIKE '%"headDefaults"%'
BEGIN
    SET @cfg = JSON_MODIFY(@cfg, '$.headDefaults',
        JSON_QUERY(N'{"密级":"保密","文件使用范围":"银嘉内部"}', '$'));
    UPDATE yj_panel SET config = @cfg, config_at = SYSDATETIME() WHERE panel_code = @panel;
    PRINT '[SET] headDefaults = 密级:保密 / 文件使用范围:银嘉内部';
END
ELSE
    PRINT '[SKIP] headDefaults 已存在(保留现值)';

/* ── 自检 ── */
DECLARE @newCfg nvarchar(max) = (SELECT config FROM yj_panel WHERE panel_code = @panel);
IF ISJSON(@newCfg) = 0 OR @newCfg NOT LIKE '%"headDefaults"%'
BEGIN
    RAISERROR('自检失败:headDefaults 未写入', 16, 1);
    RETURN;
END
IF @newCfg NOT LIKE '%保密%' OR @newCfg NOT LIKE '%银嘉内部%'
BEGIN
    RAISERROR('自检失败:默认值内容不符(期望 密级=保密 / 文件使用范围=银嘉内部)', 16, 1);
    RETURN;
END

-- 默认值用的字段必须真的存在,且是下拉(否则写进去也选不出来)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @panel AND label = N'密级')
   OR NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @panel AND label = N'文件使用范围')
BEGIN
    RAISERROR('自检失败:面板缺 密级 / 文件使用范围 字段', 16, 1);
    RETURN;
END

PRINT '[OK] RD_DOM_TEST 新建默认值就位(密级=保密 / 文件使用范围=银嘉内部)';
PRINT '     config = ' + @newCfg;
