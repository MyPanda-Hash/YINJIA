/* ============================================================
   数据记录表「文档编号」改参照立项申请(2026-09-09)
   业务:立项申请归档后,数据记录表的文档编号引用该立项申请的「单据编号」,
        一张数据记录表对应一个已归档的立项项目。
   范围:8 个数据记录表面板
        RD_FILTER_EFF / RD_ALKALINE / RD_MINERAL / RD_ANTIBACT
        RD_SCALE / RD_RO_PROTECT / RD_SOAK / RD_DROP_PREC
   幂等:条件 UPDATE,可重复执行(含取消隐藏 hidden=0)。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-rd-docno-ref.sql
   ============================================================ */
SET NOCOUNT ON;
GO

UPDATE yj_field
SET data_type = N'参照', ref_panel = N'RD_APPROVAL', ref_field = N'单据编号', display_field = N'单据编号', dict_sql = NULL
WHERE panel_code IN (N'RD_FILTER_EFF', N'RD_ALKALINE', N'RD_MINERAL', N'RD_ANTIBACT',
                     N'RD_SCALE', N'RD_RO_PROTECT', N'RD_SOAK', N'RD_DROP_PREC')
  AND col_name = N'文档编号'
  AND ISNULL(ref_panel, N'') <> N'RD_APPROVAL';
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

SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field, hidden
FROM yj_field
WHERE panel_code IN ('RD_FILTER_EFF','RD_ALKALINE','RD_MINERAL','RD_ANTIBACT',
                     'RD_SCALE','RD_RO_PROTECT','RD_SOAK','RD_DROP_PREC')
  AND col_name = N'文档编号'
ORDER BY panel_code;
GO
