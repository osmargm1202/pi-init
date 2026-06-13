import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const IGNORED_DIRS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	".next",
	"coverage",
	".turbo",
	".venv",
	".pytest_cache",
	".ruff_cache",
	"__pycache__",
]);
const IMPORTANT_FILES = [
	"package.json",
	"package-lock.json",
	"README.md",
	"CONTEXT.md",
	"AGENTS.md",
	"CLAUDE.md",
	".cursorrules",
	".github/copilot-instructions.md",
	"tsconfig.json",
	"biome.json",
	"eslint.config.js",
	"pyproject.toml",
	"Cargo.toml",
	"go.mod",
	"deno.json",
	"openspec/config.yaml",
];
const KEY_FILE_CANDIDATES = [
	"README.md",
	"AGENTS.md",
	"CLAUDE.md",
	".cursorrules",
	".github/copilot-instructions.md",
	"package.json",
	"pyproject.toml",
	"Cargo.toml",
	"go.mod",
	"deno.json",
	"openspec/config.yaml",
];
const INSTRUCTION_FILE_NAMES = new Set(["AGENTS.md", "CLAUDE.md", ".cursorrules", "copilot-instructions.md"]);

export type GitInfo = {
	isRepo: boolean;
	root: string;
	branch: string;
	status: string[];
	error?: string;
};

export type KeyFile = {
	path: string;
	excerpt: string;
};

export type NestedProject = {
	path: string;
	importantFiles: string[];
	packageName: string;
	stack: string[];
	keyFiles: KeyFile[];
	localSkills: LocalSkill[];
};

export type LocalSkill = {
	name: string;
	path: string;
	description: string;
	files: string[];
};

export type RepoScan = {
	root: string;
	packageName: string;
	scripts: Record<string, string>;
	stack: string[];
	importantFiles: string[];
	instructionFiles: string[];
	keyFiles: KeyFile[];
	git: GitInfo;
	nestedProjects: NestedProject[];
	localSkills: LocalSkill[];
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

async function git(root: string, args: string[]): Promise<{ ok: true; stdout: string } | { ok: false; stderr: string }> {
	try {
		const { stdout } = await execFileAsync("git", args, { cwd: root });
		return { ok: true, stdout: stdout.trim() };
	} catch (error: any) {
		return { ok: false, stderr: String(error?.stderr || error?.message || "git command failed").trim() };
	}
}

async function scanGit(root: string): Promise<GitInfo> {
	const top = await git(root, ["rev-parse", "--show-toplevel"]);
	if (!top.ok) {
		return { isRepo: false, root: "", branch: "", status: [], error: top.stderr.split("\n")[0] || "not a git repository" };
	}
	const branch = await git(root, ["branch", "--show-current"]);
	const status = await git(root, ["status", "--short"]);
	return {
		isRepo: true,
		root: top.stdout,
		branch: branch.ok ? branch.stdout : "",
		status: status.ok && status.stdout ? status.stdout.split("\n") : [],
	};
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

function stripManagedSections(text: string): string {
	return text.replace(/<!-- ORGM:BEGIN generated -->[\s\S]*?<!-- ORGM:END generated -->/g, "").trim();
}

function normalizeExcerpt(text: string, maxChars = 1800): string {
	return stripManagedSections(text)
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
		.replace(/\r\n/g, "\n")
		.trim()
		.slice(0, maxChars)
		.trim();
}

async function readKeyFiles(root: string, prefix = ""): Promise<KeyFile[]> {
	const files: KeyFile[] = [];
	for (const candidate of KEY_FILE_CANDIDATES) {
		const filePath = join(root, candidate);
		if (!existsSync(filePath)) continue;
		try {
			files.push({ path: prefix ? `${prefix}/${candidate}` : candidate, excerpt: normalizeExcerpt(await readFile(filePath, "utf8")) });
		} catch {
			// Ignore unreadable project docs; scanner warnings are reserved for high-level failures.
		}
	}
	return files;
}

function instructionFilesFrom(paths: string[]): string[] {
	return paths.filter((file) => INSTRUCTION_FILE_NAMES.has(file.split("/").at(-1) || file));
}

async function scanNestedProjects(root: string): Promise<NestedProject[]> {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}
	const projects: NestedProject[] = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
		const projectRoot = join(root, entry.name);
		if (!existsSync(join(projectRoot, ".git"))) continue;
		const importantFiles = IMPORTANT_FILES.filter((file) => existsSync(join(projectRoot, file)));
		const pkg = await readJson(join(projectRoot, "package.json"));
		projects.push({
			path: entry.name,
			importantFiles,
			packageName: typeof pkg?.name === "string" ? pkg.name : entry.name,
			stack: detectStack(pkg, importantFiles),
			keyFiles: await readKeyFiles(projectRoot, entry.name),
			localSkills: await scanLocalSkills(projectRoot, entry.name),
		});
	}
	return projects;
}

function frontmatterValue(text: string, key: string): string {
	const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
	return match?.[1]?.trim().replace(/^['\"]|['\"]$/g, "") || "";
}

async function listSkillFiles(root: string, skillPath: string): Promise<string[]> {
	const files: string[] = [];
	await walk(root, skillPath, files, 80);
	return files.filter((file) => file.startsWith(relative(root, skillPath)) || file.startsWith(".pi/skills/"));
}

async function scanLocalSkills(root: string, pathPrefix = ""): Promise<LocalSkill[]> {
	const skillsRoot = join(root, ".pi", "skills");
	if (!existsSync(skillsRoot)) return [];
	let entries;
	try {
		entries = await readdir(skillsRoot, { withFileTypes: true });
	} catch {
		return [];
	}
	const skills: LocalSkill[] = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		if (!entry.isDirectory()) continue;
		const skillRoot = join(skillsRoot, entry.name);
		const skillFile = join(skillRoot, "SKILL.md");
		let skillText = "";
		try {
			skillText = existsSync(skillFile) ? await readFile(skillFile, "utf8") : "";
		} catch {
			skillText = "";
		}
		const relPath = relative(root, skillRoot);
		const files = await listSkillFiles(root, skillRoot);
		skills.push({
			name: frontmatterValue(skillText, "name") || entry.name,
			path: pathPrefix ? `${pathPrefix}/${relPath}` : relPath,
			description: frontmatterValue(skillText, "description"),
			files: pathPrefix ? files.map((file) => `${pathPrefix}/${file}`) : files,
		});
	}
	return skills;
}

export async function scanRepository(root: string, maxFiles = 250): Promise<RepoScan> {
	const warnings: string[] = [];
	const importantFiles = IMPORTANT_FILES.filter((file) => existsSync(join(root, file)));
	const pkg = await readJson(join(root, "package.json"));
	const tree: string[] = [];
	await walk(root, root, tree, maxFiles);
	if (tree.length >= maxFiles) warnings.push(`tree truncated at ${maxFiles} entries`);
	const gitInfo = await scanGit(root);
	if (!gitInfo.isRepo && gitInfo.error) warnings.push(gitInfo.error);
	return {
		root,
		packageName: typeof pkg?.name === "string" ? pkg.name : "unknown-project",
		scripts: sanitizeScripts(pkg?.scripts),
		stack: detectStack(pkg, importantFiles),
		importantFiles,
		instructionFiles: instructionFilesFrom(importantFiles),
		keyFiles: await readKeyFiles(root),
		git: gitInfo,
		nestedProjects: await scanNestedProjects(root),
		localSkills: await scanLocalSkills(root),
		tree,
		warnings,
	};
}
