#!/usr/bin/env node
import { hideBin } from "yargs/helpers";
import { cli } from "./src/utils/cli";
import { build } from "./src/commands/build";
import { buildRun } from "./src/commands/build-run";
import { update } from "./src/commands/update";

cli(hideBin(process.argv))
  .scriptName("easc")
  .usage("$0 <command> [options]")
  .command(update)
  .command(build)
  .command(buildRun)
  .demandCommand(1, "")
  .help()
  .alias("help", "h")
  .alias("version", "V")
  .strict()
  .parse();
