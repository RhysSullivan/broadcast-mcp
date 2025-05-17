import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./tools.js";

const transport = new StdioServerTransport();

console.log("Starting MCP server");

await createMCPServer()
  .connect(transport)
  .catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });