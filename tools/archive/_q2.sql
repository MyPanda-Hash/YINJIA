SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name IN ('yj_std_lib','yj_message','yj_attachment','yj_plan_term','yj_form_flow_link','qr_batch_registry');
