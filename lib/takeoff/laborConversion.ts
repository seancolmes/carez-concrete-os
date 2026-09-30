const finiteNonnegative=(value:number)=>Number.isFinite(value)&&value>=0;
const finitePositive=(value:number)=>Number.isFinite(value)&&value>0;

export function crewDaysToManHoursPerUnit(crewDays:number,crewSize:number,hoursPerDay:number,productionQuantity:number):number|null{
  if(!finiteNonnegative(crewDays)||!Number.isInteger(crewSize)||!finitePositive(crewSize)||!finitePositive(hoursPerDay)||!finitePositive(productionQuantity))return null;
  const rate=crewDays*crewSize*hoursPerDay/productionQuantity;
  return Number.isFinite(rate)?rate:null;
}

export function manHoursPerUnitToCrewDays(rate:number,productionQuantity:number,crewSize:number,hoursPerDay:number):number|null{
  if(!finiteNonnegative(rate)||!finitePositive(productionQuantity)||!Number.isInteger(crewSize)||!finitePositive(crewSize)||!finitePositive(hoursPerDay))return null;
  const days=rate*productionQuantity/(crewSize*hoursPerDay);
  return Number.isFinite(days)?days:null;
}

export function laborDirectPerSfToManHoursPerUnit(pricePerSf:number,burdenedHourlyRate:number):number|null{
  if(!finiteNonnegative(pricePerSf)||!finitePositive(burdenedHourlyRate))return null;
  const rate=pricePerSf/burdenedHourlyRate;
  return Number.isFinite(rate)?rate:null;
}

export function manHoursPerUnitToLaborDirectPerSf(rate:number,burdenedHourlyRate:number):number|null{
  if(!finiteNonnegative(rate)||!finitePositive(burdenedHourlyRate))return null;
  const price=rate*burdenedHourlyRate;
  return Number.isFinite(price)?price:null;
}
