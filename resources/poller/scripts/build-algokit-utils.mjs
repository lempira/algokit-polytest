#!/usr/bin/env node
import { execSync } from "child_process";
import { existsSync, renameSync, rmSync, cpSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pollerRoot = join(__dirname, "..");
const nodeModulesPath = join(
  pollerRoot,
  "node_modules",
  "@algorandfoundation",
  "algokit-utils"
);
const tempPath = join(pollerRoot, ".tmp-algokit-utils-build");

console.log("[Build] Building @algorandfoundation/algokit-utils...");

// Check if the package exists in node_modules
if (!existsSync(nodeModulesPath)) {
  console.log(
    "[Build] @algorandfoundation/algokit-utils not found in node_modules, skipping build"
  );
  process.exit(0);
}

// Step 1: Move package to temp location
console.log("[Build] Step 1: Moving package to temporary location...");
if (existsSync(tempPath)) {
  rmSync(tempPath, { recursive: true, force: true });
}
renameSync(nodeModulesPath, tempPath);

// Step 2: Install dependencies
console.log("[Build] Step 2: Installing dependencies...");
execSync("npm install --legacy-peer-deps", {
  cwd: tempPath,
  stdio: "inherit"
});

// Step 3: Build the package
console.log("[Build] Step 3: Building package...");
execSync("npm run build", {
  cwd: tempPath,
  stdio: "inherit"
});

// Step 4: Move dist contents to node_modules
console.log("[Build] Step 4: Moving dist contents to node_modules...");
const distPath = join(tempPath, "dist");

if (!existsSync(distPath)) {
  console.error("[Build] Error: dist folder not found after build");
  process.exit(1);
}

// Copy contents of dist folder to node_modules location
cpSync(distPath, nodeModulesPath, { recursive: true });

// Step 5: Clean up temp folder
console.log("[Build] Step 5: Cleaning up temporary files...");
rmSync(tempPath, { recursive: true, force: true });

console.log("[Build] ✅ Successfully built @algorandfoundation/algokit-utils");
