UPDATE dbo.yj_user SET dept_id = 322 WHERE username = 'admin';   -- 材料自制车间(验证按账号所属部门带入)
SELECT username, dept_id FROM dbo.yj_user WHERE username='admin';
SELECT id, 部门编码, 部门名称 FROM dbo.bs_dept WHERE id = 322;
