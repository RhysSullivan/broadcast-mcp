import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PostMessageServerTransport } from "../../../src/index.js";
import { z } from "zod";

const logElement = document.getElementById("log")!;
const statusElement = document.getElementById("status")!;

function addLogEntry(message: string) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logElement.appendChild(entry);
  logElement.scrollTop = logElement.scrollHeight;
}

// Create MCP server
const server = new McpServer({
  name: "Demo Server",
  version: "1.0.0",
});

// Add a simple echo tool
server.tool("echo", { message: z.string() }, async ({ message }) => {
  addLogEntry(`Echo tool called with message: ${message}`);
  return {
    content: [{ type: "text", text: `Server received: ${message}` }],
  };
});

// Create and start transport
const transport = new PostMessageServerTransport();

transport.onclose = () => {
  statusElement.textContent = "Status: Disconnected";
  addLogEntry("Client disconnected");
};

try {
  await server.connect(transport);
  statusElement.textContent = "Status: Ready for connections";
  addLogEntry("Server started and ready for connections");
} catch (error) {
  statusElement.textContent = "Status: Error starting server";
  addLogEntry(`Error starting server: ${error}`);
}
