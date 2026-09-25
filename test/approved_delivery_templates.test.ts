import assert from "node:assert/strict";
import test from "node:test";
import { deliverCreatorUpdate, deliveryRequestSchema } from "../src/approved_delivery_templates.js";

test("a ready asset uses the approved signature and stable delivery key", async () => {
  const calls: Array<{ messages: unknown; key: string }> = [];
  const request = deliveryRequestSchema.parse({
    assetId: "film-77",
    creatorName: "Rae",
    creatorPhone: "+15551234567",
    stage: "ready",
    signature: "StreamForge",
  });

  const result = await deliverCreatorUpdate(request, async (messages, key) => {
    calls.push({ messages, key });
    return { message_ids: ["msg_123"] };
  });

  assert.deepEqual(calls, [{
    messages: [{
      to: "+15551234567",
      body: "[StreamForge] Rae, asset film-77 is ready for creator delivery.",
    }],
    key: "creator-delivery:film-77:ready",
  }]);
  assert.equal(result.delivery, "submitted");
  assert.deepEqual(result.messageIds, ["msg_123"]);
});

test("an unapproved signature is rejected at the request boundary", () => {
  const parsed = deliveryRequestSchema.safeParse({
    assetId: "film-77",
    creatorName: "Rae",
    creatorPhone: "+15551234567",
    stage: "ready",
    signature: "CreatorDirect",
  });

  assert.equal(parsed.success, false);
});
