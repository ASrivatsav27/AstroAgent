export interface BirthDetails {
    date: string
    time: string
    place: string
    lat?: number
    lng?: number
    timezone?: string
}

export interface Message {
    role: "user" | "assistant" | "tool"
    content: string
    toolCall?: string
    timestamp: Date
}

export interface ChartPlanet {
    planet: string
    sign: string
    degree: number
    house: number
}

export interface ChartData {
    planets: ChartPlanet[]
    ascendant: string
    houses?: string[]
    rawData?: any
}

export interface AgentState {
    messages: Message[]
    birthDetails: BirthDetails | null
    currentTool: string | null
    toolOutput: any | null
    chartData: ChartData | null
    intent: "chart_request" | "daily_transit" | "free_form" | "off_topic" | null
    error: string | null
    userId: string | null
}

export const initialState: AgentState = {
    messages: [],
    birthDetails: null,
    currentTool: null,
    toolOutput: null,
    chartData: null,
    intent: null,
    error: null,
    userId: null,
};






