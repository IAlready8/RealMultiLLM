/**
 * Advanced Plugin System for RealMultiLLM
 * Provides extensible plugin architecture with hooks and dependency management
 */

import { Logger } from '../../../lib/logger';
import { Cache } from '../../../lib/cache';
import { LLMManager } from '../../../lib/llm-manager';

// Type definitions
export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  homepage?: string;
  license?: string;
  dependencies?: string[]; // Plugin IDs this plugin depends on
  enabled: boolean;
  manifest: {
    hooks: PluginHook[];
    permissions: string[];
    apiEndpoints?: string[];
    uiComponents?: string[];
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginHook {
  id: string;
  name: string;
  type: 'before_request' | 'after_request' | 'before_response' | 'after_response' | 'error_handler' | 'custom';
  priority: number; // Lower numbers execute first
  handler: (context: PluginContext) => Promise<PluginResult>;
  enabled: boolean;
}

export interface PluginContext {
  request: any;
  response?: any;
  error?: any;
  metadata: Record<string, any>;
  pluginId: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  config: Record<string, any>;
}

export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
  shouldContinue: boolean; // Whether to continue with the plugin chain
}

export interface PluginRegistry {
  id: string;
  name: string;
  description: string;
  plugins: Map<string, Plugin>;
  hooks: Map<string, PluginHook[]>;
  dependencies: Map<string, string[]>; // pluginId -> dependencies
  activeHooks: Map<string, PluginHook[]>; // hook name -> active hooks
  settings: Map<string, any>;
  logger: Logger;
  cache: Cache;
}

export interface PluginEvent {
  pluginId: string;
  event: 'install' | 'activate' | 'deactivate' | 'update' | 'uninstall' | 'error';
  timestamp: Date;
  metadata: Record<string, any>;
  userId?: string;
}

export interface PluginConfig {
  id: string;
  values: Record<string, any>;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginSystem {
  private registry: PluginRegistry;
  private eventLog: PluginEvent[];
  private configurations: Map<string, PluginConfig>; // pluginId_userId -> config
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private hooksExecuted: Map<string, boolean>; // Keeps track of which hooks have been executed

  constructor() {
    this.registry = {
      id: 'main-registry',
      name: 'Main Plugin Registry',
      description: 'Default plugin registry',
      plugins: new Map(),
      hooks: new Map(),
      dependencies: new Map(),
      activeHooks: new Map(),
      settings: new Map(),
      logger: new Logger('PluginSystem'),
      cache: new Cache()
    };
    
    this.eventLog = [];
    this.configurations = new Map();
    this.logger = new Logger('PluginSystem');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    this.hooksExecuted = new Map();
    
    this.initializeCoreHooks();
  }

  /**
   * Initialize core hooks that are always available
   */
  private initializeCoreHooks(): void {
    // Define core hooks that plugins can attach to
    this.registry.hooks.set('before_request', []);
    this.registry.hooks.set('after_request', []);
    this.registry.hooks.set('before_response', []);
    this.registry.hooks.set('after_response', []);
    this.registry.hooks.set('error_handler', []);
    this.registry.hooks.set('model_selection', []);
    this.registry.hooks.set('content_filter', []);
    this.registry.hooks.set('rate_limit_check', []);
    this.registry.hooks.set('analytics_capture', []);
  }

  /**
   * Register a new plugin
   */
  async registerPlugin(plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plugin> {
    // Validate plugin dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.registry.plugins.has(dep)) {
          throw new Error(`Plugin dependency not found: ${dep}`);
        }
      }
    }

    const newPlugin: Plugin = {
      ...plugin,
      id: `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.registry.plugins.set(newPlugin.id, newPlugin);
    
    // Register plugin's hooks
    if (newPlugin.manifest.hooks) {
      for (const hook of newPlugin.manifest.hooks) {
        await this.registerHook(newPlugin.id, hook);
      }
    }

    // Log the event
    this.logEvent({
      pluginId: newPlugin.id,
      event: 'install',
      timestamp: new Date(),
      metadata: { plugin: newPlugin.name, version: newPlugin.version }
    });

    this.logger.info(`Plugin registered: ${newPlugin.name} v${newPlugin.version}`);
    return newPlugin;
  }

  /**
   * Register a hook for a plugin
   */
  async registerHook(pluginId: string, hook: PluginHook): Promise<void> {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Add hook to the registry
    let hooks = this.registry.hooks.get(hook.name);
    if (!hooks) {
      hooks = [];
      this.registry.hooks.set(hook.name, hooks);
    }

    hooks.push({ ...hook, id: `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` });

    // Update active hooks if plugin is enabled
    if (plugin.enabled) {
      this.updateActiveHooks();
    }

    this.logger.info(`Hook registered: ${hook.name} for plugin ${plugin.name}`);
  }

  /**
   * Install a plugin from a manifest
   */
  async installPluginFromManifest(manifest: any): Promise<Plugin> {
    // Validate manifest
    if (!manifest.name || !manifest.version) {
      throw new Error('Invalid plugin manifest: missing name or version');
    }

    // Create plugin from manifest
    const plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'> = {
      name: manifest.name,
      description: manifest.description || '',
      version: manifest.version,
      author: manifest.author || 'Unknown',
      homepage: manifest.homepage,
      license: manifest.license,
      dependencies: manifest.dependencies,
      enabled: true,
      manifest: manifest.manifest || {
        hooks: [],
        permissions: [],
        apiEndpoints: manifest.apiEndpoints || [],
        uiComponents: manifest.uiComponents || []
      },
      metadata: manifest.metadata || {}
    };

    return await this.registerPlugin(plugin);
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.enabled = true;
    plugin.updatedAt = new Date();

    // Update active hooks
    this.updateActiveHooks();

    // Log the event
    this.logEvent({
      pluginId,
      event: 'activate',
      timestamp: new Date(),
      metadata: { name: plugin.name }
    });

    this.logger.info(`Plugin enabled: ${plugin.name}`);
    return true;
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.enabled = false;
    plugin.updatedAt = new Date();

    // Update active hooks
    this.updateActiveHooks();

    // Log the event
    this.logEvent({
      pluginId,
      event: 'deactivate',
      timestamp: new Date(),
      metadata: { name: plugin.name }
    });

    this.logger.info(`Plugin disabled: ${plugin.name}`);
    return true;
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    // Remove plugin's hooks
    for (const [hookName, hooks] of this.registry.hooks.entries()) {
      const filteredHooks = hooks.filter(hook => hook.id !== pluginId);
      this.registry.hooks.set(hookName, filteredHooks);
    }

    // Update active hooks
    this.updateActiveHooks();

    // Remove from registry
    this.registry.plugins.delete(pluginId);

    // Log the event
    this.logEvent({
      pluginId,
      event: 'uninstall',
      timestamp: new Date(),
      metadata: { name: plugin.name }
    });

    this.logger.info(`Plugin uninstalled: ${plugin.name}`);
    return true;
  }

  /**
   * Execute a hook
   */
  async executeHook(hookName: string, context: PluginContext): Promise<PluginResult[]> {
    const results: PluginResult[] = [];
    const hooks = this.registry.activeHooks.get(hookName) || [];

    // Sort hooks by priority (lower numbers execute first)
    const sortedHooks = [...hooks].sort((a, b) => a.priority - b.priority);

    for (const hook of sortedHooks) {
      if (!hook.enabled) continue;

      try {
        const result = await hook.handler({ ...context, pluginId: hook.id });
        results.push(result);

        // If any hook indicates to stop the chain, break out
        if (!result.shouldContinue) {
          break;
        }
      } catch (error) {
        this.logger.error(`Error executing hook ${hookName} in plugin ${hook.id}:`, error);
        
        results.push({
          success: false,
          error: error.message,
          shouldContinue: true // Continue with other plugins even if one fails
        });

        // Log error event
        this.logEvent({
          pluginId: hook.id,
          event: 'error',
          timestamp: new Date(),
          metadata: { hookName, error: error.message }
        });
      }
    }

    return results;
  }

  /**
   * Update the active hooks map based on plugin status
   */
  private updateActiveHooks(): void {
    this.registry.activeHooks.clear();

    for (const [pluginId, plugin] of this.registry.plugins.entries()) {
      if (!plugin.enabled) continue;

      for (const hook of plugin.manifest.hooks) {
        if (hook.enabled) {
          let hooks = this.registry.activeHooks.get(hook.name);
          if (!hooks) {
            hooks = [];
            this.registry.activeHooks.set(hook.name, hooks);
          }
          hooks.push(hook);
        }
      }
    }
  }

  /**
   * Call a registered hook with context
   */
  async callHook(
    hookName: string, 
    request: any, 
    userId?: string, 
    sessionId?: string
  ): Promise<PluginResult[]> {
    // Create plugin context
    const context: PluginContext = {
      request,
      response: undefined,
      error: undefined,
      metadata: {},
      pluginId: 'system',
      userId,
      sessionId,
      timestamp: new Date(),
      config: this.getPluginConfig('*', userId) // Get global config
    };

    return await this.executeHook(hookName, context);
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.registry.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.registry.plugins.values());
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): Plugin[] {
    return Array.from(this.registry.plugins.values()).filter(p => p.enabled);
  }

  /**
   * Get hooks by name
   */
  getHooks(hookName: string): PluginHook[] {
    return this.registry.hooks.get(hookName) || [];
  }

  /**
   * Get active hooks by name
   */
  getActiveHooks(hookName: string): PluginHook[] {
    return this.registry.activeHooks.get(hookName) || [];
  }

  /**
   * Set a configuration value for a plugin
   */
  setPluginConfig(pluginId: string, values: Record<string, any>, userId?: string): void {
    const configId = userId ? `${pluginId}_${userId}` : `${pluginId}_global`;
    
    const config: PluginConfig = {
      id: configId,
      values: { ...values },
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.configurations.set(configId, config);
  }

  /**
   * Get configuration for a plugin
   */
  getPluginConfig(pluginId: string, userId?: string): Record<string, any> {
    const configId = userId ? `${pluginId}_${userId}` : `${pluginId}_global`;
    const config = this.configurations.get(configId);
    
    if (config) {
      return { ...config.values };
    }
    
    // If user-specific config doesn't exist, return global config
    if (userId) {
      const globalConfigId = `${pluginId}_global`;
      const globalConfig = this.configurations.get(globalConfigId);
      return globalConfig ? { ...globalConfig.values } : {};
    }
    
    return {};
  }

  /**
   * Update plugin configuration
   */
  updatePluginConfig(pluginId: string, newValues: Record<string, any>, userId?: string): boolean {
    const configId = userId ? `${pluginId}_${userId}` : `${pluginId}_global`;
    const config = this.configurations.get(configId);
    
    if (!config) {
      return false;
    }
    
    config.values = { ...config.values, ...newValues };
    config.updatedAt = new Date();
    
    return true;
  }

  /**
   * Hot reload a plugin (for development)
   */
  async hotReloadPlugin(pluginId: string, newManifest: any): Promise<boolean> {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    // Update the plugin's manifest
    plugin.manifest = newManifest;
    plugin.updatedAt = new Date();

    // Re-register hooks
    this.registry.hooks.set(pluginId, []);
    if (plugin.manifest.hooks) {
      for (const hook of plugin.manifest.hooks) {
        await this.registerHook(pluginId, hook);
      }
    }

    // Update active hooks
    this.updateActiveHooks();

    this.logger.info(`Plugin hot reloaded: ${plugin.name}`);
    return true;
  }

  /**
   * Check if a plugin has a specific permission
   */
  hasPermission(pluginId: string, permission: string): boolean {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin) return false;

    return plugin.manifest.permissions.includes(permission);
  }

  /**
   * Validate plugin dependencies
   */
  validateDependencies(pluginId: string): { valid: boolean; missing: string[] } {
    const plugin = this.registry.plugins.get(pluginId);
    if (!plugin || !plugin.dependencies) {
      return { valid: true, missing: [] };
    }

    const missing = plugin.dependencies.filter(depId => !this.registry.plugins.has(depId));
    return { valid: missing.length === 0, missing };
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    totalPlugins: number;
    activePlugins: number;
    totalHooks: number;
    activeHooks: number;
    totalConfigurations: number;
    eventCount: number;
  } {
    const activePlugins = Array.from(this.registry.plugins.values()).filter(p => p.enabled);
    
    return {
      totalPlugins: this.registry.plugins.size,
      activePlugins: activePlugins.length,
      totalHooks: Array.from(this.registry.hooks.values()).flat().length,
      activeHooks: Array.from(this.registry.activeHooks.values()).flat().length,
      totalConfigurations: this.configurations.size,
      eventCount: this.eventLog.length
    };
  }

  /**
   * Log a plugin event
   */
  private logEvent(event: Omit<PluginEvent, 'timestamp'>): void {
    const fullEvent: PluginEvent = {
      ...event,
      timestamp: new Date()
    };

    this.eventLog.push(fullEvent);

    // Keep only the last 1000 events to prevent memory issues
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }

    // Cache important events
    if (event.event === 'error') {
      this.cache.set(`plugin:event:${fullEvent.timestamp.getTime()}`, fullEvent, 60 * 60 * 24); // 24 hours
    }

    this.logger.info(`Plugin event: ${event.event}`, { pluginId: event.pluginId });
  }

  /**
   * Get plugin events
   */
  getEvents(pluginId?: string, limit: number = 50): PluginEvent[] {
    let events = [...this.eventLog];
    
    if (pluginId) {
      events = events.filter(e => e.pluginId === pluginId);
    }
    
    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Load plugins from configuration
   */
  async loadPluginsFromConfig(config: any[]): Promise<void> {
    for (const pluginConfig of config) {
      try {
        await this.installPluginFromManifest(pluginConfig);
        if (pluginConfig.enabled) {
          await this.enablePlugin(this.registry.plugins.size > 0 ? 
            Array.from(this.registry.plugins.keys())[this.registry.plugins.size - 1] : 
            '');
        }
      } catch (error) {
        this.logger.error(`Failed to load plugin from config:`, error);
      }
    }
  }

  /**
   * Create a plugin development environment
   */
  createDevelopmentEnvironment(): {
    registerHook: (name: string, handler: PluginHook['handler']) => void;
    executeHook: (name: string, context: any) => Promise<PluginResult[]>;
    setConfig: (values: Record<string, any>) => void;
    getConfig: () => Record<string, any>;
  } {
    const config: Record<string, any> = {};
    const hooks: Record<string, PluginHook['handler'][]> = {};

    return {
      registerHook: (name: string, handler: PluginHook['handler']) => {
        if (!hooks[name]) hooks[name] = [];
        hooks[name].push(handler);
      },
      executeHook: async (name: string, context: any) => {
        const handlers = hooks[name] || [];
        const results: PluginResult[] = [];

        for (const handler of handlers) {
          try {
            const result = await handler(context);
            results.push(result);
            if (!result.shouldContinue) break;
          } catch (error) {
            results.push({
              success: false,
              error: error.message,
              shouldContinue: true
            });
          }
        }

        return results;
      },
      setConfig: (values: Record<string, any>) => {
        Object.assign(config, values);
      },
      getConfig: () => ({ ...config })
    };
  }
}

// Plugin utilities and helpers
export class PluginUtils {
  /**
   * Validate a plugin manifest
   */
  static validateManifest(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Plugin name is required and must be a string');
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Plugin version is required and must be a string');
    }

    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    if (manifest.hooks && !Array.isArray(manifest.hooks)) {
      errors.push('Hooks must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a plugin configuration schema
   */
  static createConfigSchema(definition: Record<string, { type: string; required?: boolean; default?: any; description?: string }>): any {
    // In a real implementation, this would create a schema for validation
    // For now, it just returns the definition
    return definition;
  }

  /**
   * Format plugin information for display
   */
  static formatPluginInfo(plugin: Plugin): string {
    return `${plugin.name} v${plugin.version} by ${plugin.author}
Description: ${plugin.description}
Enabled: ${plugin.enabled ? 'Yes' : 'No'}
Hooks: ${plugin.manifest.hooks.length}
Permissions: ${plugin.manifest.permissions.join(', ')}`;
  }
}

// Predefined plugin hooks that can be used
export const CORE_HOOKS = {
  BEFORE_REQUEST: 'before_request' as const,
  AFTER_REQUEST: 'after_request' as const,
  BEFORE_RESPONSE: 'before_response' as const,
  AFTER_RESPONSE: 'after_response' as const,
  ERROR_HANDLER: 'error_handler' as const,
  MODEL_SELECTION: 'model_selection' as const,
  CONTENT_FILTER: 'content_filter' as const,
  RATE_LIMIT_CHECK: 'rate_limit_check' as const,
  ANALYTICS_CAPTURE: 'analytics_capture' as const
};