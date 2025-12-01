import React, { memo } from 'react';
import { Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerProps {
  label?: string;
}

// Memoized spinner to prevent unnecessary re-renders
// The spinner's internal animation is handled by ink-spinner itself
export const Spinner: React.FC<SpinnerProps> = memo(({ label }) => {
  return (
    <Text>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      {label && <Text> {label}</Text>}
    </Text>
  );
});
