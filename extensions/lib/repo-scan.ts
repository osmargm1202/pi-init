import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".turbo"]);
const IMPORTANT_FILES = ["package.json", "README.md", "CONTEXT.md", "AGENTS.md", "tsconfig.json", "biome.json", "eslint.config.js", "pyproject.toml", "Cargo.toml", "go.mod", "deno.json"];

export type RepoScan = {
	root: string;
	packageName: string;
	scripts: Record<string, string>;
	stack: string[];
	importantFiles: string[];
	tree: string[];
	warnings: string[];
};

async function readJson(filePath: string): Promise<Record<string, any> | undefined> {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch {
		return undefined;
	}
}

async function walk(root: string, dir: string, out: string[], maxFiles: number): Promise<void> {
	if (out.length >= maxFiles) return;
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		if (out.length >= maxFiles) return;
		if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		const rel = relative(root, full);
		if (entry.isDirectory()) {
			out.push(`${rel}/`);
			await walk(root, full, out, maxFiles);
		} else {
			out.push(rel);
		}
	}
}

function sanitizeScripts(scripts: unknown): Record<string, string> {
	if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return {};
	const sanitized: Record<string, string> = {};
	for (const [key, value] of Object.entries(scripts)) {
		if (typeof key === "string" && key.length > 0 && typeof value === "string" && value.length > 0) {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

function detectStack(pkg: Record<string, any> | undefined, importantFiles: string[]): string[] {
	const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
	const stack = new Set<string>();
	if (pkg) stack.add("Node.js");
	if (deps.typescript || importantFiles.some((file) => file.startsWith("tsconfig"))) stack.add("TypeScript");
	if (deps.react) stack.add("React");
	if (deps.vitest) stack.add("Vitest");
	if (deps["@biomejs/biome"] || importantFiles.includes("biome.json")) stack.add("Biome");
	if (importantFiles.includes("pyproject.toml")) stack.add("Python");
	if (importantFiles.includes("Cargo.toml")) stack.add("Rust");
	if (importantFiles.includes("go.mod")) stack.add("Go");
	return [...stack];
}

export async function scanRepository(root: string, maxFiles = 250): Promise<RepoScan> {
	const warnings: string[] = [];
	const importantFiles = IMPORTANT_FILES.filter((file) => existsSync(join(root, file)));
	const pkg = await readJson(join(root, "package.json"));
	const tree: string[] = [];
	await walk(root, root, tree, maxFiles);
	if (tree.length >= maxFiles) warnings.push(`tree truncated at ${maxFiles} entries`);
	return {
		root,
		packageName: typeof pkg?.name === "string" ? pkg.name : "unknown-project",
		scripts: sanitizeScripts(pkg?.scripts),
		stack: detectStack(pkg, importantFiles),
		importantFiles,
		tree,
		warnings,
	};
}
