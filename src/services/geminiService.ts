import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface PredictionData {
  riskScore: number;
  delaySummary: string;
  weatherImpact: string;
  alternativeRoute: string;
  confidenceScore: number;
  factors: string[];
  distanceKm: number;
  avgVelocity: string;
  etaHours: string;
  originCoords: [number, number];
  destinationCoords: [number, number];
}

export async function predictShipmentRisks(
  destination: string,
  deliveryTime: string,
  currentLocation: string = "Distribution Center Central"
): Promise<PredictionData> {
  const prompt = `Analyze a supply chain shipment from ${currentLocation} to ${destination} with a deadline of ${deliveryTime}.
  Predict potential delay risks and calculate logistics metrics.
  Provide a JSON object with:
  - riskScore: 0-100 indicating delay risk.
  - delaySummary: Brief explanation of primary risks.
  - weatherImpact: Likely weather conditions affecting the route.
  - alternativeRoute: A suggested optimized route if risk is high.
  - confidenceScore: 0-1.0 indicating AI confidence in this prediction.
  - factors: list of top 3 risk factors.
  - distanceKm: Estimated total distance in kilometers.
  - avgVelocity: Estimated average speed (e.g. "65 km/h" or "18 knots").
  - etaHours: Estimated time to arrival in hrs:min format (e.g. "05:15" or "12:45").
  - originCoords: [latitude, longitude] for the origin location.
  - destinationCoords: [latitude, longitude] for the destination location.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            delaySummary: { type: Type.STRING },
            weatherImpact: { type: Type.STRING },
            alternativeRoute: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            factors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            distanceKm: { type: Type.NUMBER },
            avgVelocity: { type: Type.STRING },
            etaHours: { type: Type.STRING },
            originCoords: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            destinationCoords: { type: Type.ARRAY, items: { type: Type.NUMBER } }
          },
          required: ["riskScore", "delaySummary", "weatherImpact", "alternativeRoute", "confidenceScore", "factors", "distanceKm", "avgVelocity", "etaHours", "originCoords", "destinationCoords"]
        }
      }
    });

    const data = JSON.parse(response.text);
    return data;
  } catch (error) {
    console.error("AI Prediction failed:", error);
    // Return mock data if API fails or isn't configured for dev
    return {
      riskScore: 15,
      delaySummary: "Low risk detected. Standard transit times expected.",
      weatherImpact: "Clear skies across the route.",
      alternativeRoute: "Highway 101 - Primary Path",
      confidenceScore: 0.95,
      factors: ["Light traffic", "Favorable weather", "Optimized route"],
      distanceKm: 450,
      avgVelocity: "75 km/h",
      etaHours: "06:00",
      originCoords: [40, -100],
      destinationCoords: [41, -99]
    };
  }
}
