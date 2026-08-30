export const resolveResourceBehavior = (component: { resource_behavior?: unknown; estimate_item_type?: unknown }) => {
  const behavior = String(component.resource_behavior || '').trim();
  if (behavior) return behavior;
  switch (String(component.estimate_item_type || '').toLowerCase()) {
    case 'labor': return 'labor';
    case 'material': return 'consumed_material';
    case 'equipment': return 'owned_equipment';
    case 'subcontractor': return 'subcontractor';
    default: return 'legacy_other';
  }
};

export const outputSnapshotState = (component: { estimate_visible?: unknown }, isActive: boolean) => ({
  is_active: isActive,
  estimate_visible: component.estimate_visible !== false,
});
