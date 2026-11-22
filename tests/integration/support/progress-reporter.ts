// Vitest reporter that prints a file counter, elapsed time and a rough time-left estimate
// after each database test file, so long runs show progress in any terminal or log.
import type {
  Reporter,
  TestModule,
  TestSpecification,
  Vitest,
} from 'vitest/node';

const MARKS: Record<string, string> = {
  passed: '✓',
  failed: '✗',
  skipped: '↓',
};

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export default class IntegrationProgressReporter implements Reporter {
  private ctx: Vitest | undefined;
  private total = 0;
  private done = 0;
  private startedAt = 0;

  onInit(ctx: Vitest) {
    this.ctx = ctx;
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>) {
    this.total = specifications.length;
    this.done = 0;
    this.startedAt = Date.now();
    this.log(`Running ${this.total} database test file(s)…`);
  }

  onTestModuleEnd(testModule: TestModule) {
    this.done += 1;
    const elapsed = Date.now() - this.startedAt;
    const mark = MARKS[testModule.state()] ?? '·';
    const own = formatDuration(testModule.diagnostic().duration);
    const remaining = this.total - this.done;
    // Files run in parallel, so the average time per finished file already reflects the
    // real throughput; the first few files include template creation, so wait for them.
    const left =
      remaining === 0
        ? 'done'
        : this.done < 4
          ? 'estimating time left'
          : `about ${formatDuration((elapsed / this.done) * remaining)} left`;
    const width = String(this.total).length;
    this.log(
      `[${String(this.done).padStart(width)}/${this.total}] ${mark} ${testModule.relativeModuleId} (${own}) · ${formatDuration(elapsed)} elapsed · ${left}`,
    );
  }

  private log(message: string) {
    if (this.ctx) this.ctx.logger.log(message);
    else console.log(message);
  }
}
