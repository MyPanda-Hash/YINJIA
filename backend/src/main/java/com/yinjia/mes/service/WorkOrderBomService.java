package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单 BOM 取数(2026-11-13 新增)—— **临时工单用料优先,产品标准组装 BOM 兜底**。
 *
 * <p>背景(用户口径 2026-11-13):「在当前新建生产工单中增加一个页签按钮,为增加临时工单,
 * 临时工单需要实现上方为主物料下方为所需的物料」+「作为生产工单的实现的话会不会导致只填写
 * 主物料,而没写子物料导致的当前 bom 没法被查询到?」
 *
 * <p>⇒ 本系统的 BOM 取数有**两层**,不是"工单里有没有子件"决定:
 * <ol>
 *   <li><b>常规工单</b>:只用主物料(产品编码)去查产品的**标准组装物料清单** {@code bs_asm_bom}
 *       (工序=组装;默认BOM='是' 优先 → 版本号 DESC → 单据编号 DESC,与报工端/领料端同口径)
 *       ⇒ 只填主物料**不会**导致 BOM 查不到,只要该产品在《组装物料清单》里维护过;</li>
 *   <li><b>临时工单</b>:产品没有标准 BOM、或用料与标准不同 ⇒ 建单时把子件写进
 *       {@code wo_bom}(按工单行定制)⇒ 取数时**先看本工单行有没有 wo_bom**,有就用它,
 *       没有才回落标准 BOM。</li>
 * </ol>
 *
 * <p>此前 {@code latestAsmBom}/{@code bomDetail}/{@code asmBomOf} 三处各写一套 SQL(MobilePick /
 * WorkReport),本类收口成唯一口径 —— 以后再改 BOM 排序或单位兜底只改这里,避免两端取到不同版本
 * (2026-11-04 出过同类事故:领料端/报工端各按各的排序取 BOM)。
 */
@Service
public class WorkOrderBomService {

    private final JdbcTemplate jdbc;

    public WorkOrderBomService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * BOM 视图(供接口与页面直接下发)。
     *
     * @param source  取数来源:{@code 临时工单} = 本工单行的 wo_bom;{@code 标准BOM} = 产品标准组装清单;空 = 都没有
     * @param docNo   标准 BOM 时=bs_asm_bom.单据编号;临时工单为空(它没有独立单号)
     * @param version 标准 BOM 的版本号;临时工单为空
     * @param origin  标准 BOM 自己的「来源」列(如"金蝶BOM引出列表_…"的导入留痕);临时工单为空
     * @param lines   子件行(统一键:行序/子件编码/子件名称/子件规格/计量单位/标准用量/损耗量/备注)
     */
    public record Bom(String source, String docNo, String version, String origin,
                      List<Map<String, Object>> lines) {
        public boolean isEmpty() { return lines == null || lines.isEmpty(); }
        public boolean temporary() { return "临时工单".equals(source); }
    }

    /**
     * 工单行 BOM:**临时工单用料优先 → 标准组装 BOM 兜底**。
     *
     * @param rowId       工单行id(= plang.id);可为空(只有产品编码时回落标准 BOM)
     * @param productCode 产品编码(= plang.dm)
     * @return 永远非 null;两者都没有时 lines 为空(调用方据此给"没有维护用料"的提示)
     */
    public Bom ofRow(Object rowId, String productCode) {
        Bom temp = tempOfRow(rowId);
        if (!temp.isEmpty()) return temp;
        return standardOf(productCode);
    }

    /** 临时工单用料(wo_bom):该工单行的子件行;没有返回空 Bom */
    public Bom tempOfRow(Object rowId) {
        long id = longOf(rowId);
        if (id <= 0) return new Bom("", "", "", "", List.of());
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT ISNULL(b.行序,0) AS 行序, ISNULL(b.子件编码,N'') AS 子件编码,"
                        + " ISNULL(b.子件名称,N'') AS 子件名称,"
                        // 规格/单位:BOM 上优先,没填时回落到存货档案(与标准 BOM 同口径)
                        + " ISNULL(NULLIF(ISNULL(b.子件规格,N''),N''), ISNULL(i.规格型号,N'')) AS 子件规格,"
                        + " ISNULL(NULLIF(ISNULL(b.计量单位,N''),N''), ISNULL(i.计量单位,N'')) AS 计量单位,"
                        + " ISNULL(b.标准用量,0) AS 标准用量, ISNULL(b.损耗量,0) AS 损耗量,"
                        + " ISNULL(b.行备注,N'') AS 备注"
                        + " FROM dbo.wo_bom b"
                        + " LEFT JOIN dbo.bs_inv i ON i.存货编码 = b.子件编码 AND ISNULL(i.asp_cancel,'N') <> 'Y'"
                        + " WHERE b.工单行id = ? AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(b.子件编码,N'') <> N''"
                        + " ORDER BY ISNULL(b.行序,999), b.id", id);
        return lines.isEmpty()
                ? new Bom("", "", "", "", List.of())
                : new Bom("临时工单", "", "", "", lines);
    }

    /**
     * 产品标准组装物料清单(bs_asm_bom,工序=组装)。
     *
     * <p>排序与报工端/领料端既有口径**逐字一致**:默认BOM='是' → 版本号 DESC → 单据编号 DESC
     * (见 {@code MobilePickController.latestAsmBom} 历史注释:补单号兜底是因为同产品可能同日建两版、
     * 版本号相同,只按版本号排两端会取到不同的一张)。只认 工序='组装' + 未作废 + 状态≠停用。
     */
    public Bom standardOf(String productCode) {
        String code = productCode == null ? "" : productCode.trim();
        if (code.isEmpty()) return new Bom("", "", "", "", List.of());
        List<Map<String, Object>> docs = jdbc.queryForList(
                "SELECT TOP 1 b.单据编号, ISNULL(b.版本号,N'') AS 版本号, ISNULL(b.来源,N'') AS 来源"
                        + " FROM dbo.bs_asm_bom b"
                        + " WHERE b.产品编码 = ? AND b.工序 = N'组装' AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(b.状态,N'启用') <> N'停用'"
                        // 2026-11-18:整张清单被「删除单据」作废(yj_doc_status.canceled='Y')后不能再参与领料/报工取数。
                        // 行还在表里(作废只写状态,不删行),只看 asp_cancel 会把废单当有效 BOM 取走。
                        + "   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code = 'ASM_BOM'"
                        + "       AND s.doc_no = b.单据编号 AND s.canceled = 'Y')"
                        + " GROUP BY b.单据编号, b.版本号, b.默认BOM, b.来源"
                        + " ORDER BY CASE WHEN ISNULL(b.默认BOM,N'') = N'是' THEN 0 ELSE 1 END,"
                        + " b.版本号 DESC, b.单据编号 DESC", code);
        if (docs.isEmpty()) return new Bom("", "", "", "", List.of());
        Map<String, Object> doc = docs.get(0);
        String bomNo = str(doc.get("单据编号"));
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT ISNULL(d.行序,0) AS 行序, ISNULL(d.子件编码,N'') AS 子件编码,"
                        + " ISNULL(d.子件名称,N'') AS 子件名称,"
                        + " ISNULL(NULLIF(ISNULL(d.子件规格,N''),N''), ISNULL(i.规格型号,N'')) AS 子件规格,"
                        + " ISNULL(NULLIF(ISNULL(d.计量单位,N''),N''), ISNULL(i.计量单位,N'')) AS 计量单位,"
                        + " ISNULL(d.标准用量,0) AS 标准用量, ISNULL(d.损耗量,0) AS 损耗量,"
                        + " ISNULL(d.行备注,N'') AS 备注"
                        + " FROM dbo.bs_asm_bom d"
                        + " LEFT JOIN dbo.bs_inv i ON i.存货编码 = d.子件编码 AND ISNULL(i.asp_cancel,'N') <> 'Y'"
                        + " WHERE d.单据编号 = ? AND ISNULL(d.asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(d.子件编码,N'') <> N''"
                        + " ORDER BY ISNULL(d.行序,999), d.id", bomNo);
        if (lines.isEmpty()) return new Bom("", "", "", "", List.of());
        return new Bom("标准BOM", bomNo, str(doc.get("版本号")), str(doc.get("来源")), lines);
    }

    /** 只读端点/弹窗用的 JSON 结构(键名与前端约定一致;行结构与两个 BOM 来源统一) */
    public Map<String, Object> view(String source, String docNo, String version, String origin,
                                    List<Map<String, Object>> lines) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("来源", source == null ? "" : source);
        out.put("单据编号", docNo == null ? "" : docNo);
        out.put("版本号", version == null ? "" : version);
        out.put("数据来源", origin == null ? "" : origin);
        out.put("行", lines == null ? List.of() : lines);
        return out;
    }

    public Map<String, Object> viewOf(Bom bom) {
        return view(bom.source(), bom.docNo(), bom.version(), bom.origin(), bom.lines());
    }

    /** 宽松取 long(空/非数字 → 0;避免 NumberFormatException 打穿接口) */
    private static long longOf(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v == null) return 0;
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
