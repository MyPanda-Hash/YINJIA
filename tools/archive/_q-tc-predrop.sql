/* 删 QC_TC 前的现状勘查(只读):业务表行数 / 元数据行数 / 依赖 / 号池残留。
   用途:确认「彻底删掉面板与表」不会丢数据、不会被视图依赖挡住 DROP TABLE。 */
SET NOCOUNT ON;
SELECT
  (SELECT COUNT(*) FROM qc_tc)                                                 AS qc_tc行数,
  (SELECT COUNT(*) FROM qc_tc_detail)                                          AS qc_tc_detail行数,
  (SELECT COUNT(*) FROM yj_panel      WHERE panel_code = 'QC_TC')              AS yj_panel行数,
  (SELECT COUNT(*) FROM yj_field      WHERE panel_code = 'QC_TC')              AS yj_field行数,
  (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_TC')              AS yj_doc_status行数,
  (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code = 'QC_TC')           AS 审批行数,
  (SELECT COUNT(*) FROM yj_attachment WHERE panel_code = 'QC_TC')              AS 附件行数,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_TC' OR target_panel_code='QC_TC') AS 链路行数,
  (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = 'QC_TC')              AS 权限行数,
  (SELECT COUNT(*) FROM s_allno       WHERE lb = 'TC')                         AS 号池TC行数,
  (SELECT COUNT(*) FROM yj_field      WHERE ref_panel = 'QC_TC')               AS 被参照字段数;

-- 依赖:谁引用了 qc_tc/qc_tc_detail(视图/函数/触发器都会挡住 DROP TABLE)
SELECT DISTINCT o.name AS 引用对象, o.type_desc AS 类型
FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id = d.referencing_id
WHERE d.referenced_entity_name IN ('qc_tc', 'qc_tc_detail');

-- 外键
SELECT fk.name AS 外键 FROM sys.foreign_keys fk WHERE fk.referenced_object_id = OBJECT_ID('qc_tc');

-- 号池明细(有残留则下线时一并清)
SELECT lb, dh, ny FROM s_allno WHERE lb = 'TC' ORDER BY dh;

-- 面板译名:特采申请单(QC_TC_IN 也在复用这一条,删 QC_TC 时必须保留)
SELECT scope, ref_key, locale, text FROM yj_translation WHERE scope = 'panel' AND ref_key = N'特采申请单';
