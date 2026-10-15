import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";

interface AnimatedBackgroundProps {
  /** Force a theme. If omitted, it follows the page (data-theme / .dark / .light / system). */
  theme?: Theme;
  /** Fine film grain on top of the ribbons. */
  grain?: boolean;
}

const BG: Record<Theme, string> = { dark: "#0a1020", light: "#f4f6fc" };

// [start colour, end colour] as "r,g,b" for each ribbon
const RIBBONS: [string, string][] = [
  ["124,92,255", "56,189,248"],
  ["56,189,248", "99,102,241"],
  ["236,72,153", "124,92,255"],
  ["99,102,241", "34,211,238"],
  ["124,92,255", "236,72,153"],
];

function detectTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  for (const el of [document.documentElement, document.body]) {
    const attr = el.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    if (el.classList.contains("light")) return "light";
    if (el.classList.contains("dark")) return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function makeNoise(): string {
  if (typeof document === "undefined") return "";
  const n = document.createElement("canvas");
  n.width = n.height = 128;
  const x = n.getContext("2d");
  if (!x) return "";
  const d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return n.toDataURL();
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  theme: Theme,
  count: number,
  step: number,
) {
  const dark = theme === "dark";

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG[theme];
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = dark ? "lighter" : "multiply";

  for (let i = 0; i < count; i++) {
    const [c0, c1] = RIBBONS[i];
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(${c0},0)`);
    g.addColorStop(0.3, `rgba(${c0},.5)`);
    g.addColorStop(0.7, `rgba(${c1},.5)`);
    g.addColorStop(1, `rgba(${c1},0)`);

    const top: [number, number][] = [];
    const bot: [number, number][] = [];
    for (let x = 0; x <= w + step; x += step) {
      const cy =
        h * 0.52 +
        Math.sin(x * 0.0042 + t * 0.00032 + i * 1.1) * h * 0.2 +
        Math.sin(x * 0.009 - t * 0.0004 + i * 2) * h * 0.07;
      const th = 24 + 70 * Math.pow(Math.sin(x * 0.0048 + i * 0.9 + t * 0.0002), 2);
      top.push([x, cy - th / 2]);
      bot.push([x, cy + th / 2]);
    }

    ctx.beginPath();
    top.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    for (let k = bot.length - 1; k >= 0; k--) ctx.lineTo(bot[k][0], bot[k][1]);
    ctx.closePath();
    ctx.globalAlpha = dark ? 0.34 : 0.2;
    ctx.fillStyle = g;
    ctx.fill();

    ctx.globalAlpha = dark ? 0.8 : 0.5;
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    top.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  // soft vignette so the edges settle into the page background
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const rgb = dark ? "10,16,32" : "244,246,252";
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  v.addColorStop(0, `rgba(${rgb},0)`);
  v.addColorStop(1, `rgba(${rgb},${dark ? 0.75 : 0.65})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

export default function AnimatedBackground({ theme: forced, grain = true }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detected, setDetected] = useState<Theme>(detectTheme);
  const [noise] = useState(makeNoise);

  const theme = forced ?? detected;
  const themeRef = useRef<Theme>(theme);
  const repaintRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    themeRef.current = theme;
    repaintRef.current?.();
  }, [theme]);

  // follow the site's theme toggle
  useEffect(() => {
    if (forced) return;
    const update = () => setDetected(detectTheme());
    const mo = new MutationObserver(update);
    const opts = { attributes: true, attributeFilter: ["class", "data-theme"] };
    mo.observe(document.documentElement, opts);
    mo.observe(document.body, opts);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", update);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", update);
    };
  }, [forced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let running = false;

    const small = () => w < 640;
    const paint = (t: number) =>
      draw(ctx, w, h, t, themeRef.current, small() ? 3 : 5, small() ? 12 : 8);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(reduce.matches ? 4000 : performance.now());
    };

    const frame = (t: number) => {
      if (t - last >= (small() ? 33 : 16)) {
        last = t;
        paint(t);
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running || reduce.matches || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => {
      stop();
      resize();
      start();
    };

    repaintRef.current = () => paint(reduce.matches ? 4000 : performance.now());
    resize();
    start();

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener("change", onMotion);
    return () => {
      stop();
      repaintRef.current = null;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onMotion);
    };
  }, []);

  const layer = {
    position: "fixed",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
  } as const;

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" style={{ ...layer, width: "100%", height: "100%" }} />
      {grain && noise && (
        <div
          aria-hidden="true"
          style={{
            ...layer,
            opacity: theme === "dark" ? 0.07 : 0.05,
            mixBlendMode: "overlay",
            backgroundImage: `url(${noise})`,
          }}
        />
      )}
    </>
  );
}
