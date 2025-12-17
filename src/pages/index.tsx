import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/intro">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/category/real-world-examples"
            style={{marginLeft: '1rem'}}>
            View Examples
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  description: ReactNode;
  icon: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Multi-Agent Orchestration',
    icon: '🤖',
    description: (
      <>
        AutoGen enables building applications with multiple AI agents that can
        converse, collaborate, and solve complex tasks together through
        structured conversations.
      </>
    ),
  },
  {
    title: 'Production-Ready Patterns',
    icon: '🏭',
    description: (
      <>
        Learn battle-tested patterns for deploying multi-agent systems in
        production environments with proper error handling, monitoring, and
        scalability.
      </>
    ),
  },
  {
    title: 'Flexible Agent Types',
    icon: '🔧',
    description: (
      <>
        From simple assistants to code executors and custom agents - AutoGen
        provides building blocks for any AI automation workflow you can imagine.
      </>
    ),
  },
  {
    title: 'Human-in-the-Loop',
    icon: '👥',
    description: (
      <>
        Seamlessly integrate human feedback and approval into your agent
        workflows for sensitive operations and quality control.
      </>
    ),
  },
  {
    title: 'Tool Integration',
    icon: '🛠️',
    description: (
      <>
        Equip your agents with custom tools, function calling, and external API
        integrations to extend their capabilities beyond language understanding.
      </>
    ),
  },
  {
    title: 'Enterprise Applications',
    icon: '🏢',
    description: (
      <>
        Real-world case studies from customer service automation to data
        analysis pipelines and software development workflows.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures(): ReactNode {
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

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Production-Ready Multi-Agent AI Systems"
      description="Comprehensive guide to building production-ready multi-agent AI systems with Microsoft AutoGen framework">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
