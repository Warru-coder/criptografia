import { loadConfig, saveConfig, defaultConfig, AppConfig } from '../../config';

export async function configCommand(options: {
  action?: string;
  key?: string;
  value?: string;
}): Promise<void> {
  const action = options.action || 'get';
  const config = loadConfig();

  switch (action) {
    case 'get':
      if (options.key) {
        const key = options.key as keyof AppConfig;
        if (key in config) {
          console.log(`${key}: ${config[key]}`);
        } else {
          console.error(`Unknown config key: ${options.key}`);
          process.exit(1);
        }
      } else {
        console.log('Current configuration:');
        for (const [key, value] of Object.entries(config)) {
          console.log(`  ${key}: ${value}`);
        }
      }
      break;

    case 'set':
      if (!options.key || options.value === undefined) {
        console.error('Usage: securecrypt config set <key> <value>');
        process.exit(1);
      }

      const key = options.key as keyof AppConfig;
      if (!(key in defaultConfig)) {
        console.error(`Unknown config key: ${options.key}`);
        console.log(`Available keys: ${Object.keys(defaultConfig).join(', ')}`);
        process.exit(1);
      }

      const currentValue = config[key];
      if (typeof currentValue === 'boolean') {
        (config as Record<string, unknown>)[key] = options.value.toLowerCase() === 'true';
      } else if (typeof currentValue === 'number') {
        const numValue = parseInt(options.value, 10);
        if (isNaN(numValue)) {
          console.error(`Invalid number: ${options.value}`);
          process.exit(1);
        }
        (config as Record<string, unknown>)[key] = numValue;
      } else {
        (config as Record<string, unknown>)[key] = options.value;
      }

      saveConfig(config);
      console.log(`Set ${key} = ${config[key]}`);
      break;

    case 'reset':
      saveConfig(defaultConfig);
      console.log('Configuration reset to defaults');
      break;

    default:
      console.error(`Unknown action: ${action}`);
      console.log('Available actions: get, set, reset');
      process.exit(1);
  }
}
