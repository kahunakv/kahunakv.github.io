
# Kahuna CLI

**Kahuna CLI** is an **interactive command-line tool** that allows sending **commands**, executing **transactions** in a **Kahuna cluster** and viewing the results.

It can be installed in two ways:

### **Native Client**
If you have the [**.NET runtime**](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) installed, you can globally install the `kahuna-cli` tool with the following command:

```bash
dotnet tool install -g Kahuna.Control
```

Then you can execute the following command on your terminal:

```bash
~> kahuna-cli
Kahuna Shell 0.0.5 (alpha)

kahuna-cli>  get my-config
r14 my-value 18ms

```

When new versions of `kahuna-cli` are released it can be later updated using the following command:

```bash
dotnet tool update -g Kahuna.Control
```

### **Docker**

If you have **Docker** you can run it on a container:

```bash
docker run --name kahuna-cli --network=host -d kahunakv/kahuna-cli:latest
```

Then you can execute the following command on your terminal:

```bash
~> docker exec -it kahuna-cli /app/run.sh
Kahuna Shell 0.0.5 (alpha)

kahuna-cli>  get my-config
r14 my-value 18ms
```

## Interactive Mode

If no command-line parameters are provided, kahuna-cli enters interactive mode, allowing you to execute commands and view their results in real time.

If no command-line parameters are provided, `kahuna-cli` enters **interactive mode**, allowing you to execute commands and view their results in real time.

## Connection String

By default, `kahuna-cli` attempts to connect to a cluster running on localhost on ports **8082, 8084, and 8086**.  

If you want to change this, you can specify the servers explicitly using the `-c` flag:

```bash
$ kahuna-cli -c "https://kahuna-dev.company.internal:8082,https://kahuna-dev.company.internal:8084"
```

This tells the CLI to connect to the specified Kahuna nodes, enabling interaction with a custom or remote environment.