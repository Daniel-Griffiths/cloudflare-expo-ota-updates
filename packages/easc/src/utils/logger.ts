import chalk from "chalk";
import ora, { Ora } from "ora";

export class Logger {
  private spinner: Ora | null = null;

  constructor() {}

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
   * Start a spinner with a message
   */
  startSpinner(message: string): void {
    this.spinner = ora(message).start();
  }

  /**
   * Update spinner text
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop spinner with success
   */
  succeedSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  failSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without status
   */
  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
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
