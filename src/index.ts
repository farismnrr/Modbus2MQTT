import { ConfigStore } from './config/store.js';
import { BridgeLogger } from './logger.js';
import { ModbusLinkRegistry } from './modbus/client.js';
import { ModbusPoller } from './modbus/poller.js';
import { MqttBridge } from './bridge/mqtt-bridge.js';
import { startBridgeServer } from './server/api.js';

async function main(): Promise<void> {
  const logger = new BridgeLogger();
  const configStore = new ConfigStore();
  logger.setLevel(configStore.get().advanced.log_level);

  const links = new ModbusLinkRegistry();
  const mqttBridge = new MqttBridge(configStore, logger);
  const poller = new ModbusPoller(configStore, links, logger, {
    onTelemetry: (device, payload) => {
      mqttBridge.publishTelemetry(device, payload);
    },
    onAvailability: (device, state) => {
      mqttBridge.publishAvailability(device, state);
    },
  });
  mqttBridge.attachPoller(poller);

  mqttBridge.connect();
  poller.startAll();
  const server = startBridgeServer(configStore, mqttBridge, poller, logger);

  const shutdown = async () => {
    logger.info('m2m:main', 'Shutting down Modbus2MQTT...');
    poller.stopAll();
    links.closeAll();
    mqttBridge.disconnectSync();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void main();
