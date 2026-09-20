# BCrypt 口径核实报告(由服务端同款库算出)

## 库中样本哈希

- 值:`$2a$10$Moj1FDdhyiS6pr406akaJey.Vj60Awm31ETy34qZh2NWxXHbjDt2a`
- 长度=60 版本=`$2a$` cost=10 盐(22字符)=`Moj1FDdhyiS6pr406akaJe`

## ① 服务端校验入口(两处都 true 才算对上)

- `BCrypt.checkpw("123456", 库中值)` = **true**
- `new BCryptPasswordEncoder().matches("123456", 库中值)` = **true**
- 错误口令("123457") = false(应为 false)

## ② 用取出的盐复算(证明盐内嵌、任何语言都能独立复现)

- 复算 = `$2a$10$Moj1FDdhyiS6pr406akaJey.Vj60Awm31ETy34qZh2NWxXHbjDt2a`
- 与库中逐字符一致 = **true**

## ③ 是否追加 NUL(决定 C 实现口径)

- 带 NUL = `$2a$10$Moj1FDdhyiS6pr406akaJeY4EBNvu3FdLn71TT8ETf.0ZJvShGw9q`
- 与不带 NUL 相同 = false ⇒ 不同即证明服务端**不**追加 NUL(照标准 bcrypt 写)

## ④ 中文口令 = 按 UTF-8 字节参与(不是 UTF-16/本地码页)

- pw=`银嘉123456` UTF-8 字节数=12 → `$2a$10$Moj1FDdhyiS6pr406akaJe0N1lrlnvasxvnI.JBRo4mXGNtQaIMDm`
- pw=`测试口令` UTF-8 字节数=12 → `$2a$10$Moj1FDdhyiS6pr406akaJeb8mVG5l6hkMGrNc/acntwKVsuGu8jEq`
- pw=`Aa1!中文` UTF-8 字节数=10 → `$2a$10$Moj1FDdhyiS6pr406akaJeIkFx4b9xISQPCDdB6NQid6UXyfI/bHO`

## ⑤ 超 72 字节:Spring 6.x 抛异常(不是静默截断)

- 80 字节口令 → 抛 `IllegalArgumentException: password cannot be more than 72 bytes`(BCrypt.java hashpw 处)
- `BCryptPasswordEncoder.matches(80 字节)` 不抛异常,返回 **false** ⇒ 登录接口收到超长口令 = 直接判定口令错误(不会 500)
- `matches(73 字节)` 返回 **false**(边界:72 内可用,>72 判错)
- 72 字节整(24 个汉字)可用:`$2a$10$Moj1FDdhyiS6pr406akaJeLKNKpzLHR.3d74XvVilULS7Dtvbyfnm`

## ⑥ 给 C/C++ 实现的自测向量(固定盐,期望值由服务端同款库算出)

盐 = `$2a$10$Moj1FDdhyiS6pr406akaJe`

| 口令(pw) | 期望哈希 |
|---|---|
| `123456` | `$2a$10$Moj1FDdhyiS6pr406akaJey.Vj60Awm31ETy34qZh2NWxXHbjDt2a` |
| `abc123` | `$2a$10$Moj1FDdhyiS6pr406akaJe/BGXYg4ldQhjjLQpl5MYB5Qtq2RTnSq` |
| `银嘉123456` | `$2a$10$Moj1FDdhyiS6pr406akaJe0N1lrlnvasxvnI.JBRo4mXGNtQaIMDm` |
| `Passw0rd!中文` | `$2a$10$Moj1FDdhyiS6pr406akaJeUlXnbHRUYCtKEGtJzOkQHjaXUtzsbKW` |
| `` | `$2a$10$Moj1FDdhyiS6pr406akaJeurhgXBfdR8Yvyry1JbQ/sB32oKLi1ly` |

反例(判错即实现跑偏):

| 错误写法 | 会得到 | 说明 |
|---|---|---|
| pw 后补 `\0` | `$2a$10$Moj1FDdhyiS6pr406akaJeY4EBNvu3FdLn71TT8ETf.0ZJvShGw9q` | jBCrypt 系做法,Spring 不是这个 |
| pw 超过 72 字节仍截断计算 | 应改为拒绝 | Spring 直接抛异常 |

