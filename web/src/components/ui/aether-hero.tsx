"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The mount check never changes after hydration, so it has nothing to notify. */
const subscribeNever = () => () => {};

export type AetherHeroProps = {
  /* ---------- Hero content ---------- */
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered under the CTAs — mascots, stat strips, anything. */
  children?: React.ReactNode;

  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;

  align?: "left" | "center";
  maxWidth?: number;

  /* ---------- Canvas/shader ---------- */
  fragmentSource?: string;
  /** Cap device-pixel-ratio. The shader is fill-rate bound, so 2 is plenty. */
  dprMax?: number;

  /* ---------- Misc ---------- */
  height?: string;
  className?: string;
};

/**
 * Violet aurora. Polar + log(radius) remap turns three sine-warped filaments
 * into a slow inward spiral. Amber is rationed to a single faint ember: in this
 * UI amber means "money moving on its own", and the hero shouldn't spend it.
 */
const NANNY_FRAG = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;

#define FC gl_FragCoord.xy
#define R resolution
#define T time
#define MN min(R.x, R.y)

float filament(vec2 uv) {
  float d = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    uv.x += sin(T * (0.5 + i * 0.28) + uv.y * 1.6) * 0.22;
    d += 0.0026 / abs(uv.x);
  }
  return d;
}

/* Three violets, no amber. Amber means "money moving on its own" everywhere
   else in this UI, and mixing it into violet here only muddied both. */
vec3 aurora(vec2 uv) {
  uv = vec2(atan(uv.x, uv.y) * 2.0 / 6.28318, -log(length(uv)) + T * 0.12);
  float a = filament(uv);
  float b = filament(uv + 7.0 / MN);
  float c = filament(uv + 14.0 / MN);
  return a * vec3(0.34, 0.10, 0.85)
       + b * vec3(0.62, 0.28, 1.00)
       + c * vec3(0.86, 0.42, 0.98);
}

void main() {
  vec2 uv = (FC - 0.5 * R) / MN;
  vec2 suv = uv;
  suv.y += R.x > R.y ? 0.5 : 0.5 * (R.y / R.x);

  vec3 col = aurora(suv);

  /* The original's 1/(sin*cos) grid is dropped deliberately: sin(uv.x*s) is
     zero at uv.x=0, so it always burns a bright seam straight down the centre
     of the composition — directly behind the mascot and the headline. */

  // Radial falloff keeps the corners dark and the headline legible.
  col *= 1.0 - 0.55 * smoothstep(0.2, 1.15, length(uv));

  col = max(col, vec3(0.0));

  /* 1/abs() runs to infinity at each filament's centre. Clamping that to 1.0
     flattens the core to a dirty grey; rolling it off exponentially keeps the
     violet all the way into the highlight and leaves only a thin white spine. */
  col = vec3(1.0) - exp(-col * 1.45);

  O = vec4(col, 1.0);
}`;

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

function compileShader(gl: WebGL2RenderingContext, src: string, type: number) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) || "Unknown shader error";
    gl.deleteShader(sh);
    throw new Error(info);
  }
  return sh;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const v = compileShader(gl, vs, gl.VERTEX_SHADER);
  const f = compileShader(gl, fs, gl.FRAGMENT_SHADER);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || "Program link error";
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}

/**
 * WebGL2 aurora canvas. Draws nothing and unmounts cleanly when the user has
 * asked for reduced motion, when the hero scrolls out of view, or when the tab
 * is hidden — an un-throttled fullscreen shader is a laptop-fan machine.
 */
function AuroraCanvas({
  fragmentSource,
  dprMax,
  onFail,
}: {
  fragmentSource: string;
  dprMax: number;
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
    if (!gl) {
      onFail();
      return;
    }

    let prog: WebGLProgram;
    try {
      prog = createProgram(gl, VERT_SRC, fragmentSource);
    } catch (e) {
      console.error("[AetherHero] shader failed to compile:", e);
      onFail();
      return;
    }

    const verts = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    gl.useProgram(prog);
    const posLoc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "time");
    const uRes = gl.getUniformLocation(prog, "resolution");
    gl.clearColor(0, 0, 0, 0);

    const fit = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, dprMax));
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(Math.max(1, rect.width) * dpr);
      const h = Math.floor(Math.max(1, rect.height) * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    // Time is accumulated rather than read from `now`, so pausing and resuming
    // doesn't jump the animation forward by however long the tab was hidden.
    let raf: number | null = null;
    let last = 0;
    let elapsed = 0;
    let onScreen = true;

    const frame = (now: number) => {
      if (last === 0) last = now;
      elapsed += (now - last) * 1e-3;
      last = now;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf !== null) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf === null) return;
      cancelAnimationFrame(raf);
      raf = null;
    };
    const sync = () => {
      if (onScreen && !document.hidden) start();
      else stop();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [fragmentSource, dprMax, onFail]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 block h-full w-full select-none [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)] [touch-action:none]"
    />
  );
}

export default function AetherHero({
  eyebrow,
  title,
  subtitle,
  children,
  ctaLabel,
  ctaHref = "#",
  secondaryCtaLabel,
  secondaryCtaHref,
  align = "center",
  maxWidth = 960,
  fragmentSource = NANNY_FRAG,
  dprMax = 2,
  height = "min(92svh, 880px)",
  className = "",
}: AetherHeroProps) {
  const reduceMotion = useReducedMotion();
  const [glFailed, setGlFailed] = useState(false);
  const [onFail] = useState(() => () => setGlFailed(true));

  // The canvas is mounted only after hydration. It is decorative, so there is
  // nothing to gain from server-rendering it — and useReducedMotion always
  // reports false on the server, so deciding this during SSR desyncs hydration.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true, // client
    () => false, // server
  );

  // The CSS gradient below is always painted, so a missing canvas — reduced
  // motion, or no WebGL2 — degrades to still art rather than a black hole.
  const showCanvas = mounted && !reduceMotion && !glFailed;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  };
  // MotionConfig reducedMotion="user" strips the y-transform for users who ask
  // for it, so this stays unconditional and identical on both sides of hydration.
  const item: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      // expo.out — fast to settle, no overshoot on large type.
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section
      aria-label="Hero"
      style={{ height }}
      className={`relative isolate flex w-full items-center overflow-hidden ${className}`}
    >
      {/* Always-on gradient floor. Doubles as the reduced-motion/no-WebGL art. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_15%,#3b1178_0%,transparent_65%),radial-gradient(50%_50%_at_15%_70%,#2a1361_0%,transparent_60%)]"
      />
      {showCanvas && (
        <AuroraCanvas
          fragmentSource={fragmentSource}
          dprMax={dprMax}
          onFail={onFail}
        />
      )}

      {/* Legibility scrim: darkens the shader under the text, fades out below. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,5,15,0.72)_0%,rgba(7,5,15,0.38)_45%,var(--color-canvas)_100%)]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ maxWidth }}
        className={`relative z-10 mx-auto w-full px-6 sm:px-8 ${
          align === "left" ? "text-left" : "text-center"
        }`}
      >
        {eyebrow && (
          <motion.div variants={item} className="mb-5">
            {eyebrow}
          </motion.div>
        )}

        {title && (
          <motion.h1
            variants={item}
            className="font-display text-[clamp(2.4rem,6.4vw,4.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-ink [text-wrap:balance] drop-shadow-[0_6px_40px_rgba(0,0,0,0.5)]"
          >
            {title}
          </motion.h1>
        )}

        {subtitle && (
          <motion.p
            variants={item}
            className={`mt-5 max-w-2xl text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-ink-soft [text-wrap:pretty] ${
              align === "center" ? "mx-auto" : ""
            }`}
          >
            {subtitle}
          </motion.p>
        )}

        {(ctaLabel || secondaryCtaLabel) && (
          <motion.div
            variants={item}
            className={`mt-9 flex flex-wrap gap-3 ${
              align === "center" ? "justify-center" : ""
            }`}
          >
            {ctaLabel && (
              <a
                href={ctaHref}
                className="hud hud-sm group inline-flex min-h-11 items-center gap-2.5 bg-brand px-7 py-3.5 font-display text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_40px_-6px_rgba(168,85,247,0.9)] transition-colors duration-200 hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {ctaLabel}
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path d="M13.2 5.6 20 12l-6.8 6.4-1.4-1.5 4.1-3.9H4v-2h11.9l-4.1-3.9 1.4-1.5Z" />
                </svg>
              </a>
            )}
            {secondaryCtaLabel && (
              <a
                href={secondaryCtaHref}
                className="hud hud-sm inline-flex min-h-11 items-center bg-white/[0.04] px-7 py-3.5 font-display text-sm font-bold uppercase tracking-[0.16em] text-ink-soft ring-1 ring-inset ring-white/15 backdrop-blur-sm transition-colors duration-200 hover:bg-white/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {secondaryCtaLabel}
              </a>
            )}
          </motion.div>
        )}

        {children && <motion.div variants={item}>{children}</motion.div>}
      </motion.div>
    </section>
  );
}

export { AetherHero };
