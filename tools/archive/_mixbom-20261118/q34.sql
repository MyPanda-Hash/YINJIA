SELECT TOP 30 面板名, 按钮, 单据号, 操作人, 操作时间 FROM yj_usage_log WHERE 面板名 LIKE N'%组装物料%' OR 面板名='ASM_BOM' OR 单据号='C-23-11_V0001' ORDER BY id DESC;
