"use client";
import { RegisterMcpServer } from "mcp-browser-transport";
import { useState } from "react";

export default function MyMcp(props: { children: React.ReactNode }) {
  const [counter, setCounter] = useState(0);
  return (
    <RegisterMcpServer
      allowedOrigins={["google.com"]}
      serverInfo={{
        name: "Demo",
        version: "1.0.0",
      }}
      register={(server) => {
        server.tool("increase-count", async () => {
          setCounter(counter + 1);
          return {
            content: [{ type: "text", text: String(counter + 1) }],
          };
        });
      }}
    >
      <div
        className="font-bold items-center flex justify-center h-full w-full text-center"
        style={{ fontSize: "800px" }}
      >
        {counter}
      </div>
    </RegisterMcpServer>
  );
}
