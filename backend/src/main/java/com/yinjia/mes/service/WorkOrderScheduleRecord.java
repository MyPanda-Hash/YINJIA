package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

/** 原有 plang_pc 排产记录:按工单行同步业务字段,保留排产 id 与创建留痕。 */
final class WorkOrderScheduleRecord {
    private WorkOrderScheduleRecord() {}

    // 仅两表原有的共同业务列;不复制 id/创建时间,不虚构排产独有的 jh_date。
    private static final String COLUMNS = "comm,pl_no,pl_xc,pl_date,scx,pl_man,dm,mc,gg,gg2,jldw,"
            + "pl_sl,pl_sl2,xq_sl,rk_sl,yl,dj,jine,cp_date,st_date,cp_date2,rk_no,bz,ja,"
            + "od_no,od_xc,lot_no,color,siz,lb,mjlx,BomId,ll_no,wb_no,ll_no2,remark,MoDId,"
            + "llxz,cgrkdh,lldh,djlx,zl,[批次号]";

    static void create(JdbcTemplate jdbc, Object rowId, String user) {
        String source = java.util.Arrays.stream(COLUMNS.split(","))
                .map(c -> "p." + c).collect(java.util.stream.Collectors.joining(","));
        int count = jdbc.update("INSERT INTO dbo.plang_pc (" + COLUMNS
                        + ",plang_id,asp_cancel,asp_user1,asp_time1) SELECT " + source
                        + ",p.id,N'N',?,GETDATE() FROM dbo.plang p WHERE p.id=?"
                        + " AND ISNULL(p.asp_cancel,'N')<>'Y'", user, rowId);
        if (count != 1) throw new IllegalStateException("排产记录生成失败:工单行不存在或已作废");
    }

    /** 只更新已有排产行,未排产工单不会被隐式排入产线。 */
    static void sync(JdbcTemplate jdbc, Object rowId, String user) {
        String assignments = java.util.Arrays.stream(COLUMNS.split(","))
                // od_no 原有两表长度不同;新增同步不覆盖历史来源单号。
                .filter(c -> !c.equals("od_no"))
                .map(c -> "pc." + c + "=p." + c).collect(java.util.stream.Collectors.joining(","));
        jdbc.update("UPDATE pc SET " + assignments + ",pc.asp_user2=?,pc.asp_time2=GETDATE()"
                        + " FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id"
                        + " WHERE p.id=? AND ISNULL(pc.asp_cancel,'N')<>'Y'"
                        + " AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        // 历史分批排产不能把每批数量覆盖成工单总量。
                        + " AND (SELECT COUNT(*) FROM dbo.plang_pc sibling WHERE sibling.plang_id=p.id"
                        + " AND ISNULL(sibling.asp_cancel,'N')<>'Y')=1", user, rowId);
    }
}
