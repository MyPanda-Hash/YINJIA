/* ============================================================================
   产品信息表(RD_PROD_INFO)把「产品名称」设为必填 —— 漏填时保存前高亮提醒

   用户口径(2026-10-16):
     「把产品信息表的左上角的产品信息表这个栏目改为产品名称的填写框,留出空白然后背景提示词为:产品名称,
      然后可以在规格书等4张单据填写的时候通过产品编号进行一个引用,4张单据有产品名称的才引用,没有就不影响,
      产品信息表忘记填写这个产品名称就高亮提醒」。

   纸面那格已改成输入框(前端 recordSheetConfigs.RD_PROD_INFO 的 titleKey,同批提交);
   本脚本只改**元数据**:required=1 ⇒ 前端保存前校验缺必填并闪红(rs-focus 高亮 3 秒),
   后端 assertRequired 也在提交/归档路径同口径拦截(与其它必填字段一致)。

   为什么产品名称重要:下游「成型工艺清单 RD_MOLD_PROC」「组装工艺清单 RD_ASM_PROC」的头字段
   产品名称,是靠**产品编号参照 RD_PROD_INFO** 时由 buildRefMap 同名带回的
   (实测 refMap 已含 {"from":"产品名称","to":"产品名称"});
   规格书/出货检验计划表没有「产品名称」字段,按用户口径「没有就不影响」,不动。

   幂等:仅在当前不是必填时改;末尾自检 required=1,否则 RAISERROR。两账套均执行。
   ============================================================================ */

SET NOCOUNT ON;
PRINT '=== RD_PROD_INFO.产品名称 设为必填 ===';

IF OBJECT_ID(N'dbo.yj_field', N'U') IS NULL
BEGIN
    RAISERROR(N'yj_field 不存在,跳过', 16, 1);
    RETURN;
END

-- ⚠ 同一标签在该面板登记了**两行**(place='query,header' 与 place='header'),
--   只把**表头那行**置必填(查询区那行是筛选用,不该参与保存校验)。
-- 整段放进事务:自检不过就整体回滚,不留半成品(首次写漏了事务,自检失败但 UPDATE 已落地,
-- DbSync 记成 FAIL 且下次重跑还会再失败 —— 实测踩到)。
BEGIN TRANSACTION;

UPDATE yj_field SET required = 1
WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品名称'
  AND place LIKE N'%header%' AND ISNULL(required, 0) = 0;
PRINT '置必填(表头行)更新行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- 反向归位:查询区那行不该是必填(它只是筛选用;打了必填会让查询框带红星)
UPDATE yj_field SET required = 0
WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品名称'
  AND place NOT LIKE N'%header%' AND ISNULL(required, 0) = 1;
PRINT '查询区行归位更新行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- 自检:表头那行必须 required=1(不要求全库唯一 —— 该标签有两行),查询区那行必须不是必填
IF (SELECT COUNT(*) FROM yj_field
    WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品名称'
      AND place LIKE N'%header%' AND required = 1) < 1
   OR (SELECT COUNT(*) FROM yj_field
       WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品名称'
         AND place NOT LIKE N'%header%' AND ISNULL(required, 0) = 1) > 0
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'自检失败:表头行未置必填,或查询区行仍为必填', 16, 1);
    RETURN;
END
COMMIT TRANSACTION;
PRINT '自检通过:RD_PROD_INFO.产品名称(表头行)required=1';
PRINT '=== 完成 ===';
