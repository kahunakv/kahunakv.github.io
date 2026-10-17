import Layout from '@theme/Layout';
import KahunaPlayground from '@site/src/components/KahunaPlayground';
import styles from './playground.module.css';

export default function PlaygroundPage() {
  return (
    <Layout
      title="Playground"
      description="Run Kahuna scripts against a real Kahuna node in your browser, compiled to WebAssembly. Nothing to install.">
      <main className={styles.page}>
        <div className="container">
          <KahunaPlayground />
        </div>
      </main>
    </Layout>
  );
}
