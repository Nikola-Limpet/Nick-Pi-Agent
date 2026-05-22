import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const RESET = "\x1b[0m";
const CYAN = [78, 205, 196] as const;
const SAGE = [143, 188, 143] as const;
const MUTED = [125, 133, 144] as const;
const DIM = [88, 96, 105] as const;
const TEXT = [230, 237, 243] as const;

type Rgb = readonly [number, number, number];

type FooterData = {
  getGitBranch?: () => string | null;
  getExtensionStatuses?: () => ReadonlyMap<string, string>;
  onBranchChange?: (callback: () => void) => () => void;
};

function fg([r, g, b]: Rgb, text: string) {
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

function part(label: string, value: string, color: Rgb = CYAN) {
  return `${fg(color, label)} ${fg(TEXT, value)}`;
}

function fmtNumber(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function projectLabel() {
  const cwd = process.cwd();
  const home = process.env.HOME;
  if (home && cwd === home) return "~";
  if (home && cwd.startsWith(`${home}/`)) return `~/${path.relative(home, cwd) || path.basename(cwd)}`;
  return path.basename(cwd) || cwd;
}

function usageStats(ctx: ExtensionContext) {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;

  for (const entry of ctx.sessionManager.getBranch()) {
    const message = (entry as any).message;
    if ((entry as any).type !== "message" || message?.role !== "assistant") continue;
    const usage = message.usage ?? {};
    input += Number(usage.input ?? usage.inputTokens ?? 0);
    output += Number(usage.output ?? usage.outputTokens ?? 0);
    cacheRead += Number(usage.cacheRead ?? usage.cache_read ?? usage.cacheReadInputTokens ?? 0);
    cacheWrite += Number(usage.cacheWrite ?? usage.cache_write ?? usage.cacheCreationInputTokens ?? 0);
    cost += Number(usage.cost?.total ?? usage.cost ?? 0);
  }

  const total = input + output + cacheRead + cacheWrite;
  const window = Number((ctx.model as any)?.contextWindow ?? 0);
  const pct = window > 0 ? `${Math.min(100, (total / window) * 100).toFixed(1)}%` : "auto";

  return {
    tokens: `↑${fmtNumber(input)} ↓${fmtNumber(output)}`,
    cache: cacheRead || cacheWrite ? ` R${fmtNumber(cacheRead)}` : "",
    cost: `$${cost.toFixed(3)}`,
    context: pct,
  };
}

function statusText(footerData: FooterData) {
  const statuses = footerData.getExtensionStatuses?.();
  if (!statuses || statuses.size === 0) return "";
  return [...statuses.values()][0] ?? "";
}

function compactPath(value: string) {
  const parts = value.split("/").filter(Boolean);
  if (value.startsWith("~/") && parts.length > 2) return `~/${parts.at(-2)}/${parts.at(-1)}`;
  if (parts.length > 3) return `…/${parts.at(-2)}/${parts.at(-1)}`;
  return value;
}

function fit(left: string, right: string, width: number) {
  const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
  if (gap > 1) return truncateToWidth(left + " ".repeat(gap) + right, width);
  const leftWidth = Math.max(0, width - visibleWidth(right) - 1);
  return truncateToWidth(left, leftWidth) + " " + right;
}

export default function (pi: ExtensionAPI) {
  let installed = false;
  let currentModel = "gpt-5.5";
  let thinking = "auto";
  let render: (() => void) | undefined;

  function install(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;
    installed = true;
    currentModel = ctx.model?.id ?? currentModel;

    ctx.ui.setFooter((tui, theme, footerData: FooterData) => {
      render = () => tui.requestRender(true);
      const disposeBranch = footerData.onBranchChange?.(() => tui.requestRender(true));

      return {
        dispose: disposeBranch,
        invalidate() {},
        render(width: number): string[] {
          const w = Math.max(20, width);
          const stats = usageStats(ctx);
          const branch = footerData.getGitBranch?.();
          const project = compactPath(branch ? `${projectLabel()}  ${branch}` : projectLabel());
          const status = statusText(footerData);
          const sep = fg(DIM, "  ·  ");

          const left = [
            fg(CYAN, "◆ Nick"),
            part("cwd", project),
            part("ctx", stats.context, SAGE),
            part("tok", stats.tokens, SAGE),
            stats.cache ? part("cache", stats.cache.trim(), MUTED) : "",
            part("cost", stats.cost, MUTED),
          ].filter(Boolean).join(sep);

          const right = [
            status ? fg(MUTED, status) : "",
            part("model", `${currentModel} · ${thinking}`, CYAN),
          ].filter(Boolean).join(sep);

          return [fit(left, right, w)];
        },
      };
    });
  }

  function uninstall(ctx: ExtensionContext) {
    installed = false;
    render = undefined;
    ctx.ui.setFooter(undefined);
  }

  pi.on("session_start", (_event, ctx) => install(ctx));

  pi.on("model_select", (event) => {
    currentModel = event.model.id;
    render?.();
  });

  pi.on("thinking_level_select", (event) => {
    thinking = event.level;
    render?.();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.hasUI && installed) uninstall(ctx);
  });

  pi.registerCommand("nick-footer", {
    description: "Enable Nick's custom compact footer",
    handler: async (_args, ctx) => {
      install(ctx);
      ctx.ui.notify("Nick footer enabled", "info");
    },
  });

  pi.registerCommand("nick-footer-off", {
    description: "Restore pi's built-in footer for this session",
    handler: async (_args, ctx) => {
      uninstall(ctx);
      ctx.ui.notify("Built-in footer restored", "info");
    },
  });
}
