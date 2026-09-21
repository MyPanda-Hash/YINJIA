-- migrate-basedata-query-fields.sql — 基础资料面板「查询」弹窗常规字段补齐(每面板 ≤6 个)
-- 2026-09-20 用户口径:基础资料的查询按钮弹窗里字段太少(实测商品/客户/职员等只剩「备注」1 个),
--   每个面板补几个"常规检索字段"即可,**最多 6 个**。
-- 根因:基础资料是"一张虚拟单据 + 全量明细行"结构 → 表头字段只剩「备注」,而查询弹窗原来取的是表头字段;
--   本脚本按优先级给每个基础资料面板(≤6 个)字段加上 query 位(保留原 place,列仍留在表格里),
--   配套前端:档案/单单据面板的查询弹窗改取这组 queryFields(见 PanelxList.queryDialogFields)。
-- 优先级:编码/编号/代码 → 名称 → 规格 → 分类/类别 → 停用/状态 → 联系人/电话 → 部门/业务员/采购员
--         → 计量单位/品牌 → 日期/时间 → 备注(兜底) → 其它
-- 幂等:已带 query 位的字段不重复加;可重复执行。
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#qrank') IS NOT NULL DROP TABLE #qrank;
SELECT f.id, f.panel_code, f.label, f.place,
       ROW_NUMBER() OVER (PARTITION BY f.panel_code ORDER BY
         CASE
           WHEN f.label LIKE N'%编码' OR f.label = N'编号' OR f.label LIKE N'%代码' THEN 1
           WHEN f.label LIKE N'%名称' THEN 2
           WHEN f.label LIKE N'%规格%' THEN 3
           WHEN f.label LIKE N'%分类' OR f.label LIKE N'%类别' OR f.label = N'类别' THEN 4
           WHEN f.label LIKE N'%停用%' OR f.label = N'状态' THEN 5
           WHEN f.label LIKE N'%联系人%' OR f.label LIKE N'%电话%' THEN 6
           WHEN f.label LIKE N'%部门%' OR f.label LIKE N'%业务员%' OR f.label LIKE N'%采购员%' THEN 7
           WHEN f.label LIKE N'%计量单位%' OR f.label LIKE N'%品牌%' THEN 8
           WHEN f.label LIKE N'%日期%' OR f.label LIKE N'%时间%' THEN 9
           WHEN f.label = N'备注' THEN 10
           ELSE 20
         END, f.seq, f.id) AS rn
INTO #qrank
FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code AND p.mode = 'archive'
WHERE ISNULL(f.hidden, 0) = 0
  AND ISNULL(f.visible, 1) = 1
  AND ISNULL(f.data_type, N'') <> N'附件'
  AND f.col_name NOT LIKE N'%id'
  AND f.label NOT LIKE N'%地址%'
  AND f.label NOT LIKE N'%开户%'
  AND f.label NOT LIKE N'%账号%'
GO

UPDATE f
   SET f.place = CASE WHEN CHARINDEX('query', ISNULL(f.place, N'')) > 0 THEN f.place
                      WHEN ISNULL(f.place, N'') = N'' THEN N'query'
                      ELSE N'query,' + f.place END
FROM yj_field f
JOIN #qrank r ON r.id = f.id
WHERE r.rn <= 6;
GO

-- 已有 query 位、但不在前 6 名的字段:去掉 query 位(用户口径:每面板最多 6 个)
UPDATE f
   SET f.place = LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(f.place, N'query,', N''), N',query', N''), N'query', N'')))
FROM yj_field f
JOIN #qrank r ON r.id = f.id
WHERE r.rn > 6 AND f.place LIKE N'%query%'
  AND LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(f.place, N'query,', N''), N',query', N''), N'query', N''))) <> N'';
GO

-- 自检:每个基础资料面板应有 ≤6 个 query 位字段(且 ≥1)
SELECT p.panel_code, p.panel_name,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code AND f.place LIKE N'%query%') AS query字段数,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code AND f.hidden = 0 AND f.visible = 1) AS 可见字段数
FROM yj_panel p WHERE p.mode = 'archive' ORDER BY p.panel_code;
GO
-- 断言:超过 6 个 query 位字段的面板数必须为 0
SELECT COUNT(*) AS 超限面板数 FROM (
  SELECT f.panel_code FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code AND p.mode = 'archive'
  WHERE f.place LIKE N'%query%' GROUP BY f.panel_code HAVING COUNT(*) > 6
) x;
GO
PRINT N'migrate-basedata-query-fields 完成:基础资料每面板 ≤6 个常规查询字段';
GO
