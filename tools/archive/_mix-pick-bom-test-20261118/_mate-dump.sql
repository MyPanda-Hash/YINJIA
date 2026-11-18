SET NOCOUNT ON;
SELECT m_no AS 成品, xc AS 行, wzdm2 AS 子件, wzmc2 AS 子件名, gg2 AS 规格, jldw2 AS 单位, bzl AS 标准用量, sl2 AS 损耗, bz AS 备注, asp_user1 AS 创建人, asp_time1 AS 创建时间
FROM mate WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY m_no, xc;
