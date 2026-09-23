SET NOCOUNT ON;
PRINT '=== A. 供应链/库存/品质/仓库/采购/订单 面板全量 ===';
SELECT module_group, panel_code, panel_name, mode, head_table, line_table
FROM yj_panel
WHERE module_group IN (N'智能供应链', N'库存核算', N'品质管理', N'仓库管理', N'采购管理', N'订单管理', N'基础设置', N'基础资料', N'基础档案', N'委外加工', N'生产管理')
ORDER BY module_group, panel_code;
GO
PRINT '=== B. 疑似"文件汇总/变更申请/公差/终止/标签/其他入出库"面板 ===';
SELECT panel_code, panel_name, module_group, mode FROM yj_panel
WHERE panel_name LIKE N'%汇总%' OR panel_name LIKE N'%变更%' OR panel_name LIKE N'%公差%'
   OR panel_name LIKE N'%终止%' OR panel_name LIKE N'%标签%' OR panel_name LIKE N'%其他入%'
   OR panel_name LIKE N'%其他出%' OR panel_name LIKE N'%客供%' OR panel_name LIKE N'%受控%'
   OR panel_name LIKE N'%特征%' OR panel_name LIKE N'%二维码%' OR panel_name LIKE N'%码%'
   OR panel_name LIKE N'%检验%' OR panel_name LIKE N'%暂收%' OR panel_name LIKE N'%退回%'
   OR panel_name LIKE N'%入库%' OR panel_name LIKE N'%出库%' OR panel_name LIKE N'%库存%'
   OR panel_name LIKE N'%规范%' OR panel_name LIKE N'%履历%' OR panel_name LIKE N'%等级%'
ORDER BY module_group, panel_code;
GO
PRINT '=== C. 项目定级 dict_sql ===';
SELECT panel_code, label, col_name, data_type, dict_sql FROM yj_field
WHERE label IN (N'项目定级', N'文件等级', N'等级', N'检验结果', N'检验频率', N'检验方式', N'预设库位', N'文件编码', N'是否受控', N'受控状态')
ORDER BY label, panel_code;
GO
PRINT '=== D. 三单 + 入库单 全部字段 ===';
SELECT panel_code, col_name, label, data_type, editable, required, visible, dict_sql, ref_panel
FROM yj_field WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','QC_TC','QC_JJF')
ORDER BY panel_code, col_name;
