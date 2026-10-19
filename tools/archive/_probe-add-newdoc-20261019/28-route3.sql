SET NOCOUNT ON;
SELECT id, 工艺路线编码, 工艺路线名称, 工序编码, 工序名称, 备注, 停用, asp_user1, asp_time1
FROM bs_route WHERE 工艺路线编码 LIKE 'GY-2026-10-%' ORDER BY 工艺路线编码, id;
