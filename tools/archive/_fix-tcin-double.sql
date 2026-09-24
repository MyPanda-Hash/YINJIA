SET NOCOUNT ON;
/* 修复双拼(迁移重复执行所致:'200.0000支支'->'200支')+数值去尾零 */
UPDATE qc_tc_in SET 总数量 = CAST(CAST(LEFT(总数量, PATINDEX(N'%[^0-9.]%', 总数量+N'#')-1) AS float) AS nvarchar(30)) + 计量单位
 WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 总数量+N'#') > 1
   AND TRY_CAST(LEFT(总数量, PATINDEX(N'%[^0-9.]%', 总数量+N'#')-1) AS float) IS NOT NULL;
UPDATE qc_tc_in SET 总数量 = NULL WHERE ISNULL(总数量,N'')=N'';
SELECT TOP 6 单据编号, 总数量, 计量单位 FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
