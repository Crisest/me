// useDelayedVisibility.ts
import { useState, useEffect } from 'react';

/**
 * A custom hook that toggles a boolean state after a specified delay.
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const isVisible = useDelayedToggle(false, 1000, (newState) => {
 *     console.log('State toggled to:', newState);
 *   });
 *
 *   return (
 *     <div>
 *       {isVisible ? (
 *         <p>The element is now visible!</p>
 *       ) : (
 *         <p>The element is hidden.</p>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 */
const useDelayedToggle = (
  initialValue: boolean,
  delay: number,
  onToggle?: (newState: boolean) => void,
): boolean => {
  const [state, setState] = useState<boolean>(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newState = !initialValue;
      setState(newState);

      if (onToggle) {
        onToggle(newState);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay, initialValue, onToggle]);

  return state;
};

export default useDelayedToggle;
