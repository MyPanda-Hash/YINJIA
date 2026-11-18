-- 2026-11-18 15:56 界面误操作(明细为空的「提交」)把组装物料清单 C-23-11_V0001 的 6 行全部软删
-- (asp_cancel='Y' ⇒ 整张单从列表消失)。本脚本把行恢复(物理行一直在,只是软删标记)。
SET NOCOUNT ON;
UPDATE dbo.bs_asm_bom SET asp_cancel = 'N', asp_user2 = NULL, asp_time2 = NULL
 WHERE 单据编号 = 'C-23-11_V0001' AND asp_cancel = 'Y';
PRINT N'恢复行数:' + CAST(@@ROWCOUNT AS nvarchar(10));
GO
SELECT COUNT(*) AS active_rows FROM dbo.bs_asm_bom WHERE 单据编号 = 'C-23-11_V0001' AND ISNULL(asp_cancel,'N') <> 'Y';
