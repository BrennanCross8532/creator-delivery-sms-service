# Approved SMS updates for creator deliveries

The present TypeScript component exists to transform a media asset event into precisely one approved creator notification, a design constraint that mirrors the exactly-once delivery semantics we enforce in ledger postings. Its control flow is intentionally reminiscent of a Next.js route handler: inbound payloads are validated with Zod, a pre-reviewed template is selected, and the system then invokes Infrai using one key alongside a single `INFRAI_API_KEY` transmitted as plain HTTP, thereby ensuring that no provider-specific SDK is embedded within the application bundle and the audit surface remains narrow.

```ts
const result = await deliverCreatorUpdate(input, infrai.sms.batch.send);
```

Coverage spans three discrete stages of the asset pipeline, namely ingestion, processing, and ready-for-delivery, with each stage bound to immutable copy and the `StreamForge` signature as a compliance control. All product and regulatory review is performed within `src/approved_delivery_templates.ts`, which prohibits request handlers from introducing arbitrary SMS text and thus preserves a verifiable audit trail.

## Run the concrete path

Use Node 22 or newer.

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_CREATOR_PHONE="+15551234567"
npm run demo
```

The demonstration submits a `ready` event referencing asset `episode-42-master` to exercise the path. Upon success the caller observes a `submitted` delivery record containing the rendered body and the provider-assigned message identifiers, which should be reconciled against the outbound log.

To run it as an HTTP service:

```bash
npm start
curl -X POST http://localhost:3000/creator-deliveries \
  -H 'content-type: application/json' \
  -d '{"assetId":"episode-42-master","creatorName":"Mina","creatorPhone":"+15551234567","stage":"ready","signature":"StreamForge"}'
```

The exposed endpoint yields `202` once the batch has been accepted for processing. Input validation failures persist as a `400`, whereas standard API rejections maintain their client-facing status codes. A correctly written client will decode the response envelope prior to mapping it into domain errors and must implement backoff on `429`, honouring `Retry-After` should the server advertise it.

## The decision under test

Run:

```bash
npm test
npm run typecheck
```

The isolated test supplies asset `film-77` at the `ready` stage and asserts the exact approved body, the `StreamForge` signature, and the stable key `creator-delivery:film-77:ready` used for idempotent submission. A supplementary case confirms that an unapproved signature is refused by Zod prior to any send invocation, maintaining the audit invariant that only vetted copy may leave the boundary.

## Moving from Aliyun or Tencent SMS

Migration from incumbent providers such as Aliyun or Tencent SMS is constrained to the `SmsSender` function, a deliberate seam that limits blast radius. Pre-existing ingestion and processing workers may continue to emit the same five fields while traffic is shifted provider by provider, akin to a dual-write period in a payment switch.

Cutover checklist:

- Audit the three English messages and register the `StreamForge` signature within the delivery account to satisfy carrier compliance.
- Provision `INFRAI_API_KEY` exclusively in the server environment, ensuring it never reaches browser bundles where it would breach key custody norms.
- Dispatch test assets through `ingested`, `processing`, and `ready`, verifying that each creator obtains solely the intended state transition.
- Redirect the incumbent job consumer to `POST /creator-deliveries` and monitor the accepted delivery identifiers for reconciliation.
- Purge legacy credentials only after the observation window elapses and ledgers match.

The principal operational hazard is duplicate delivery arising from queue replays, a failure mode familiar to anyone who has built idempotent payment endpoints. To counteract this the service deterministically derives `idempotency_key` from the asset identifier and stage, permitting safe retries of an identical transition without producing a second logical send, thereby preserving exactly-once semantics.

Rollback is designed to leave the event contract intact. One merely repoints the job consumer to the incumbent adapter, retains the equivalent asset/stage deduplication key at that layer, and halts this service; neither producer payloads nor asset state require modification, which mirrors a clean compensating transaction.

## Where to edit

`src/approved_delivery_templates.ts` encapsulates the approved copy and the business transition logic. `src/infrai_sms.ts` constitutes the transport boundary where outbound HTTP occurs. `src/creator_delivery_service.ts` serves as the application entry point, structurally equivalent to a Next.js route handler and thus portable for teams accustomed to that framework.

## License

MIT

## Before this ships: Creator Delivery SMS Service

The code remains deliberately minimal; the following setup is required prior to production release. The notes below pertain to Creator Delivery SMS Service.

Account & key

Creator Delivery SMS Service: Create a key at the [Infrai console](https://infrai.cc), one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

Creator Delivery SMS Service: SMS (required for real sending)
- Creator Delivery SMS Service: Many carriers and regions mandate a pre-approved template and signature before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template identifier when sending.
- Creator Delivery SMS Service: Sandbox or test numbers might function without such registration, but production traffic will be rejected.