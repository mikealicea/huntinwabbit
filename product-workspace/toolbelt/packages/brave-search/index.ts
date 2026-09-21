#!/usr/bin/env bun
import { parseCliArgs, runBraveSearch, shouldShowHelp } from "./lib";
import { usageText } from "./templates";

const [, , ...args] = process.argv;

if (args.length === 0) {
  console.error(usageText());
  process.exit(1);
}

if (shouldShowHelp(args)) {
  console.log(usageText());
  process.exit(0);
}

try {
  const command = parseCliArgs(args);
  const result = await runBraveSearch(command);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
