package com.yinjia.mes.service;

import java.util.Map;

/**
 * 工序 → 生产线「车间」的唯一口径(2026-10-21 用户口径:
 * 「当前组装和装箱工序都是同样进入组装生产线才对」)。
 *
 * <p><b>为什么需要它</b>:产线档案 {@code bs_prod_line} 的车间只有三层(成型 / 切炭 / 组装),
 * 而工艺路线 {@code bs_route} 的「生产车间」是**自由文本、允许空值** —— 工序名与车间名对不上时
 * 就没人能判「这条线配不配这道工序」:
 * <ul>
 *   <li>路线车间空着 ⇒ 排线弹窗把**全部产线**都摆出来(实测 GD-2026-10-0202 行6:
 *       「装箱」被排到了「2号车间」这条**成型线**);</li>
 *   <li>路线车间写了工序名(如「装箱」)⇒ 找不到同名车间的产线,反而只能靠临时兜底。</li>
 * </ul>
 * 用户口径的对应关系是:**装箱归组装**(装箱线本来就在组装车间下,不为装箱单开一个车间),
 * 组装与装箱**进同一类产线**。
 *
 * <p><b>判定表</b>(纯函数,不碰库、不依赖 Spring;要加工序归属只改 {@link #BY_PROCESS},
 * 调用点不要再写 if):
 * <table border="1">
 *   <caption>工序 → 产线车间</caption>
 *   <tr><th>工序</th><th>产线车间</th><th>说明</th></tr>
 *   <tr><td>组装</td><td>组装</td><td>组装线 / 装箱线 同属组装车间</td></tr>
 *   <tr><td><b>装箱</b></td><td><b>组装</b></td><td>用户口径:装箱与组装同样进组装线</td></tr>
 *   <tr><td>成型</td><td>成型</td><td>同名车间(路线车间空着也能判)</td></tr>
 *   <tr><td>切炭</td><td>切炭</td><td>同名车间</td></tr>
 *   <tr><td>其它(下料 / 车削 / 检验 / 自定义新工序)</td><td>不设限</td><td><b>2026-10-28 起</b>:不猜也不拦 —— 排线弹窗列全部启用产线,任一条都能选</td></tr>
 * </table>
 *
 * <p><b>2026-10-28 补(用户口径:「之后任意一个不是当前三个工序名称的工序,也要能选到生产线」)</b>:
 * 本表只登记**确实有固定车间**的工序(成型/切炭/组装/装箱)。表里没有的工序 —— 包括用户以后
 * 新建的工序(封箱、喷码、包装…)—— **不再硬绑车间**:排线弹窗列出**全部启用产线**、服务端放行
 * 任一条启用线。判定入口统一在 {@code ProcessTaskService.requiredShop()}:
 * 「有固定归属 + 该车间确实有启用线」才拦,其余一律不拦(详见该方法注释)。
 * 本类的 {@link #resolve} 保持原义(判不出返回空串),{@link #hasFixedShop} 回答"这道工序认不认得"。
 *
 * <p>调用点(全部走同一份口径,避免"产线口径各写一套"):
 * <ul>
 *   <li>{@link ProcessTaskService#generateForWorkOrder} —— 工序任务落库时写**归口车间**;</li>
 *   <li>{@link ProcessTaskService#assign} —— 派工:任务的车间必须等于产线的车间;</li>
 *   <li>{@link ProcessTaskService#routeSteps} —— 预排线弹窗每道的候选线;</li>
 *   <li>{@link ProcessTaskService#preplanManual} —— 排线保存的服务端硬校验;</li>
 *   <li>{@link ProcessTaskService#nextProcess} —— 下一道工序的候选线。</li>
 * </ul>
 */
public final class ProcessShop {

    /** 工序 → 产线车间(工序有明确归属时以它为准,压过路线上的自由文本) */
    private static final Map<String, String> BY_PROCESS = Map.of(
            "成型", "成型",
            "切炭", "切炭",
            "组装", "组装",
            "装箱", "组装");

    private ProcessShop() {
    }

    /**
     * 该工序应当进哪一类车间(产线档案的「生产车间」)。
     *
     * @param op        工序名(路线 / 工序任务上的原始值)
     * @param routeShop 路线上登记的车间(自由文本,可为空)
     * @return 归口车间;判不出(工序不认识且路线也没填)时返回空串 —— **不猜**
     */
    public static String resolve(String op, String routeShop) {
        String p = trim(op);
        if (!p.isEmpty()) {
            String mapped = BY_PROCESS.get(p);
            if (mapped != null) return mapped;
        }
        return trim(routeShop);
    }

    /**
     * 这道工序是否**登记过固定车间**(即 {@link #BY_PROCESS} 里有它)。
     *
     * <p>2026-10-28:只有登记过的工序才谈"必须进哪个车间";没登记的(含用户以后新建的工序)
     * 一律不拦 —— 调用方据此决定"限定车间"还是"列出全部启用线"。
     *
     * @param op 工序名(首尾空格忽略)
     * @return true = 有固定归属(成型/切炭/组装/装箱)
     */
    public static boolean hasFixedShop(String op) {
        String p = trim(op);
        return !p.isEmpty() && BY_PROCESS.containsKey(p);
    }

    /**
     * 产线能不能做这道工序:**纯函数版**(不查库)—— 归口车间已知时必须与产线车间一致;判不出(空)时放行。
     *
     * <p>⚠ 2026-10-28 起业务调用点(matches 的旧调用方)统一改走
     * {@code ProcessTaskService.requiredShop()}:它在本函数之上再判「这道工序认不认得 + 该车间有没有启用线」,
     * 只有两者都成立才拦。本方法保留给"已确定要按车间判"的纯计算场景,不要再新加裸调用。
     *
     * @param op        工序名
     * @param routeShop 路线上登记的车间(可为空)
     * @param lineShop  产线档案的车间
     * @return true = 允许进入该产线
     */
    public static boolean matches(String op, String routeShop, String lineShop) {
        String want = resolve(op, routeShop);
        return want.isEmpty() || want.equals(trim(lineShop));
    }

    private static String trim(String v) {
        return v == null ? "" : v.trim();
    }
}
