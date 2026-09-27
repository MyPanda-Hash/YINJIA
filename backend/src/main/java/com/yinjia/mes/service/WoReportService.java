package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 工序报工记账(2026-09-27 终版:**scjl 单表化**——录入载体与事实账合一)。
 *
 * <p>WO_REPORT/WO_REPORT_LIST 两面板数据源已切 scjl(migrate-scjl-single-table.sql):
 * 新增报工单=直接 INSERT scjl 草稿行(wgzt 空),保存/yj_doc_status 状态机如常;
 * <ul><li>审核 hook:本单 scjl 行 wgzt='Y'+wgsj(完工)+ 落 jc_no 产成品流水 + 补排产镜像字段
 *     (gd_id/gldh 锚定 plang_pc;产线/批次/客户/产品等镜像自 plang×plang_pc)——**不再另插新行**;</li>
 * <li>弃审 hook:wgzt 回空、wgsj 置空、jc_no 保留(历史留痕,不再软删);
 *     已有入库回写(post_no)的拒绝弃审;</li>
 * <li>守卫(plang 口径):工单存在·未结案·已排产;工序封顶(本工序已报+本次 ≤ Σ排产)。</li></ul>
 * wo_report 停用为遗留表。参考库关联:scjl.gd_id=plang_pc.id、gldh=pl_no(docs 盘点 §2.3/§3.2)。
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

    /** 审核 → 本单 scjl 行 wgzt='Y'+wgsj,补 jc_no 与排产镜像。 */
    public void post(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        for (Map<String, Object> r : rows(no)) {
            complete(r, user);
        }
    }

    /** 弃审 → wgzt 回空(留痕不软删);已有 post_no 的拒绝。 */
    public void unpost(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.scjl WHERE [报工单号]=? AND ISNULL(post_no,'')<>'' AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, no);
        if (n != null && n > 0) {
            throw new IllegalStateException("该报工已有完工入库回写(post_no),请先弃审对应入库单");
        }
        jdbc.update("UPDATE dbo.scjl SET wgzt=NULL, wgsj=NULL, asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE [报工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'",
                user, no);
    }

    private List<Map<String, Object>> rows(String no) {
        return jdbc.queryForList(
                "SELECT id, ISNULL(gldh,N'') AS gldh, ISNULL(gxdm,N'') AS gxdm, ISNULL(sl,0) AS sl,"
                        + " ISNULL([直销数量],0) AS dual_qty FROM dbo.scjl"
                        + " WHERE [报工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'", no);
    }

    /** 审核完成化:守卫 + 镜像补全 + wgzt/jc_no。草稿行由面板保存时已带 gldh/gxdm/sl。 */
    private void complete(Map<String, Object> r, String user) {
        Integer rowId = (Integer) r.get("id");
        String wo = String.valueOf(r.get("gldh")).trim();
        String op = String.valueOf(r.get("gxdm")).trim();
        double qty = num(r.get("sl"));
        if (wo.isEmpty() || op.isEmpty()) throw new IllegalStateException("报工单缺少工单号或工序,不能过账");
        if (qty <= 0) throw new IllegalStateException("报工数量必须大于 0");
        double dual = num(r.get("dual_qty"));
        if (dual > qty + 0.0001) throw new IllegalStateException("直销数量(" + dual + ")不能大于报工数量(" + qty + ")");
        // 守卫+落点:plang 未结案行 × plang_pc 排产行(FIFO 订单行号→批次)
        Map<String, Object> t;
        try {
            t = jdbc.queryForMap(
                    "SELECT TOP 1 pc.id AS pc_id, pc.[批次号] AS pc_batch, pc.scx AS pc_scx, pc.lb AS pc_lb,"
                            + " p.comm AS comm, p.dm AS dm, ISNULL(p.mc,N'') AS mc, ISNULL(p.gg,N'') AS gg,"
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
            Integer exists = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", Integer.class, wo);
            if (exists == null || exists == 0) throw new IllegalStateException("工单不存在:" + wo);
            Integer closed = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(ja,'N') IN ('T','Y')",
                    Integer.class, wo);
            if (closed != null && closed > 0) throw new IllegalStateException("工单 " + wo + " 已结案,不能报工");
            throw new IllegalStateException("工单 " + wo + " 未排产,不能报工(先在快速排产排入产线)");
        }
        // 工序维度封顶:本工序已报(仅计 wgzt='Y' 的完工行,本行草稿未计) + 本次 ≤ Σ排产
        Double totalPl = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(pl_sl,0)),0) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Double.class, wo);
        Double opSum = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(sl,0)),0) FROM dbo.scjl WHERE gldh=? AND gxdm=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " AND ISNULL(wgzt,'N')='Y'",
                Double.class, wo, op);
        double opRemain = (totalPl == null ? 0 : totalPl) - (opSum == null ? 0 : opSum);
        if (qty > opRemain + 0.0001) {
            throw new IllegalStateException("报工数量 " + qty + " 超过工序[" + op + "]剩余可报数量 " + opRemain
                    + "(排产总量 " + (totalPl == null ? 0 : totalPl) + " − 本工序已报 " + (opSum == null ? 0 : opSum) + ")");
        }
        // jc_no 产成品流水(产线--yyMMdd-8位,按 线+日 递增)
        String scx = String.valueOf(t.get("pc_scx"));
        String day = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd"));
        Integer seq = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.scjl WHERE scx=? AND jc_no LIKE ?", Integer.class,
                scx, scx + "--" + day + "-%");
        String jcNo = scx + "--" + day + "-" + String.format("%08d", (seq == null ? 0 : seq) + 1);
        // 就地完成化:补镜像 + 锚定 + 完工状态(草稿行本来就在 scjl,不另插行)
        jdbc.update("UPDATE dbo.scjl SET"
                        + " comm=?, gd_id=?, tm=?, scx=?, scxmc=?, jbbh=?,"
                        + " wzdm=?, mc=?, gg=?, jldw=?, khdm=?, lot_no=?, pl_sl=?,"
                        + " od_no=?, od_xc=?, zl=?, llxz=?, djlx=?, [批次号]=?,"
                        + " wgzt=N'Y', wgsj=GETDATE(), jc_no=?, ywman=COALESCE(NULLIF(ywman,''),?),"
                        + " asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE id=?",
                t.get("comm"), t.get("pc_id"), wo, scx, scx,
                t.get("pc_lb"),
                t.get("dm"), t.get("mc"), t.get("gg"), t.get("jldw"), t.get("khdm"), t.get("lot_no"), t.get("pl_sl"),
                t.get("od_no"), t.get("od_xc"), t.get("zl"), t.get("llxz"), t.get("djlx"), t.get("pc_batch"),
                jcNo, user, user, rowId);
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
