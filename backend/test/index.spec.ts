import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("eco log worker", () => {
  beforeEach(async () => {
    await env.eco_db
      .prepare(
        `CREATE TABLE IF NOT EXISTS eco_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          tokens INTEGER NOT NULL,
          original_tokens INTEGER NOT NULL,
          compressed_tokens INTEGER NOT NULL
        )`
      )
      .run();
    await env.eco_db.prepare("DELETE FROM eco_logs").run();
  });

  it("stores eco log payload fields", async () => {
    const request = new IncomingRequest("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: "user-123",
        tokens: 28,
        originalTokens: 85,
        compressedTokens: 57
      })
    });
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "logged",
      logged: {
        userId: "user-123",
        tokens: 28,
        originalTokens: 85,
        compressedTokens: 57
      }
    });

    const rows = await env.eco_db
      .prepare(
        "SELECT user_id, tokens, original_tokens, compressed_tokens FROM eco_logs"
      )
      .all();

    expect(rows.results).toEqual([
      {
        user_id: "user-123",
        tokens: 28,
        original_tokens: 85,
        compressed_tokens: 57
      }
    ]);
  });

  it("handles CORS preflight", async () => {
    const response = await SELF.fetch("https://example.com", {
      method: "OPTIONS"
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
