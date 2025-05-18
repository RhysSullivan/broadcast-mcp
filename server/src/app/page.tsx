"use client";
import { RegisterMcpServer } from "mcp-browser-transport";
import { useState } from "react";
import { z } from "zod";

export default function MyMcp(props: { children: React.ReactNode }) {
  const [counter, setCounter] = useState(0);
  const [bgColor, setBgColor] = useState("#ffffff");

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

        server.tool(
          "set-background-color",
          {
            color: z.string(),
          },
          async ({ color }) => {
            if (color) {
              setBgColor(color);
              return {
                content: [
                  { type: "text", text: `Background color set to ${color}` },
                ],
              };
            }
            return {
              content: [{ type: "text", text: "No color provided" }],
            };
          }
        );
      }}
    >
      <div
        className="font-bold items-center flex justify-center h-full w-full text-center"
        style={{ fontSize: "800px", backgroundColor: bgColor }}
      >
        {counter}
      </div>
    </RegisterMcpServer>
  );
}
