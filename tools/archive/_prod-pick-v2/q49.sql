SET NOCOUNT ON;
-- 用流水反算应有的 yl
SELECT wzdm, ckdm,
       SUM(CASE WHEN 段='inh' THEN 数量 ELSE 0 END) 入库合计,
       SUM(CASE WHEN 段='outh' THEN 数量 ELSE 0 END) 出库合计,
       SUM(CASE WHEN 段='inh' THEN 数量 ELSE -数量 END) 净额
  FROM (
    SELECT 'inh' 段, wzdm=NULL, 物料编码 wzdm, 仓库编码 ckdm, 数量 FROM inh WHERE 物料编码 IN ('YJ-ZZ-001','YJ-KBL-012') AND 仓库名称='恒亿仓'
    UNION ALL
    SELECT 'outh', NULL, 物料编码, 仓库编码, 数量 FROM outh WHERE 物料编码 IN ('YJ-ZZ-001','YJ-KBL-012') AND 仓库名称='恒亿仓'
  ) t GROUP BY wzdm, ckdm;
