import "./style.css";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { PostMessageClientTransport } from "../../../src/index.js";

const connectBtn = document.getElementById("connectBtn") as HTMLButtonElement;
const messageControls = document.getElementById("messageControls")!;
const messageInput = document.getElementById(
  "messageInput"
) as HTMLInputElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const logElement = document.getElementById("log")!;
const statusElement = document.getElementById("status")!;

let client: Client | undefined;

function addLogEntry(message: string) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logElement.appendChild(entry);
  logElement.scrollTop = logElement.scrollHeight;
}

async function connectToServer() {
  try {
    statusElement.textContent = "Status: Connecting...";
    connectBtn.disabled = true;

    // Create client and transport
    client = new Client({
      name: "Demo Client",
      version: "1.0.0",
    });

    const transport = new PostMessageClientTransport("http://localhost:3000");

    transport.onclose = () => {
      statusElement.textContent = "Status: Disconnected";
      connectBtn.disabled = false;
      messageControls.style.display = "none";
      addLogEntry("Disconnected from server");
    };

    // Connect to server
    await client.connect(transport);

    statusElement.textContent = "Status: Connected";
    messageControls.style.display = "block";
    addLogEntry("Connected to server");

    // List available tools
    const tools = await client.listTools();
    addLogEntry(
      `Available tools: ${tools.tools.map((t) => t.name).join(", ")}`
    );
  } catch (error) {
    statusElement.textContent = "Status: Connection failed";
    connectBtn.disabled = false;
    addLogEntry(`Connection error: ${error}`);
  }
}

async function sendMessage() {
  if (!client) return;

  const message = messageInput.value.trim();
  if (!message) return;

  try {
    messageInput.disabled = true;
    sendBtn.disabled = true;

    addLogEntry(`Sending message: ${message}`);
    const response = await client.callTool({
      name: "echo",
      arguments: { message },
    });

    if (response && typeof response === "object" && "content" in response) {
      const content = response.content;
      if (
        Array.isArray(content) &&
        content.length > 0 &&
        "text" in content[0]
      ) {
        addLogEntry(`Server response: ${content[0].text}`);
      } else {
        addLogEntry("Server response: Invalid response format");
      }
    } else {
      addLogEntry("Server response: No response received");
    }

    messageInput.value = "";
  } catch (error) {
    addLogEntry(`Error sending message: ${error}`);
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// Event listeners
connectBtn.addEventListener("click", connectToServer);
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
