import React from 'react';
import Header from '@components/Header/Header';
import styles from './HomePage.module.css';
import CodeIcon from '@/assets/images/code.svg';
import useDelayedToggle from '@/hooks/useDelayedToggle';
import ContentBlock from '@/components/ContentBlock/ContentBlock';

const HomePage: React.FC = () => {
  const isVisibleFirst = useDelayedToggle(false, 300);
  const isVisibleSecond = useDelayedToggle(false, 600);

  return (
    <>
      <Header title="Software Engineer" />
      <h1 className={styles.subtitle}>Hey, I&apos;m Yorguin :)</h1>
      <ContentBlock
        isVisible={isVisibleFirst}
        direction="left"
        imgSrc={CodeIcon}
        altText="coding svg"
        className={styles.text}
      >
        <p>
          With <span>Over 5 years</span> of experiences in very different areas!
          I am very keen at learning
        </p>
      </ContentBlock>
      <ContentBlock
        isVisible={isVisibleSecond}
        direction="right"
        imgSrc={CodeIcon}
        altText="coding svg"
        className={styles.text}
      >
        <p>
          With <span>Over 5 years</span> of experiences in very different areas!
          I am very keen at learning
        </p>
      </ContentBlock>
    </>
  );
};

export default HomePage;
