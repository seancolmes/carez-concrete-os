'use client';

import { ConcreteConditionAuthoring } from './ConcreteConditionAuthoring';
import { TakeoffDrawingWorkspace } from './TakeoffDrawingWorkspace';

type Props = {
  setId: string;
  workspaceProps: any;
  conditionData: any;
};

export function TakeoffConditionWorkflowShell({ setId, workspaceProps, conditionData }: Props) {
  const conditionMeasurementIds = Array.from(new Set(
    (conditionData?.roles || [])
      .map((role: any) => role.measurement_id)
      .filter(Boolean),
  ));

  return <>
    <TakeoffDrawingWorkspace
      {...workspaceProps}
      conditionAuthoringActive
      conditionMeasurementIds={conditionMeasurementIds}
    />
    <ConcreteConditionAuthoring
      takeoffSetId={setId}
      locked={workspaceProps.locked}
      measurements={workspaceProps.initialMeasurements}
      assemblies={workspaceProps.assemblies}
      assemblyVersions={workspaceProps.versions}
      conditionData={conditionData}
    />
  </>;
}
