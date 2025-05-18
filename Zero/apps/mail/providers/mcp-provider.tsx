'use client';
import { RegisterMcpServer } from 'broadcast-mcp';
import { trpcClient } from './query-provider';
import { defaultPageSize } from '@/lib/utils';
import { z } from 'zod';

export function MCPProvider(props: { children: React.ReactNode }) {
  return (
    <RegisterMcpServer
      allowedOrigins={[]}
      serverInfo={{
        name: 'zero-email',
        version: '1.0.0',
      }}
      register={(server) => {
        server.tool(
          'drafts-create',
          { subject: z.string(), message: z.string(), to: z.string() },
          async ({ subject, message, to }: { subject: string; message: string; to: string }) => {
            const draft = await trpcClient.drafts.create.mutate({ subject, message, to });
            return {
              content: [{ type: 'text', text: JSON.stringify(draft) }],
            };
          },
        );
        server.tool(
          'drafts-list',
          {
            q: z.string().optional().default(''),
            max: z.number().optional().default(defaultPageSize),
            cursor: z.string().optional().default(''),
          },
          async ({ q, max, cursor }) => {
            const drafts = await trpcClient.drafts.list.query({
              q,
              max,
              pageToken: cursor,
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(drafts) }],
            };
          },
        );
        server.tool(
          'mail-send',
          { subject: z.string(), message: z.string(), to: z.string() },
          async ({ subject, message, to }: { subject: string; message: string; to: string }) => {
            const draft = await trpcClient.mail.send.mutate({
              subject,
              message,
              to: [{ email: to }],
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(draft) }],
            };
          },
        );
        server.tool('mail-delete', { id: z.string() }, async ({ id }: { id: string }) => {
          const draft = await trpcClient.mail.delete.mutate({ id });
          return {
            content: [{ type: 'text', text: JSON.stringify(draft) }],
          };
        });
        server.tool('mail-get', { id: z.string() }, async ({ id }: { id: string }) => {
          const draft = await trpcClient.mail.get.query({ id });
          return {
            content: [{ type: 'text', text: JSON.stringify(draft) }],
          };
        });
      }}
    >
      {props.children}
    </RegisterMcpServer>
  );
}
