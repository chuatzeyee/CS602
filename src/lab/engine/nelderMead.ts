// nelderMead.ts - derivative-free minimiser (Nelder & Mead 1965, standard coefficients).
// step[i] may be negative (the first simplex then points that way, e.g. into a box from its upper edge); deadline is a
// performance.now() time after which the search stops with the best point so far (Solver's Max Time).
export function nelderMead(f: (x: number[]) => number, start: number[], opts: { step: number[]; maxIterations?: number; tolerance?: number; deadline?: number }): { x: number[]; fx: number; iterations: number } {
  const n = start.length;
  const maxIt = opts.maxIterations ?? 500;
  const tol = opts.tolerance ?? 1e-9;
  const late = () => opts.deadline !== undefined && performance.now() > opts.deadline;
  let simplex = [start, ...start.map((_, i) => start.map((v, j) => (i === j ? v + opts.step[i] : v)))].map((x) => ({ x, fx: f(x) }));
  const centroid = (pts: { x: number[] }[]) => pts[0].x.map((_, j) => pts.reduce((s, p) => s + p.x[j], 0) / pts.length);
  const along = (a: number[], b: number[], t: number) => a.map((v, j) => v + t * (b[j] - v)); // a + t (b - a)
  let it = 0;
  for (; it < maxIt && !late(); it++) {
    simplex.sort((p, q) => p.fx - q.fx);
    const best = simplex[0];
    const worst = simplex[n];
    if (Math.abs(worst.fx - best.fx) <= tol * (1 + Math.abs(best.fx))) break;
    const c = centroid(simplex.slice(0, n));
    const xr = along(c, worst.x, -1); // reflection
    const fr = f(xr);
    if (fr < best.fx) {
      const xe = along(c, worst.x, -2); // expansion
      const fe = f(xe);
      simplex[n] = fe < fr ? { x: xe, fx: fe } : { x: xr, fx: fr };
    } else if (fr < simplex[n - 1].fx) {
      simplex[n] = { x: xr, fx: fr };
    } else {
      const xc = fr < worst.fx ? along(c, xr, 0.5) : along(c, worst.x, 0.5); // outside / inside contraction
      const fc = f(xc);
      if (fc < Math.min(fr, worst.fx)) simplex[n] = { x: xc, fx: fc };
      else simplex = simplex.map((p, i) => (i === 0 ? p : { x: along(best.x, p.x, 0.5), fx: f(along(best.x, p.x, 0.5)) })); // shrink
    }
  }
  simplex.sort((p, q) => p.fx - q.fx);
  return { x: simplex[0].x, fx: simplex[0].fx, iterations: it };
}
