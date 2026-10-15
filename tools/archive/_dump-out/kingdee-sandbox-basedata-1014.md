# 沙箱账套口径 + 基础资料 id(只读探针产物)

- 探针: `tools/archive/_probe-kingdee-sandbox-basedata-1014.mjs`
- 抓取时间: 2026-10-14T10:42:45.532Z
- 凭证来源: `deploy/push/config.json`(应用 clientId=359220;appKey/appSecret 空,sandboxInstanceId=579046204055359488)

## ① 本应用(clientId=359220)被授权的账套

push_app_authorize 返回 **2** 条授权记录:

| 企业名 | outerInstanceId | instanceId | accountId | domain | status |
|---|---|---|---|---|---|
| 华实创新（惠州）科技有限公司 | 579023121319858176 | 2097172384679456770 | 1788814946310785767 | https://tf.jdy.com | 1 |
| 华实创新（惠州）科技有限公司 | 579046204055359488 | 2097195467416080386 | 1788817066171085812 | https://tf.jdy.com | 1 |

## ② 商品数量判定:静态密钥实际打到哪个实例

| outerInstanceId | 企业名 | /jdy/v2/bd/material count | 与已知口径对照 |
|---|---|---|---|
| 579023121319858176 | 华实创新（惠州）科技有限公司 | 48 | (未知) |
| 579046204055359488 | 华实创新（惠州）科技有限公司 | 298 | (未知) |

**本次实测账套 = outerInstanceId `579046204055359488`**(下面所有基础资料与保存探针都取自它)

## ③ 基础资料样本(id + number + name)

### 商品 `/jdy/v2/bd/material`(账套内共 298 条)

| id | number | name | 其它关键键 |
|---|---|---|---|
| 2569796588071402496 | C-95-13 | 006项目/功能炭棒滤芯 | parent_name="" parent_number="" parent_id="" is_multi_unit=false is_serial=false is_asst_attr=false |
| 2569797727873416192 | C-95-13**TB | 006项目/功能炭棒滤芯(C-95-13**TB) | parent_name="" parent_number="" parent_id="" is_multi_unit=false is_serial=false is_asst_attr=false |
| 2569797731237246976 | C-95-14 | 006项目/功能炭棒滤芯(C-95-14) | parent_name="" parent_number="" parent_id="" is_multi_unit=false is_serial=false is_asst_attr=false |
| 2569797737033997312 | C-95-14**TB | 006项目/功能炭棒滤芯(C-95-14**TB) | parent_name="" parent_number="" parent_id="" is_multi_unit=false is_serial=false is_asst_attr=false |
| 2569797742352152577 | C-95-15 | 006项目/功能炭棒滤芯(C-95-15) | parent_name="" parent_number="" parent_id="" is_multi_unit=false is_serial=false is_asst_attr=false |

### 计量单位 `/jdy/v2/bd/measure_unit`(账套内共 13 条)

| id | number | name | 其它关键键 |
|---|---|---|---|
| 6 | g | g | precision="0" |
| 7 | kg | kg | precision="0" |
| 1 | 个 | 个 | precision="0" |
| 4 | 件 | 件 | precision="0" |
| 1837737785851760640 | 元 | 元 | precision="0" |

### 仓库 `/jdy/v2/bd/store`(账套内共 21 条)

| id | number | name | 其它关键键 |
|---|---|---|---|
| 2569796666798488576 | CK04 | 半成品仓 | group_name="" group_id="" group_number="" is_allow_freight=false is_allow_neg="false" enable="1" |
| 3 | CK00003 | 包材仓 | group_name="" group_id="" group_number="" is_allow_freight=false is_allow_neg="false" enable="1" |
| 2569796668266395650 | CK05 | 不良品仓 | group_name="" group_id="" group_number="" is_allow_freight=false is_allow_neg="false" enable="1" |
| 2569797834811390976 | CK07 | 不良品仓(CK07) | group_name="" group_id="" group_number="" is_allow_freight=false is_allow_neg="false" enable="1" |
| 2569796670128888835 | WH-CL | 材料仓 | group_name="" group_id="" group_number="" is_allow_freight=false is_allow_neg="false" enable="1" |

### 职员 `/jdy/v2/bd/emp`(账套内共 57 条)

| id | number | name | 其它关键键 |
|---|---|---|---|
| 2569801440696481792 | ZY00099 | LGH | mobile="" id_number="U1X4XegJAObYxK+YTogpHg==" enable="1" |
| 2569801442089090048 | ZY00059 | 白兴发 | mobile="" id_number="U1X4XegJAObYxK+YTogpHg==" enable="1" |
| 2569801443506764800 | ZY00111 | 白自学 | mobile="" id_number="U1X4XegJAObYxK+YTogpHg==" enable="1" |
| 2569801445150833664 | ZY00036 | 曹飞平 | mobile="" id_number="U1X4XegJAObYxK+YTogpHg==" enable="1" |
| 2569801446568729600 | ZY00106 | 曾小玲 | mobile="" id_number="U1X4XegJAObYxK+YTogpHg==" enable="1" |

### 部门 `/jdy/v2/bd/department`(账套内共 1 条)

| id | number | name | 其它关键键 |
|---|---|---|---|
| 100000 | 100000 | 华实创新（惠州）科技有限公司 | long_number="100000" full_name="华实创新（惠州）科技有限公司" enable="1" level="0" is_leaf=true parent_id="0" |

