/* 清理明确无业务事实的报工残留：不删除，只软作废。
   条件必须同时满足：报工号存在、工单号/工序为空、数量为0、非已完工、当前未作废。
   已完工或带工单号的历史记录绝不触碰，避免猜测业务事实。两账套执行。 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @expected int=(SELECT COUNT(*) FROM dbo.scjl
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([报工单号],N'')<>N''
   AND ISNULL(LTRIM(RTRIM(gldh)),N'')=N'' AND ISNULL(LTRIM(RTRIM(gxdm)),N'')=N''
   AND ISNULL(sl,0)=0 AND ISNULL(RTRIM(wgzt),N'')<>N'Y');
UPDATE dbo.scjl SET asp_cancel='Y',asp_user4=N'fix',asp_time4=GETDATE()
WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([报工单号],N'')<>N''
  AND ISNULL(LTRIM(RTRIM(gldh)),N'')=N'' AND ISNULL(LTRIM(RTRIM(gxdm)),N'')=N''
  AND ISNULL(sl,0)=0 AND ISNULL(RTRIM(wgzt),N'')<>N'Y';
IF @@ROWCOUNT<>@expected THROW 51000,N'无效报工残留修复行数异常',1;
COMMIT;
SELECT @expected AS 修复行数;
