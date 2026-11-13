# Modbus2MQTT

Standalone **Modbus (TCP / RTU-over-TCP / Serial RTU) to MQTT** bridge built with the **Zigbee2MQTT** stack (Node.js, TypeScript, pnpm, `mqtt`, `ws`, `modbus-serial`) and a Web UI combining **Zigbee2MQTT Windfront** (React, Vite, Tailwind CSS, daisyUI) with **ThingsBoard Modbus Connector** configuration ergonomics.

## Features
- **100% Zigbee2MQTT Protocol Compatibility**:
  - WebSocket `/api?token=...` endpoint for live dashboard updates & remote orchestration (`bridge/request/options`, `bridge/request/restart`, `bridge/request/health_check`).
  - Standard MQTT discovery topics (`<base_topic>/bridge/state`, `bridge/info`, `bridge/devices`, `bridge/logging`).
  - Per-slave telemetry (`<base_topic>/<friendly_name>`), availability (`<friendly_name>/availability`), writable set commands (`<friendly_name>/set`), and on-demand reads (`<friendly_name>/get`).
- **ThingsBoard-style Slave & Register Workbench**:
  - Supports **Modbus TCP**, **RTU over TCP**, and **Serial RTU** (`modbus-serial`).
  - Supports `bool` (with `bit_index`), `int8`, `uint8`, `int16`, `uint16`, `float16` (IEEE 754), `int32`, `uint32`, `float32`, `int64`, `uint64`, `float64`, and `string` with `ABCD`/`BADC`/`CDAB`/`DCBA` endianness and `divider`/`multiplier`/`offset` modifiers.
  - Inline **Test Connection**, **Test Read** (showing decoded value + raw hex registers), and **Execute RPC** buttons.

## Quick Start
```bash
pnpm install
pnpm run build
pnpm start
```

Or via Docker Compose:
```bash
docker compose up -d
```
Web UI listens on `http://localhost:8099`.
