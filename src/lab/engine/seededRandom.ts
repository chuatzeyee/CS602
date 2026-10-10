// seededRandom.ts - reproducible RAND()/RANDBETWEEN() for HyperFormula.
// Each draw is a pure function of (seed, generation, sheet, row, col, call site), so results do not depend
// on HyperFormula's evaluation order. "Press F9" = redraw() (bump the generation) and recalculate.
import { CellError, ErrorType, FunctionArgumentType, FunctionPlugin, HyperFormula } from 'hyperformula';

/* eslint-disable @typescript-eslint/no-explicit-any -- HF does not export its Ast/State types */
type Ast = any;
type State = any;

/** 32-bit avalanche mix (MurmurHash3 finaliser). */
function fmix32(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
function hashInts(values: number[]): number {
  let h = 0x9e3779b9;
  for (const v of values) h = fmix32(h ^ Math.imul((v | 0) + 0x7f4a7c15, 0x9e3779b1));
  return h;
}

/** Counter-based uniform generator in [0, 1) with 53-bit resolution. */
export class RandomSource {
  seed: number;
  generation = 0;
  /** true = Excel behaviour (every recalculation redraws); false = values change only on redraw(). */
  redrawOnEveryRecalc: boolean;

  constructor(seed: number, redrawOnEveryRecalc = false) {
    this.seed = seed >>> 0;
    this.redrawOnEveryRecalc = redrawOnEveryRecalc;
  }
  /** Start a new draw (like pressing F9 in Excel). */
  redraw(): void { this.generation += 1; }
  private sites = new WeakMap<object, number>();
  private nextSite = 0;
  /** Stable per-engine id of a RAND()/RANDBETWEEN() call site (AST node), assigned in first-evaluation
   *  order, which is deterministic for identical workbooks. Separates two RAND() calls in one formula. */
  siteOf(ast: object): number {
    let id = this.sites.get(ast);
    if (id === undefined) { id = this.nextSite++; this.sites.set(ast, id); }
    return id;
  }
  /** Uniform draw for call site `site` of the formula in (sheet, row, col). */
  next(sheet: number, row: number, col: number, site: number): number {
    const a = hashInts([this.seed, this.generation, sheet, row, col, site]);
    const b = hashInts([a, 0x632be5ab]);
    return ((a >>> 5) * 67108864 + (b >>> 6)) / 9007199254740992; // 27 + 26 bits -> [0,1)
  }
}

/** Engines that should use a RandomSource pass it as `context: { random }` in their config. */
export interface RandomContext { random?: RandomSource }

export class SeededRandomPlugin extends FunctionPlugin {
  static implementedFunctions = {
    RAND: { method: 'rand', parameters: [], isVolatile: true },
    RANDBETWEEN: {
      method: 'randbetween', isVolatile: true,
      parameters: [{ argumentType: FunctionArgumentType.NUMBER }, { argumentType: FunctionArgumentType.NUMBER }],
    },
  };
  private draw(ast: Ast, state: State): number {
    const src = (this.config.context as RandomContext | undefined)?.random;
    const at = state?.formulaAddress;
    return src && at ? src.next(at.sheet, at.row, at.col, src.siteOf(ast)) : Math.random();
  }
  rand(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('RAND'), () => this.draw(ast, state));
  }
  randbetween(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('RANDBETWEEN'), (bottom: number, top: number) => {
      const lo = Math.ceil(bottom);
      const hi = Math.floor(top);
      if (lo > hi) return new CellError(ErrorType.NUM, 'bottom > top');
      return lo + Math.floor(this.draw(ast, state) * (hi - lo + 1));
    });
  }
}

let registered = false;
export function registerSeededRandom(): void {
  if (registered) return;
  HyperFormula.registerFunctionPlugin(SeededRandomPlugin, { enGB: { RAND: 'RAND', RANDBETWEEN: 'RANDBETWEEN' } });
  registered = true;
}

/** Excel mode: every recalculation pass must see a new generation. HyperFormula has no "before
 *  recalculation" hook, so bump once now (the build used generation 0) and again after each pass. */
export function attachRandomSource(hf: HyperFormula, source: RandomSource): void {
  if (!source.redrawOnEveryRecalc) return;
  source.redraw();
  hf.on('valuesUpdated', () => source.redraw());
}
