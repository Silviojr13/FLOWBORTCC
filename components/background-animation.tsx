"use client";

import { useEffect, useRef, useCallback } from "react";

/* ── Types ── */
interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  layer: number;       // 0 = far, 1 = mid, 2 = near
  pulsePhase: number;   // random start offset for pulse
  pulseSpeed: number;   // how fast it pulses
  baseAlpha: number;    // base opacity
}

/* ── Config per layer ── */
const LAYER_CONFIG = [
  { count: 0.40, minR: 0.5, maxR: 1.2, speed: 0.08, alpha: 0.25, parallax: 0.01, connectionDist: 0 },
  { count: 0.35, minR: 0.8, maxR: 1.8, speed: 0.14, alpha: 0.40, parallax: 0.025, connectionDist: 140 },
  { count: 0.25, minR: 1.0, maxR: 2.5, speed: 0.22, alpha: 0.55, parallax: 0.045, connectionDist: 180 },
] as const;

const CONNECTION_ALPHA = 0.08;
const PULSE_CHANCE = 0.15;       // 15 % of nodes pulse
const PULSE_MIN = 0.003;
const PULSE_MAX = 0.008;

/* ── Helpers ── */
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function totalNodeCount(w: number, h: number) {
  const area = w * h;
  // ~60 nodes on a 1920×1080 screen, scales with area
  return Math.round((area / (1920 * 1080)) * 60);
}

/* ── Component ── */
export default function BackgroundAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  /* Build nodes */
  const buildNodes = useCallback((w: number, h: number) => {
    const total = totalNodeCount(w, h);
    const nodes: Node[] = [];

    for (const [layerIdx, cfg] of LAYER_CONFIG.entries()) {
      const count = Math.round(total * cfg.count);
      for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(cfg.speed * 0.4, cfg.speed);
        nodes.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: rand(cfg.minR, cfg.maxR),
          layer: layerIdx,
          pulsePhase: rand(0, Math.PI * 2),
          pulseSpeed: rand(PULSE_MIN, PULSE_MAX),
          baseAlpha: cfg.alpha,
        });
      }
    }
    nodesRef.current = nodes;
  }, []);

  /* Main render loop */
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    ctx.clearRect(0, 0, w, h);

    const nodes = nodesRef.current;

    /* ── Update positions ── */
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;

      // Wrap around edges with padding
      const pad = 40;
      if (n.x < -pad) n.x = w + pad;
      if (n.x > w + pad) n.x = -pad;
      if (n.y < -pad) n.y = h + pad;
      if (n.y > h + pad) n.y = -pad;
    }

    /* ── Draw connections (layers 1 & 2 only) ── */
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const cfg = LAYER_CONFIG[a.layer];
      if (cfg.connectionDist === 0) continue;

      const aCfg = LAYER_CONFIG[a.layer];
      const ax = a.x + mx * aCfg.parallax;
      const ay = a.y + my * aCfg.parallax;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (Math.abs(a.layer - b.layer) > 1) continue; // only same or adjacent layer

        const bCfg = LAYER_CONFIG[b.layer];
        const bx = b.x + mx * bCfg.parallax;
        const by = b.y + my * bCfg.parallax;

        const dx = ax - bx;
        const dy = ay - by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.max(cfg.connectionDist, LAYER_CONFIG[b.layer].connectionDist);

        if (dist < maxDist) {
          const alpha = CONNECTION_ALPHA * (1 - dist / maxDist);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = `oklch(0.6 0.12 250 / ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    /* ── Draw nodes ── */
    for (const n of nodes) {
      const cfg = LAYER_CONFIG[n.layer];
      const px = n.x + mx * cfg.parallax;
      const py = n.y + my * cfg.parallax;

      let alpha = n.baseAlpha;

      // Pulse effect
      if (n.pulseSpeed > PULSE_MIN * 0.9) {
        const pulse = Math.sin(time * n.pulseSpeed + n.pulsePhase);
        alpha = n.baseAlpha + pulse * 0.2;
      }

      // Glow
      if (alpha > 0.35) {
        ctx.beginPath();
        ctx.arc(px, py, n.radius * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.55 0.15 250 / ${alpha * 0.12})`;
        ctx.fill();
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(px, py, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = `oklch(0.7 0.1 250 / ${alpha})`;
      ctx.fill();
    }
  }, []);

  /* ── Setup ── */
  useEffect(() => {
    // Check reduced motion preference
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mql.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mql.addEventListener("change", handleMotionChange);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Resize handler */
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes(w, h);

      // If reduced motion, draw a single static frame
      if (reducedMotion.current) {
        draw(ctx, w, h, 0);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    /* Mouse handler */
    const onMouseMove = (e: MouseEvent) => {
      // Normalize to center: -0.5 to 0.5
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    /* Animation loop */
    let running = true;
    const loop = (time: number) => {
      if (!running) return;
      if (!reducedMotion.current) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        draw(ctx, w, h, time);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      mql.removeEventListener("change", handleMotionChange);
    };
  }, [buildNodes, draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
