import java.sql.*;

/** 只读诊断(锁实验):开一个事务锁住 plang 某一行,保持 N 秒后**回滚**(不改任何数据),
 *  用来验证「外部程序(小程序/参考库)开了事务不提交时,MES 前端查询会不会被永久挡住」。
 *  用法: java _LockHold <秒> [pl_no] [pl_xc] */
public class _LockHold {
    public static void main(String[] a) throws Exception {
        int secs = a.length > 0 ? Integer.parseInt(a[0]) : 30;
        String no = a.length > 1 ? a[1] : "GD-2026-10-0220";
        int xc = a.length > 2 ? Integer.parseInt(a[2]) : 1;
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            c.setAutoCommit(false);
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE dbo.plang SET bz = bz WHERE pl_no = ? AND pl_xc = ?")) {
                ps.setString(1, no);
                ps.setInt(2, xc);
                int n = ps.executeUpdate();
                System.out.println("LOCKED rows=" + n + " (" + no + "#" + xc + ") 保持 " + secs + "s ...");
            }
            long t0 = System.currentTimeMillis();
            while (System.currentTimeMillis() - t0 < secs * 1000L) {
                Thread.sleep(500);
                System.out.print(".");
            }
            c.rollback();
            System.out.println("\nROLLBACK 已释放锁");
        }
    }
}
