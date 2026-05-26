import type { BirthChartResult } from "./birthChart.js";

const ASTROLOGY_KNOWLEDGE: Record<string, string> = {
  sun: "The Sun represents your core identity, ego, and life purpose. It shows how you shine and what drives you.",
  moon: "The Moon governs emotions, instincts, and subconscious patterns. It reflects your inner world and emotional needs.",
  mercury: "Mercury rules communication, thinking, and learning. It shows how you process and share information.",
  venus: "Venus governs love, beauty, and values. It reflects what you find attractive and how you relate to others.",
  mars: "Mars rules drive, ambition, and action. It shows how you pursue goals and assert yourself.",
  jupiter: "Jupiter represents expansion, luck, and wisdom. It shows where you find growth and abundance.",
  saturn: "Saturn governs discipline, responsibility, and karma. It shows where you face challenges and build mastery.",
  uranus: "Uranus rules innovation, rebellion, and sudden change. It shows where you break from tradition.",
  neptune: "Neptune governs dreams, intuition, and spirituality. It shows where you seek transcendence.",
  pluto: "Pluto rules transformation, power, and rebirth. It shows where you undergo deep change.",
  aries: "Aries is bold, pioneering, and energetic. A natural leader who acts first and thinks later.",
  taurus: "Taurus is grounded, patient, and sensual. Values stability, comfort, and the finer things in life.",
  gemini: "Gemini is curious, adaptable, and communicative. Thrives on variety, ideas, and connection.",
  cancer: "Cancer is nurturing, intuitive, and protective. Deeply connected to home, family, and emotions.",
  leo: "Leo is creative, confident, and generous. Loves to shine, lead, and inspire others.",
  virgo: "Virgo is analytical, practical, and service-oriented. Finds meaning in refinement and helping others.",
  libra: "Libra is diplomatic, harmonious, and fair-minded. Seeks balance and meaningful partnerships.",
  scorpio: "Scorpio is intense, perceptive, and transformative. Drawn to depth, mystery, and truth.",
  sagittarius: "Sagittarius is adventurous, philosophical, and optimistic. Seeks freedom, wisdom, and new horizons.",
  capricorn: "Capricorn is ambitious, disciplined, and pragmatic. Builds lasting structures through hard work.",
  aquarius: "Aquarius is innovative, humanitarian, and independent. Thinks ahead and champions collective progress.",
  pisces: "Pisces is compassionate, imaginative, and spiritual. Deeply empathetic and attuned to the unseen.",
  retrograde: "A retrograde planet appears to move backward. It signals a time to review, revisit, and reflect on that planet's themes.",
  ascendant: "The Ascendant or Rising sign is the zodiac sign rising on the eastern horizon at birth. It shapes your outward personality and first impressions.",
  mercury_retrograde: "Mercury retrograde is a period to slow down communication, avoid signing contracts, and review plans carefully.",
};

export interface KnowledgeResult {
  query: string;
  matches: { keyword: string; explanation: string }[];
  found: boolean;
}

export function knowledgeLookup(query: string): KnowledgeResult {
  const lower = query.toLowerCase();

  const matches = Object.entries(ASTROLOGY_KNOWLEDGE)
    .filter(([keyword]) => lower.includes(keyword))
    .map(([keyword, explanation]) => ({ keyword, explanation }));

  return {
    query,
    matches,
    found: matches.length > 0,
  };
}