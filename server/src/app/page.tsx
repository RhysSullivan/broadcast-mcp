"use client";
import { RegisterMcpServer, useMcpServer } from "@/components/mcp/mcp-server";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function Email(props: {
  email: { from: string; subject: string; body: string };
}) {
  const server = useMcpServer();

  // server.resource(
  //   `email://${props.email.from}`,
  //   new ResourceTemplate("email://{name}", { list: undefined }),
  //   async (uri, { name }) => ({
  //     contents: [{ uri: uri.href, text: `Hello, ${name}!` }],
  //   })
  // );
  return (
    <div className="max-w-2xl mx-auto my-4 p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <div className="text-gray-600">
          From: <span className="font-medium">{props.email.from}</span>
        </div>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        {props.email.subject}
      </h2>
      <div className="text-gray-700 whitespace-pre-wrap">
        {props.email.body}
      </div>
    </div>
  );
}

export default function Home() {
  const emails = [
    {
      from: "John Doe",
      subject: "Hello from John",
      body: "Hello, how are you?",
    },
    {
      from: "Jane Doe",
      subject: "Hello from Jane",
      body: "Hello, how are you?",
    },
    {
      from: "Jack Doe",
      subject: "Hello from Jack",
      body: "Hello, how are you?",
    },
  ];
  return (
    <main>
      {emails.map((email) => (
        <Email email={email} key={email.subject} />
      ))}
    </main>
  );
}
