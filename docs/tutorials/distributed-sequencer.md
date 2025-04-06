import Kahuna6 from '../assets/kahuna6.png';

# Tutorial: Distributing Sequencer

<div style={{textAlign: 'center'}}>
<img src={Kahuna6} height="350" />
</div>

Distributed locking is a critical pattern used to coordinate access to shared resources in distributed systems where multiple nodes, services or processes might try to modify the same resource concurrently. It ensures mutual exclusion, consistency and safe concurrent behavior.

The **distributed locks** system can be used for **leader election, safe deployments, preventing double execution of scheduled jobs**. In this tutorial, you will learn how it works.


