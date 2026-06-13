import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { renderAgentsMarkdown, renderContextMarkdown, renderReviewPrompt } from "./lib/context-renderer.ts";
import { writeManagedMarkdown } from "./lib/file-writer.ts";
import { initializeOrgmConfig, orgmConfigPath } from "./lib/orgm-config.ts";
import { scanRepository } from "./lib/repo-scan.ts";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("orgm-init", {
		description: "Generate ORGM CONTEXT.md and AGENTS.md for this project",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const root = ctx.cwd;
			const scan = await scanRepository(root);
			const reviewPrompt = renderReviewPrompt(scan);
			await writeManagedMarkdown(join(root, "CONTEXT.md"), renderContextMarkdown(scan));
			await writeManagedMarkdown(join(root, "AGENTS.md"), renderAgentsMarkdown(scan));
			await writeManagedMarkdown(join(root, "ORGMINIT_REVIEW_PROMPT.md"), reviewPrompt);
			ctx.ui.notify("ORGM context files updated: CONTEXT.md, AGENTS.md, ORGMINIT_REVIEW_PROMPT.md", "success");

			if (!args.split(/\s+/).includes("--scan-only")) {
				const result = await ctx.newSession({
					withSession: async (reviewCtx) => {
						await reviewCtx.sendUserMessage(reviewPrompt);
					},
				});
				if (result.cancelled) ctx.ui.notify("ORGM init review session cancelled", "info");
			}
		},
	});

	pi.registerCommand("orgm-config-init", {
		description: "Materialize full ~/.pi/agent/orgm.json defaults",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			const configPath = orgmConfigPath();
			initializeOrgmConfig(configPath);
			ctx.ui.notify(`ORGM config initialized: ${configPath}`, "success");
		},
	});
}
