export class VenueFilterDto {
  location?: string;
  searchMode?: 'location' | 'venue';

  lat?: number;
  lng?: number;
  radius?: number;

  category_id?: number;
  venue_id?: number;

  minPrice?: number;
  maxPrice?: number;

  guest_rooms?: number;

  amenities?: string[];
  tags?: string[];
  shifts?: number[];

  page?: number;
  limit?: number;
}