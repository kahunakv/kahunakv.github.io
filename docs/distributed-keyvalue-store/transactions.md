
# Distributed Transactions



## What is Two-Phase Commit (2PC)?
**2PC** is a distributed transaction protocol that ensures **atomicity across multiple independent nodes.**

### **How 2PC Works in Kahuna:**

#### **Phase 1: Prepare (Pre-Commit)**
- The node that receives the transaction is assigned as **transaction coordinator**. It sends a **prepare request** to all participating nodes.
- Each Kahuna node **locks the resources** (e.g., temporary key with a lease).
- If all nodes agree, they respond **"Ready to Commit"**.

#### **Phase 2: Commit or Rollback**
- If all nodes respond **successfully**, the coordinator sends a **commit request**.
- If **any cluster fails**, the coordinator sends a **rollback request**.

This ensures either ALL updates succeed or NONE happen.

---
