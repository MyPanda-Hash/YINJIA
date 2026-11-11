import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;

/**
 * GenOrgSql —— 从服务器备份巡检库 HSDZ_MES_SRV 生成「组织结构配置」迁移脚本。
 *
 * <p>背景(2026-11-11 用户口径):「先根据服务器数据库备份的组织结构进行配置」——
 * 服务器备份 {@code 服务器数据库备份/HSDZ_MES_manual_20261111-110118.bak} 还原成
 * {@code HSDZ_MES_SRV} 后,把 组织架构(yj_dept / yj_role / yj_user / yj_role_panel)
 * 按服务器现状配置到本地两账套,否则检验报告提交审批时的「审批人」解析不到人
 * (本地 冯敏 是停用的普通用户,且 role_panel 只有 691 行)。
 *
 * <p>产出:tools/migrate-org-from-server-20261111.sql(幂等;两账套执行)。
 *
 * <p>用法(tools 目录下):
 * <pre>java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_org-sync-20261111/GenOrgSql.java</pre>
 *
 * <p>刻意不导出 password_hash / MobId / phoneNo:口令与会话无关,照抄等于把生产凭据写进仓库;
 * 脚本执行时本地所有账号统一取**本机 admin 现有口令哈希**(即 admin 的本地密码)。
 */
public class GenOrgSql {

    static final String HOST = "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;loginTimeout=15";
    static final String USER = "yinjia";
    static final String PASS = "Yinjia@2026";
    static final String SRV = "HSDZ_MES_SRV";
    static final String LOC = "HSDZ_MES";

    public static void main(String[] args) throws Exception {
        Path out = Path.of("migrate-org-from-server-20261111.sql");
        StringBuilder sb = new StringBuilder();
        try (Connection srv = DriverManager.getConnection(HOST + ";databaseName=" + SRV, USER, PASS);
             Connection loc = DriverManager.getConnection(HOST + ";databaseName=" + LOC, USER, PASS)) {

            List<String[]> depts = rows(srv, "SELECT id, parent_id, dept_name, ISNULL(sort,0) FROM yj_dept ORDER BY id");
            List<String[]> roles = rows(srv, "SELECT id, role_code, role_name, ISNULL(remark,N''), is_admin FROM yj_role ORDER BY id");
            List<String[]> users = rows(srv, "SELECT id, username, real_name, is_admin, ISNULL(dept_id,-1), role_id, enabled,"
                    + " ISNULL(生产车间,N'') FROM yj_user ORDER BY id");
            List<String[]> panels = rows(srv, "SELECT id, role_id, panel_code, can_approve, perms FROM yj_role_panel ORDER BY id");
            Set<String> srvPanels = new TreeSet<>();
            for (String[] p : rows(srv, "SELECT panel_code FROM yj_panel")) srvPanels.add(p[0]);

            Set<String> locPanels = new TreeSet<>();
            for (String[] p : rows(loc, "SELECT panel_code FROM yj_panel")) locPanels.add(p[0]);
            List<String> localOnly = new ArrayList<>();
            for (String p : locPanels) if (!srvPanels.contains(p)) localOnly.add(p);
            Collections.sort(localOnly);

            // 本地面板独有(服务器备份里没有)的授权行要保留,但它们引用的老角色 id 也要按服务器重映射
            List<String[]> locRoles = rows(loc, "SELECT id, role_code FROM yj_role ORDER BY id");
            Map<String, String> roleByCodeSrv = new LinkedHashMap<>();
            for (String[] r : roles) roleByCodeSrv.put(r[1], r[0]);
            StringBuilder remap = new StringBuilder();
            for (String[] r : locRoles) {
                String code = r[1], id = r[0];
                String srvId = roleByCodeSrv.get(code);
                if (srvId != null && !srvId.equals(id)) {
                    remap.append("UPDATE @keep SET role_id = ").append(srvId)
                         .append(" WHERE role_id = ").append(id).append(";\n");
                }
            }

            header(sb, depts.size(), roles.size(), users.size(), panels.size(), localOnly, remap.toString());
            body(sb, depts, roles, users, panels, localOnly);
            footer(sb);
        }
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[OK] 已生成 " + out.toAbsolutePath());
    }

    static void header(StringBuilder sb, int nDept, int nRole, int nUser, int nRp,
                       List<String> localOnly, String remap) {
        sb.append("/* ============================================================================\n")
          .append(" * migrate-org-from-server-20261111.sql —— 按**服务器备份的组织结构**配置本机组织架构\n")
          .append(" * ----------------------------------------------------------------------------\n")
          .append(" * 用户口径(2026-11-11):「先根据 D:\\YINJIA-main\\服务器数据库备份 的组织结构进行配置。」\n")
          .append(" * 备份:HSDZ_MES_manual_20261111-110118.bak(服务器 2026-11-11 11:01 打的完整备份)\n")
          .append(" *       → 本机还原成巡检库 HSDZ_MES_SRV(只读对照,不参与业务)\n")
          .append(" * 脚本由 tools/archive/_org-sync-20261111/GenOrgSql.java 生成(勿手改:重跑生成器即覆盖)。\n")
          .append(" *\n")
          .append(" * 为什么必须先配:检验报告(QC_INSP_REC)提交审批时,收件人 = 该面板 can_approve='Y' 的角色\n")
          .append(" * 下的账号 + 管理员(MessageService.approversOf)。本机原来的组织结构是残缺的 ——\n")
          .append(" *   · 只有 ").append(nRole).append(" 个角色里的一部分(yj_role 4 行)、7 个账号;\n")
          .append(" *   · 冯敏(fengmin)是**停用的普通用户**,且「质量审核」这类作审批用的角色根本不存在;\n")
          .append(" *   · yj_role_panel 只有 691 行(服务器 ").append(nRp).append(" 行)⇒ QC_INSP_REC 上没有任何角色勾过审批权。\n")
          .append(" * 于是「通知审核人冯敏待审批」永远发不出去。本脚本把 4 张组织架构表按服务器现状对齐:\n")
          .append(" *   ① yj_dept  ").append(nDept).append(" 行(部门树);\n")
          .append(" *   ② yj_role  ").append(nRole).append(" 行(角色);\n")
          .append(" *   ③ yj_user  ").append(nUser).append(" 行(账号:姓名/角色/部门/启用状态/所属车间);\n")
          .append(" *   ④ yj_role_panel ").append(nRp).append(" 行(面板权限矩阵,含 can_approve 审批权)。\n")
          .append(" *\n")
          .append(" * 口径与边界(务必按这几条读):\n")
          .append(" *  · **口令不照抄**:password_hash 一个字节都不入仓库。执行时先把本机 admin 的哈希取进变量,\n")
          .append(" *    之后所有账号统一用它 ⇒ 本机所有人的密码 = admin 的密码(开发/演示方便,生产另论)。\n")
          .append(" *  · **手机端字段不照抄**(MobId/phoneNo 属个人数据):本机要用手机扫码登录,另行在账号上配。\n")
          .append(" *  · 本机**独有**的面板(");
        if (localOnly.isEmpty()) sb.append("无");
        else sb.append(String.join("/", localOnly));
        sb.append(")授权行保留;它们引用的老角色 id 按 role_code 重映射到服务器角色 id。\n")
          .append(" *  · 本机独有的账号(服务器备份里没有的,如早期演示账号 cg/ccg)随整表替换一并移除。\n")
          .append(" *  · 幂等:DELETE + 带 IDENTITY_INSERT 的整表重灌;重复执行结果不变。\n")
          .append(" * ========================================================================== */\n\n")
          .append("SET NOCOUNT ON;\nGO\n\n")
          .append("/* ---- ① 只允许在本机两个账套上跑(防止误在巡检库/服务器库上执行) ---- */\n")
          .append("IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')\n")
          .append("BEGIN\n")
          .append("    RAISERROR(N'本脚本只用于本机 HSDZ_MES / HSDZ_MES_TEST;当前库 %s 拒绝执行', 16, 1, 1)\n")
          .append("    WITH NOWAIT;\n")
          .append("    RETURN;\n")
          .append("END\nGO\n\n")
          .append("/* ---- ② 先取本机 admin 口令哈希(整表重灌后所有账号统一用它)+ 本机独有面板的授权行 ----\n")
          .append("   注意:DbSync 按 GO 分批、同一连接执行 ⇒ 用**临时表**(#ph/#keep)而不是表变量/局部变量跨越批次 */\n")
          .append("IF OBJECT_ID('tempdb..#ph') IS NOT NULL DROP TABLE #ph;\n")
          .append("CREATE TABLE #ph (v nvarchar(400));\n")
          .append("INSERT INTO #ph (v) SELECT TOP 1 password_hash FROM yj_user WHERE ISNULL(password_hash, N'') <> N'' AND username = N'admin';\n")
          .append("-- 本机没有 admin 口令哈希时(如首次灌库)用**开发机固定口令**兜底:admin / 123456。\n")
          .append("-- 这不是生产凭据:生产库永远走上面那条「沿用本机 admin 现有哈希」的分支,本常量只在空库/重灌时生效。\n")
          .append("IF (SELECT COUNT(*) FROM #ph WHERE ISNULL(v, N'') <> N'') = 0\n")
          .append("    INSERT INTO #ph (v) VALUES (N'yj1$50000$fe24e6c814e88a81bde095967fff7fd6$1691298eac1040377e5eb1a35d4922a2700a90c2c5a783f1d60af998ac763068');\nGO\n\n")
          .append("IF OBJECT_ID('tempdb..#keep') IS NOT NULL DROP TABLE #keep;\n")
          .append("SELECT role_id, panel_code, can_approve, perms INTO #keep FROM yj_role_panel\n")
          .append(" WHERE panel_code IN (");
        if (localOnly.isEmpty()) sb.append("NULL");
        else {
            List<String> q = new ArrayList<>();
            for (String p : localOnly) q.add("N'" + p.replace("'", "''") + "'");
            sb.append(String.join(", ", q));
        }
        sb.append(");\n")
          .append("/* 本机独有面板的授权行:老角色 id → 服务器角色 id(按 role_code 对齐) */\n");
        if (!remap.isEmpty()) sb.append(remap.replace("@keep", "#keep"));
        sb.append("GO\n\n");
    }

    static void body(StringBuilder sb, List<String[]> depts, List<String[]> roles, List<String[]> users,
                     List<String[]> panels, List<String> localOnly) {
        sb.append("/* ---- ③ 部门树 ---- */\n")
          .append("DELETE FROM yj_dept;\nGO\n")
          .append("SET IDENTITY_INSERT yj_dept ON;\n");
        for (String[] d : depts)
            sb.append("INSERT INTO yj_dept (id, parent_id, dept_name, sort) VALUES (")
              .append(d[0]).append(", ").append(d[1]).append(", N'").append(esc(d[2])).append("', ").append(d[3]).append(");\n");
        sb.append("SET IDENTITY_INSERT yj_dept OFF;\nGO\n\n");

        sb.append("/* ---- ④ 角色 ---- */\n")
          .append("DELETE FROM yj_role;\nGO\n")
          .append("SET IDENTITY_INSERT yj_role ON;\n");
        for (String[] r : roles)
            sb.append("INSERT INTO yj_role (id, role_code, role_name, remark, is_admin) VALUES (")
              .append(r[0]).append(", N'").append(esc(r[1])).append("', N'").append(esc(r[2])).append("', N'")
              .append(esc(r[3])).append("', '").append(yesNo(r[4])).append("');\n");
        sb.append("SET IDENTITY_INSERT yj_role OFF;\nGO\n\n");

        sb.append("/* ---- ⑤ 账号(口令统一为本机 admin 的哈希;手机端字段不清不填) ---- */\n")
          .append("DELETE FROM yj_user;\nGO\n")
          .append("SET IDENTITY_INSERT yj_user ON;\n");
        for (String[] u : users) {
            String dept = "-1".equals(u[4]) ? "NULL" : u[4];
            String workshop = u.length > 7 && u[7] != null && !u[7].isEmpty() ? "N'" + esc(u[7]) + "'" : "NULL";
            sb.append("INSERT INTO yj_user (id, username, password_hash, real_name, is_admin, dept_id, role_id, enabled, 生产车间) VALUES (")
              .append(u[0]).append(", N'").append(esc(u[1])).append("', (SELECT TOP 1 v FROM #ph), N'").append(esc(u[2])).append("', '")
              .append(yesNo(u[3])).append("', ").append(dept).append(", ").append(u[5]).append(", '")
              .append(enable(u[6])).append("', ").append(workshop).append(");\n");
        }
        sb.append("SET IDENTITY_INSERT yj_user OFF;\nGO\n\n");

        sb.append("/* ---- ⑥ 面板权限矩阵(含 can_approve 审批权)+ 本机独有面板的保留行 ---- */\n")
          .append("DELETE FROM yj_role_panel;\nGO\n")
          .append("SET IDENTITY_INSERT yj_role_panel ON;\n");
        for (String[] p : panels)
            sb.append("INSERT INTO yj_role_panel (id, role_id, panel_code, can_approve, perms) VALUES (")
              .append(p[0]).append(", ").append(p[1]).append(", N'").append(esc(p[2])).append("', '")
              .append(yesNo(p[3])).append("', N'").append(esc(p[4])).append("');\n");
        sb.append("SET IDENTITY_INSERT yj_role_panel OFF;\nGO\n\n")
          .append("/* 本机独有面板:把 #keep 里的行补回来(角色必须存在,否则跳过) */\n")
          .append("INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)\n")
          .append("SELECT k.role_id, k.panel_code, k.can_approve, k.perms FROM #keep k\n")
          .append(" WHERE EXISTS (SELECT 1 FROM yj_role r WHERE r.id = k.role_id)\n")
          .append("   AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = k.role_id AND x.panel_code = k.panel_code);\nGO\n\n");
    }

    static void footer(StringBuilder sb) {
        sb.append("/* ---- ⑦ 自检 + 现状输出 ---- */\n")
          .append("DECLARE @bad int = 0;\n")
          .append("IF (SELECT COUNT(*) FROM yj_dept) < 20 SET @bad += 1;\n")
          .append("IF (SELECT COUNT(*) FROM yj_role) < 19 SET @bad += 1;\n")
          .append("IF (SELECT COUNT(*) FROM yj_user WHERE ISNULL(password_hash,N'') = N'') > 0 SET @bad += 1;\n")
          .append("IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = N'fengmin' AND enabled = '1') SET @bad += 1;\n")
          .append("IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = N'QC_INSP_REC' AND can_approve = 'Y') SET @bad += 1;\n")
          .append("IF @bad > 0 RAISERROR(N'组织结构配置自检未通过(%d 项)', 16, 1, @bad);\n\n")
          .append("SELECT N'部门' AS 项, COUNT(*) AS 值 FROM yj_dept\n")
          .append("UNION ALL SELECT N'角色', COUNT(*) FROM yj_role\n")
          .append("UNION ALL SELECT N'账号', COUNT(*) FROM yj_user\n")
          .append("UNION ALL SELECT N'启用账号', COUNT(*) FROM yj_user WHERE enabled = '1'\n")
          .append("UNION ALL SELECT N'面板权限行', COUNT(*) FROM yj_role_panel\n")
          .append("UNION ALL SELECT N'检验报告可审批的角色', COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_INSP_REC' AND can_approve = 'Y';\n\n")
          .append("SELECT N'冯敏' AS 账号, u.username, u.real_name, u.enabled, r.role_name\n")
          .append("  FROM yj_user u LEFT JOIN yj_role r ON r.id = u.role_id WHERE u.username IN (N'fengmin', N'fm');\n\n")
          .append("SELECT rp.panel_code, r.role_name, rp.can_approve\n")
          .append("  FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id\n")
          .append(" WHERE rp.panel_code = N'QC_INSP_REC' AND rp.can_approve = 'Y' ORDER BY r.id;\n")
          .append("PRINT N'✅ 组织结构已按服务器备份配置(部门/角色/账号/面板权限)'; \nGO\n");
    }

    /** Y/N 归一:库里是 char(1),备份里可能有尾空格 */
    static String yesNo(String v) {
        if (v == null) return "N";
        String t = v.trim().toUpperCase();
        return t.startsWith("Y") ? "Y" : "N";
    }

    /** enabled 归一:库里是 char(1) '1'/'0' */
    static String enable(String v) {
        if (v == null) return "1";
        String t = v.trim();
        return t.startsWith("0") || "false".equalsIgnoreCase(t) ? "0" : "1";
    }

    static String esc(String s) {
        return s == null ? "" : s.replace("'", "''");
    }

    static List<String[]> rows(Connection c, String sql) throws SQLException {
        List<String[]> out = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = rs.getMetaData().getColumnCount();
            while (rs.next()) {
                String[] r = new String[n];
                for (int i = 0; i < n; i++) r[i] = rs.getString(i + 1);
                out.add(r);
            }
        }
        return out;
    }
}
