-- 出货检验计划表 定稿态核对(2026-09-20):label / alias / 别名分流是否落地
SET NOCOUNT ON;
PRINT '===== RD_INSP_PLAN 表头 yj_field(label / alias 分叉的才算一处) =====';
SELECT f.seq, f.label AS 数据键, f.alias AS 显示别名, f.col_name, f.data_type, f.editable,
       CASE WHEN f.alias IS NOT NULL AND f.alias <> f.label THEN N'★分叉' ELSE N'' END AS 备注
FROM yj_field f
WHERE f.panel_code = N'RD_INSP_PLAN' AND f.place = N'head'
ORDER BY f.seq;

PRINT '===== RD_INSP_PLAN 明细 yj_field =====';
SELECT f.seq, f.label AS 数据键, f.alias AS 显示别名, f.col_name, f.data_type,
       CASE WHEN f.alias IS NOT NULL AND f.alias <> f.label THEN N'★分叉' ELSE N'' END AS 备注
FROM yj_field f
WHERE f.panel_code = N'RD_INSP_PLAN' AND f.place = N'detail'
ORDER BY f.seq;

PRINT '===== 检查频率 下拉的字典(设计 3 选项) =====';
SELECT f.label, f.dict_sql FROM yj_field f
WHERE f.panel_code = N'RD_INSP_PLAN' AND f.label IN (N'检测频率', N'检查频率', N'检验类别');

PRINT '===== 自动填充的落点字段是否真实存在 =====';
SELECT N'客户项目名称' AS 字段, COUNT(*) AS 命中 FROM yj_field f
  WHERE f.panel_code=N'RD_INSP_PLAN' AND f.label=N'客户项目名称'
UNION ALL SELECT N'产品整体尺寸', COUNT(*) FROM yj_field f
  WHERE f.panel_code=N'RD_INSP_PLAN' AND f.label=N'产品整体尺寸'
UNION ALL SELECT N'使用范围', COUNT(*) FROM yj_field f
  WHERE f.panel_code=N'RD_INSP_PLAN' AND f.label=N'使用范围'
UNION ALL SELECT N'产品功能类别', COUNT(*) FROM yj_field f
  WHERE f.panel_code=N'RD_INSP_PLAN' AND f.label=N'产品功能类别'
UNION ALL SELECT N'序号(明细)', COUNT(*) FROM yj_field f
  WHERE f.panel_code=N'RD_INSP_PLAN' AND f.label=N'序号' AND f.place=N'detail'
UNION ALL SELECT N'备注(明细)', COUNT(*) FROM yj_field f
  WHERE f.panel_code=N'RD_INSP_PLAN' AND f.label=N'备注' AND f.place=N'detail';

PRINT '===== insp.plan 标准库分组行数 =====';
SELECT item_code AS 分组, COUNT(*) AS 行数 FROM yj_std_lib WHERE lib_code = N'insp.plan' GROUP BY item_code;
