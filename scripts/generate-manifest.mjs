
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public/pukiwiki");
const output = path.resolve("public/pukiwiki-manifest.json");

const dirs = [];
const files = [];

async function walk(directory, relative = "") {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const relativePath = relative
      ? `${relative}/${entry.name}`
      : entry.name;

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      dirs.push(relativePath);
      await walk(absolutePath, relativePath);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

await walk(root);

if (!files.includes("index.php"))
  throw new Error("public/pukiwiki/index.php is missing. Please check the PukiWiki distribution files.");

await fs.writeFile(
  output,
  JSON.stringify({ dirs, files }, null, 2),
  "utf8"
);

console.log(
  `Manifest generated: ${files.length} files, ${dirs.length} directories`
);
