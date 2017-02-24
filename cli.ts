import * as program from "commander";

program
  .version("0.5.0")
  .option("-i, --interactive", "Run in command-line interactive mode")
  .parse(process.argv);

export default program;