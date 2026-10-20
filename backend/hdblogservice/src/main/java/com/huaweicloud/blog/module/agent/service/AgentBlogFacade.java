package com.huaweicloud.blog.module.agent.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.huaweicloud.blog.common.api.ErrorCode;
import com.huaweicloud.blog.common.exception.BusinessException;
import com.huaweicloud.blog.common.util.IdempotencyUtil;
import com.huaweicloud.blog.common.util.RefUtil;
import com.huaweicloud.blog.module.agent.dto.AgentBlogSaveDTO;
import com.huaweicloud.blog.module.agent.vo.AgentBlogDetailVO;
import com.huaweicloud.blog.module.agent.vo.AgentBlogItemVO;
import com.huaweicloud.blog.module.agent.vo.AgentCommentItemVO;
import com.huaweicloud.blog.module.agent.vo.AgentCommentListVO;
import com.huaweicloud.blog.module.agent.vo.AgentFileVO;
import com.huaweicloud.blog.module.agent.vo.AgentPageVO;
import com.huaweicloud.blog.module.agent.vo.AgentSaveResultVO;
import com.huaweicloud.blog.module.agent.vo.AgentUserProfileVO;
import com.huaweicloud.blog.module.agent.vo.AgentUserStatVO;
import com.huaweicloud.blog.module.blog.dto.BlogSaveDTO;
import com.huaweicloud.blog.module.blog.dto.CommentSaveDTO;
import com.huaweicloud.blog.module.blog.entity.Blog;
import com.huaweicloud.blog.module.blog.entity.BlogComment;
import com.huaweicloud.blog.module.blog.entity.BlogFavorite;
import com.huaweicloud.blog.module.blog.entity.BlogUser;
import com.huaweicloud.blog.module.blog.service.BlogCommentService;
import com.huaweicloud.blog.module.blog.service.BlogDraftService;
import com.huaweicloud.blog.module.blog.service.BlogFavoriteService;
import com.huaweicloud.blog.module.blog.service.BlogFollowService;
import com.huaweicloud.blog.module.blog.service.BlogService;
import com.huaweicloud.blog.module.blog.service.BlogUserService;
import com.huaweicloud.blog.module.blog.vo.CommentItemVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Agent 用户面聚合能力：复用现有博客/评论/草稿/用户 Service，产出 Agent 契约的返回结构。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentBlogFacade {

    private static final int PUBLISHED = 2;
    private static final int ONLINE = 1;
    private static final long CREATE_IDEMPOTENT_SECONDS = 30;

    private final BlogService blogService;
    private final BlogCommentService blogCommentService;
    private final BlogDraftService blogDraftService;
    private final BlogUserService blogUserService;
    private final BlogFavoriteService blogFavoriteService;
    private final BlogFollowService blogFollowService;
    private final StringRedisTemplate redisTemplate;

    @Value("${blog.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${server.servlet.context-path:}")
    private String contextPath;

    // ---------- 博客 ----------

    public AgentPageVO<AgentBlogItemVO> listBlogs(Integer type, long pageNo, long pageSize, String keyWord) {
        IPage<Blog> page = blogService.lambdaQuery()
                .eq(Blog::getStatus, PUBLISHED)
                .eq(Blog::getOnline, ONLINE)
                .like(StringUtils.hasText(keyWord), Blog::getTitle, keyWord)
                .orderByDesc(Blog::getCreateTime)
                .page(new Page<>(pageNo, pageSize));
        List<AgentBlogItemVO> items = new ArrayList<>();
        for (Blog blog : page.getRecords()) {
            items.add(toItem(blog));
        }
        return AgentPageVO.of(page.getTotal(), pageNo, pageSize, items);
    }

    public AgentPageVO<AgentBlogItemVO> myBlogs(Integer status, long pageNo, long pageSize, Long userId) {
        IPage<Blog> page = blogService.lambdaQuery()
                .eq(Blog::getAuthorId, userId)
                .eq(status != null, Blog::getStatus, status)
                .orderByDesc(Blog::getCreateTime)
                .page(new Page<>(pageNo, pageSize));
        return AgentPageVO.of(page.getTotal(), pageNo, pageSize, toItems(page.getRecords()));
    }

    public AgentPageVO<AgentBlogItemVO> favorites(long pageNo, long pageSize, Long userId) {
        IPage<BlogFavorite> favPage = blogFavoriteService.lambdaQuery()
                .eq(BlogFavorite::getUserId, userId)
                .orderByDesc(BlogFavorite::getCreateTime)
                .page(new Page<>(pageNo, pageSize));
        List<Long> ids = favPage.getRecords().stream().map(BlogFavorite::getBlogId).toList();
        List<AgentBlogItemVO> items = new ArrayList<>();
        if (!ids.isEmpty()) {
            Map<Long, Blog> map = blogService.listByIds(ids).stream()
                    .collect(Collectors.toMap(Blog::getId, b -> b));
            for (Long id : ids) {
                Blog blog = map.get(id);
                if (blog != null) {
                    items.add(toItem(blog));
                }
            }
        }
        return AgentPageVO.of(favPage.getTotal(), pageNo, pageSize, items);
    }

    @Transactional(rollbackFor = Exception.class)
    public AgentBlogDetailVO detail(String ref, boolean logView, Long userId) {
        Blog blog = findBlog(ref);
        if (blog == null) {
            throw new BusinessException(ErrorCode.BLOG_NOT_FOUND);
        }
        boolean published = Objects.equals(blog.getStatus(), PUBLISHED) && Objects.equals(blog.getOnline(), ONLINE);
        boolean owner = Objects.equals(blog.getAuthorId(), userId);
        if (!published && !owner) {
            throw new BusinessException(ErrorCode.BLOG_NOT_FOUND);
        }
        if (logView) {
            blogService.lambdaUpdate().eq(Blog::getId, blog.getId())
                    .setSql("view_nums = view_nums + 1").update();
            blog.setViewNums((blog.getViewNums() == null ? 0 : blog.getViewNums()) + 1);
        }
        AgentBlogDetailVO vo = new AgentBlogDetailVO();
        vo.setRef(RefUtil.blogRef(blog.getId()));
        vo.setTitle(blog.getTitle());
        vo.setContent(blog.getContent());
        vo.setIntro(blog.getIntro());
        vo.setCoverUrl(blog.getCoverUrl());
        vo.setAuthorUid(blog.getAuthorUid());
        vo.setAuthorName(blog.getAuthorName());
        vo.setCreateTime(toEpoch(blog.getCreateTime()));
        vo.setStatus(blog.getStatus());
        vo.setOnline(blog.getOnline());
        vo.setIsTop(blog.getIsTop());
        vo.setReviewRemark(blog.getReviewRemark());
        vo.setViewNums(blog.getViewNums());
        vo.setCommNums(blog.getCommNums());
        vo.setVoteNums(blog.getVoteNums());
        return vo;
    }

    public AgentSaveResultVO save(AgentBlogSaveDTO dto, Long userId) {
        if (!StringUtils.hasText(dto.getRef())) {
            if (!StringUtils.hasText(dto.getTitle())) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "标题不能为空");
            }
            if (!StringUtils.hasText(dto.getContent())) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "正文不能为空");
            }
            checkCreateIdempotent(userId, dto.getTitle());
            BlogSaveDTO save = new BlogSaveDTO();
            save.setTitleData(dto.getTitle());
            save.setContentData(dto.getContent());
            save.setIntroData(dto.getIntro());
            save.setLitimgUrl(dto.getCoverUrl());
            save.setBlogResource("original");
            save.setAllowReship("yes");
            Long id = blogService.saveBlog(save, userId);
            return new AgentSaveResultVO(RefUtil.blogRef(id), String.valueOf(id));
        }
        Blog blog = findBlog(dto.getRef());
        if (blog == null) {
            throw new BusinessException(ErrorCode.BLOG_NOT_FOUND);
        }
        if (!Objects.equals(blog.getAuthorId(), userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权限编辑该博客");
        }
        BlogSaveDTO save = new BlogSaveDTO();
        save.setBlogId(dto.getRef());
        save.setTitleData(StringUtils.hasText(dto.getTitle()) ? dto.getTitle() : blog.getTitle());
        save.setContentData(StringUtils.hasText(dto.getContent()) ? dto.getContent() : blog.getContent());
        save.setIntroData(StringUtils.hasText(dto.getIntro()) ? dto.getIntro() : blog.getIntro());
        save.setLitimgUrl(StringUtils.hasText(dto.getCoverUrl()) ? dto.getCoverUrl() : blog.getCoverUrl());
        save.setBlogResource(blog.getBlogResource());
        save.setAllowReship(Objects.equals(blog.getAllowReship(), 1) ? "yes" : "no");
        Long id = blogService.saveBlog(save, userId);
        return new AgentSaveResultVO(RefUtil.blogRef(id), String.valueOf(id));
    }

    public void deleteBlog(String ref, Long userId) {
        blogService.deleteBlog(ref, userId);
    }

    public void vote(String ref, Integer operationType, Long userId) {
        blogService.operate(ref, 1, operationType == null ? 1 : operationType, userId);
    }

    public void favorite(String ref, Integer operationType, Long userId) {
        blogService.operate(ref, 2, operationType == null ? 1 : operationType, userId);
    }

    public void follow(String authorUid, Integer operationType, Long userId) {
        blogFollowService.toggleFollow(userId, authorUid, operationType != null && operationType == 1);
    }

    // ---------- 评论 ----------

    public AgentCommentListVO listComments(String id, Integer level, long pageNo, long pageSize) {
        AgentCommentListVO vo = new AgentCommentListVO();
        if (level != null && level == 2) {
            Long parentId = RefUtil.parseId(id);
            if (parentId == null) {
                vo.setTotal(0);
                vo.setList(Collections.emptyList());
                return vo;
            }
            IPage<BlogComment> page = blogCommentService.lambdaQuery()
                    .eq(BlogComment::getParentId, parentId)
                    .eq(BlogComment::getOnline, ONLINE)
                    .orderByAsc(BlogComment::getCreateTime)
                    .page(new Page<>(pageNo, pageSize));
            vo.setTotal(page.getTotal());
            vo.setList(toCommentItems(page.getRecords()));
            return vo;
        }
        Long blogId = RefUtil.parseId(id);
        if (blogId == null) {
            vo.setTotal(0);
            vo.setList(Collections.emptyList());
            return vo;
        }
        IPage<BlogComment> page = blogCommentService.lambdaQuery()
                .eq(BlogComment::getBlogId, blogId)
                .eq(BlogComment::getParentId, 0L)
                .eq(BlogComment::getOnline, ONLINE)
                .orderByDesc(BlogComment::getCreateTime)
                .page(new Page<>(pageNo, pageSize));
        List<AgentCommentItemVO> items = new ArrayList<>();
        for (BlogComment root : page.getRecords()) {
            AgentCommentItemVO item = toCommentItem(root);
            List<BlogComment> children = blogCommentService.lambdaQuery()
                    .eq(BlogComment::getParentId, root.getId())
                    .eq(BlogComment::getOnline, ONLINE)
                    .orderByAsc(BlogComment::getCreateTime)
                    .list();
            item.setChildren(toCommentItems(children));
            items.add(item);
        }
        vo.setTotal(page.getTotal());
        vo.setList(items);
        return vo;
    }

    public String addComment(String blogRef, String content, String parentId, Long userId) {
        CommentSaveDTO dto = new CommentSaveDTO();
        dto.setSrcContentID(blogRef);
        dto.setCommContent(content);
        if (StringUtils.hasText(parentId) && !"0".equals(parentId)) {
            dto.setGrade(2);
            dto.setParentID(parentId);
        } else {
            dto.setGrade(1);
        }
        CommentItemVO item = blogCommentService.addComment(dto, userId);
        return item == null ? null : item.getId();
    }

    public void editComment(String commentId, String content, Long userId) {
        blogCommentService.editComment(commentId, content, userId);
    }

    public void deleteComment(String commentId, Long userId) {
        blogCommentService.deleteComment(commentId, userId);
    }

    // ---------- 草稿 ----------

    public List<com.huaweicloud.blog.module.agent.vo.AgentDraftVO> listDrafts(Long userId) {
        List<com.huaweicloud.blog.module.agent.vo.AgentDraftVO> result = new ArrayList<>();
        var resp = blogDraftService.listDrafts(userId);
        if (resp == null || resp.getDraftList() == null) {
            return result;
        }
        for (var wrap : resp.getDraftList()) {
            var d = wrap.getDraftVo();
            if (d == null) {
                continue;
            }
            com.huaweicloud.blog.module.agent.vo.AgentDraftVO vo =
                    new com.huaweicloud.blog.module.agent.vo.AgentDraftVO();
            vo.setId(d.getDraftID());
            vo.setTitle(d.getDraftTitle());
            vo.setContent(d.getDraftContent());
            vo.setUpdateTime(d.getDraftUpdateTime());
            result.add(vo);
        }
        return result;
    }

    public String saveDraft(String draftId, String title, String content, Long userId) {
        if (!StringUtils.hasText(content)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "正文不能为空");
        }
        com.huaweicloud.blog.module.blog.dto.DraftSaveDTO dto =
                new com.huaweicloud.blog.module.blog.dto.DraftSaveDTO();
        dto.setDraftID(draftId);
        dto.setTitle(title);
        dto.setContent(content);
        return blogDraftService.saveDraft(userId, dto);
    }

    public void deleteDraft(String draftId, Long userId) {
        blogDraftService.deleteDraft(userId, draftId);
    }

    // ---------- 用户 ----------

    public AgentUserProfileVO profile(Long userId) {
        BlogUser user = blogUserService.getById(userId);
        AgentUserProfileVO vo = new AgentUserProfileVO();
        if (user != null) {
            vo.setUid(user.getUid());
            vo.setMemAlias(user.getMemAlias());
            vo.setMemName(user.getMemName());
            vo.setMemPhoto(user.getMemPhoto());
        }
        return vo;
    }

    public AgentUserStatVO stat(Long userId) {
        AgentUserStatVO vo = new AgentUserStatVO();
        long count = blogService.lambdaQuery()
                .eq(Blog::getAuthorId, userId)
                .eq(Blog::getStatus, PUBLISHED)
                .count();
        List<Blog> blogs = blogService.lambdaQuery()
                .eq(Blog::getAuthorId, userId)
                .eq(Blog::getStatus, PUBLISHED)
                .select(Blog::getViewNums, Blog::getVoteNums)
                .list();
        vo.setBlogCount(count);
        vo.setViewTotal(blogs.stream().mapToLong(b -> b.getViewNums() == null ? 0 : b.getViewNums()).sum());
        vo.setVoteTotal(blogs.stream().mapToLong(b -> b.getVoteNums() == null ? 0 : b.getVoteNums()).sum());
        return vo;
    }

    // ---------- 文件 ----------

    public AgentFileVO uploadFile(String name, String contentBase64) {
        if (!StringUtils.hasText(contentBase64)) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, "上传内容为空");
        }
        String b64 = contentBase64;
        int comma = b64.indexOf(',');
        if (b64.startsWith("data:") && comma > 0) {
            b64 = b64.substring(comma + 1);
        }
        byte[] data;
        try {
            data = Base64.getDecoder().decode(b64.trim());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, "base64 内容无效");
        }
        if (data.length == 0) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, "上传内容为空");
        }
        String ext = extensionOf(name);
        String stored = UUID.randomUUID().toString().replace("-", "") + ext;
        try {
            Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(root);
            Files.write(root.resolve(stored), data);
        } catch (Exception e) {
            log.warn("Agent file upload failed: {}", e.getMessage());
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, "文件保存失败");
        }
        AgentFileVO vo = new AgentFileVO();
        vo.setUrl(contextPath + "/file/" + stored);
        return vo;
    }

    // ---------- helpers ----------

    private void checkCreateIdempotent(Long userId, String title) {
        try {
            String key = "agent:blog:idem:" + IdempotencyUtil.generateKey(String.valueOf(userId), title);
            Boolean first = redisTemplate.opsForValue()
                    .setIfAbsent(key, "1", CREATE_IDEMPOTENT_SECONDS, TimeUnit.SECONDS);
            if (Boolean.FALSE.equals(first)) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "检测到重复提交，请稍后重试");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Idempotency check skipped: {}", e.getMessage());
        }
    }

    private Blog findBlog(String ref) {
        Long id = RefUtil.parseId(ref);
        return id == null ? null : blogService.getById(id);
    }

    private List<AgentBlogItemVO> toItems(List<Blog> blogs) {
        List<AgentBlogItemVO> items = new ArrayList<>();
        for (Blog blog : blogs) {
            items.add(toItem(blog));
        }
        return items;
    }

    private AgentBlogItemVO toItem(Blog blog) {
        AgentBlogItemVO vo = new AgentBlogItemVO();
        vo.setRef(RefUtil.blogRef(blog.getId()));
        vo.setTitle(blog.getTitle());
        vo.setIntro(blog.getIntro());
        vo.setCoverUrl(blog.getCoverUrl());
        vo.setAuthorName(blog.getAuthorName());
        vo.setAuthorUid(blog.getAuthorUid());
        vo.setViewNums(blog.getViewNums());
        vo.setCommNums(blog.getCommNums());
        vo.setVoteNums(blog.getVoteNums());
        vo.setCreateTime(toEpoch(blog.getCreateTime()));
        return vo;
    }

    private List<AgentCommentItemVO> toCommentItems(List<BlogComment> comments) {
        List<AgentCommentItemVO> items = new ArrayList<>();
        for (BlogComment c : comments) {
            items.add(toCommentItem(c));
        }
        return items;
    }

    private AgentCommentItemVO toCommentItem(BlogComment c) {
        AgentCommentItemVO vo = new AgentCommentItemVO();
        vo.setId(String.valueOf(c.getId()));
        vo.setBlogRef(RefUtil.blogRef(c.getBlogId()));
        vo.setContent(c.getContent());
        vo.setAuthorName(c.getAuthorName());
        vo.setAuthorPhoto(c.getAuthorPhoto());
        vo.setCreateTime(toEpoch(c.getCreateTime()));
        vo.setStatus(stateToStatus(c.getState()));
        return vo;
    }

    /** 评论 state（2/4/6）→ 对外 status（1/2/3）。 */
    private Integer stateToStatus(Integer state) {
        if (state == null) {
            return null;
        }
        return switch (state) {
            case 2 -> 1;
            case 4 -> 2;
            case 6 -> 3;
            default -> state;
        };
    }

    private String extensionOf(String filename) {
        if (!StringUtils.hasText(filename)) {
            return "";
        }
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) {
            return "";
        }
        String ext = filename.substring(idx).toLowerCase();
        return ext.length() <= 10 ? ext : "";
    }

    private long toEpoch(LocalDateTime time) {
        return time == null ? 0 : time.atZone(ZoneId.systemDefault()).toEpochSecond();
    }
}