# Security model

## Trust boundaries

- **Browser:** Untrusted input and display only. No API secrets, permissions to write arbitrary files, privileged local accounts or agent-execution powers.
- **Node adapter:** Loopback-only, fixed HTTP API, constrained static file serving, read-only remote health probes, bounded timeouts and response sizes.
- **External inference:** Optional independently installed and controlled service. Do not assume its security properties match this starter.
- **Agent orchestration:** **Not included.** There is no delegation dispatch, approval mutation, file editing, terminal access, OS process management, or autonomous background execution.

## Explicit non-goals

This starter is **not** hardened for hostile LAN access, a public web host, third-party tenants, arbitrary untrusted plugins, a malicious local user or an inference server that executes tools behind its completion API.

## Controls present

- Bind HTTP on 127.0.0.1 only.
- No cloud SDKs, telemetry, external fonts or third-party runtime npm packages.
- Read-only, allowlisted service paths. Loopback-only service URL validation.
- No raw operational source records or credentials emitted through health APIs.
- Text inserted with `textContent`, not `innerHTML`, to avoid model-output HTML injection.
- Basic CSP and response headers; no cross-origin permissions.
- Explicit `SIMULATED` labels on all demo scenarios and sample evidence.
- Connected chat disabled by default. Chat is optional, bounded and non-streaming.
- Model chat requests `tool_choice: none`, but this **cannot** prevent server-side tools in a separately installed gateway. Use a plain inference endpoint only.

## Known limitations

- Localhost does not equal authentication or authorization. Other processes on the same machine may reach the local server. Do not deploy on a shared untrusted host.
- Health is a snapshot and may be stale; it is not proof an agent completed a task correctly.
- No cryptographic attestation of endpoint responses or simulated evidence. No real acceptance authority.
- No production-grade rate limiting, TLS termination, audit trails or multi-user identities.
- The optional local model is not sandboxed by this starter; tool-free behavior depends on the upstream server.

## Publishing checklist

Follow [public-release-checklist.md](public-release-checklist.md). Scan any future code imports, sample data, screenshots and logs for hidden secrets, identifiers, customer information, copyrighted assets and private repository history.

If you discover a vulnerability, report it privately to the maintainer. Do not paste credentials into public issues.
