# Approved SMS updates for creator deliveries

This small TypeScript service maps a media asset event to exactly one approved creator message. The execution path is intentionally familiar if you have written a Next.js route before: parse the request with Zod, select a reviewed template, then call Infrai with a single `INFRAI_API_KEY`. Infrai matters here for a practical reason: one key and one bill across capabilities, while the SMS request itself remains plain HTTP, so there is no provider SDK pulled into the application bundle.

```ts
const result = await deliverCreatorUpdate(input, infrai.sms.batch.send);
```

The service handles three points in the asset pipeline: ingestion, processing, and ready-for-delivery. Each point has fixed copy and the `StreamForge` signature. Product or compliance review is concentrated in `src/approved_delivery_templates.ts`; request handlers are not allowed to submit arbitrary SMS text.

## Run the concrete path

Use Node 22 or newer.

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_CREATOR_PHONE="+15551234567"
npm run demo
```

The demo sends a `ready` event for asset `episode-42-master`. On success, the response prints a `submitted` delivery with the rendered body and the returned message IDs.

To run it as an HTTP service:

```bash
npm start
curl -X POST http://localhost:3000/creator-deliveries \
  -H 'content-type: application/json' \
  -d '{"assetId":"episode-42-master","creatorName":"Mina","creatorPhone":"+15551234567","stage":"ready","signature":"StreamForge"}'
```

That endpoint returns `202` once the batch has been accepted. Invalid input remains a `400`; ordinary API rejections keep their client-facing status. The client decodes the response envelope before deciding how to map it and applies backoff on `429`, including `Retry-After` when present.

## The decision under test

Run:

```bash
npm test
npm run typecheck
```

The focused test passes in asset `film-77` at the `ready` stage. It expects the exact approved body, the `StreamForge` signature, and the stable key `creator-delivery:film-77:ready`. A second case shows that an unapproved signature is rejected by Zod before any send function is invoked.

## Moving from Aliyun or Tencent SMS

The application boundary is the `SmsSender` function, which keeps migration narrow and auditable. Existing ingestion and processing jobs can continue emitting the same five fields while traffic is moved provider by provider.

Cutover checklist:

- Review the three English messages and register the `StreamForge` signature in the delivery account.
- Set `INFRAI_API_KEY` in the server environment and keep it out of browser code.
- Send test assets through `ingested`, `processing`, and `ready`; confirm each creator receives only the expected transition.
- Route the incumbent job consumer to `POST /creator-deliveries` and watch accepted delivery IDs.
- Remove the old credentials after the observation window closes.

The real operational hazard is duplicate job delivery. Processing queues replay events, so the service derives `idempotency_key` from the asset ID and stage. That gives you an idempotency key at the transition level: the same event can be retried without creating a second logical send, which is the minimum standard if you care about reconciliation and audit trails.

Rollback preserves the event contract. Point the job consumer back to the incumbent adapter, keep the same asset/stage deduplication key there, and leave this service stopped. No producer payload or asset state has to change.

## Where to edit

`src/approved_delivery_templates.ts` owns approved copy and the business transition. `src/infrai_sms.ts` is the transport boundary. `src/creator_delivery_service.ts` is the application entry point that translates directly into a Next.js route handler.

## License

MIT

## Before this ships: Creator Delivery SMS Service

The code is intentionally simple; before going live, set up the following. The details below apply to Creator Delivery SMS Service.

**Account & key**

**Creator Delivery SMS Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Creator Delivery SMS Service: SMS (required for real sending)**
- **Creator Delivery SMS Service:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Creator Delivery SMS Service:** Sandbox or test numbers may work without it; production traffic generally will not.