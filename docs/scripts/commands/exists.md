
# Command: Exists

Checks if a key exists in the persistent storage. If the key does not exist `false` is returned.

```swift
exists `config/limits/max-connections`
r- not exists 9ms

set `config/limits/max-connections` 1000
r0 set 11ms

exists `config/limits/max-connections`
r0 exists 8ms
```

`exists` is useful for checking whether a key is present in the key/value store **without incurring the cost** of returning the full byte stream of the associated value to the client.

This makes it an efficient way to perform presence checks, especially when working with large values or when you only need to know if a key exists before taking further action.

**Example:**

```visual-basic
let exists_key = exists "user:123:profile"
if exists_key then
  return "User found"
else
  return "User not found"
end
```
