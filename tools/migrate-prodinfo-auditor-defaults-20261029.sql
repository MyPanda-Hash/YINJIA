/* ============================================================================
   migrate-prodinfo-auditor-defaults-20261029.sql

   用户口径(2026-10-29):
     「产品信息表的这个两个审核人默认填写为冯总和陈秀丽,也可以修改的,保存之后也显示出来,
      现在没有显示出来」

   为什么之前没显示(两个叠加的真因,都已在本批修):
     a) 后端 putHeadDefaults 只挂在**空白草稿分支**(directAdd),主保存路径没调
        ⇒「新增 → 填数据 → 保存」这条最常见的路根本没写默认值;
     b) 前端 applyDocDefaults 只在 draftEditable(草稿态)跑,单据一归档就不再补 ⇒ 历史单永远空。

   本脚本负责**数据侧的默认值声明**:yj_panel.config.headDefaults。
   值:一级 = **冯总**(用户 2026-10-29 补充「不是冯敏,就是冯总,因为冯总使用的是管理员的账号」;
     冯总本人用 admin 账号,库里没有「冯总」这个 yj_user —— 但这两列是**纯展示文字**,
     审批人匹配走 yj_doc_status.l2_approver(存账号),不按姓名反查 ⇒ 写「冯总」不影响权限);
   二级 = **陈秀丽**(账号 cp 的真实姓名 —— writeBackL2Approver 写回时也是按 real_name 落这一格)。

   ⚠ JSON_MODIFY 的坑(本脚本第一版踩到,自检直接 FAIL):
     对**不存在的父路径**做 `$.a.b` 的 MODIFY 不会自动建中间对象 —— 必须
       ① 先建父:JSON_MODIFY(config, '$.headDefaults', JSON_QUERY('{}'))
       ② 再写子:JSON_MODIFY(config, '$.headDefaults."键"', N'值')
     写成一步 `$.headDefaults."键"` 时,SQL Server 静默不生效(不报错、值仍是旧样)。

   幂等:两处 MODIFY 都覆盖同名键,重复执行结果一致;已有其它键不动。
   两账套都执行(先正式、后测试)。
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @db sysname = DB_NAME();
PRINT N'[migrate-prodinfo-auditor-defaults] 库 = ' + @db;

-- ① config 至少是合法 JSON 对象
UPDATE yj_panel
SET config = N'{}'
WHERE panel_code = N'RD_PROD_INFO' AND (config IS NULL OR LTRIM(RTRIM(config)) = N'');

-- ② 先保证父对象存在(单步写 $.a.b 对不存在的 a 不生效)
UPDATE yj_panel
SET config = JSON_MODIFY(
        CASE
            WHEN JSON_QUERY(config, N'$.headDefaults') IS NULL
            THEN JSON_MODIFY(config, N'$.headDefaults', JSON_QUERY(N'{}'))
            ELSE config
        END,
        N'$.headDefaults."审核人（一级审批人）"', N'冯总')
WHERE panel_code = N'RD_PROD_INFO';

UPDATE yj_panel
SET config = JSON_MODIFY(config, N'$.headDefaults."审核人（二级审批人）"', N'陈秀丽')
WHERE panel_code = N'RD_PROD_INFO';

-- ③ 自检
DECLARE @l1 nvarchar(100) = (SELECT JSON_VALUE(config, N'$.headDefaults."审核人（一级审批人）"')
                             FROM yj_panel WHERE panel_code = N'RD_PROD_INFO');
DECLARE @l2 nvarchar(100) = (SELECT JSON_VALUE(config, N'$.headDefaults."审核人（二级审批人）"')
                             FROM yj_panel WHERE panel_code = N'RD_PROD_INFO');
IF ISNULL(@l1, N'') != N'冯总' OR ISNULL(@l2, N'') != N'陈秀丽'
BEGIN
    RAISERROR(N'自检失败:一级=「%s」二级=「%s」(期望 冯总 / 陈秀丽)', 16, 1, @l1, @l2);
    RETURN;
END

PRINT N'[migrate-prodinfo-auditor-defaults] OK(一级=冯总 / 二级=陈秀丽)';
SELECT panel_code,
       JSON_VALUE(config, N'$.headDefaults."审核人（一级审批人）"') AS 一级审核人,
       JSON_VALUE(config, N'$.headDefaults."审核人（二级审批人）"') AS 二级审核人
FROM yj_panel WHERE panel_code = N'RD_PROD_INFO';
