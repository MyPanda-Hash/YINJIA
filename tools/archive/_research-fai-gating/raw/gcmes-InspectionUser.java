package com.px.mbg.model;

import com.px.mbg.base.BaseEntity;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * <p>
 * 考核用户-结果
 * </p>
 *
 * @author 品讯科技
 * @since 2022-03-21
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel(value="InspectionUser对象", description="考核用户-结果")
public class InspectionUser extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "考核结果id")
    private Long irId;

    @ApiModelProperty(value = "用户id")
    private Long uesrId;

    @ApiModelProperty(value = "得分")
    private String score;


}
