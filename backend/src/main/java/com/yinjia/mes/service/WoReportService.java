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
    /** 工序量换算(与工单详情同一口径):报工封顶按**换算后的工序量**,见 processPlanQty */
    private final ProcessTaskService processTask;

    public WoReportService(JdbcTemplate jdbc, ProcessTaskService processTask) {
        this.jdbc = jdbc;
        this.processTask = processTask;
    }

    public static boolean posts(String panelCode) {
        return "WO_REPORT".equals(panelCode);
    }

    /**
     * 报工单**保存后**补「工单行号」(2026-10-15 用户口径:报工单必带工单行号 —— 落库 + 界面显示)。
     *
     * <p>为什么在保存时补而不只在审核时:权威行键 {@code gd_id} 只在**审核**时由 {@link #complete} 写入
     * ⇒ 草稿期的报工单不携带任何行信息,列表上看不出"这张单是哪一行的",同工单号多行时无法分辨。
     * 本方法在草稿阶段就把行号解析出来落库(冗余展示列),审核时再由 complete() 按行锚定 gd_id。
     *
     * <p>解析口径(与 {@link #reportRows} 同源,取不到**不猜**):① 已有 gd_id → 经 plang_pc 反查 pl_xc;
     * ② 否则按(工单号 + 批次号)找该行,**恰命中 1 行**才写;0 行/多行留空(等审核时按行锚定)。
     */
    public void stampRowNo(String panelCode, String no) {
        if (!posts(panelCode) || no == null || no.isBlank()) return;
        // ① 已有 gd_id(=plang_pc.id)→ 经 plang_pc.plang_id 反查该行的 pl_xc
        jdbc.update(
                "UPDATE s SET s.[工单行号] = x.pl_xc FROM dbo.scjl s"
                        + " CROSS APPLY (SELECT TOP 1 p.pl_xc FROM dbo.plang_pc pc"
                        + "   JOIN dbo.plang p ON p.id = pc.plang_id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   WHERE pc.id = s.gd_id) x"
                        + " WHERE s.[报工单号]=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND s.[工单行号] IS NULL AND ISNULL(s.gd_id,0) > 0", no);
        // ② 没有 gd_id(草稿期常态)→ 按(工单号 + 批次号)找该行,**恰命中 1 行**才写;0 行/多行留空。
        //    ⚠ 必须用 CTE + HAVING COUNT(*)=1 的形态:T-SQL 的 `UPDATE … FROM … GROUP BY` 是**语法错**
        //      (实测 "Incorrect syntax near the keyword 'GROUP'"),与迁移脚本 migrate-scjl-wo-line-20261015.sql 同款。
        jdbc.update(
                "WITH cand AS ("
                        + "  SELECT s.id AS sid, MIN(p.pl_xc) AS xc FROM dbo.scjl s"
                        + "  JOIN dbo.plang p ON p.pl_no = s.gldh AND ISNULL(p.[批次号],N'') = ISNULL(s.[批次号],N'')"
                        + "       AND ISNULL(p.asp_cancel,'N') <> 'Y'"
                        + "  WHERE s.[报工单号]=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "    AND s.[工单行号] IS NULL AND ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号],N'') <> N''"
                        + "  GROUP BY s.id HAVING COUNT(*) = 1)"
                        + " UPDATE s SET s.[工单行号] = c.xc FROM dbo.scjl s JOIN cand c ON c.sid = s.id", no);
    }

    /** 审核 → 本单 scjl 行 wgzt='Y'+wgsj,补 jc_no 与排产镜像。 */
    public void post(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        // 审核前先补行号(2026-10-15):complete() 的锚定与工序校验都读 scjl.[工单行号];
        //   若本单是"直接审核"(没走过保存)或行号尚未解析,这里补一次,保证按「工单号+工单行号」落点。
        stampRowNo(panelCode, no);
        for (Map<String, Object> r : rows(no)) {
            complete(r, user);
        }
    }

    /** 该报工单涉及的**工单号**(去重;转序派线按工单号定位台账) */
    public List<String> workOrdersOf(String panelCode, String no) {
        if (!posts(panelCode)) return java.util.List.of();
        return jdbc.queryForList(
                "SELECT DISTINCT ISNULL(gldh,N'') FROM dbo.scjl WHERE [报工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'",
                String.class, no);
    }

    /**
     * 该报工单**锚定到的工单行**(转序按「工单号 + 工单行号」唯一作用):
     *   scjl.gd_id = 排产镜像 plang_pc.id → plang_pc.plang_id = plang.id(=工单行);
     *   老数据没有 gd_id 时退回按(工单号 + 批次号)找该行的 id。
     */
    public List<Map<String, Object>> reportRows(String panelCode, String no) {
        if (!posts(panelCode)) return java.util.List.of();
        // 行定位优先级(用户口径 2026-10-15「工单号+工单行号确定当前唯一工单」):
        //   ① gd_id(= plang_pc.id)→ plang_pc.plang_id  —— 排产行级精确锚(最准)
        //   ② (工单号 + scjl.[工单行号])               —— 行标识本身(报工保存时 stampRowNo 落库)
        //   ③ (工单号 + 批次号)                        —— 老数据兜底
        //   三级都取不到 ⇒ NULL(不猜行)
        return jdbc.queryForList(
                "SELECT DISTINCT ISNULL(s.gldh,N'') AS 工单号, ISNULL(pc.plang_id,"
                        + "   ISNULL((SELECT TOP 1 p.id FROM dbo.plang p WHERE p.pl_no = s.gldh"
                        + "      AND ISNULL(p.pl_xc,0) = ISNULL(s.[工单行号],0) AND ISNULL(s.[工单行号],0) > 0"
                        + "      AND ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id),"
                        + "     (SELECT TOP 1 p.id FROM dbo.plang p WHERE p.pl_no = s.gldh"
                        + "        AND ISNULL(p.[批次号],N'') = ISNULL(s.[批次号],N'')"
                        + "        AND ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id))) AS 工单行id"
                        + " FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " WHERE s.[报工单号]=? AND ISNULL(s.asp_cancel,'N')<>'Y'", no);
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
                        + " ISNULL([批次号],N'') AS rpt_batch, ISNULL(gd_id,0) AS gd_id,"
                        // 「工单行号」= 保存时由 stampRowNo 落库的行标识(2026-10-15 行级锚点)
                        + " [工单行号] AS own_xc,"
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
        // 本次报工归属的**批次**(2026-10-07 行级口径:唯一键 = 工单号 + 工单行号;批次号用于锚定到行)
        String rptBatch = r.get("rpt_batch") == null ? "" : String.valueOf(r.get("rpt_batch")).trim();
        // 本行锚点(2026-10-15「工单号+工单行号确定当前唯一工单」):
        //   ① 本单已带 gd_id(=plang_pc.id,重审/再报时)→ plang_pc.plang_id
        //   ② 本单带 工单行号(scjl.工单行号,界面可见)→ (工单号 + 行号) 定位该行
        //   ⚠ 优先取 ①:gd_id 是排产行级别的精确锚,行号可能对应多个物理行。
        Long wantRowId = null;
        double ownGd = num(r.get("gd_id"));
        if (ownGd > 0) {
            List<Long> rr = jdbc.queryForList(
                    "SELECT TOP 1 pc.plang_id FROM dbo.plang_pc pc"
                            + " JOIN dbo.plang p ON p.id = pc.plang_id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " WHERE pc.id=?", Long.class, (long) ownGd);
            if (!rr.isEmpty()) wantRowId = rr.get(0);
        }
        if (wantRowId == null && r.get("own_xc") != null) {
            List<Long> rr = jdbc.queryForList(
                    "SELECT id FROM dbo.plang WHERE pl_no=? AND ISNULL(pl_xc,0)=?"
                            + " AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND (? = N'' OR ISNULL([批次号],N'') = ?)"
                            + " ORDER BY id", Long.class, wo, ((Number) r.get("own_xc")).intValue(),
                    rptBatch, rptBatch);
            if (rr.size() == 1) wantRowId = rr.get(0);   // 恰命中 1 行才认,多行不猜(退回批次/FIFO)
        }
        // ── 工序报工必须跟随工单的**工艺路线**(2026-10-05 用户口径:报工按当前工单路线执行,选错工序会报错)──
        //   ① 报工的工序必须在 plang.工艺路线 的工序明细内;
        //   ② 不得跳序:路线中排在该工序之前的工序若尚无**已审核**报工 → 拦截(提示先报前道)。
        // 工单未关联路线时不校验(兼容历史单);校验在**写入之前**,失败不落任何数据。
        // 🔴 2026-10-15 修(用户口径「工单号+工单行号确定当前唯一工单,各个工单的进程、流程追溯都这样实现」):
        //   原按 `pl_no` 取**整单首条非空路线** —— 而**同一工单号的不同行可以有不同路线**
        //   (实测 GD-2026-10-0002:行2/3/4 = GY-2026-10-0003,行1/5/6/7/8 = GY-CB-STD)
        //   ⇒ 给行2 报工时拿的是行1 的路线,工序校验/不跳序判断全落在**别的行**的工序集上
        //   (正确工序被拒 / 错误工序被放行)。现改为取**本行**(工单行id → 批次兜底)的路线。
        Long repRowId = resolveRowIdForReport(wo, rptBatch);
        List<String> rtRows = repRowId != null
                ? jdbc.queryForList("SELECT ISNULL([工艺路线],N'') FROM dbo.plang WHERE id=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工艺路线],N'')<>N''", String.class, repRowId)
                : List.of();
        if (rtRows.isEmpty()) {
            // 行定位不到(历史单/没带批次):退回整单口径,与旧行为一致
            rtRows = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND ISNULL([工艺路线],N'')<>N''", String.class, wo);
        }
        String route = rtRows.isEmpty() ? "" : rtRows.get(0);
        if (!route.isBlank()) {
            List<String> ops = jdbc.queryForList(
                    "SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND ISNULL(工序名称,N'')<>N'' ORDER BY ISNULL(加工顺序,999)", String.class, route);
            int idx = ops.indexOf(op);
            if (idx < 0) {
                throw new IllegalStateException("工序「" + op + "」不在工单 " + wo + " 的工艺路线「" + route + "」内("
                        + String.join("→", ops) + "),不能报工");
            }
            for (int i = 0; i < idx; i++) {
                // 不跳序:按**本次报工的行**判(2026-10-15:工单号+工单行号才是唯一工单 ⇒ 前道是否已报
                //   要看**本行**;原来只按批次号比,同批次多行时会看到别的行的报工)
                Integer done;
                if (repRowId != null) {
                    done = jdbc.queryForObject(
                            "SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=? AND s.gxdm=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                                    + " AND ISNULL(s.wgzt,'N')='Y'"
                                    + " AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = ?)"
                                    + "      OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号],N'') = ?))",
                            Integer.class, wo, ops.get(i), repRowId, rptBatch);
                } else {
                    // 行定位不到(历史单/没带批次):退回工单级,与旧行为一致
                    done = jdbc.queryForObject(
                            "SELECT COUNT(*) FROM dbo.scjl WHERE gldh=? AND gxdm=? AND ISNULL(asp_cancel,'N')<>'Y'"
                                    + " AND ISNULL(wgzt,'N')='Y'",
                            Integer.class, wo, ops.get(i));
                }
                if (done == null || done == 0) {
                    throw new IllegalStateException("前道工序「" + ops.get(i) + "」尚未报工,不能跳到「" + op
                            + "」(工单路线:" + String.join("→", ops) + ")");
                }
            }
        }
        if (qty <= 0) throw new IllegalStateException("报工数量必须大于 0");
        double dual = num(r.get("dual_qty"));
        if (dual > qty + 0.0001) throw new IllegalStateException("直销数量(" + dual + ")不能大于报工数量(" + qty + ")");
        // 守卫+落点:plang 未结案行 × plang_pc 排产行
        //   用户口径(2026-10-15)「工单号+工单行号确定当前唯一工单」:报工单**必须**锚到本行。
        //   锚定优先级:① 本单已有 gd_id(重审/再报)② 本单带的**工单行号**(界面已显示该列)
        //   ③ 批次号 ④ 才退回 FIFO(订单行号→批次;历史单兼容)。
        //   ⚠ 原实现只认批次号、否则 FIFO 取第一行 —— 同工单多行同批次时会**认错行**
        //     (把行6 的报工记到行1 头上),这正是用户报障的"同工单号不同行混在一起"。
        Map<String, Object> t;
        try {
            t = jdbc.queryForMap(
                    "SELECT TOP 1 pc.id AS pc_id, pc.[批次号] AS pc_batch, pc.scx AS pc_scx, pc.lb AS pc_lb,"
                            + " p.comm AS comm, p.dm AS dm, ISNULL(p.mc,N'') AS mc, ISNULL(p.gg,N'') AS gg,"
                            + " ISNULL(p.jldw,N'') AS jldw, ISNULL(p.khdm,N'') AS khdm, ISNULL(p.lot_no,N'') AS lot_no,"
                            + " ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.od_no,N'') AS od_no, p.od_xc AS od_xc,"
                            + " ISNULL(p.zl,0) AS zl, ISNULL(p.llxz,N'') AS llxz, ISNULL(p.djlx,N'') AS djlx,"
                            + " p.id AS plang_id, p.pl_xc AS pl_xc"
                            + " FROM dbo.plang_pc pc"
                            + " JOIN dbo.plang p ON pc.plang_id = p.id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " WHERE pc.pl_no = ? AND ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''"
                            + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                            + "   AND (? IS NULL OR p.id = ?)"                       // ① 本单锚定的行(已有 gd_id / 带行号)
                            + "   AND (? = N'' OR ISNULL(pc.[批次号],N'') = ?)"      // ② 批次
                            + " ORDER BY p.pl_xc, pc.[批次号], p.id",
                    wo, wantRowId, wantRowId, rptBatch, rptBatch);
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
        // 工序维度封顶(2026-10-07 对齐"两把尺子"):口径 = **该工单行该道工序的计划量**
        //   = 本行排产数量 × 该道自己的换算率(与快速排产弹窗、预排台账、转序判据同一口径)。
        //   仅作"明显误输"软拦(> 计划量 10 倍);**允许超产**(现场真实产出)。
        //   老口径(首道 Σ×率、其后逐道累乘、按整单)只在拿不到行/路线时兜底(历史数据兼容)。
        double rowPl = num(t.get("pl_sl"));
        Object rowIdObj = t.get("plang_id");
        Long plangRowId = rowIdObj == null ? null : ((Number) rowIdObj).longValue();
        Double rowRate = plangRowId == null ? null : jdbc.queryForObject(
                "SELECT TOP 1 ISNULL(r.换算率,1) FROM dbo.plang p JOIN dbo.bs_route r"
                        + "   ON r.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND r.工序名称 = ? AND ISNULL(r.asp_cancel,'N')<>'Y'"
                        + " WHERE p.id = ?", Double.class, op, plangRowId);
        double cap;
        if (rowRate != null && rowPl > 0) {
            cap = rowPl * (rowRate <= 0 ? 1 : rowRate);
        } else {
            cap = processTask.processPlanQty(wo, op);       // 兜底:老口径
            if (cap <= 0) {
                Double totalPl = jdbc.queryForObject(
                        "SELECT ISNULL(SUM(ISNULL(pl_sl,0)),0) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        Double.class, wo);
                cap = totalPl == null ? 0 : totalPl;
            }
        }
        // 已报量也按**该行**(锚 scjl.gd_id → plang_pc.plang_id;老数据按批次兜底)统计,与转序一致
        Double opSum = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(s.sl,0)),0) FROM dbo.scjl s"
                        + " WHERE s.gldh=? AND s.gxdm=? AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "   AND (? IS NULL"
                        + "        OR EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = ?)"
                        + "        OR (s.gd_id IS NULL AND ISNULL(s.[批次号],N'') = ?))",
                Double.class, wo, op, plangRowId, plangRowId, t.get("pc_batch"));
        if (qty > cap * 10 + 0.0001) {
            throw new IllegalStateException("报工数量 " + qty + " 明显异常(本行" + (rptBatch.isBlank() ? "" : "批次" + rptBatch + " ")
                    + "工序[" + op + "]计划量 " + cap + ",已报 " + (opSum == null ? 0 : opSum)
                    + ");如属超产请核对后分批报工");
        }
        // jc_no 产成品流水(产线--yyMMdd-8位,按 线+日 递增)
        String scx = String.valueOf(t.get("pc_scx"));
        String day = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd"));
        Integer seq = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.scjl WHERE scx=? AND jc_no LIKE ?", Integer.class,
                scx, scx + "--" + day + "-%");
        String jcNo = scx + "--" + day + "-" + String.format("%08d", (seq == null ? 0 : seq) + 1);
        // 就地完成化:补镜像 + 锚定 + 完工状态(草稿行本来就在 scjl,不另插行)
        // 「工单行号」(2026-10-15):权威行键 gd_id 在此写定,行号随之落库 —— 界面直接显示"哪一行",
        //   同工单号多行/多批次时一眼可辨(此前只有批次号,同天多笔转单批次号相同则分不出)。
        jdbc.update("UPDATE dbo.scjl SET"
                        + " comm=?, gd_id=?, tm=?, scx=?, scxmc=?, jbbh=?,"
                        + " wzdm=?, mc=?, gg=?, jldw=?, khdm=?, lot_no=?, pl_sl=?,"
                        + " od_no=?, od_xc=?, zl=?, llxz=?, djlx=?, [批次号]=?, [工单行号]=?,"
                        + " wgzt=N'Y', wgsj=GETDATE(), jc_no=?, ywman=COALESCE(NULLIF(ywman,''),?),"
                        + " asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE id=?",
                t.get("comm"), t.get("pc_id"), wo, scx, scx,
                t.get("pc_lb"),
                t.get("dm"), t.get("mc"), t.get("gg"), t.get("jldw"), t.get("khdm"), t.get("lot_no"), t.get("pl_sl"),
                t.get("od_no"), t.get("od_xc"), t.get("zl"), t.get("llxz"), t.get("djlx"), t.get("pc_batch"),
                t.get("pl_xc"),
                jcNo, user, user, rowId);
    }

    /**
     * 报工单 → **工单行**(plang.id):行级口径的唯一身份(用户口径 2026-10-15
     * 「工单号+工单行号确定当前唯一工单」)。
     *
     * <p>解析顺序(取不到返回 null,调用方退回整单口径 = 旧行为):
     * ① 本单已锚定的 {@code scjl.gd_id}(= plang_pc.id)→ {@code plang_pc.plang_id = plang.id};
     * ② 本单带了批次号 → 按(工单号 + 批次号)找该行(**恰命中 1 行**才认,多行不猜);
     * ③ 都不行 → null。
     */
    private Long resolveRowIdForReport(String wo, String rptBatch) {
        if (wo == null || wo.isBlank()) return null;
        List<Long> anchored = jdbc.queryForList(
                "SELECT TOP 1 pc.plang_id FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " JOIN dbo.plang p ON p.id = pc.plang_id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.gd_id,0) > 0"
                        + " ORDER BY s.id DESC", Long.class, wo);
        if (!anchored.isEmpty() && anchored.get(0) != null) return anchored.get(0);
        if (rptBatch != null && !rptBatch.isBlank()) {
            List<Long> byBatch = jdbc.queryForList(
                    "SELECT id FROM dbo.plang WHERE pl_no=? AND ISNULL([批次号],N'')=?"
                            + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", Long.class, wo, rptBatch);
            if (byBatch.size() == 1) return byBatch.get(0);
        }
        return null;
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
