import React from 'react';
import {observer} from 'mobx-react';
import {injectable} from 'tsyringe';
import type {DependencyContainer} from 'tsyringe';
import {DependencyManagement} from '../DependencyManagement';
import {getComponentClassName} from './Component';
import type {
  RouterParams,
  Ctor,
  IoComponent,
  Controller,
  RouterWrapperProps,
  RouterWrapperState,
} from '../types';

// Store React.FC routers by class name
const routerRegistry: Map<string, React.FC> = new Map<string, React.FC>();
// Store reverse mapping: React.FC -> class name
const routerReverseRegistry: Map<React.FC, string> = new Map<
  React.FC,
  string
>();

type RouterDecoratorFunction = <T extends Ctor<IoComponent>>(Entity: T) => T;

// Helper to get router class name from React.FC
function getRouterClassName(router: React.FC): string | undefined {
  return routerReverseRegistry.get(router);
}

export function Router(params: RouterParams): RouterDecoratorFunction {
  const decorator: RouterDecoratorFunction = function <
    T extends Ctor<IoComponent>,
  >(Entity: T): T {
    // Apply @injectable to Entity
    injectable()(Entity);

    const dependencyManagement: DependencyManagement =
      DependencyManagement.getInstance();

    // Extract class names from components (both class constructors and React.FC)
    const componentClassNames: Array<string> = params.components
      .map((comp: Ctor<unknown> | React.FC): string | undefined => {
        // Check if it's a React.FC component
        const componentClassName: string | undefined = getComponentClassName(
          comp as React.FC,
        ) as string | undefined;
        if (componentClassName) {
          return componentClassName;
        }
        // Check if it's a React.FC router
        const routerClassName: string | undefined = getRouterClassName(
          comp as React.FC,
        );
        if (routerClassName) {
          return routerClassName;
        }
        // It's a class constructor, use its name property
        const classComp: Ctor<unknown> = comp as Ctor<unknown>;
        return classComp.name || undefined;
      })
      .filter((name: string | undefined): name is string => name !== undefined);

    // Setup router container with all components and providers
    // This makes providers and components accessible to all components in this router scope
    // Include the Router entity itself as a provider in its own scope
    dependencyManagement.setupRouterContainer(
      componentClassNames,
      [...(params.providers || []), Entity],
      params.selector,
    );

    // Create wrapper component (similar to Component decorator)
    class RouterWrapper extends React.Component<
      RouterWrapperProps,
      RouterWrapperState
    > {
      private entityInstance: IoComponent | null = null;
      private dependencyManagement: DependencyManagement;

      public constructor(props: RouterWrapperProps) {
        super(props);
        const initialState: RouterWrapperState = {};
        this.state = initialState;

        this.dependencyManagement = DependencyManagement.getInstance();

        // Get router container
        const routerContainerInstance: DependencyContainer | undefined =
          this.dependencyManagement.getRouterContainer(params.selector);

        // Register Controller before instantiating Entity
        // Store reference to wrapper instance for state getter
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const wrapperInstance: RouterWrapper = this;
        const controller: Controller<RouterWrapperProps, RouterWrapperState> = {
          props: props,
          get state(): RouterWrapperState {
            return wrapperInstance.state;
          },
          setState: <S = RouterWrapperState>(
            state: S | ((prevState: S) => S),
          ): void => {
            if (typeof state === 'function') {
              this.setState((prevState: RouterWrapperState) => {
                const newState: RouterWrapperState = (
                  state as (prevState: S) => S
                )(prevState as S) as RouterWrapperState;

                // Sync with entity instance state if it exists
                if (this.entityInstance?.state) {
                  Object.assign(this.entityInstance.state, newState);
                }

                return newState;
              });
            } else {
              this.setState((prevState: RouterWrapperState) => {
                const newState: RouterWrapperState = {
                  ...prevState,
                  ...(state as RouterWrapperState),
                };

                // Sync with entity instance state if it exists
                if (this.entityInstance?.state) {
                  Object.assign(this.entityInstance.state, newState);
                }

                return newState;
              });
            }
          },
          forceUpdate: this.forceUpdate.bind(this),
        };

        routerContainerInstance?.register('Controller', {useValue: controller});

        // Get constructor parameter types using reflect-metadata
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const paramTypes: Array<Function> | undefined = Reflect.getMetadata(
          'design:paramtypes',
          Entity,
        );

        // Resolve constructor dependencies automatically
        const constructorArgs: Array<unknown> = [];
        if (paramTypes && paramTypes.length > 0) {
          for (const ParamType of paramTypes) {
            let dependency: unknown = this.dependencyManagement.resolve(
              ParamType.name,
              undefined, // No component selector - this is a router
              params.selector, // Own router scope
              Entity.name, // Pass class name to find parent router if needed
            );

            // Fallback: If dependency is undefined and ParamType is Object,
            // try resolving 'Controller' (TypeScript type erasure for Controller<T>)
            if (dependency === undefined && ParamType.name === 'Object') {
              dependency = routerContainerInstance?.resolve('Controller');
            }

            constructorArgs.push(dependency);
          }
        }

        // Instantiate Entity with resolved dependencies
        this.entityInstance =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          (new Entity(...constructorArgs) as IoComponent) ?? null;

        // Capture initial state from Entity BEFORE replacing with getter
        if (
          this.entityInstance?.state !== undefined &&
          this.entityInstance?.state !== null
        ) {
          const entityState: RouterWrapperState = Object.assign(
            {},
            this.entityInstance.state as Record<string, unknown>,
          );
          Object.assign(this.state, entityState);
        }

        // Auto-bind all methods to maintain 'this' context
        if (this.entityInstance) {
          const prototype: Record<string, unknown> = Object.getPrototypeOf(
            this.entityInstance,
          ) as Record<string, unknown>;
          Object.getOwnPropertyNames(prototype).forEach((key: string) => {
            const descriptor: PropertyDescriptor | undefined =
              Object.getOwnPropertyDescriptor(prototype, key);
            if (
              key !== 'constructor' &&
              descriptor &&
              typeof descriptor.value === 'function'
            ) {
              // Bind method and assign to instance
              (this.entityInstance as unknown as Record<string, unknown>)[key] =
                descriptor.value.bind(this.entityInstance);
            }
          });

          // Replace entity's state property with a getter that always returns controller state
          if ('state' in this.entityInstance) {
            Object.defineProperty(this.entityInstance, 'state', {
              get: () => controller.state,
              configurable: true,
              enumerable: true,
            });
          }
        }
      }

      public componentDidMount(): void {
        if (
          this.entityInstance &&
          typeof this.entityInstance.componentDidMount === 'function'
        ) {
          this.entityInstance.componentDidMount.call(this.entityInstance);
        }
      }

      public componentDidUpdate(
        prevProps: RouterWrapperProps,
        prevState: RouterWrapperState,
      ): void {
        if (
          this.entityInstance &&
          typeof this.entityInstance.componentDidUpdate === 'function'
        ) {
          this.entityInstance.componentDidUpdate.call(
            this.entityInstance,
            prevProps,
            prevState,
          );
        }
      }

      public componentWillUnmount(): void {
        if (
          this.entityInstance &&
          typeof this.entityInstance.componentWillUnmount === 'function'
        ) {
          this.entityInstance.componentWillUnmount.call(this.entityInstance);
        }
      }

      public render(): React.ReactNode {
        if (!this.entityInstance) {
          return null;
        }
        return this.entityInstance.render.call(this.entityInstance);
      }
    }

    // Wrap with MobX observer for reactive updates
    const wrappedComponent: React.ComponentType<RouterWrapperProps> =
      observer(RouterWrapper);

    // Store the React.FC in registry
    const reactComponent: React.FC = wrappedComponent as unknown as React.FC;
    routerRegistry.set(Entity.name, reactComponent);
    routerReverseRegistry.set(reactComponent, Entity.name);

    // Return the original class for TypeScript decorator compatibility
    return Entity;
  };

  return decorator;
}

// Add static $provider method to Router function itself
Router.$provider = <T extends Ctor<IoComponent>>(Entity: T): React.FC => {
  const component: React.FC | undefined = routerRegistry.get(Entity.name);
  if (!component) {
    throw new Error(
      `Router ${Entity.name} not found. Make sure to apply @Router decorator first.`,
    );
  }
  return component;
};
