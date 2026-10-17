type ReadFailure={message:string}|null;
export function crewAvailability({directoryError,profileError,historyError}:{directoryError:ReadFailure;profileError:ReadFailure;historyError:ReadFailure}){
  const directoryAvailable=!directoryError;
  const profileAvailable=directoryAvailable&&!profileError;
  return {directoryAvailable,profileAvailable,historyAvailable:!historyError,rateChangesAvailable:profileAvailable&&!historyError};
}
