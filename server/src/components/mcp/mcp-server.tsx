import {
  PostMessageClientTransport,
  PostMessageServerTransport,
} from "@/lib/broadcastTransport";
import {
  McpServer,
  ReadResourceCallback,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { createContext, useContext, ReactNode, useCallback } from "react";

const McpServerContext = createContext<McpServer | null>(null);

export function useMcpServer() {
  const context = useContext(McpServerContext);
  if (!context) {
    throw new Error("useMcpServer must be used within a RegisterMcpServer");
  }

  return context;
}

const transport = new PostMessageServerTransport();

export function RegisterMcpServer(props: {
  allowedOrigins: string[];
  serverInfo: Implementation;
  register?: (server: McpServer) => void;
  children?: ReactNode;
}) {
  let server = new McpServer(props.serverInfo);

  props.register?.(server);
  server.connect(transport);

  const registerTool = useCallback(
    (name: string, description: string, cb: ToolCallback) => {
      server.tool(name, description, cb);
    },
    [server]
  );

  const registerResource = useCallback(
    (name: string, description: string, cb: ReadResourceCallback) => {
      server.resource(name, description, cb);
    },
    [server]
  );

  return (
    <McpServerContext.Provider value={server}>
      {props.children}
    </McpServerContext.Provider>
  );
}
