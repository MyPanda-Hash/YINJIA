/* 组织架构(照搬 light-mes OrgAdmin 契约):
   yj_dept/yj_role/yj_role_panel + yj_user 扩展列
   部门 = 公司真实架构(董事会/总办/四大中心/各部/科室) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF OBJECT_ID('yj_role_panel') IS NOT NULL DROP TABLE yj_role_panel;
IF OBJECT_ID('yj_role') IS NOT NULL DROP TABLE yj_role;
IF OBJECT_ID('yj_dept') IS NOT NULL DROP TABLE yj_dept;
GO
CREATE TABLE yj_dept (
    id        int IDENTITY(1,1) PRIMARY KEY,
    parent_id int          NOT NULL CONSTRAINT df_yjd_parent DEFAULT (0),
    dept_name nvarchar(60) NOT NULL,
    sort      int          NOT NULL CONSTRAINT df_yjd_sort DEFAULT (0)
);
CREATE TABLE yj_role (
    id        int IDENTITY(1,1) PRIMARY KEY,
    role_code nvarchar(40)  NOT NULL UNIQUE,
    role_name nvarchar(60)  NOT NULL,
    remark    nvarchar(200) NULL,
    is_admin  char(1)       NOT NULL CONSTRAINT df_yjr_admin DEFAULT ('N')
);
CREATE TABLE yj_role_panel (
    id          int IDENTITY(1,1) PRIMARY KEY,
    role_id     int          NOT NULL,
    panel_code  nvarchar(40) NOT NULL,
    can_approve char(1)      NOT NULL CONSTRAINT df_yjrp_appr DEFAULT ('N'),
    CONSTRAINT uq_yjrp UNIQUE (role_id, panel_code)
);
GO
-- ===== 公司组织架构 =====
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (0, N'董事会', 0);
DECLARE @board int = SCOPE_IDENTITY();

INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@board, N'总经理办公室', 1);
DECLARE @gm int = SCOPE_IDENTITY();

INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@gm, N'工程技术中心', 1);
DECLARE @c1 int = SCOPE_IDENTITY();
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@gm, N'生产管理中心', 2);
DECLARE @c2 int = SCOPE_IDENTITY();
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@gm, N'销售中心', 3);
DECLARE @c3 int = SCOPE_IDENTITY();
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@gm, N'财务行政中心', 4);
DECLARE @c4 int = SCOPE_IDENTITY();

-- 工程技术中心
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@c1, N'材料研发部', 1);
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@c1, N'产品开发部', 2);
DECLARE @pd int = SCOPE_IDENTITY();
INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (@c1, N'质量管理部', 3);
INSERT INTO yj_dept (parent_id, dept_name, sort)
VALUES (@pd, N'工艺科', 1), (@pd, N'开发科', 2), (@pd, N'检测科', 3);

-- 生产管理中心
INSERT INTO yj_dept (parent_id, dept_name, sort)
VALUES (@c2, N'工程部', 1), (@c2, N'采购部', 2), (@c2, N'生产部', 3), (@c2, N'仓管部', 4);

-- 销售中心
INSERT INTO yj_dept (parent_id, dept_name, sort)
VALUES (@c3, N'市场营销', 1), (@c3, N'业务跟单', 2);

-- 财务行政中心
INSERT INTO yj_dept (parent_id, dept_name, sort)
VALUES (@c4, N'行政部', 1), (@c4, N'财务部', 2);
GO
-- 角色
INSERT INTO yj_role (role_code, role_name, remark, is_admin) VALUES
('admin', N'管理员', N'全部面板与审批权限', 'Y'),
('user',  N'普通用户', N'按角色授权面板', 'N');
GO
-- yj_user 扩展:部门/角色/启用
IF COL_LENGTH('yj_user', 'dept_id') IS NULL ALTER TABLE yj_user ADD dept_id int NULL;
IF COL_LENGTH('yj_user', 'role_id') IS NULL ALTER TABLE yj_user ADD role_id int NULL;
IF COL_LENGTH('yj_user', 'enabled') IS NULL ALTER TABLE yj_user ADD enabled char(1) NOT NULL CONSTRAINT df_yju_en DEFAULT ('1');
GO
UPDATE yj_user SET role_id = (SELECT id FROM yj_role WHERE role_code='admin' AND is_admin='Y') WHERE is_admin='Y';
UPDATE yj_user SET role_id = (SELECT id FROM yj_role WHERE role_code='user' AND is_admin='N') WHERE ISNULL(is_admin,'N')<>'Y';
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_dept TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_role TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_role_panel TO yinjia;
GO
DECLARE @d int = (SELECT COUNT(*) FROM yj_dept);
PRINT N'组织架构迁移完成: 部门 ' + CAST(@d AS nvarchar(10)) + N' 个';
GO
