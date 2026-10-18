SET NOCOUNT ON;
/* 这 6 张检验单表对应哪些面板(取材自服务器快照 = 下架前的状态) */
SELECT p.panel_code, p.panel_name AS 面板名, p.prefix AS 单号前缀, p.mode AS 模式,
       p.head_table AS 头表, p.line_table AS 行表, p.module_group AS 模块分组,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 字段行数,
       (SELECT COUNT(*) FROM yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权行数
FROM yj_panel p
WHERE p.panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC')
   OR p.head_table IN ('qc_mold_insp_head','qc_cut_insp_head','qc_fin_spec_head')
ORDER BY p.panel_code;

/* 反向:这 6 张表被哪些 yj_panel 行绑定 */
SELECT t.name AS 表名,
       (SELECT p.panel_code FROM yj_panel p WHERE p.head_table = t.name) AS 绑定面板_头表,
       (SELECT p.panel_code FROM yj_panel p WHERE p.line_table = t.name) AS 绑定面板_行表
FROM sys.tables t
WHERE t.name IN ('qc_mold_insp_head','qc_mold_insp_detail','qc_cut_insp_head','qc_cut_insp_detail','qc_fin_spec_head','qc_fin_spec_detail');

/* 6 张遗留表的数据体量(判断能否写成自包含迁移脚本) */
SELECT t.name AS 表名, SUM(p.rows) AS 行数,
       CAST(SUM(a.total_pages) * 8.0 / 1024 AS decimal(10,2)) AS 占用MB,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS 列数,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id AND c.system_type_id IN (35,165,167,231,241)) AS 大字段列数
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
JOIN sys.allocation_units a ON a.container_id = p.partition_id
WHERE t.name IN ('dm_langue','gscs','permission','s_commdata','s_sys','s_xtcs')
GROUP BY t.name, t.object_id ORDER BY t.name;
