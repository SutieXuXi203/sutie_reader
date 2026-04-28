# Black Myth: Wukong

## Mission
Create implementation-ready, token-driven UI guidance for Black Myth: Wukong that is optimized for consistency, accessibility, and fast delivery across content site.

## Brand
- Product/brand: Black Myth: Wukong
- URL: https://gamesci.cn/wukong/
- Audience: readers and knowledge seekers
- Product surface: content site

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=CrimsonPro`, `font.family.stack=CrimsonPro, Garamond, Times New Roman, PingFang SC, Source Han Sans SC, Noto Sans CJK SC, Helvetica Neue, WenQuanYi Micro Hei, Microsoft YaHei, Arial, sans-serif, BlinkMacSystemFont`, `font.size.base=20px`, `font.weight.base=400`, `font.lineHeight.base=normal`
- Typography scale: `font.size.xs=14px`, `font.size.sm=16px`, `font.size.md=17px`, `font.size.lg=20px`, `font.size.xl=64px`, `font.size.2xl=100px`
- Color palette: `color.surface.base=#000000`, `color.text.secondary=#686868`, `color.text.tertiary=#dfdad3`, `color.text.inverse=#0e6f61`, `color.surface.muted=#b5b4b2`
- Spacing scale: `space.1=11px`, `space.2=15px`, `space.3=129.31px`, `space.4=129.33px`
- Radius/shadow/motion tokens: No reliable extraction yet; motion and shape tokens should be defined manually.

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: buttons (13), inputs (4), links (2).

- Extraction diagnostics: Low sample size: fewer than 30 visible elements were extracted. Audience and product surface inference confidence is low; verify generated brand context.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
