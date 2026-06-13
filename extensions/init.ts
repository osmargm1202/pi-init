import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { renderAgentsMarkdown, renderContextMarkdown } from "./lib/context-renderer.ts";
import { writeManagedMarkdown } from "./lib/file-writer.ts";
import { initializeOrgmConfig, orgmConfigPath } from "./lib/orgm-config.ts";
import { scanRepository } from "./lib/repo-scan.ts";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("orgm-init", {
		description: "Generate ORGM CONTEXT.md and AGENTS.md for this project",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const root = ctx.cwd;
			const scan = await scanRepository(root);
			await writeManagedMarkdown(join(root, "CONTEXT.md"), renderContextMarkdown(scan));
			await writeManagedMarkdown(join(root, "AGENTS.md"), renderAgentsMarkdown(scan));
			ctx.ui.notify("ORGM context files updated: CONTEXT.md, AGENTS.md", "success");
		},
	});

	pi.registerCommand("orgm-config-init", {
		description: "Materialize full ~/.pi/agent/orgm.json defaults",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const configPath = orgmConfigPath();
			initializeOrgmConfig(configPath);
			ctx.ui.notify(`ORGM config initialized: ${configPath}`, "success");
		},
	});
}
