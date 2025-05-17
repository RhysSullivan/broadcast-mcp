import { NextRequest, NextResponse } from "next/server";
import { saveMessages, convertToDBMessages } from "@/lib/chat-store";

export async function POST(req: NextRequest) {
  try {
    const { messages, chatId } = await req.json();

    // Convert messages to DB format
    const dbMessages = convertToDBMessages(messages, chatId);

    // Save messages to database
    await saveMessages({ messages: dbMessages });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving messages:", error);
    return NextResponse.json(
      { error: "Failed to save messages" },
      { status: 500 }
    );
  }
}
