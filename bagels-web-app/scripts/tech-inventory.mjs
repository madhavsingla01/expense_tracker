import fs from "fs";
import path from "path";

// Allow running from either:
// - repo parent folder:   node .\bagels-web-app\scripts\tech-inventory.mjs
// - inside bagels-web-app: node .\scripts\tech-inventory.mjs
const cwd = process.cwd();
const repoRoot = path.basename(cwd).toLowerCase() === "bagels-web-app"
  ? cwd
  : path.resolve(cwd, "bagels-web-app");
const args = new Set(process.argv.slice(2));
const includeAllTransitives = args.has("--all");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeRel(p) {
  return path.relative(process.cwd(), p);
}

function getDirectDeps(pkgJson) {
  const deps = pkgJson.dependencies ?? {};
  const devDeps = pkgJson.devDependencies ?? {};
  const all = [];

  for (const [name, version] of Object.entries(deps)) {
    all.push({ name, version, type: "dependency" });
  }
  for (const [name, version] of Object.entries(devDeps)) {
    all.push({ name, version, type: "devDependency" });
  }

  all.sort((a, b) => a.name.localeCompare(b.name));
  return all;
}

function getTransitivesFromPackageLock(lockJson) {
  // npm lockfile v2+ has `packages` map; v1 has `dependencies`.
  const names = new Set();

  if (lockJson?.packages && typeof lockJson.packages === "object") {
    for (const key of Object.keys(lockJson.packages)) {
      if (!key || key === "") continue; // root package
      // key format: node_modules/<name> or node_modules/<scope>/<name>
      const idx = key.lastIndexOf("node_modules/");
      if (idx === -1) continue;
      const pkgName = key.slice(idx + "node_modules/".length);
      if (pkgName) names.add(pkgName);
    }
  } else if (lockJson?.dependencies && typeof lockJson.dependencies === "object") {
    for (const name of Object.keys(lockJson.dependencies)) names.add(name);
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function printSection(title) {
  process.stdout.write(`\n=== ${title} ===\n`);
}

function printTable(rows) {
  for (const r of rows) process.stdout.write(`${r}\n`);
}

function runApp(appDirName) {
  const appDir = path.join(repoRoot, appDirName);
  const pkgPath = path.join(appDir, "package.json");
  const lockPath = path.join(appDir, "package-lock.json");

  if (!fs.existsSync(pkgPath)) {
    process.stdout.write(`Missing ${safeRel(pkgPath)}\n`);
    return;
  }

  const pkg = readJson(pkgPath);
  printSection(`${appDirName.toUpperCase()} - direct dependencies (${safeRel(pkgPath)})`);
  const direct = getDirectDeps(pkg);
  const directRows = direct.map((d) => `${d.type}\t${d.name}\t${d.version}`);
  printTable(directRows);

  if (!fs.existsSync(lockPath)) {
    process.stdout.write(`\nNo lockfile found at ${safeRel(lockPath)}\n`);
    return;
  }

  const lock = readJson(lockPath);
  const transitives = getTransitivesFromPackageLock(lock);

  printSection(`${appDirName.toUpperCase()} - transitive dependencies (from ${safeRel(lockPath)})`);
  process.stdout.write(`count\t${transitives.length}\n`);

  if (includeAllTransitives) {
    printSection(`${appDirName.toUpperCase()} - transitive list`);
    for (const name of transitives) process.stdout.write(`${name}\n`);
  } else {
    const preview = transitives.slice(0, 50);
    process.stdout.write(`preview(50)\t${preview.join(", ")}\n`);
    process.stdout.write(`hint\trun with --all for the full list\n`);
  }
}

printSection("Repo");
process.stdout.write(`root\t${safeRel(repoRoot)}\n`);

runApp("frontend");
runApp("backend");
