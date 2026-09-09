/* ============================================================
   数据记录表「文档编号」改参照立项申请(2026-09-09)
   业务:立项申请归档后,数据记录表的文档编号引用该立项申请纸张「右上角」的编号
        ——即 RD_APPROVAL.文档编号(YJ-XSxxx 口径),两张纸右上角编号一致,
        一张数据记录表对应一个已归档的立项项目。
   范围:8 个数据记录表面板
        RD_FILTER_EFF / RD_ALKALINE / RD_MINERAL / RD_ANTIBACT
        RD_SCALE / RD_RO_PROTECT / RD_SOAK / RD_DROP_PREC
   幂等:条件 UPDATE,可重复执行(含取消隐藏 hidden=0、必填 required=1)。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-rd-docno-ref.sql
   ============================================================ */
SET NOCOUNT ON;
GO

UPDATE yj_field
SET data_type = N'参照', ref_panel = N'RD_APPROVAL', ref_field = N'文档编号', display_field = N'文档编号', dict_sql = NULL
WHERE panel_code IN (N'RD_FILTER_EFF', N'RD_ALKALINE', N'RD_MINERAL', N'RD_ANTIBACT',
                     N'RD_SCALE', N'RD_RO_PROTECT', N'RD_SOAK', N'RD_DROP_PREC')
  AND col_name = N'文档编号'
  AND (ISNULL(ref_panel, N'') <> N'RD_APPROVAL'
       OR ISNULL(ref_field, N'') <> N'文档编号'
       OR ISNULL(display_field, N'') <> N'文档编号');
GO

/* 取消隐藏:该字段原 hidden=1(纯文本时代为避免表头重复录入而隐藏),
   参照化后必须可见,否则字段不进 headerFields/纸张字段表,表头格仍渲染成普通输入框。 */
UPDATE yj_field
SET hidden = 0
WHERE panel_code IN (N'RD_FILTER_EFF', N'RD_ALKALINE', N'RD_MINERAL', N'RD_ANTIBACT',
                     N'RD_SCALE', N'RD_RO_PROTECT', N'RD_SOAK', N'RD_DROP_PREC')
  AND col_name = N'文档编号'
  AND hidden = 1;
GO

/* 立项申请表「文档编号」同样取消隐藏:该字段原先 hidden=1(DocSheet 右上角格硬编码渲染),
   隐藏后不进 headerFields,前端必填校验(validateInlineDraft)根本跑不到。 */
UPDATE yj_field
SET hidden = 0
WHERE panel_code = N'RD_APPROVAL'
  AND col_name = N'文档编号'
  AND hidden = 1;
GO

/* 必填(2026-09-09):两张纸的右上角编号都不允许留空——
   立项申请不填编号,被引用到数据记录表就是空值;数据记录表不填编号,项目归属就断链。 */
UPDATE yj_field
SET required = 1
WHERE col_name = N'文档编号'
  AND required = 0
  AND (panel_code = N'RD_APPROVAL'
       OR panel_code IN (N'RD_FILTER_EFF', N'RD_ALKALINE', N'RD_MINERAL', N'RD_ANTIBACT',
                         N'RD_SCALE', N'RD_RO_PROTECT', N'RD_SOAK', N'RD_DROP_PREC'));
GO

/* 去掉模板号默认值:列上原有 DEFAULT(数据记录表=YJ-PD-01、立项申请=YJ-XS002),
   会让新单右上角一开始就有值,required 校验形同虚设(直接拿模板号保存还会撞唯一性)。
   删掉默认约束后新单该列为空,必填校验才真正生效;历史单据数据不动。 */
DECLARE @drop nvarchar(max) = N'';
SELECT @drop += N'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(dc.parent_object_id))
              + N' DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(10)
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE c.name = N'文档编号'
  AND OBJECT_NAME(dc.parent_object_id) IN
      ('rd_approval','rd_filter_eff_head','rd_alkaline_head','rd_mineral_head','rd_antibact_head',
       'rd_scale_head','rd_ro_protect_head','rd_soak_head','rd_drop_prec_head');
IF @drop <> N'' EXEC sp_executesql @drop;
GO

SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field, hidden, required
FROM yj_field
WHERE col_name = N'文档编号'
  AND (panel_code = 'RD_APPROVAL'
       OR panel_code IN ('RD_FILTER_EFF','RD_ALKALINE','RD_MINERAL','RD_ANTIBACT',
                         'RD_SCALE','RD_RO_PROTECT','RD_SOAK','RD_DROP_PREC'))
ORDER BY panel_code;
GO
