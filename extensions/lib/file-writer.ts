import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const BEGIN = "<!-- ORGM:BEGIN generated -->";
const END = "<!-- ORGM:END generated -->";

export function wrapManagedMarkdown(body: string): string {
	const clean = body.trimEnd();
	return `${BEGIN}\n${clean}\n${END}\n`;
}

export async function writeManagedMarkdown(filePath: string, body: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	const managed = wrapManagedMarkdown(body);
	if (!existsSync(filePath)) {
		await writeFile(filePath, managed, "utf8");
		return;
	}

	const current = await readFile(filePath, "utf8");
	const beginIndex = current.indexOf(BEGIN);
	const endIndex = current.indexOf(END);
	if (beginIndex >= 0 && endIndex > beginIndex) {
		const before = current.slice(0, beginIndex).trimEnd();
		const after = current.slice(endIndex + END.length).trimStart();
		const next = [before, managed.trimEnd(), after].filter(Boolean).join("\n\n") + "\n";
		await writeFile(filePath, next, "utf8");
		return;
	}

	const next = `${current.trimEnd()}\n\n${managed}`;
	await writeFile(filePath, next, "utf8");
}
