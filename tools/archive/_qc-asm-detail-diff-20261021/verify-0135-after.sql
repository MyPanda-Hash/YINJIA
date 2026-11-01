SET NOCOUNT ON;
SELECT id, 行号, 检验类型, 检验项目, 检验要求, 检验方法, 检验结果, 结果判断,
       测量值1, 测量值2, 测量值3, 合格数量, 不合格数量, asp_cancel, asp_user1, asp_user2
FROM qc_asm_insp_detail WHERE 单据编号=N'ZJ-2026-10-0135' ORDER BY 行号, id;
