
# Command: ESet

Allows to create or update a key/value in volatile storage (memory).

```sql
eset `config/db-connection/dev` 'jdbc:mysql://localhost/test?user=mint'
r0 set 9ms

eset `config/db-connection/staging` 'jdbc:mysql://mysql-st.company.internal/test?user=mint'
r0 set 12ms
```

## NX

If the `NX` modifier is passed the key will be only updated if the key doesn't exist.

```sql
eset cache_user_front_page '{...}' nx
r0 not set 5ms

eset cache_user_front_page '{...}'
r0 set 10ms
```

## XX

If the `XX` modifier is passed the key will be only updated if the key already exists.

```sql
eset remaining_tickets '100' xx
r0 not set 7ms

eset remaining_tickets '150'
r0 set 11ms

eset remaining_tickets '200' xx
r1 set 9ms
```

## EX

The `EX` modifier allows to set the key's expiration in milliseconds (a positive integer higher than 0).
The key will be automatically removed from the cache after expiration.

```sql
set `email/leader` 'node3' ex 60000
r0 set 11ms
```

