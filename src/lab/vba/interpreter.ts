// The VBA interpreter's public entry: parse a module and run one procedure (contract in DESIGN.md).
// The work happens in interpreterCore.ts (calls, loading), interpreterStmt.ts, interpreterExpr.ts and friends.
import { parseModule } from './parser'
import type { Val } from './runtime'
import { runModule, type RunOptions, type RunResult } from './interpreterCore'

export { runModule, type RunOptions, type RunResult } from './interpreterCore'

// parse `source` and run `entry` with `args`; never throws
export function runProcedure(source: string, entry: string, args: Val[], opts: RunOptions): RunResult {
  let parsed: ReturnType<typeof parseModule>
  try {
    parsed = parseModule(source)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { line: 0, message: `Compile error: ${msg}` }, steps: 0 }
  }
  if ('error' in parsed) {
    const { line, message } = parsed.error
    return { ok: false, error: { line, message: message.startsWith('Compile error') ? message : `Compile error: ${message}` }, steps: 0 }
  }
  return runModule(parsed.module, entry, args, opts)
}
