
# Basic Syntax

Kahuna Script is inspired by **Lua**, **Ruby**, **Bash** and **PL/pgSQL**. Its syntax is easy to understand **because of its similarity to widely used languages**, making it accessible for developers familiar with scripting or database logic.

A "Hello World" in Kahuna Script would look like this:

```ruby
return 'Hello World'
```

A slightly more useful example:

```ruby
begin
 let current_leader = get `election/leader`
 if rev(current_leader) == 0 then
   set `election/leader` "node-A"
 else
   throw "election failed"
 end
 commit
end
```

## Variables

In scripts, variables have **local and temporary scope**, meaning they exist only for the **duration of the script’s execution**.

Variables can be used to **retrieve values** from the key/value store and also to **hold modified values** that can later be written back.

**Example:**

```visual-basic
let current_limits = get "user:123:limits"
let current_limits = current_limits - 1
set "user:123:limits" current_limits
```

This pattern—read, modify, write—is common in Kahuna Script and helps encapsulate logic close to the data while avoiding multiple round-trips.

## Reserved Words and Escaping Identifiers

Some identifiers are reserved words and cannot be used as constant or variable names. It’s recommended to escape key names using backticks ` or quotes ' ' or " " to avoid conflicts. For example:

```ruby
set election_leader "node-A"
set `election_leader` "node-A"
set "election_leader" "node-A"
```

By escaping keys, you can use all kinds of characters and symbols that might not otherwise be allowed. For example:

```ruby
set `end` "some value" # reserved word end
set `user@domain.com` "active" # symbols
set "config:env/prod#1" true # symbols
set "🔥special-key$" 123 # emojis
```

This allows for greater flexibility in naming keys, especially when working with external systems, user-generated IDs, or complex naming conventions.

## Whitespace and Line Endings

Whitespace characters such as spaces and tabs are generally ignored in Kahuna Script code, except when they appear in strings:

```ruby
let my_range = 1..10 for i in my_range do if i == 5 then return i end end throw "needle wasn't found"
```

The previous script is equivalent to:

```visual-basic
let my_range = 1..10
for i in my_range do
    if i == 5 then
        return i
    end
end

throw "needle wasn't found"
```

