import yargs, { type Argv, type CommandModule, type Options } from "yargs";
import { select } from "@inquirer/prompts";
import chalk from "chalk";

interface CommandInfo {
  command: string;
  describe: string;
  options: Record<string, Options>;
  handler: (argv: any) => void | Promise<void>;
}

class InteractiveCLI {
  private args: string[];
  private commands: CommandInfo[] = [];
  private yargsInstance: Argv;

  constructor(args: string[]) {
    this.args = args;
    this.yargsInstance = yargs(args);
  }

  private showWelcome() {
    console.clear();
    console.log();
    console.log(chalk.cyan("  ___  __ _ ___  ___ "));
    console.log(chalk.cyan(" / _ \\/ _` / __|/ __|"));
    console.log(chalk.blue("|  __/ (_| \\__ \\ (__ "));
    console.log(chalk.blue(" \\___|\\__,_|___/\\___|"));
    console.log();
    console.log(chalk.gray(" Expo App Services for Cloudflare"));
    console.log(chalk.yellow("════════════════════════════════════"));
    console.log();
  }

  private async promptForMissingArgs(
    argv: any,
    options: Record<string, Options>,
  ) {
    if (argv.nonInteractive || argv["non-interactive"]) return;

    for (const [key, opt] of Object.entries(options)) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[key] ?? argv[camelKey];

      if (value !== undefined) continue;
      if (opt.default !== undefined) continue;
      if (!opt.choices || !Array.isArray(opt.choices)) continue;

      argv[key] = await select({
        message: `Select ${key.replace(/-/g, " ")}:`,
        choices: opt.choices.map((c: string) => ({ name: c, value: c })),
      });
      argv[camelKey] = argv[key];
    }
  }

  scriptName(name: string): this {
    this.yargsInstance.scriptName(name);
    return this;
  }

  usage(message: string): this {
    this.yargsInstance.usage(message);
    return this;
  }

  command(cmd: CommandModule): this {
    const commandStr = typeof cmd.command === "string" 
      ? cmd.command 
      : cmd.command?.[0] ?? "";
    const commandName = commandStr.split(" ")[0] || "";

    let options: Record<string, Options> = {};

    if (typeof cmd.builder === "function") {
      const fakeYargs = {
        option: (key: string, opt: Options) => {
          options[key] = opt;
          return fakeYargs;
        },
        example: () => fakeYargs,
        positional: () => fakeYargs,
        demandOption: () => fakeYargs,
        choices: () => fakeYargs,
      };
      cmd.builder(fakeYargs as any);
    } else if (cmd.builder) {
      options = cmd.builder as Record<string, Options>;
    }

    this.commands.push({
      command: commandName,
      describe: (cmd.describe as string) ?? "",
      options,
      handler: cmd.handler as (argv: any) => void | Promise<void>,
    });

    const wrappedCmd: CommandModule = {
      ...cmd,
      handler: async (argv: any) => {
        await this.promptForMissingArgs(argv, options);
        return cmd.handler(argv);
      },
    };

    this.yargsInstance.command(wrappedCmd);
    return this;
  }

  demandCommand(_min: number, _message?: string): this {
    return this;
  }

  help(): this {
    this.yargsInstance.help();
    return this;
  }

  alias(key: string, alias: string): this {
    this.yargsInstance.alias(key, alias);
    return this;
  }

  strict(): this {
    this.yargsInstance.strict();
    return this;
  }

  showHelpOnFail(enabled: boolean): this {
    this.yargsInstance.showHelpOnFail(enabled);
    return this;
  }

  async parse(): Promise<void> {
    const needsCommandPrompt = this.args.length === 0 || 
      (this.args.length === 1 && this.args[0]?.startsWith("-"));

    if (!needsCommandPrompt) {
      this.yargsInstance.demandCommand(1, "").parse();
      return;
    }

    this.showWelcome();

    const command = await select({
      message: "Select a command:",
      choices: [
        ...this.commands.map((cmd) => ({
          name: `${cmd.command.padEnd(12)} ${cmd.describe}`,
          value: cmd.command,
        })),
        { name: "Exit", value: "exit" },
      ],
    });

    if (command === "exit") {
      console.log("Goodbye!");
      process.exit(0);
    }

    this.args.unshift(command);
    this.yargsInstance = yargs(this.args);

    for (const cmd of this.commands) {
      this.yargsInstance.command({
        command: cmd.command,
        describe: cmd.describe,
        builder: (y) => {
          for (const [key, opt] of Object.entries(cmd.options)) {
            y.option(key, opt);
          }
          return y;
        },
        handler: async (argv: any) => {
          await this.promptForMissingArgs(argv, cmd.options);
          return cmd.handler(argv);
        },
      });
    }

    this.yargsInstance.demandCommand(1, "").parse();
  }
}

export function cli(args: string[]): InteractiveCLI {
  return new InteractiveCLI(args);
}
