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
  private serverOrigin: string;
  private serverUrl: string;
  private isConnected = false;
  private messageQueue: [JSONRPCMessage, TransportSendOptions | undefined][] =
    [];

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    // Extract origin from the URL
    const url = new URL(serverUrl);
    this.serverOrigin = url.origin;
    console.log(
      "[PostMessageClientTransport] Initialized with server URL:",
      serverUrl,
      "and origin:",
      this.serverOrigin
    );
  }

  async start(): Promise<void> {
    console.log("[PostMessageClientTransport] Starting connection attempt...");
    // Open the server window
    this.serverWindow = window.open(this.serverUrl, "_blank");
    if (!this.serverWindow) {
      console.error(
        "[PostMessageClientTransport] Failed to open server window"
      );
      throw new Error("Failed to open server window");
    }
    console.log(
      "[PostMessageClientTransport] Server window opened successfully"
    );

    // Set up message listener
    window.addEventListener("message", this.handleMessage);
    console.log("[PostMessageClientTransport] Message listener attached");

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(
          "[PostMessageClientTransport] Connection timeout after 10 seconds"
        );
        reject(new Error("Server connection timeout"));
      }, 10000); // 10 second timeout

      const readyHandler = (event: MessageEvent) => {
        if (
          event.data?.type === "MCP_SERVER_READY" &&
          event.data[MCP_TRANSPORT_ID]
        ) {
          console.log(
            "[PostMessageClientTransport] Server ready message received, establishing connection"
          );
          window.removeEventListener("message", readyHandler);
          clearTimeout(timeout);
          this.isConnected = true;
          resolve();
        }
      };

      window.addEventListener("message", readyHandler);
      console.log(
        "[PostMessageClientTransport] Waiting for server ready message..."
      );
    });

    // Send any queued messages
    console.log(
      `[PostMessageClientTransport] Connection established. Processing ${this.messageQueue.length} queued messages`
    );
    while (this.messageQueue.length > 0) {
      const [message, options] = this.messageQueue.shift()!;
      await this.send(message, options);
    }
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions
  ): Promise<void> {
    if (!this.isConnected) {
      console.log(
        "[PostMessageClientTransport] Not connected yet, queueing message:",
        message
      );
      // Queue message if not connected yet
      this.messageQueue.push([message, options]);
      return;
    }

    if (!this.serverWindow) {
      console.error(
        "[PostMessageClientTransport] Server window not available for sending"
      );
      throw new Error("Server window not available");
    }

    console.log(
      "[PostMessageClientTransport] Sending message:",
      message,
      "with options:",
      options
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
    console.log("[PostMessageClientTransport] Closing connection");
    if (this.serverWindow) {
      this.serverWindow.close();
      this.serverWindow = null;
    }
    window.removeEventListener("message", this.handleMessage);
    this.isConnected = false;
    if (this.onclose) {
      this.onclose();
    }
    console.log("[PostMessageClientTransport] Connection closed");
  }

  private handleMessage = (event: MessageEvent) => {
    // Only process and log messages with our transport ID
    if (!event.data?.[MCP_TRANSPORT_ID]) {
      return;
    }

    console.log(
      "[PostMessageClientTransport] Received message event from origin:",
      event.origin,
      "data:",
      event.data
    );

    if (event.data.type === "MCP_MESSAGE" && this.onmessage) {
      console.log(
        "[PostMessageClientTransport] Processing MCP message:",
        event.data.message
      );
      this.onmessage(event.data.message, event.data.extra);
    } else if (event.data.type === "MCP_ERROR" && this.onerror) {
      console.error(
        "[PostMessageClientTransport] Received error:",
        event.data.error
      );
      this.onerror(new Error(event.data.error));
    }
  };

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: any }) => void;
  sessionId?: string;
}

export class PostMessageServerTransport implements Transport {
  private clientWindow: Window | null = null;
  private clientOrigin: string | null = null;
  private isConnected = false;

  async start(): Promise<void> {
    console.log("[PostMessageServerTransport] Starting server...");
    // Server must be opened by a client
    if (!window.opener) {
      console.error("[PostMessageServerTransport] No opener window found");
      throw new Error("Server must be opened by a client window");
    }

    // Set up message listener
    window.addEventListener("message", this.handleMessage);
    console.log("[PostMessageServerTransport] Message listener attached");

    // Wait for first message from client to establish origin
    await new Promise<void>((resolve) => {
      const originHandler = (event: MessageEvent) => {
        if (event.source === window.opener) {
          this.clientWindow = window.opener;
          this.isConnected = true;
          window.removeEventListener("message", originHandler);
          console.log(
            "[PostMessageServerTransport] Client connection established with origin:",
            this.clientOrigin
          );
          resolve();
        }
      };
      window.addEventListener("message", originHandler);

      // Notify opener we're ready
      console.log(
        "[PostMessageServerTransport] Sending ready message to opener"
      );
      window.opener.postMessage(
        {
          type: "MCP_SERVER_READY",
          [MCP_TRANSPORT_ID]: true,
        },
        "*"
      );
    });
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions
  ): Promise<void> {
    if (!this.isConnected || !this.clientWindow || !this.clientOrigin) {
      console.error(
        "[PostMessageServerTransport] Cannot send - not connected to client"
      );
      throw new Error("Not connected to client");
    }

    console.log(
      "[PostMessageServerTransport] Sending message:",
      message,
      "with options:",
      options
    );
    this.clientWindow.postMessage(
      {
        type: "MCP_MESSAGE",
        message,
        options,
        [MCP_TRANSPORT_ID]: true,
      },
      this.clientOrigin
    );
  }

  async close(): Promise<void> {
    console.log("[PostMessageServerTransport] Closing server connection");
    window.removeEventListener("message", this.handleMessage);
    this.isConnected = false;
    this.clientWindow = null;
    this.clientOrigin = null;
    if (this.onclose) {
      this.onclose();
    }
    console.log("[PostMessageServerTransport] Server connection closed");
  }

  private handleMessage = (event: MessageEvent) => {
    // Only process and log messages with our transport ID
    if (!event.data?.[MCP_TRANSPORT_ID]) {
      return;
    }

    console.log(
      "[PostMessageServerTransport] Received message event from origin:",
      event.origin,
      "data:",
      event.data
    );

    if (event.data.type === "MCP_MESSAGE" && this.onmessage) {
      console.log(
        "[PostMessageServerTransport] Processing MCP message:",
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
