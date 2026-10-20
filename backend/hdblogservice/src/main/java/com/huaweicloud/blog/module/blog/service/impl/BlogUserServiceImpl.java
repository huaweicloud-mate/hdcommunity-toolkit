package com.huaweicloud.blog.module.blog.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.huaweicloud.blog.common.api.ErrorCode;
import com.huaweicloud.blog.common.exception.BusinessException;
import com.huaweicloud.blog.module.blog.entity.BlogUser;
import com.huaweicloud.blog.module.blog.mapper.BlogUserMapper;
import com.huaweicloud.blog.module.blog.service.BlogUserService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collection;
import java.util.Collections;
import java.util.List;

@Service
public class BlogUserServiceImpl extends ServiceImpl<BlogUserMapper, BlogUser> implements BlogUserService {

    @Override
    public BlogUser getByUid(String uid) {
        if (uid == null || uid.isBlank()) {
            return null;
        }
        return lambdaQuery().eq(BlogUser::getUid, uid).last("limit 1").one();
    }

    @Override
    public List<BlogUser> listByUids(Collection<String> uids) {
        if (uids == null || uids.isEmpty()) {
            return Collections.emptyList();
        }
        return lambdaQuery().in(BlogUser::getUid, uids).list();
    }

    @Override
    public BlogUser getOrCreate(String uid, String name, String photo) {
        BlogUser existing = getByUid(uid);
        if (existing != null) {
            return existing;
        }
        BlogUser user = new BlogUser();
        user.setUid(uid);
        user.setMemAlias(name != null && !name.isBlank() ? name : uid);
        user.setMemName(name != null && !name.isBlank() ? name : uid);
        user.setMemPhoto(photo);
        user.setStatus(1);
        try {
            save(user);
            return user;
        } catch (DuplicateKeyException e) {
            return getByUid(uid);
        }
    }

    @Override
    public BlogUser getOrCreateByDomain(String domainId, String domainName) {
        if (!StringUtils.hasText(domainId)) {
            throw new BusinessException(ErrorCode.AGENT_AUTH_FAILED, "账号信息缺失");
        }
        BlogUser existing = lambdaQuery().eq(BlogUser::getHcloudDomainId, domainId).last("limit 1").one();
        if (existing != null) {
            return existing;
        }
        String alias = StringUtils.hasText(domainName) ? domainName : "hw-" + domainId;
        BlogUser user = new BlogUser();
        user.setUid("hw-" + domainId);
        user.setMemAlias(alias);
        user.setMemName(alias);
        user.setHcloudDomainId(domainId);
        user.setHcloudDomainName(domainName);
        user.setStatus(1);
        try {
            save(user);
            return user;
        } catch (DuplicateKeyException e) {
            BlogUser byUid = getByUid(user.getUid());
            if (byUid != null) {
                return byUid;
            }
            return lambdaQuery().eq(BlogUser::getHcloudDomainId, domainId).last("limit 1").one();
        }
    }
}
