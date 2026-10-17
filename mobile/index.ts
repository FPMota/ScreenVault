// Bulletproof safeguard for oxc runtime in @supabase/supabase-js:
// Prevents TypeError: Cannot read properties of undefined (reading 'enumerable')
// when ownKeys runs on objects with symbols in React Native / Expo Web.
if (typeof Object.getOwnPropertyDescriptor === 'function') {
  const origGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor = function (target: any, prop: any) {
    const desc = origGetOwnPropertyDescriptor.call(Object, target, prop);
    if (!desc && typeof prop === 'symbol') {
      return { enumerable: false, configurable: true, writable: true, value: undefined };
    }
    return desc;
  };
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
