import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';

const traceExporter = new OTLPTraceExporter({
  url: 'http://alloy:4317',
});

const resource = defaultResource().merge(
  resourceFromAttributes({
    'service.name': 'api-security-gateway',
    'service.namespace': 'gateway',
    'service.version': '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
  }),
);

const sdk = new NodeSDK({
  resource,
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('[OpenTelemetry] Tracing initialized');
