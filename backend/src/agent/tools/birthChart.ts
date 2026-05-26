import type { BirthDetails } from "../state.js";

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  house: number;
}

export interface BirthChartResult {
  planets: PlanetPosition[];
  ascendant: string;
  houses: string[];
  rawData: any;
}

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

function degreeToSign(degree: number): { sign: string; deg: number } {
  const index = Math.floor(degree / 30) % 12;
 return { sign: SIGNS[index] ?? "Unknown", deg: parseFloat((degree % 30).toFixed(2)) };
}

export async function computeBirthChart(birthDetails: BirthDetails): Promise<BirthChartResult> {
  console.log("birthChart called with:", birthDetails);
  
  const ephemeris = await import("ephemeris");
  const Ephemeris = ephemeris.default ?? ephemeris;
  console.log("Ephemeris keys:", Object.keys(Ephemeris));

  const [year, month, day] = birthDetails.date.split("-").map(Number);
  const [hour = 0, minute = 0] = birthDetails.time.split(":").map(Number);

  try {
   // @ts-ignore
const result = Ephemeris.getAllPlanets(
  new Date(`${birthDetails.date}T${birthDetails.time}:00`),
  birthDetails.lng,
  birthDetails.lat,
  0
);
  console.log("Ephemeris result:", JSON.stringify(result).slice(0, 200));

  const planets: PlanetPosition[] = Object.entries(result.observed).map(
    ([name, data]: [string, any]) => {
      const { sign, deg } = degreeToSign(data.apparentLongitudeDd);
      return { planet: name, sign, degree: deg, house: 0 };
    }
  );

  return {
    planets,
    ascendant: planets[0]?.sign ?? "Unknown",
    houses: [],
    rawData: result,
  };
} catch (err) {
  console.error("Ephemeris error:", err);
  throw err;
}
}