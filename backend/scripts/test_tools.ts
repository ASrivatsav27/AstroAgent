import { geocodePlace } from "../src/agent/tools/geocodePlace.js";
import { computeBirthChart } from "../src/agent/tools/birthChart.js";

async function main() {
  try {
    console.log("Testing geocodePlace for Hyderabad...");
    const geo = await geocodePlace("Hyderabad");
    console.log("Geocode success:", geo);

    console.log("Testing computeBirthChart...");
    const chart = await computeBirthChart({
      date: "1995-06-15",
      time: "10:30",
      place: "Hyderabad",
      ...geo
    });
    console.log("Chart success planets count:", chart?.planets?.length);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

main();
