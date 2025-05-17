// <reference lib="dom" />

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

    // Server must be opened by a client - either as a window or iframe
    const parentWindow = window.opener || window.parent;
    if (parentWindow === window) {
      console.error(
        "DEBUG - [PostMessageServerTransport] No parent or opener window found"
      );
      throw new Error("Server must be opened by a client");
    }

    // Set up message listener
    window.addEventListener("message", this.handleMessage);
    console.log(
      "DEBUG - [PostMessageServerTransport] Message listener attached"
    );

    // Wait for first message from client to establish origin
    await new Promise<void>((resolve) => {
      // Notify parent we're ready once
      console.log(
        "DEBUG - [PostMessageServerTransport] Sending ready message to parent"
      );
      parentWindow.postMessage(
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
    if (
      !this.isConnected &&
      (event.source === window.opener || event.source === window.parent)
    ) {
      console.log(
        "DEBUG - [PostMessageServerTransport] Establishing client connection"
      );
      this.clientWindow = event.source as Window;
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
  private serverUrl: string;
  private openMethod: "window" | "iframe";

  constructor(serverUrl: string, openMethod: "window" | "iframe" = "window") {
    this.serverUrl = serverUrl;
    this.openMethod = openMethod;
  }

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

    if (this.openMethod === "iframe") {
      // Create an invisible iframe to host the server
      const iframe = document.createElement("iframe");
      iframe.style.display = "none"; // Hide the iframe
      iframe.src = this.serverUrl;
      document.body.appendChild(iframe);

      if (!iframe.contentWindow) {
        throw new Error("Failed to create server iframe");
      }

      console.log(
        "DEBUG - [PostMessageClientTransport] Server iframe created successfully"
      );
      this.serverWindow = iframe.contentWindow;
    } else {
      // Open a new window
      const serverWindow = window.open(this.serverUrl, "_blank");
      if (!serverWindow) {
        throw new Error("Failed to open server window");
      }
      console.log(
        "DEBUG - [PostMessageClientTransport] Server window opened successfully"
      );
      this.serverWindow = serverWindow;
    }

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
      if (this.openMethod === "iframe") {
        const iframe = this.serverWindow.frameElement as HTMLIFrameElement;
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } else {
        this.serverWindow.close();
      }
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
