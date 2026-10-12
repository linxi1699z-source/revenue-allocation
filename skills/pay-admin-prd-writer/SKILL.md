---
name: pay-admin-prd-writer
description: Generate or edit backend product requirements documents in the user's payment management PRD style. Use when drafting PRDs, requirement specs, field definitions, prototype-linked feature descriptions, state flows, idempotency rules, duplicate blocking rules, non-functional requirements, multilingual requirements, tracking plans, project planning, or review/signoff sections for payment/admin/business backend modules.
---

# Pay Admin PRD Writer

Use this skill to write backend PRDs that match the structure and writing style extracted from `支付管理后台PRD(续订）.md`.

## Required Reference

Read `references/prd-rules.md` before drafting or editing a PRD. It contains the required title hierarchy, section purpose, field-table format, interaction description rules, validation rules, and acceptance checklist.

## Workflow

1. Identify the target business module, reader, document version, author, date, and prototype links.
2. If information is missing, use `待补充` instead of inventing details unless the user explicitly asks for reasonable assumptions.
3. Generate the PRD with the required first-level sections:
   - 版本信息
   - 文档说明
   - 需求背景
   - 目标与关键指标（KPI）
   - 功能详细说明
   - 非功能需求
   - 多语言
   - 埋点
   - 产品项目规划（从调研、计划到转入开发）
   - 审批与签名
4. In `功能详细说明`, include `主要功能范围`、`产品流程图`、`交互原型`、`功能说明`.
5. For each prototype page, describe:
   - 页面目标和入口
   - 搜索条件、按钮、列表字段、表单字段
   - 弹窗和动态面板交互
   - 状态流转和页面跳转
   - 字段限制、必填校验、重复拦截、幂等规则
   - 异常提示和权限/审计要求
6. Prefer Markdown tables for field definitions and state mappings. Use numbered rules inside table cells for complex logic.
7. Keep wording product-facing and implementation-ready: concise, explicit, and testable.

## Output Rules

- Preserve the user's section order unless they request a shorter document.
- Use Chinese headings and business terms by default.
- Use backend/API field names in snake_case when fields map to data storage or interface payloads.
- Mark unknown values as `待补充`.
- Do not omit edge cases that affect data correctness: status changes, repeated submits, callback duplication, retries, partial failures, and permission boundaries.

