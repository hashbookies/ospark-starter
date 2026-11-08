# Architecture and engineering decisions

This project demonstrates five architectural separations:

**1. Face vs. services.** The orbital UI renders without any AI model. Rendering, health and chat are independent concerns; a gateway outage need not blank the interface.

**2. Truthful status.** A service is `RUNNING` only after positive evidence from its configured endpoints. `UNCONFIGURED`, `DEGRADED`, `UNAVAILABLE`, and `STALE` are meaningful distinct states. A web *capability* is not automatically a running service.

**3. Read-only operations.** The gateway checks only allowlisted GET URLs and returns aggregate records. It does not expose task descriptions or accept delegation mutations. A synthetic demonstration review has an obvious `SIMULATED` label.

**4. Explicit owner gates.** This starter intentionally stops short of running agents. A real system needs approvals bound to a proposal ID, source evidence, immutable run IDs, bounded resource permissions, audit logs, and a separately controlled worker. A pretty approval button is not an authorization system.

**5. Portable execution.** The browser uses Canvas2D, not an installed WebGL engine or a local image-generation server. The Node 20 adapter uses built-ins only. A user can launch the demonstration on macOS, Linux or Windows without reproducing the creator's machine.

## Data flow

- `GET /api/capabilities`: tells the browser which mode and chat status is active.
- `GET /api/health`: returns a bounded snapshot. Demo mode is marked `simulated: true` and supports four scenarios; connected mode probes loopback services in parallel and reports source failures.
- `GET /api/review`: returns one obviously synthetic example in demo mode, no real review records in connected mode.
- `POST /api/chat`: disabled in demo mode. In connected mode, disabled unless explicitly configured for a separate plain local inference endpoint. No streaming, tools or agent dispatch.

All browser requests are same-origin. External local API credentials are read by the server only and never returned to the frontend.

## Where real OSPARK differs

The private OSPARK system includes more advanced components such as agent orchestration, operational workflows, privileged account isolation and a richer visualization stack. Those systems are outside this public starter's trust boundary. The starter is a **reference interface and integration pattern**, not a portable clone of the private installation.

## Suggested enhancements

- Add a public, schema-versioned adapter interface and contract tests for multiple model-serving backends.
- Add a read-only mock event stream for task lifecycle demonstrations.
- Allow explicitly signed demo evidence fixtures, with strong separation from genuine owner-accepted artifacts.
- Add accessible high-contrast and reduced-motion design variants.
- Keep privileged execution in a separate project that undergoes dedicated security review.
