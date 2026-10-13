-- _health-norm-detail.sql  只读:复现 DbNormAudit 03/05/09/13 完整清单(体检输出截断,这里取全量)
-- 兼容级别 100(不支持 WITHIN GROUP),中文排序规则下 LIKE 字符区间无效,故用 1252 往返比较判「含中文」
-- 03:表名 → 无中文注明且列名为拼音/英文的列(白名单 table: 已内联排除)
SELECT t.name AS 表, COUNT(*) AS 无注明英文列数, STRING_AGG(c.name, N', ') AS 列清单
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description')
  AND c.name NOT LIKE N'asp[_]%' AND c.name <> N'id'
  AND c.name = CAST(CAST(c.name COLLATE Latin1_General_BIN2 AS varchar(4000)) AS nvarchar(4000))
  AND t.name NOT IN (N'Porder', N'day_report', N'day_report_detail', N'dm_ck', N'dm_gf', N'dm_key', N'dm_kh', N'dtproperties', N'equip_check', N'equip_check_detail', N'erp_imp_log', N'erp_imp_row', N'feed_confirm', N'feed_confirm_detail', N'form_flow_link', N'gran_record', N'gran_record_detail', N'gxgs', N'inh', N'inv_cost_ledger', N'kucun', N'maint_plan', N'maint_plan_detail', N'mate', N'mix_record', N'mix_record_detail', N'order_bs', N'order_bt', N'outh', N'pack_confirm', N'pack_confirm_detail', N'plang', N'plang_pc', N'qr_batch_registry', N'report_column_settings', N'rod_return', N'rod_return_detail', N's_allno', N's_log', N'sample_req', N'sample_req_detail', N'scjl', N'sl_recv', N'sl_recv_detail', N'wh_record', N'wh_record_detail')
GROUP BY t.name ORDER BY 2 DESC, 1;
GO
-- 05:元数据漂移完整清单
SELECT RTRIM(f.panel_code) AS 面板, f.col_name AS 列, RTRIM(f.place) AS place,
       ISNULL(p.line_table,'') + ' / ' + ISNULL(p.head_table,'') AS 对象
FROM yj_field f LEFT JOIN yj_panel p ON RTRIM(p.panel_code) = RTRIM(f.panel_code)
WHERE f.col_name IS NOT NULL
  AND NOT (
    CASE WHEN f.place LIKE '%header%' AND ISNULL(p.head_table,'') <> '' THEN COL_LENGTH(p.head_table, f.col_name)
         WHEN f.place LIKE '%detail%' THEN COL_LENGTH(p.line_table, f.col_name)
         ELSE COALESCE(COL_LENGTH(p.line_table, f.col_name), COL_LENGTH(p.head_table, f.col_name)) END IS NOT NULL)
ORDER BY 1, f.seq;
GO
-- 13:面板引用对象缺 pk_col / asp_cancel
SELECT RTRIM(panel_code) AS 面板, line_table AS 表, ISNULL(pk_col,'') AS pk_col,
       CASE WHEN ISNULL(pk_col,'') <> '' AND COL_LENGTH(line_table, pk_col) IS NULL THEN N'缺pk ' ELSE N'' END
     + CASE WHEN COL_LENGTH(line_table,'asp_cancel') IS NULL THEN N'缺asp_cancel' ELSE N'' END AS 缺失
FROM yj_panel
WHERE line_table IS NOT NULL AND OBJECT_ID(line_table) IS NOT NULL
  AND ((ISNULL(pk_col,'') <> '' AND COL_LENGTH(line_table, pk_col) IS NULL) OR COL_LENGTH(line_table,'asp_cancel') IS NULL)
ORDER BY 1;
GO
SELECT STRING_AGG(RTRIM(p.panel_name), N' | ') AS 缺en面板
FROM yj_panel p WHERE NOT EXISTS (
  SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = RTRIM(p.panel_name) AND t.locale='en');
GO
SELECT STRING_AGG(x.面板 + N':' + CAST(x.n AS nvarchar(10)), N' | ') AS 缺en字段标签分布
FROM (SELECT RTRIM(f.panel_code) AS 面板, COUNT(DISTINCT f.label) AS n
      FROM yj_field f WHERE NOT EXISTS (
        SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label AND t.locale='en')
      GROUP BY RTRIM(f.panel_code)) x;