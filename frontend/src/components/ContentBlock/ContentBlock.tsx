import React, { ReactNode } from 'react';
import styles from './ContentBlock.module.css';

interface ContentBlockProps {
  isVisible: boolean;
  direction: 'left' | 'right';
  children: ReactNode;
  imgSrc: string;
  altText: string;
  className: string;
}

const ContentBlock: React.FC<ContentBlockProps> = ({
  isVisible,
  direction,
  children,
  imgSrc,
  altText,
  className,
}) => {
  const getClassNames = (
    isVisible: boolean,
    direction: 'left' | 'right',
    customClassName?: string,
  ) => {
    const baseClass = styles.content;
    const directionClass =
      direction === 'right' ? styles.contentRight : styles.contentLeft;
    const visibilityClass = isVisible ? styles.visibleContent : '';

    return `${baseClass} ${directionClass} ${visibilityClass} ${customClassName ?? ''}`;
  };

  return (
    <div className={getClassNames(isVisible, direction, className)}>
      {direction === 'left' && <img src={imgSrc} alt={altText} />}
      <div className={className}>{children}</div>
      {direction === 'right' && <img src={imgSrc} alt={altText} />}
    </div>
  );
};

export default ContentBlock;
