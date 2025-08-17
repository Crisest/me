import { CSSProperties, FC, ReactNode } from 'react';

interface YmFlexProps {
  children: ReactNode;
  direction?: CSSProperties['flexDirection'];
  justify?: CSSProperties['justifyContent'];
  align?: CSSProperties['alignItems'];
  wrap?: CSSProperties['flexWrap'];
  gap?: CSSProperties['gap'];
  grow?: CSSProperties['flexGrow'];
  shrink?: CSSProperties['flexShrink'];
  basis?: CSSProperties['flexBasis'];
  className?: string;
  style?: CSSProperties;
}

const YmFlex: FC<YmFlexProps> = ({
  children,
  direction = 'row',
  justify = 'flex-start',
  align = 'stretch',
  wrap = 'nowrap',
  gap = '0',
  grow,
  shrink,
  basis,
  className = '',
  style = {},
}) => {
  const flexStyle: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    justifyContent: justify,
    alignItems: align,
    flexWrap: wrap,
    gap,
    flexGrow: grow,
    flexShrink: shrink,
    flexBasis: basis,
    ...style,
  };

  return (
    <div className={className} style={flexStyle}>
      {children}
    </div>
  );
};

export default YmFlex;
