# Portento Core

[![npm version](https://badge.fury.io/js/%40portento%2Fcore.svg)](https://www.npmjs.com/package/@portento/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Lightweight dependency injection framework for React and React Native with seamless MobX integration. Build scalable applications with clean architecture using decorators and IoC patterns.

## Features

- 🎯 **Three-tier DI scoping** - Root, Router, and Component-level dependency management
- ⚡ **MobX Integration** - Automatic observer wrapping for reactive components
- 🎨 **Decorator-based API** - Clean, declarative syntax with `@Injectable`, `@Component`, `@Router`
- 🔄 **Automatic Resolution** - Smart dependency injection with hierarchical fallback
- 🧪 **Testing Utilities** - Reset scopes for isolated unit tests
- 📦 **TypeScript-first** - Full type safety and IntelliSense support
- 🌐 **Framework Agnostic** - Works with React, React Native, and Angular

## Installation

```bash
yarn add @portento/core react mobx mobx-react tsyringe reflect-metadata
```

Or with npm:

```bash
npm install @portento/core react mobx mobx-react tsyringe reflect-metadata
```

## TypeScript Configuration

Enable decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

Import `reflect-metadata` at your app entry point:

```typescript
import 'reflect-metadata';
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('MyApp', () => App);
```

## Quick Start

### 1. Create a Service with `@Injectable`

```typescript
import { Injectable } from '@portento/core';
import { makeAutoObservable } from 'mobx';

@Injectable({ providedIn: 'root' })
class AuthService {
  public isAuthenticated = false;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  login(username: string) {
    this.isAuthenticated = true;
  }
  
  logout() {
    this.isAuthenticated = false;
  }
}
```

### 2. Create a Component with `@Component`

```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';
import { Component, IoComponent } from '@portento/core';

@Component({
  selector: 'home-screen',
  providers: []
})
class HomeScreen implements IoComponent {
  constructor(
    private authService: AuthService
  ) {}
  
  render() {
    return (
      <View>
        <Text>
          {this.authService.isAuthenticated ? 'Logged In' : 'Not Logged In'}
        </Text>
        <Button 
          title="Login" 
          onPress={() => this.authService.login('user')} 
        />
      </View>
    );
  }
}

export const HomeScreenComponent = Component.$provider(HomeScreen);
```

### 3. Use in Your App

```tsx
import { HomeScreenComponent } from './HomeScreen';

export default function App() {
  return <HomeScreenComponent />;
}
```

## Dependency Injection Scoping

Portento Core provides a three-tier scoping hierarchy for dependency management:

### 1. Root Scope (Singleton)

Services registered at root scope are singletons shared across the entire application:

```typescript
@Injectable({ providedIn: 'root' })
class UserStore {
  public username = 'Guest';
  
  constructor() {
    makeAutoObservable(this);
  }
}
```

### 2. Router Scope (Feature-level)

Services shared across components within the same router:

```typescript
@Injectable()
class SharedNavStore {
  public currentTab = 0;
  
  constructor() {
    makeAutoObservable(this);
  }
}

@Router({
  selector: 'main-nav-router',
  components: [HomeScreen, ProfileScreen],
  providers: [SharedNavStore]
})
class MainNavRouter implements IoComponent {
  render() {
    return (
      <View>
        <HomeScreen.$provider />
        <ProfileScreen.$provider />
      </View>
    );
  }
}
```

### 3. Component Scope (Local)

Services isolated to a single component instance:

```typescript
@Injectable()
class FormValidator {
  public errors: string[] = [];
  
  validate(value: string) {
    // Validation logic
  }
}

@Component({
  selector: 'login-form',
  providers: [FormValidator]
})
class LoginForm implements IoComponent {
  constructor(private validator: FormValidator) {}
  
  render() {
    // Component implementation
  }
}
```

## Resolution Hierarchy

Dependencies are resolved with automatic fallback:

```
Component Scope → Router Scope → Root Scope
```

If a dependency isn't found in the component's providers, it searches the router's providers, then falls back to root scope.

## MobX Integration

All components are automatically wrapped with MobX's `observer()` HOC for reactive updates:

```typescript
@Injectable({ providedIn: 'root' })
class CounterStore {
  public count = 0;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  increment() {
    this.count++; // Component automatically re-renders
  }
}

@Component({
  selector: 'counter',
  providers: []
})
class Counter implements IoComponent {
  constructor(private store: CounterStore) {}
  
  render() {
    return (
      <View>
        <Text>{this.store.count}</Text>
        <Button title="+" onPress={() => this.store.increment()} />
      </View>
    );
  }
}
```

## Component Export Patterns

### Pattern 1: Direct Decoration

```typescript
@Component({
  selector: 'home-screen',
  providers: []
})
class HomeScreen implements IoComponent {
  render() {
    return <View>...</View>;
  }
}

// Usage in JSX:
<HomeScreen.$provider />
```

### Pattern 2: Separate Class & Export (Recommended)

```typescript
@Component({
  selector: 'settings-screen',
  providers: []
})
class Settings implements IoComponent {
  render() {
    return <View>...</View>;
  }
}

export const SettingsScreen = Component.$provider(Settings);

// Usage in JSX (cleaner):
<SettingsScreen />
```

## Lifecycle Methods

Components support standard React lifecycle methods:

```typescript
@Component({
  selector: 'my-component',
  providers: []
})
class MyComponent implements IoComponent {
  componentDidMount() {
    console.log('Component mounted');
  }
  
  componentDidUpdate(prevProps, prevState) {
    console.log('Component updated');
  }
  
  componentWillUnmount() {
    console.log('Component unmounting');
  }
  
  render() {
    return <View>...</View>;
  }
}
```

## Testing Utilities

Reset dependency instances for isolated unit tests:

```typescript
import { resetScope, resetClass, resetAll } from '@portento/core';

// Reset all root scope instances
resetScope('root');

// Reset specific router scope
resetScope('router', 'main-nav-router');

// Reset component scope
resetScope('component', 'home-screen');

// Reset specific class (conceptually)
resetClass('AuthService');

// Reset everything
resetAll();
```

## API Reference

### `@Injectable(params)`

Register a class as an injectable service.

**Parameters:**
- `providedIn?: 'root'` - Register as root-scoped singleton

```typescript
@Injectable({ providedIn: 'root' })
class MyService {}
```

### `@Component(params)`

Create a React component with dependency injection.

**Parameters:**
- `selector: string` - Unique component identifier
- `providers?: Array<Class>` - Component-scoped services

```typescript
@Component({
  selector: 'my-component',
  providers: [LocalService]
})
class MyComponent implements IoComponent {}
```

### `@Router(params)`

Create a router component that groups child components with shared dependencies.

**Parameters:**
- `selector: string` - Unique router identifier
- `components: Array<Class>` - Child components
- `providers?: Array<Class>` - Router-scoped services

```typescript
@Router({
  selector: 'main-router',
  components: [ScreenA, ScreenB],
  providers: [SharedStore]
})
class MainRouter implements IoComponent {}
```

### `IoComponent` Interface

Base interface for all components:

```typescript
interface IoComponent<Props = any, State = any> {
  state?: State;
  componentDidMount?(): void;
  componentDidUpdate?(prevProps: Props, prevState: State): void;
  componentWillUnmount?(): void;
  render(): React.ReactNode;
}
```

### `Controller` Type

Access React component state and methods:

```typescript
interface Controller<Props = any, State = any> {
  props: Props;
  state: State;
  setState: (state: Partial<State> | ((prevState: State) => State)) => void;
  forceUpdate: () => void;
}
```

Inject the controller:

```typescript
@Component({
  selector: 'stateful-component',
  providers: []
})
class StatefulComponent implements IoComponent {
  constructor(private controller: Controller) {}
  
  updateState() {
    this.controller.setState({ counter: 1 });
  }
}
```

## Examples

Complete usage examples are available in the [@portento/core-examples](https://www.npmjs.com/package/@portento/core-examples) package:

```bash
yarn add @portento/core-examples
```

Examples include:
- **StoreExample** - MobX observable stores with different scopes
- **ScopingExample** - Dependency injection hierarchy demonstration
- **RouterScopeExample** - Shared state across router components
- **ResetExample** - Cleanup utilities for testing

## Troubleshooting

### Decorators not working

Ensure `experimentalDecorators` and `emitDecoratorMetadata` are enabled in `tsconfig.json`.

### "Design:paramtypes" metadata missing

Import `reflect-metadata` at your app entry point before any other imports.

### MobX observables not triggering re-renders

Make sure your stores use `makeAutoObservable(this)` in the constructor.

### Dependency not found

Check the resolution order: component providers → router providers → root scope. Ensure the service is registered at the appropriate level.

## Architecture Documentation

For detailed architecture information, see:
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Single-container design
- [IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md) - Technical implementation
- [USAGE_PATTERNS.md](./docs/USAGE_PATTERNS.md) - Component patterns

## License

MIT © Luca Leone

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Repository

[https://github.com/luca-leone/portento-core](https://github.com/luca-leone/portento-core)
