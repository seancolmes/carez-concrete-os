import type {
  ConditionArchetypeDefinition,
  ConditionModuleConfiguration,
  ConditionModuleKey,
} from './types.ts';

export function validateConditionModuleConfigurations(
  definition: ConditionArchetypeDefinition,
  modules: ConditionModuleConfiguration[],
) {
  const schemas = new Map((definition.modules || []).map(module => [module.key, module]));
  const identities = new Set<string>();
  const defaults = new Map<ConditionModuleKey, number>();

  for (const module of modules) {
    const schema = schemas.get(module.moduleKey);
    if (!schema) throw new Error(`Unsupported Condition module: ${module.moduleKey}.`);
    const instanceKey = String(module.instanceKey || 'default').trim() || 'default';
    const identity = `${module.moduleKey}:${instanceKey}`;
    if (identities.has(identity)) throw new Error(`Condition module instance ${identity} is configured more than once.`);
    identities.add(identity);
    if (!schema.repeatable && instanceKey !== 'default') throw new Error(`${schema.label} is not repeatable.`);
    if (instanceKey === 'default') defaults.set(module.moduleKey, (defaults.get(module.moduleKey) || 0) + 1);
  }

  for (const schema of definition.modules || []) {
    if ((defaults.get(schema.key) || 0) !== 1) throw new Error(`${schema.label} requires exactly one default module instance.`);
  }
}
