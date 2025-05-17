import { PostMessageServerTransport } from "./transport";
import {
  McpServer,
  ReadResourceCallback,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { createContext, useContext, ReactNode } from "react";

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

  return (
    <McpServerContext.Provider value={server}>
      {props.children}
    </McpServerContext.Provider>
  );
}
