import { deliverCreatorUpdate, deliveryRequestSchema } from "../src/approved_delivery_templates.js";
import { infrai } from "../src/infrai_sms.js";

const creatorPhone = process.env.DEMO_CREATOR_PHONE;
if (!creatorPhone) throw new Error("DEMO_CREATOR_PHONE is required");

const request = deliveryRequestSchema.parse({
  assetId: "episode-42-master",
  creatorName: "Mina",
  creatorPhone,
  stage: "ready",
  signature: "StreamForge",
});

const result = await deliverCreatorUpdate(request, infrai.sms.batch.send);
console.log(JSON.stringify(result, null, 2));
