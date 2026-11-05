// Small, deterministic helpers for render(t). No timers, no randomness.
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  // Progress 0→1 of t across [start, end]
  const progress = (t, start, end) => clamp((t - start) / (end - start));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = {
    linear: p => p,
    inOut:  p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    out:    p => 1 - Math.pow(1 - p, 3),
    in:     p => p * p * p,
    back:   p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  };
  // tween(t, start, end, from, to, easing): the value at time t
  const tween = (t, start, end, from, to, e = ease.inOut) => lerp(from, to, e(progress(t, start, end)));
  // Seeded random so "random" layouts are identical every render
  const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  window.M = { clamp, progress, lerp, ease, tween, seeded };
})();
