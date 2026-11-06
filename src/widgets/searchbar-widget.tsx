import { Button, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize, padding } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

const SearchBarWidget = () => {
  'widget';

  return (
    <Button
      {...({ target: 'search' } as { target: string })}
      onClick={() => undefined}
      colors={{ containerColor: '#F1F2EF', contentColor: '#777D80' }}
      modifiers={[fillMaxSize(), padding(16, 0, 16, 0)]}>
      <Text color="#777D80" style={{ fontSize: 15 }}>⌕  Search or enter an address</Text>
    </Button>
  );
};

export default createWidget('SearchBarWidget', SearchBarWidget);