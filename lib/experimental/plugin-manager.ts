// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 🔌 ADVANCED FEATURE 6: Plugin Architecture with Hot-Swappable Extensions
 * 
 * Modular system allowing third-party plugins to extend functionality
 * without restarts, with sandboxed execution and dependency management.
 */

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  keywords: string[];
  main: string; // Entry point file
  dependencies: Record<string, string>;
  permissions: PluginPermission[];
  hooks: string[]; // Hook points this plugin uses
  apis: string[]; // APIs this plugin provides
  settings?: PluginSettingSchema[];
  icon?: string;
  category: 'llm-provider' | 'ui-enhancement' | 'analytics' | 'workflow' | 'utility' | 'integration';
}

interface PluginPermission {
  type: 'api-access' | 'file-system' | 'network' | 'storage' | 'ui-modification';
  resource: string;
  description: string;
  required: boolean;
}

interface PluginSettingSchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multi-select';
  label: string;
  description: string;
  default?: any;
  options?: Array<{value: any; label: string}>;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string; // Custom validation function
  };
}

interface PluginInstance {
  id: string;
  manifest: PluginManifest;
  status: 'loading' | 'active' | 'inactive' | 'error' | 'disabled';
  instance?: any; // The actual plugin instance
  settings: Record<string, any>;
  runtime: {
    loadedAt: Date;
    lastUpdate?: Date;
    memoryUsage: number;
    cpuUsage: number;
    apiCalls: number;
    errors: PluginError[];
  };
  sandboxContext?: PluginSandbox;
}

interface PluginError {
  timestamp: Date;
  type: 'runtime' | 'permission' | 'api' | 'dependency';
  message: string;
  stack?: string;
  context?: any;
}

interface PluginHook {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returnType?: string;
  async: boolean;
}

interface PluginAPI {
  namespace: string;
  methods: Record<string, PluginAPIMethod>;
  events: Record<string, PluginAPIEvent>;
}

interface PluginAPIMethod {
  name: string;
  description: string;
  parameters: Array<{name: string; type: string; required: boolean}>;
  returnType: string;
  permissions: string[];
}

interface PluginAPIEvent {
  name: string;
  description: string;
  data: Record<string, any>;
}

interface PluginSandbox {
  vm: any; // Isolated VM context
  allowedModules: Set<string>;
  apiProxy: any;
  resourceLimits: {
    memory: number;
    cpu: number;
    networkRequests: number;
    fileOperations: number;
  };
  usage: {
    memory: number;
    cpu: number;
    networkRequests: number;
    fileOperations: number;
  };
}

class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private hooks: Map<string, PluginHook> = new Map();
  private apis: Map<string, PluginAPI> = new Map();
  private registry: PluginRegistry;
  private eventBus: PluginEventBus;
  private securityManager: PluginSecurityManager;
  private dependencyManager: PluginDependencyManager;

  constructor() {
    this.registry = new PluginRegistry();
    this.eventBus = new PluginEventBus();
    this.securityManager = new PluginSecurityManager();
    this.dependencyManager = new PluginDependencyManager();
    this.initializeCoreHooks();
    this.initializeCoreAPIs();
    this.startMonitoring();
  }

  /**
   * Load a plugin from a manifest and source code
   */
  async loadPlugin(
    manifestData: PluginManifest,
    sourceCode: string,
    settings: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      // Validate manifest
      const validationResult = this.validateManifest(manifestData);
      if (!validationResult.valid) {
        throw new Error(`Invalid manifest: ${validationResult.errors.join(', ')}`);
      }

      // Check dependencies
      const dependencyCheck = await this.dependencyManager.checkDependencies(manifestData.dependencies);
      if (!dependencyCheck.satisfied) {
        throw new Error(`Missing dependencies: ${dependencyCheck.missing.join(', ')}`);
      }

      // Create plugin instance
      const pluginInstance: PluginInstance = {
        id: manifestData.id,
        manifest: manifestData,
        status: 'loading',
        settings: { ...this.getDefaultSettings(manifestData), ...settings },
        runtime: {
          loadedAt: new Date(),
          memoryUsage: 0,
          cpuUsage: 0,
          apiCalls: 0,
          errors: []
        }
      };

      // Create sandbox environment
      pluginInstance.sandboxContext = await this.createSandbox(manifestData);

      // Load plugin code in sandbox
      const instance = await this.loadPluginInSandbox(
        pluginInstance.sandboxContext,
        sourceCode,
        manifestData,
        pluginInstance.settings
      );

      pluginInstance.instance = instance;
      pluginInstance.status = 'active';

      // Register plugin
      this.plugins.set(manifestData.id, pluginInstance);

      // Register hooks and APIs
      await this.registerPluginHooks(pluginInstance);
      await this.registerPluginAPIs(pluginInstance);

      // Emit plugin loaded event
      this.eventBus.emit('plugin:loaded', { pluginId: manifestData.id });

      console.log(`Plugin ${manifestData.name} (${manifestData.id}) loaded successfully`);
      return true;

    } catch (error) {
      console.error(`Failed to load plugin ${manifestData.id}:`, error);
      this.recordPluginError(manifestData.id, 'runtime', error.message, error.stack);
      return false;
    }
  }

  /**
   * Unload a plugin and clean up resources
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) return false;

      // Call plugin cleanup if available
      if (plugin.instance?.cleanup) {
        await plugin.instance.cleanup();
      }

      // Unregister hooks and APIs
      await this.unregisterPluginHooks(plugin);
      await this.unregisterPluginAPIs(plugin);

      // Destroy sandbox
      if (plugin.sandboxContext) {
        await this.destroySandbox(plugin.sandboxContext);
      }

      // Remove from registry
      this.plugins.delete(pluginId);

      // Emit plugin unloaded event
      this.eventBus.emit('plugin:unloaded', { pluginId });

      console.log(`Plugin ${pluginId} unloaded successfully`);
      return true;

    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Hot-reload a plugin with new code
   */
  async reloadPlugin(pluginId: string, newSourceCode?: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    const manifest = plugin.manifest;
    const settings = plugin.settings;

    // Unload current version
    await this.unloadPlugin(pluginId);

    // Load new version
    const sourceCode = newSourceCode || await this.registry.getPluginCode(pluginId);
    return await this.loadPlugin(manifest, sourceCode, settings);
  }

  /**
   * Execute a hook with all registered plugins
   */
  async executeHook(hookName: string, data: any): Promise<any[]> {
    const hook = this.hooks.get(hookName);
    if (!hook) return [];

    const results: any[] = [];
    const pluginsToExecute = Array.from(this.plugins.values())
      .filter(plugin => 
        plugin.status === 'active' && 
        plugin.manifest.hooks.includes(hookName)
      );

    for (const plugin of pluginsToExecute) {
      try {
        const startTime = Date.now();
        let result: any;

        if (hook.async) {
          result = await this.executePluginHookAsync(plugin, hookName, data);
        } else {
          result = this.executePluginHookSync(plugin, hookName, data);
        }

        const executionTime = Date.now() - startTime;
        this.updatePluginMetrics(plugin, executionTime);

        results.push({
          pluginId: plugin.id,
          result,
          executionTime
        });

      } catch (error) {
        console.error(`Hook ${hookName} failed for plugin ${plugin.id}:`, error);
        this.recordPluginError(plugin.id, 'runtime', error.message, error.stack);
      }
    }

    return results;
  }

  /**
   * Call a plugin API method
   */
  async callPluginAPI(
    pluginId: string,
    namespace: string,
    method: string,
    ...args: any[]
  ): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.status !== 'active') {
      throw new Error(`Plugin ${pluginId} not found or not active`);
    }

    const api = this.apis.get(`${pluginId}:${namespace}`);
    if (!api) {
      throw new Error(`API ${namespace} not found in plugin ${pluginId}`);
    }

    const methodDef = api.methods[method];
    if (!methodDef) {
      throw new Error(`Method ${method} not found in API ${namespace}`);
    }

    // Check permissions
    const hasPermission = await this.securityManager.checkAPIPermission(
      plugin,
      namespace,
      method
    );
    if (!hasPermission) {
      throw new Error(`Permission denied for ${namespace}.${method}`);
    }

    try {
      plugin.runtime.apiCalls++;
      return await plugin.instance[namespace][method](...args);
    } catch (error) {
      this.recordPluginError(plugin.id, 'api', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(pluginId: string, newSettings: Record<string, any>): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      // Validate settings
      const validationResult = this.validateSettings(plugin.manifest, newSettings);
      if (!validationResult.valid) {
        throw new Error(`Invalid settings: ${validationResult.errors.join(', ')}`);
      }

      // Update settings
      plugin.settings = { ...plugin.settings, ...newSettings };

      // Notify plugin of settings change
      if (plugin.instance?.onSettingsChange) {
        await plugin.instance.onSettingsChange(plugin.settings);
      }

      // Emit settings changed event
      this.eventBus.emit('plugin:settings-changed', { pluginId, settings: plugin.settings });

      return true;
    } catch (error) {
      console.error(`Failed to update settings for plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get plugin information and status
   */
  getPluginInfo(pluginId: string): PluginInstance | null {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * List all loaded plugins
   */
  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin health metrics
   */
  getPluginMetrics(pluginId: string): any {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;

    return {
      id: plugin.id,
      name: plugin.manifest.name,
      status: plugin.status,
      runtime: plugin.runtime,
      resourceUsage: plugin.sandboxContext?.usage || {},
      errorRate: this.calculateErrorRate(plugin),
      performance: this.calculatePerformanceMetrics(plugin)
    };
  }

  // Private implementation methods
  private validateManifest(manifest: PluginManifest): {valid: boolean; errors: string[]} {
    const errors: string[] = [];

    if (!manifest.id || !/^[a-z0-9-_]+$/.test(manifest.id)) {
      errors.push('Invalid plugin ID');
    }

    if (!manifest.name || manifest.name.length < 3) {
      errors.push('Plugin name must be at least 3 characters');
    }

    if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      errors.push('Invalid version format (must be semver)');
    }

    if (!manifest.main || !manifest.main.endsWith('.js')) {
      errors.push('Main entry point must be a JavaScript file');
    }

    if (!Array.isArray(manifest.permissions)) {
      errors.push('Permissions must be an array');
    }

    return { valid: errors.length === 0, errors };
  }

  private getDefaultSettings(manifest: PluginManifest): Record<string, any> {
    const defaults: Record<string, any> = {};
    
    if (manifest.settings) {
      manifest.settings.forEach(setting => {
        if (setting.default !== undefined) {
          defaults[setting.key] = setting.default;
        }
      });
    }

    return defaults;
  }

  private async createSandbox(manifest: PluginManifest): Promise<PluginSandbox> {
    // Create isolated execution environment
    const sandbox: PluginSandbox = {
      vm: null, // Would use Node.js VM or Web Workers in real implementation
      allowedModules: new Set(['console', 'crypto', 'buffer']),
      apiProxy: this.createAPIProxy(manifest),
      resourceLimits: {
        memory: 50 * 1024 * 1024, // 50MB
        cpu: 1000, // 1 second per minute
        networkRequests: 100, // per minute
        fileOperations: 50 // per minute
      },
      usage: {
        memory: 0,
        cpu: 0,
        networkRequests: 0,
        fileOperations: 0
      }
    };

    return sandbox;
  }

  private createAPIProxy(manifest: PluginManifest): any {
    const proxy: any = {};

    // Add core APIs based on permissions
    manifest.permissions.forEach(permission => {
      switch (permission.type) {
        case 'api-access':
          if (permission.resource === 'llm') {
            proxy.llm = this.createLLMProxy();
          }
          break;
        case 'storage':
          proxy.storage = this.createStorageProxy();
          break;
        case 'ui-modification':
          proxy.ui = this.createUIProxy();
          break;
      }
    });

    // Add event system
    proxy.events = {
      on: (event: string, handler: Function) => this.eventBus.on(event, handler),
      emit: (event: string, data: any) => this.eventBus.emit(event, data),
      off: (event: string, handler: Function) => this.eventBus.off(event, handler)
    };

    return proxy;
  }

  private createLLMProxy(): any {
    return {
      query: async (provider: string, prompt: string, options: any = {}) => {
        // Proxy to LLM system with rate limiting and monitoring
        return { response: 'Mock LLM response', tokens: 100 };
      },
      listProviders: () => ['openai', 'claude', 'google'],
      getProviderStatus: (provider: string) => ({ available: true, latency: 100 })
    };
  }

  private createStorageProxy(): any {
    return {
      get: async (key: string) => {
        // Namespaced storage access
        return localStorage.getItem(`plugin_${key}`);
      },
      set: async (key: string, value: any) => {
        localStorage.setItem(`plugin_${key}`, JSON.stringify(value));
      },
      delete: async (key: string) => {
        localStorage.removeItem(`plugin_${key}`);
      }
    };
  }

  private createUIProxy(): any {
    return {
      addMenuItem: (menu: string, item: any) => {
        // Add menu item to UI
        console.log(`Adding menu item to ${menu}:`, item);
      },
      addPanel: (id: string, config: any) => {
        // Add UI panel
        console.log(`Adding UI panel ${id}:`, config);
      },
      showNotification: (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
        console.log(`Notification (${type}): ${message}`);
      }
    };
  }

  private async loadPluginInSandbox(
    sandbox: PluginSandbox,
    sourceCode: string,
    manifest: PluginManifest,
    settings: Record<string, any>
  ): Promise<any> {
    // In a real implementation, this would use VM or Web Workers
    // For demo purposes, we'll simulate plugin loading
    
    try {
      // Simulate secure code execution
      const pluginFunction = new Function(
        'api',
        'settings',
        'manifest',
        `
        ${sourceCode}
        
        // Plugin must export a class or object
        if (typeof Plugin !== 'undefined') {
          return new Plugin(api, settings, manifest);
        } else if (typeof plugin !== 'undefined') {
          return plugin;
        } else {
          throw new Error('Plugin must export a Plugin class or plugin object');
        }
        `
      );

      const instance = pluginFunction(sandbox.apiProxy, settings, manifest);

      // Call initialization if available
      if (instance.initialize) {
        await instance.initialize();
      }

      return instance;

    } catch (error) {
      throw new Error(`Failed to load plugin code: ${error.message}`);
    }
  }

  private async destroySandbox(sandbox: PluginSandbox): Promise<void> {
    // Clean up sandbox resources
    sandbox.vm = null;
    sandbox.allowedModules.clear();
    sandbox.apiProxy = null;
  }

  private async registerPluginHooks(plugin: PluginInstance): Promise<void> {
    if (!plugin.instance.hooks) return;

    for (const [hookName, hookImpl] of Object.entries(plugin.instance.hooks)) {
      if (!this.hooks.has(hookName)) {
        console.warn(`Unknown hook: ${hookName}`);
        continue;
      }

      // Register hook implementation
      plugin.instance[`_hook_${hookName}`] = hookImpl;
    }
  }

  private async unregisterPluginHooks(plugin: PluginInstance): Promise<void> {
    // Clean up hook implementations
    Object.keys(plugin.instance?.hooks || {}).forEach(hookName => {
      delete plugin.instance[`_hook_${hookName}`];
    });
  }

  private async registerPluginAPIs(plugin: PluginInstance): Promise<void> {
    if (!plugin.instance.apis) return;

    for (const [namespace, api] of Object.entries(plugin.instance.apis)) {
      const apiKey = `${plugin.id}:${namespace}`;
      
      // Register API in global registry
      this.apis.set(apiKey, {
        namespace,
        methods: this.extractAPIMethods(api),
        events: this.extractAPIEvents(api)
      });
    }
  }

  private async unregisterPluginAPIs(plugin: PluginInstance): Promise<void> {
    // Remove APIs from global registry
    Array.from(this.apis.keys())
      .filter(key => key.startsWith(`${plugin.id}:`))
      .forEach(key => this.apis.delete(key));
  }

  private extractAPIMethods(api: any): Record<string, PluginAPIMethod> {
    const methods: Record<string, PluginAPIMethod> = {};
    
    Object.getOwnPropertyNames(api).forEach(name => {
      if (typeof api[name] === 'function' && !name.startsWith('_')) {
        methods[name] = {
          name,
          description: api[name].description || `${name} method`,
          parameters: [], // Would extract from function signature
          returnType: 'any',
          permissions: api[name].permissions || []
        };
      }
    });

    return methods;
  }

  private extractAPIEvents(api: any): Record<string, PluginAPIEvent> {
    // Extract event definitions from API
    return api.events || {};
  }

  private executePluginHookAsync(plugin: PluginInstance, hookName: string, data: any): Promise<any> {
    const hookImpl = plugin.instance[`_hook_${hookName}`];
    if (!hookImpl) return Promise.resolve(null);

    return Promise.resolve(hookImpl(data));
  }

  private executePluginHookSync(plugin: PluginInstance, hookName: string, data: any): any {
    const hookImpl = plugin.instance[`_hook_${hookName}`];
    if (!hookImpl) return null;

    return hookImpl(data);
  }

  private updatePluginMetrics(plugin: PluginInstance, executionTime: number): void {
    plugin.runtime.cpuUsage += executionTime;
    // Update other metrics...
  }

  private recordPluginError(
    pluginId: string,
    type: PluginError['type'],
    message: string,
    stack?: string
  ): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    const error: PluginError = {
      timestamp: new Date(),
      type,
      message,
      stack
    };

    plugin.runtime.errors.push(error);

    // Keep only last 100 errors
    if (plugin.runtime.errors.length > 100) {
      plugin.runtime.errors = plugin.runtime.errors.slice(-100);
    }

    // Set plugin to error state if too many errors
    if (plugin.runtime.errors.filter(e => 
      e.timestamp.getTime() > Date.now() - 60000 // Last minute
    ).length > 10) {
      plugin.status = 'error';
    }
  }

  private validateSettings(
    manifest: PluginManifest,
    settings: Record<string, any>
  ): {valid: boolean; errors: string[]} {
    const errors: string[] = [];

    if (!manifest.settings) return { valid: true, errors };

    manifest.settings.forEach(schema => {
      const value = settings[schema.key];

      if (schema.required && (value === undefined || value === null)) {
        errors.push(`Required setting ${schema.key} is missing`);
        return;
      }

      if (value !== undefined) {
        // Type validation
        if (!this.validateSettingType(value, schema.type)) {
          errors.push(`Setting ${schema.key} has invalid type`);
        }

        // Custom validation
        if (schema.validation) {
          const validationErrors = this.validateSettingValue(value, schema.validation);
          errors.push(...validationErrors);
        }
      }
    });

    return { valid: errors.length === 0, errors };
  }

  private validateSettingType(value: any, type: PluginSettingSchema['type']): boolean {
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'select':
      case 'multi-select': return true; // Would validate against options
      default: return false;
    }
  }

  private validateSettingValue(value: any, validation: PluginSettingSchema['validation']): string[] {
    const errors: string[] = [];

    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Value must be at least ${validation.min}`);
    }

    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Value must be at most ${validation.max}`);
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push('Value does not match required pattern');
      }
    }

    return errors;
  }

  private calculateErrorRate(plugin: PluginInstance): number {
    const recentErrors = plugin.runtime.errors.filter(error =>
      error.timestamp.getTime() > Date.now() - 60 * 60 * 1000 // Last hour
    );

    return plugin.runtime.apiCalls > 0 ? recentErrors.length / plugin.runtime.apiCalls : 0;
  }

  private calculatePerformanceMetrics(plugin: PluginInstance): any {
    return {
      averageCpuTime: plugin.runtime.cpuUsage / Math.max(plugin.runtime.apiCalls, 1),
      memoryEfficiency: plugin.sandboxContext ? 
        1 - (plugin.sandboxContext.usage.memory / plugin.sandboxContext.resourceLimits.memory) : 1,
      uptime: Date.now() - plugin.runtime.loadedAt.getTime()
    };
  }

  private initializeCoreHooks(): void {
    // Define core hooks that plugins can extend
    const coreHooks: PluginHook[] = [
      {
        name: 'before-llm-request',
        description: 'Called before making an LLM request',
        parameters: { provider: 'string', prompt: 'string', options: 'object' },
        returnType: 'object',
        async: true
      },
      {
        name: 'after-llm-response',
        description: 'Called after receiving an LLM response',
        parameters: { provider: 'string', response: 'string', metadata: 'object' },
        returnType: 'object',
        async: true
      },
      {
        name: 'prompt-optimization',
        description: 'Called to optimize prompts',
        parameters: { prompt: 'string', context: 'object' },
        returnType: 'string',
        async: false
      },
      {
        name: 'ui-render',
        description: 'Called during UI rendering',
        parameters: { component: 'string', props: 'object' },
        returnType: 'object',
        async: false
      }
    ];

    coreHooks.forEach(hook => {
      this.hooks.set(hook.name, hook);
    });
  }

  private initializeCoreAPIs(): void {
    // Initialize core APIs that all plugins can access
    this.apis.set('core:system', {
      namespace: 'system',
      methods: {
        getVersion: {
          name: 'getVersion',
          description: 'Get system version',
          parameters: [],
          returnType: 'string',
          permissions: []
        },
        log: {
          name: 'log',
          description: 'Log a message',
          parameters: [
            { name: 'level', type: 'string', required: true },
            { name: 'message', type: 'string', required: true }
          ],
          returnType: 'void',
          permissions: []
        }
      },
      events: {}
    });
  }

  private startMonitoring(): void {
    // Monitor plugin resource usage
    setInterval(() => {
      this.plugins.forEach(plugin => {
        if (plugin.sandboxContext) {
          // Update resource usage metrics
          this.updateResourceUsage(plugin);
        }
      });
    }, 30000); // Every 30 seconds
  }

  private updateResourceUsage(plugin: PluginInstance): void {
    if (!plugin.sandboxContext) return;

    // Mock resource usage monitoring
    plugin.sandboxContext.usage.memory = Math.random() * 1024 * 1024; // Random memory usage
    plugin.runtime.memoryUsage = plugin.sandboxContext.usage.memory;

    // Check if limits are exceeded
    if (plugin.sandboxContext.usage.memory > plugin.sandboxContext.resourceLimits.memory) {
      console.warn(`Plugin ${plugin.id} exceeded memory limit`);
      plugin.status = 'error';
    }
  }
}

// Supporting classes
class PluginRegistry {
  async getPluginCode(pluginId: string): Promise<string> {
    // In practice, this would fetch from a plugin registry
    return `
      class Plugin {
        constructor(api, settings, manifest) {
          this.api = api;
          this.settings = settings;
          this.manifest = manifest;
        }

        async initialize() {
          console.log('Plugin initialized:', this.manifest.name);
        }

        hooks = {
          'prompt-optimization': (data) => {
            return data.prompt + ' (optimized by ' + this.manifest.name + ')';
          }
        };

        apis = {
          custom: {
            hello: () => 'Hello from ' + this.manifest.name
          }
        };

        async cleanup() {
          console.log('Plugin cleaned up:', this.manifest.name);
        }
      }
    `;
  }
}

class PluginEventBus {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for ${event}:`, error);
        }
      });
    }
  }
}

class PluginSecurityManager {
  async checkAPIPermission(
    plugin: PluginInstance,
    namespace: string,
    method: string
  ): Promise<boolean> {
    // Check if plugin has permission to call this API method
    const requiredPermission = `api-access:${namespace}`;
    return plugin.manifest.permissions.some(p => 
      p.type === 'api-access' && p.resource === namespace
    );
  }
}

class PluginDependencyManager {
  async checkDependencies(dependencies: Record<string, string>): Promise<{
    satisfied: boolean;
    missing: string[];
  }> {
    const missing: string[] = [];

    // Check each dependency
    for (const [name, version] of Object.entries(dependencies)) {
      if (!this.isDependencyAvailable(name, version)) {
        missing.push(`${name}@${version}`);
      }
    }

    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  private isDependencyAvailable(name: string, version: string): boolean {
    // Mock dependency check - in practice would check against available packages
    const availableDeps = ['lodash', 'axios', 'crypto-js'];
    return availableDeps.includes(name);
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();
export type { 
  PluginManifest, 
  PluginInstance, 
  PluginPermission, 
  PluginSettingSchema,
  PluginHook,
  PluginAPI 
};