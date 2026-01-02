import { DependencyManagement } from "./DependencyManagement";

// Re-export decorators
export { Component } from "./decorators/Component";
export { Injectable } from "./decorators/Injectable";
export { Router } from "./decorators/Router";

// Re-export types
export type {
  Ctor,
  Controller,
  InjectableParams,
  ComponentParams,
  RouterParams,
  IoComponent,
  ComponentWrapperProps,
  ComponentWrapperState,
  RouterWrapperProps,
  RouterWrapperState,
} from "./types";

/**
 * Reset all dependency instances in a specific scope
 * Note: Due to tsyringe limitations, this resets ALL scopes.
 * Useful for cleanup after logout, between tests, or when navigating away from features.
 * All providers are automatically re-registered and will be re-instantiated on next access.
 *
 * @param _scope - Scope type (for API compatibility, currently resets all)
 * @param _selector - Scope selector (for API compatibility, currently resets all)
 *
 * @example
 * // Clean up on logout
 * resetScope('root');
 *
 * // Clean up when unmounting router
 * resetScope('router', 'main-nav-router');
 *
 * // Clean up component scope
 * resetScope('component', 'home-screen');
 */
export function resetScope(
  _scope: "root" | "router" | "component",
  _selector?: string
): void {
  DependencyManagement.getInstance().resetScope(_scope, _selector);
}

/**
 * Reset all dependency instances
 * Note: Due to tsyringe limitations, this resets ALL instances, not just the specified class.
 * Useful for targeted cleanup scenarios. All providers are automatically re-registered.
 *
 * @param _className - Class name (for API compatibility, currently resets all)
 *
 * @example
 * // Conceptually reset SharedNavStore
 * resetClass('SharedNavStore');
 */
export function resetClass(_className: string): void {
  DependencyManagement.getInstance().resetClass(_className);
}

/**
 * Reset all instances in all scopes
 * Warning: This will clear all cached singletons
 *
 * @example
 * // Clear everything (useful between tests)
 * resetAll();
 */
export function resetAll(): void {
  DependencyManagement.getInstance().resetAll();
}
