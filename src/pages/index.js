import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import InternalsExplorer from '../components/InternalsExplorer';
import styles from './index.module.css';

const proofPoints = [
  {icon: 'shield', label: 'Fenced locks & ordered IDs'},
  {icon: 'database', label: 'Durable & temporary state'},
  {icon: 'code', label: 'Custom C# functions'},
  {icon: 'check', label: 'Jepsen-tested'},
];

const advantageCards = [
  {
    icon: 'shield',
    title: 'One worker per job',
    description:
      'Use leases and fencing tokens to give one worker ownership of a job or tenant.',
  },
  {
    icon: 'database',
    title: 'Consistent shared state',
    description:
      'Read current revisions and use transactional compare-and-set for workflows like rate limiting.',
  },
  {
    icon: 'hash',
    title: 'Safe, ordered IDs',
    description:
      'Allocate numbers and ranges across nodes without races, with idempotent retries.',
  },
  {
    icon: 'code',
    title: 'Custom C# logic',
    description:
      'Run trusted C# functions inside Kahuna Script transactions for validation and business rules.',
  },
  {
    icon: 'cpu',
    title: 'Faster reads, safe failover',
    description:
      'Over 116k read requests per second on a local three-node cluster with in-memory storage, plus built-in replication and failover.',
    link: '/docs/client-routing#measured-effect',
    linkLabel: 'See benchmark details →',
  },
  {
    icon: 'layers',
    title: 'Your choice of storage',
    description:
      'RocksDB for heavy writes, SQLite for smaller deployments, or memory for tests and temporary state.',
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
      'Custom C# functions inside transactions',
      'Multi-step workflows with compare-and-set',
      'Services that need quorum-backed coordination',
      'MIT-licensed Kahuna with no proprietary runtime fees',
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

const dotnetExampleCode = `using Kahuna.Client;

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

const typescriptExampleCode = `import { KahunaClient } from "kahuna-client";

await using client = new KahunaClient({
  endpoints: [
    "https://kahuna-1.internal:8082",
    "https://kahuna-2.internal:8082",
    "https://kahuna-3.internal:8082"
  ]
});

await using jobLock = await client.acquireLock("jobs/invoice-2048", {
  expiry: 30_000,
  wait: 5000,
  retry: 200
});

if (jobLock.acquired) {
  await processInvoice(2048);
}
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
    code: (
      <>
        <path d="M8 9l-4 3 4 3" />
        <path d="M16 9l4 3-4 3" />
        <path d="M13 5l-2 14" />
      </>
    ),
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
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Open source · .NET · self-hosted cluster</p>
          <Heading as="h1" className={styles.heroTitle}>
            The distributed coordination layer for .NET
          </Heading>
          <p className={styles.heroSubtitle}>
            Like etcd or ZooKeeper, built for .NET: distributed <strong>locks</strong>, a consistent{' '}
            <strong>key/value store</strong>, and ordered <strong>ID sequences</strong>.
            Self-hosted, with safe failover and trusted C# functions inside Kahuna Script
            transactions.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/getting-started">
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Tutorial
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/book">
              Book
            </Link>
            <Link className="button button--secondary button--lg" to="#inside-kahuna">
              How it works ↓
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
        <div className={styles.heroMedia} aria-hidden="true">
          <img
            src="/img/front-page-logo.png"
            alt=""
            className={styles.heroLogo}
          />
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
      description="Documentation for Kahuna, a distributed locking, key/value, and sequencing platform for .NET and TypeScript">
      <HomepageHeader />
      <main>
        <InternalsExplorer />
        <section className={styles.primarySection}>
          <div className="container">
            <SectionHeading
              eyebrow="Why Kahuna"
              title="Simplify coordination"
              subtitle="One owner, consistent state, and ordered IDs for your distributed workflows."
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
                  {card.link ? <Link to={card.link}>{card.linkLabel}</Link> : null}
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
                <Tabs groupId="front-page-client" className={styles.clientTabs}>
                  <TabItem value="dotnet" label=".NET">
                    <CodeBlock language="csharp" className={styles.codeBlock}>
                      {dotnetExampleCode}
                    </CodeBlock>
                  </TabItem>
                  <TabItem value="typescript" label="TypeScript">
                    <CodeBlock language="typescript" className={styles.codeBlock}>
                      {typescriptExampleCode}
                    </CodeBlock>
                  </TabItem>
                </Tabs>
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
              <Link className="button button--secondary button--lg" to="/docs/typescript-client">
                Explore the TypeScript client
              </Link>
              <Link className="button button--secondary button--lg" to="/docs/scripts/user-defined-functions">
                Explore user-defined functions
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
