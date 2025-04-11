
# Scripts

Kahuna offers a scripting system in its key/value store called **Kahuna Script**. With these scripts, it's possible to execute logic that consistently reads data from the key/value store and also modifies or manipulates that data in an **all-or-nothing** fashion—that is, changes won’t be partially applied in the event of an error or failure.

A script can be something as simple as a single command to set a value on the key/value store: 

```visual-basic
kahuna-cli> set `services/email/instance-3` '{"ip": "10.1.1.22", "port": 9090}'
r0 set 19ms
```

or more elaborate examples that solve real-world problems:

## Atomic Check-and-Set (CAS)

Use case: Only update a value if it matches the expected current value — useful for optimistic concurrency control. Prevent race conditions when multiple clients are trying to update shared state (e.g., balance or session info). It can be done with the built-in `set/cmp` command, for example,
only update the value if the current revision is **0**:

```visual-basic
set `election/leader` "node-A" cmprev 0
```

we can return a custom value according to the result of the operation:

```visual-basic
set `election/leader` "node-A" cmprev 0
if not set then
  return false
end
return true
```

or throw an exception if the value can't be changed:

```visual-basic
set `election/leader` "node-A" cmprev 0
if not set then
  throw "election failed"
end
return true
```

the CAS operation can be completely implemented using basic building blocks and control structures:

```visual-basic
let current_leader = get `election/leader`
if rev(current_leader) == 0 then
  set `election/leader` "node-A"
else 
  throw "election failed"  
end  
```

## Leaky Bucket Rate Limiter

Limit how many actions a user/IP can do over time (e.g., login attempts or API calls). Throttle traffic, avoid brute-force attacks.

```visual-basic
let rate_limit = get @rate_limit_param
let last_refill = get @last_refill_param

let tokens = to_int(rate_limit)
let last_refill = to_int(last_refill)

let current_time = current_time()
let elapsed = current_time - last_refill
let refill = floor(elapsed / @refill_interval_param)

let tokens = min(tokens + refill, tokens)

if tokens <= 0 then
  return 0
end

set @rate_limit_param tokens - 1
set @last_refill_param current_time
return 1
```

## Atomic Inventory Reservation

Reserve stock if available; useful for flash sales or ticketing systems.
Prevent overselling in e-commerce under high load.

```visual-basic
let inventory_key = get @inventory_key
let requested_amount = get @requested_amount

let inventory = to_int(inventory_key)
let requested = to_int(requested_amount)

if current >= requested then  
  set inventory_key inventory - requested
  return 1
else
  return 0
end
```

## Expiring Counter

Count events (like logins or API hits) and auto-expire the counter after some time.

```visual-basic
let current_count = get @counter_key_param
let expected_increment = to_int(@expected_increment_param)
let expected_limit = to_int(@expected_limit_param)

let new_count = current_count + expected_increment
set @counter_key new_count

if new_count >= expected_limit then  
  extend @counter_key @expiration_in_seconds
end

return new_count
```

## Session Refresh (Sliding Expiration)

Refresh TTL on user session only if it exists. Prevent user sessions from expiring while they're still active.

```visual-basic
let exists_key = exists @session_key
if exists_key then
 extend @session_key @ttl_in_seconds
 return 1
end
return 0
```