package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 「手机扫码 · 生产领料」**批次分摊台账**(2026-11-24)。
 *
 * <h3>为什么要有这张表(用户口径)</h3>
 * 「现在的出库单和入库单要做到不同批次号和仓库是分开记录明细的。」
 * 「这个手机端会涉及到多个批次号和仓库出库的问题,重点修复。」
 *
 * <p>现场一次扫码领料,同一物料可能**跨 2~3 个批次、甚至跨两个仓**(先进先出自动拆批)。
 * 改造前只有一个落点:{@code wo_pick_line.批号} 写第一条批号,其余塞进「明细备注」字符串
 * ⇒ 提交生成的生产领料单**明细只有一行、只有一个批号**,其它批次/仓库的账根本没记上
 * (审核过账时按行批号扣,那几批的库存纹丝不动,现场看到"领了却没扣")。
 *
 * <p>本表把每一次分摊逐笔留痕:{@code (领料明细id, 仓库, 仓库编码, 批号, 数量)} 一行,
 * 提交时据此把生产领料单的明细**按 仓库+批号 拆成多行**(一行一个批次/仓库),
 * 审核过账即按行逐笔核销 —— 这才是"分开记录明细"。
 *
 * <h3>口径</h3>
 * <ul>
 *   <li>只记**分摊**,不记库存:库存仍只由 {@link StockLedgerService} 在审核时写
 *       {@code kucun(物料, 仓库, 批号)};</li>
 *   <li>一行领料明细的分摊合计 **必须等于** {@code wo_pick_line.实领数量}
 *       (写入时由调用方校验,差 0.0001 也拒绝);</li>
 *   <li>没有批次的物料:分摊行 {@code 批号} 为空串(与 kucun 的 NULL 批次等价),
 *       **不**编造批号 —— 验收期允许无批次出库(见「上线前必验-库存批次追溯」)。</li>
 * </ul>
 */
@Service
public class WoPickBatchService {

    /** 一条批次分摊(领域对象,避免到处 Map 取值) */
    public record Alloc(long id, long lineId, String code, String warehouse, String warehouseCode,
                        String lot, double qty) { }

    private final JdbcTemplate jdbc;

    public WoPickBatchService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 表在不在(测试库没跑迁移时,调用方退回"一行一物料"的老口径而不是 500) */
    public boolean tableReady() {
        Integer n = jdbc.queryForObject(
                "SELECT CASE WHEN OBJECT_ID('dbo.wo_pick_batch','U') IS NULL THEN 0 ELSE 1 END", Integer.class);
        return n != null && n == 1;
    }

    /**
     * 用本次扫码的分摊**整行替换**该领料明细的分摊(幂等:先软删旧行,再插新行)。
     *
     * <p>替换而不是追加:现场反复改数量时,旧分摊不清理会越堆越多、提交时重复出库。
     *
     * @param lineId 领料明细 id({@code wo_pick_line.id})
     * @param docId  台账 id({@code wo_pick_doc.id})
     * @param code   物料编码
     * @param allocs 本次分摊(每项 仓库/仓库编码/批号/数量;数量 &gt; 0 的才算)
     * @param user   操作人
     */
    public void replace(long lineId, long docId, String code, List<Map<String, Object>> allocs, String user) {
        if (!tableReady()) return;
        jdbc.update("UPDATE dbo.wo_pick_batch SET asp_cancel = 'Y', asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE 领料明细id = ? AND ISNULL(asp_cancel,'N') <> 'Y'", user, lineId);
        for (Map<String, Object> a : allocs) {
            double q = num(a.get("数量"));
            if (q <= 0) continue;
            jdbc.update("INSERT INTO dbo.wo_pick_batch"
                            + " (领料明细id, 单头id, 物料编码, 仓库, 仓库编码, 批号, 数量,"
                            + "  asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                    lineId, docId, code, str(a.get("仓库")), str(a.get("仓库编码")), str(a.get("批号")), q, user);
        }
    }

    /** 一行领料明细的分摊(按 批号 → id 排序,提交时按这个顺序出行号) */
    public List<Alloc> ofLine(long lineId) {
        if (!tableReady() || lineId <= 0) return List.of();
        return jdbc.queryForList("SELECT id, 领料明细id, ISNULL(物料编码,N'') AS 物料编码, ISNULL(仓库,N'') AS 仓库,"
                        + " ISNULL(仓库编码,N'') AS 仓库编码, ISNULL(批号,N'') AS 批号, ISNULL(数量,0) AS 数量"
                        + " FROM dbo.wo_pick_batch"
                        + " WHERE 领料明细id = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL(批号,N''), id", lineId)
                .stream().map(WoPickBatchService::toAlloc).toList();
    }

    /**
     * 整张单的分摊,按 <b>领料明细 id</b> 分组。
     *
     * <p>提交生成生产领料单时用它逐行展开,一次查询、不 N+1。
     */
    public Map<Long, List<Alloc>> ofDoc(long docId) {
        Map<Long, List<Alloc>> out = new LinkedHashMap<>();
        if (!tableReady() || docId <= 0) return out;
        for (Alloc a : jdbc.queryForList("SELECT id, 领料明细id, ISNULL(物料编码,N'') AS 物料编码,"
                        + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                        + " ISNULL(批号,N'') AS 批号, ISNULL(数量,0) AS 数量"
                        + " FROM dbo.wo_pick_batch WHERE 单头id = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY 领料明细id, ISNULL(批号,N''), id", docId)
                .stream().map(WoPickBatchService::toAlloc).toList()) {
            out.computeIfAbsent(a.lineId(), k -> new ArrayList<>()).add(a);
        }
        return out;
    }

    /**
     * 按**领料单号**取分摊并按 物料编码 分组(单据详情页给每行挂「批次明细」用)。
     *
     * <p>一个物料在一张领料单上只有一行(BOM 一行),所以按物料编码分组足够;
     * 若历史数据同物料多行,分组会把它们并到一起 —— 展示用途,不影响提交(提交按明细 id)。
     */
    public Map<String, List<Alloc>> byOutNo(String outNo) {
        Map<String, List<Alloc>> out = new LinkedHashMap<>();
        if (!tableReady() || outNo == null || outNo.isBlank()) return out;
        for (Alloc a : jdbc.queryForList("SELECT b.id, b.领料明细id, ISNULL(b.物料编码,N'') AS 物料编码,"
                        + " ISNULL(b.仓库,N'') AS 仓库, ISNULL(b.仓库编码,N'') AS 仓库编码,"
                        + " ISNULL(b.批号,N'') AS 批号, ISNULL(b.数量,0) AS 数量"
                        + " FROM dbo.wo_pick_batch b JOIN dbo.wo_pick_doc d ON d.id = b.单头id"
                        + " WHERE d.领料单号 = ? AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                        + " ORDER BY b.领料明细id, ISNULL(b.批号,N''), b.id", outNo)
                .stream().map(WoPickBatchService::toAlloc).toList()) {
            out.computeIfAbsent(a.code(), k -> new ArrayList<>()).add(a);
        }
        return out;
    }

    /** 分摊 → 前端/单据用的扁平结构(键名与明细行同口径:仓库/仓库编码/批号/数量) */
    public static Map<String, Object> toView(Alloc a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("仓库", a.warehouse());
        m.put("仓库编码", a.warehouseCode());
        m.put("批号", a.lot());
        m.put("数量", a.qty());
        return m;
    }

    private static Alloc toAlloc(Map<String, Object> r) {
        return new Alloc(lng(r.get("id")), lng(r.get("领料明细id")), str(r.get("物料编码")),
                str(r.get("仓库")), str(r.get("仓库编码")), str(r.get("批号")), num(r.get("数量")));
    }

    private static long lng(Object o) {
        if (o instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(o).trim());
        } catch (RuntimeException e) {
            return 0L;
        }
    }

    private static double num(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (RuntimeException e) {
            return 0d;
        }
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
