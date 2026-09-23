SET NOCOUNT ON;
SELECT CAST(id AS nvarchar(20)) AS id, 部门, 表区, ISNULL(变更后内容,'') AS c, ISNULL(签字,'') AS g,
       ISNULL(日期,'') AS d, ISNULL(备注,'') AS r, CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 'C' ELSE 'L' END AS live
  FROM rd_change_detail WHERE 单据编号 = N'CHG-2026-09-0021' ORDER BY rd_change_detail.id;