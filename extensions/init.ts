import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { initializeOrgmConfig, orgmConfigPath } from "./lib/orgm-config.ts";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("orgm-init", {
		description: "Materialize full ~/.pi/agent/orgm.json defaults",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const configPath = orgmConfigPath();
			initializeOrgmConfig(configPath);
			ctx.ui.notify(`ORGM config initialized: ${configPath}`, "success");
		},
	});
}
