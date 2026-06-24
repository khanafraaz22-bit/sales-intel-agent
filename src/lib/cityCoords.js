// City → [lon, lat] for plotting company locations on the world map.
// ~140 major global business cities. Lookup is case-insensitive and matches on
// the city portion (before any comma), so "New York, USA" and "new york" both hit.

export const CITY_COORDS = {
  "new york": [-74.0, 40.7], "san francisco": [-122.4, 37.8], "los angeles": [-118.2, 34.1],
  "chicago": [-87.6, 41.9], "boston": [-71.1, 42.4], "seattle": [-122.3, 47.6],
  "austin": [-97.7, 30.3], "atlanta": [-84.4, 33.7], "dallas": [-96.8, 32.8],
  "washington": [-77.0, 38.9], "miami": [-80.2, 25.8], "denver": [-105.0, 39.7],
  "toronto": [-79.4, 43.7], "vancouver": [-123.1, 49.3], "montreal": [-73.6, 45.5],
  "mexico city": [-99.1, 19.4], "são paulo": [-46.6, -23.5], "sao paulo": [-46.6, -23.5],
  "rio de janeiro": [-43.2, -22.9], "buenos aires": [-58.4, -34.6], "santiago": [-70.7, -33.4],
  "bogota": [-74.1, 4.7], "bogotá": [-74.1, 4.7], "lima": [-77.0, -12.0],
  "london": [-0.1, 51.5], "manchester": [-2.2, 53.5], "dublin": [-6.3, 53.3],
  "paris": [2.4, 48.9], "amsterdam": [4.9, 52.4], "rotterdam": [4.5, 51.9],
  "frankfurt": [8.7, 50.1], "berlin": [13.4, 52.5], "munich": [11.6, 48.1],
  "zurich": [8.5, 47.4], "geneva": [6.1, 46.2], "milan": [9.2, 45.5], "rome": [12.5, 41.9],
  "madrid": [-3.7, 40.4], "barcelona": [2.2, 41.4], "lisbon": [-9.1, 38.7],
  "brussels": [4.4, 50.8], "luxembourg": [6.1, 49.6], "vienna": [16.4, 48.2],
  "stockholm": [18.1, 59.3], "oslo": [10.8, 59.9], "copenhagen": [12.6, 55.7],
  "helsinki": [24.9, 60.2], "warsaw": [21.0, 52.2], "prague": [14.4, 50.1],
  "moscow": [37.6, 55.8], "istanbul": [29.0, 41.0], "athens": [23.7, 38.0],
  "dubai": [55.3, 25.2], "abu dhabi": [54.4, 24.5], "doha": [51.5, 25.3],
  "riyadh": [46.7, 24.7], "tel aviv": [34.8, 32.1], "cairo": [31.2, 30.0],
  "johannesburg": [28.0, -26.2], "cape town": [18.4, -33.9], "lagos": [3.4, 6.5],
  "nairobi": [36.8, -1.3], "casablanca": [-7.6, 33.6], "accra": [-0.2, 5.6],
  "mumbai": [72.9, 19.1], "delhi": [77.2, 28.6], "new delhi": [77.2, 28.6],
  "bangalore": [77.6, 13.0], "bengaluru": [77.6, 13.0], "hyderabad": [78.5, 17.4],
  "chennai": [80.3, 13.1], "pune": [73.9, 18.5], "kolkata": [88.4, 22.6],
  "gurgaon": [77.0, 28.5], "gurugram": [77.0, 28.5], "noida": [77.4, 28.6],
  "singapore": [103.8, 1.35], "hong kong": [114.2, 22.3], "shanghai": [121.5, 31.2],
  "beijing": [116.4, 39.9], "shenzhen": [114.1, 22.5], "guangzhou": [113.3, 23.1],
  "tokyo": [139.7, 35.7], "osaka": [135.5, 34.7], "seoul": [127.0, 37.6],
  "taipei": [121.6, 25.0], "bangkok": [100.5, 13.8], "jakarta": [106.8, -6.2],
  "kuala lumpur": [101.7, 3.1], "manila": [121.0, 14.6], "ho chi minh city": [106.7, 10.8],
  "hanoi": [105.8, 21.0], "sydney": [151.2, -33.9], "melbourne": [144.9, -37.8],
  "brisbane": [153.0, -27.5], "perth": [115.9, -31.9], "auckland": [174.8, -36.8],
  "tokyo, japan": [139.7, 35.7],
};

// Resolve a "City, Country" (or just "City") string to [lon, lat], or null.
export function lookupCity(label) {
  if (!label) return null;
  const city = label.split(",")[0].trim().toLowerCase();
  return CITY_COORDS[city] || CITY_COORDS[label.trim().toLowerCase()] || null;
}
