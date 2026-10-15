package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 生产工单行的只读完工事实；歧义历史记录不猜行，不回写。 */
@Service
public class WorkOrderCompletionService {
    private final JdbcTemplate jdbc;

    public WorkOrderCompletionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // 正锚绝不降级；无锚带行号时，批次只用于确认/消歧，不能改投其它行号。
    private static final String FACTS = """
            WITH facts AS (
              SELECT s.*, CASE WHEN ISNULL(s.gd_id,0)>0 THEN N'排产行锚'
                               WHEN s.[工单行号] IS NOT NULL THEN N'工单号+工单行号'
                               ELSE N'工单内唯一批次' END AS [收敛口径]
              FROM dbo.scjl s
              OUTER APPLY (
                SELECT COUNT(*) AS n, MIN(p.id) AS row_id FROM dbo.plang p
                WHERE p.pl_no=s.gldh AND ISNULL(p.asp_cancel,'N')<>'Y'
                  AND ISNULL(s.gd_id,0)=0
                  AND ((s.[工单行号] IS NOT NULL AND p.pl_xc=s.[工单行号]
                        AND (NULLIF(LTRIM(RTRIM(s.[批次号])),N'') IS NULL OR p.[批次号]=s.[批次号]))
                    OR (s.[工单行号] IS NULL AND NULLIF(LTRIM(RTRIM(s.[批次号])),N'') IS NOT NULL
                        AND p.[批次号]=s.[批次号]))
              ) legacy
              WHERE s.gldh=? AND s.wgzt=N'Y' AND ISNULL(s.asp_cancel,'N')<>'Y'
                AND ((ISNULL(s.gd_id,0)>0 AND EXISTS (
                       SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=?))
                  OR (ISNULL(s.gd_id,0)=0 AND legacy.n=1 AND legacy.row_id=?))
            )
            """;

    public Map<String, Object> completionDetails(String workOrder, long rowId) {
        if (workOrder == null || workOrder.isBlank() || rowId <= 0) {
            throw new IllegalArgumentException("请提供有效工单号和行id");
        }
        String no = workOrder.trim();
        List<Map<String, Object>> heads = jdbc.queryForList("""
                SELECT pl_no AS 工单号, pl_xc AS 工单行号, id AS 行id,
                       ISNULL(mc,N'') AS 产品名称, ISNULL(gg,N'') AS 规格型号,
                       ISNULL([批次号],N'') AS 批次号
                FROM dbo.plang WHERE id=? AND pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'
                """, rowId, no);
        if (heads.isEmpty()) throw new IllegalArgumentException("工单号与行id不匹配或工单行已作废");
        Object lineNo = heads.get(0).get("工单行号");
        List<Map<String, Object>> details = jdbc.queryForList(FACTS + """
                SELECT id, ISNULL([报工单号],N'') AS 报工单号, gldh AS 工单号,
                       ? AS 工单行号, ISNULL(gxdm,N'') AS 工序, ISNULL([批次号],N'') AS 批次号,
                       ISNULL(scx,N'') AS 生产线, ISNULL(wzdm,N'') AS 产品编码,
                       ISNULL(mc,N'') AS 产品名称, ISNULL(gg,N'') AS 规格型号, ISNULL(jldw,N'') AS 单位,
                       ISNULL(sl,0) AS 完成数量, ISNULL(pl_sl,0) AS 计划数量,
                       COALESCE(NULLIF(LTRIM(RTRIM(ywman)),N''),asp_user1,N'') AS 报工人,
                       asp_time1 AS 报工时间, wgsj AS 完工时间,
                       ISNULL(jc_no,N'') AS 产成品流水号, ISNULL(post_no,N'') AS 入库单号, 收敛口径
                FROM facts ORDER BY wgsj,id
                """, no, rowId, rowId, lineNo);
        List<Map<String, Object>> summary = jdbc.queryForList(FACTS + """
                SELECT ISNULL(gxdm,N'') AS 工序, SUM(ISNULL(sl,0)) AS 完成数量, COUNT(*) AS 记录数
                FROM facts GROUP BY ISNULL(gxdm,N'') ORDER BY 工序
                """, no, rowId, rowId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("头", heads.get(0));
        result.put("明细", details);
        result.put("工序汇总", summary);
        return result;
    }
}
