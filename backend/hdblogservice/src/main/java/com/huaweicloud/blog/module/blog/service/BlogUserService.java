package com.huaweicloud.blog.module.blog.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.huaweicloud.blog.module.blog.entity.BlogUser;

import java.util.Collection;
import java.util.List;

public interface BlogUserService extends IService<BlogUser> {

    BlogUser getByUid(String uid);

    List<BlogUser> listByUids(Collection<String> uids);

    /** 按 uid 获取用户，不存在则自动建档 */
    BlogUser getOrCreate(String uid, String name, String photo);

    /** 按华为云账号（domainId）获取/建档 Agent 用户 */
    BlogUser getOrCreateByDomain(String domainId, String domainName);
}
