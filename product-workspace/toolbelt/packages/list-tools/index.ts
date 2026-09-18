#!/usr/bin/env bun
import { join } from "node:path";
import { listTools } from "./lib";

const packagesDir = join(import.meta.dir, "..");

const tools = await listTools(packagesDir);

if (tools.length === 0) {
  console.log("No tools found.");
} else {
  for (const tool of tools) {
    console.log(`${tool.name} — ${tool.description}`);
    console.log(`  command: ${tool.command}`);
    console.log();
  }
}
