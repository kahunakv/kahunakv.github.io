
# Service Discoverability

Store metadata (IP, port, status, version, etc.) about microservices so other components can discover and interact with them:

```sql
kahuna-cli> SET `services/payment-service` '{"ip": "10.0.1.15","port": 8080, "version": "v1.2.3",}' EX 60000
```