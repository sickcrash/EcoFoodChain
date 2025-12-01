export interface LandModel {
  name: string;
  signals: {
    name: string;
    value: string;
    lastConnection: string;
  }[];
  lat: number;
  long: number;
}
