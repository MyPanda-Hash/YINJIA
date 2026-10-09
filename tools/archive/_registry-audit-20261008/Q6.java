import java.sql.*;

/** Q6.java — 核查 B4-24-2 的 大区/存储分区 是否被刚才的弹窗误写,并给出回退所需的事实(只读) */
public class Q6 {
  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    String[] codes = a.length > 1 ? java.util.Arrays.copyOfRange(a, 1, a.length) : new String[]{"B4-24-2"};
    try (Connection c = DriverManager.getConnection(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
      System.out.println("### " + db);
      for (String code : codes) {
        try (PreparedStatement p = c.prepareStatement(
            "SELECT id, 仓位编码, 仓库, 大区, 存储分区, 区码, 排号, 位号, 仓位地址, asp_user1, asp_time1, asp_user2, asp_time2 "
          + "FROM bs_wh_loc WHERE 仓位编码 = ?")) {
          p.setString(1, code);
          try (ResultSet r = p.executeQuery()) {
            if (!r.next()) { System.out.println("  " + code + " —— 未找到"); continue; }
            System.out.printf("  id=%s %s 仓库=%s | 大区=[%s] 存储分区=[%s] | 区码=%s 排=%s 位=%s | 地址=%s%n",
                r.getString("id"), r.getString("仓位编码"), r.getString("仓库"),
                r.getString("大区"), r.getString("存储分区"), r.getString("区码"), r.getString("排号"),
                r.getString("位号"), r.getString("仓位地址"));
            System.out.printf("      asp_user1=%s asp_time1=%s asp_user2=%s asp_time2=%s%n",
                r.getString("asp_user1"), r.getString("asp_time1"), r.getString("asp_user2"), r.getString("asp_time2"));
          }
        }
      }
      // B4-24 整排三条一起看,判"是否只有我点的那条被改" 
      System.out.println("  -- B4-24 同排三条 --");
      try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
          "SELECT 仓位编码, 大区, 存储分区, asp_user1, asp_time1 FROM bs_wh_loc WHERE 仓位编码 LIKE N'B4-24-%' ORDER BY 仓位编码")) {
        while (r.next()) System.out.printf("     %-10s 大区=[%s] 分区=[%s] asp_user1=%s time1=%s%n",
            r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5));
      }
      // 全表:大区=原料区 的行数与应有值对比(migration 记录 D仓 原料区 504 / A仓 原料区 156)
      System.out.println("  -- 大区分布(全表) --");
      try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
          "SELECT 仓库, 大区, 存储分区, COUNT(*) n FROM bs_wh_loc WHERE ISNULL(asp_cancel,'')<>'Y' "
        + "GROUP BY 仓库, 大区, 存储分区 ORDER BY 仓库, 大区, 存储分区")) {
        while (r.next()) System.out.printf("     %-8s | %-14s | %-12s = %d%n",
            r.getString(1), r.getString(2) == null ? "(null)" : r.getString(2), r.getString(3) == null ? "(null)" : r.getString(3), r.getInt(4));
      }
    }
  }
}
