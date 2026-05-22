import path from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const ITALIC = "\x1b[3m";

const TEAL: Rgb = [78, 205, 196];
const SAGE: Rgb = [143, 188, 143];
const AMBER: Rgb = [243, 156, 18];
const ROSE: Rgb = [199, 138, 122];
const PURPLE: Rgb = [155, 89, 182];
const BLUE: Rgb = [51, 153, 255];
const WHITE: Rgb = [238, 246, 255];
const ICE: Rgb = [182, 226, 255];
const PALETTE: Rgb[] = [TEAL, SAGE, AMBER, ROSE, PURPLE, BLUE, TEAL];
const LOADING_FRAMES = ["searching for a quote   ", "searching for a quote.  ", "searching for a quote.. ", "searching for a quote..."];

const QUOTE_FALLBACKS = [
  "Programs must be written for people to read, and only incidentally for machines to execute. — Harold Abelson",
  "Simplicity is prerequisite for reliability. — Edsger W. Dijkstra",
  "Make it work, make it right, make it fast. — Kent Beck",
  "The best way to predict the future is to invent it. — Alan Kay",
  "Stay hungry. Stay foolish. — Stewart Brand",
];

const TITLE_LINES = [
  "        ╭────────╮        ",
  "        │ ◉    ◉ │        ",
  "        │   ▿    │        ",
  "        ╰──┬──┬──╯        ",
  "           ╰──╯           ",
  "███╗   ██╗ ██╗  ██████╗██╗  ██╗",
  "████╗  ██║ ██║ ██╔════╝██║ ██╔╝",
  "██╔██╗ ██║ ██║ ██║     █████╔╝ ",
  "██║╚██╗██║ ██║ ██║     ██╔═██╗ ",
  "██║ ╚████║ ██║ ╚██████╗██║  ██╗",
  "╚═╝  ╚═══╝ ╚═╝  ╚═════╝╚═╝  ╚═╝",
];

type Rgb = [number, number, number];
type Renderable = {
  render(width: number): string[];
  invalidate?: () => void;
};

type QuotePayload = {
  content?: unknown;
  author?: unknown;
  q?: unknown;
  a?: unknown;
};

function mix(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function sampleGradient(position: number) {
  const wrapped = ((position % 1) + 1) % 1;
  const scaled = wrapped * PALETTE.length;
  const index = Math.floor(scaled);
  const nextIndex = (index + 1) % PALETTE.length;
  const t = scaled - index;
  const a = PALETTE[index]!;
  const b = PALETTE[nextIndex]!;
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)] as Rgb;
}

function fg([r, g, b]: Rgb, text: string) {
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

function gradientText(text: string, phase: number) {
  const chars = [...text];
  const span = Math.max(chars.length - 1, 1);
  return chars
    .map((char, index) => {
      if (char === " ") return char;
      return fg(sampleGradient(index / span + phase), char);
    })
    .join("");
}

function center(text: string, width: number) {
  const length = [...text].length;
  if (length >= width) return text;
  return `${" ".repeat(Math.floor((width - length) / 2))}${text}`;
}

function wrapText(text: string, width: number) {
  const maxWidth = Math.max(20, width);
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if ([...next].length <= maxWidth) {
      line = next;
      continue;
    }

    if (line) lines.push(line);

    if ([...word].length <= maxWidth) {
      line = word;
      continue;
    }

    const chars = [...word];
    while (chars.length > maxWidth) {
      lines.push(chars.splice(0, maxWidth).join(""));
    }
    line = chars.join("");
  }

  if (line) lines.push(line);
  return lines;
}

function brightQuoteText(text: string, phase: number) {
  const chars = [...text];
  const span = Math.max(chars.length - 1, 1);
  return chars
    .map((char, index) => {
      if (char === " ") return char;
      const wave = (Math.sin((index / span + phase * 2) * Math.PI * 2) + 1) / 2;
      const color: Rgb = [
        mix(ICE[0], WHITE[0], wave),
        mix(ICE[1], WHITE[1], wave),
        mix(ICE[2], WHITE[2], wave),
      ];
      return fg(color, char);
    })
    .join("");
}

function projectName() {
  return path.basename(process.cwd()) || "session";
}

function randomFallbackQuote() {
  return QUOTE_FALLBACKS[Math.floor(Math.random() * QUOTE_FALLBACKS.length)]!;
}

function parseQuote(value: unknown) {
  const payload = Array.isArray(value) ? value[0] : value;
  if (!payload || typeof payload !== "object") return undefined;

  const quote = payload as QuotePayload;
  const content = typeof quote.content === "string" ? quote.content : quote.q;
  const author = typeof quote.author === "string" ? quote.author : quote.a;

  if (typeof content !== "string" || content.trim() === "") return undefined;
  return author && typeof author === "string" && author.trim() !== ""
    ? `${content.trim()} — ${author.trim()}`
    : content.trim();
}

async function fetchRandomQuote(signal?: AbortSignal) {
  const endpoints = [
    "https://api.quotable.io/random?maxLength=96",
    "https://zenquotes.io/api/random",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) continue;
      const parsed = parseQuote(await response.json());
      if (parsed) return parsed;
    } catch {
      // Try the next endpoint, then fall back to a local quote.
    }
  }

  return randomFallbackQuote();
}

function renderHeader(
  width: number,
  phase: number,
  subtitleText: string,
  quote: string,
  quoteVisibleChars: number,
  quoteLoading: boolean,
) {
  const safeWidth = Math.max(width, 20);
  const lines = TITLE_LINES.map((line, row) =>
    gradientText(center(line, safeWidth), phase + row * 0.045),
  );
  const subtitle = center(subtitleText, safeWidth);
  const quoteWidth = Math.max(24, safeWidth - 10);
  const displayQuote = quoteLoading
    ? LOADING_FRAMES[Math.floor(phase * LOADING_FRAMES.length * 4) % LOADING_FRAMES.length]!
    : `“${[...quote].slice(0, quoteVisibleChars).join("")}${quoteVisibleChars < [...quote].length ? "▌" : "”"}`;
  const quoteLines = wrapText(displayQuote, quoteWidth).map((line) =>
    `${ITALIC}${brightQuoteText(center(line, safeWidth), phase + 0.25)}${RESET}`,
  );

  return [
    "",
    ...lines,
    `${BOLD}${gradientText(subtitle, phase + 0.18)}${RESET}`,
    ...quoteLines,
    "",
  ];
}

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | undefined;
  let animationTimer: ReturnType<typeof setInterval> | undefined;
  let quoteTimer: ReturnType<typeof setInterval> | undefined;
  let quoteAbort: AbortController | undefined;
  let currentModelId = "no model selected";
  let phase = 0;
  let currentQuote = "";
  let quoteVisibleChars = 0;
  let quoteLoading = true;

  function startAnimation() {
    if (animationTimer) return;
    animationTimer = setInterval(() => {
      phase = (phase + 0.012) % 1;
      if (!quoteLoading && quoteVisibleChars < [...currentQuote].length) {
        quoteVisibleChars = Math.min([...currentQuote].length, quoteVisibleChars + 2);
      }
      requestRender?.();
    }, 90);
  }

  function stopAnimation() {
    if (animationTimer) clearInterval(animationTimer);
    animationTimer = undefined;
  }

  async function refreshQuote() {
    quoteAbort?.abort();
    quoteAbort = new AbortController();
    quoteLoading = true;
    quoteVisibleChars = 0;
    requestRender?.();

    currentQuote = await fetchRandomQuote(quoteAbort.signal);
    quoteLoading = false;
    quoteVisibleChars = 0;
    requestRender?.();
  }

  function startQuoteRefresh() {
    void refreshQuote();
    if (quoteTimer) return;
    quoteTimer = setInterval(() => void refreshQuote(), 10 * 60 * 1000);
  }

  function stopQuoteRefresh() {
    quoteAbort?.abort();
    quoteAbort = undefined;
    if (quoteTimer) clearInterval(quoteTimer);
    quoteTimer = undefined;
  }

  function installHeader(ctx: ExtensionContext) {
    ctx.ui.setHeader((tui) => {
      requestRender = () => tui.requestRender(true);
      return {
        render(width: number) {
          return renderHeader(
            width,
            phase,
            `${currentModelId} · ${projectName()} · Nick's Agent`,
            currentQuote,
            quoteVisibleChars,
            quoteLoading,
          );
        },
        invalidate() {
          tui.requestRender(true);
        },
      } satisfies Renderable;
    });

    startAnimation();
    startQuoteRefresh();
  }

  function uninstallHeader(ctx: ExtensionContext) {
    stopAnimation();
    stopQuoteRefresh();
    requestRender = undefined;
    ctx.ui.setHeader(undefined);
  }

  pi.on("session_start", (_event, ctx) => {
    currentModelId = ctx.model?.id ?? "no model selected";
    if (!ctx.hasUI) return;
    installHeader(ctx);
  });

  pi.on("model_select", (event) => {
    currentModelId = event.model.id;
    requestRender?.();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.hasUI) uninstallHeader(ctx);
  });

  pi.registerCommand("flow-title", {
    description: "Enable the animated flowing gradient header with a fetched quote",
    handler: async (_args, ctx) => {
      installHeader(ctx);
      ctx.ui.notify("Animated flow title enabled", "info");
    },
  });

  pi.registerCommand("flow-title-quote", {
    description: "Fetch a fresh quote for the animated header",
    handler: async (_args, ctx) => {
      await refreshQuote();
      ctx.ui.notify("Fetched a fresh banner quote", "info");
    },
  });

  pi.registerCommand("flow-title-builtin", {
    description: "Restore pi's built-in header for this session",
    handler: async (_args, ctx) => {
      uninstallHeader(ctx);
      ctx.ui.notify("Built-in header restored", "info");
    },
  });
}
