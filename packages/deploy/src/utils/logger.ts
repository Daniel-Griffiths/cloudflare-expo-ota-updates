import chalk from "chalk";
import ora, { Ora } from "ora";

export interface JsonOutput {
  status: "success" | "error";
  message?: string;
  data?: any;
  errors?: string[];
}

export class Logger {
  private spinner: Ora | null = null;
  private jsonMode: boolean = false;
  private jsonData: any = {};

  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode;
  }

  /**
   * Enable/disable JSON mode
   */
  setJsonMode(enabled: boolean): void {
    this.jsonMode = enabled;
  }

  /**
   * Add data to JSON output
   */
  addJsonData(key: string, value: any): void {
    this.jsonData[key] = value;
  }

  /**
   * Output JSON and exit
   */
  outputJson(status: "success" | "error", message?: string, errors?: string[]): void {
    const output: JsonOutput = {
      status,
      message,
      data: this.jsonData,
      errors,
    };
    console.log(JSON.stringify(output, null, 2));
  }

  /**
   * Log an informational message
   */
  info(message: string): void {
    if (this.jsonMode) {
      // In JSON mode, write to stderr
      console.error(chalk.blue("ℹ"), message);
    } else {
      console.log(chalk.blue("ℹ"), message);
    }
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    if (this.jsonMode) {
      console.error(chalk.green("✓"), message);
    } else {
      console.log(chalk.green("✓"), message);
    }
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
    if (this.jsonMode) {
      console.error(chalk.yellow("⚠"), message);
    } else {
      console.warn(chalk.yellow("⚠"), message);
    }
  }

  /**
   * Start a spinner with a message
   */
  startSpinner(message: string): void {
    if (this.jsonMode) {
      // In JSON mode, just log to stderr
      console.error(chalk.gray("⟳"), message);
    } else {
      this.spinner = ora(message).start();
    }
  }

  /**
   * Update spinner text
   */
  updateSpinner(message: string): void {
    if (this.jsonMode) {
      console.error(chalk.gray("⟳"), message);
    } else if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop spinner with success
   */
  succeedSpinner(message?: string): void {
    if (this.jsonMode) {
      if (message) {
        console.error(chalk.green("✓"), message);
      }
    } else if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  failSpinner(message?: string): void {
    if (this.jsonMode) {
      if (message) {
        console.error(chalk.red("✗"), message);
      }
    } else if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without status
   */
  stopSpinner(): void {
    if (!this.jsonMode && this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    if (!this.jsonMode) {
      console.log(`\n${chalk.bold(title)}`);
    } else if (title) {
      console.error(`\n${chalk.bold(title)}`);
    }
  }

  /**
   * Log key-value pairs
   */
  keyValue(key: string, value: string | number): void {
    if (this.jsonMode) {
      // Store in JSON data
      this.addJsonData(key.toLowerCase().replace(/\s+/g, "_"), value);
      console.error(`   ${chalk.gray(key + ":")} ${value}`);
    } else {
      console.log(`   ${chalk.gray(key + ":")} ${value}`);
    }
  }

  /**
   * Log a divider line
   */
  divider(): void {
    if (!this.jsonMode) {
      console.log(chalk.gray("─".repeat(50)));
    }
  }

  /**
   * Create a box around text
   */
  box(text: string): void {
    if (this.jsonMode) {
      // In JSON mode, just output to stderr
      console.error(text);
      return;
    }

    const lines = text.split("\n");
    const maxLength = Math.max(...lines.map(l => l.length));
    const top = "┌" + "─".repeat(maxLength + 2) + "┐";
    const bottom = "└" + "─".repeat(maxLength + 2) + "┘";

    console.log(chalk.gray(top));
    lines.forEach(line => {
      const padding = " ".repeat(maxLength - line.length);
      console.log(chalk.gray("│ ") + line + padding + chalk.gray(" │"));
    });
    console.log(chalk.gray(bottom));
  }
}

// Export singleton instance (will be replaced in deploy.ts based on JSON flag)
export let logger = new Logger();