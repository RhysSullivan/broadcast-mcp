import { createMcpServer } from "@juliusmarminge/trpc-mcp";
import { z } from "zod";
import { createDraftData, deserializeFiles, serializedFileSchema } from "../lib/schemas";
import { updateWritingStyleMatrix } from "../services/writing-style-service";
import { activeDriverProcedure, router } from '../trpc/trpc';

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

export const createMCPServer = () => {
const toolRouter = router({
  createDraft: activeDriverProcedure
    .meta({
      mcp: {
        enabled: true,
        name: "createDraft",
        description: "Create a new draft email",
      },
    })
    .input(
     createDraftData
    )
    .mutation(async ({ input, ctx }) => { 
      console.log("ctx", ctx.session); 
    const { driver } = ctx;
    return driver.createDraft(input);
    }),
    get: activeDriverProcedure
    .meta({
      mcp: {
        enabled: true,
        name: "get",
        description: "Get an email by id",
      },
    })
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { driver } = ctx;
      return await driver.get(input.id);
    }),
  send: activeDriverProcedure
    .meta({
      mcp: {
        enabled: true,
        name: "send",
        description: "Send an email",
      },
    })
    .input(
      z.object({
        to: z.array(senderSchema),
        subject: z.string(),
        message: z.string(),
        attachments: z
          .array(serializedFileSchema)
          .transform(deserializeFiles)
          .optional()
          .default([]),
        headers: z.record(z.string()).optional().default({}),
        cc: z.array(senderSchema).optional(),
        bcc: z.array(senderSchema).optional(),
        threadId: z.string().optional(),
        fromEmail: z.string().optional(),
        draftId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver, activeConnection } = ctx;
      const { draftId, ...mail } = input;

      const afterTask = async () => {
        try {
          console.warn('Saving writing style matrix...');
          await updateWritingStyleMatrix(activeConnection.id, input.message);
          console.warn('Saved writing style matrix.');
        } catch (error) {
          console.error('Failed to save writing style matrix', error);
        }
      };

      if (draftId) {
        await driver.sendDraft(draftId, mail);
      } else {
        await driver.create(input);
      }

      ctx.c.executionCtx.waitUntil(afterTask());
      return { success: true };
    }),
    delete: activeDriverProcedure
    .meta({
      mcp: {
        enabled: true,
        name: "delete",
        description: "Delete an email by id",
      },
    })
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.delete(input.id);
    }),
    
});


const server =  createMcpServer({ name: "sharedMCP", version: "1.0.0" }, toolRouter);


  return server;
};