import { computeBirthChart } from "./birthChart.js";
import type { PlanetPosition } from "./birthChart.js";

type BirthDetails = import("../state.js").BirthDetails;

export interface TransitResult {
  date: string;
  transits: {
    planet: string;
    currentSign: string;
    currentDegree: number;
    aspectsNatal: string | null;
  }[];
  summary: string;
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

function checkAspect(transitDeg: number, natalDeg: number): string | null {
  const diff = Math.abs(transitDeg - natalDeg) % 360;
  const orb = 6;
  if (diff <= orb || diff >= 360 - orb) return "conjunction";
  if (Math.abs(diff - 60) <= orb) return "sextile";
  if (Math.abs(diff - 90) <= orb) return "square";
  if (Math.abs(diff - 120) <= orb) return "trine";
  if (Math.abs(diff - 180) <= orb) return "opposition";
  return null;
}

export async function getDailyTransits(
  birthDetails: BirthDetails,
  date: string = new Date().toISOString().split("T")[0] ?? "2026-01-01",
  existingChart?: import("./birthChart.js").BirthChartResult | null
): Promise<TransitResult> {
  const { Ephemeris } = await import("ephemeris");

  const [year, month, day] = date.split("-").map(Number);

  // Reuse existing natal chart if available, otherwise compute it
  const natal = existingChart ?? await computeBirthChart(birthDetails);

  // Then today's transits
  const todayResult = Ephemeris.getAllPlanets(
    { year, month, day, hour: 12 },
    birthDetails.lng ?? 0,
    birthDetails.lat ?? 0,
    0
  );

  const transits = Object.entries(todayResult.observed).map(
    ([name, data]: [string, any]) => {
      const transitDeg: number = data.apparentLongitudeDd;
      const { sign, deg } = degreeToSign(transitDeg);

      const natalPlanet = natal.planets.find((p: PlanetPosition) => p.planet === name);
      const aspect = natalPlanet
        ? checkAspect(transitDeg, natalPlanet.degree)
        : null;

      return {
        planet: name,
        currentSign: sign,
        currentDegree: deg,
        aspectsNatal: aspect,
      };
    }
  );

  return {
    date,
    transits,
    summary: `${transits.length} planets tracked for ${date}`,
  };
}