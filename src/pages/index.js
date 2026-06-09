import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import styles from './index.module.css';

const proofPoints = [
  {icon: 'shield', label: 'Locks with fencing tokens'},
  {icon: 'database', label: 'Persistent and ephemeral state'},
  {icon: 'hash', label: 'Distributed sequence allocation'},
  {icon: 'layers', label: 'RocksDB, SQLite, or memory'},
];

const advantageCards = [
  {
    icon: 'shield',
    title: 'Stop double processing',
    description:
      'Use leases and fencing tokens when only one worker may own a job, tenant, or background task.',
  },
  {
    icon: 'database',
    title: 'Keep shared state consistent',
    description:
      'Store revisions, compare values, and read the latest state without building your own replication layer.',
  },
  {
    icon: 'hash',
    title: 'Allocate ordered IDs safely',
    description:
      'Generate invoice numbers, tickets, offsets, or reservation ranges without races across nodes.',
  },
  {
    icon: 'cpu',
    title: 'Connect to a replicated cluster',
    description:
      'Point clients at one or more Kahuna endpoints and let the cluster handle replication, leader election, and failover.',
  },
  {
    icon: 'layers',
    title: 'Pick the storage path',
    description:
      'RocksDB fits write-heavy clusters. SQLite fits smaller persistent deployments. Memory fits tests and temporary state.',
  },
  {
    icon: 'spark',
    title: 'Build workflows, not glue code',
    description:
      'Rate limiting, leader-owned jobs, idempotent allocation, and transactional compare-and-set sit on top of the same model.',
  },
];

const fitCards = [
  {
    title: 'Good fit',
    icon: 'check',
    items: [
      'Distributed locking for critical sections',
      'Reliable shared configuration and metadata',
      'Ordered ID allocation across nodes',
      'Multi-step workflows with compare-and-set',
      'Services that need quorum-backed coordination',
    ],
  },
  {
    title: 'Not the target',
    icon: 'x',
    items: [
      'A general-purpose analytics database',
      'A document store for large unstructured datasets',
      'Fire-and-forget eventually consistent pipelines',
      'Single-node apps that do not need quorum or leader election',
    ],
  },
];

const exampleCode = `using Kahuna.Client;

var client = new KahunaClient(new[]
{
    "https://kahuna-1.internal:8082",
    "https://kahuna-2.internal:8082",
    "https://kahuna-3.internal:8082"
});

await using KahunaLock jobLock = await client.GetOrCreateLock(
    "jobs/invoice-2048",
    expiry: TimeSpan.FromSeconds(30),
    wait: TimeSpan.FromSeconds(5),
    retry: TimeSpan.FromMilliseconds(200)
);

if (jobLock.IsAcquired)
    await ProcessInvoice(2048);
`;

function Icon({name}) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const icons = {
    shield: <path d="M12 3l7 3v6c0 4.5-2.7 7.5-7 9-4.3-1.5-7-4.5-7-9V6l7-3Z" />,
    database: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    hash: (
      <>
        <path d="M9 3L7 21" />
        <path d="M17 3l-2 18" />
        <path d="M4 9h16" />
        <path d="M3 15h16" />
      </>
    ),
    layers: (
      <>
        <path d="M12 3l9 5-9 5-9-5 9-5Z" />
        <path d="M3 12l9 5 9-5" />
        <path d="M3 16l9 5 9-5" />
      </>
    ),
    cpu: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
      </>
    ),
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />,
    x: (
      <>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </>
    ),
    check: <path d="M5 12l4 4L19 6" />,
  };

  return <svg {...commonProps}>{icons[name]}</svg>;
}

function SectionHeading({eyebrow, title, subtitle}) {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.sectionEyebrow}>{eyebrow}</p>
      <Heading as="h2" className={styles.sectionTitle}>
        {title}
      </Heading>
      {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
    </div>
  );
}

function HomepageHeader() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <p className={styles.heroEyebrow}>Distributed coordination for .NET</p>
        <Heading as="h1" className={styles.heroTitle}>
          Locks, Key/Value store and Sequencer
        </Heading>
        <p className={styles.heroSubtitle}>
          Use Kahuna when one node must own the work, every write must be visible in
          order, and another node must continue safely after failure.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/getting-started">
            Get started
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/intro">
            Tutorial
          </Link>
        </div>
        <div className={styles.proofGrid}>
          {proofPoints.map((point) => (
            <div key={point.label} className={styles.proofPill}>
              <span className={styles.proofIcon}>
                <Icon name={point.icon} />
              </span>
              <span>{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} documentation`}
      description="Documentation for Kahuna, a distributed locking, key/value, and sequencing platform for .NET">
      <HomepageHeader />
      <main>
        <section className={styles.primarySection}>
          <div className="container">
            <SectionHeading
              eyebrow="Why Kahuna"
              title="Solve coordination problems directly"
              subtitle="Use it when the application needs one owner, consistent shared state, or safe ordered allocation"
            />
            <div className={styles.cardGrid}>
              {advantageCards.map((card) => (
                <div key={card.title} className={styles.advantageCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>
                      <Icon name={card.icon} />
                    </span>
                    <Heading as="h3" className={styles.cardTitle}>
                      {card.title}
                    </Heading>
                  </div>
                  <p className={styles.cardDescription}>{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.bandSection}>
          <div className="container">
            <SectionHeading
              eyebrow="Where it fits"
              title="Use it for shared ownership and control-plane work"
              subtitle="Fewer duplicate workers, fewer stale writes, fewer homegrown coordination paths"
            />
            <div className={styles.fitGrid}>
              {fitCards.map((card) => (
                <div key={card.title} className={styles.fitCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>
                      <Icon name={card.icon} />
                    </span>
                    <Heading as="h3" className={styles.cardTitle}>
                      {card.title}
                    </Heading>
                  </div>
                  <ul className={styles.fitList}>
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.primarySection}>
          <div className="container">
            <SectionHeading
              eyebrow="Example"
              title="What using it looks like"
              subtitle="Start a node, pick storage, and claim a resource"
            />
            <div className={styles.calloutRow}>
              <div className={styles.calloutCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>
                    <Icon name="cpu" />
                  </span>
                  <Heading as="h3" className={styles.cardTitle}>
                    Cluster client
                  </Heading>
                </div>
                <CodeBlock language="csharp" className={styles.codeBlock}>
                  {exampleCode}
                </CodeBlock>
              </div>
              <div className={styles.calloutCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>
                    <Icon name="spark" />
                  </span>
                  <Heading as="h3" className={styles.cardTitle}>
                    What this buys you
                  </Heading>
                </div>
                <p className={styles.cardDescription}>
                  One worker owns the job. The cluster replicates the lock state, and the
                  lease expires if the owner dies or stops renewing it.
                </p>
                <p className={styles.cardDescription}>
                  Clients can connect through any healthy endpoint while Kahuna handles
                  consensus, failover, and the ordered write path behind the API.
                </p>
              </div>
            </div>
            <div className={styles.footerActions}>
              <Link className="button button--primary button--lg" to="/docs/distributed-locks">
                Explore locks
              </Link>
              <Link className="button button--secondary button--lg" to="/docs/dotnet-client">
                Explore the .NET client
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
