# Kubernetes Operator

Kubernetes knows how to start, restart, and replace containers, but it does not know how a Raft cluster must add or remove members. An **operator** is a program that runs inside Kubernetes and carries that application-specific knowledge: you describe the cluster you want in one resource, and the operator performs the steps needed to reach it and keep it there.

The [Kahuna Kubernetes operator](https://github.com/kahunakv/kahuna-k8s-operator) does this for Kahuna. You declare a `KahunaCluster` resource with a node count, storage, TLS, and optional autoscaling limits. The operator then:

- Creates the Services, StatefulSet, volumes, TLS resources, and disruption budget.
- Adds and removes nodes one at a time, waiting for each Raft membership change to commit before the next step.
- Optionally scales the cluster up and down from Kahuna's own write-rate and queue-depth metrics, without an external metrics stack.

**Use it when** you run Kahuna on Kubernetes and want safe scaling and less manual membership work. **You do not need it when** you run Kahuna on virtual machines, bare metal, or plain Docker; use [Server Installation](/docs/server-installation/) instead.

Why not edit a StatefulSet's replica count directly? Adding a pod is not the same as admitting a Raft member, and removing a pod is not the same as committing its departure. If those steps get out of order, the cluster can lose quorum or keep waiting for a node that no longer exists. The operator waits for each membership transition before it continues.

The operator is currently **alpha**, with API version `kahuna.kahunakv.io/v1alpha1`.

## Install the Operator

You need Kubernetes storage provisioning for the requested PVCs, Helm, and network access from the operator to the Kahuna pods. These commands install the operator from its source chart; they do not create a Kahuna cluster:

```bash
git clone https://github.com/kahunakv/kahuna-k8s-operator.git
cd kahuna-k8s-operator
helm install kahuna-operator ./charts/kahuna-operator \
  --namespace kahuna-system --create-namespace
kubectl create namespace kahuna
```

The chart defaults to one operator instance with leader election. `watchNamespace` can restrict its watched namespace, but RBAC remains cluster-scoped; this is not a security boundary. Optional chart `metrics.serviceMonitor` exposes **operator** metrics, not Kahuna's JSON dashboard metrics.

## Create a Cluster Ready for Autoscaling

Start with **more nodes than the data replication factor**. For factor 3, use at least four founding nodes. Kahuna creates placed replica sets only when node count exceeds the factor at partition creation; the current operator cannot convert a fully replicated partition later. A cluster founded at three nodes with factor 3 is therefore unsuitable for autoscaling above three.

First supply a PKCS#12 keystore in the cluster's namespace:

```bash
kubectl -n kahuna create secret generic kahuna-tls \
  --from-file=certificate.pfx=/path/to/certificate.pfx
```

Use a certificate appropriate for the peer and client DNS names. Alternatively, with cert-manager already installed, replace `secretRef` below with `certManager.issuerRef`; the operator then creates the `Certificate`, PKCS#12 password Secret, and wildcard peer SAN. Exactly one TLS source is required.

Save this as `kahuna.yaml`:

```yaml
apiVersion: kahuna.kahunakv.io/v1alpha1
kind: KahunaCluster
metadata:
  name: kahuna
  namespace: kahuna
spec:
  replicas: 4
  image: kahunakv/kahuna:1.12.2
  partitions: 16
  replication:
    factor: 3
  storage:
    backend: rocksdb
    data:
      size: 100Gi
    pvcRetentionPolicy: Retain
  tls:
    secretRef:
      name: kahuna-tls
    keystoreKey: certificate.pfx
    insecureSkipVerify: true
  resources:
    requests:
      cpu: "1"
      memory: 2Gi
  autoscaling:
    minReplicas: 4
    maxReplicas: 9
    targetWritesPerSecond: 2000
    targetQueueDepth: 32
    scaleUpStabilizationSeconds: 60
    scaleDownStabilizationSeconds: 300
    tolerancePercent: 10
```

```bash
kubectl apply -f kahuna.yaml
kubectl -n kahuna get kahunacluster kahuna -w
kubectl -n kahuna wait --for=condition=RosterConverged \
  kahunacluster/kahuna --timeout=10m
```

The sizes and targets are starting examples, not capacity guarantees. Choose partition count and resources for the workload: adding nodes redistributes existing placed partitions, but cannot spread one hot key's writes across leaders. With factor 3, a data partition still needs a majority of its three replicas; nine cluster nodes do not give that partition nine copies or tolerance of four replica failures. System membership spans all nodes. See [Replica Placement](/docs/replica-placement/) and [Leader Balancing](/docs/leader-balancing/).

`insecureSkipVerify` defaults to true in the operator and disables inter-node server-certificate verification for a self-signed deployment. Set it to false when the issuer is trusted by the server image. A password-protected supplied keystore also needs `tls.passwordSecretRef: {name: <secret>, key: <key>}`. The operator enables plaintext listeners for its probes and management calls; restrict pod and Service access with your network policy. This TLS setup is not node mTLS; see [Node Transport Security](/docs/node-transport-security/) for that separate server mode.

## Connect an Application

The operator creates a ClusterIP client Service named after the resource, and a headless `<name>-peer` Service for node identity. Default client ports are HTTP/gRPC `2070` and HTTPS/gRPC `2071`; Raft uses `8082`. In this example, in-cluster clients can use `http://kahuna.kahuna.svc.cluster.local:2070` or the TLS client port with a matching trusted certificate.

For local inspection:

```bash
kubectl -n kahuna port-forward service/kahuna 2070:2070
# In another terminal:
curl http://127.0.0.1:2070/v1/cluster/membership
curl http://127.0.0.1:2070/v1/cluster/placement
```

A client Service can route to any ready node; Kahuna forwards requests to the partition leader. For direct client routing, advertise and map reachable **client** endpoints rather than the peer Raft port. Pod DNS/IP hints generally cannot be followed from outside Kubernetes. See [Client Leader-Aware Routing](/docs/client-routing/).

## How Traffic-Based Scaling Works

The controller polls `GET /v1/dashboard/metrics` on all eligible ready pods, with a steady autoscaling resync of 15 seconds. Keep the dashboard enabled and reachable. No metrics-server, external HPA, or Prometheus adapter is needed for these signals.

| Field | Signal |
|---|---|
| `targetWritesPerSecond` | Average per-node rate of `kahuna.kv.write.admitted`, a cumulative **direct** key/value write admission counter. It is not total successful requests or transactional write throughput. |
| `targetQueueDepth` | Average per-node sum of `raft.executor.client_queue_depth` across partition executors: pending client proposals, including transactional pressure. It does not measure read latency or CPU utilization. |

At least one positive target is required. The controller computes the largest available signal-to-target ratio. Outside the tolerance band, it recommends `ceil(current desired replicas × ratio)`, clamped to `minReplicas` and `maxReplicas`. For example, four nodes averaging 4,000 writes/s against a 2,000 target recommend eight. After the scale-up window it requests **five**, waits for membership and readiness convergence, then measures again. It does not jump straight to eight.

The scale-up and scale-down windows default to 60 and 300 seconds; tolerance defaults to 10%. These are continuous **observed direction** windows, not a historical maximum-recommendation algorithm. A return to the band, a direction change, or a nonconverged cluster clears the corresponding streak. Each step restarts stabilization. Catch-up, placement, scheduling, and draining add time beyond the window, so the window is not a scaling completion deadline.

Write rates need two accepted samples at least ten seconds apart. Counter/time resets or a new pod UID require a new baseline; an operator restart also loses rate baselines, while desired count and stabilization timestamps remain in status. Missing metric rows in an otherwise successful response count as zero. Unknown write-rate baselines are different: another known signal can justify growth, but a missing configured signal prevents traffic-driven shrink. If any metrics request fails, the traffic decision holds. Read-only saturation may not trigger either signal; this is not a general CPU, memory, latency, or read-QPS autoscaler.

Before growing, the operator reads replica placement. An unreadable placement view prevents growth. Any fully replicated active data partition caps autoscaled growth at **three nodes**, independent of the configured factor; the operator never creates more than three data copies through autoscaled growth. `AutoscalingLimited` explains the block. With placed partitions, `replication.factor` can be 1–3; factor 1 sacrifices replica fault tolerance.

While autoscaling is enabled, `spec.replicas` only initializes the target, clamped to the bounds. Later edits to it do not override the autoscaler. Bounds edits clamp the desired count immediately, while actual membership still changes one node at a time; a traffic sampling failure does not undo that explicit clamp. `status.autoscaling.recommendedReplicas` is already clamped to the bounds; it is not the uncapped demand.

## Scale Manually or Pause Autoscaling

Without `spec.autoscaling`, edit `spec.replicas`. To switch this example to a fixed size of four in one patch:

```bash
kubectl -n kahuna patch kahunacluster kahuna --type=merge \
  -p '{"spec":{"autoscaling":null,"replicas":4}}'
```

Removing autoscaling without updating `replicas` hands control back to its old value and can start an unexpected scale. Do not attach an HPA to the managed StatefulSet or edit its count directly: the operator reconciles that object from the custom resource.

Scale-up creates one joining node at a time and waits for the expected roster to contain all target endpoints as Voters. Scale-down asks the highest-ordinal node to leave through `POST /v1/cluster/leave`; only a committed removal/already-absent response permits removal of its reachable pod. A refusal or HTTP error holds the current size. If the departing pod is already missing or has no IP, the controller cannot ask it to leave and relies on membership eviction; it will not take another step until the roster converges.

`replicas: 2` is rejected. A standalone one-node resource cannot transition to or from a multi-node cluster; create a separate resource and migrate. Counts of four or six are valid intermediate/target sizes, but an even-sized fully replicated group has the same failure tolerance as the preceding odd size.

PVCs are retained on scale-down by default. `storage.pvcRetentionPolicy: Delete` makes Kubernetes reclaim scaled-away PVCs, and loses their local state. Deleting a `KahunaCluster` retains its PVCs regardless of that scale-down setting; deleting the resource is not a coordinated node-by-node decommission of the entire cluster.

## Observe and Troubleshoot

```bash
kubectl -n kahuna get kahunacluster kahuna -o yaml
kubectl -n kahuna get pods,pvc
kubectl -n kahuna describe kahunacluster kahuna
kubectl -n kahuna logs kahuna-0 --tail=100
```

| State or symptom | Check |
|---|---|
| `status.phase: Bootstrapping` | Keystore availability, PVC binding, peer DNS/connectivity, and founder logs. The peer Service publishes not-ready addresses so quorum can form. |
| `Available=True`, `RosterConverged=False` | Some capacity is serving, but a membership change is incomplete. `Available` is a readiness/quorum summary, not proof all data partitions are healthy. Inspect `status.members` and the serving cluster. |
| `AutoscalingLimited=True` | Condition message: unavailable metrics/placement, maximum node count, or fully replicated partitions. |
| `recommendedReplicas` exceeds `desiredReplicas` | Stabilization, one-node stepping, or a ceiling may be holding the next step. Inspect window timestamps and conditions. |
| A new node stays `Learner` | Catch-up progress, snapshot transfer, placement, and join timeout logs. Readiness alone does not certify roster convergence. |
| Scale-down holds | Departing pod reachability, leave response, remaining replica placement, and decommission drain timeout. Keep the pod until removal is confirmed. |

Recent Kahuna servers distinguish join admission/initialization (`--raft-join-timeout`, default 60,000 ms) from the promotion **no-progress** timeout (`--raft-join-promotion-stall-timeout`, default 300,000 ms). Promotion can take longer while commit indexes, new partitions, or snapshot receipt/install show progress. The stall timeout must exceed the promotion stable window plus node-update interval. These have no typed operator fields yet; use `spec.extraArgs` when adjustment is justified:

```yaml
spec:
  extraArgs:
    - --raft-join-timeout
    - "120000"
    - --raft-join-promotion-stall-timeout
    - "600000"
```

A post-admission join failure attempts withdrawal from the roster; withdrawal is best-effort and caller cancellation does not invoke it. Verify membership rather than assuming an exception removed a learner.

## Updates, Storage, and Recovery Limits

Configuration/image changes update the pod template and cause rolling updates; the controller holds updates when membership is unreadable or nonconverged. Scaling changes topology outside the template so it does not restart existing nodes merely to change the peer list. TLS Secret contents alone do not change the generated script hash: do not assume certificate rotation automatically rolls pods.

`partitions`, storage backend/revision, and WAL backend/revision are immutable. The reconciler does not update existing StatefulSet volume-claim templates, so editing a requested size in the custom resource is not an implemented PVC expansion workflow. An optional `storage.wal` template gives WAL a separate volume. Default anti-affinity is a soft preference; configure `affinity` or `topologySpreadConstraints` for the failure-domain placement you require.

When updating the operator CRD, apply it before the Helm upgrade; `helm upgrade` does not replace the chart's `crds/` files:

```bash
kubectl apply -f charts/kahuna-operator/crds/kahunaclusters.yaml
helm upgrade kahuna-operator ./charts/kahuna-operator --namespace kahuna-system
```

The operator has no backup/scheduled-backup CRD and does not seed new pods from backups automatically. New nodes normally use Raft snapshot plus log catch-up. Current Kahuna servers can copy and verify a full backup base image before replay and join, but the operator still lacks backup storage mounts/provider setup and per-join bootstrap orchestration. `extraArgs` cannot add mounts or register a GCS provider. See [PITR Bootstrap](/docs/pitr-bootstrap/) for the server workflow and [Backups](/docs/backups-and-point-in-time-recovery/) for full-cluster coverage requirements under replica placement.
