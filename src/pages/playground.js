import Layout from '@theme/Layout';
import ClusterPlayground from '@site/src/components/ClusterPlayground';
import styles from './playground.module.css';

export default function PlaygroundPage() {
  return (
    <Layout
      title="Playground"
      description="Run a real Kahuna cluster in your browser, compiled to WebAssembly. Stop and restart servers, add and remove them, and run Kahuna scripts on any server.">
      <main className={styles.page}>
        <ClusterPlayground />
      </main>
    </Layout>
  );
}
