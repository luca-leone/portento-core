import type {DependencyContainer} from 'tsyringe';
import {container as tsyringe, Lifecycle} from 'tsyringe';
import {configure} from 'mobx';
import type {Ctor} from './types';

/**
 * Singleton class to manage dependency injection with single container and Symbol-based scoping.
 * Supports root, router, and component-level scopes with automatic fallback resolution.
 * Can be injected into components/services for dependency resolution.
 */
export class DependencyManagement {
  private static instance: DependencyManagement | undefined;

  // Single global container for all registrations
  private container: DependencyContainer = tsyringe.createChildContainer();

  // Scope tracking maps: className -> Symbol token
  private rootScope: Map<string, symbol> = new Map<string, symbol>();

  // Router scopes: routerSelector -> (className -> Symbol token)
  private routerScopes: Map<string, Map<string, symbol>> = new Map<
    string,
    Map<string, symbol>
  >();

  // Component scopes: componentSelector -> (className -> Symbol token)
  private componentScopes: Map<string, Map<string, symbol>> = new Map<
    string,
    Map<string, symbol>
  >();

  // Current component/router selector context (for constructor injection)
  private currentSelector: string | undefined;
  private currentRouterSelector: string | undefined;

  // Component-to-Router membership tracking
  private componentToRouter: Map<string, string> = new Map<string, string>();

  // Store class references for re-registration after reset
  private rootClasses: Map<string, Ctor<unknown>> = new Map<
    string,
    Ctor<unknown>
  >();
  private routerClasses: Map<string, Map<string, Ctor<unknown>>> = new Map<
    string,
    Map<string, Ctor<unknown>>
  >();
  private componentClasses: Map<string, Map<string, Ctor<unknown>>> = new Map<
    string,
    Map<string, Ctor<unknown>>
  >();

  private constructor() {
    configure({useProxies: 'always'});
    // Register DependencyManagement using a value provider to work around private constructor
    // This allows constructor injection: constructor(private dm: DependencyManagement)
    this.container.register('DependencyManagement' as never, {
      useValue: this,
    });
  }

  public static getInstance(): DependencyManagement {
    if (!DependencyManagement.instance) {
      DependencyManagement.instance = new DependencyManagement();
    }
    return DependencyManagement.instance;
  }

  /**
   * Set the current resolution context (used during component instantiation)
   */
  public setContext(
    selector: string | undefined,
    routerSelector: string | undefined,
  ): void {
    this.currentSelector = selector;
    this.currentRouterSelector = routerSelector;
  }

  /**
   * Clear the current resolution context
   */
  public clearContext(): void {
    this.currentSelector = undefined;
    this.currentRouterSelector = undefined;
  }

  /**
   * Get current component selector context
   */
  public getCurrentSelector(): string | undefined {
    return this.currentSelector;
  }

  /**
   * Get current router selector context
   */
  public getCurrentRouterSelector(): string | undefined {
    return this.currentRouterSelector;
  }

  /**
   * Generate a unique Symbol token for a class in a specific scope
   */
  private getToken(className: string, scope: string): symbol {
    return Symbol.for(`${scope}:${className}`);
  }

  /**
   * Setup and register a provider in the root scope
   */
  public setupRootContainer(Entity: Function): void {
    const className: string = Entity.name;

    if (!this.rootScope.has(className)) {
      const scopedToken: symbol = this.getToken(className, 'root');
      this.rootScope.set(className, scopedToken);
      this.rootClasses.set(className, Entity as Ctor<unknown>);

      if (!this.container.isRegistered(scopedToken)) {
        this.container.register(
          scopedToken,
          {useClass: Entity as Ctor<unknown>},
          {lifecycle: Lifecycle.Singleton},
        );
      }
    }
  }

  /**
   * Get the root container (for backward compatibility)
   */
  public getRootContainer(): DependencyContainer {
    return this.container;
  }

  /**
   * Legacy property accessor for backward compatibility
   */
  public get root(): DependencyContainer {
    return this.container;
  }

  /**
   * Setup and register providers in a component scope
   */
  public setupComponentContainer(
    selector: string,
    Providers: ReadonlyArray<Function> = [],
  ): void {
    if (!this.componentScopes.has(selector)) {
      this.componentScopes.set(selector, new Map());
      this.componentClasses.set(selector, new Map());
    }

    const scopeMap: Map<string, symbol> | undefined =
      this.componentScopes.get(selector);
    const classMap: Map<string, Ctor<unknown>> | undefined =
      this.componentClasses.get(selector);
    if (!scopeMap || !classMap) {
      throw new Error(
        `Failed to create component scope for selector: ${selector}`,
      );
    }

    // Register all providers in the component scope
    for (const Provider of Providers) {
      const className: string = Provider.name;

      if (!scopeMap.has(className)) {
        const scopedToken: symbol = this.getToken(
          className,
          `component:${selector}`,
        );
        scopeMap.set(className, scopedToken);
        classMap.set(className, Provider as Ctor<unknown>);

        if (!this.container.isRegistered(scopedToken)) {
          this.container.register(
            scopedToken,
            {useClass: Provider as Ctor<unknown>},
            {lifecycle: Lifecycle.Singleton},
          );
        }
      }
    }
  }

  /**
   * Get a component-level container by selector (backward compatibility)
   */
  public getComponentContainer(
    selector: string,
  ): DependencyContainer | undefined {
    if (!this.componentScopes.has(selector)) {
      return undefined;
    }
    return this.container;
  }

  /**
   * Legacy property accessor for backward compatibility
   */
  public get component(): Map<string, DependencyContainer> {
    const legacyMap: Map<string, DependencyContainer> = new Map<
      string,
      DependencyContainer
    >();
    for (const selector of this.componentScopes.keys()) {
      legacyMap.set(selector, this.container);
    }
    return legacyMap;
  }

  /**
   * Setup and register providers in a router scope, tracking component membership
   */
  public setupRouterContainer(
    Components: ReadonlyArray<Function> | ReadonlyArray<string>,
    Providers: ReadonlyArray<Function>,
    selector: string,
  ): void {
    if (!this.routerScopes.has(selector)) {
      this.routerScopes.set(selector, new Map());
      this.routerClasses.set(selector, new Map());
    }

    const scopeMap: Map<string, symbol> | undefined =
      this.routerScopes.get(selector);
    const classMap: Map<string, Ctor<unknown>> | undefined =
      this.routerClasses.get(selector);
    if (!scopeMap || !classMap) {
      throw new Error(
        `Failed to create router scope for selector: ${selector}`,
      );
    }

    // Track component membership (accept both class names and class constructors)
    for (const Component of Components) {
      const componentName: string =
        typeof Component === 'string' ? Component : Component.name;
      this.componentToRouter.set(componentName, selector);
    }

    // Register all providers in the router scope
    for (const Provider of Providers) {
      const className: string = Provider.name;

      if (!scopeMap.has(className)) {
        const scopedToken: symbol = this.getToken(
          className,
          `router:${selector}`,
        );
        scopeMap.set(className, scopedToken);
        classMap.set(className, Provider as Ctor<unknown>);

        if (!this.container.isRegistered(scopedToken)) {
          this.container.register(
            scopedToken,
            {useClass: Provider as Ctor<unknown>},
            {lifecycle: Lifecycle.Singleton},
          );
        }
      }
    }
  }

  /**
   * Get the router selector for a component (if registered in a router)
   */
  public getRouterForComponent(componentName: string): string | undefined {
    return this.componentToRouter.get(componentName);
  }

  /**
   * Fetch a provider from the router container associated with an entity (backward compatibility)
   */
  public fetchFromRouterContainer(
    Entity: Function,
  ): DependencyContainer | undefined {
    const routerSelector: string | undefined = this.getRouterForComponent(
      Entity.name,
    );
    if (routerSelector && this.routerScopes.has(routerSelector)) {
      return this.container;
    }
    return undefined;
  }

  /**
   * Get a router-level container by selector (backward compatibility)
   */
  public getRouterContainer(selector: string): DependencyContainer | undefined {
    if (!this.routerScopes.has(selector)) {
      return undefined;
    }
    return this.container;
  }

  /**
   * Legacy property accessor for backward compatibility
   */
  public get router(): Map<string, DependencyContainer> {
    const legacyMap: Map<string, DependencyContainer> = new Map<
      string,
      DependencyContainer
    >();
    for (const selector of this.routerScopes.keys()) {
      legacyMap.set(selector, this.container);
    }
    return legacyMap;
  }

  /**
   * Check if a class is a MobX store by looking for MobX symbols
   */
  public isMobxStore(instance: unknown): boolean {
    const mobxSymbol: string = 'mobx-stored-annotations';
    const symbols: Array<symbol> = Object.getOwnPropertySymbols(instance);
    return symbols.some((s: symbol) => s.description === mobxSymbol);
  }

  /**
   * Resolve a dependency with strict scope isolation:
   * 1. Component scope (if component explicitly registered the provider)
   * 2. Router scope (ONLY if component is part of that router's components array)
   * 3. Root scope (for @Injectable({ providedIn: 'root' }) services)
   *
   * Scope override behavior:
   * - If a root service is re-registered at router/component level, that scope gets a NEW instance
   * - Router-scoped services are ONLY accessible to components within that router
   * - Parent components cannot access child router services
   *
   * Returns undefined if no provider is found in accessible scopes
   */
  public resolve<T>(
    className: string,
    componentSelector?: string,
    routerSelector?: string,
    componentClassName?: string,
  ): T | undefined {
    // Special case: DependencyManagement is always available via factory token
    if (className === 'DependencyManagement') {
      return this.container.resolve<T>('DependencyManagement' as never);
    }

    // 1. Try component scope first (highest priority - creates isolated instance)
    if (componentSelector) {
      const componentScope: Map<string, symbol> | undefined =
        this.componentScopes.get(componentSelector);
      const componentToken: symbol | undefined = componentScope?.get(className);

      if (componentToken && this.container.isRegistered(componentToken)) {
        return this.container.resolve<T>(componentToken);
      }
    }

    // 2. Try router scope - check own router first, then parent router
    // For routers: routerSelector = own scope, componentClassName can find parent router
    // For components: componentClassName finds their router scope

    // Try own router scope first (if routerSelector provided)
    if (routerSelector) {
      const routerScope: Map<string, symbol> | undefined =
        this.routerScopes.get(routerSelector);
      const routerToken: symbol | undefined = routerScope?.get(className);

      if (routerToken && this.container.isRegistered(routerToken)) {
        return this.container.resolve<T>(routerToken);
      }
    }

    // Try parent router scope (if this entity is registered as a component of another router)
    const parentRouterSelector: string | undefined = componentClassName
      ? this.getRouterForComponent(componentClassName)
      : undefined;

    if (parentRouterSelector && parentRouterSelector !== routerSelector) {
      const parentRouterScope: Map<string, symbol> | undefined =
        this.routerScopes.get(parentRouterSelector);
      const parentRouterToken: symbol | undefined =
        parentRouterScope?.get(className);

      if (parentRouterToken && this.container.isRegistered(parentRouterToken)) {
        return this.container.resolve<T>(parentRouterToken);
      }
    }

    // 3. Fall back to root scope (global services with @Injectable({ providedIn: 'root' }))
    // This is ONLY accessible if the service wasn't found in component or router scope
    const rootToken: symbol | undefined = this.rootScope.get(className);
    if (rootToken && this.container.isRegistered(rootToken)) {
      return this.container.resolve<T>(rootToken);
    }

    // Return undefined if no provider found in any accessible scope
    return undefined;
  }

  /**
   * Convenience method for resolving dependencies using current context.
   * Use this in component constructors when DependencyManagement is injected.
   *
   * @example
   * constructor(private dm: DependencyManagement) {
   *   this.myService = dm.get<MyService>('MyService');
   * }
   */
  public get<T>(className: string): T | undefined {
    return this.resolve<T>(
      className,
      this.currentSelector,
      this.currentRouterSelector,
    );
  }

  /**
   * Resolve a dependency from component, router, or root scope (backward compatibility)
   */
  public resolveFromScopes(
    EntityName: string,
    componentContainer?: DependencyContainer,
    routerContainer?: DependencyContainer,
  ): unknown {
    // Extract selectors from containers (legacy support)
    let componentSelector: string | undefined;
    let routerSelector: string | undefined;

    if (componentContainer) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [selector, _scopeMap] of this.componentScopes.entries()) {
        componentSelector = selector;
        break; // Use first match for backward compatibility
      }
    }

    if (routerContainer) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [selector, _scopeMap] of this.routerScopes.entries()) {
        routerSelector = selector;
        break; // Use first match for backward compatibility
      }
    }

    return this.resolve(EntityName, componentSelector, routerSelector);
  }

  /**
   * Re-register all providers (helper for reset operations)
   */
  private reregisterAll(): void {
    // Re-register root scope
    for (const [className, token] of this.rootScope.entries()) {
      const Provider: Ctor<unknown> | undefined =
        this.rootClasses.get(className);
      if (Provider) {
        this.container.register(
          token,
          {useClass: Provider},
          {lifecycle: Lifecycle.Singleton},
        );
      }
    }

    // Re-register all router scopes
    for (const [selector, routerScope] of this.routerScopes.entries()) {
      const routerClassMap: Map<string, Ctor<unknown>> | undefined =
        this.routerClasses.get(selector);
      if (routerClassMap) {
        for (const [className, token] of routerScope.entries()) {
          const Provider: Ctor<unknown> | undefined =
            routerClassMap.get(className);
          if (Provider) {
            this.container.register(
              token,
              {useClass: Provider},
              {lifecycle: Lifecycle.Singleton},
            );
          }
        }
      }
    }

    // Re-register all component scopes
    for (const [selector, componentScope] of this.componentScopes.entries()) {
      const componentClassMap: Map<string, Ctor<unknown>> | undefined =
        this.componentClasses.get(selector);
      if (componentClassMap) {
        for (const [className, token] of componentScope.entries()) {
          const Provider: Ctor<unknown> | undefined =
            componentClassMap.get(className);
          if (Provider) {
            this.container.register(
              token,
              {useClass: Provider},
              {lifecycle: Lifecycle.Singleton},
            );
          }
        }
      }
    }
  }

  /**
   * Reset all instances in a specific scope
   * Creates fresh container and re-registers all providers
   * Note: Due to tsyringe limitations, this resets ALL scopes but is still useful for cleanup
   */
  public resetScope(
    _scope: 'root' | 'router' | 'component',
    _selector?: string,
  ): void {
    // Reset entire container and re-register everything
    this.container.reset();
    this.container = tsyringe.createChildContainer();
    this.reregisterAll();
  }

  /**
   * Reset a specific class across all scopes
   * Creates fresh container and re-registers all providers
   * Note: Due to tsyringe limitations, this resets ALL instances
   */
  public resetClass(_className: string): void {
    // Reset entire container and re-register everything
    this.container.reset();
    this.container = tsyringe.createChildContainer();
    this.reregisterAll();
  }

  /**
   * Reset all instances in all scopes
   * This clears all cached singletons but keeps registrations
   */
  public resetAll(): void {
    this.container.clearInstances();
  }
}
