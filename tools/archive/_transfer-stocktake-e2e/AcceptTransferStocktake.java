import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 调拨单 / 盘点单 **全流程验收**(2026-10-18 第三批):
 * 模拟真实操作里会出现的正常路径与各类真实情况(脏数据、误操作、跨仓、停用、越量、重复提交…)。
 *
 * <h3>数据来源:全部取系统真实档案</h3>
 * 物料/仓库/批号取自 `kucun` 里**真有货**的行;仓位取 `bs_wh_loc` 里**真实存在**的仓位编码;
 * 不造任何 TEST-XXX 假数据(造出来的单据跑完即作废清除)。
 *
 * <h3>用法(tools 目录下)</h3>
 * <pre>
 *   java -cp lib/mssql-jdbc.jar archive/_transfer-stocktake-e2e/AcceptTransferStocktake.java [factory] [db] [apiBase]
 *   默认 YJ / HSDZ_MES / http://127.0.0.1:8090
 *   测试账套:   ... AcceptTransferStocktake.java YJ_TEST HSDZ_MES_TEST
 * </pre>
 */
public class AcceptTransferStocktake {

    static String factory = "YJ", dbName = "HSDZ_MES", base = "http://127.0.0.1:8090/api";
    static final HttpClient HTTP = HttpClient.newHttpClient();
    static String token;
    static Connection db;
    static int pass = 0, fail = 0;
    static final List<String> created = new ArrayList<>();
    static final StringBuilder failures = new StringBuilder();

    // 真实数据(启动时从库里挑)
    static String srcWh, srcWhName, dstWh, dstWhName, binA1, binA2, binC1;
    static List<Map<String, Object>> picks = new ArrayList<>();

    public static void main(String[] a) throws Exception {
        if (a.length > 0) factory = a[0];
        if (a.length > 1) dbName = a[1];
        if (a.length > 2) base = a[2].replaceAll("/+$", "") + "/api";
        String dbPass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        db = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + dbName + ";encrypt=false", "yinjia", dbPass);
        System.out.println("=== 调拨单 / 盘点单 全流程验收 @" + factory + " / " + dbName + " ===");
        login();
        if (!prepare()) { System.out.println("素材准备失败,终止"); System.exit(2); }
        try {
            transferCases();
            stocktakeCases();
        } finally {
            cleanup();
        }
        System.out.println();
        System.out.println("=== 汇总:PASS " + pass + " / FAIL " + fail + " ===");
        if (fail > 0) System.out.println("失败项:\n" + failures);
        System.out.println(fail == 0 ? "RESULT: PASS" : "RESULT: FAIL-" + fail);
        System.exit(fail == 0 ? 0 : 1);
    }

    // ══════════════════════ 素材(真实档案) ══════════════════════
    static boolean prepare() throws Exception {
        // 调出仓:真有货、且**没有仓位档案**(仓位可空) —— 系统里多数仓是这种
        Map<String, Object> wh = one(
                "SELECT TOP 1 w.[仓库编码] AS c, w.[仓库名称] AS n FROM bs_wh w"
                        + " WHERE ISNULL(w.[状态],N'启用')=N'启用' AND ISNULL(w.[asp_cancel],'N')<>'Y'"
                        + "   AND ISNULL(w.[启用仓位管理],0)=0"
                        + "   AND NOT EXISTS (SELECT 1 FROM bs_wh_loc l WHERE l.[仓库]=w.[仓库名称] AND ISNULL(l.[asp_cancel],'N')<>'Y')"
                        + "   AND EXISTS (SELECT 1 FROM kucun k WHERE k.ckdm=w.[仓库编码] AND ISNULL(k.yl,0)>=100 AND k.lot_no IS NOT NULL AND k.lot_no<>'')"
                        + " ORDER BY (SELECT SUM(k2.yl) FROM kucun k2 WHERE k2.ckdm=w.[仓库编码]) DESC");
        if (wh == null) return false;
        srcWh = str(wh.get("c")); srcWhName = str(wh.get("n"));

        // 调入仓:有**真实仓位档案**的仓(A仓,CK-A)
        Map<String, Object> d = one(
                "SELECT TOP 1 w.[仓库编码] AS c, w.[仓库名称] AS n FROM bs_wh w"
                        + " WHERE ISNULL(w.[状态],N'启用')=N'启用' AND w.[仓库编码] <> ?"
                        + "   AND EXISTS (SELECT 1 FROM bs_wh_loc l WHERE l.[仓库]=w.[仓库名称] AND ISNULL(l.[停用],0)=0 AND ISNULL(l.[asp_cancel],'N')<>'Y')"
                        + " ORDER BY (SELECT COUNT(*) FROM bs_wh_loc l WHERE l.[仓库]=w.[仓库名称]) DESC", srcWh);
        if (d == null) return false;
        dstWh = str(d.get("c")); dstWhName = str(d.get("n"));

        List<Map<String, Object>> bins = list(
                "SELECT TOP 3 [仓位编码] AS b FROM bs_wh_loc WHERE [仓库]=? AND ISNULL([停用],0)=0 AND ISNULL([asp_cancel],'N')<>'Y' ORDER BY [仓位编码]",
                dstWhName);
        if (bins.size() < 2) return false;
        binA1 = str(bins.get(0).get("b"));
        binA2 = str(bins.get(1).get("b"));

        // 另一个仓的真实仓位(用于"跨仓仓位"负向用例)
        Map<String, Object> other = one(
                "SELECT TOP 1 l.[仓位编码] AS b, l.[仓库] AS w FROM bs_wh_loc l"
                        + " WHERE l.[仓库] <> ? AND ISNULL(l.[停用],0)=0 AND ISNULL(l.[asp_cancel],'N')<>'Y' ORDER BY l.[仓位编码]", dstWhName);
        if (other == null) return false;
        binC1 = str(other.get("b"));
        String otherWhName = str(other.get("w"));

        // 两条**真有货**的明细(同仓、不同物料或不同批号)
        picks = list(
                "SELECT TOP 2 k.wzdm, k.ckdm, k.lot_no, k.yl, k.price, i.[存货名称], i.[规格型号], i.[计量单位]"
                        + " FROM kucun k OUTER APPLY (SELECT TOP 1 x.[存货名称],x.[规格型号],x.[计量单位] FROM bs_inv x WHERE x.[存货编码]=k.wzdm ORDER BY x.id) i"
                        + " WHERE k.ckdm=? AND ISNULL(k.yl,0)>=100 AND k.lot_no IS NOT NULL AND k.lot_no<>''"
                        + "   AND ISNULL(k.asp_cancel,'N')<>'Y' ORDER BY k.yl DESC", srcWh);
        if (picks.size() < 2) return false;

        System.out.printf("素材(真实档案):调出仓 %s(%s) → 调入仓 %s(%s);真实仓位 %s / %s;跨仓对照 %s(%s)%n",
                srcWh, srcWhName, dstWh, dstWhName, binA1, binA2, binC1, otherWhName);
        for (Map<String, Object> p : picks) {
            System.out.printf("   物料 %s / 批号 %s / 现存 %.1f / %s%n",
                    str(p.get("wzdm")), str(p.get("lot_no")), dbl(p.get("yl")), str(p.get("存货名称")));
        }
        return true;
    }

    // ══════════════════════ 调拨单 ══════════════════════
    static void transferCases() throws Exception {
        System.out.println("\n───── 调拨单 TRANSFER ─────");
        Map<String, Object> l1 = pick(0), l2 = pick(1);
        double before1 = bal(l1), before2 = bal(l2);
        double dstBefore = balOf(str(l1.get("wzdm")), dstWh, str(l1.get("lot_no")));

        // ① 建草稿(不审核)
        String no = save("TRANSFER", head("调拨"), List.of(tline(l1, 20, binA1)));
        created.add(no);
        check("① 保存草稿生成单号 " + no, no != null && no.startsWith("DB-"));
        check("① 草稿状态=草稿", "草稿".equals(status("TRANSFER", no)), status("TRANSFER", no));
        check("① 草稿明细 1 行", lines("bl_transfer", no) == 1, "实际 " + lines("bl_transfer", no));

        // ② 草稿可继续编辑:加成 2 行(真实物料各一)
        save("TRANSFER", head("调拨"), List.of(tline(l1, 20, binA1), tline(l2, 30, binA2)), no);
        check("② 草稿可改明细 → 2 行", lines("bl_transfer", no) == 2, "实际 " + lines("bl_transfer", no));

        // ③ 审核
        try { audit("TRANSFER", no); check("③ 审核成功", true); }
        catch (RuntimeException e) { check("③ 审核成功", false, e.getMessage()); return; }
        check("③ 状态=已审核", "已审核".equals(status("TRANSFER", no)), status("TRANSFER", no));
        double a1 = bal(l1), a2 = bal(l2);
        double d1 = balOf(str(l1.get("wzdm")), dstWh, str(l1.get("lot_no")));
        check(String.format("④ 物料1 调出仓 %.1f→%.1f(-20)", before1, a1), near(a1, before1 - 20));
        check(String.format("④ 物料2 调出仓 %.1f→%.1f(-30)", before2, a2), near(a2, before2 - 30));
        check(String.format("④ 物料1 调入仓 %.1f→%.1f(+20)", dstBefore, d1), near(d1, dstBefore + 20));
        check("④ 两腿流水齐备(outh src=10 ×2 / inh src=9 ×2)",
                cnt("outh", no, 10) == 2 && cnt("inh", no, 9) == 2,
                "outh=" + cnt("outh", no, 10) + " inh=" + cnt("inh", no, 9));

        // ⑤ 审核后不可改
        expectReject("⑤ 已审核单据不可保存", () -> save("TRANSFER", head("调拨"),
                List.of(tline(l1, 99, binA1)), no));
        // ⑥ 不可重复审核
        expectReject("⑥ 已审核单据不可重复审核", () -> audit("TRANSFER", no));
        // ⑦ 不可删除已审核单
        expectReject("⑦ 已审核单据不可删除", () -> call("TRANSFER", "删除单据", map("编号", no)));

        // ⑧ 弃审 → 回滚
        try { call("TRANSFER", "弃审", map("编号", no)); check("⑧ 弃审成功", true); }
        catch (RuntimeException e) { check("⑧ 弃审成功", false, e.getMessage()); }
        check(String.format("⑧ 弃审后物料1回到 %.1f", bal(l1)), near(bal(l1), before1));
        check(String.format("⑧ 弃审后物料2回到 %.1f", bal(l2)), near(bal(l2), before2));
        check("⑧ 弃审后调入仓回到原值", near(balOf(str(l1.get("wzdm")), dstWh, str(l1.get("lot_no"))), dstBefore));

        // ⑨ 改数量后重审 → 按新值
        save("TRANSFER", head("调拨"), List.of(tline(l1, 15, binA1), tline(l2, 30, binA2)), no);
        audit("TRANSFER", no);
        check(String.format("⑨ 改数量 20→15 后重审:调出仓 %.1f(应 %.1f)", bal(l1), before1 - 15),
                near(bal(l1), before1 - 15));
        call("TRANSFER", "弃审", map("编号", no));
        check("⑨ 再弃审回滚", near(bal(l1), before1) && near(bal(l2), before2));

        // ⑩ 明细表 / 统计表 能查到(单据仍在,只是未审核)
        check("⑩ 明细表可查(HTTP 200)", queryOk("TRANSFER_DETAIL"));
        check("⑩ 统计表可查(HTTP 200)", queryOk("TRANSFER_STATS"));

        // ⑪ 删除草稿
        try { call("TRANSFER", "删除单据", map("编号", no)); check("⑪ 草稿可删除", true); }
        catch (RuntimeException e) { check("⑪ 草稿可删除", false, e.getMessage()); }

        // ── 负向:真实误操作 ──
        negTransfer("⑫ 同仓调拨", l1, 10, binA1, srcWhName, srcWh, srcWhName, srcWh, "调出仓库 = 调入仓库");
        negTransfer("⑬ 数量为空", l1, 0, "", dstWhName, dstWh, dstWhName, dstWh, "数量");
        negTransfer("⑭ 数量超过现存量", l1, before1 + 1000, binA1, srcWhName, srcWh, dstWhName, dstWh, "现存量");
        negTransfer("⑮ 调入仓不存在", l1, 10, binA1, srcWhName, srcWh, "不存在的仓", "NOT-EXIST", "仓库档案不存在");
        negTransfer("⑯ 调入仓位不存在", l1, 10, "NO-SUCH-BIN", srcWhName, srcWh, dstWhName, dstWh, "不属于仓库");
        negTransfer("⑰ 调入仓位用了别的仓的仓位", l1, 10, binC1, srcWhName, srcWh, dstWhName, dstWh, "不属于仓库");
        negTransfer("⑱ 目标仓有仓位档案但仓位没填", l1, 10, "", srcWhName, srcWh, dstWhName, dstWh, "不能为空");
        negTransfer("⑲ 调出仓位填成目标仓的仓位", l1, 10, binA1, srcWhName, srcWh, dstWhName, dstWh, "不属于仓库", true);

        // ⑳ 停用仓位(临时把一条真实仓位停用,验完还原)
        Map<String, Object> binRow = one("SELECT TOP 1 [仓位编码] AS b, [仓库] AS w FROM bs_wh_loc WHERE [仓库]=? AND ISNULL([停用],0)=0 ORDER BY [仓位编码]", dstWhName);
        if (binRow != null) {
            String stoppedBin = str(binRow.get("b"));
            try (PreparedStatement ps = db.prepareStatement("UPDATE bs_wh_loc SET [停用]=1 WHERE [仓库]=? AND [仓位编码]=?")) {
                ps.setString(1, dstWhName); ps.setString(2, stoppedBin); ps.executeUpdate();
            }
            try {
                negTransfer("⑳ 仓位已停用", l1, 10, stoppedBin, srcWhName, srcWh, dstWhName, dstWh, "已停用");
            } finally {
                try (PreparedStatement ps = db.prepareStatement("UPDATE bs_wh_loc SET [停用]=0 WHERE [仓库]=? AND [仓位编码]=?")) {
                    ps.setString(1, dstWhName); ps.setString(2, stoppedBin); ps.executeUpdate();
                }
            }
        }
    }

    /** 负向:建一张单 → 审核必须失败且话术命中 */
    static void negTransfer(String label, Map<String, Object> pickRow, double qty, String inBin,
                            String outWhName, String outWhCode, String inWhName, String inWhCode,
                            String expectWord) throws Exception {
        negTransfer(label, pickRow, qty, inBin, outWhName, outWhCode, inWhName, inWhCode, expectWord, false);
    }

    static void negTransfer(String label, Map<String, Object> pickRow, double qty, String inBin,
                            String outWhName, String outWhCode, String inWhName, String inWhCode,
                            String expectWord, boolean badOutBin) throws Exception {
        Map<String, Object> line = tline(pickRow, qty, inBin);
        line.put("调出仓库", outWhName);
        line.put("调出仓库编码", outWhCode);
        line.put("调入仓库", inWhName);
        line.put("调入仓库编码", inWhCode);
        if (badOutBin) line.put("调出仓位", binA1);
        String no = null;
        try {
            no = save("TRANSFER", head("调拨"), List.of(line));
        } catch (RuntimeException e) {
            check(label + "(保存阶段即被拒)", hit(e.getMessage(), expectWord), e.getMessage());
            return;
        }
        created.add(no);
        String msg = "";
        try { audit("TRANSFER", no); } catch (RuntimeException e) { msg = e.getMessage(); }
        check(label, !msg.isEmpty() && hit(msg, expectWord), msg.isEmpty() ? "竟然审核通过(应拒绝)" : msg);
    }

    // ══════════════════════ 盘点单 ══════════════════════
    static void stocktakeCases() throws Exception {
        System.out.println("\n───── 盘点单 STOCKTAKE ─────");
        Map<String, Object> p = pick(0);
        String item = str(p.get("wzdm")), lot = str(p.get("lot_no"));
        double before = bal(p);

        // ① 盘盈 +7
        double actual = before + 7;
        String no = save("STOCKTAKE", head("盘点"), List.of(sline(p, actual, "")));
        created.add(no);
        check("① 保存草稿 " + no, no != null && no.startsWith("PD-"));
        audit("STOCKTAKE", no);
        check(String.format("① 盘盈:%.1f → %.1f(应 == 实盘 %.1f)", before, bal(p), actual), near(bal(p), actual));
        Map<String, Object> ln = one("SELECT [账面数量],[差异数量] FROM bl_stocktake WHERE [单据编号]=?", no);
        check("① 明细回写 账面=" + ln.get("账面数量") + " 差异=" + ln.get("差异数量"),
                near(dbl(ln.get("账面数量")), before) && near(dbl(ln.get("差异数量")), 7));
        check("① 盘盈流水 inh src=11 ×1", cnt("inh", no, 11) == 1, "实际 " + cnt("inh", no, 11));

        // ② 弃审 → 回滚 + 清空
        call("STOCKTAKE", "弃审", map("编号", no));
        check(String.format("② 弃审后回到 %.1f", bal(p)), near(bal(p), before));
        Map<String, Object> ln2 = one("SELECT [账面数量],[差异数量] FROM bl_stocktake WHERE [单据编号]=?", no);
        check("② 弃审清空账面/差异", ln2.get("账面数量") == null && ln2.get("差异数量") == null);
        call("STOCKTAKE", "删除单据", map("编号", no));

        // ③ 盘亏 −3
        String no2 = save("STOCKTAKE", head("盘点"), List.of(sline(p, before - 3, "")));
        created.add(no2);
        audit("STOCKTAKE", no2);
        check(String.format("③ 盘亏:%.1f → %.1f(应 == 实盘 %.1f)", before, bal(p), before - 3), near(bal(p), before - 3));
        check("③ 盘亏流水 outh src=12 ×1", cnt("outh", no2, 12) == 1, "实际 " + cnt("outh", no2, 12));
        call("STOCKTAKE", "弃审", map("编号", no2));
        check("③ 弃审回滚", near(bal(p), before));
        call("STOCKTAKE", "删除单据", map("编号", no2));

        // ④ 账实相符 → 不产生流水
        String no3 = save("STOCKTAKE", head("盘点"), List.of(sline(p, before, "")));
        created.add(no3);
        audit("STOCKTAKE", no3);
        check("④ 账实相符:库存不变", near(bal(p), before));
        check("④ 账实相符:不产生流水", cnt("inh", no3, 11) == 0 && cnt("outh", no3, 12) == 0);
        call("STOCKTAKE", "弃审", map("编号", no3));

        // ⑤ 重复审核 / 删除已审核
        call("STOCKTAKE", "审核", map("编号", no3));
        expectReject("⑤ 已审核不可重复审核", () -> audit("STOCKTAKE", no3));
        expectReject("⑥ 已审核不可删除", () -> call("STOCKTAKE", "删除单据", map("编号", no3)));
        call("STOCKTAKE", "弃审", map("编号", no3));
        call("STOCKTAKE", "删除单据", map("编号", no3));

        // ⑦ 同一单两行同物料(差异按顺序累计)
        String no4 = save("STOCKTAKE", head("盘点"),
                List.of(sline(p, before + 10, ""), sline(p, before + 10, "")));
        created.add(no4);
        audit("STOCKTAKE", no4);
        // 第1行:账面 before → 实盘 before+10(盘盈10);第2行再读到 before+10,实盘 before+10 ⇒ 差异 0
        check(String.format("⑦ 同单两行同物料:最终 %.1f(应 %.1f)", bal(p), before + 10), near(bal(p), before + 10));
        call("STOCKTAKE", "弃审", map("编号", no4));
        check("⑦ 弃审回滚", near(bal(p), before));
        call("STOCKTAKE", "删除单据", map("编号", no4));

        // ── 负向 ──
        // ⑧ 实盘为空
        String no5 = save("STOCKTAKE", head("盘点"), List.of(sline(p, null, "")));
        created.add(no5);
        String msg = "";
        try { audit("STOCKTAKE", no5); } catch (RuntimeException e) { msg = e.getMessage(); }
        check("⑧ 实盘为空拒绝审核", msg.contains("实盘"), msg);
        call("STOCKTAKE", "删除单据", map("编号", no5));

        // ⑨ 有仓位档案的仓 → 仓位必填
        Map<String, Object> pickDst = one("SELECT TOP 1 wzdm, ckdm, lot_no, yl FROM kucun WHERE ckdm=? AND ISNULL(yl,0)>=0", dstWh);
        if (pickDst != null) {
            Map<String, Object> sp = new LinkedHashMap<>(p);
            sp.put("ckdm", dstWh);
            sp.put("lot_no", str(pickDst.get("lot_no")));
            sp.put("wzdm", str(pickDst.get("wzdm")));
            double dbal = balOf(str(sp.get("wzdm")), dstWh, str(sp.get("lot_no")));
            String no6 = save("STOCKTAKE", head("盘点"), List.of(slineAt(sp, dbal, "", dstWh, dstWhName, "")));
            created.add(no6);
            String m6 = "";
            try { audit("STOCKTAKE", no6); } catch (RuntimeException e) { m6 = e.getMessage(); }
            check("⑨ 有仓位档案的仓:仓位必填", m6.contains("不能为空"), m6);
            // ⑩ 仓位跨仓
            try { save("STOCKTAKE", head("盘点"), List.of(slineAt(sp, dbal, "", dstWh, dstWhName, binC1)), no6); } catch (RuntimeException ignore) { }
            String m7 = "";
            try { audit("STOCKTAKE", no6); } catch (RuntimeException e) { m7 = e.getMessage(); }
            check("⑩ 仓位跨仓拒绝", m7.contains("不属于仓库"), m7);
            // ⑪ 补正确仓位后可审核
            try { save("STOCKTAKE", head("盘点"), List.of(slineAt(sp, dbal + 2, "", dstWh, dstWhName, binA1)), no6); } catch (RuntimeException e) { check("⑪ 补仓位后保存", false, e.getMessage()); }
            String m8 = "";
            try { audit("STOCKTAKE", no6); } catch (RuntimeException e) { m8 = e.getMessage(); }
            check("⑪ 补正确仓位后可审核(盘盈 2)", m8.isEmpty() && near(balOf(str(sp.get("wzdm")), dstWh, str(sp.get("lot_no"))), dbal + 2), m8);
            call("STOCKTAKE", "弃审", map("编号", no6));
            call("STOCKTAKE", "删除单据", map("编号", no6));
        }
    }

    // ══════════════════════ 基建 ══════════════════════
    static Map<String, Object> head(String biz) {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("单据日期", java.time.LocalDate.now().toString());
        h.put("业务类型", biz);
        return h;
    }

    static Map<String, Object> tline(Map<String, Object> p, double qty, String inBin) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("序号", 1);
        l.put("存货编码", str(p.get("wzdm")));
        l.put("存货名称", str(p.get("存货名称")));
        l.put("规格型号", str(p.get("规格型号")));
        l.put("计量单位", str(p.get("计量单位")));
        l.put("批号", str(p.get("lot_no")));
        l.put("调出仓库", str(p.get("whName")));
        l.put("调出仓库编码", str(p.get("ckdm")));
        l.put("调入仓库", dstWhName);
        l.put("调入仓库编码", dstWh);
        l.put("调入仓位", inBin);
        l.put("数量", qty);
        l.put("单价", p.get("price"));
        l.put("金额", 0);
        return l;
    }

    static Map<String, Object> sline(Map<String, Object> p, Double actual, String bin) {
        return slineAt(p, actual, bin, str(p.get("ckdm")), str(p.get("whName")), bin);
    }

    static Map<String, Object> slineAt(Map<String, Object> p, Double actual, String ignored,
                                       String whCode, String whName, String bin) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("序号", 1);
        l.put("存货编码", str(p.get("wzdm")));
        l.put("存货名称", str(p.get("存货名称")));
        l.put("规格型号", str(p.get("规格型号")));
        l.put("计量单位", str(p.get("计量单位")));
        l.put("批号", str(p.get("lot_no")));
        l.put("仓库", whName);
        l.put("仓库编码", whCode);
        if (bin != null && !bin.isEmpty()) l.put("仓位", bin);
        if (actual != null) l.put("实盘数量", actual);
        return l;
    }

    static Map<String, Object> pick(int i) {
        Map<String, Object> p = new LinkedHashMap<>(picks.get(i));
        p.put("whName", srcWhName);
        p.put("ckdm", srcWh);
        return p;
    }

    static String save(String panel, Map<String, Object> head, List<Map<String, Object>> items) throws Exception {
        return save(panel, head, items, null);
    }

    static String save(String panel, Map<String, Object> head, List<Map<String, Object>> items, String no) throws Exception {
        Map<String, Object> fd = new LinkedHashMap<>(head);
        if (no != null) fd.put("编号", no);
        fd.put("detail", Map.of("items", items));
        raw("/px/callButton", map("panelCode", panel, "buttonName", "保存", "formData", fd, "buttonParam", Map.of()));
        if (no != null) return no;
        String table = "TRANSFER".equals(panel) ? "bd_transfer" : "bd_stocktake";
        return str(one("SELECT TOP 1 [单据编号] AS no FROM " + table + " ORDER BY id DESC").get("no"));
    }

    static void audit(String panel, String no) throws Exception {
        call(panel, "审核", map("编号", no));
    }

    static void call(String panel, String button, Map<String, Object> formData) throws Exception {
        raw("/px/callButton", map("panelCode", panel, "buttonName", button, "formData", formData, "buttonParam", Map.of()));
    }

    static boolean queryOk(String panel) {
        try {
            raw("/px/queryFormDataList", map("panelCode", panel, "pageNo", 1, "pageSize", 5, "condition", Map.of()));
            return true;
        } catch (Exception e) { return false; }
    }

    static void expectReject(String label, ThrowingRunnable action) throws Exception {
        String msg = "";
        try { action.run(); } catch (Exception e) { msg = e.getMessage(); }
        check(label, !msg.isEmpty(), msg.isEmpty() ? "竟然通过了(应拒绝)" : msg);
    }

    interface ThrowingRunnable { void run() throws Exception; }

    static void check(String what, boolean ok) { check(what, ok, ""); }

    static void check(String what, boolean ok, String extra) {
        if (ok) { pass++; System.out.println("  [PASS] " + what + (extra.isEmpty() ? "" : " — " + shortMsg(extra))); }
        else { fail++; failures.append("  - ").append(what).append("  ").append(extra).append('\n');
            System.out.println("  [FAIL] " + what + (extra.isEmpty() ? "" : " — " + shortMsg(extra))); }
    }

    static String shortMsg(String s) {
        String t = s == null ? "" : s.replaceAll("\\s+", " ").trim();
        return t.length() > 120 ? t.substring(0, 120) + "…" : t;
    }

    static boolean hit(String msg, String word) { return msg != null && msg.contains(word); }
    static boolean near(double a, double b) { return Math.abs(a - b) < 0.0001; }

    static double bal(Map<String, Object> p) throws Exception {
        return balOf(str(p.get("wzdm")), str(p.get("ckdm")), str(p.get("lot_no")));
    }

    static double balOf(String item, String wh, String lot) throws Exception {
        Map<String, Object> r = one("SELECT ISNULL(yl,0) AS y FROM kucun WHERE wzdm=? AND ckdm=? AND ((? IS NULL AND lot_no IS NULL) OR lot_no=?)",
                item, wh, lot, lot);
        return r == null ? 0 : dbl(r.get("y"));
    }

    /** 明细**存活行**数:必须排除 asp_cancel='Y' —— 单据明细的重存是"软删缺席行 + upsert 在场行",
     *  按物理行数会数到历史版本(第一版就是这么误判成"行数变 3"的)。 */
    static int lines(String table, String no) throws Exception {
        return (int) dbl(one("SELECT COUNT(*) AS n FROM " + table
                + " WHERE [单据编号]=? AND ISNULL(asp_cancel,'N')<>'Y'", no).get("n"));
    }

    static int cnt(String table, String no, int src) throws Exception {
        return (int) dbl(one("SELECT COUNT(*) AS n FROM " + table + " WHERE [单据编号]=? AND src=? AND ISNULL(asp_cancel,'N')<>'Y'", no, src).get("n"));
    }

    static String status(String panel, String no) throws Exception {
        Map<String, Object> r = one("SELECT canceled, shr FROM yj_doc_status WHERE panel_code=? AND doc_no=?", panel, no);
        if (r == null) return "草稿";
        return str(r.get("shr")) == null ? "草稿" : "已审核";
    }

    // ══════════ 清理:只删本次跑出来的单(按单号精确) ══════════
    static void cleanup() throws Exception {
        System.out.println("\n───── 清理本次验收产生的单据 ─────");
        if (created.isEmpty()) { System.out.println("  无"); return; }
        for (String no : created) {
            try { call("TRANSFER".equals(no.substring(0, 2)) || no.startsWith("DB-") ? "TRANSFER" : "STOCKTAKE", "删除单据", map("编号", no)); } catch (Exception ignore) { }
        }
        try (PreparedStatement ps = db.prepareStatement(
                "DELETE FROM inh WHERE 单据编号 IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM outh WHERE 单据编号 IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM bl_transfer WHERE 单据编号 IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM bd_transfer WHERE 单据编号 IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM bl_stocktake WHERE 单据编号 IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM bd_stocktake WHERE 单据编号 IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM yj_doc_status WHERE doc_no IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM yj_usage_log WHERE doc_no IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM yj_form_approval WHERE form_no IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));"
                        + "DELETE FROM s_allno WHERE dh IN (SELECT v FROM (VALUES " + placeholders(created) + ") t(v));")) {
            for (int i = 0; i < 10; i++) for (int j = 0; j < created.size(); j++) ps.setString(i * created.size() + j + 1, created.get(j));
            ps.executeUpdate();
        }
        System.out.println("  已清理 " + created.size() + " 张");
    }

    static String placeholders(List<String> l) {
        return String.join(",", java.util.Collections.nCopies(l.size(), "(?)"));
    }

    // ══════════ HTTP / JDBC ══════════
    static void login() throws Exception {
        String raw = postRaw("/auth/login", map("userName", "admin", "password", "123456", "factory", factory));
        var m = java.util.regex.Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(raw);
        if (!m.find()) throw new IllegalStateException("登录失败:" + raw);
        token = m.group(1);
        System.out.println("登录成功(admin / " + factory + ")");
    }

    static String raw(String path, Map<String, Object> body) throws Exception {
        String out = postRaw(path, body);
        var c = java.util.regex.Pattern.compile("\"code\"\\s*:\\s*(-?\\d+)").matcher(out);
        int code = c.find() ? Integer.parseInt(c.group(1)) : -1;
        if (code != 200) {
            var m = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"([^\"]*)\"").matcher(out);
            throw new IllegalStateException(m.find() ? m.group(1).replace("\\n", " ") : out);
        }
        return out;
    }

    static String postRaw(String path, Map<String, Object> body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(json(body), StandardCharsets.UTF_8));
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpResponse<String> r = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        return r.body();
    }

    static Map<String, Object> one(String sql, Object... args) throws Exception {
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Map<String, Object> m = new LinkedHashMap<>();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) m.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
                return m;
            }
        }
    }

    static List<Map<String, Object>> list(String sql, Object... args) throws Exception {
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            List<Map<String, Object>> out = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) m.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
                    out.add(m);
                }
            }
            return out;
        }
    }

    static String str(Object o) { return o == null ? null : String.valueOf(o).trim(); }
    static double dbl(Object o) { return o == null ? 0 : Double.parseDouble(String.valueOf(o)); }
    static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    @SuppressWarnings("unchecked")
    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof String s) return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "") + "\"";
        if (o instanceof Number || o instanceof Boolean) return String.valueOf(o);
        if (o instanceof Map<?, ?> m) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(json(String.valueOf(e.getKey()))).append(':').append(json(e.getValue()));
            }
            return sb.append('}').toString();
        }
        if (o instanceof List<?> l) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < l.size(); i++) { if (i > 0) sb.append(','); sb.append(json(l.get(i))); }
            return sb.append(']').toString();
        }
        return json(String.valueOf(o));
    }
}
