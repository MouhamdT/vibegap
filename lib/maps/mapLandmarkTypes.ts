/** Map-only landmark context from Google Places (not used in ranking). */
export type MapLandmarkPlace = {
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
};
