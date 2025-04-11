import Kahuna6 from '../assets/kahuna6.png';

# Tutorial: Distributing Sequencer

<div style={{textAlign: 'center'}}>
<img src={Kahuna6} height="350" />
</div>

A **distributed sequencer** is a component or service in a distributed system that generates a monotonically increasing, globally ordered sequence of identifiers (often called sequence numbers, version numbers, or timestamps). Its job is to ensure that operations across multiple nodes can be totally ordered even though they happen concurrently on different machines.

It can be used to answer the question: What happened first? By assigning each operation a unique, increasing number (or timestamp), you can impose order on a system that is otherwise full of race conditions, concurrent updates, and network delays.

