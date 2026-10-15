package com.yinjia.mes.service;

/**
 * 组装成品检验单「审核 → 产成品入库单」的**数量口径**(纯函数:不碰库、不依赖 Spring,探针可直接跑真代码)。
 *
 * <h3>用户口径(2026-10-17)</h3>
 * 「为当前的表头增加合格数量(入库)的字段,设定为必填。让当前审核完成后才对这些数量产生到产成品入库单内。」
 * 随后用户又要求把字段名**正名为「合格数量」**(「将当前组装成品检验的合格数量（入库）修改为合格数量」)——
 * 物理列 / {@code yj_field.col_name+label} / 译名 ref_key 一并改名为「合格数量」
 * (见 {@code tools/migrate-asm-insp-passqty-rename-20261017.sql}),口径与时机不变。
 *
 * <h3>为什么从"派生"改成"填报"</h3>
 * 旧口径(v3.24 之前 {@code ButtonService.asmInspToStock})的合格数 = 表头「检验数量」− Σ明细「不合格数量」,
 * 是**算出来的**。用户现在要的是品质在单头**明确报出**"这一单有多少合格品要进成品库",并以它为入库数量的
 * **唯一来源** —— 派生值在"检验数量没填 / 只检了一部分"时算不出业务要的那个数,也没法在单上复核。
 *
 * <h3>三条规则(与 {@code yj_field.required=1} 一起,把必填兜在"真正消费它的那一刻")</h3>
 * <ol>
 *   <li>没填 ⇒ **拒绝审核**(不清不楚地审过去只会静默不生成入库单,业务上最难查);</li>
 *   <li>超过表头「检验数量」(检验数量 &gt; 0 时)⇒ 拒绝:入库量不可能大于检验量;</li>
 *   <li>= 0 ⇒ **合法**:本单没有要入库的合格品(全不合格/暂不入库),不生成入库单、也不算错。</li>
 * </ol>
 *
 * <p>调用点只有一处:{@code ButtonService.asmInspToStock}(审核 / 审批通过时经
 * {@code runWoAuditHooks} 触发)—— 保存与草稿阶段不碰库存,弃审时那张自动生成的入库单草稿会被
 * {@code asmInspUnauditCascade} 作废。</p>
 */
public final class AsmInspStockQty {

    private AsmInspStockQty() {}

    /** 表头字段名(= 物理列名 = yj_field.label;登记为 required=1) */
    public static final String FIELD = "合格数量";

    /**
     * 解析本次要写进产成品入库单的数量。
     *
     * @param declared  表头「合格数量」的原值(null / 空串 = 没填)
     * @param inspected 表头「检验数量」(仅 &gt; 0 时做上限校验)
     * @return 产成品入库单行的「实收数量」;0 = 本单没有要入库的合格品(调用方据此不生成入库单)
     * @throws IllegalStateException 没填 / 为负 / 超过检验数量(三条都带业务话术,直接回给用户)
     */
    public static double resolve(Object declared, double inspected) {
        if (declared == null || String.valueOf(declared).isBlank()) {
            throw new IllegalStateException("请先填写「" + FIELD + "」再审核（它决定本单有多少合格品进成品库）");
        }
        double pass = num(declared);
        if (pass < 0) {
            throw new IllegalStateException("「" + FIELD + "」不能为负数");
        }
        if (inspected > 0 && pass > inspected) {
            throw new IllegalStateException("「" + FIELD + "」(" + trimZero(pass)
                    + ")不能超过表头「检验数量」(" + trimZero(inspected) + ")");
        }
        return pass;
    }

    /** 数量的显示文本(去尾零):44.5 / 3 —— 入库单备注、错误话术里用它,别打印成 44.5000 */
    public static String text(double v) {
        return trimZero(v);
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** 小数去尾零(与 ButtonService.trimZero 同口径):44.5000 → 44.5,3.0000 → 3 */
    private static String trimZero(double v) {
        if (v == Math.rint(v) && !Double.isInfinite(v)) return String.valueOf((long) v);
        return java.math.BigDecimal.valueOf(v).stripTrailingZeros().toPlainString();
    }
}
