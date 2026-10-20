package com.huaweicloud.blog.module.blog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户。
 */
@Data
@TableName("hd_blog_user")
public class BlogUser implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String uid;

    private String memAlias;

    private String memName;

    private String memPhoto;

    private String xdomainType;

    /** 华为云账号ID（Agent 身份主键） */
    private String hcloudDomainId;

    /** 华为云账号名 */
    private String hcloudDomainName;

    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
