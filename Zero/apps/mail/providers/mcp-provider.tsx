'use client';
import { useQueryClient } from '@tanstack/react-query';
import { RegisterMcpServer } from 'broadcast-mcp';
import { trpcClient } from './query-provider';
import { defaultPageSize } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

export function MCPProvider(props: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  console.log(queryClient);
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
          async ({ subject, message, to }) => {
            const draft = await trpcClient.drafts.create.mutate({ subject, message, to });
            queryClient.invalidateQueries({ queryKey: ['drafts'] });
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
            queryClient.invalidateQueries({ queryKey: ['drafts'] });
            return {
              content: [{ type: 'text', text: JSON.stringify(drafts) }],
            };
          },
        );
        server.tool('mail-delete', { id: z.string() }, async ({ id }) => {
          const draft = await trpcClient.mail.delete.mutate({ id });
          queryClient.invalidateQueries({ queryKey: ['drafts'] });
          return {
            content: [{ type: 'text', text: JSON.stringify(draft) }],
          };
        });
        server.tool('mail-get', { id: z.string() }, async ({ id }) => {
          const draft = await trpcClient.mail.get.query({ id });
          queryClient.invalidateQueries({ queryKey: ['drafts'] });
          return {
            content: [{ type: 'text', text: JSON.stringify(draft) }],
          };
        });
        server.tool(
          'mail-send',
          {
            to: z.array(z.object({ email: z.string() })),
            subject: z.string(),
            message: z.string(),
          },
          async ({ to, subject, message }) => {
            const result = await trpcClient.mail.send.mutate({ to, subject, message });
            queryClient.invalidateQueries({ queryKey: ['mail'] });
            return {
              content: [{ type: 'text', text: JSON.stringify(result) }],
            };
          },
        );
      }}
    >
      {props.children}
    </RegisterMcpServer>
  );
}
