/* update-qc-rod-categories.sql(2026-10-12):把炭棒样例的类别改成「可自由维护」的示范。
 *
 * 用户截图模式:项目类别(成品检验B/C/D/E)+ 项次 都是项目自己的字段,类别维护时自由录入。
 * 这里把样例类别改成更贴近实际的命名,示范「同一类别的项目自动归为一组」。
 * 幂等(按项目编码 UPDATE);两账套均执行。
 */
SET NOCOUNT ON;
GO

/* 类别重命名:外观→外观 · 尺寸→重要尺寸 · 重量→重量 · 功能性测试→性能 */
UPDATE bs_qc_item SET 检验内容 = N'重要尺寸' WHERE 项目编码 IN (N'ROD-DIM-OD', N'ROD-DIM-ID', N'ROD-DIM-L');
UPDATE bs_qc_item SET 检验内容 = N'性能'     WHERE 项目编码 IN (N'ROD-FN-DROP', N'ROD-FN-FLOW', N'ROD-FN-DP', N'ROD-FN-CL');
GO

/* 项次:同类别内按 序号 重新编 1..n(截图里的「项次」列) */
;WITH t AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY 方案编码, 检验内容 ORDER BY 序号, id) AS rn
  FROM bs_qc_item WHERE 方案编码 = N'QP-CARBON-ROD' AND ISNULL(asp_cancel,'N')<>'Y'
)
UPDATE i SET i.序号 = t.rn * 10
FROM bs_qc_item i JOIN t ON t.id = i.id;
GO

SELECT N'类别分布' AS 项, 检验内容 AS 类别, COUNT(*) AS 项目数
FROM bs_qc_item WHERE 方案编码 = N'QP-CARBON-ROD' AND ISNULL(asp_cancel,'N')<>'Y'
GROUP BY 检验内容 ORDER BY 检验内容;
GO
