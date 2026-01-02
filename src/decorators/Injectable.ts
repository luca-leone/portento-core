import {injectable} from 'tsyringe';
import {DependencyManagement} from '../DependencyManagement';
import type {InjectableParams} from '../types';
import type {constructor} from 'tsyringe/dist/typings/types';

export function Injectable(params?: InjectableParams): ClassDecorator {
  return function <T extends Function>(Entity: T): T {
    // Apply tsyringe's @injectable
    injectable()(Entity as unknown as constructor<unknown>);

    // Register in root scope if providedIn: 'root'
    if (params?.providedIn === 'root') {
      const dependencyManagement: DependencyManagement =
        DependencyManagement.getInstance();
      dependencyManagement.setupRootContainer(Entity);
    }

    return Entity;
  };
}
