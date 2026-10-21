SET NOCOUNT ON;
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols FROM sys.tables t WHERE t.name='bl_purchase_in';
GO
SELECT source_form_no,target_form_no,link_status,linked_quantity,inventory_code FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='IJ-2026-09-0152';
