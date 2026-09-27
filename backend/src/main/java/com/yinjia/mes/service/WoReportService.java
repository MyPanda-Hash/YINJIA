package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 工序报工记账(2026-09-27 切参考库原始口径:落 **scjl** 生产记录表,弃 wo_progress)。
 *
 * <p>参考库关联方式(docs/design/参考库生产管理盘点-表结构与逻辑实现.md §2.3/§3.2):
 * <ul><li>scjl.gd_id = **plang_pc.id**(精确到批次排产行)、scjl.gldh = plang_pc.pl_no(工单号);</li>
 * <li>每次报工一行(参考库分批完工多行实证:GD2608100001 四行 jc_no 流水 00000001~4);</li>
 * <li>审核即完工:wgzt='Y' + wgsj=GETDATE()(到位/开始状态机预留);</li>
 * <li>弃审 = 软删该次报工的 scjl 行(asp_cancel='Y'),对称无负数;</li>
 * <li>产成品流水号 jc_no = 产线--yyMMdd-8位流水(参考库 1060209--260826-00000001 同构);</li>
 * <li>完工入库回写 post_no 由 ManuWritebackService 负责(本类只记报工)。</li></ul>
 *
 * <p>守护:工单必须在 plang 存在·未结案·**已排产**(plang_pc 有行——报工的 gd_id 落点);
 * 多批次行按 FIFO(订单行号→批次)选第一个有余量的行;已入库回写(post_no)的报工不可弃审。
 * 报工单↔scjl 行的回溯锚:bz=N'报工单 '+报工单号。
 */
@Service
public class WoReportService {

    private final JdbcTemplate jdbc;

    public WoReportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static boolean posts(String panelCode) {
        return "WO_REPORT".equals(panelCode);
    }

    /** 审核 → 每行报工 INSERT 一行 scjl(gd_id=plang_pc.id,完工即 wgzt='Y')。 */
    public void post(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        for (Map<String, Object> r : rows(no)) {
            insertScjl(no, r, user);
        }
    }

    /** 弃审 → 软删该报工单生成的 scjl 行(已入库回写 post_no 的拒绝)。 */
    public void unpost(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.scjl WHERE [bz] = N'报工单 ' + ? AND ISNULL(post_no,'') <> '' AND ISNULL(asp_cancel,'N') <> 'Y'",
                Integer.class, no);
        if (n != null && n > 0) {
            throw new IllegalStateException("该报工已有完工入库回写(post_no),请先弃审对应入库单");
        }
        jdbc.update("UPDATE dbo.scjl SET asp_cancel = N'Y', asp_user4 = ?, asp_time4 = GETDATE()"
                        + " WHERE [bz] = N'报工单 ' + ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                user, no);
    }

    private List<Map<String, Object>> rows(String no) {
        return jdbc.queryForList(
                "SELECT [工单号], [工序], [报工数量], [直销数量] FROM wo_report WHERE [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'", no);
    }

    /** 参考库口径落一行 scjl:守卫(plang 存在/未结案/已排产 FIFO 批次行)→ 冗余镜像 + 完工状态 + jc_no 流水。 */
    private void insertScjl(String reportNo, Map<String, Object> r, String user) {
        String wo = str(r.get("工单号"));
        String op = str(r.get("工序"));
        double qty = num(r.get("报工数量"));
        if (wo == null || op == null) throw new IllegalStateException("报工单缺少工单号或工序,不能过账");
        if (qty <= 0) throw new IllegalStateException("报工数量必须大于 0");
        // 守卫+落点:plang 未结案行 × plang_pc 排产行,FIFO(订单行号→批次)取第一个有余量的
        Map<String, Object> t;
        try {
            t = jdbc.queryForMap(
                    "SELECT TOP 1 pc.id AS pc_id, pc.[批次号] AS pc_batch, pc.scx AS pc_scx, pc.lb AS pc_lb,"
                            + " p.id AS p_id, p.comm AS comm, p.dm AS dm, ISNULL(p.mc,N'') AS mc, ISNULL(p.gg,N'') AS gg,"
                            + " ISNULL(p.jldw,N'') AS jldw, ISNULL(p.khdm,N'') AS khdm, ISNULL(p.lot_no,N'') AS lot_no,"
                            + " ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.od_no,N'') AS od_no, p.od_xc AS od_xc,"
                            + " ISNULL(p.zl,0) AS zl, ISNULL(p.llxz,N'') AS llxz, ISNULL(p.djlx,N'') AS djlx"
                            + " FROM dbo.plang_pc pc"
                            + " JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc"
                            + "   AND ISNULL(pc.[批次号],N'') = ISNULL(p.[批次号],N'') AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " WHERE pc.pl_no = ? AND ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''"
                            + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                            + " ORDER BY p.pl_xc, pc.[批次号]", wo);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            // 区分报错原因:没这工单 / 未排产 / 已结案
            Integer exists = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", Integer.class, wo);
            if (exists == null || exists == 0) throw new IllegalStateException("工单不存在:" + wo);
            Integer closed = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(ja,'N') IN ('T','Y')",
                    Integer.class, wo);
            if (closed != null && closed > 0) throw new IllegalStateException("工单 " + wo + " 已结案,不能报工");
            throw new IllegalStateException("工单 " + wo + " 未排产,不能报工(先在快速排产排入产线)");
        }
        // 守卫(工序维度封顶):本工序已报 + 本次 ≤ 工单排产总量(Σpl_sl)——五工序各自累计,
        // 不与其它工序比较(后道工序不被前道卡死);看板未交量仍按 max(入库,分工序最大) 扣减
        Double totalPl = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(pl_sl,0)),0) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Double.class, wo);
        Double opSum = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(sl,0)),0) FROM dbo.scjl WHERE gldh=? AND gxdm=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Double.class, wo, op);
        double opRemain = (totalPl == null ? 0 : totalPl) - (opSum == null ? 0 : opSum);
        if (qty > opRemain + 0.0001) {
            throw new IllegalStateException("报工数量 " + qty + " 超过工序[" + op + "]剩余可报数量 " + opRemain
                    + "(排产总量 " + (totalPl == null ? 0 : totalPl) + " − 本工序已报 " + (opSum == null ? 0 : opSum) + ")");
        }
        // jc_no 产成品流水号(参考库:产线--yyMMdd-8位流水,按 产线+日 递增)
        String scx = String.valueOf(t.get("pc_scx"));
        String day = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd"));
        Integer seq = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.scjl WHERE scx = ? AND jc_no LIKE ?", Integer.class,
                scx, scx + "--" + day + "-%");
        String jcNo = scx + "--" + day + "-" + String.format("%08d", (seq == null ? 0 : seq) + 1);
        // 落表:参考库镜像字段 + 完工状态 + 报工单回溯锚(bz)
        jdbc.update("INSERT INTO dbo.scjl (comm, sc_no, wzdm, mc, gg, jldw, sc_date, ywman,"
                        + " gldh, gd_id, gxdm, sl, loss, bf_qty, bl_qty, lot_no,"
                        + " wgzt, wgsj, bz, scx, scxmc, tm, jc_no, jbbh,"
                        + " pl_sl, khdm, od_no, od_xc, zl, llxz, djlx, [批次号],"
                        + " asp_user1, asp_time1, asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,GETDATE(),?,"
                        + " ?,?,?,?,0,0,0,?,"
                        + " N'Y',GETDATE(),N'报工单 ' + ?,?,?,?,?,"
                        + " ?,?,?,?,?,?,?,?,?"
                        + ", ?,GETDATE(),N'N')",
                t.get("comm"), wo, t.get("dm"), t.get("mc"), t.get("gg"), t.get("jldw"), user,
                wo, t.get("pc_id"), op, qty, t.get("lot_no"),
                reportNo, scx, scx, wo, jcNo, t.get("pc_lb"),
                t.get("pl_sl"), t.get("khdm"), t.get("od_no"), t.get("od_xc"), t.get("zl"), t.get("llxz"), t.get("djlx"), t.get("pc_batch"),
                user);
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
