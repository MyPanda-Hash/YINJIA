import java.sql.*;

/**
 * 任务 1b 最终证据探针(只读,不依赖已删的备份表)。
 * 核对:① 过滤索引 ② RKD/CKD 元数据清零 ③ 备份表已不存在 ④ 表级中文注明
 *      ⑤ 过滤索引语义(可容多行期初 / 仍拦重复) ⑥ 首页库存卡片四段 SQL 可跑
 * 用法(tools 目录):java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar archive/_chk-stock-flow-final.java
 *   YINJIA_SQL_DB=HSDZ_MES_TEST 切账套;口令取 YINJIA_SQL_PASS
 */
public class StockFlowFinal {
    static String url() {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        return "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    }

    static void q(Connection c, String title, String sql) {
        System.out.println("-- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next() && n++ < 20) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++)
                    row.append(i > 1 ? " | " : "").append(rs.getString(i));
                System.out.println("   " + row);
            }
            if (n == 0) System.out.println("   (no rows)");
        } catch (Exception e) { System.out.println("   ERR: " + e.getMessage()); }
    }

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(url(), "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            System.out.println("======== 账套 " + c.getCatalog() + " ========");
            q(c, "① UX_*_src_rid 过滤索引(has_filter 应为 1)",
                    "SELECT name, has_filter, is_unique, ISNULL(filter_definition,'(无)') AS 过滤条件"
                            + " FROM sys.indexes WHERE name IN ('UX_inh_src_rid','UX_outh_src_rid') ORDER BY name");
            q(c, "② RKD/CKD 元数据与单据状态残留(应全 0)",
                    "SELECT 'yj_panel' AS t, COUNT(*) AS n FROM yj_panel WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_field', COUNT(*) FROM yj_field WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_role_panel', COUNT(*) FROM yj_role_panel WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_translation(入库单/出库单)', COUNT(*) FROM yj_translation"
                            + "     WHERE scope='panel' AND ref_key IN (N'入库单',N'出库单')");
            q(c, "③ 库内备份表(应为 0 张;老数据在 tools/archive/_stock-flow-backup-20260930.csv)",
                    "SELECT COUNT(*) AS 备份表数 FROM sys.tables WHERE name IN ('inh_bak_20260930','outh_bak_20260930')");
            q(c, "④ inh/outh 表级中文注明",
                    "SELECT OBJECT_NAME(major_id) AS 表名, CAST(value AS nvarchar(120)) AS 注明"
                            + " FROM sys.extended_properties WHERE minor_id = 0 AND name = 'MS_Description'"
                            + "   AND major_id IN (OBJECT_ID('dbo.inh'), OBJECT_ID('dbo.outh'))");
            q(c, "⑥ 首页库存卡片四段 SQL(列名中文化后应 0 错)",
                    "SELECT (SELECT COUNT(DISTINCT 单据编号) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 入库单数,"
                            + " (SELECT COUNT(DISTINCT 单据编号) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 出库单数,"
                            + " (SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 入库行数,"
                            + " (SELECT COUNT(*) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 出库行数");
            q(c, "   近 7 天趋势 SQL",
                    "SELECT CONVERT(varchar(10), 单据日期, 23) AS 日期, COUNT(*) AS 行数 FROM inh"
                            + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                            + " GROUP BY CONVERT(varchar(10), 单据日期, 23)");
            q(c, "   当前流水行数", "SELECT (SELECT COUNT(*) FROM inh) AS inh, (SELECT COUNT(*) FROM outh) AS outh");

            System.out.println("-- ⑤ 过滤索引语义实测(事务内,结束回滚)");
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (0, NULL, N'__ev_a', 1)");
                st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (0, NULL, N'__ev_b', 1)");
                ResultSet r = st.executeQuery("SELECT COUNT(*) FROM inh WHERE src = 0 AND rid IS NULL");
                r.next();
                System.out.println("   多行期初 (src=0, rid=NULL) 可插入 ⇒ 计数 " + r.getInt(1)
                        + "(任务 2 灌多行期初的硬前提)");
                st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (1, 990001, N'__ev_c', 1)");
                String dup = "未拦截(异常!)";
                try { st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (1, 990001, N'__ev_d', 1)"); }
                catch (SQLException e) { dup = "已拦截,错误号 " + e.getErrorCode(); }
                System.out.println("   重复 (src, rid) ⇒ " + dup);
            } finally {
                c.rollback();
                c.setAutoCommit(true);
                System.out.println("   已回滚,未留任何行");
            }
        }
    }
}
