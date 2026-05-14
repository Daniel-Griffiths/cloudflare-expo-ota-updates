import chalk from "chalk";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface SpinnerEntry {
  label: string;
  status: "pending" | "done" | "failed";
}

export class Logger {
  private lines: SpinnerEntry[] | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;

  constructor() {}

  /**
   * Log a plain message
   */
  log(message: string): void {
    console.log(message);
  }

  /**
   * Log an informational message
   */
  info(message: string): void {
    console.log(chalk.blue("ℹ"), message);
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    console.log(chalk.green("✓"), message);
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    console.error(chalk.red("✗"), message);
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    console.warn(chalk.yellow("⚠"), message);
  }

  /**
   * Start one or more spinner lines
   */
  startSpinner(labels: string | string[]): void {
    const items = Array.isArray(labels) ? labels : [labels];
    this.lines = items.map((label) => ({ label, status: "pending" as const }));
    this.frame = 0;

    for (const entry of this.lines) {
      process.stderr.write(`  ${SPINNER_FRAMES[0]} ${entry.label}\n`);
    }

    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 80);
  }

  /**
   * Mark a spinner line as done or failed
   */
  updateSpinner(label: string, status: "done" | "failed"): void {
    if (!this.lines) return;
    const entry = this.lines.find((e) => e.label === label);
    if (entry) {
      entry.status = status;
      this.render();
    }
  }

  /**
   * Stop all spinner lines
   */
  stopSpinner(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.lines) {
      this.render();
      this.lines = null;
    }
  }

  private render(): void {
    if (!this.lines) return;

    process.stderr.write(`\x1B[${this.lines.length}A`);

    for (const entry of this.lines) {
      process.stderr.write("\x1B[2K\r");
      if (entry.status === "done") {
        process.stderr.write(`  ${chalk.green("✓")} ${entry.label}\n`);
      } else if (entry.status === "failed") {
        process.stderr.write(`  ${chalk.red("✗")} ${entry.label}\n`);
      } else {
        process.stderr.write(`  ${chalk.cyan(SPINNER_FRAMES[this.frame])} ${entry.label}\n`);
      }
    }
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    console.log(`\n${chalk.bold(title)}`);
  }

  /**
   * Display a simple two-column table
   */
  table(rows: Array<[string, string | number | undefined]>): void {
    const maxKeyLength = Math.max(...rows.map(([key]) => key.length));

    rows.forEach(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength);
      console.log(`   ${chalk.gray(paddedKey + ":")} ${value}`);
    });
  }

  /**
   * Create a box around text
   */
  box(text: string): void {
    const lines = text.split("\n");
    const maxLength = Math.max(...lines.map((l) => l.length));
    const top = "┌" + "─".repeat(maxLength + 2) + "┐";
    const bottom = "└" + "─".repeat(maxLength + 2) + "┘";

    console.log(chalk.gray(top));
    lines.forEach((line) => {
      const padding = " ".repeat(maxLength - line.length);
      console.log(chalk.gray("│ ") + line + padding + chalk.gray(" │"));
    });
    console.log(chalk.gray(bottom));
  }
}

// Export singleton instance
export let logger = new Logger();
