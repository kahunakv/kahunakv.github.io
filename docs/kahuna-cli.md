---
sidebar_position: 8
---

# Kahuna CLI

**Kahuna CLI** is an **interactive command-line tool** that allows sending **commands**, executing **transactions** in a **Kahuna cluster** and viewing the results.  

It can be installed in two ways:  

### **Native Client**  
If you have the [**.NET runtime**](https://dotnet.microsoft.com/en-us/download) installed, you can globally install the `kahuna-cli` tool with the following command:  

```bash
dotnet tool install -g Kahuna.Control
```

Then you can execute the following command on your terminal:

```bash
~> kahuna-cli
Kahuna Shell 0.0.1 (alpha)

kahuna-cli>  get my-config
r14 my-value 18ms

```

### **Docker**  

If you have **Docker** you can run it on a container:

```bash
docker run --name kahuna-cli --network=host -d kahunakv/kahuna-cli:latest
```

Then you can execute the following command on your terminal:

```bash
~> docker exec -it kahuna-cli /app/run.sh
Kahuna Shell 0.0.1 (alpha)

kahuna-cli>  get my-config
r14 my-value 18ms
```