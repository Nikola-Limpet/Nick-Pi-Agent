import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const REVIEW_PROMPT = String.raw`You are a senior Frontend React code reviewer. Review the target code or changes with a bug-finding mindset and React best-practice standards.

Target to review:
$TARGET

If no target is provided, inspect the current project and prefer reviewing staged/uncommitted changes (for example, git diff / git diff --cached) before broader source files.

Review priorities:
1. Correctness and bugs: runtime crashes, stale closures, bad state updates, race conditions, missing cleanup, incorrect dependency arrays, null/undefined errors, invalid assumptions, edge cases.
2. React best practices: component boundaries, hooks rules, effect usage, memoization only where useful, controlled/uncontrolled inputs, key stability, prop/state design, error boundaries where appropriate.
3. TypeScript quality: unsafe any, wrong types, missing discriminated unions, weak API contracts, non-null assertions, incorrect generics.
4. Accessibility: keyboard support, semantic HTML, labels, focus management, ARIA correctness, color/contrast risks.
5. Performance: unnecessary renders, expensive work in render, bundle bloat, large dependencies, unstable callbacks/objects passed to memoized children.
6. Security and data handling: XSS, dangerouslySetInnerHTML, unsafe URL handling, leaking secrets/tokens, unsafe localStorage/sessionStorage usage.
7. Testing: missing critical tests, brittle tests, untested edge cases, suggested test cases.
8. Maintainability: readability, duplicated logic, confusing abstractions, file structure, naming.

Output format:
- Overall score: X/100
- Risk level: Low / Medium / High / Critical
- Summary: 2-4 bullets
- Findings table with columns: Severity, Score impact, Location, Issue, Why it matters, Fix
- Fix plan: numbered step-by-step actions, ordered by risk and effort
- Suggested tests: concrete test names/scenarios
- If everything looks good, still mention minor improvements and why the score is not 100.

Scoring rubric:
- Start at 100.
- Critical bug/security issue: -20 to -35 each.
- High severity correctness/accessibility issue: -10 to -20 each.
- Medium maintainability/performance/test issue: -4 to -10 each.
- Low/nit issue: -1 to -3 each.
Be strict but fair. Do not invent issues; cite exact files/lines when possible.`;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("react-review", {
    description: "Review React frontend code, catch bugs, score it, and provide fix steps",
    handler: async (args, ctx) => {
      const target = args.trim() || "No explicit target provided.";
      const prompt = REVIEW_PROMPT.replace("$TARGET", target);

      if (ctx.isIdle()) {
        pi.sendUserMessage(prompt);
      } else {
        pi.sendUserMessage(prompt, { deliverAs: "followUp" });
        ctx.ui.notify("React code review queued as a follow-up.", "info");
      }
    },
  });
}
