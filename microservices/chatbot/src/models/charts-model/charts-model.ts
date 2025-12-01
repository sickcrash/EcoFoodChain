export interface SignalData {
    date: string;
    value: number;
    max_t: number;
    min_t: number;
    last_conn: string;
    elaborated: string;
}

interface SignalInfo {
    granularity: string;
    overBound: boolean;
}

export type ChartsEntity = Record<string, SignalData[] | SignalInfo>;

export type ChartsModel = ChartsEntity;