"use client";
import { RegisterMcpServer } from "@/components/mcp/mcp-server";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
export function MyMcp(props: { children: React.ReactNode }) {
  return (
    <RegisterMcpServer
      allowedOrigins={["google.com"]}
      serverInfo={{
        name: "Demo",
        version: "1.0.0",
      }}
      register={(server) => {
        server.tool(
          "add",
          { a: z.number(), b: z.number() },
          async ({ a, b }) => ({
            content: [{ type: "text", text: String(a + b) }],
          })
        );
        server.resource(
          "greeting",
          new ResourceTemplate("greeting://{name}", { list: undefined }),
          async (uri, { name }) => ({
            contents: [{ uri: uri.href, text: `Hello, ${name}!` }],
          })
        );
      }}
    >
      {props.children}
    </RegisterMcpServer>
  );
}
