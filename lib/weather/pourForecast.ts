type PourLocation = {city: string | null; state: string | null; date: string};
export type PourForecast = {high: number; low: number; precipitation: number; condition: string};

const stateNames: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',
};

const conditionFor = (code: number) => {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorms';
};

export const pourForecastKey = ({city,state,date}: PourLocation) => `${city?.trim().toLowerCase()||''}|${state?.trim().toLowerCase()||''}|${date}`;

async function forecastForLocation(city: string, state: string, dates: string[]): Promise<Map<string, PourForecast>> {
  const result = new Map<string, PourForecast>();
  const stateName = stateNames[state.trim().toUpperCase()] || state.trim();
  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.search = new URLSearchParams({name:city,count:'10',language:'en',format:'json',countryCode:'US'}).toString();
  const geoResponse = await fetch(geoUrl, {next:{revalidate:86_400},signal:AbortSignal.timeout(5_000)});
  if (!geoResponse.ok) return result;
  const geo = await geoResponse.json();
  const place = Array.isArray(geo.results) ? geo.results.find((item: any) =>
    String(item.name||'').toLowerCase()===city.toLowerCase() &&
    String(item.admin1||'').toLowerCase()===stateName.toLowerCase() &&
    Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) : null;
  if (!place) return result;

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude:String(place.latitude),longitude:String(place.longitude),
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit:'fahrenheit',timezone:'auto',forecast_days:'8',
  }).toString();
  const response = await fetch(forecastUrl, {next:{revalidate:3_600},signal:AbortSignal.timeout(5_000)});
  if (!response.ok) return result;
  const data = await response.json();
  const daily = data.daily;
  if (!Array.isArray(daily?.time)) return result;
  for (const date of dates) {
    const index = daily.time.indexOf(date);
    if (index < 0) continue;
    const high = Number(daily.temperature_2m_max?.[index]);
    const low = Number(daily.temperature_2m_min?.[index]);
    const precipitation = Number(daily.precipitation_probability_max?.[index]);
    const code = Number(daily.weather_code?.[index]);
    if (![high,low,precipitation,code].every(Number.isFinite)) continue;
    result.set(date, {high:Math.round(high),low:Math.round(low),precipitation:Math.round(precipitation),condition:conditionFor(code)});
  }
  return result;
}

export async function getPourForecasts(locations: PourLocation[]): Promise<Map<string, PourForecast>> {
  const result = new Map<string, PourForecast>();
  const groups = new Map<string, {city:string;state:string;dates:Set<string>}>();
  for (const location of locations) {
    if (!location.city?.trim() || !location.state?.trim()) continue;
    const key = `${location.city.trim().toLowerCase()}|${location.state.trim().toLowerCase()}`;
    const group = groups.get(key) || {city:location.city.trim(),state:location.state.trim(),dates:new Set<string>()};
    group.dates.add(location.date);
    groups.set(key,group);
  }
  await Promise.all([...groups.values()].map(async group => {
    try {
      const forecasts = await forecastForLocation(group.city,group.state,[...group.dates]);
      for (const [date,forecast] of forecasts) result.set(pourForecastKey({city:group.city,state:group.state,date}),forecast);
    } catch { /* Weather is optional; never block the operating view. */ }
  }));
  return result;
}
