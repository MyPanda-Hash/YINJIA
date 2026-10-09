-- _q-topicking-clean.sql — 测试账套:转领料单验证留下的草稿清点(只读)
SET NOCOUNT ON;
SELECT h.单据编号, h.单据日期, h.加工单号, h.单据状态, ISNULL(h.asp_cancel,N'N') AS asp_cancel,
       (SELECT COUNT(*) FROM bl_material_out l WHERE l.单据编号 = h.单据编号) AS 明细行数,
       (SELECT COUNT(*) FROM form_flow_link f WHERE f.target_panel_code = N'MATERIAL_OUT'
          AND f.target_form_no = h.单据编号 AND f.link_status = 'ACTIVE') AS 活跃占用
FROM bd_material_out h ORDER BY h.单据编号;
