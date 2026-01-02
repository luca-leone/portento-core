import React from 'react';
import {observer} from 'mobx-react';
import {injectable} from 'tsyringe';
import type {DependencyContainer} from 'tsyringe';
import {DependencyManagement} from '../DependencyManagement';
import type {
  ComponentParams,
  Ctor,
  IoComponent,
  Controller,
  ComponentWrapperProps,
  ComponentWrapperState,
} from '../types';

// Store React.FC components by class name
const componentRegistry: Map<string, React.FC> = new Map<string, React.FC>();
// Store reverse mapping: React.FC -> class name
const componentReverseRegistry: Map<React.FC, string> = new Map<
  React.FC,
  string
>();

type ComponentDecoratorFunction = {
  <T extends Ctor<IoComponent>>(Entity: T): T;
  $provider: <T extends Ctor<IoComponent>>(Entity: T) => React.FC;
};

export function Component(params: ComponentParams): ComponentDecoratorFunction {
  const decorator: ComponentDecoratorFunction = function <
    T extends Ctor<IoComponent>,
  >(Entity: T): T {
    // Apply @injectable to Entity
    injectable()(Entity);

    // Create wrapper component
    class ComponentWrapper extends React.Component<
      ComponentWrapperProps,
      ComponentWrapperState
    > {
      private entityInstance: IoComponent | null = null;
      private dependencyManagement: DependencyManagement;

      public constructor(props: ComponentWrapperProps) {
        super(props);
        const initialState: ComponentWrapperState = {};
        this.state = initialState;

        this.dependencyManagement = DependencyManagement.getInstance();

        // Setup component container and register the Entity class itself
        this.dependencyManagement.setupComponentContainer(params.selector, [
          ...(params.providers || []),
          Entity,
        ]);

        // Get component container for Controller registration
        const componentContainer: DependencyContainer | undefined =
          this.dependencyManagement.getComponentContainer(params.selector);

        // Auto-discover router membership
        const routerSelector: string | undefined =
          this.dependencyManagement.getRouterForComponent(Entity.name);

        // Register Controller before instantiating Entity
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self: ComponentWrapper = this;
        const controller: Controller<
          ComponentWrapperProps,
          ComponentWrapperState
        > = {
          props: props,
          get state(): ComponentWrapperState {
            return self.state;
          },
          setState: <S = ComponentWrapperState>(
            state: S | ((prevState: S) => S),
          ): void => {
            if (typeof state === 'function') {
              this.setState((prevState: ComponentWrapperState) => {
                const newState: ComponentWrapperState = (
                  state as (prevState: S) => S
                )(prevState as S) as ComponentWrapperState;

                return newState;
              });
            } else {
              this.setState((prevState: ComponentWrapperState) => {
                const newState: ComponentWrapperState = {
                  ...prevState,
                  ...(state as ComponentWrapperState),
                };

                return newState;
              });
            }
          },
          forceUpdate: this.forceUpdate.bind(this),
        };

        componentContainer?.register('Controller', {useValue: controller});

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
              params.selector,
              routerSelector,
              Entity.name,
            );

            // Fallback: If dependency is undefined and ParamType is Object,
            // try resolving 'Controller' (TypeScript type erasure for Controller<T>)
            if (dependency === undefined && ParamType.name === 'Object') {
              dependency = componentContainer?.resolve('Controller');
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
          const entityState: ComponentWrapperState = Object.assign(
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
              // Bind method and assign to instance (not prototype)
              // This ensures each method has stable reference per entity instance
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
        prevProps: ComponentWrapperProps,
        prevState: ComponentWrapperState,
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

    // Check if Entity instance has MobX stores and wrap with observer
    // Observer handles reactivity - component re-renders when observables change
    const wrappedComponent: React.ComponentType<ComponentWrapperProps> =
      observer(ComponentWrapper);

    // Store the React.FC in registry
    const reactComponent: React.FC = wrappedComponent as unknown as React.FC;
    componentRegistry.set(Entity.name, reactComponent);
    componentReverseRegistry.set(reactComponent, Entity.name);

    // Return the original class for TypeScript decorator compatibility
    return Entity;
  } as ComponentDecoratorFunction;

  // $provider retrieves the stored React.FC
  decorator.$provider = <T extends Ctor<IoComponent>>(Entity: T): React.FC => {
    const component: React.FC | undefined = componentRegistry.get(Entity.name);
    if (!component) {
      throw new Error(
        `Component ${Entity.name} not found. Make sure to apply @Component decorator first.`,
      );
    }
    return component;
  };

  return decorator as ComponentDecoratorFunction;
}

// Helper to get class name from React.FC
export function getComponentClassName(component: React.FC): string | undefined {
  return componentReverseRegistry.get(component);
}

// Add static $provider method to Component function itself
Component.$provider = <T extends Ctor<IoComponent>>(Entity: T): React.FC => {
  const component: React.FC | undefined = componentRegistry.get(Entity.name);
  if (!component) {
    throw new Error(
      `Component ${Entity.name} not found. Make sure to apply @Component decorator first.`,
    );
  }
  return component;
};
