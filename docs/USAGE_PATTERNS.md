# Portento Component Usage Patterns

The `@Component` decorator now supports **two usage patterns** to accommodate different coding styles and naming preferences.

## Pattern 1: Direct Decoration (Original)

Decorate the class directly and use the `$provider` static property:

```typescript
@Component({
  selector: 'home-screen',
  providers: [],
})
class HomeScreen implements IoComponent {
  public constructor(
    private sharedStore: SharedNavStore,
    private authService: AuthService,
  ) {
    // ...
  }

  public render(): JSX.Element {
    return <View>...</View>;
  }
}

// Usage in JSX:
<HomeScreen.$provider />
```

### Pros:
- ✅ Simple, one-step decoration
- ✅ Class and component have the same name
- ✅ Less boilerplate

### Cons:
- ❌ Requires using `.$provider` in JSX
- ❌ Class name must be the component name

---

## Pattern 2: Separate Class & Export (New)

Use an internal class name and export a clean component using `Component.$provider`:

```typescript
@Component({
  selector: 'settings-screen',
  providers: [],
})
class Settings implements IoComponent {
  public constructor(
    private sharedStore: SharedNavStore,
    private authService: AuthService,
  ) {
    // ...
  }

  public render(): JSX.Element {
    return <View>...</View>;
  }
}

// Export clean component name
export const SettingsScreen: React.FC = Component.$provider(Settings) as React.FC;

// Usage in JSX:
<SettingsScreen />
```

### Pros:
- ✅ Clean JSX usage without `.$provider`
- ✅ Separate internal class name from exported component name
- ✅ More conventional React component naming
- ✅ Better for public APIs

### Cons:
- ❌ Extra line of code to export
- ❌ Two names to manage (internal class + exported component)

---

## How It Works

The `Component` function now returns an object with both:
1. A **decorator function** (for use as `@Component(...)`)
2. A **`$provider` static method** (for manual invocation)

```typescript
export function Component(params: ComponentParams): {
  <T extends Ctor<IoComponent>>(Entity: T): React.FC;
  $provider: <T extends Ctor<IoComponent>>(Entity: T) => React.FC;
} {
  const decorator = function <T extends Ctor<IoComponent>>(Entity: T): React.FC {
    // ... wrapper logic
    return wrappedComponent as React.FC;
  };

  // Add $provider static method pointing to the same decorator function
  decorator.$provider = decorator;

  return decorator;
}
```

Both `@Component(params)` and `Component(params).$provider` use the **same internal logic**, ensuring consistent behavior.

---

## Choosing a Pattern

### Use Pattern 1 when:
- Building internal components
- Prefer simpler, more concise code
- Don't mind the `.$provider` syntax

### Use Pattern 2 when:
- Exporting components for external use
- Want clean, conventional JSX (`<MyComponent />`)
- Need different class name vs. component name
- Building a public API or component library

---

## Router Registration

**Important:** When using Pattern 2, register the **internal class** (not the exported component) in the Router:

```typescript
@Router({
  selector: 'main-nav-router',
  components: [HomeScreen, ProfileScreen, Settings],  // ✅ Use Settings (class)
  providers: [SharedNavStore],
})
class MainNavRouter implements IoComponent {
  public render(): JSX.Element {
    return (
      <View>
        <HomeScreen.$provider />
        <ProfileScreen.$provider />
        <SettingsScreen />  {/* ✅ Use exported component in JSX */}
      </View>
    );
  }
}
```

The Router needs the **class reference** for dependency tracking, but in JSX you use the **exported component**.

---

## Complete Example

See [RouterScopeExample.tsx](./examples/RouterScopeExample.tsx) for a working example demonstrating both patterns:

- **Pattern 1:** `HomeScreen` and `ProfileScreen`
- **Pattern 2:** `Settings` (class) → `SettingsScreen` (export)

All three components share the same `SharedNavStore` from the router scope, demonstrating that both patterns work identically in terms of dependency injection.
