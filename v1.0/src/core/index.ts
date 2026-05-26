/**
 * wMEP — Web Module Export Protocol
 * Package entry point
 */

export { createWmepModule } from './create-wmep-module.js';

export type {
  WmepCleanup,
  WmepEffect,
  WmepFactory,
  WmepInstance,
  WmepModule,
  WmepReservedEvents,
  WmepSetup,
} from './types.js';
