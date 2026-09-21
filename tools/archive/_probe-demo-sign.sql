SET NOCOUNT ON;
SELECT CAST(COUNT(*) AS nvarchar(10)) FROM yj_form_approval WHERE panel_code=N'RD_CHANGE' AND form_no=N'DEMO-CHG-001' AND action='SIGNOFF' AND result='PENDING';