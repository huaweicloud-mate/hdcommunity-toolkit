// Growth-center USER-FACE tools (hdgrow_user_*) — parallel to the blog user face.
//
// Auth: AK/SK (callGrow), same as blog user face. The fronting gateway resolves the
// caller's identity from AK/SK and injects headers (X-User-Id / X-User-Name); the
// backend trusts those headers. Paths: /agent/user/grow/**.

import { callGrow } from './http-client.mjs';
import { GROW_USER } from './grow-endpoints.mjs';
import { guardWrite } from './grow-tools.mjs';
import { fail, CODES } from '../errors.mjs';

const P = {
  int: (d) => ({ type: 'integer', description: d }),
  str: (d) => ({ type: 'string', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
};

export const GROW_USER_TOOLS = {
  definitions: [
    {
      name: 'hdgrow_user_info',
      description: 'Get my growth profile (auto-provisioned from gateway identity). 我的成长信息。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_user_tasks',
      description: 'My tasks with is_finish/completed_times/task_limit and steps. 我的任务（含完成状态）。',
      inputSchema: {
        type: 'object',
        properties: {
          category_id: P.str('任务分类筛选（可选）'),
          biz_type: P.str('业务类型筛选（可选）'),
          show: P.bool('is_show 筛选（可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
        },
      },
    },
    {
      name: 'hdgrow_user_prizes',
      description: 'My prizes with per-user exchange fields (exchangeable/max_quantity). 我的权益（含可兑字段）。',
      inputSchema: {
        type: 'object',
        properties: { page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 10') },
      },
    },
    {
      name: 'hdgrow_user_sign_in',
      description: 'Daily sign-in (main account only). 签到。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_user_sign_in_status',
      description: 'Whether signed in today. 今日签到状态。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_user_points_detail',
      description: 'My points-detail records (paginated). 我的积分明细。',
      inputSchema: {
        type: 'object',
        properties: { page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 10') },
      },
    },
    {
      name: 'hdgrow_user_exchange_records',
      description: 'My coupon exchange records (paginated). 我的兑换记录。',
      inputSchema: {
        type: 'object',
        properties: { page_no: P.int('页码，默认 1'), page_size: P.int('每页条数，默认 10') },
      },
    },
    {
      name: 'hdgrow_user_prize_exchange',
      description:
        'Exchange a prize for MYSELF (money-sensitive; previews by default). 本人自助兑换（写，默认预演）。',
      inputSchema: {
        type: 'object',
        required: ['prize_id', 'biz_id'],
        properties: {
          prize_id: P.str('权益(代金券)ID'),
          biz_id: P.str('产品侧唯一单号（幂等键，必填）'),
          quantity: P.int('单次数量，默认 1，最小 1'),
          dry_run: P.bool('默认 true=仅预演（不执行）；false=执行（需 confirm_token）'),
          confirm_token: P.str('预演返回的确认令牌（执行时必传）'),
          confirm_high_risk: P.bool('数量超阈值时必须为 true'),
          reason: P.str('用途/审批说明（高风险时必填）'),
        },
      },
    },
  ],

  call: {
    'hdgrow_user_info': () => callGrow('GET', GROW_USER.info),
    'hdgrow_user_tasks': (a) =>
      callGrow('POST', GROW_USER.tasks, {
        body: {
          category_id: a.category_id,
          biz_type: a.biz_type,
          show: a.show,
          page_no: a.page_no,
          page_size: a.page_size,
        },
      }),
    'hdgrow_user_prizes': (a) =>
      callGrow('POST', GROW_USER.prizes, { body: { page_no: a.page_no, page_size: a.page_size } }),
    'hdgrow_user_sign_in': () => callGrow('POST', GROW_USER.signIn),
    'hdgrow_user_sign_in_status': () => callGrow('POST', GROW_USER.signInStatus),
    'hdgrow_user_points_detail': (a) =>
      callGrow('GET', GROW_USER.pointsDetail, { query: { page_no: a.page_no, page_size: a.page_size } }),
    'hdgrow_user_exchange_records': (a) =>
      callGrow('GET', GROW_USER.exchangeRecords, { query: { page_no: a.page_no, page_size: a.page_size } }),

    'hdgrow_user_prize_exchange': (a) => {
      if (!a.biz_id || !String(a.biz_id).trim()) {
        return fail(CODES.PARAM_ERROR, 'biz_id 必填（幂等键）：兑换重试须复用同一 biz_id');
      }
      const quantity = a.quantity === undefined || a.quantity === null ? 1 : Number(a.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return fail(CODES.PARAM_ERROR, 'quantity 必须为 ≥1 的整数');
      }
      const body = { prize_id: a.prize_id, biz_id: a.biz_id, quantity };
      const hits = quantity > 10 ? [{ name: 'quantity>10', value: quantity }] : [];
      return guardWrite(
        {
          action: 'user_prize_exchange',
          method: 'POST',
          endpoint: GROW_USER.prizeExchange,
          body,
          money: { quantity, note: '本人兑换；扣积分=积分价×quantity，发券由后端处理' },
          hits,
        },
        a,
        () => callGrow('POST', GROW_USER.prizeExchange, { body }),
      );
    },
  },
};
