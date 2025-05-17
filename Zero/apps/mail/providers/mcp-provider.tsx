'use client';
import { RegisterMcpServer } from 'mcp-browser-transport';
import { trpcClient } from './query-provider';
import { z } from 'zod';

export function MCPProvider(props: { children: React.ReactNode }) {
  return (
    <RegisterMcpServer
      allowedOrigins={[]}
      serverInfo={{
        name: 'zero.email',
        version: '1.0.0',
      }}
      register={(server) => {
        server.tool(
          'drafts.create',
          { subject: z.string(), message: z.string(), to: z.string() },
          async ({ subject, message, to }) => {
            const draft = await trpcClient.drafts.create.mutate({ subject, message, to });
            return {
              content: [{ type: 'text', text: JSON.stringify(draft) }],
            };
          },
        );
      }}
    >
      {props.children}
    </RegisterMcpServer>
  );
}
