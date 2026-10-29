/* ============================================================================
 * i18n-supplier-account-perm-20261025.sql —— 「供应商权限配置」按组织架构授权的新文案译名
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-25):「供应商权限配置面版不只是管理员可以来配置,需要能够通过组织架构添加可以配置的账号」。
 * 本脚本只补这场改动新增/改写的界面文案译名(scope=field,与前端 tt() 同一批键):
 *   已授权 / 配置供应商账号 / 没有该面板的权限 / 谁能进入本页……说明句
 * 已存在即跳过(不覆盖人工校对);幂等可重跑。两账套均需执行。
 * 前端静态语言包同一批词条由 tools/archive/_gen-supplier-portal-i18n.mjs 生成。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @t TABLE (ref_key nvarchar(400) NOT NULL, locale nvarchar(10) NOT NULL, text nvarchar(900) NOT NULL);

INSERT INTO @t (ref_key, locale, text) VALUES
 (N'已授权', 'en', N'Authorized'), (N'已授权', 'ja', N'権限あり'), (N'已授权', 'ko', N'권한 있음'),
 (N'已授权', 'de', N'Berechtigt'), (N'已授权', 'es', N'Autorizado'), (N'已授权', 'fr', N'Autorisé'),
 (N'已授权', 'ru', N'Есть права'), (N'已授权', 'vi', N'Đã được cấp quyền'), (N'已授权', 'th', N'ได้รับสิทธิ์'),

 (N'配置供应商账号', 'en', N'Manage supplier accounts'), (N'配置供应商账号', 'ja', N'仕入先アカウント設定'),
 (N'配置供应商账号', 'ko', N'공급업체 계정 설정'), (N'配置供应商账号', 'de', N'Lieferantenkonten verwalten'),
 (N'配置供应商账号', 'es', N'Gestionar cuentas de proveedor'), (N'配置供应商账号', 'fr', N'Gérer les comptes fournisseurs'),
 (N'配置供应商账号', 'ru', N'Управление аккаунтами поставщиков'), (N'配置供应商账号', 'vi', N'Quản lý tài khoản nhà cung cấp'),
 (N'配置供应商账号', 'th', N'จัดการบัญชีผู้จัดจำหน่าย'),

 (N'没有该面板的权限', 'en', N'No permission for this panel'), (N'没有该面板的权限', 'ja', N'このパネルへの権限がありません'),
 (N'没有该面板的权限', 'ko', N'이 패널에 대한 권한이 없습니다'), (N'没有该面板的权限', 'de', N'Keine Berechtigung für dieses Panel'),
 (N'没有该面板的权限', 'es', N'Sin permiso para este panel'), (N'没有该面板的权限', 'fr', N'Pas de droit sur ce panneau'),
 (N'没有该面板的权限', 'ru', N'Нет прав на эту панель'), (N'没有该面板的权限', 'vi', N'Không có quyền với màn hình này'),
 (N'没有该面板的权限', 'th', N'ไม่มีสิทธิ์ในหน้าจอนี้');

INSERT INTO @t (ref_key, locale, text) VALUES
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'en',
  N'Who can open this page: administrators, plus accounts whose role has "Manage supplier accounts" checked under Organization -> Role & panel permissions -> Smart Supply Chain -> Supplier Permission Setup.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'ja',
  N'このページを開けるのは管理者、および「組織 → ロールとパネル権限 → スマートサプライチェーン → 仕入先権限設定」で「仕入先アカウント設定」にチェックしたロールのアカウントです。'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'ko',
  N'이 페이지를 열 수 있는 사용자: 관리자, 그리고 조직 → 역할 및 패널 권한 → 스마트 공급망 → 공급업체 권한 설정에서 공급업체 계정 설정을 체크한 역할의 계정.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'de',
  N'Zugriff haben Administratoren sowie Konten, deren Rolle unter Organisation -> Rollen- und Panelrechte -> Smart Supply Chain -> Lieferantenberechtigungen "Lieferantenkonten verwalten" angehakt hat.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'es',
  N'Pueden entrar administradores y las cuentas cuyo rol tenga marcado "Gestionar cuentas de proveedor" en Organización -> Roles y permisos de panel -> Cadena de suministro -> Permisos de proveedores.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'fr',
  N'Accès réservé aux administrateurs et aux comptes dont le rôle a "Gérer les comptes fournisseurs" coché dans Organisation -> Rôles et droits des panneaux -> Chaîne d''approvisionnement -> Droits fournisseurs.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'ru',
  N'Доступ имеют администраторы и аккаунты, у роли которых отмечено "Управление аккаунтами поставщиков" в разделе Организация -> Роли и права на панели -> Цепочка поставок -> Права поставщиков.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'vi',
  N'Người được vào trang này: quản trị viên và tài khoản thuộc vai trò đã chọn "Quản lý tài khoản nhà cung cấp" trong Tổ chức -> Vai trò và quyền màn hình -> Chuỗi cung ứng -> Cấu hình quyền nhà cung cấp.'),
 (N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。', 'th',
  N'ผู้ที่เข้าได้: ผู้ดูแลระบบ และบัญชีที่บทบาทถูกติ๊ก "จัดการบัญชีผู้จัดจำหน่าย" ใน องค์กร -> บทบาทและสิทธิ์หน้าจอ -> ห่วงโซ่อุปทานอัจฉริยะ -> ตั้งค่าสิทธิ์ผู้จัดจำหน่าย');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', t.ref_key, t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'供应商权限配置(组织架构授权)新文案译名已写入(已存在的不覆盖)';
GO

/* ---------- 自检:4 个键各 9 语言 ---------- */
DECLARE @bad nvarchar(400) = N'';
SELECT @bad = @bad + ref_key + N'(' + CAST(c AS varchar) + N')'
  FROM (SELECT ref_key, COUNT(*) AS c FROM yj_translation
         WHERE scope = N'field' AND source = N'manual'
           AND ref_key IN (N'已授权', N'配置供应商账号', N'没有该面板的权限',
                           N'谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。')
         GROUP BY ref_key) t
 WHERE c < 9;
IF @bad <> N'' RAISERROR(N'自检失败:以下词条语言数不足 9: %s', 16, 1, @bad);

SELECT ref_key AS 文案, COUNT(*) AS 语言数 FROM yj_translation
 WHERE scope = N'field' AND ref_key IN (N'已授权', N'配置供应商账号', N'没有该面板的权限')
 GROUP BY ref_key;
GO
PRINT N'✅ 供应商权限配置授权文案译名就绪';
GO
