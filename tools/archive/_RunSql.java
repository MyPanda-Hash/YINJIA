// _RunSql.java — 以 yinjia(JDBC, encrypt=false) 执行迁移脚本并输出诊断报告(替代损坏 Schannel 的 sqlcmd)
// 用法: java -cp ".m2-repo/com/microsoft/sqlserver/mssql-jdbc/12.8.1.jre11/mssql-jdbc-12.8.1.jre11.jar" tools/_RunSql.java <sql文件路径|-> 
// 报告写入 tools/_flow-v12/_runsql-out.txt (UTF-8)
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

public class _RunSql {
  static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
  static StringBuilder out = new StringBuilder();

  static void p(String s) { out.append(s).append("\n"); }

  static void q(Connection c, String title, String sql) {
    p("---- " + title);
    try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
      int n = 0;
      while (rs.next() && n++ < 60) {
        StringBuilder row = new StringBuilder();
        for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++)
          row.append(i > 1 ? " | " : "").append(rs.getString(i));
        p("  " + row);
      }
      if (n == 0) p("  (no rows)");
    } catch (Exception e) { p("  ERR: " + e.getMessage()); }
  }

  public static void main(String[] args) throws Exception {
    String file = args.length > 0 ? args[0] : "-";
    boolean admin = Arrays.asList(args).contains("--admin");
    boolean grantOnly = Arrays.asList(args).contains("--grant-only");
    String adminPw = null;
    for (int i = 0; i < args.length - 1; i++) if ("--adminpw".equals(args[i])) adminPw = args[i + 1];
    if (adminPw == null) adminPw = "Yin#Admin#2026xQ"; // 旧机器默认(DbInit),可被 --adminpw 覆盖
    Connection c;
    if (grantOnly) {
      // 单用户模式专用:本地管理员 NTLM 直连,给 yinjia 补 db_ddladmin 后退出(由 _grant-ddladmin.bat 编排服务重启)
      String[] domains = { System.getenv("COMPUTERNAME"), "DESKTOP-JHUNFT6" };
      Connection ac = null; String okDom = null; StringBuilder errs = new StringBuilder();
      for (String dom : domains) {
        try {
          ac = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;loginTimeout=6;integratedSecurity=true;authenticationScheme=NTLM;domain=" + dom, "Administrator", adminPw);
          okDom = dom; break;
        } catch (Exception e) {
          Throwable t = e; StringBuilder m = new StringBuilder();
          while (t != null) { m.append(t.getClass().getSimpleName()).append(": ").append(t.getMessage()).append(" <== "); t = t.getCause(); }
          errs.append("domain=").append(dom).append(": ").append(m).append("\n");
        }
      }
      if (ac == null) { Files.write(Paths.get("tools/_flow-v12/_grant-out.txt"), ("GRANT FAILED:\n" + errs).getBytes(StandardCharsets.UTF_8)); System.out.println("GRANT FAILED - see tools/_flow-v12/_grant-out.txt"); System.exit(2); }
      try (Statement st = ac.createStatement()) {
        st.execute("USE HSDZ_MES; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER yinjia FOR LOGIN yinjia");
        st.execute("USE HSDZ_MES; IF NOT EXISTS (SELECT 1 FROM sys.database_role_members m JOIN sys.database_principals r ON r.principal_id=m.role_principal_id JOIN sys.database_principals u ON u.principal_id=m.member_principal_id WHERE u.name='yinjia' AND r.name='db_ddladmin') ALTER ROLE db_ddladmin ADD MEMBER yinjia");
        StringBuilder roles = new StringBuilder();
        try (ResultSet rs = st.executeQuery("SELECT r.name FROM sys.database_role_members m JOIN sys.database_principals r ON r.principal_id=m.role_principal_id JOIN sys.database_principals u ON u.principal_id=m.member_principal_id WHERE u.name='yinjia'")) { while (rs.next()) roles.append(rs.getString(1)).append(" "); }
        String rep = "GRANT OK @" + okDom + " yinjia roles: " + roles;
        Files.write(Paths.get("tools/_flow-v12/_grant-out.txt"), rep.getBytes(StandardCharsets.UTF_8));
        System.out.println(rep);
      }
      ac.close();
      return;
    }
    if (admin) {
      // 纯 Java NTLM(凭据同 DbInit 先例);正常多用户模式先试,本地管理员若为 sysadmin 即可直接授权
      String[] domains = { System.getenv("COMPUTERNAME"), "DESKTOP-JHUNFT6" };
      Connection ac = null; String okDom = null;
      for (String dom : domains) {
        try {
          ac = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=6;integratedSecurity=true;authenticationScheme=NTLM;domain=" + dom, "Administrator", "Yin#Admin#2026xQ");
          okDom = dom; break;
        } catch (Exception e) { p("NTLM try domain=" + dom + " => " + e.getMessage().split("\n")[0]); }
      }
      if (ac == null) throw new RuntimeException("NTLM admin connect failed (both domains)");
      c = ac;
      p("connected (NTLM admin @" + okDom + "): " + c.getMetaData().getUserName());
      try (Statement st = c.createStatement()) {
        st.execute("USE HSDZ_MES; IF NOT EXISTS (SELECT 1 FROM sys.database_role_members m JOIN sys.database_principals r ON r.principal_id=m.role_principal_id JOIN sys.database_principals u ON u.principal_id=m.member_principal_id WHERE u.name='yinjia' AND r.name='db_ddladmin') ALTER ROLE db_ddladmin ADD MEMBER yinjia");
        p("granted db_ddladmin to yinjia");
      } catch (Exception e) { p("grant ERR: " + e.getMessage()); }
      c.close();
      c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026");
      p("reconnected as yinjia");
    } else {
      c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026");
      p("connected: " + c.getMetaData().getUserName());
    }
    try {

      // ── 诊断(含乱码首轮损害检查) ──
      q(c, "yinjia 角色", "SELECT r.name FROM sys.database_role_members m JOIN sys.database_principals r ON r.principal_id=m.role_principal_id JOIN sys.database_principals u ON u.principal_id=m.member_principal_id WHERE u.name='yinjia'");
      q(c, "SQL 启动时间", "SELECT CONVERT(varchar(19), sqlserver_start_time, 120) FROM sys.dm_os_sys_info");
      q(c, "bs_inv 全部列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('bs_inv') ORDER BY column_id");
      q(c, "通道表存在性", "SELECT name FROM sys.tables WHERE name IN ('erp_imp_log','erp_imp_row','yj_lot_seq')");
      q(c, "yj_field 新面板字段(含垃圾)", "SELECT panel_code, col_name, label, seq FROM yj_field WHERE panel_code IN ('INV','ERPLG','ERPLG_ROW') ORDER BY panel_code, seq");
      q(c, "dm_gx 新字典", "SELECT lb, dm, mc FROM dm_gx WHERE lb IN ('JYFS','IMPTYP') ORDER BY lb, dm");
      q(c, "bs_op 行", "SELECT 工序编码, 工序名称 FROM bs_op ORDER BY id");
      q(c, "bs_wc 行", "SELECT 工作中心编码, 工作中心名称 FROM bs_wc ORDER BY id");
      q(c, "bs_wh 行", "SELECT 仓库编码, 仓库名称 FROM bs_wh ORDER BY id");
      q(c, "垃圾乱码列检查(bs_inv)", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('bs_inv') AND name LIKE N'%鏄%' OR (object_id=OBJECT_ID('bs_inv') AND LEN(name)>0 AND CAST(name AS varbinary(200)) <> CAST(CAST(name AS nvarchar(200)) AS varbinary(200)))");

      // ── 执行脚本 ──
      if (!"-".equals(file)) {
        String sql = new String(Files.readAllBytes(Paths.get(file)), StandardCharsets.UTF_8);
        String[] parts = sql.split("(?im)^GO\\s*$");
        int batch = 0, ok = 0, fail = 0;
        for (String part : parts) {
          String t = part.trim();
          if (t.isEmpty()) continue;
          batch++;
          String head = t.replaceAll("\\s+", " ");
          head = head.substring(0, Math.min(90, head.length()));
          try (Statement st = c.createStatement()) { st.execute(t); ok++; p("[OK ] #" + batch + " " + head); }
          catch (Exception e) { fail++; p("[ERR] #" + batch + " " + head + " ==> " + e.getMessage()); }
        }
        p("batches: " + batch + " ok: " + ok + " fail: " + fail);
      }

      // ── 后验 ──
      q(c, "后验: 通道表", "SELECT name FROM sys.tables WHERE name IN ('erp_imp_log','erp_imp_row','yj_lot_seq')");
      q(c, "后验: bs_inv 新列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('bs_inv') AND name IN (N'是否检验',N'检验方式',N'数据来源',N'ERP更新时间')");
      q(c, "后验: 面板", "SELECT panel_code, panel_name, line_table FROM yj_panel WHERE panel_code IN ('ERPLG','ERPLG_ROW')");
    } catch (Exception e) {
      p("FATAL: " + e.getMessage());
    } finally {
      try { c.close(); } catch (Exception ignore) {}
    }
    Files.write(Paths.get("tools/_flow-v12/_runsql-out.txt"), out.toString().getBytes(StandardCharsets.UTF_8));
    System.out.println("report written: tools/_flow-v12/_runsql-out.txt");
  }
}
