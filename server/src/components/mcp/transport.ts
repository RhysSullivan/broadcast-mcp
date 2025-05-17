/// <reference lib="dom" />

import {
  type Transport,
  type TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import { type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

// Use a unique string identifier for our transport messages
const MCP_TRANSPORT_ID = "__mcp_transport_message_9d7c2f8e";

export class PostMessageServerTransport implements Transport {
  private clientWindow: Window | null = null;
  private clientOrigin: string | null = null;
  private isConnected = false;
  private connectionEstablished = false;

  async start(): Promise<void> {
    console.log("DEBUG - [PostMessageServerTransport] Starting server...");
    // Server must be opened by a client
    if (!window.opener) {
      console.error(
        "DEBUG - [PostMessageServerTransport] No opener window found"
      );
      throw new Error("Server must be opened by a client window");
    }

    // Set up message listener
    window.addEventListener("message", this.handleMessage);
    console.log(
      "DEBUG - [PostMessageServerTransport] Message listener attached"
    );

    // Wait for first message from client to establish origin
    await new Promise<void>((resolve) => {
      // Notify opener we're ready once
      console.log(
        "DEBUG - [PostMessageServerTransport] Sending ready message to opener"
      );
      window.opener.postMessage(
        {
          type: "MCP_SERVER_READY",
          [MCP_TRANSPORT_ID]: true,
        },
        "*"
      );

      // Function to check if we're connected
      const checkConnection = () => {
        if (this.connectionEstablished) {
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions
  ): Promise<void> {
    if (!this.isConnected || !this.clientWindow || !this.clientOrigin) {
      console.error(
        "DEBUG - [PostMessageServerTransport] Cannot send - not connected to client"
      );
      throw new Error("Not connected to client");
    }

    console.log(
      "DEBUG - [PostMessageServerTransport] Sending message:",
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
    console.log(
      "DEBUG - [PostMessageServerTransport] Closing server connection"
    );
    window.removeEventListener("message", this.handleMessage);
    this.isConnected = false;
    this.connectionEstablished = false;
    this.clientWindow = null;
    this.clientOrigin = null;
    if (this.onclose) {
      this.onclose();
    }
    console.log(
      "DEBUG - [PostMessageServerTransport] Server connection closed"
    );
  }

  private handleMessage = (event: MessageEvent) => {
    // Only process and log messages with our transport ID
    if (!event.data?.[MCP_TRANSPORT_ID]) {
      return;
    }

    console.log(
      "DEBUG - [PostMessageServerTransport] Received message event from origin:",
      event.origin,
      "data:",
      event.data
    );

    // If this is our first message, establish the client connection
    if (!this.isConnected && event.source === window.opener) {
      console.log(
        "DEBUG - [PostMessageServerTransport] Establishing client connection"
      );
      this.clientWindow = window.opener;
      this.clientOrigin = event.origin;
      this.isConnected = true;
      this.connectionEstablished = true;
      console.log(
        "DEBUG - [PostMessageServerTransport] Client connection established with origin:",
        this.clientOrigin
      );
    }

    if (event.data.type === "MCP_MESSAGE" && this.onmessage) {
      console.log(
        "DEBUG - [PostMessageServerTransport] Processing MCP message:",
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
