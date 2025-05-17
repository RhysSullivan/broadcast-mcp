/// <reference lib="dom" />

import {
  type Transport,
  type TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import { type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

// Use a unique string identifier for our transport messages
const MCP_TRANSPORT_ID = "__mcp_transport_message_9d7c2f8e";

export class PostMessageClientTransport implements Transport {
  private serverWindow: Window | null = null;
  private serverOrigin: string | null = null;
  private isConnected = false;
  private messageQueue: {
    message: JSONRPCMessage;
    options?: TransportSendOptions;
  }[] = [];
  private connectionPromise: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;

  async start(): Promise<void> {
    console.log(
      "DEBUG - [PostMessageClientTransport] Starting connection attempt..."
    );

    if (this.isConnected) {
      console.log("DEBUG - [PostMessageClientTransport] Already connected");
      return;
    }

    if (this.connectionPromise) {
      console.log(
        "DEBUG - [PostMessageClientTransport] Connection already in progress, waiting..."
      );
      return this.connectionPromise;
    }

    // Create a window that hosts the server in an iframe
    const serverWindow = window.open(
      "http://localhost:3001",
      "_blank",
      "width=400,height=400"
    );

    if (!serverWindow) {
      throw new Error("Failed to open server window");
    }

    console.log(
      "DEBUG - [PostMessageClientTransport] Server window opened successfully"
    );
    this.serverWindow = serverWindow;

    // Set up message listener
    window.addEventListener("message", this.handleMessage);
    console.log(
      "DEBUG - [PostMessageClientTransport] Message listener attached"
    );

    // Create a promise that resolves when connection is established
    this.connectionPromise = new Promise<void>((resolve) => {
      this.connectionResolve = resolve;
    });

    // Wait for connection
    await this.connectionPromise;

    // Process any messages that were queued while waiting for connection
    console.log(
      `DEBUG - [PostMessageClientTransport] Connection established. Processing ${this.messageQueue.length} queued messages`
    );

    // Process any queued messages
    const queuedMessages = [...this.messageQueue];
    this.messageQueue = [];
    for (const { message, options } of queuedMessages) {
      await this.send(message, options);
    }
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions
  ): Promise<void> {
    if (!this.isConnected) {
      console.log(
        "DEBUG - [PostMessageClientTransport] Not connected yet, queueing message:",
        message
      );
      this.messageQueue.push({ message, options });
      return;
    }

    if (!this.serverWindow || !this.serverOrigin) {
      throw new Error("Transport not started");
    }

    console.log(
      "DEBUG - [PostMessageClientTransport] Sending message:",
      message
    );
    this.serverWindow.postMessage(
      {
        type: "MCP_MESSAGE",
        message,
        options,
        [MCP_TRANSPORT_ID]: true,
      },
      this.serverOrigin
    );
  }

  async close(): Promise<void> {
    console.log("DEBUG - [PostMessageClientTransport] Closing connection");

    window.removeEventListener("message", this.handleMessage);

    if (this.serverWindow) {
      this.serverWindow.close();
      this.serverWindow = null;
    }

    this.isConnected = false;
    this.serverOrigin = null;
    this.messageQueue = [];
    this.connectionPromise = null;
    this.connectionResolve = null;

    if (this.onclose) {
      this.onclose();
    }
  }

  private handleMessage = (event: MessageEvent) => {
    // Only process messages with our transport ID
    if (!event.data?.[MCP_TRANSPORT_ID]) {
      return;
    }

    console.log(
      "DEBUG - [PostMessageClientTransport] Received message event from origin:",
      event.origin,
      "data:",
      event.data
    );

    // Handle server ready message
    if (event.data.type === "MCP_SERVER_READY" && !this.isConnected) {
      console.log(
        "DEBUG - [PostMessageClientTransport] Server ready message received"
      );
      this.isConnected = true;
      this.serverOrigin = event.origin;

      if (this.connectionResolve) {
        this.connectionResolve();
        this.connectionResolve = null;
      }
      return;
    }

    // Skip repeated ready messages
    if (event.data.type === "MCP_SERVER_READY" && this.isConnected) {
      console.log(
        "DEBUG - [PostMessageClientTransport] Ignoring duplicate server ready message"
      );
      return;
    }

    // Handle MCP message
    if (event.data.type === "MCP_MESSAGE" && this.onmessage) {
      console.log(
        "DEBUG - [PostMessageClientTransport] Processing MCP message:",
        event.data.message
      );
      this.onmessage(event.data.message, event.data.extra);
    }
  };

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: any }) => void;
  sessionId?: string;
}
