// Cluster sizes of the playground. The engine enforces the same bounds (ClusterSession.cs).
export const START_NODES = 4;
export const MIN_NODES = 4;
export const MAX_NODES = 9;

// Servers are named kahuna-1, kahuna-2, … by their index plus one, as the engine names them.
export const nodeName = (index) => `kahuna-${index + 1}`;
