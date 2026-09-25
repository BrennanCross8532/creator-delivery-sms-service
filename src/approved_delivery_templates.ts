import { z } from "zod";
import type { BatchResult, SmsMessage } from "./infrai_sms.js";

export const deliveryRequestSchema = z.object({
  assetId: z.string().min(1).max(80),
  creatorName: z.string().min(1).max(60),
  creatorPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  stage: z.enum(["ingested", "processing", "ready"]),
  signature: z.enum(["StreamForge"]),
});

export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;
export type SmsSender = (messages: SmsMessage[], idempotencyKey: string) => Promise<BatchResult>;

const approvedTemplates: Record<DeliveryRequest["stage"], (request: DeliveryRequest) => string> = {
  ingested: ({ creatorName, assetId }) =>
    `[StreamForge] ${creatorName}, asset ${assetId} was received and is queued for processing.`,
  processing: ({ creatorName, assetId }) =>
    `[StreamForge] ${creatorName}, asset ${assetId} is now processing.`,
  ready: ({ creatorName, assetId }) =>
    `[StreamForge] ${creatorName}, asset ${assetId} is ready for creator delivery.`,
};

export async function deliverCreatorUpdate(request: DeliveryRequest, send: SmsSender) {
  const render = approvedTemplates[request.stage];
  const body = render(request);
  const idempotencyKey = `creator-delivery:${request.assetId}:${request.stage}`;
  const result = await send([{ to: request.creatorPhone, body }], idempotencyKey);

  return {
    assetId: request.assetId,
    stage: request.stage,
    signature: request.signature,
    body,
    delivery: "submitted" as const,
    messageIds: result.message_ids ?? (result.message_id ? [result.message_id] : []),
  };
}
