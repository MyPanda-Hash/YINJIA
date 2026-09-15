SELECT panel_code, panel_name, prefix, module_group FROM yj_panel WHERE panel_code IN ('QC_BHG','QC_BHC','QC_TC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY') ORDER BY panel_code;
SELECT panel_code, COUNT(*) AS fields FROM yj_field WHERE panel_code IN ('QC_BHG','QC_BHC','QC_TC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY') GROUP BY panel_code ORDER BY panel_code;
SELECT COUNT(*) AS panel_en FROM yj_translation WHERE scope='panel' AND ref_key IN (N'不合格报告(制程)',N'不合格品处理单(制程)',N'特采申请单',N'不合格品处理单(自制物料)',N'紧急放行申请单',N'试产材料使用申请单',N'来料异常分析报告',N'生产异常分析报告') AND locale='en';
SELECT COUNT(*) AS field_en FROM yj_translation WHERE scope='field' AND locale='en' AND ref_key IN (N'填写部门',N'填写人',N'检验工站',N'异常时间',N'责任部门',N'异常产品规格',N'不合格品数量',N'异常等级',N'异常描述',N'原因分析',N'改善对策',N'效果跟踪',N'品质部意见',N'产品编码',N'产品规格',N'生产量',N'不合格品比例',N'问题来源',N'责任人',N'问题描述',N'性能验证',N'处理意见',N'产品开发部性能意见',N'产品开发部工艺意见',N'销售部意见',N'改善效果验证',N'材料费用',N'人工费',N'其他费用',N'采购单号',N'总数量',N'不良说明',N'严重程度',N'特采理由',N'研发意见',N'最终处理结果',N'物料批次',N'生产数量',N'研发部意见',N'产品开发部意见',N'物料类型',N'申请放行数量',N'批次号',N'紧急放行原因',N'检测结果',N'检测人',N'材料来源描述',N'测试结果',N'来料数量',N'不良率',N'供应商原因',N'内部原因',N'处理方式',N'改善追踪结果',N'产品/物料名称',N'产品/物料批次',N'产品/物料编码',N'一般不合格',N'严重不合格',N'成型',N'组装',N'返工达到规定要求',N'让步使用',N'报废',N'筛选合格品留用',N'严重',N'一般',N'轻微',N'正常使用',N'挑选使用',N'制程',N'成品',N'外部来料',N'自制物料',N'整批退货',N'全检挑选');
SELECT name FROM sys.tables WHERE name LIKE 'qc_%' ORDER BY name;
-- 抽查 SCY 标签斜杠与 dict 值完整回读
SELECT col_name, label, data_type FROM yj_field WHERE panel_code='QC_SCY' ORDER BY seq;
SELECT dict_sql FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'处理意见';
