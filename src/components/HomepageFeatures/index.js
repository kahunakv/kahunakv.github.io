import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Easy to Use',
    Png: require('@site/static/img/image1.png').default,
    description: (
      <>
        Kahuna provides distributed locking, a distributed key/value store and a distributed sequencer: all in one easy to use package. 
      </>
    ),
  },
  {
    title: 'Focus on What Matters',
    Png: require('@site/static/img/image2.png').default,
    description: (
      <>
        Kahuna has a fully decentralized architecture that is designed to be fault tolerant and highly available.        
      </>
    ),
  },
  {
    title: 'Modern Codebase',
    Png: require('@site/static/img/image3.png').default,
    description: (
      <>
        Kahuna is written in modern .NET C# and runs efficiently on almost any platform. It works equally well on Windows, Mac and Linux, and is designed to incur in lower garbage collection overheads.      </>
    ),
  },
];

function Feature({Png, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img className={styles.featureSvg} role="img" src={Png}/>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
