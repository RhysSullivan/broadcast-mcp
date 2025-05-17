"use client";
import { RegisterMcpServer } from "mcp-browser-transport";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { useState } from "react";
import { z } from "zod";
export function MyMcp(props: { children: React.ReactNode }) {
  const [counter, setCounter] = useState(0);
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
        server.tool("increase-count", async () => {
          setCounter(counter + 1);
          // wait 10 seconds
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return {
            content: [{ type: "text", text: String(counter) }],
          };
        });
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
      <div>Counter: {counter}</div>
    </RegisterMcpServer>
  );
}
