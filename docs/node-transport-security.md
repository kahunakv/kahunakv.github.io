# Node Transport Security

Kahuna can authenticate node-to-node traffic with mutual TLS. In `MutualTls` mode, each node presents a certificate to peers and verifies the peer certificate thumbprint before accepting internal traffic.

Use this for production clusters where the Raft port or internal Kahuna gRPC calls could be reached by anything other than trusted nodes.

## What It Protects

| Traffic | `MutualTls` | `SharedSecret` |
|---------|-------------|----------------|
| Raft traffic | Authenticated | Authenticated |
| Key/value and lock forwarding | Authenticated | Not authenticated |
| Sequence forwarding | Authenticated | Not authenticated |
| Internal two-phase commit participant calls | Authenticated | Not authenticated |
| Application clients and CLI calls | Not covered | Not covered |

`SharedSecret` protects Raft only. Use `MutualTls` when you need full node-to-node coverage.

Administrative HTTP and gRPC surfaces are still application-facing. Backup, restore, membership, placement, range, routing, dashboard, and health endpoints must be protected with normal network controls.

## Basic Setup

Each node needs:

- an HTTPS certificate for the listener
- a client certificate to present to peers, or the same certificate reused as the client certificate
- the SHA-256 thumbprints of peer client certificates it accepts
- the SHA-256 thumbprints of peer server certificates it pins when dialing peers

```bash
kahuna-server \
  --initial-cluster node2:8082 node3:8082 \
  --raft-host node1 \
  --raft-port 8082 \
  --https-certificate /etc/kahuna/node1.pfx \
  --https-ports 2071 8082 \
  --node-auth-mode MutualTls \
  --trusted-client-cert-thumbprint <node1> <node2> <node3> \
  --trusted-server-cert-thumbprint <node1> <node2> <node3> \
  --advertised-client-endpoint https://node1:2071 \
  --disable-peer-endpoint-advertisement
```

Point peers at the cluster listener. Point applications at an application listener. A normal `KahunaClient` cannot complete the client-certificate handshake required by the cluster listener.

## Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--node-auth-mode` | `Disabled` | Node authentication mode: `Disabled`, `SharedSecret`, or `MutualTls`. |
| `--client-certificate` | `--https-certificate` | PKCS#12 certificate this node presents to peers in `MutualTls` mode. |
| `--client-certificate-password` | `--https-certificate-password` | Password for `--client-certificate`. |
| `--trusted-client-cert-thumbprint` | none | SHA-256 thumbprints of peer certificates this node accepts. |
| `--trusted-server-cert-thumbprint` | system trust store | SHA-256 thumbprints this node pins when dialing peers. |
| `--node-shared-secret` | empty | Shared secret for `SharedSecret` mode. |
| `--node-auth-header` | Kommander default | Header or metadata name used by signed `SharedSecret` requests. |
| `--node-require-tls` | `true` | Reject node-to-node requests that did not arrive over TLS. |
| `--node-auth-clock-skew` | `60` | Maximum accepted clock skew for signed `SharedSecret` requests, in seconds. |
| `--allow-plaintext-listener` | disabled | Bind cleartext HTTP and h2c listeners even when an HTTPS certificate is configured. |

Thumbprints are SHA-256 fingerprints of the DER-encoded certificate. Colons, spaces, and letter case are ignored.

```bash
openssl x509 -in node1.crt -noout -fingerprint -sha256
openssl pkcs12 -in node1.pfx -nokeys -passin pass: \
  | openssl x509 -noout -fingerprint -sha256
```

## Listener Behavior

When `MutualTls` is enabled:

| Listener | Behavior |
|----------|----------|
| HTTPS port equal to `--raft-port` | Cluster listener. Requires client certificates from peers. |
| Other `--https-ports` | Application listeners. Server TLS only. |
| `--http-ports` | Not bound unless `--allow-plaintext-listener` is set. |
| `--grpc-cleartext-ports` | Not bound unless `--allow-plaintext-listener` is set. |

Kahuna also stops binding cleartext listeners whenever an HTTPS certificate is configured, unless `--allow-plaintext-listener` is set. This applies outside `MutualTls` too.

## Routing Hints

Routing hints should advertise client-reachable application endpoints, not the mTLS cluster listener.

In mTLS deployments, set `--advertised-client-endpoint` on every node and use `--disable-peer-endpoint-advertisement` unless peer application URLs can be derived safely. You can also disable hints entirely with `--disable-routing-hints`.

## Certificate Rotation

Certificates are loaded at startup, so rotation requires rolling restarts:

1. Add the new certificate thumbprints to every node's trusted client and server thumbprint lists.
2. Restart nodes one at a time.
3. Switch the rotating node to the new certificate.
4. Restart that node.
5. Remove the old thumbprints from every node.
6. Restart nodes one at a time.

Use one certificate per node in production. A shared certificate proves cluster membership but cannot identify or revoke one node independently.

## Startup Checks

A node refuses to start when `MutualTls` is configured without an HTTPS certificate, trusted client thumbprints, HTTPS Raft schemes, or an HTTPS listener on `--raft-port`.

It also refuses `MutualTls` with `--raft-allow-insecure-certificate-validation`, because pinned peer identity and insecure validation conflict.

If a node-only call is refused, the receiving node logs the reason, such as `CertificateRequired`, `CertificateUntrusted`, `CertificateExpired`, or `TlsRequired`.
