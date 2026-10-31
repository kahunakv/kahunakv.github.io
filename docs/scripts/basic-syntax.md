
# Basic Syntax

Kahuna Script borrows its syntax from **Lua**, **Ruby**, **Bash**, and **PL/pgSQL**, so if you have written a shell script, a Redis Lua script, or a database stored procedure, most of it will look familiar.

A "Hello World" in Kahuna Script would look like this:

```kahuna
return 'Hello World'
```

A slightly more useful example:

```kahuna
begin
 let current_leader = get `election/leader`
 if not found then
   set `election/leader` "node-A"
 else
   throw "election failed"
 end
 commit
end
```

## Variables

Variables are local to the script and exist only while it runs. Use them to hold values read from the key/value store and the modified values you write back.

**Example:**

```kahuna
let current_limits = get "user:123:limits"
let current_limits = current_limits - 1
set "user:123:limits" current_limits
```

This read-modify-write pattern is common in Kahuna Script: the logic runs next to the data, without a round trip per step.

## Reserved Words and Escaping Identifiers

These words are reserved. You cannot use them as bare variable or key names:

```text
as       at       begin    bucket   by       case     cmp      cmprev
commit   del      delete   do       edel     edelete  eexists  eextend
eget     else     end      escan    eset     ex       exists   extend
false    for      found    get      if       in       let      norev
not      null     nx       of       prefix   return   rollback scan
set      sleep    switch   then     throw    true     xx
```

Keywords are case-insensitive, so `LET`, `Let`, and `let` are the same keyword, and `Prefix` is reserved too. `deleted` and `extended` are not reserved: only the two-word guards `not deleted` and `not extended` are keywords, so `let deleted = 1` is valid. Built-in function names such as `count` or `len` are not reserved either.

Escape key names with backticks (`` ` ``), single quotes, or double quotes to avoid conflicts. For example:

```kahuna
set election_leader "node-A"
set `election_leader` "node-A"
set "election_leader" "node-A"
```

Escaped keys can contain characters that are otherwise not allowed, such as a reserved word (`end`), symbols, and emojis. This helps when key names come from external systems or user-generated IDs:

```kahuna
set `end` "some value"
set `user@domain.com` "active"
set "config:env/prod#1" true
set "🔥special-key$" 123
```

Backtick identifiers must remain on one line. Quoted strings may span lines; see [Strings and Escapes](/docs/scripts/semantics/#strings-and-escapes).

Put at most one backtick identifier on each line: a backtick identifier currently runs to the **last** backtick on its line, so ``set `a` 1 set `b` 2`` on one line writes a single key named ``a` 1 set `b``. Double- and single-quoted strings do not have this problem.

## Parameters

A placeholder such as `@user_key` is a parameter: your client sends its value with the script, as the [.NET client](/docs/dotnet-client/) and [TypeScript client](/docs/typescript-client/) pages show. Pass every value that comes from outside the script as a parameter instead of building it into the script text. A parameter value is never parsed as script code, so input cannot change what the script does.

```kahuna
let stock_value = get @inventory_key
let requested = to_int(@requested_amount)
```

- A placeholder name is `@` followed by letters, digits, and underscores. Names are case-sensitive.
- Every parameter value arrives as a **string**. Arithmetic and comparisons convert numeric strings (`@amount + 1` works), but functions such as `min` do not, so cast with [`to_int` or `to_double`](/docs/scripts/functions/type/) first.
- A placeholder the client did not send is a script error (`Undefined parameter`).

Some operands accept only an integer literal. A placeholder there is a syntax error:

| Statement | Literal-only operand |
|-----------|---------------------|
| `extend <key> <ms>`, `eextend <key> <ms>` | `<ms>` |
| `get`, `eget`, `exists`, `eexists` with `at <revision>` | `<revision>` |
| `sleep <ms>` | `<ms>` |

Two more places need care:

- `ex` on `set` and `eset` takes an expression but requires an integer, so convert the parameter: `ex to_int(@ttl_ms)`. `ex @ttl_ms` is refused with `Invalid SET EX expression`.
- `begin (...)` options parse a placeholder but read it as literal text, so `begin (timeout=@timeout)` fails with `Invalid timeout option`. Write option values as literals.

## Comments

Kahuna Script has no comment syntax. A `#` outside a string or an escaped identifier is a syntax error. Put explanations in the code that sends the script, or in its documentation.

## Whitespace and Line Endings

Kahuna Script generally ignores spaces, tabs, and line breaks outside strings, so this one-line script:

```kahuna
let my_range = 1..10 for i in my_range do if i == 5 then return i end end throw "needle wasn't found"
```

is equivalent to:

```kahuna
let my_range = 1..10
for i in my_range do
    if i == 5 then
        return i
    end
end

throw "needle wasn't found"
```
