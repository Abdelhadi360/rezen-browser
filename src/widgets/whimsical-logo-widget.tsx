import { Box, Button, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

const WhimsicalLogoWidget = () => {
  'widget';

  return (
    <Button
      {...({ target: 'search' } as { target: string })}
      onClick={() => undefined}
      colors={{ containerColor: 'transparent', contentColor: '#D56B55' }}
      modifiers={[fillMaxSize()]}>
      <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
        <Text color="#D56B55" style={{ fontSize: 58, fontWeight: '700' }}>●</Text>
      </Box>
    </Button>
  );
};

export default createWidget('WhimsicalLogoWidget', WhimsicalLogoWidget);