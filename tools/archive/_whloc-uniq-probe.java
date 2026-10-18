import java.sql.*;
public class _whloc_uniq_probe {
  public static void main(String[] args) throws Exception {
    String db = args.length > 0 ? args[0] : "HSDZ_MES";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    String user = "yinjia";
    String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    try (Connection c = DriverManager.getConnection(url, user, pass)) {
      System.out.println("DB=" + db);
      try (Statement st = c.createStatement()) {
        System.out.println("== columns ==");
        ResultSet rs = st.executeQuery("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_wh_loc' AND COLUMN_NAME IN (N'仓库编码',N'仓位编码',N'仓位地址',N'asp_cancel') ORDER BY ORDINAL_POSITION");
        while (rs.next()) System.out.println(rs.getString(1)+" | "+rs.getString(2)+"("+rs.getString(3)+") | nullable="+rs.getString(4));
        rs.close();
        System.out.println("== counts ==");
        rs = st.executeQuery("SELECT COUNT(*) total, COUNT(DISTINCT 仓位编码) distinct_code, COUNT(DISTINCT 仓库编码+'|'+仓位编码) distinct_wh_code FROM bs_wh_loc");
        while (rs.next()) System.out.println("total="+rs.getInt(1)+" distinct_code="+rs.getInt(2)+" distinct_wh_code="+rs.getInt(3));
        rs.close();
        System.out.println("== duplicates warehouse+code (all rows) ==");
        rs = st.executeQuery("SELECT 仓库编码, 仓位编码, COUNT(*) n FROM bs_wh_loc GROUP BY 仓库编码, 仓位编码 HAVING COUNT(*)>1 ORDER BY n DESC");
        int n=0; while (rs.next()) { n++; System.out.println(rs.getString(1)+" | "+rs.getString(2)+" | n="+rs.getInt(3)); }
        if (n==0) System.out.println("(none)");
        rs.close();
        System.out.println("== duplicates warehouse+code (active only) ==");
        rs = st.executeQuery("SELECT 仓库编码, 仓位编码, COUNT(*) n FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 仓库编码, 仓位编码 HAVING COUNT(*)>1 ORDER BY n DESC");
        n=0; while (rs.next()) { n++; System.out.println(rs.getString(1)+" | "+rs.getString(2)+" | n="+rs.getInt(3)); }
        if (n==0) System.out.println("(none)");
        rs.close();
        System.out.println("== empty code rows ==");
        rs = st.executeQuery("SELECT COUNT(*) FROM bs_wh_loc WHERE 仓位编码 IS NULL OR LTRIM(RTRIM(仓位编码))=''");
        while (rs.next()) System.out.println("empty="+rs.getInt(1));
        rs.close();
        System.out.println("== indexes ==");
        rs = st.executeQuery("SELECT i.name, i.is_unique, i.has_filter, i.filter_definition, COL_NAME(ic.object_id, ic.column_id) col, ic.key_ordinal FROM sys.indexes i LEFT JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE i.object_id=OBJECT_ID('dbo.bs_wh_loc') ORDER BY i.name, ic.key_ordinal");
        while (rs.next()) System.out.println(rs.getString(1)+" | unique="+rs.getBoolean(2)+" | filter="+rs.getBoolean(3)+" | "+rs.getString(4)+" | col="+rs.getString(5)+" | key="+rs.getInt(6));
        rs.close();
        System.out.println("== panel config ==");
        rs = st.executeQuery("SELECT panel_code, CONVERT(nvarchar(4000), config) FROM yj_panel WHERE panel_code='WHLOC'");
        while (rs.next()) System.out.println(rs.getString(1)+" | "+rs.getString(2));
        rs.close();
      }
    }
  }
}