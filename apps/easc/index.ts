#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { build } from "./src/commands/build";
import { update } from "./src/commands/update";

yargs(hideBin(process.argv))
  .scriptName("easc")
  .usage("$0 <command> [options]")
  .command(build)
  .command(update)
  .demandCommand(1, "")
  .showHelpOnFail(true)
  .help()
  .alias("help", "h")
  .alias("version", "V")
  .strict()
  .parse();
