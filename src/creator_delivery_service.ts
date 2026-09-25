import { createServer } from "node:http";
import { ZodError } from "zod";
import { deliverCreatorUpdate, deliveryRequestSchema } from "./approved_delivery_templates.js";
import { infrai, InfraiError } from "./infrai_sms.js";

function json(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-deliveries") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const input = deliveryRequestSchema.parse(await readJson(request));
    const result = await deliverCreatorUpdate(input, infrai.sms.batch.send);
    json(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "service_error" });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`creator delivery service listening on http://localhost:${port}`));
}
