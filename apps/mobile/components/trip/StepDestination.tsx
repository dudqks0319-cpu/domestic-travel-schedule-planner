import type { ComponentType } from 'react';
import { Platform } from 'react-native';

type Props = {
  destination: string;
  onChangeDestination: (v: string) => void;
};

const StepDestination = (Platform.OS === 'web'
  ? (require('./StepDestination.web').default as ComponentType<Props>)
  : (require('./StepDestination.native').default as ComponentType<Props>));

export default StepDestination;
