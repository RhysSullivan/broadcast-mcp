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
    // Only process and log messages with our transport ID and a source window
    if (!event.data?.[MCP_TRANSPORT_ID] || !event.source) {
      return;
    }
    const clientSourceWindow = event.source as Window;

    console.log(
      "DEBUG - [PostMessageServerTransport] Received message event from origin:",
      event.origin,
      "data:",
      event.data,
      "current isConnected:",
      this.isConnected,
      "current connectionEstablished:",
      this.connectionEstablished
    );

    // Handle MCP_CLIENT_PING: Client is trying to reconnect to an existing window
    if (event.data.type === "MCP_CLIENT_PING") {
      console.log(
        "DEBUG - [PostMessageServerTransport] Received MCP_CLIENT_PING from origin:",
        event.origin
      );
      // Client is attempting to (re)connect or verify connection to this server window.
      // Update our record of the client and send MCP_SERVER_READY.
      this.clientWindow = clientSourceWindow;
      this.clientOrigin = event.origin;
      this.isConnected = true;
      this.connectionEstablished = true; // Ensure this is also true, as client expects a working server.

      clientSourceWindow.postMessage(
        { type: "MCP_SERVER_READY", [MCP_TRANSPORT_ID]: true },
        event.origin
      );
      console.log(
        "DEBUG - [PostMessageServerTransport] Responded to PING with MCP_SERVER_READY for origin:",
        event.origin
      );
      return; // PING handled, no further processing for this message.
    }

    // If this is the first time we're hearing from this client (based on source and origin)
    // or if we were previously disconnected. This establishes/re-establishes the primary client context.
    if (
      !this.clientWindow ||
      this.clientWindow !== clientSourceWindow ||
      this.clientOrigin !== event.origin ||
      !this.isConnected
    ) {
      console.log(
        "DEBUG - [PostMessageServerTransport] Establishing/Re-establishing client connection for messaging."
      );
      this.clientWindow = clientSourceWindow;
      this.clientOrigin = event.origin;
      this.isConnected = true;
      // connectionEstablished is set true when the server start() promise resolves after first ready, or by PING.
      // We should ensure it's true if we are accepting messages.
      this.connectionEstablished = true;
      console.log(
        "DEBUG - [PostMessageServerTransport] Client connection for messaging (re)established with origin:",
        this.clientOrigin
      );
      // Note: The initial MCP_SERVER_READY is sent by server's start().
      // Regular messages imply client already received that or will receive it via PING.
    }

    // If this is our first message, establish the client connection (original logic, slightly adapted)
    // This section might be redundant if the above block handles all (re-)establishment cases.
    // Let's keep the original intent for the very first message that isn't a PING.
    if (
      !this.connectionEstablished && // Only if server hasn't considered itself fully established with a client yet.
      (clientSourceWindow === window.opener ||
        clientSourceWindow === window.parent)
    ) {
      console.log(
        "DEBUG - [PostMessageServerTransport] First message from opener/parent, establishing initial client connection."
      );
      this.clientWindow = clientSourceWindow;
      this.clientOrigin = event.origin;
      this.isConnected = true;
      this.connectionEstablished = true;
      console.log(
        "DEBUG - [PostMessageServerTransport] Client connection established with origin (via initial message check):",
        this.clientOrigin
      );
    }

    if (event.data.type === "MCP_MESSAGE" && this.onmessage) {
      if (!this.isConnected || !this.clientWindow || !this.clientOrigin) {
        console.warn(
          "DEBUG - [PostMessageServerTransport] Received MCP_MESSAGE but not fully connected/client unknown. Origin:",
          event.origin,
          "Data:",
          event.data.message
        );
        // Attempt to re-establish, in case PING was missed or this is a valid new client.
        this.clientWindow = clientSourceWindow;
        this.clientOrigin = event.origin;
        this.isConnected = true;
        this.connectionEstablished = true;
        console.warn(
          "DEBUG - [PostMessageServerTransport] Force re-established connection on MCP_MESSAGE due to inconsistent state."
        );
      }
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

export interface PostMessageClientTransportOptions {
  serverUrl: string;
  openMethod?: "window" | "iframe";
  keepWindowOpen?: boolean;
}

export class PostMessageClientTransport implements Transport {
  private static serverWindows = new Map<string, Window | HTMLIFrameElement>();

  private serverWindow: Window | null = null;
  private serverIFrame: HTMLIFrameElement | null = null;
  private serverOrigin: string | null = null;
  private isConnected = false;
  private messageQueue: {
    message: JSONRPCMessage;
    options?: TransportSendOptions;
  }[] = [];
  private connectionPromise: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;
  private options: PostMessageClientTransportOptions;

  constructor(options: PostMessageClientTransportOptions) {
    this.options = {
      openMethod: "window",
      keepWindowOpen: false,
      ...options,
    };

    const existingServer = PostMessageClientTransport.serverWindows.get(
      this.options.serverUrl
    );

    if (this.options.keepWindowOpen && existingServer) {
      if (
        this.options.openMethod === "iframe" &&
        existingServer instanceof HTMLIFrameElement
      ) {
        this.serverIFrame = existingServer;
        this.serverWindow = existingServer.contentWindow;
        console.log(
          "DEBUG - [PostMessageClientTransport] Reusing existing server iframe for URL:",
          this.options.serverUrl
        );
      } else if (
        this.options.openMethod === "window" &&
        existingServer instanceof Window &&
        !existingServer.closed
      ) {
        this.serverWindow = existingServer;
        console.log(
          "DEBUG - [PostMessageClientTransport] Reusing existing server window for URL:",
          this.options.serverUrl
        );
      }
    }

    if (!this.serverWindow) {
      if (this.options.openMethod === "iframe") {
        // Create an invisible iframe to host the server
        const iframe = document.createElement("iframe");
        iframe.style.display = "none"; // Hide the iframe
        iframe.src = this.options.serverUrl;
        document.body.appendChild(iframe);

        if (!iframe.contentWindow) {
          throw new Error("Failed to create server iframe");
        }

        console.log(
          "DEBUG - [PostMessageClientTransport] Server iframe created successfully for URL:",
          this.options.serverUrl
        );
        this.serverIFrame = iframe;
        this.serverWindow = iframe.contentWindow;
        if (this.options.keepWindowOpen) {
          PostMessageClientTransport.serverWindows.set(
            this.options.serverUrl,
            iframe
          );
        }
      } else {
        // Open a new window
        // Ensure we don't try to reopen a window that might be in the process of closing
        // or that might have been closed by the user if keepWindowOpen was false previously.
        let targetName = "_blank";
        if (this.options.keepWindowOpen) {
          // Attempt to give it a consistent name if we want to keep it open,
          // which might help in re-focusing or re-attaching if supported by browser policies.
          // However, window.open with the same name might just focus an existing window,
          // so direct reuse via the map is more reliable.
          targetName = `mcp_server_${encodeURIComponent(
            this.options.serverUrl
          )}`;
        }
        const serverWindow = window.open(this.options.serverUrl, targetName);
        if (!serverWindow) {
          throw new Error("Failed to open server window");
        }
        console.log(
          "DEBUG - [PostMessageClientTransport] Server window opened successfully for URL:",
          this.options.serverUrl
        );
        this.serverWindow = serverWindow;
        if (this.options.keepWindowOpen) {
          PostMessageClientTransport.serverWindows.set(
            this.options.serverUrl,
            serverWindow
          );
        }
      }
    }
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

    // Critical: Check if the window we are supposed to reuse is actually still open.
    if (this.serverWindow && this.serverWindow.closed) {
      console.warn(
        "DEBUG - [PostMessageClientTransport] Server window was previously open but is now closed. This transport instance cannot reconnect."
      );
      // Remove it from our own static map as it's dead.
      PostMessageClientTransport.serverWindows.delete(this.options.serverUrl);
      this.serverWindow = null;
      this.serverIFrame = null;
      throw new Error(
        "Server window is closed; cannot restart this transport instance. A new transport instance should be created."
      );
    }

    // If serverWindow is null but keepWindowOpen is true, something is wrong (constructor should have handled it or window was closed and logic above hit).
    if (!this.serverWindow && this.options.keepWindowOpen) {
      console.error(
        "DEBUG - [PostMessageClientTransport] serverWindow is null in start(), but keepWindowOpen is true and window not detected as closed. This implies it was never opened or improperly cleaned up."
      );
      throw new Error(
        "Cannot start transport: server window is missing despite keepWindowOpen being true."
      );
    }

    window.addEventListener("message", this.handleMessage);
    console.log(
      "DEBUG - [PostMessageClientTransport] Message listener attached"
    );

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectionResolve = resolve;
      // TODO: Consider adding a timeout that calls reject if MCP_SERVER_READY isn't received.
    });

    if (this.serverWindow && !this.isConnected && this.options.keepWindowOpen) {
      // This implies we are trying to reconnect to an existing, open window because close() was called.
      console.log(
        "DEBUG - [PostMessageClientTransport] Attempting to reconnect to existing window. Sending MCP_CLIENT_PING."
      );
      this.serverWindow.postMessage(
        {
          type: "MCP_CLIENT_PING",
          [MCP_TRANSPORT_ID]: true,
        },
        "*" // Server will respond from its origin, allowing us to re-establish this.serverOrigin
      );
    } else if (!this.serverWindow && !this.options.keepWindowOpen) {
      // This is a normal first start for a window that won't be kept open.
      // The window was opened by the constructor. Server in that window will send MCP_SERVER_READY.
      console.log(
        "DEBUG - [PostMessageClientTransport] Fresh start for non-kept window. Awaiting initial MCP_SERVER_READY."
      );
    } else if (this.serverWindow && !this.options.keepWindowOpen) {
      // This state should ideally not be hit if keepWindowOpen is false, as close() would null serverWindow.
      // If it is hit, it's like a fresh start.
      console.log(
        "DEBUG - [PostMessageClientTransport] Starting with a window that won't be kept open. Awaiting initial MCP_SERVER_READY."
      );
    } else if (!this.serverWindow && this.options.keepWindowOpen) {
      // This case is covered by the error throw above.
      // If !this.serverWindow but keepWindowOpen is true, means constructor failed or window was closed and not handled.
      // This log is for completeness but shouldn't be reached if error above is active.
      console.log(
        "DEBUG - [PostMessageClientTransport] Fresh start for kept window. Awaiting initial MCP_SERVER_READY."
      );
    }

    await this.connectionPromise;

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

    if (this.serverWindow && !this.options.keepWindowOpen) {
      if (this.options.openMethod === "iframe" && this.serverIFrame) {
        if (this.serverIFrame.parentNode) {
          this.serverIFrame.parentNode.removeChild(this.serverIFrame);
        }
        PostMessageClientTransport.serverWindows.delete(this.options.serverUrl);
        this.serverIFrame = null;
      } else if (
        this.options.openMethod === "window" &&
        this.serverWindow &&
        !this.serverWindow.closed
      ) {
        this.serverWindow.close();
        PostMessageClientTransport.serverWindows.delete(this.options.serverUrl);
      }
      this.serverWindow = null;
    }
    // If keepWindowOpen is true, we don't close the window or remove the iframe,
    // but we still need to clean up the transport state.

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
