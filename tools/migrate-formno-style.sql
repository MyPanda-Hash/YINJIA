-- 迁移:单据编号风格统一为「前缀-yyyy-MM-NNNN」(方案A,2026-09-07)
-- 1) yj_panel.prefix 对齐各面板业务数据中已存在的横杠风格前缀(演示种子/遗留单据)
--    DP→PG(工序派工单) WO→WW(委外加工单) ML→CL(材料出库单) RK→IC(入库单,inh 表 75 条 IC-2026-07/08 遗留单)
-- 2) 历史横杠格式单号回登 s_allno 号池(原仅存在于业务表,号池无记录导致续号无法衔接)
--    按 dh 不存在才插入(幂等);lb=前缀段,ny=yyyy-MM 段,与 FormNoService 新规则一致
-- 幂等:可重复执行;旧紧凑格式行(ny=yyMMdd)不受影响,与新格式(ny=yyyy-MM)天然隔离

-- ---- 1) 前缀对齐 ----
UPDATE yj_panel SET prefix = 'PG' WHERE panel_code = 'DISPATCH'      AND ISNULL(prefix,'') <> 'PG';
UPDATE yj_panel SET prefix = 'WW' WHERE panel_code = 'OUTSOURCE_ORDER' AND ISNULL(prefix,'') <> 'WW';
UPDATE yj_panel SET prefix = 'CL' WHERE panel_code = 'MATERIAL_OUT'  AND ISNULL(prefix,'') <> 'CL';
UPDATE yj_panel SET prefix = 'IC' WHERE panel_code = 'RKD'           AND ISNULL(prefix,'') <> 'IC';

-- ---- 2) 历史横杠单号回登号池 ----
-- 横杠格式:XX-yyyy-MM-NNNN(前缀 2~4 位字母)
;WITH hist(dh) AS (
    SELECT 单据编号 FROM bd_dispatch      WHERE 单据编号 LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    UNION
    SELECT 单据编号 FROM bd_outsource_order WHERE 单据编号 LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    UNION
    SELECT 单据编号 FROM bd_material_out  WHERE 单据编号 LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    UNION
    SELECT 单据编号 FROM bd_pu_order      WHERE 单据编号 LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    UNION
    SELECT 单据编号 FROM bd_so_order      WHERE 单据编号 LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    UNION
    SELECT inh_no   FROM inh        WHERE inh_no   LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    UNION
    SELECT od_no    FROM order_bt   WHERE od_no    LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
)
INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
SELECT '0', h.dh,
       LEFT(h.dh, CHARINDEX('-', h.dh) - 1),
       SUBSTRING(h.dh, CHARINDEX('-', h.dh) + 1, 7),
       'migration', GETDATE(), 'N'
FROM hist h
WHERE NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.dh);
